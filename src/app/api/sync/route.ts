import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { spCredsFromEnv, type AmazonCreds } from "@/lib/amazon/sp-api";
import { runInventorySync, runInboundSync, runSalesSync, runAdsSync, type AdsCreds } from "@/lib/amazon/run-syncs";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // full pull incl. two async reports

// Pulls EVERYTHING from Amazon (inventory, inbound, sales/velocity/price, ad spend).
// Auth: the Vercel cron (CRON_SECRET bearer) OR a signed-in owner (manual button).
// Fast streams run first so even a timeout leaves stock data fresh.
async function handler(req: NextRequest) {
  const cronOk = !!process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const { data: amz } = await db.from("integrations").select("oauth_token").eq("id", "amazon").maybeSingle();
  const { data: ads } = await db.from("integrations").select("oauth_token").eq("id", "amazonads").maybeSingle();
  const sp: AmazonCreds = { ...spCredsFromEnv(), ...((amz?.oauth_token ?? {}) as AmazonCreds) };
  const adsCreds = (ads?.oauth_token ?? {}) as AdsCreds;

  const results: Record<string, unknown> = {};
  const run = async (k: string, fn: () => Promise<unknown>) => {
    try { results[k] = await fn(); } catch (e) { results[k] = { error: e instanceof Error ? e.message : "failed" }; }
  };

  await run("inventory", () => runInventorySync(db, sp));
  await run("inbound", () => runInboundSync(db, sp));
  await run("sales", () => runSalesSync(db, sp));
  await run("ads", () => runAdsSync(db, adsCreds));

  const errs = Object.entries(results).filter(([, v]) => (v as { error?: string })?.error).map(([k]) => k);
  await db.from("integrations").update({
    status: errs.length ? "error" : "connected",
    last_sync: new Date().toISOString(),
    note: errs.length ? `Last sync had issues: ${errs.join(", ")}.` : "Full sync complete — inventory, inbound, sales, ads.",
  }).eq("id", "amazon");

  return NextResponse.json({ ok: errs.length === 0, ranBy: cronOk ? "cron" : "owner", results });
}

export const GET = handler;
export const POST = handler;
