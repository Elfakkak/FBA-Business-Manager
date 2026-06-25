import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orderRollup, type InvoiceRow } from "@/lib/derive";
import { OrderShell } from "./order-shell";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  const { data: invoices } = await supabase.from("invoices").select("*").eq("order_id", id).order("issued");
  const r = orderRollup(id, (invoices ?? []) as InvoiceRow[]);

  return <OrderShell order={order} invoices={(invoices ?? []) as InvoiceRow[]} rollup={r} />;
}
