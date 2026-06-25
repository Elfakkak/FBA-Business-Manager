// Verify + populate FBA inbound shipments.
//   Phase 1 (Amazon):   node --env-file=.env.local scripts/import-inbounds.mjs fetch
//   Phase 2 (Supabase): node --env-file=.env.local scripts/import-inbounds.mjs load
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "node:fs";

const MODE = process.argv[2] || "all";
const CACHE = "/private/tmp/claude-501/-Users-simoelfkkak-Documents-Antigravity-FBA-Business-Manager/64d10618-3161-4a54-8ea5-b07f6b998016/scratchpad/fba-inbounds.json";
const SP_HOST = { na: "https://sellingpartnerapi-na.amazon.com", eu: "https://sellingpartnerapi-eu.amazon.com", fe: "https://sellingpartnerapi-fe.amazon.com" };
const STATUS_MAP = { WORKING: "Working", SHIPPED: "Shipped", IN_TRANSIT: "In transit", DELIVERED: "In transit", CHECKED_IN: "Receiving", RECEIVING: "Receiving", CLOSED: "Closed", CANCELLED: "Problem", DELETED: "Problem", ERROR: "Problem" };
const region = (process.env.AMAZON_SP_REGION || "na").toLowerCase();
const marketplace = process.env.AMAZON_SP_MARKETPLACE_ID || "ATVPDKIKX0DER";
const host = SP_HOST[region] || SP_HOST.na;

async function token() {
  const r = await fetch("https://api.amazon.com/auth/o2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: process.env.AMAZON_SP_REFRESH_TOKEN, client_id: process.env.AMAZON_SP_CLIENT_ID, client_secret: process.env.AMAZON_SP_CLIENT_SECRET }) });
  const j = await r.json(); if (!j.access_token) throw new Error(j.error_description || "LWA failed"); return j.access_token;
}
async function getJson(url, t) { const r = await fetch(url, { headers: { "x-amz-access-token": t } }); const j = await r.json(); if (!r.ok) throw new Error(j?.errors?.[0]?.message || `HTTP ${r.status}`); return j; }

if (MODE === "fetch" || MODE === "all") {
  const t = await token();
  const raw = []; let next;
  do {
    const qs = next ? new URLSearchParams({ QueryType: "NEXT_TOKEN", NextToken: next }) : new URLSearchParams({ MarketplaceId: marketplace, QueryType: "SHIPMENT", ShipmentStatusList: "WORKING,SHIPPED,IN_TRANSIT,DELIVERED,CHECKED_IN,RECEIVING,CLOSED" });
    const j = await getJson(`${host}/fba/inbound/v0/shipments?${qs}`, t);
    for (const s of j.payload?.ShipmentData ?? []) raw.push(s);
    next = j.pagination?.NextToken;
  } while (next);
  const shipments = [];
  for (const s of raw) {
    const items = []; let it;
    do {
      const qs = new URLSearchParams({ MarketplaceId: marketplace }); if (it) qs.set("NextToken", it);
      const j = await getJson(`${host}/fba/inbound/v0/shipments/${s.ShipmentId}/items?${qs}`, t);
      for (const i of j.payload?.ItemData ?? []) items.push({ sku: i.SellerSKU, fnsku: i.FulfillmentNetworkSKU ?? null, expected: i.QuantityShipped ?? 0, received: i.QuantityReceived ?? 0 });
      it = j.pagination?.NextToken;
    } while (it);
    shipments.push({ id: s.ShipmentId, fc: s.DestinationFulfillmentCenterId ?? "—", status: STATUS_MAP[s.ShipmentStatus] ?? "Problem", items, expected: items.reduce((n, i) => n + i.expected, 0), received: items.reduce((n, i) => n + i.received, 0), skuCount: new Set(items.map((i) => i.sku)).size });
  }
  writeFileSync(CACHE, JSON.stringify(shipments));
  console.log(`Fetched ${shipments.length} inbound shipments (${shipments.reduce((n, s) => n + s.items.length, 0)} item rows) → cached.`);
  if (MODE === "fetch") process.exit(0);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const shipments = JSON.parse(readFileSync(CACHE, "utf8"));
for (const s of shipments) {
  await db.from("fba_inbounds").upsert({ id: s.id, fc: s.fc, sku_count: s.skuCount, expected: s.expected, received: s.received, amazon_status: s.status, synced: new Date().toISOString() }, { onConflict: "id" });
  await db.from("fba_inbound_items").delete().eq("inbound_id", s.id);
  if (s.items.length) await db.from("fba_inbound_items").insert(s.items.map((i) => ({ inbound_id: s.id, sku: i.sku, fnsku: i.fnsku, expected: i.expected, received: i.received })));
}
console.log(`✅ Loaded ${shipments.length} inbound shipments into Supabase. View at /fba-shipments.`);
