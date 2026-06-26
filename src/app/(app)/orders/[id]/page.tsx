import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orderRollup, partnerVendorType, type InvoiceRow, type InvoiceLineRow, type OrderCostRow } from "@/lib/derive";
import { OrderShell, type OrderShipment, type OrderInbound } from "./order-shell";
import type { InvRow, Payment } from "../../invoices/invoices-table";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  const [{ data: invoices }, { data: lines }, { data: orderCosts }, { data: chargeTypes }, { data: variants }, { data: pkgItems }, { data: pkgMoves }, { data: shipments }, { data: inbounds }, { data: suppliers }, { data: partners }] = await Promise.all([
    supabase.from("invoices").select("*").eq("order_id", id).order("issued"),
    supabase.from("order_lines").select("*").eq("order_id", id).order("created_at"),
    supabase.from("order_costs").select("*").eq("order_id", id).order("position"),
    supabase.from("charge_types").select("id, label, owner").eq("archived", false).order("owner").order("label"),
    supabase.from("product_variants").select("id, sku, name, last_cost_usd").order("sku"),
    supabase.from("packaging_items").select("id, name, kind, unit_cost").order("name"),
    supabase.from("packaging_moves").select("id, item_id, qty").eq("order_id", id).eq("type", "consume"),
    supabase.from("shipments").select("id, mode, stage, forwarder, origin, destination, eta, packed").eq("order_id", id).order("created_at"),
    supabase.from("fba_inbounds").select("id, fc, expected, received, amazon_status, sku_count, shipment_id").eq("order_id", id),
    supabase.from("suppliers").select("name").order("name"),
    supabase.from("partners").select("name, specialty").order("name"),
  ]);
  const invList = (invoices ?? []) as InvoiceRow[];
  const r = orderRollup(id, invList);

  // Enrich this order's invoices with payments + itemized lines for the shared quick-view drawer.
  const invIds = invList.map((i) => i.id);
  const [{ data: pays }, { data: invLines }] = invIds.length
    ? await Promise.all([
        supabase.from("invoice_payments").select("id, invoice_id, amount, payment_date, method, status, proof_kind, proof_url").in("invoice_id", invIds),
        supabase.from("invoice_lines").select("*").in("invoice_id", invIds),
      ])
    : [{ data: [] }, { data: [] }];
  const payByInv = new Map<string, Payment[]>();
  for (const p of (pays ?? []) as (Payment & { invoice_id: string })[]) {
    if (!payByInv.has(p.invoice_id)) payByInv.set(p.invoice_id, []);
    payByInv.get(p.invoice_id)!.push({ id: p.id, amount: p.amount, payment_date: p.payment_date, method: p.method, status: p.status, proof_kind: p.proof_kind, proof_url: p.proof_url });
  }
  const lineByInv = new Map<string, InvoiceLineRow[]>();
  for (const l of (invLines ?? []) as InvoiceLineRow[]) {
    if (!lineByInv.has(l.invoice_id)) lineByInv.set(l.invoice_id, []);
    lineByInv.get(l.invoice_id)!.push(l);
  }
  const invoicesRich: InvRow[] = invList.map((i) => ({
    ...i,
    orderTitle: order.title ?? null,
    payments: (payByInv.get(i.id) ?? []).sort((a, b) => (b.payment_date ?? "").localeCompare(a.payment_date ?? "")),
    lines: lineByInv.get(i.id) ?? [],
  }));
  const vendorMap = new Map<string, string>();
  for (const s of (suppliers ?? []) as { name: string }[]) if (!vendorMap.has(s.name)) vendorMap.set(s.name, "Supplier");
  for (const p of (partners ?? []) as { name: string; specialty: string | null }[]) if (!vendorMap.has(p.name)) vendorMap.set(p.name, partnerVendorType(p.specialty));
  const vendors = [...vendorMap].map(([name, type]) => ({ name, type }));
  // packaging consumed by this order, joined to item names/costs
  const pkgById = new Map(((pkgItems ?? []) as { id: string; name: string; unit_cost: number }[]).map((p) => [p.id, p]));
  const packaging = ((pkgMoves ?? []) as { id: string; item_id: string; qty: number }[]).map((m) => {
    const it = pkgById.get(m.item_id);
    return { moveId: m.id, itemId: m.item_id, name: it?.name ?? m.item_id, qty: m.qty, unitCost: it?.unit_cost ?? 0 };
  });

  return (
    <OrderShell
      order={order}
      invoices={invoicesRich}
      vendors={vendors}
      lines={lines ?? []}
      costs={(orderCosts ?? []) as OrderCostRow[]}
      chargeTypes={(chargeTypes ?? []) as { id: string; label: string; owner: string }[]}
      variants={(variants ?? []) as { id: string; sku: string; name: string; last_cost_usd: number | null }[]}
      packagingItems={(pkgItems ?? []) as { id: string; name: string; kind: string; unit_cost: number }[]}
      packaging={packaging}
      shipments={(shipments ?? []) as OrderShipment[]}
      inbounds={(inbounds ?? []) as OrderInbound[]}
      rollup={r}
      initialTab={tab ?? "overview"}
    />
  );
}
