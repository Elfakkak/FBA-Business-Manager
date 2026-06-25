// One-time import: pull live FBA inventory and create/update catalog variants from
// the real seller SKUs (grouped into product families by ASIN).
//   Phase 1 (reaches Amazon):   node --env-file=.env.local scripts/import-amazon.mjs fetch
//   Phase 2 (reaches Supabase): node --env-file=.env.local scripts/import-amazon.mjs load
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "node:fs";

const MODE = process.argv[2] || "all";
const CACHE = "/private/tmp/claude-501/-Users-simoelfkkak-Documents-Antigravity-FBA-Business-Manager/64d10618-3161-4a54-8ea5-b07f6b998016/scratchpad/fba-inventory.json";

const SP_HOST = { na: "https://sellingpartnerapi-na.amazon.com", eu: "https://sellingpartnerapi-eu.amazon.com", fe: "https://sellingpartnerapi-fe.amazon.com" };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const region = (process.env.AMAZON_SP_REGION || "na").toLowerCase();
const marketplace = process.env.AMAZON_SP_MARKETPLACE_ID || "ATVPDKIKX0DER";

async function lwaToken() {
  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: process.env.AMAZON_SP_REFRESH_TOKEN, client_id: process.env.AMAZON_SP_CLIENT_ID, client_secret: process.env.AMAZON_SP_CLIENT_SECRET }),
  });
  const j = await res.json(); if (!j.access_token) throw new Error(j.error_description || "LWA failed");
  return j.access_token;
}

async function fetchInventory(token) {
  const rows = []; let next;
  do {
    const qs = new URLSearchParams({ details: "true", granularityType: "Marketplace", granularityId: marketplace, marketplaceIds: marketplace });
    if (next) qs.set("nextToken", next);
    const res = await fetch(`${SP_HOST[region] || SP_HOST.na}/fba/inventory/v1/summaries?${qs}`, { headers: { "x-amz-access-token": token } });
    const j = await res.json(); if (!res.ok) throw new Error(j.errors?.[0]?.message || `HTTP ${res.status}`);
    for (const s of j.payload?.inventorySummaries ?? []) {
      const d = s.inventoryDetails ?? {};
      rows.push({
        sku: s.sellerSku, fnsku: s.fnSku ?? null, asin: s.asin ?? null,
        total: s.totalQuantity ?? 0,
        inbound: (d.inboundWorkingQuantity ?? 0) + (d.inboundShippedQuantity ?? 0) + (d.inboundReceivingQuantity ?? 0),
        unfulfillable: d.unfulfillableQuantity?.totalUnfulfillableQuantity ?? 0,
      });
    }
    next = j.pagination?.nextToken;
  } while (next);
  return rows;
}

const famId = (r) => "amz-" + String(r.asin || r.sku).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ── Phase 1: fetch from Amazon, cache to disk ──
if (MODE === "fetch" || MODE === "all") {
  const token = await lwaToken();
  const inv = (await fetchInventory(token)).filter((r) => r.sku);
  writeFileSync(CACHE, JSON.stringify(inv));
  console.log(`Fetched ${inv.length} live SKUs from Amazon → cached.`);
  if (MODE === "fetch") process.exit(0);
}

// ── Phase 2: load cache into Supabase ──
if (!url || !key) { console.error("Missing Supabase env."); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });
const inv = JSON.parse(readFileSync(CACHE, "utf8"));
console.log(`Loading ${inv.length} SKUs into Supabase…`);

// 1) ensure a product family per ASIN/SKU (don't clobber existing products)
const families = new Map();
for (const r of inv) families.set(famId(r), r.asin || r.sku);
for (const [id, parent] of families) {
  await db.from("products").upsert({ id, parent, category: "Imported (Amazon)" }, { onConflict: "id", ignoreDuplicates: true });
}

// 2) upsert variants by SKU
const { data: existing } = await db.from("product_variants").select("sku");
const seen = new Set((existing ?? []).map((v) => v.sku));
let created = 0, updated = 0;
for (const r of inv) {
  const patch = { fba_stock: r.total, inbound: r.inbound, unfulfillable: r.unfulfillable, fnsku: r.fnsku, asin: r.asin, status: r.fnsku ? "Ready" : "Not linked" };
  if (seen.has(r.sku)) {
    await db.from("product_variants").update(patch).eq("sku", r.sku); updated++;
  } else {
    const { error } = await db.from("product_variants").insert({ family_id: famId(r), sku: r.sku, name: r.sku, ...patch });
    if (error) { console.error(`  insert ${r.sku}: ${error.message}`); continue; }
    created++;
  }
}
console.log(`\n✅ Import done — ${created} new variants created, ${updated} existing updated, ${families.size} families. View at /inventory and /catalog.`);
