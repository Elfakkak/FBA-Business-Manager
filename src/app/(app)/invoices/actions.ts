"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Result = { ok: true; id?: string } | { ok: false; error: string };
type VendorType = Database["public"]["Enums"]["vendor_type"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];
const VENDOR_TYPES: VendorType[] = ["Supplier", "Forwarder", "Agent", "Inspection"];
const PAY_STATUSES: PaymentStatus[] = ["Cleared", "Scheduled", "Pending"];
const asVendorType = (v: string): VendorType => (VENDOR_TYPES as string[]).includes(v) ? (v as VendorType) : "Supplier";
const asPayStatus = (v: string): PaymentStatus => (PAY_STATUSES as string[]).includes(v) ? (v as PaymentStatus) : "Cleared";

const txt = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };
const numOr0 = (v: FormDataEntryValue | null) => { const n = Number(String(v ?? "").trim()); return Number.isFinite(n) ? n : 0; };
const intOrNull = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); if (s === "") return null; const n = parseInt(s); return Number.isFinite(n) ? n : null; };

// structured payment-term fields, shared by create/update
function termFields(form: FormData) {
  return {
    term_type: txt(form.get("term_type")),
    term_deposit_pct: intOrNull(form.get("term_deposit_pct")),
    term_net_days: intOrNull(form.get("term_net_days")),
  };
}

