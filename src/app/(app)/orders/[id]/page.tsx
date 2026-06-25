import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orderRollup, type InvoiceRow } from "@/lib/derive";
import { OrderShell } from "./order-shell";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  const [{ data: invoices }, { data: lines }, { data: variants }] = await Promise.all([
    supabase.from("invoices").select("*").eq("order_id", id).order("issued"),
    supabase.from("order_lines").select("*").eq("order_id", id).order("created_at"),
    supabase.from("product_variants").select("id, sku, name, last_cost_usd").order("sku"),
  ]);
  const r = orderRollup(id, (invoices ?? []) as InvoiceRow[]);

  return (
    <OrderShell
      order={order}
      invoices={(invoices ?? []) as InvoiceRow[]}
      lines={lines ?? []}
      variants={(variants ?? []) as { id: string; sku: string; name: string; last_cost_usd: number | null }[]}
      rollup={r}
    />
  );
}
