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
  const [{ data: invoices }, { data: lines }, { data: orderCosts }, { data: chargeTypes }, { data: variants }, { data: products }, { data: pkgItems }, { data: pkgMoves }, { data: shipments }, { data: inbounds }, { data: suppliers }, { data: partners }, { data: brand }, { data: orderFiles }, { data: allMoves }, { data: inspection }] = await Promise.all([
    supabase.from("invoices").select("*").eq("order_id", id).order("issued"),
    supabase.from("order_lines").select("*").eq("order_id", id).order("created_at"),
    supabase.from("order_costs").select("*").eq("order_id", id).order("position").order("created_at"),
    supabase.from("charge_types").select("id, label, owner").eq("archived", false).order("owner").order("label"),
    supabase.from("product_variants").select("id, family_id, sku, asin, name, pack, last_cost_usd, last_cost_rmb, sale_price, has_image, fba_stock, reorder_point, status").order("sku"),
    supabase.from("products").select("id, parent, last_ordered"),
    supabase.from("packaging_items").select("id, name, kind, unit_cost").order("name"),
    supabase.from("packaging_moves").select("id, item_id, qty").eq("order_id", id).eq("type", "consume"),
    supabase.from("shipments").select("id, mode, stage, forwarder, incoterm, origin, destination, etd, eta, cbm, gross_kg, net_kg, cartons, packed, freight_usd, bol, customs").eq("order_id", id).order("created_at"),
    supabase.from("fba_inbounds").select("id, fc, expected, received, amazon_status, sku_count, shipment_id, eta, synced").eq("order_id", id),
    supabase.from("suppliers").select("name").order("name"),
    supabase.from("partners").select("name, specialty").order("name"),
    supabase.from("brand").select("name").maybeSingle(),
    supabase.from("order_files").select("slot, name, url").eq("order_id", id),
    supabase.from("packaging_moves").select("item_id, qty, type"),
    supabase.from("order_inspections").select("*").eq("order_id", id).maybeSingle(),
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

  // catalog variants for the Add SKUs browser — enriched with their product/family name
  const prodList = (products ?? []) as { id: string; parent: string | null; last_ordered: string | null }[];
  const familyName = new Map(prodList.map((p) => [p.id, p.parent ?? ""]));
  const familyLast = new Map(prodList.map((p) => [p.id, p.last_ordered]));
  type V = { id: string; family_id: string | null; sku: string; asin: string | null; name: string; pack: string | null; last_cost_usd: number | null; last_cost_rmb: number | null; sale_price: number | null; has_image: boolean | null; fba_stock: number | null; reorder_point: number | null; status: string | null };
  const catalogVariants = ((variants ?? []) as V[]).map((v) => ({
    id: v.id, sku: v.sku, asin: v.asin, name: v.name, pack: v.pack,
    familyName: (v.family_id && familyName.get(v.family_id)) || v.name,
    familyLastOrdered: (v.family_id && familyLast.get(v.family_id)) || null,
    last_cost_usd: v.last_cost_usd, last_cost_rmb: v.last_cost_rmb, sale_price: v.sale_price, has_image: !!v.has_image,
    fba_stock: v.fba_stock, reorder_point: v.reorder_point, status: v.status,
  }));

  // packaging on-hand (global inventory the order draws from): net of all moves
  const onHand = new Map<string, number>();
  for (const m of (allMoves ?? []) as { item_id: string; qty: number; type: string }[]) {
    onHand.set(m.item_id, (onHand.get(m.item_id) ?? 0) + (m.type === "consume" ? -1 : 1) * (m.qty ?? 0));
  }
  const packagingOnHand = ((pkgItems ?? []) as { id: string; name: string; kind: string; unit_cost: number }[])
    .map((it) => ({ id: it.id, name: it.name, kind: it.kind, unitCost: it.unit_cost, onHand: onHand.get(it.id) ?? 0 }))
    .filter((x) => x.onHand > 0);

  // packaging consumed by this order, joined to item names/costs
  const pkgById = new Map(((pkgItems ?? []) as { id: string; name: string; unit_cost: number }[]).map((p) => [p.id, p]));
  const packaging = ((pkgMoves ?? []) as { id: string; item_id: string; qty: number }[]).map((m) => {
    const it = pkgById.get(m.item_id);
    return { moveId: m.id, itemId: m.item_id, name: it?.name ?? m.item_id, qty: m.qty, unitCost: it?.unit_cost ?? 0 };
  });

  // Shipping: per-shipment packing lines, files & tracking for this order's shipments
  const shipIds = ((shipments ?? []) as { id: string }[]).map((s) => s.id);
  const [{ data: packLines }, { data: shipFiles }, { data: shipTracking }] = shipIds.length
    ? await Promise.all([
        supabase.from("shipment_packing_lines").select("id, shipment_id, sku, product_name, cartons, per_ctn, packed, fc").in("shipment_id", shipIds).order("position"),
        supabase.from("shipment_files").select("id, shipment_id, slot, url, name").in("shipment_id", shipIds),
        supabase.from("shipment_tracking").select("shipment_id, tracking_no, eta_override").in("shipment_id", shipIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const fwd = [...new Set(((partners ?? []) as { name: string; specialty: string | null }[]).filter((p) => /forward|freight|logistic|3pl|carrier|ship/i.test(p.specialty ?? "")).map((p) => p.name))];
  const forwarders = fwd.length ? fwd : ((partners ?? []) as { name: string }[]).map((p) => p.name);
  const freightInv = invoicesRich.find((i) => i.vendor_type === "Forwarder");
  const freightInvoice = freightInv ? { id: freightInv.id, total: freightInv.total ?? 0, paid: freightInv.paid ?? 0 } : null;
  const orderedShip = ((lines ?? []) as { sku: string | null; product_name: string | null; qty: number }[]).map((l) => ({ sku: l.sku, product_name: l.product_name, qty: l.qty ?? 0 }));

  return (
    <OrderShell
      order={order}
      invoices={invoicesRich}
      vendors={vendors}
      lines={lines ?? []}
      costs={(orderCosts ?? []) as OrderCostRow[]}
      chargeTypes={(chargeTypes ?? []) as { id: string; label: string; owner: string }[]}
      companyName={(brand as { name: string } | null)?.name ?? "Your Company"}
      orderFiles={(orderFiles ?? []) as { slot: string; name: string | null; url: string }[]}
      packagingOnHand={packagingOnHand}
      variants={catalogVariants}
      packagingItems={(pkgItems ?? []) as { id: string; name: string; kind: string; unit_cost: number }[]}
      packaging={packaging}
      shipments={(shipments ?? []) as OrderShipment[]}
      inbounds={(inbounds ?? []) as OrderInbound[]}
      packLines={(packLines ?? []) as never}
      shipFiles={(shipFiles ?? []) as never}
      shipTracking={(shipTracking ?? []) as never}
      forwarders={forwarders}
      freightInvoice={freightInvoice}
      ordered={orderedShip}
      inspection={inspection ?? null}
      rollup={r}
      initialTab={tab ?? "overview"}
    />
  );
}
