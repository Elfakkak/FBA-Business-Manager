import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type InvoiceRow, type InvoiceLineRow } from "@/lib/derive";
import { InvoiceDetailPage } from "./invoice-detail";
import type { InvRow, Payment } from "../invoices-table";
import type { OrderLineLite, ChargeTypeLite } from "../invoice-charges";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!invoice) notFound();
  const inv = invoice as InvoiceRow;

  const [{ data: payments }, { data: lines }, { data: orderLines }, { data: chargeTypes }, { data: order }, { data: orders }, { data: suppliers }, { data: partners }] = await Promise.all([
    supabase.from("invoice_payments").select("id, amount, payment_date, method, status, proof_kind, proof_url").eq("invoice_id", id).order("payment_date", { ascending: true }),
    supabase.from("invoice_lines").select("*").eq("invoice_id", id),
    inv.order_id ? supabase.from("order_lines").select("id, sku, product_name, qty, unit_cost").eq("order_id", inv.order_id) : Promise.resolve({ data: [] }),
    supabase.from("charge_types").select("id, label, owner").eq("archived", false).order("owner").order("label"),
    inv.order_id ? supabase.from("orders").select("id, title").eq("id", inv.order_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("orders").select("id, title"),
    supabase.from("suppliers").select("name").order("name"),
    supabase.from("partners").select("name").order("name"),
  ]);

  const row: InvRow = {
    ...inv,
    orderTitle: order?.title ?? null,
    payments: ((payments ?? []) as Payment[]),
    lines: ((lines ?? []) as InvoiceLineRow[]),
  };
  const vendors = [...new Set([
    ...((suppliers ?? []) as { name: string }[]).map((s) => s.name),
    ...((partners ?? []) as { name: string }[]).map((p) => p.name),
  ])];

  return (
    <InvoiceDetailPage
      row={row}
      orders={(orders ?? []) as { id: string; title: string }[]}
      vendors={vendors}
      orderLines={(orderLines ?? []) as OrderLineLite[]}
      chargeTypes={(chargeTypes ?? []) as ChargeTypeLite[]}
    />
  );
}
