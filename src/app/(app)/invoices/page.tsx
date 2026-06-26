import { createClient } from "@/lib/supabase/server";
import { type InvoiceRow } from "@/lib/derive";
import { InvoicesTable, type InvRow, type Payment } from "./invoices-table";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const [{ data: invoices }, { data: payments }, { data: orders }, { data: suppliers }, { data: partners }] = await Promise.all([
    supabase.from("invoices").select("*").order("due", { ascending: true, nullsFirst: false }),
    supabase.from("invoice_payments").select("id, invoice_id, amount, payment_date, method, status"),
    supabase.from("orders").select("id, title"),
    supabase.from("suppliers").select("name").order("name"),
    supabase.from("partners").select("name").order("name"),
  ]);

  const payByInvoice = new Map<string, Payment[]>();
  for (const p of (payments ?? []) as (Payment & { invoice_id: string })[]) {
    if (!payByInvoice.has(p.invoice_id)) payByInvoice.set(p.invoice_id, []);
    payByInvoice.get(p.invoice_id)!.push({ id: p.id, amount: p.amount, payment_date: p.payment_date, method: p.method, status: p.status });
  }
  const orderTitle = new Map(((orders ?? []) as { id: string; title: string }[]).map((o) => [o.id, o.title]));

  const rows: InvRow[] = ((invoices ?? []) as InvoiceRow[]).map((i) => ({
    ...i,
    orderTitle: i.order_id ? orderTitle.get(i.order_id) ?? null : null,
    payments: (payByInvoice.get(i.id) ?? []).sort((a, b) => (b.payment_date ?? "").localeCompare(a.payment_date ?? "")),
  }));

  const vendors = [
    ...((suppliers ?? []) as { name: string }[]).map((s) => s.name),
    ...((partners ?? []) as { name: string }[]).map((p) => p.name),
  ];

  return <InvoicesTable rows={rows} orders={(orders ?? []) as { id: string; title: string }[]} vendors={[...new Set(vendors)]} />;
}
