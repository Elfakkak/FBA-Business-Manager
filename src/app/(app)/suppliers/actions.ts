"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { payTermSummary, type PayTermCfg } from "@/lib/derive";
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
  const termType = String(form.get("term_type") ?? "").trim() || null;
  const depRaw = parseFloat(String(form.get("term_deposit_pct") ?? ""));
  const termDeposit = Number.isFinite(depRaw) ? depRaw : null;
  // Keep the legacy text payment_terms in sync (derived) so older displays still read.
  const paymentTerms = termType ? payTermSummary({ type: termType as PayTermCfg["type"], depositPct: termDeposit }) : null;
  const contact = String(form.get("contact") ?? "").trim() || null;

  const { error } = await supabase.from("suppliers").insert({
    name,
    origin: String(form.get("origin") ?? "").trim() || null,
    contact,
    payment_terms: paymentTerms,
    term_type: termType,
    term_deposit_pct: termDeposit,
    is_new: true,
  });
  if (error) return { ok: false, error: error.message };

  // Optionally create a contact record for this supplier (the "＋ New contact" flow).
  if (form.get("create_contact") === "1" && contact) {
    await supabase.from("contacts").insert({ id: randomUUID(), company: name, name: contact, is_primary: true });
  }
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

// Soft-hide dormant suppliers from the active list without losing history. Keyed by name (PK).
export async function bulkSetSupplierArchived(names: string[], archived: boolean): Promise<Result> {
  if (!names.length) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update({ archived }).in("name", names);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/suppliers");
  return { ok: true };
}
