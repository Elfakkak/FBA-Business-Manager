// Shared Amazon sync engine — used by both the in-app "Sync everything" button and the
// nightly cron. Each fn takes a Supabase client (session OR service-role) + creds and
// writes results, so the same logic runs interactively and headless.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { gunzipSync } from "node:zlib";
import { fetchFbaInventory, getAccessToken, hostFor, type AmazonCreds } from "./sp-api";
import { fetchFbaInbounds } from "./fba-inbound";

type DB = SupabaseClient<Database>; // keep update payloads type-checked
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// ---------- FBA inventory (on-hand / reserved / inbound / unfulfillable) ----------
export async function runInventorySync(db: DB, creds: AmazonCreds) {
  const inv = await fetchFbaInventory(creds);
  let matched = 0;
  for (const r of inv) {
    if (!r.sellerSku) continue;
    const { data } = await db.from("product_variants")
      .update({ fba_stock: r.total, inbound: r.inbound, unfulfillable: r.unfulfillable, reserved: r.reserved })
      .eq("sku", r.sellerSku).select("id");
    if (data?.length) matched += data.length;
  }
  return { skus: inv.length, matched };
}

// ---------- FBA inbound shipments + items ----------
export async function runInboundSync(db: DB, creds: AmazonCreds) {
  const shipments = await fetchFbaInbounds(creds);
  for (const s of shipments) {
    await db.from("fba_inbounds").upsert({
      id: s.shipmentId, fc: s.fc, sku_count: s.skuCount, expected: s.expected,
      received: s.received, amazon_status: s.amazonStatus, synced: new Date().toISOString(),
    }, { onConflict: "id" });
    await db.from("fba_inbound_items").delete().eq("inbound_id", s.shipmentId);
    if (s.items.length) {
      await db.from("fba_inbound_items").insert(
        s.items.map((i) => ({ inbound_id: s.shipmentId, sku: i.sellerSku, fnsku: i.fnSku, expected: i.quantityShipped, received: i.quantityReceived })),
      );
    }
  }
  // prune shipments Amazon no longer returns (e.g. stale legacy v0 rows)
  const keep = shipments.map((s) => s.shipmentId);
  if (keep.length) {
    const { data: stale } = await db.from("fba_inbounds").select("id").not("id", "in", `(${keep.map((k) => `"${k}"`).join(",")})`);
    const staleIds = (stale ?? []).map((r) => r.id);
    if (staleIds.length) {
      await db.from("fba_inbound_items").delete().in("inbound_id", staleIds);
      await db.from("fba_inbounds").delete().in("id", staleIds);
    }
  }
  return { shipments: shipments.length };
}

// ---------- Sales velocity + realized price (ALL_ORDERS report) ----------
const WINDOW = 30;
export async function runSalesSync(db: DB, creds: AmazonCreds, maxWaitMs = 120_000) {
  const token = await getAccessToken(creds);
  const host = hostFor(creds.region);
  const H = { "x-amz-access-token": token, "Content-Type": "application/json" };
  const end = new Date(); const start = new Date(end.getTime() - WINDOW * 864e5);

  const create = await fetch(`${host}/reports/2021-06-30/reports`, {
    method: "POST", headers: H,
    body: JSON.stringify({ reportType: "GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL", marketplaceIds: [creds.marketplace_id || "ATVPDKIKX0DER"], dataStartTime: start.toISOString(), dataEndTime: end.toISOString() }),
  });
  const cj = await create.json();
  if (!create.ok) throw new Error(cj?.errors?.[0]?.message || `report create HTTP ${create.status}`);

  const deadline = Date.now() + maxWaitMs;
  let docId: string | undefined, status = "";
  while (Date.now() < deadline) {
    await sleep(4000);
    const g = await (await fetch(`${host}/reports/2021-06-30/reports/${cj.reportId}`, { headers: H })).json();
    status = g.processingStatus; docId = g.reportDocumentId;
    if (status === "DONE") break;
    if (status === "FATAL" || status === "CANCELLED") throw new Error(`sales report ${status}`);
  }
  if (!docId) throw new Error(`sales report not ready (${status})`);

  const doc = await (await fetch(`${host}/reports/2021-06-30/documents/${docId}`, { headers: H })).json();
  const raw = Buffer.from(await (await fetch(doc.url)).arrayBuffer());
  const text = doc.compressionAlgorithm === "GZIP" ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = (lines.shift() ?? "").split("\t");
  const find = (...n: string[]) => n.map((x) => header.indexOf(x)).find((i) => i >= 0) ?? -1;
  const iSku = find("sku", "seller-sku"), iQty = find("quantity-purchased", "quantity", "shipped-quantity"), iStatus = find("order-status", "item-status"), iPrice = find("item-price");
  const units: Record<string, number> = {}, rev: Record<string, number> = {}, pricedUnits: Record<string, number> = {};
  for (const line of lines) {
    const c = line.split("\t");
    if ((c[iStatus] || "").toLowerCase().includes("cancel")) continue;
    const sku = c[iSku]; const qty = parseInt(c[iQty]) || 0;
    if (!sku || !qty) continue;
    units[sku] = (units[sku] ?? 0) + qty;
    const price = iPrice >= 0 ? parseFloat(c[iPrice]) : NaN;
    if (!Number.isNaN(price) && price > 0) { rev[sku] = (rev[sku] ?? 0) + price; pricedUnits[sku] = (pricedUnits[sku] ?? 0) + qty; } // ignore $0 promo lines
  }
  let updated = 0;
  for (const [sku, u] of Object.entries(units)) {
    const patch: { velocity: number; sale_price?: number } = { velocity: +(u / WINDOW).toFixed(3) };
    if (rev[sku] != null && pricedUnits[sku] > 0) patch.sale_price = +(rev[sku] / pricedUnits[sku]).toFixed(2);
    const { data } = await db.from("product_variants").update(patch).eq("sku", sku).select("id");
    updated += data?.length ?? 0;
  }
  return { skus: Object.keys(units).length, updated };
}

