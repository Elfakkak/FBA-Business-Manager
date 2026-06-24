"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const slug = (s: string) =>
  s.toLowerCase().replace(/["'(),]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

type Result = { ok: true } | { ok: false; error: string };

export async function addPackagingItem(form: FormData): Promise<Result> {
  const name = String(form.get("name") ?? "").trim();
  const kind = String(form.get("kind") ?? "Other").trim();
  const familyId = String(form.get("family_id") ?? "").trim() || null;
  const unitCost = parseFloat(String(form.get("unit_cost") ?? "")) || 0;
  const reorderRaw = String(form.get("reorder_point") ?? "");
  const reorder = reorderRaw === "" ? null : parseInt(reorderRaw);
  const opening = parseInt(String(form.get("opening_qty") ?? "")) || 0;
  const source = String(form.get("source") ?? "").trim() || null;
  if (!name) return { ok: false, error: "Name is required." };

  const supabase = await createClient();
  const id = `${slug(name)}-${Date.now().toString(36).slice(-4)}`;
  const { error } = await supabase.from("packaging_items").insert({
    id,
    name,
    kind: kind as never,
    family_id: familyId,
    unit_cost: unitCost,
    reorder_point: reorder,
  });
  if (error) return { ok: false, error: error.message };

  if (opening > 0) {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("packaging_moves").insert({
      id: randomUUID(),
      item_id: id,
      type: "receive",
      qty: opening,
      unit_cost: unitCost,
      source,
      move_date: today,
    });
  }
  revalidatePath("/packaging");
  return { ok: true };
}

export async function receivePackaging(itemId: string, form: FormData): Promise<Result> {
  const qty = parseInt(String(form.get("qty") ?? ""));
  const unitCost = parseFloat(String(form.get("unit_cost") ?? ""));
  const source = String(form.get("source") ?? "").trim() || null;
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Quantity must be a positive number." };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("packaging_moves").insert({
    id: randomUUID(),
    item_id: itemId,
    type: "receive",
    qty,
    unit_cost: Number.isFinite(unitCost) ? unitCost : null,
    source,
    move_date: today,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/packaging");
  return { ok: true };
}
