"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { INTG_DEFS } from "@/lib/integrations";
import { fetchFbaInventory, spCredsFromEnv, type AmazonCreds } from "@/lib/amazon/sp-api";
import { fetchFbaInbounds } from "@/lib/amazon/fba-inbound";

type Result = { ok: true } | { ok: false; error: string };

// Every surface that reflects integration state: the Settings hub, the standalone
// hub, the detail page, and Inventory (its sync strip reads Amazon's status).
function revalidateIntegration(id: string) {
  revalidatePath("/settings");
  revalidatePath("/integrations");
  revalidatePath(`/integrations/${id}`);
  revalidatePath("/inventory");
}

// Saves credentials (owner-only via RLS) and marks the integration connected.
// NOTE: this stores the seam; live data sync is wired per-provider afterwards.
export async function connectIntegration(id: string, form: FormData): Promise<Result> {
  const def = INTG_DEFS.find((d) => d.id === id);
  if (!def) return { ok: false, error: "Unknown integration." };

  const token: Record<string, string> = {};
  for (const f of def.creds) {
    const v = String(form.get(f.name) ?? "").trim();
    if (!v) return { ok: false, error: `${f.label} is required.` };
    token[f.name] = v;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("integrations").update({
    status: "connected",
    oauth_token: token,
    note: "Credentials saved — live sync activates once the provider fetch is wired.",
    last_sync: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  // Amazon's fetch is wired — pull live inventory right away so the note reflects reality
  if (id === "amazon") return syncAmazonInventory();
  revalidateIntegration(id);
  return { ok: true };
}

// Saves the SP-API app details (App ID + LWA Client ID/Secret + marketplace/region)
// so the "Connect with Amazon" OAuth flow can use them. The refresh token is filled
// in by the OAuth callback, not here.
export async function saveAmazonSetup(form: FormData): Promise<Result> {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const app_id = get("app_id"), client_id = get("client_id"), client_secret = get("client_secret");
  if (!app_id || !client_id || !client_secret) return { ok: false, error: "App ID, Client ID and Client Secret are required." };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("integrations").select("oauth_token").eq("id", "amazon").maybeSingle();
  const prev = (cur?.oauth_token ?? {}) as Record<string, string>;
  const token = {
    ...prev, app_id, client_id, client_secret,
    marketplace_id: get("marketplace_id") || "ATVPDKIKX0DER",
    region: get("region") || "na",
  };
  const { error } = await supabase.from("integrations")
    .update({ oauth_token: token, note: "Setup saved — authorizing with Amazon…" }).eq("id", "amazon");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function syncIntegration(id: string): Promise<Result> {
  if (id === "amazon") return syncAmazonInventory();
  const supabase = await createClient();
  const { error } = await supabase.from("integrations").update({ last_sync: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateIntegration(id);
  return { ok: true };
}

// Pulls live FBA inventory from SP-API and writes on-hand / inbound / unfulfillable
// onto matching variants (by seller SKU). Sets status + a clear note either way.
// Resolve Amazon creds: stored on the integration row wins, env is the fallback.
async function resolveAmazonCreds(supabase: Awaited<ReturnType<typeof createClient>>): Promise<AmazonCreds> {
  const { data: row } = await supabase.from("integrations").select("oauth_token").eq("id", "amazon").maybeSingle();
  const stored = (row?.oauth_token ?? {}) as AmazonCreds;
  const env = spCredsFromEnv();
  return {
    client_id: stored.client_id || env.client_id,
    client_secret: stored.client_secret || env.client_secret,
    refresh_token: stored.refresh_token || env.refresh_token,
    marketplace_id: stored.marketplace_id || env.marketplace_id,
    region: stored.region || env.region,
  };
}

export async function syncAmazonInventory(): Promise<Result> {
  const supabase = await createClient();
  const creds = await resolveAmazonCreds(supabase);

  try {
    const inventory = await fetchFbaInventory(creds);
    let matched = 0;
    for (const r of inventory) {
      if (!r.sellerSku) continue;
      const { data: upd } = await supabase
        .from("product_variants")
        .update({ fba_stock: r.total, inbound: r.inbound, unfulfillable: r.unfulfillable, reserved: r.reserved })
        .eq("sku", r.sellerSku)
        .select("id");
      if (upd?.length) matched += upd.length;
    }
    const note = `Synced ${inventory.length} FBA SKUs from Amazon · ${matched} matched in catalog.`;
    await supabase.from("integrations").update({ status: "connected", last_sync: new Date().toISOString(), note }).eq("id", "amazon");
    await syncFbaInbounds().catch(() => {}); // also refresh inbound shipments; don't fail inventory if this errors
    revalidateIntegration("amazon");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Amazon sync failed.";
    await supabase.from("integrations").update({ status: "error", note: msg }).eq("id", "amazon");
    revalidateIntegration("amazon");
    return { ok: false, error: msg };
  }
}

// Pulls inbound FBA shipments + their items into fba_inbounds / fba_inbound_items.
// Amazon owns received/status/fc/sku_count; user-owned link/eta/mode are preserved.
export async function syncFbaInbounds(): Promise<Result> {
  const supabase = await createClient();
  const creds = await resolveAmazonCreds(supabase);
  try {
    const shipments = await fetchFbaInbounds(creds);
    for (const s of shipments) {
      await supabase.from("fba_inbounds").upsert({
        id: s.shipmentId, fc: s.fc, sku_count: s.skuCount, expected: s.expected,
        received: s.received, amazon_status: s.amazonStatus, synced: new Date().toISOString(),
      }, { onConflict: "id" });
      // replace this shipment's item rows
      await supabase.from("fba_inbound_items").delete().eq("inbound_id", s.shipmentId);
      if (s.items.length) {
        await supabase.from("fba_inbound_items").insert(
          s.items.map((i) => ({ inbound_id: s.shipmentId, sku: i.sellerSku, fnsku: i.fnSku, expected: i.quantityShipped, received: i.quantityReceived })),
        );
      }
    }
    revalidatePath("/fba-shipments");
    revalidatePath("/inventory");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "FBA inbound sync failed." };
  }
}

export async function disconnectIntegration(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("integrations").update({
    status: "disconnected", oauth_token: null, note: null,
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateIntegration(id);
  return { ok: true };
}