export async function createInvoice(form: FormData): Promise<Result> {
  const supabase = await createClient();
  const vendor = String(form.get("vendor") ?? "").trim();
  if (!vendor) return { ok: false, error: "Vendor is required." };
  const total = numOr0(form.get("total"));
  if (total <= 0) return { ok: false, error: "Total must be greater than 0." };
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const id = `INV-${yymm}-${(Date.now() % 1000).toString().padStart(3, "0")}`;
  const { error } = await supabase.from("invoices").insert({
    id, order_id: txt(form.get("order_id")), vendor, vendor_type: asVendorType(String(form.get("vendor_type") ?? "Supplier")),
    issued: txt(form.get("issued")), due: txt(form.get("due")), total, paid: numOr0(form.get("paid")),
    currency: txt(form.get("currency")) ?? "USD", terms: txt(form.get("terms")), ...termFields(form),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/invoices");
  return { ok: true, id };
}

export async function updateInvoice(id: string, form: FormData): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({
    order_id: txt(form.get("order_id")), vendor: String(form.get("vendor") ?? "").trim(),
    vendor_type: asVendorType(String(form.get("vendor_type") ?? "Supplier")),
    issued: txt(form.get("issued")), due: txt(form.get("due")),
    total: numOr0(form.get("total")), currency: txt(form.get("currency")) ?? "USD", terms: txt(form.get("terms")), ...termFields(form),
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { ok: true, id };
}

// Inline-save the structured payment term (from the Payment-terms card).
export async function saveInvoiceTerms(id: string, cfg: { type: string; depositPct?: number | null; netDays?: number | null }): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({
    term_type: cfg.type, term_deposit_pct: cfg.depositPct ?? null, term_net_days: cfg.netDays ?? null,
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { ok: true, id };
}

// Attach (or replace) a payment's proof — a receipt file URL.
export async function attachPaymentProof(paymentId: string, invoiceId: string, url: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("invoice_payments").update({ proof_kind: url ? "receipt" : null, proof_url: url || null }).eq("id", paymentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { ok: true };
}

export async function saveInvoiceDocument(id: string, url: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ document_url: url || null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/invoices/${id}`);
  return { ok: true };
}

export async function deleteInvoice(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", id); // payments cascade
  if (error) return { ok: false, error: error.message };
  revalidatePath("/invoices");
  return { ok: true };
}

// Record a payment — inserts the payment row AND bumps the invoice's paid total.
export async function recordPayment(invoiceId: string, form: FormData): Promise<Result> {
  const supabase = await createClient();
  const amount = numOr0(form.get("amount"));
  if (amount <= 0) return { ok: false, error: "Amount must be greater than 0." };
  const { data: inv } = await supabase.from("invoices").select("paid").eq("id", invoiceId).maybeSingle();
  if (!inv) return { ok: false, error: "Invoice not found." };
  const proofUrl = txt(form.get("proof_url"));
  const { error: pe } = await supabase.from("invoice_payments").insert({
    id: randomUUID(), invoice_id: invoiceId, amount,
    payment_date: txt(form.get("payment_date")) ?? new Date().toISOString().slice(0, 10),
    method: txt(form.get("method")), status: asPayStatus(String(form.get("status") ?? "Cleared")),
    reference: txt(form.get("reference")),
    proof_kind: proofUrl ? "receipt" : null, proof_url: proofUrl,
  });
  if (pe) return { ok: false, error: pe.message };
  const { error: ie } = await supabase.from("invoices").update({ paid: (inv.paid ?? 0) + amount }).eq("id", invoiceId);
  if (ie) return { ok: false, error: ie.message };
  revalidatePath("/invoices");
  return { ok: true, id: invoiceId };
}

// ---- Invoice lines / charges (V2 itemization) --------------------------------
// One goods/service/discount line on an invoice. Goods may link to an order_line
// (carries the ORDERED snapshot for billed-vs-ordered variance); service/discount
// reference the charge_types catalog. `billed` is negative for discounts.
export type InvoiceLineInput = {
  kind: "goods" | "service" | "discount";
  order_line_id?: string | null;
  sku?: string | null;
  description: string;
  qty?: number | null;
  ordered_amount?: number | null;
  charge_type_id?: string | null;
  owner?: string | null;
  billed: number;
};

// Replace-all save from the Edit charges modal. Does NOT touch invoice.total —
// the total stays the source of truth; the UI surfaces any itemized-vs-total gap.
export async function saveInvoiceLines(invoiceId: string, lines: InvoiceLineInput[]): Promise<Result> {
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoices").select("order_id, issued").eq("id", invoiceId).maybeSingle();
  if (!inv) return { ok: false, error: "Invoice not found." };

  // Snapshot existing line ids so we can insert-first, then delete the old set.
  // (Insert-first means a failed insert leaves the prior lines intact — no data
  //  loss; the worst case on a failed delete is harmless duplicates.)
  const { data: existing } = await supabase.from("invoice_lines").select("id").eq("invoice_id", invoiceId);
  const oldIds = ((existing ?? []) as { id: string }[]).map((r) => r.id);

  const rows = (lines ?? [])
    .filter((l) => (l.description ?? "").trim() !== "" || (Number(l.billed) || 0) !== 0)
    .map((l, idx) => ({
      invoice_id: invoiceId,
      kind: l.kind ?? "goods",
      position: idx,
      order_line_id: l.order_line_id ?? null,
      sku: txt(l.sku ?? null),
      description: String(l.description ?? "").trim(),
      qty: l.qty == null ? null : Number(l.qty),
      ordered_amount: l.ordered_amount == null ? null : Number(l.ordered_amount),
      charge_type_id: l.charge_type_id ?? null,
      owner: txt(l.owner ?? null),
      billed: Number(l.billed) || 0,
    }));
  if (rows.length) {
    const { error: ins } = await supabase.from("invoice_lines").insert(rows);
    if (ins) return { ok: false, error: ins.message };
  }
  if (oldIds.length) {
    const { error: del } = await supabase.from("invoice_lines").delete().in("id", oldIds);
    if (del) return { ok: false, error: del.message };
  }

  // Feedback loop + PROVENANCE: the invoice is the ACTUAL price paid. For each
  // goods line we (a) update the catalog last cost (denormalized cache) and
  // (b) append a cost-history row that traces back to THIS invoice/order — so the
  // product page can show "cost $X · from PI-… on ORD-… · date" (a truthful source).
  const goods = rows.filter((r) => r.kind === "goods" && r.sku && Number(r.qty) > 0 && r.billed > 0);
  if (goods.length) {
    const skus = [...new Set(goods.map((r) => r.sku as string))];
    const { data: vs } = await supabase.from("product_variants").select("id, sku, family_id").in("sku", skus);
    const vmap = new Map(((vs ?? []) as { id: string; sku: string; family_id: string | null }[]).map((v) => [v.sku, v]));
    // Don't let an invoice re-save clobber a NEWER locked landed cost: landed is the
    // truer figure, so we only refresh last_cost when this invoice post-dates any
    // landed lock for that SKU. (Provenance history is still recorded either way.)
    const { data: landed } = await supabase.from("variant_cost_history").select("sku, recorded_at").eq("kind", "landed").in("sku", skus);
    const landedMax = new Map<string, string>();
    for (const r of (landed ?? []) as { sku: string | null; recorded_at: string }[]) {
      if (!r.sku) continue; const cur = landedMax.get(r.sku);
      if (!cur || r.recorded_at > cur) landedMax.set(r.sku, r.recorded_at);
    }
    const invDate = inv.issued ?? new Date().toISOString();
    // idempotent: replace this invoice's product cost-history (re-saving doesn't duplicate)
    await supabase.from("variant_cost_history").delete().eq("invoice_id", invoiceId).eq("kind", "product");
    const hist: Database["public"]["Tables"]["variant_cost_history"]["Insert"][] = [];
    for (const r of goods) {
      const unit = Math.round((r.billed / Number(r.qty)) * 100) / 100;
      const lm = landedMax.get(r.sku!);
      if (!lm || invDate >= lm) await supabase.from("product_variants").update({ last_cost_usd: unit }).eq("sku", r.sku!);
      const v = vmap.get(r.sku!);
      hist.push({
        variant_id: v?.id ?? null, sku: r.sku, family_id: v?.family_id ?? null,
        kind: "product", unit_cost: unit, currency: "USD", qty: Number(r.qty), billed: r.billed,
        invoice_id: invoiceId, order_id: inv.order_id ?? null,
        recorded_at: inv.issued ?? new Date().toISOString(),
      });
    }
    if (hist.length) await supabase.from("variant_cost_history").insert(hist);
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  if (inv.order_id) revalidatePath(`/orders/${inv.order_id}`);
  revalidatePath("/catalog");
  return { ok: true, id: invoiceId };
}

export async function deletePayment(paymentId: string, invoiceId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: pay } = await supabase.from("invoice_payments").select("amount").eq("id", paymentId).maybeSingle();
  const { data: inv } = await supabase.from("invoices").select("paid").eq("id", invoiceId).maybeSingle();
  const { error } = await supabase.from("invoice_payments").delete().eq("id", paymentId);
  if (error) return { ok: false, error: error.message };
  if (pay && inv) await supabase.from("invoices").update({ paid: Math.max(0, (inv.paid ?? 0) - pay.amount) }).eq("id", invoiceId);
  revalidatePath("/invoices");
  return { ok: true };
}
