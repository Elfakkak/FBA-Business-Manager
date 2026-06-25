"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Result = { ok: true } | { ok: false; error: string };
type PartnerType = "Agent" | "Forwarder" | "Inspection";
type PartnerUpdate = Database["public"]["Tables"]["partners"]["Update"];

export async function createPartner(form: FormData): Promise<Result> {
  const name = String(form.get("name") ?? "").trim();
  const type = (String(form.get("type") ?? "Forwarder").trim() || "Forwarder") as PartnerType;
  if (!name) return { ok: false, error: "Partner name is required." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("partners").select("name");
  if ((existing ?? []).some((p) => p.name.toLowerCase() === name.toLowerCase()))
    return { ok: false, error: "A partner with that name already exists." };
  const { error } = await supabase.from("partners").insert({
    name, type,
    specialty: String(form.get("specialty") ?? "").trim() || null,
    contact: String(form.get("contact") ?? "").trim() || null,
    is_new: true,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/partners");
  return { ok: true };
}

const PROFILE = ["contact", "email", "phone", "address", "origin", "payment_terms", "specialty", "notes"] as const;

export async function updatePartner(name: string, form: FormData): Promise<Result> {
  const supabase = await createClient();
  const patch: PartnerUpdate = {};
  for (const f of PROFILE) {
    const v = form.get(f);
    if (v !== null) patch[f] = String(v).trim() || null;
  }
  const type = form.get("type");
  if (type !== null && String(type)) patch.type = String(type) as PartnerUpdate["type"];

  const { error } = await supabase.from("partners").update(patch).eq("name", name);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/partners");
  revalidatePath(`/partners/${encodeURIComponent(name)}`);
  return { ok: true };
}
