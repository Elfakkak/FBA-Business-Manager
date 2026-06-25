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

  const supabase = await createClient();
  const { data: v } = await supabase.from("product_variants").select("id, sku, family_id, name, last_cost_usd").eq("id", variantId).maybeSingle();
  if (!v) return { ok: false, error: "Variant not found." };
  const { error } = await supabase.from("order_lines").insert({
    order_id: orderId, variant_id: v.id, family_id: v.family_id, sku: v.sku, product_name: v.name,
    qty, unit_cost: Number.isFinite(unitCost) ? unitCost : v.last_cost_usd,
  });
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

export async function setOrderStatus(id: string, status: string): Promise<Result> {
  if (!isValidStatus(status)) return { ok: false, error: "Invalid status." };
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status: status as OrderStatus }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  return { ok: true };
}
