"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ORDER_PIPELINE, productionLanded } from "@/lib/derive";
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
  const supplier = form.get("supplier"); if (supplier !== null) patch.supplier = String(supplier).trim() || null;
  const agent = form.get("agent"); if (agent !== null) patch.agent = String(agent).trim() || null;
  const placed = form.get("placed_on"); if (placed !== null) patch.placed_on = String(placed).trim() || null;
  const termType = form.get("term_type"); if (termType !== null) patch.term_type = String(termType).trim() || null;
  const dep = form.get("term_deposit_pct"); if (dep !== null) { const n = parseFloat(String(dep)); patch.term_deposit_pct = Number.isFinite(n) ? n : null; }
  const insp = form.get("inspection_required"); if (insp !== null) patch.inspection_required = String(insp) === "true";

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

// ---- Landed cost / Closeout ---------------------------------------------------
// Lock the order's landed cost: compute the all-in cost per SKU, write a 'landed'
// cost-history row per SKU (traced to this order), update the catalog last cost to
// the landed figure (the truest cost), and close the order. Idempotent per order.
export async function lockLandedCost(orderId: string): Promise<Result> {
  const supabase = await createClient();
  const [{ data: lines }, { data: costs }] = await Promise.all([
    supabase.from("order_lines").select("id, sku, product_name, family_id, qty, unit_cost, unit_cny_ref").eq("order_id", orderId),
    supabase.from("order_costs").select("amount, basis, treatment").eq("order_id", orderId),
  ]);
  type L = { id: string; sku: string | null; product_name: string | null; family_id: string | null; qty: number; unit_cost: number | null; unit_cny_ref: number | null };
  const roll = productionLanded((lines ?? []) as L[], (costs ?? []) as { amount: number; basis: string; treatment: string }[]);
  const priced = roll.withLanded.filter((l) => l.sku && Number(l.qty) > 0);
  if (!priced.length) return { ok: false, error: "Add priced production lines before locking landed cost." };

  const skus = [...new Set(priced.map((l) => l.sku as string))];
  const { data: vs } = await supabase.from("product_variants").select("id, sku, family_id").in("sku", skus);
  const vmap = new Map(((vs ?? []) as { id: string; sku: string; family_id: string | null }[]).map((v) => [v.sku, v]));

  // idempotent: replace this order's landed history on re-lock
  await supabase.from("variant_cost_history").delete().eq("order_id", orderId).eq("kind", "landed");
  const hist: Database["public"]["Tables"]["variant_cost_history"]["Insert"][] = [];
  for (const l of priced) {
    const unit = Math.round(l.landedUnit * 100) / 100;
    const v = vmap.get(l.sku as string);
    hist.push({ kind: "landed", order_id: orderId, sku: l.sku, variant_id: v?.id ?? null, family_id: v?.family_id ?? l.family_id ?? null, qty: Number(l.qty), unit_cost: unit, currency: "USD" });
    await supabase.from("product_variants").update({ last_cost_usd: unit }).eq("sku", l.sku!);
  }
  const { error } = await supabase.from("variant_cost_history").insert(hist);
  if (error) return { ok: false, error: error.message };
  // Remember the pre-lock status so Unlock restores it (don't jump the order forward).
  const { data: cur } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
  const prior = cur?.status && cur.status !== "closed" ? cur.status : null;
  await supabase.from("orders").update({ status: "closed", prelock_status: prior }).eq("id", orderId);
  revalidatePath(`/orders/${orderId}`); revalidatePath("/orders"); revalidatePath("/catalog");
  return { ok: true };
}

export async function unlockLandedCost(orderId: string): Promise<Result> {
  const supabase = await createClient();
  await supabase.from("variant_cost_history").delete().eq("order_id", orderId).eq("kind", "landed");
  // Restore the status the order had before locking (fallback to 'fba' for legacy locks).
  const { data: o } = await supabase.from("orders").select("prelock_status").eq("id", orderId).maybeSingle();
  const restore = (o?.prelock_status as OrderStatus) || "fba";
  await supabase.from("orders").update({ status: restore, prelock_status: null }).eq("id", orderId);
  revalidatePath(`/orders/${orderId}`); revalidatePath("/orders"); revalidatePath("/catalog");
  return { ok: true };
}

// Save a SKU's sale price from the "Did it make money?" projection — pushes it
// back to the catalog so the product carries the price you actually sell at.
export async function saveVariantSalePrice(sku: string, price: number | null): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").update({ sale_price: price && price > 0 ? price : null }).eq("sku", sku);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/catalog");
  return { ok: true };
}

