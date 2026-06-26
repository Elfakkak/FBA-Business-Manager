"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ORDER_PIPELINE } from "@/lib/derive";
import type { Database } from "@/lib/database.types";

type Result = { ok: true } | { ok: false; error: string };
type OrderStatus = Database["public"]["Enums"]["order_status"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

const isValidStatus = (s: string) => ORDER_PIPELINE.some((p) => p.key === s);

export async function createOrder(form: FormData): Promise<Result> {
  const title = String(form.get("title") ?? "").trim();
  const supplier = String(form.get("supplier") ?? "").trim() || null;
  const agent = String(form.get("agent") ?? "").trim() || null;
  const placed = String(form.get("placed_on") ?? "").trim();
  if (!title) return { ok: false, error: "Order title is required." };

  const supabase = await createClient();
  // human id ORD-YYYY-MM-NNN, sequence scoped to that month so it never collides
  const ym = (placed || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const { data: latest } = await supabase
    .from("orders").select("id").like("id", `ORD-${ym}-%`)
    .order("id", { ascending: false }).limit(1).maybeSingle();
  const seq = latest ? (parseInt(latest.id.slice(-3)) || 0) + 1 : 1;
  const id = `ORD-${ym}-${String(seq).padStart(3, "0")}`;

  const { error } = await supabase.from("orders").insert({
    id, title, supplier, agent,
    route: agent ? `via ${agent}` : "Direct supplier",
    status: "draft",
    placed_on: placed || null,
    fba_eta: String(form.get("fba_eta") ?? "").trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orders");
  return { ok: true };
}

export async function updateOrder(id: string, form: FormData): Promise<Result> {
  const supabase = await createClient();
  const patch: OrderUpdate = {};
  const title = form.get("title"); if (title !== null && String(title).trim()) patch.title = String(title).trim();
  const status = form.get("status"); if (status !== null && isValidStatus(String(status))) patch.status = String(status) as OrderStatus;
  const eta = form.get("fba_eta"); if (eta !== null) patch.fba_eta = String(eta).trim() || null;
  const placed = form.get("placed_on"); if (placed !== null) patch.placed_on = String(placed).trim() || null;

  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  return { ok: true };
}

export async function addOrderLine(orderId: string, form: FormData): Promise<Result> {
  const variantId = String(form.get("variant_id") ?? "").trim();
  const qty = parseInt(String(form.get("qty") ?? ""));
  const unitCost = parseFloat(String(form.get("unit_cost") ?? ""));
  if (!variantId) return { ok: false, error: "Pick a variant." };
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Quantity must be positive." };

  const unitCny = parseFloat(String(form.get("unit_cny_ref") ?? ""));
  const supabase = await createClient();
  const { data: v } = await supabase.from("product_variants").select("id, sku, family_id, name, last_cost_usd, last_cost_rmb").eq("id", variantId).maybeSingle();
  if (!v) return { ok: false, error: "Variant not found." };
  // Price seeds from the catalog's last known cost (a reference/suggestion you can
  // override). The ACTUAL price is recorded later on the invoice.
  const { error } = await supabase.from("order_lines").insert({
    order_id: orderId, variant_id: v.id, family_id: v.family_id, sku: v.sku, product_name: v.name,
    qty, unit_cost: Number.isFinite(unitCost) ? unitCost : v.last_cost_usd,
    unit_cny_ref: Number.isFinite(unitCny) ? unitCny : v.last_cost_rmb,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}

// Batch-add several catalog variants as production lines (the Add SKUs browser).
export async function addOrderLines(orderId: string, lines: { variant_id: string; qty: number; unit_cost: number | null; unit_cny_ref: number | null }[]): Promise<Result> {
  const picked = (lines ?? []).filter((l) => l.variant_id);
  if (!picked.length) return { ok: false, error: "Pick at least one SKU." };
  const supabase = await createClient();
  const { data: vs } = await supabase.from("product_variants").select("id, sku, family_id, name, last_cost_usd, last_cost_rmb").in("id", picked.map((l) => l.variant_id));
  const vmap = new Map(((vs ?? []) as { id: string; sku: string; family_id: string | null; name: string; last_cost_usd: number | null; last_cost_rmb: number | null }[]).map((v) => [v.id, v]));
  const rows = picked.map((l) => {
    const v = vmap.get(l.variant_id);
    return {
      order_id: orderId, variant_id: l.variant_id, family_id: v?.family_id ?? null,
      sku: v?.sku ?? null, product_name: v?.name ?? null,
      qty: Math.max(0, Math.round(Number(l.qty) || 0)),
      unit_cost: l.unit_cost ?? v?.last_cost_usd ?? null,
      unit_cny_ref: l.unit_cny_ref ?? v?.last_cost_rmb ?? null,
    };
  }).filter((r) => r.variant_id);
  const { error } = await supabase.from("order_lines").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}

// Inline-edit a production line (qty / $ invoice cost / ¥ reference cost).
export async function updateOrderLine(id: string, orderId: string, patch: { qty?: number; unit_cost?: number | null; unit_cny_ref?: number | null }): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("order_lines").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}

export async function deleteOrderLine(id: string, orderId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("order_lines").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}

// Record packaging consumed by an order → a 'consume' move that deducts packaging stock.
export async function addOrderPackaging(orderId: string, form: FormData): Promise<Result> {
  const itemId = String(form.get("item_id") ?? "").trim();
  const qty = parseInt(String(form.get("qty") ?? ""));
  if (!itemId) return { ok: false, error: "Pick a packaging item." };
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Quantity must be a positive number." };
  const supabase = await createClient();
  const { error } = await supabase.from("packaging_moves").insert({
    id: crypto.randomUUID(), item_id: itemId, type: "consume", qty, order_id: orderId,
    move_date: new Date().toISOString().slice(0, 10), note: "Used on order",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/packaging");
  return { ok: true };
}

export async function removeOrderPackaging(moveId: string, orderId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("packaging_moves").delete().eq("id", moveId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/packaging");
  return { ok: true };
}

// ---- Non-product / factory costs on an order (Production page) --------------
const costNum = (v: FormDataEntryValue | null, d = 0) => { const n = Number(String(v ?? "").trim()); return Number.isFinite(n) ? n : d; };
const costTxt = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };

export async function addOrderCost(orderId: string, form: FormData): Promise<Result> {
  const description = String(form.get("description") ?? "").trim();
  if (!description) return { ok: false, error: "Description is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("order_costs").insert({
    order_id: orderId,
    description,
    section: costTxt(form.get("section")) ?? "Production",
    line_type: costTxt(form.get("line_type")),
    charge_type_id: costTxt(form.get("charge_type_id")),
    qty: costNum(form.get("qty"), 1),
    amount: costNum(form.get("amount")),            // USD — the calculation amount
    amount_cny_ref: form.get("amount_cny_ref") != null && String(form.get("amount_cny_ref")).trim() !== "" ? costNum(form.get("amount_cny_ref")) : null, // ¥ reference only
    currency: "USD",
    treatment: costTxt(form.get("treatment")) ?? "inventoriable",
    vendor: costTxt(form.get("vendor")),
    notes: costTxt(form.get("notes")),
    coverage: costTxt(form.get("coverage")) ?? "Uncovered",
    basis: costTxt(form.get("basis")) ?? "value",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function updateOrderCost(id: string, orderId: string, patch: Partial<{ description: string; section: string; line_type: string | null; qty: number; amount: number; coverage: string; basis: string }>): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("order_costs").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function deleteOrderCost(id: string, orderId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("order_costs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

// ---- Production supporting files (one file per slot, replace-on-upload) -------
export async function saveOrderFile(orderId: string, slot: string, url: string, name: string | null): Promise<Result> {
  if (!url) return { ok: false, error: "Missing file." };
  const supabase = await createClient();
  await supabase.from("order_files").delete().eq("order_id", orderId).eq("slot", slot);
  const { error } = await supabase.from("order_files").insert({ order_id: orderId, slot, url, name });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function deleteOrderFile(orderId: string, slot: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("order_files").delete().eq("order_id", orderId).eq("slot", slot);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function setOrderStatus(id: string, status: string): Promise<Result> {
  if (!isValidStatus(status)) return { ok: false, error: "Invalid status." };
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status: status as OrderStatus }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  return { ok: true };
}
