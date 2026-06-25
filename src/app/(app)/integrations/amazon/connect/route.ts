import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildConsentUrl } from "@/lib/amazon/oauth";

// Step 2 of "Connect with Amazon": read the saved App ID, send the seller to the
// Seller Central consent page. A signed state cookie guards the round-trip.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const supabase = await createClient();
  const { data } = await supabase.from("integrations").select("oauth_token").eq("id", "amazon").maybeSingle();
  const creds = (data?.oauth_token ?? {}) as { app_id?: string; region?: string };

  if (!creds.app_id) {
    return NextResponse.redirect(`${origin}/integrations/amazon?error=${encodeURIComponent("Enter your SP-API App ID first.")}`);
  }

  const redirectUri = `${origin}/integrations/amazon/callback`;
  const state = crypto.randomUUID();
  const url = buildConsentUrl({ appId: creds.app_id, region: creds.region, redirectUri, state });

  const res = NextResponse.redirect(url);
  res.cookies.set("amz_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
