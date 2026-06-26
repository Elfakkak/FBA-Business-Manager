import { createClient } from "@/lib/supabase/server";
import { type InvoiceRow, type InvoiceLineRow } from "@/lib/derive";
import { InvoicesTable, type InvRow, type Payment } from "./invoices-table";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const [{ data: invoices }, { data: payments }, { data: lines }, { data: orders }, { data: suppliers }, { data: partners }] = await Promise.all([
    supabase.from("invoices").select("*").order("due", { ascending: true, nullsFirst: false }),
    supabase.from("invoice_payments").select("id, invoice_id, amount, payment_date, method, status, proof_kind, proof_url"),
    supabase.from("invoice_lines").select("*"),
    supabase.from("orders").select("id, title"),
    supabase.from("suppliers").select("name").order("name"),
    supabase.from("partners").select("name").order("name"),
  ]);

  const payByInvoice = new Map<string, Payment[]>();
  for (const p of (payments ?? []) as (Payment & { invoice_id: string })[]) {
    if (!payByInvoice.has(p.invoice_id)) payByInvoice.set(p.invoice_id, []);
    payByInvoice.get(p.invoice_id)!.push({ id: p.id, amount: p.amount, payment_date: p.payment_date, method: p.method, status: p.status, proof_kind: p.proof_kind, proof_url: p.proof_url });
  }
  const linesByInvoice = new Map<string, InvoiceLineRow[]>();
  for (const l of (lines ?? []) as InvoiceLineRow[]) {
    if (!linesByInvoice.has(l.invoice_id)) linesByInvoice.set(l.invoice_id, []);
    linesByInvoice.get(l.invoice_id)!.push(l);
  }
  const orderTitle = new Map(((orders ?? []) as { id: string; title: string }[]).map((o) => [o.id, o.title]));

  const rows: InvRow[] = ((invoices ?? []) as InvoiceRow[]).map((i) => ({
    ...i,
    orderTitle: i.order_id ? orderTitle.get(i.order_id) ?? null : null,
    payments: (payByInvoice.get(i.id) ?? []).sort((a, b) => (b.payment_date ?? "").localeCompare(a.payment_date ?? "")),
    lines: linesByInvoice.get(i.id) ?? [],
  }));

  const vendors = [
    ...((suppliers ?? []) as { name: string }[]).map((s) => s.name),
    ...((partners ?? []) as { name: string }[]).map((p) => p.name),
  ];

  return <InvoicesTable rows={rows} orders={(orders ?? []) as { id: string; title: string }[]} vendors={[...new Set(vendors)]} />;
}
