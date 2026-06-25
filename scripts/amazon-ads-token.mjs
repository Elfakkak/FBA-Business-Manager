// Gets an Amazon Ads refresh token via the Login-with-Amazon consent flow.
//
// Step 1 — print the consent URL (fill AMAZON_ADS_CLIENT_ID in .env.local first):
//   node --env-file=.env.local scripts/amazon-ads-token.mjs url
//   -> open the URL, approve. Your browser lands on http://localhost:8080/?code=XXXX
//      (the page won't load — that's fine; copy the `code` value from the address bar).
//
// Step 2 — exchange that code for a refresh token (needs CLIENT_ID + CLIENT_SECRET):
//   node --env-file=.env.local scripts/amazon-ads-token.mjs <paste-the-code>
//   -> prints AMAZON_ADS_REFRESH_TOKEN=Atzr|...  — paste that line into .env.local.

const REDIRECT = process.env.AMAZON_ADS_REDIRECT_URI || "http://localhost:8080/";
const LOGIN_HOST = { na: "https://www.amazon.com", eu: "https://eu.account.amazon.com", fe: "https://apac.account.amazon.com" };
const region = (process.env.AMAZON_ADS_REGION || "na").toLowerCase();
const clientId = process.env.AMAZON_ADS_CLIENT_ID;
const clientSecret = process.env.AMAZON_ADS_CLIENT_SECRET;
const arg = process.argv[2];

if (!clientId) { console.error("❌ Set AMAZON_ADS_CLIENT_ID in .env.local first."); process.exit(1); }

if (!arg || arg === "url") {
  const qs = new URLSearchParams({
    client_id: clientId,
    scope: "advertising::campaign_management",
    response_type: "code",
    redirect_uri: REDIRECT,
  });
  console.log("\nOpen this URL in your browser, sign in and approve:\n");
  console.log(`${LOGIN_HOST[region] || LOGIN_HOST.na}/ap/oa?${qs}\n`);
  console.log(`After approving you'll land on ${REDIRECT}?code=XXXX (page won't load — copy the code).`);
  console.log("Then run:  node --env-file=.env.local scripts/amazon-ads-token.mjs <code>\n");
  process.exit(0);
}

// exchange the authorization code
if (!clientSecret) { console.error("❌ Set AMAZON_ADS_CLIENT_SECRET in .env.local first."); process.exit(1); }
const code = decodeURIComponent(arg.trim());
const res = await fetch("https://api.amazon.com/auth/o2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: clientId, client_secret: clientSecret }),
});
const j = await res.json().catch(() => ({}));
if (!res.ok || !j.refresh_token) {
  console.error(`❌ Exchange failed: ${j.error_description || j.error || res.status}`);
  process.exit(1);
}
console.log("\n✅ Success — paste this line into .env.local:\n");
console.log(`AMAZON_ADS_REFRESH_TOKEN=${j.refresh_token}\n`);
