"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

function read(form: FormData) {
  return {
    name: String(form.get("name") ?? "").trim(),
    role: String(form.get("role") ?? "").trim() || null,
    wechat: String(form.get("wechat") ?? "").trim() || null,
    phone: String(form.get("phone") ?? "").trim() || null,
    email: String(form.get("email") ?? "").trim() || null,
    note: String(form.get("note") ?? "").trim() || null,
    is_primary: form.get("is_primary") === "on" || form.get("is_primary") === "true",
  };
}

async function demoteOthers(company: string, exceptId?: string) {
  const supabase = await createClient();
  let q = supabase.from("contacts").update({ is_primary: false }).eq("company", company);
  if (exceptId) q = q.neq("id", exceptId);
  await q;
}

export async function addContact(company: string, form: FormData): Promise<Result> {
  const data = read(form);
  if (!data.name) return { ok: false, error: "Name is required." };
  const supabase = await createClient();
  const id = `ct-${randomUUID().slice(0, 8)}`;
  if (data.is_primary) await demoteOthers(company);
  const { error } = await supabase.from("contacts").insert({ id, company, ...data });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/suppliers");
  revalidatePath("/partners");
  return { ok: true };
}

export async function updateContact(id: string, company: string, form: FormData): Promise<Result> {
  const data = read(form);
  if (!data.name) return { ok: false, error: "Name is required." };
  const supabase = await createClient();
  if (data.is_primary) await demoteOthers(company, id);
  const { error } = await supabase.from("contacts").update(data).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/suppliers");
  revalidatePath("/partners");
  return { ok: true };
}

export async function deleteContact(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/suppliers");
  revalidatePath("/partners");
  return { ok: true };
}
