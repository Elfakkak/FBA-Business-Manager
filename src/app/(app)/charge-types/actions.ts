"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const OWNERS = ["Supplier", "Agent", "Forwarder", "Inspection", "Broker", "—"];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) || "charge";
const asOwner = (v: string) => OWNERS.includes(v) ? v : "Supplier";

export async function createChargeType(form: FormData): Promise<Result> {
  const label = String(form.get("label") ?? "").trim();
  if (!label) return { ok: false, error: "Label is required." };
  const supabase = await createClient();
  const id = `${slug(label)}-${Date.now().toString(36).slice(-4)}`;
  const { error } = await supabase.from("charge_types").insert({ id, label, owner: asOwner(String(form.get("owner") ?? "Supplier")) });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/charge-types");
  return { ok: true };
}

export async function updateChargeType(id: string, form: FormData): Promise<Result> {
  const label = String(form.get("label") ?? "").trim();
  if (!label) return { ok: false, error: "Label is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("charge_types").update({ label, owner: asOwner(String(form.get("owner") ?? "Supplier")) }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/charge-types");
  return { ok: true };
}

// Archive hides it from pickers but keeps history; toggle back to restore.
export async function setChargeTypeArchived(id: string, archived: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("charge_types").update({ archived }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/charge-types");
  return { ok: true };
}
