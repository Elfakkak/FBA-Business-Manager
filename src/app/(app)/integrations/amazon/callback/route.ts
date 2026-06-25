import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeAuthCode } from "@/lib/amazon/oauth";
import { syncAmazonInventory } from "../../actions";

// Step 3: Amazon redirects here with `spapi_oauth_code`. We verify state, exchange
// the code for a refresh token, store it, then immediately pull live FBA inventory.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const sp = req.nextUrl.searchParams;
  const code = sp.get("spapi_oauth_code");
  const state = sp.get("state");
  const sellingPartnerId = sp.get("selling_partner_id");

  const back = (msg?: string) =>
    NextResponse.redirect(`${origin}/integrations/amazon${msg ? `?error=${encodeURIComponent(msg)}` : "?connected=1"}`);

  const jar = await cookies();
  const expected = jar.get("amz_oauth_state")?.value;
  if (!code || !state || !expected || state !== expected) return back("Authorization failed or expired — please try again.");

  const supabase = await createClient();
  const { data } = await supabase.from("integrations").select("oauth_token").eq("id", "amazon").maybeSingle();
  const creds = (data?.oauth_token ?? {}) as { client_id?: string; client_secret?: string } & Record<string, string>;
  if (!creds.client_id || !creds.client_secret) return back("Missing Client ID/Secret — re-run setup.");

  try {
    const redirectUri = `${origin}/integrations/amazon/callback`;
    const { refresh_token } = await exchangeAuthCode({ code, clientId: creds.client_id, clientSecret: creds.client_secret, redirectUri });
    await supabase.from("integrations")
      .update({ oauth_token: { ...creds, refresh_token, selling_partner_id: sellingPartnerId ?? undefined }, status: "connected" })
      .eq("id", "amazon");
    await syncAmazonInventory(); // pull live inventory right away
  } catch (e) {
    return back(e instanceof Error ? e.message : "Token exchange failed.");
  }

  const res = back();
  res.cookies.delete("amz_oauth_state");
  return res;
}
