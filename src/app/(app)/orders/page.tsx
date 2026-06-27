import { createClient } from "@/lib/supabase/server";
import { orderRollup, type InvoiceRow } from "@/lib/derive";
import { OrdersList, type OrderSummary } from "./orders-list";

export default async function OrdersPage() {
  const supabase = await createClient();
  const [{ data: orders }, { data: invoices }, { data: lines }, { data: suppliers }, { data: partners }] = await Promise.all([
    supabase.from("orders").select("*").order("placed_on", { ascending: false }),
    supabase.from("invoices").select("*"),
    supabase.from("order_lines").select("order_id, qty"),
    supabase.from("suppliers").select("name").order("name"),
    supabase.from("partners").select("name, type").eq("type", "Agent").order("name"),
  ]);

  const units = new Map<string, number>();
  const skus = new Map<string, number>();
  for (const l of lines ?? []) {
    units.set(l.order_id, (units.get(l.order_id) ?? 0) + (l.qty ?? 0));
    skus.set(l.order_id, (skus.get(l.order_id) ?? 0) + 1);
  }

  const rows: OrderSummary[] = (orders ?? []).map((o) => {
    const r = orderRollup(o.id, (invoices ?? []) as InvoiceRow[]);
    return {
      id: o.id, title: o.title, supplier: o.supplier, agent: o.agent,
      status: o.status, placedOn: o.placed_on, fbaEta: o.fba_eta, archived: o.archived,
      total: r.total, paid: r.paid, balance: r.balance, paidPct: r.paidPct,
      units: units.get(o.id) ?? 0, skuCount: skus.get(o.id) ?? 0,
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
