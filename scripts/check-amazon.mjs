// Confirms the Amazon credentials in .env.local actually work by calling the real
// APIs. Run: node --env-file=.env.local scripts/check-amazon.mjs
// Prints PASS/FAIL per check. Never prints the secret values themselves.

const SP_HOST = { na: "https://sellingpartnerapi-na.amazon.com", eu: "https://sellingpartnerapi-eu.amazon.com", fe: "https://sellingpartnerapi-fe.amazon.com" };
const ADS_HOST = { na: "https://advertising-api.amazon.com", eu: "https://advertising-api-eu.amazon.com", fe: "https://advertising-api-fp.amazon.com" };

const ok = (m) => console.log(`  \x1b[32m✅ ${m}\x1b[0m`);
const bad = (m) => console.log(`  \x1b[31m❌ ${m}\x1b[0m`);
const info = (m) => console.log(`  ${m}`);

async function lwaToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(j.error_description || j.error || `LWA HTTP ${res.status}`);
  return j.access_token;
}

async function checkSpApi() {
  console.log("\n=== SP-API (FBA inventory) ===");
  const clientId = process.env.AMAZON_SP_CLIENT_ID, clientSecret = process.env.AMAZON_SP_CLIENT_SECRET, refreshToken = process.env.AMAZON_SP_REFRESH_TOKEN;
  const region = (process.env.AMAZON_SP_REGION || "na").toLowerCase();
  const marketplace = process.env.AMAZON_SP_MARKETPLACE_ID || "ATVPDKIKX0DER";
  if (!clientId || !clientSecret || !refreshToken) { bad("Missing AMAZON_SP_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN — skipping."); return false; }
  try {
    const token = await lwaToken({ clientId, clientSecret, refreshToken });
    ok("LWA token exchange");
    const qs = new URLSearchParams({ details: "true", granularityType: "Marketplace", granularityId: marketplace, marketplaceIds: marketplace });
    const res = await fetch(`${SP_HOST[region] || SP_HOST.na}/fba/inventory/v1/summaries?${qs}`, { headers: { "x-amz-access-token": token } });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { bad(`FBA Inventory call failed: ${j.errors?.[0]?.message || res.status}`); return false; }
    const n = j.payload?.inventorySummaries?.length ?? 0;
    ok(`FBA Inventory call OK — ${n} SKU summaries returned (marketplace ${marketplace}, region ${region})`);
    return true;
  } catch (e) { bad(`SP-API failed: ${e.message}`); return false; }
}

async function checkAds() {
  console.log("\n=== Amazon Ads API ===");
  const clientId = process.env.AMAZON_ADS_CLIENT_ID, clientSecret = process.env.AMAZON_ADS_CLIENT_SECRET, refreshToken = process.env.AMAZON_ADS_REFRESH_TOKEN;
  const region = (process.env.AMAZON_ADS_REGION || "na").toLowerCase();
  if (!clientId || !clientSecret || !refreshToken) { bad("Missing AMAZON_ADS_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN — skipping."); return false; }
  try {
    const token = await lwaToken({ clientId, clientSecret, refreshToken });
    ok("LWA token exchange");
    const res = await fetch(`${ADS_HOST[region] || ADS_HOST.na}/v2/profiles`, {
      headers: { Authorization: `Bearer ${token}`, "Amazon-Advertising-API-ClientId": clientId },
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { bad(`Profiles call failed: ${j.message || res.status}`); return false; }
    ok(`Profiles call OK — ${Array.isArray(j) ? j.length : 0} ad profile(s) found`);
    if (Array.isArray(j)) j.forEach((p) => info(`· profileId ${p.profileId} · ${p.countryCode} · ${p.accountInfo?.name ?? ""}`));
    return true;
  } catch (e) { bad(`Ads API failed: ${e.message}`); return false; }
}

console.log("Amazon connection check — calling the live APIs with your .env.local credentials");
const sp = await checkSpApi();
const ads = await checkAds();
console.log(`\n=== RESULT === SP-API: ${sp ? "✅ CONNECTED" : "❌ not connected"} · Ads: ${ads ? "✅ CONNECTED" : "❌ not connected"}\n`);
