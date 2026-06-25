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
        reserved: d.reservedQuantity?.totalReservedQuantity ?? 0,
      });
    }
    next = j.pagination?.nextToken;
  } while (next);
  return rows;
}

const famId = (r) => "amz-" + String(r.asin || r.sku).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Catalog Items API — real title, brand, image, and the VARIATION parent ASIN
// (so we can group SKUs into the same family Amazon uses).
async function fetchCatalogItem(token, asin) {
  const qs = new URLSearchParams({ marketplaceIds: marketplace, includedData: "summaries,images,relationships" });
  const res = await fetch(`${SP_HOST[region] || SP_HOST.na}/catalog/2022-04-01/items/${asin}?${qs}`, { headers: { "x-amz-access-token": token } });
  if (!res.ok) return null;
  const j = await res.json();
  const sum = (j.summaries ?? []).find((s) => s.marketplaceId === marketplace) ?? j.summaries?.[0];
  const imgGroup = (j.images ?? []).find((i) => i.marketplaceId === marketplace) ?? j.images?.[0];
  const relGroup = (j.relationships ?? []).find((r) => r.marketplaceId === marketplace) ?? j.relationships?.[0];
  const variation = (relGroup?.relationships ?? []).find((r) => r.type === "VARIATION");
  const parentAsin = variation?.parentAsins?.[0] ?? null; // present only on child items
  return { title: sum?.itemName ?? null, brand: sum?.brand ?? null, image: imgGroup?.images?.[0]?.link ?? null, parentAsin };
}

// ── Phase 1: fetch inventory + catalog details from Amazon, cache to disk ──
if (MODE === "fetch" || MODE === "all") {
  const token = await lwaToken();
  const inv = (await fetchInventory(token)).filter((r) => r.sku);
  const asins = [...new Set(inv.map((r) => r.asin).filter(Boolean))];
  const catalog = {};
  let i = 0;
  for (const asin of asins) {
    try { catalog[asin] = await fetchCatalogItem(token, asin); } catch { catalog[asin] = null; }
    if (++i % 10 === 0) console.log(`  …catalog ${i}/${asins.length}`);
    await sleep(600); // respect getCatalogItem rate limit (~2/s)
  }
  // also fetch the parent ASINs (family heads) we discovered, for their title/image
  const parents = [...new Set(Object.values(catalog).map((c) => c?.parentAsin).filter((p) => p && !catalog[p]))];
  for (const p of parents) {
    try { catalog[p] = await fetchCatalogItem(token, p); } catch { catalog[p] = null; }
    await sleep(600);
  }
  writeFileSync(CACHE, JSON.stringify({ rows: inv, catalog }));
  console.log(`Fetched ${inv.length} SKUs + ${asins.length} catalog titles + ${parents.length} variation parents → cached.`);
  if (MODE === "fetch") process.exit(0);
}

// ── Phase 2: load cache into Supabase ──
if (!url || !key) { console.error("Missing Supabase env."); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });
const cached = JSON.parse(readFileSync(CACHE, "utf8"));
const inv = cached.rows ?? cached; // tolerate old cache shape
const catalog = cached.catalog ?? {};
console.log(`Loading ${inv.length} SKUs into Supabase…`);
// Resolve each SKU to its Amazon variation FAMILY (parent ASIN when present).
const familyAsin = (r) => catalog[r.asin]?.parentAsin || r.asin || r.sku;
const famKey = (r) => "amz-" + String(familyAsin(r)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const titleFor = (r) => catalog[familyAsin(r)]?.title || catalog[r.asin]?.title || r.asin || r.sku;

// 1) one product family per variation parent — set real title/image (only amz- families)
const famParent = new Map();
for (const r of inv) {
  const fa = familyAsin(r);
  const id = famKey(r);
  if (!famParent.has(id)) famParent.set(id, { title: catalog[fa]?.title || titleFor(r), image: catalog[fa]?.image ?? catalog[r.asin]?.image ?? null });
}
for (const [id, meta] of famParent) {
  await db.from("products").upsert({ id, parent: meta.title, category: "Imported (Amazon)", images: meta.image ? [meta.image] : [] }, { onConflict: "id" });
}

// 2) upsert variants by SKU; re-parent imported variants to the real Amazon family
const childTitle = (r) => catalog[r.asin]?.title || r.sku;
const { data: existing } = await db.from("product_variants").select("sku, family_id");
const bySku = new Map((existing ?? []).map((v) => [v.sku, v]));
let created = 0, updated = 0;
for (const r of inv) {
  const patch = { fba_stock: r.total, inbound: r.inbound, unfulfillable: r.unfulfillable, reserved: r.reserved ?? 0, fnsku: r.fnsku, asin: r.asin, status: r.fnsku ? "Ready" : "Not linked" };
  const cur = bySku.get(r.sku);
  if (cur) {
    // re-parent + rename ONLY imported families' variants — never touch a seeded product
    if (String(cur.family_id).startsWith("amz-")) { patch.family_id = famKey(r); patch.name = childTitle(r); }
    await db.from("product_variants").update(patch).eq("sku", r.sku); updated++;
  } else {
    const { error } = await db.from("product_variants").insert({ family_id: famKey(r), sku: r.sku, name: childTitle(r), ...patch });
    if (error) { console.error(`  insert ${r.sku}: ${error.message}`); continue; }
    created++;
  }
}

// 3) clean up now-empty imported families (left behind by re-parenting)
const { data: allFams } = await db.from("products").select("id").like("id", "amz-%");
const { data: used } = await db.from("product_variants").select("family_id");
const usedSet = new Set((used ?? []).map((v) => v.family_id));
const orphans = (allFams ?? []).map((f) => f.id).filter((id) => !usedSet.has(id));
if (orphans.length) await db.from("products").delete().in("id", orphans);

console.log(`\n✅ Import done — ${created} new, ${updated} updated, ${famParent.size} Amazon families, ${orphans.length} empty families removed.`);
