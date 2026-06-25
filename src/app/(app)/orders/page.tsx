import { createClient } from "@/lib/supabase/server";
import { orderRollup, type InvoiceRow } from "@/lib/derive";
import { OrdersList, type OrderSummary } from "./orders-list";

export default async function OrdersPage() {
  const supabase = await createClient();
  const [{ data: orders }, { data: invoices }, { data: suppliers }, { data: partners }] = await Promise.all([
    supabase.from("orders").select("*").order("placed_on", { ascending: false }),
    supabase.from("invoices").select("*"),
    supabase.from("suppliers").select("name").order("name"),
    supabase.from("partners").select("name, type").eq("type", "Agent").order("name"),
  ]);

  const rows: OrderSummary[] = (orders ?? []).map((o) => {
    const r = orderRollup(o.id, (invoices ?? []) as InvoiceRow[]);
    return {
      id: o.id, title: o.title, supplier: o.supplier, agent: o.agent,
      status: o.status, placedOn: o.placed_on, fbaEta: o.fba_eta,
      total: r.total, paid: r.paid, balance: r.balance, paidPct: r.paidPct,
    };
  });

  return (
    <OrdersList
      orders={rows}
      suppliers={(suppliers ?? []).map((s) => s.name)}
      agents={(partners ?? []).map((p) => p.name)}
    />
  );
}
