// Pull sales velocity (units/day per ASIN) from the SP-API Sales & Traffic report
// and write it to product_variants.velocity — this powers days-of-cover + reorder.
//   Phase 1 (Amazon):   node --env-file=.env.local scripts/import-velocity.mjs fetch
//   Phase 2 (Supabase): node --env-file=.env.local scripts/import-velocity.mjs load
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const MODE = process.argv[2] || "all";
const CACHE = "/private/tmp/claude-501/-Users-simoelfkkak-Documents-Antigravity-FBA-Business-Manager/64d10618-3161-4a54-8ea5-b07f6b998016/scratchpad/velocity.json";
const SP_HOST = { na: "https://sellingpartnerapi-na.amazon.com", eu: "https://sellingpartnerapi-eu.amazon.com", fe: "https://sellingpartnerapi-fe.amazon.com" };
const region = (process.env.AMAZON_SP_REGION || "na").toLowerCase();
const marketplace = process.env.AMAZON_SP_MARKETPLACE_ID || "ATVPDKIKX0DER";
const host = SP_HOST[region] || SP_HOST.na;
const WINDOW_DAYS = 30;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function token() {
  const r = await fetch("https://api.amazon.com/auth/o2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: process.env.AMAZON_SP_REFRESH_TOKEN, client_id: process.env.AMAZON_SP_CLIENT_ID, client_secret: process.env.AMAZON_SP_CLIENT_SECRET }) });
  const j = await r.json(); if (!j.access_token) throw new Error(j.error_description || "LWA failed"); return j.access_token;
}

if (MODE === "fetch" || MODE === "all") {
  const t = await token();
  const H = { "x-amz-access-token": t, "Content-Type": "application/json" };
  const end = new Date();
  const start = new Date(end.getTime() - WINDOW_DAYS * 864e5);

  // 1) create the report — ALL_ORDERS (GENERAL = no PII) is covered by the Orders role
  const create = await fetch(`${host}/reports/2021-06-30/reports`, { method: "POST", headers: H, body: JSON.stringify({
    reportType: "GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL", marketplaceIds: [marketplace],
    dataStartTime: start.toISOString(), dataEndTime: end.toISOString(),
  }) });
  const cj = await create.json(); if (!create.ok) throw new Error(cj?.errors?.[0]?.message || `create HTTP ${create.status}`);
  const reportId = cj.reportId;
  console.log(`Report ${reportId} created — waiting…`);

  // 2) poll until done
  let docId, status;
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const g = await (await fetch(`${host}/reports/2021-06-30/reports/${reportId}`, { headers: H })).json();
    status = g.processingStatus; docId = g.reportDocumentId;
    if (status === "DONE") break;
    if (status === "FATAL" || status === "CANCELLED") throw new Error(`report ${status}`);
    if (i % 2 === 0) console.log(`  …${status}`);
  }
  if (!docId) throw new Error(`report not ready (status ${status})`);

  // 3) download + (gunzip) + parse the TSV → units per SKU
  const doc = await (await fetch(`${host}/reports/2021-06-30/documents/${docId}`, { headers: H })).json();
  const raw = Buffer.from(await (await fetch(doc.url)).arrayBuffer());
  const text = doc.compressionAlgorithm === "GZIP" ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = (lines.shift() ?? "").split("\t");
  console.log("  columns:", header.join(", "));
  const find = (...names) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const iSku = find("sku", "seller-sku");
  const iQty = find("quantity-purchased", "quantity", "quantity-shipped", "shipped-quantity");
  const iStatus = find("order-status", "item-status");
  const unitsBySku = {};
  for (const line of lines) {
    const c = line.split("\t");
    const status = (c[iStatus] || "").toLowerCase();
    if (status.includes("cancel")) continue;
    const sku = c[iSku]; const qty = parseInt(c[iQty]) || 0;
    if (!sku || !qty) continue;
    unitsBySku[sku] = (unitsBySku[sku] ?? 0) + qty;
  }
  const velocityBySku = {};
  for (const [sku, units] of Object.entries(unitsBySku)) velocityBySku[sku] = +(units / WINDOW_DAYS).toFixed(3);
  writeFileSync(CACHE, JSON.stringify({ velocityBySku, window: WINDOW_DAYS }));
  console.log(`Parsed ${Object.keys(velocityBySku).length} SKUs with sales (last ${WINDOW_DAYS}d) → cached.`);
  if (MODE === "fetch") process.exit(0);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { velocityBySku } = JSON.parse(readFileSync(CACHE, "utf8"));
let updated = 0;
for (const [sku, vel] of Object.entries(velocityBySku)) {
  const { data } = await db.from("product_variants").update({ velocity: vel }).eq("sku", sku).select("id");
  updated += data?.length ?? 0;
}
console.log(`✅ Wrote velocity to ${updated} variants. Days-of-cover & reorder are now live.`);
