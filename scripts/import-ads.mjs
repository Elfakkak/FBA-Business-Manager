// Pull Amazon Ads spend + ad-attributed sales per SKU (Sponsored Products advertised
// product report, last 30d) → product_variants.ad_spend_30d / ad_sales_30d / ad_units_30d.
//   Phase 1 (Amazon):   node --env-file=.env.local scripts/import-ads.mjs fetch
//   Phase 2 (Supabase): node --env-file=.env.local scripts/import-ads.mjs load
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const MODE = process.argv[2] || "all";
const CACHE = "/private/tmp/claude-501/-Users-simoelfkkak-Documents-Antigravity-FBA-Business-Manager/64d10618-3161-4a54-8ea5-b07f6b998016/scratchpad/ads.json";
const ADS_HOST = { na: "https://advertising-api.amazon.com", eu: "https://advertising-api-eu.amazon.com", fe: "https://advertising-api-fp.amazon.com" };
const region = (process.env.AMAZON_ADS_REGION || "na").toLowerCase();
const host = ADS_HOST[region] || ADS_HOST.na;
const clientId = process.env.AMAZON_ADS_CLIENT_ID;
const profileId = process.env.AMAZON_ADS_PROFILE_ID || "2713745068193310"; // Vegalux US
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ymd = (d) => d.toISOString().slice(0, 10);

async function token() {
  const r = await fetch("https://api.amazon.com/auth/o2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: process.env.AMAZON_ADS_REFRESH_TOKEN, client_id: clientId, client_secret: process.env.AMAZON_ADS_CLIENT_SECRET }) });
  const j = await r.json(); if (!j.access_token) throw new Error(j.error_description || "LWA failed"); return j.access_token;
}

if (MODE === "fetch" || MODE === "all") {
  const t = await token();
  const H = { Authorization: `Bearer ${t}`, "Amazon-Advertising-API-ClientId": clientId, "Amazon-Advertising-API-Scope": profileId };
  const end = new Date(); const start = new Date(end.getTime() - 30 * 864e5);

  const create = await fetch(`${host}/reporting/reports`, {
    method: "POST", headers: { ...H, "Content-Type": "application/vnd.createasyncreportrequest.v3+json" },
    body: JSON.stringify({
      name: "vyonix-sp-adv-product", startDate: ymd(start), endDate: ymd(end),
      configuration: {
        adProduct: "SPONSORED_PRODUCTS", reportTypeId: "spAdvertisedProduct", groupBy: ["advertiser"],
        columns: ["advertisedSku", "advertisedAsin", "spend", "sales30d", "unitsSoldClicks30d", "purchases30d", "clicks", "impressions"],
        timeUnit: "SUMMARY", format: "GZIP_JSON",
      },
    }),
  });
  const cj = await create.json();
  if (!create.ok) throw new Error(cj?.detail || cj?.message || `create HTTP ${create.status}`);
  const reportId = cj.reportId;
  console.log(`Ads report ${reportId} created — waiting…`);

  let url, status;
  for (let i = 0; i < 40; i++) {
    await sleep(5000);
    const g = await (await fetch(`${host}/reporting/reports/${reportId}`, { headers: H })).json();
    status = g.status; url = g.url;
    if (status === "COMPLETED") break;
    if (status === "FAILURE") throw new Error(`report FAILURE: ${g.failureReason ?? ""}`);
    if (i % 2 === 0) console.log(`  …${status}`);
  }
  if (!url) throw new Error(`report not ready (status ${status})`);

  const raw = Buffer.from(await (await fetch(url)).arrayBuffer());
  const rows = JSON.parse(gunzipSync(raw).toString("utf8"));
  const bySku = {};
  for (const r of rows) {
    const sku = r.advertisedSku; if (!sku) continue;
    const e = bySku[sku] ?? { spend: 0, sales: 0, units: 0 };
    e.spend += r.spend ?? 0; e.sales += r.sales30d ?? 0; e.units += r.unitsSoldClicks30d ?? 0;
    bySku[sku] = e;
  }
  writeFileSync(CACHE, JSON.stringify({ bySku }));
  console.log(`Parsed ads for ${Object.keys(bySku).length} advertised SKUs → cached.`);
  if (MODE === "fetch") process.exit(0);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { bySku } = JSON.parse(readFileSync(CACHE, "utf8"));
let updated = 0;
for (const [sku, e] of Object.entries(bySku)) {
  const { data } = await db.from("product_variants").update({ ad_spend_30d: +e.spend.toFixed(2), ad_sales_30d: +e.sales.toFixed(2), ad_units_30d: e.units }).eq("sku", sku).select("id");
  updated += data?.length ?? 0;
}
console.log(`✅ Wrote ad metrics to ${updated} variants. ACoS / TACoS / ad-adjusted net now live.`);
