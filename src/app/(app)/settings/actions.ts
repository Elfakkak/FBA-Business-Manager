"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const s = (form: FormData, k: string) => { const v = form.get(k); return v === null ? null : String(v).trim() || null; };

export async function saveBusiness(form: FormData): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("business_profile").upsert({
    id: 1,
    company: s(form, "company"), entity_type: s(form, "entity_type"), state_of_formation: s(form, "state_of_formation"),
    ein: s(form, "ein"), formation_date: s(form, "formation_date"), registered_agent: s(form, "registered_agent"),
    email: s(form, "email"), phone: s(form, "phone"), country: s(form, "country"),
    address: s(form, "address"), city: s(form, "city"), state: s(form, "state"), zip: s(form, "zip"),
    duns_number: s(form, "duns_number"), website: s(form, "website"),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function saveBrand(form: FormData): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("brand").upsert({
    id: 1,
    name: s(form, "name"), tagline: s(form, "tagline"), color: s(form, "color"), established: s(form, "established"),
    registry_enrolled: form.get("registry_enrolled") === "on", registry_id: s(form, "registry_id"),
    gtin_exempt: form.get("gtin_exempt") === "on",
    tm_number: s(form, "tm_number"), tm_status: s(form, "tm_status"), tm_jurisdiction: s(form, "tm_jurisdiction"), tm_owner: s(form, "tm_owner"),
    website: s(form, "website"), store_url: s(form, "store_url"), support_email: s(form, "support_email"),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function saveBrandLogo(url: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("brand").upsert({ id: 1, logo_url: url || null } as never);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function saveNotifications(form: FormData): Promise<Result> {
  const supabase = await createClient();
  const prefs: Record<string, boolean> = {};
  for (const k of ["lowstock", "overdue", "fbavar", "sync"]) prefs[k] = form.get(k) === "on";
  const { error } = await supabase.from("notification_prefs").upsert({ id: 1, prefs });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

const ROLES = ["Owner", "Partner", "Operations", "Viewer"] as const;
type Role = (typeof ROLES)[number];
const normalizeRole = (r: string): Role => (ROLES.includes(r as Role) ? (r as Role) : "Viewer");

export async function inviteMember(form: FormData): Promise<Result> {
  const email = String(form.get("email") ?? "").trim();
  let role = normalizeRole(String(form.get("role") ?? "Viewer").trim());
  if (!/\S+@\S+\.\S+/.test(email)) return { ok: false, error: "Enter a valid email." };
  // never escalate an invitee straight to Owner — they'd inherit owner RLS on signup
  if (role === "Owner") role = "Partner";
  const supabase = await createClient();
  const id = `m${Date.now().toString(36)}`;
  const { error } = await supabase.from("users").insert({
    id, name: email.split("@")[0], email, role, status: "invited", fin_id: id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateMember(id: string, form: FormData): Promise<Result> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  const name = s(form, "name"); if (name) patch.name = name;
  const email = s(form, "email"); if (email) patch.email = email;
  const role = s(form, "role"); if (role) patch.role = normalizeRole(role);
  if (form.get("is_owner") !== null) {
    const isOwner = form.get("is_owner") === "on";
    patch.is_owner = isOwner;
    if (!isOwner) patch.share = null; // clear stale ownership when demoted
  }
  const share = form.get("share");
  if (patch.share !== null && share !== null && String(share) !== "") {
    const pct = parseFloat(String(share)) || 0;
    patch.share = Math.min(1, Math.max(0, pct / 100)); // clamp 0–100%
  }
  const { error } = await supabase.from("users").update(patch as never).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeMember(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("users").delete().eq("id", id).eq("is_you", false);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