// ---------- Amazon Ads spend / sales (Sponsored Products advertised-product report) ----------
const ADS_HOST: Record<string, string> = { na: "https://advertising-api.amazon.com", eu: "https://advertising-api-eu.amazon.com", fe: "https://advertising-api-fp.amazon.com" };
export type AdsCreds = { client_id?: string; client_secret?: string; refresh_token?: string; region?: string; profile_id?: string };

async function adsToken(c: AdsCreds) {
  const res = await fetch("https://api.amazon.com/auth/o2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: c.refresh_token ?? "", client_id: c.client_id ?? "", client_secret: c.client_secret ?? "" }) });
  const j = await res.json(); if (!j.access_token) throw new Error(j.error_description || "Ads LWA failed"); return j.access_token as string;
}

export async function runAdsSync(db: DB, c: AdsCreds, maxWaitMs = 120_000) {
  if (!c.refresh_token) return { skipped: true, skus: 0 };
  const host = ADS_HOST[(c.region || "na").toLowerCase()] || ADS_HOST.na;
  const profileId = c.profile_id || "2713745068193310";
  const token = await adsToken(c);
  const H = { Authorization: `Bearer ${token}`, "Amazon-Advertising-API-ClientId": c.client_id ?? "", "Amazon-Advertising-API-Scope": profileId };
  const end = new Date(); const start = new Date(end.getTime() - 30 * 864e5);

  const create = await fetch(`${host}/reporting/reports`, {
    method: "POST", headers: { ...H, "Content-Type": "application/vnd.createasyncreportrequest.v3+json" },
    body: JSON.stringify({ name: "vyonix-sp-adv", startDate: ymd(start), endDate: ymd(end), configuration: { adProduct: "SPONSORED_PRODUCTS", reportTypeId: "spAdvertisedProduct", groupBy: ["advertiser"], columns: ["advertisedSku", "spend", "sales30d", "unitsSoldClicks30d"], timeUnit: "SUMMARY", format: "GZIP_JSON" } }),
  });
  const cj = await create.json();
  if (!create.ok) throw new Error(cj?.detail || cj?.message || `ads report HTTP ${create.status}`);

  const deadline = Date.now() + maxWaitMs;
  let url: string | undefined, status = "";
  while (Date.now() < deadline) {
    await sleep(5000);
    const g = await (await fetch(`${host}/reporting/reports/${cj.reportId}`, { headers: H })).json();
    status = g.status; url = g.url;
    if (status === "COMPLETED") break;
    if (status === "FAILURE") throw new Error(`ads report FAILURE`);
  }
  if (!url) throw new Error(`ads report not ready (${status})`);

  const rows = JSON.parse(gunzipSync(Buffer.from(await (await fetch(url)).arrayBuffer())).toString("utf8")) as { advertisedSku?: string; spend?: number; sales30d?: number; unitsSoldClicks30d?: number }[];
  const bySku: Record<string, { spend: number; sales: number; units: number }> = {};
  for (const r of rows) {
    const sku = r.advertisedSku; if (!sku) continue;
    const e = bySku[sku] ?? { spend: 0, sales: 0, units: 0 };
    e.spend += r.spend ?? 0; e.sales += r.sales30d ?? 0; e.units += r.unitsSoldClicks30d ?? 0;
    bySku[sku] = e;
  }
  let updated = 0;
  for (const [sku, e] of Object.entries(bySku)) {
    const { data } = await db.from("product_variants").update({ ad_spend_30d: +e.spend.toFixed(2), ad_sales_30d: +e.sales.toFixed(2), ad_units_30d: e.units }).eq("sku", sku).select("id");
    updated += data?.length ?? 0;
  }
  return { skus: Object.keys(bySku).length, updated };
}
