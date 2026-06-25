"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { INTG_DEFS } from "@/lib/integrations";
import { fetchFbaInventory, type AmazonCreds } from "@/lib/amazon/sp-api";

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
export async function syncAmazonInventory(): Promise<Result> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("integrations").select("oauth_token").eq("id", "amazon").maybeSingle();
  const creds = (row?.oauth_token ?? {}) as AmazonCreds;

  try {
    const inventory = await fetchFbaInventory(creds);
    let matched = 0;
    for (const r of inventory) {
      if (!r.sellerSku) continue;
      const { data: upd } = await supabase
        .from("product_variants")
        .update({ fba_stock: r.total, inbound: r.inbound, unfulfillable: r.unfulfillable } as never)
        .eq("sku", r.sellerSku)
        .select("id");
      if (upd?.length) matched += upd.length;
    }
    const note = `Synced ${inventory.length} FBA SKUs from Amazon · ${matched} matched in catalog.`;
    await supabase.from("integrations").update({ status: "connected", last_sync: new Date().toISOString(), note }).eq("id", "amazon");
    revalidateIntegration("amazon");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Amazon sync failed.";
    await supabase.from("integrations").update({ status: "error", note: msg }).eq("id", "amazon");
    revalidateIntegration("amazon");
    return { ok: false, error: msg };
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
