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

  // Split cadence (cron ticks at 00/06/12/18 UTC). Cheap direct-API streams run
  // every tick; throttled Reports-API streams are daily aggregates so they run less:
  //   inventory + inbound → every tick (4x/day)
  //   sales               → once/day (00:00 tick)
  //   ads                 → twice/day (00:00 + 12:00 ticks)
  // A manual owner sync always runs the full set.
  const hour = new Date().getUTCHours();
  const runSales = !cronOk || hour < 6;
  const runAds = !cronOk || hour < 6 || (hour >= 12 && hour < 18);
  await run("inventory", () => runInventorySync(db, sp));
  await run("inbound", () => runInboundSync(db, sp));
  if (runSales) await run("sales", () => runSalesSync(db, sp));
  if (runAds) await run("ads", () => runAdsSync(db, adsCreds));

  const errs = Object.entries(results).filter(([, v]) => (v as { error?: string })?.error).map(([k]) => k);
  await db.from("integrations").update({
    status: errs.length ? "error" : "connected",
    last_sync: new Date().toISOString(),
    note: errs.length ? `Last sync had issues: ${errs.join(", ")}.` : `Sync complete — ${Object.keys(results).join(", ")}.`,
  }).eq("id", "amazon");

  return NextResponse.json({ ok: errs.length === 0, ranBy: cronOk ? "cron" : "owner", results });
}

export const GET = handler;
export const POST = handler;