// Save the landed cost buckets from the Adjust modal: update each existing cost's
// amount + allocation basis, and upsert the manual Duties & customs bucket.
export type BucketEdit = { id: string | null; amount: number; basis: string; isDuties: boolean };
export async function saveLandedBuckets(orderId: string, items: BucketEdit[]): Promise<Result> {
  const supabase = await createClient();
  for (const it of items) {
    if (it.id) {
      const { error } = await supabase.from("order_costs").update({ amount: Math.max(0, it.amount), basis: it.basis }).eq("id", it.id);
      if (error) return { ok: false, error: error.message };
    } else if (it.isDuties && it.amount > 0) {
      const { error } = await supabase.from("order_costs").insert({
        order_id: orderId, description: "Duties & customs", line_type: "duties",
        treatment: "inventoriable", basis: it.basis || "value", amount: it.amount, currency: "USD",
        section: "Landed", qty: 1, coverage: "Uncovered",
      });
      if (error) return { ok: false, error: error.message };
    }
  }
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

// ---- Inspection ---------------------------------------------------------------
type InspectionPatch = Database["public"]["Tables"]["order_inspections"]["Update"];

async function upsertInspection(orderId: string, patch: InspectionPatch): Promise<Result> {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("order_inspections").select("order_id").eq("order_id", orderId).maybeSingle();
  const body = { ...patch, updated_at: new Date().toISOString() };
  const { error } = existing
    ? await supabase.from("order_inspections").update(body).eq("order_id", orderId)
    : await supabase.from("order_inspections").insert({ order_id: orderId, ...body });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

// Advance the order forward only (never backward) — used when inspection clears.
async function advanceOrderForward(orderId: string, target: string): Promise<void> {
  const supabase = await createClient();
  const { data: o } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
  if (!o) return;
  const idx = (k: string) => ORDER_PIPELINE.findIndex((s) => s.key === k);
  if (idx(target) > idx(o.status)) {
    await supabase.from("orders").update({ status: target as OrderStatus }).eq("id", orderId);
    revalidatePath("/orders");
  }
}

export async function toggleInspectionRequired(orderId: string, required: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ inspection_required: required }).eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`); revalidatePath("/orders");
  return { ok: true };
}

export async function scheduleInspection(orderId: string, f: { inspector: string; scheduled_date: string; visit_type: string; aql: string; factory_contact?: string | null }): Promise<Result> {
  if (!f.inspector?.trim() || !f.scheduled_date?.trim()) return { ok: false, error: "Inspector and date are required." };
  return upsertInspection(orderId, { inspector: f.inspector.trim(), scheduled_date: f.scheduled_date.trim(), visit_type: f.visit_type, aql: f.aql, factory_contact: f.factory_contact?.trim() || null, status: "scheduled" });
}

export async function saveInspectionReport(orderId: string, url: string, name: string): Promise<Result> {
  return upsertInspection(orderId, { report_url: url, report_name: name, report_accepted: false });
}

export async function acceptInspectionReport(orderId: string): Promise<Result> {
  const r = await upsertInspection(orderId, { report_accepted: true });
  if (!r.ok) return r;
  const supabase = await createClient();
  const { data: insp } = await supabase.from("order_inspections").select("result").eq("order_id", orderId).maybeSingle();
  if (insp?.result === "pass") await advanceOrderForward(orderId, "transit");
  return { ok: true };
}

export async function saveInspectionFolderLink(orderId: string, url: string): Promise<Result> {
  return upsertInspection(orderId, { folder_link: url.trim() || null });
}

export async function setInspectionResult(orderId: string, result: string, defects?: { critical?: number | null; major?: number | null; minor?: number | null }): Promise<Result> {
  const patch: InspectionPatch = { result, status: "completed", completed_date: new Date().toISOString().slice(0, 10) };
  if (defects) { patch.defects_critical = defects.critical ?? null; patch.defects_major = defects.major ?? null; patch.defects_minor = defects.minor ?? null; }
  const r = await upsertInspection(orderId, patch);
  if (!r.ok) return r;
  if (result === "pass") {
    const supabase = await createClient();
    const { data: insp } = await supabase.from("order_inspections").select("report_accepted").eq("order_id", orderId).maybeSingle();
    if (insp?.report_accepted) await advanceOrderForward(orderId, "transit");
  }
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
