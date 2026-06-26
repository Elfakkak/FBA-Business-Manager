import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orderRollup, type InvoiceRow } from "@/lib/derive";
import { OrderShell, type OrderShipment, type OrderInbound } from "./order-shell";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  const [{ data: invoices }, { data: lines }, { data: variants }, { data: pkgItems }, { data: pkgMoves }, { data: shipments }, { data: inbounds }] = await Promise.all([
    supabase.from("invoices").select("*").eq("order_id", id).order("issued"),
    supabase.from("order_lines").select("*").eq("order_id", id).order("created_at"),
    supabase.from("product_variants").select("id, sku, name, last_cost_usd").order("sku"),
    supabase.from("packaging_items").select("id, name, kind, unit_cost").order("name"),
    supabase.from("packaging_moves").select("id, item_id, qty").eq("order_id", id).eq("type", "consume"),
    supabase.from("shipments").select("id, mode, stage, forwarder, origin, destination, eta, packed").eq("order_id", id).order("created_at"),
    supabase.from("fba_inbounds").select("id, fc, expected, received, amazon_status, sku_count, shipment_id").eq("order_id", id),
  ]);
  const r = orderRollup(id, (invoices ?? []) as InvoiceRow[]);
  // packaging consumed by this order, joined to item names/costs
  const pkgById = new Map(((pkgItems ?? []) as { id: string; name: string; unit_cost: number }[]).map((p) => [p.id, p]));
  const packaging = ((pkgMoves ?? []) as { id: string; item_id: string; qty: number }[]).map((m) => {
    const it = pkgById.get(m.item_id);
    return { moveId: m.id, itemId: m.item_id, name: it?.name ?? m.item_id, qty: m.qty, unitCost: it?.unit_cost ?? 0 };
  });

  return (
    <OrderShell
      order={order}
      invoices={(invoices ?? []) as InvoiceRow[]}
      lines={lines ?? []}
      variants={(variants ?? []) as { id: string; sku: string; name: string; last_cost_usd: number | null }[]}
      packagingItems={(pkgItems ?? []) as { id: string; name: string; kind: string; unit_cost: number }[]}
      packaging={packaging}
      shipments={(shipments ?? []) as OrderShipment[]}
      inbounds={(inbounds ?? []) as OrderInbound[]}
      rollup={r}
    />
  );
}
