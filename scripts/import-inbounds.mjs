// Verify + populate FBA inbound shipments (2024-03-20 "Send to Amazon" API).
//   Phase 1 (Amazon):   node --env-file=.env.local scripts/import-inbounds.mjs fetch
//   Phase 2 (Supabase): node --env-file=.env.local scripts/import-inbounds.mjs load
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "node:fs";

const MODE = process.argv[2] || "all";
const CACHE = "/private/tmp/claude-501/-Users-simoelfkkak-Documents-Antigravity-FBA-Business-Manager/64d10618-3161-4a54-8ea5-b07f6b998016/scratchpad/fba-inbounds.json";
const SP_HOST = { na: "https://sellingpartnerapi-na.amazon.com", eu: "https://sellingpartnerapi-eu.amazon.com", fe: "https://sellingpartnerapi-fe.amazon.com" };
const STATUS_MAP = { WORKING: "Working", READY_TO_SHIP: "Working", SHIPPED: "Shipped", IN_TRANSIT: "In transit", DELIVERED: "In transit", CHECKED_IN: "Receiving", RECEIVING: "Receiving", CLOSED: "Closed", CANCELLED: "Problem", DELETED: "Problem", ERROR: "Problem", VOIDED: "Problem" };
const region = (process.env.AMAZON_SP_REGION || "na").toLowerCase();
const host = SP_HOST[region] || SP_HOST.na;
const IB = "/inbound/fba/2024-03-20";

async function token() {
  const r = await fetch("https://api.amazon.com/auth/o2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: process.env.AMAZON_SP_REFRESH_TOKEN, client_id: process.env.AMAZON_SP_CLIENT_ID, client_secret: process.env.AMAZON_SP_CLIENT_SECRET }) });
  const j = await r.json(); if (!j.access_token) throw new Error(j.error_description || "LWA failed"); return j.access_token;
}
async function getJson(url, t) { const r = await fetch(url, { headers: { "x-amz-access-token": t } }); const j = await r.json(); if (!r.ok) throw new Error(j?.errors?.[0]?.message || `HTTP ${r.status}`); return j; }

if (MODE === "fetch" || MODE === "all") {
  const t = await token();
  const plans = []; let next;
  do {
    const qs = new URLSearchParams({ pageSize: "30" }); if (next) qs.set("paginationToken", next);
    const j = await getJson(`${host}${IB}/inboundPlans?${qs}`, t);
    for (const p of j.inboundPlans ?? []) plans.push(p);
    next = j.pagination?.paginationToken;
  } while (next);

  const byId = new Map(); const seen = new Set();
  for (const plan of plans) {
    const shipmentIds = []; let pnext;
    do {
      const qs = new URLSearchParams({ pageSize: "20" }); if (pnext) qs.set("paginationToken", pnext);
      const j = await getJson(`${host}${IB}/inboundPlans/${plan.inboundPlanId}/placementOptions?${qs}`, t);
      for (const opt of j.placementOptions ?? []) if (opt.status === "ACCEPTED") for (const sid of opt.shipmentIds ?? []) shipmentIds.push(sid);
      pnext = j.pagination?.paginationToken;
    } while (pnext);

    for (const sid of shipmentIds) {
      if (seen.has(sid)) continue; seen.add(sid);
      const s = await getJson(`${host}${IB}/inboundPlans/${plan.inboundPlanId}/shipments/${sid}`, t);
      const items = []; let inext;
      do {
        const qs = new URLSearchParams({ pageSize: "100" }); if (inext) qs.set("paginationToken", inext);
        const j = await getJson(`${host}${IB}/inboundPlans/${plan.inboundPlanId}/shipments/${sid}/items?${qs}`, t);
        for (const i of j.items ?? []) items.push({ sku: i.msku, fnsku: i.fnsku ?? null, expected: i.quantity ?? 0, received: i.receivedQuantity?.amount ?? 0 });
        inext = j.pagination?.paginationToken;
      } while (inext);
      const id = s.shipmentConfirmationId || sid;
      byId.set(id, { id, fc: s.destination?.warehouseId ?? "—", status: STATUS_MAP[s.status] ?? "Problem", items, expected: items.reduce((n, i) => n + i.expected, 0), received: items.reduce((n, i) => n + i.received, 0), skuCount: new Set(items.map((i) => i.sku)).size });
    }
  }

  // legacy v0 history (older / pre-STA shipments) — keep the full ledger
  const V0 = "WORKING,SHIPPED,IN_TRANSIT,DELIVERED,CHECKED_IN,RECEIVING,CLOSED,CANCELLED,ERROR";
  const mkt = process.env.AMAZON_SP_MARKETPLACE_ID || "ATVPDKIKX0DER";
  const raw = []; let lnext;
  do {
    const qs = lnext ? new URLSearchParams({ QueryType: "NEXT_TOKEN", NextToken: lnext }) : new URLSearchParams({ MarketplaceId: mkt, QueryType: "SHIPMENT", ShipmentStatusList: V0 });
    const j = await getJson(`${host}/fba/inbound/v0/shipments?${qs}`, t);
    for (const s of j.payload?.ShipmentData ?? []) raw.push(s); lnext = j.pagination?.NextToken;
  } while (lnext);
  for (const s of raw) {
    if (byId.has(s.ShipmentId)) continue;
    const items = []; let it;
    do {
      const qs = new URLSearchParams({ MarketplaceId: mkt }); if (it) qs.set("NextToken", it);
      const j = await getJson(`${host}/fba/inbound/v0/shipments/${s.ShipmentId}/items?${qs}`, t);
      for (const i of j.payload?.ItemData ?? []) items.push({ sku: i.SellerSKU, fnsku: i.FulfillmentNetworkSKU ?? null, expected: i.QuantityShipped ?? 0, received: i.QuantityReceived ?? 0 });
      it = j.pagination?.NextToken;
    } while (it);
    byId.set(s.ShipmentId, { id: s.ShipmentId, fc: s.DestinationFulfillmentCenterId ?? "—", status: STATUS_MAP[s.ShipmentStatus] ?? "Problem", items, expected: items.reduce((n, i) => n + i.expected, 0), received: items.reduce((n, i) => n + i.received, 0), skuCount: new Set(items.map((i) => i.sku)).size });
  }

  const shipments = [...byId.values()];
  writeFileSync(CACHE, JSON.stringify(shipments));
  const dist = {}; for (const s of shipments) dist[s.status] = (dist[s.status] || 0) + 1;
  console.log(`Fetched ${shipments.length} shipments (${plans.length} STA plans + legacy v0) →`, JSON.stringify(dist));
  if (MODE === "fetch") process.exit(0);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const shipments = JSON.parse(readFileSync(CACHE, "utf8"));
for (const s of shipments) {
  await db.from("fba_inbounds").upsert({ id: s.id, fc: s.fc, sku_count: s.skuCount, expected: s.expected, received: s.received, amazon_status: s.status, synced: new Date().toISOString() }, { onConflict: "id" });
  await db.from("fba_inbound_items").delete().eq("inbound_id", s.id);
  if (s.items.length) await db.from("fba_inbound_items").insert(s.items.map((i) => ({ inbound_id: s.id, sku: i.sku, fnsku: i.fnsku, expected: i.expected, received: i.received })));
}
console.log(`✅ Loaded ${shipments.length} shipments (full ledger). View at /fba-shipments.`);
