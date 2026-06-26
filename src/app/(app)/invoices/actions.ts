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
    proof_kind: proofUrl ? "receipt" : null, proof_url: proofUrl,
  });
  if (pe) return { ok: false, error: pe.message };
  const { error: ie } = await supabase.from("invoices").update({ paid: (inv.paid ?? 0) + amount }).eq("id", invoiceId);
  if (ie) return { ok: false, error: ie.message };
  revalidatePath("/invoices");
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
