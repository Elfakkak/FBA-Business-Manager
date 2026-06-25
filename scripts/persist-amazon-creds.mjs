// Writes the verified Amazon credentials from .env.local onto the integration rows
// so the deployed app can sync (syncAmazonInventory reads DB creds first). Owner-only
// RLS protects the oauth_token column. Run:
//   node --env-file=.env.local scripts/persist-amazon-creds.mjs
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const rows = [
  { id: "amazon", token: {
      client_id: process.env.AMAZON_SP_CLIENT_ID, client_secret: process.env.AMAZON_SP_CLIENT_SECRET,
      refresh_token: process.env.AMAZON_SP_REFRESH_TOKEN, marketplace_id: process.env.AMAZON_SP_MARKETPLACE_ID, region: process.env.AMAZON_SP_REGION,
    }, note: "Connected — credentials verified against SP-API." },
  { id: "amazonads", token: {
      client_id: process.env.AMAZON_ADS_CLIENT_ID, client_secret: process.env.AMAZON_ADS_CLIENT_SECRET,
      refresh_token: process.env.AMAZON_ADS_REFRESH_TOKEN, region: process.env.AMAZON_ADS_REGION, profile_id: "2713745068193310",
    }, note: "Connected — Ads API verified (Vegalux US profile)." },
];

for (const r of rows) {
  if (!r.token.refresh_token) { console.log(`· ${r.id}: no refresh token in env — skipped.`); continue; }
  const { error } = await db.from("integrations").update({ status: "connected", oauth_token: r.token, note: r.note, last_sync: new Date().toISOString() }).eq("id", r.id);
  console.log(error ? `❌ ${r.id}: ${error.message}` : `✅ ${r.id}: credentials persisted, marked connected.`);
}
