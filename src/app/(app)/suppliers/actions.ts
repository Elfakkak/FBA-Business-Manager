"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Result = { ok: true } | { ok: false; error: string } | { ok: true; name: string };
type SupplierUpdate = Database["public"]["Tables"]["suppliers"]["Update"];

export async function createSupplier(form: FormData): Promise<Result> {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Supplier name is required." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("suppliers").select("name");
  if ((existing ?? []).some((s) => s.name.toLowerCase() === name.toLowerCase()))
    return { ok: false, error: "A supplier with that name already exists." };
  const { error } = await supabase.from("suppliers").insert({
    name,
    origin: String(form.get("origin") ?? "").trim() || null,
    contact: String(form.get("contact") ?? "").trim() || null,
    payment_terms: String(form.get("payment_terms") ?? "").trim() || null,
    is_new: true,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/suppliers");
  return { ok: true, name };
}

const PROFILE = ["contact", "email", "phone", "address", "origin", "payment_terms", "incoterm", "route", "notes"] as const;

export async function updateSupplier(name: string, form: FormData): Promise<Result> {
  const supabase = await createClient();
  const patch: SupplierUpdate = {};
  for (const f of PROFILE) {
    const v = form.get(f);
    if (v !== null) patch[f] = String(v).trim() || null;
  }
  const lt = form.get("lead_time_days");
  if (lt !== null && String(lt) !== "") patch.lead_time_days = parseInt(String(lt)) || null;
  const moq = form.get("moq");
  if (moq !== null && String(moq) !== "") patch.moq = parseInt(String(moq)) || null;

  const { error } = await supabase.from("suppliers").update(patch).eq("name", name);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${encodeURIComponent(name)}`);
  return { ok: true };
}
