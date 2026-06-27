import { createClient } from "@/lib/supabase/server";
import { type ShipmentRow } from "@/lib/derive";
import { ShipmentsTable, type ShipRow, type OrderOpt } from "./shipments-table";

export default async function ShipmentsPage() {
  const supabase = await createClient();
  const [{ data: shipments }, { data: orders }, { data: suppliers }, { data: partners }, { data: inbounds }, { data: tracking }] = await Promise.all([
    supabase.from("shipments").select("*").order("created_at", { ascending: false }),
    supabase.from("orders").select("id, title, supplier").order("placed_on", { ascending: false }),
    supabase.from("suppliers").select("name").order("name"),
    supabase.from("partners").select("name, type"),
    supabase.from("fba_inbounds").select("id, fc, expected, received, amazon_status, sku_count, shipment_id, order_id"),
    supabase.from("shipment_tracking").select("*"),
  ]);

  const trackById = new Map((tracking ?? []).map((t) => [t.shipment_id, t]));
  const inb = (inbounds ?? []) as { id: string; fc: string; expected: number; received: number; amazon_status: string; sku_count: number; shipment_id: string | null; order_id: string | null }[];

  const rows: ShipRow[] = ((shipments ?? []) as ShipmentRow[]).map((s) => {
    // FBA inbounds attached to this shipment (explicit link) or sharing its order
    const fba = inb.filter((i) => i.shipment_id === s.id || (!!s.order_id && i.order_id === s.order_id));
    const t = trackById.get(s.id);
    return {
      ...s,
      fba: fba.map((f) => ({ id: f.id, fc: f.fc, expected: f.expected, received: f.received, amazonStatus: f.amazon_status, skuCount: f.sku_count })),
      tracking: t ? { trackingNo: t.tracking_no, bookingRef: t.booking_ref, carrier: t.carrier, scac: t.scac, lastSync: t.last_sync, carrierCode: t.carrier_code } : null,
    };
  });

  // forwarders = logistics/freight partners (fallback: all partner names)
  const forwarders = ((partners ?? []) as { name: string; type: string }[])
    .filter((p) => /forward|freight|logistic|3pl|carrier/i.test(p.type)).map((p) => p.name);
  const orderOpts: OrderOpt[] = ((orders ?? []) as { id: string; title: string; supplier: string | null }[])
    .map((o) => ({ id: o.id, title: o.title, supplier: o.supplier }));

  return (
    <ShipmentsTable
      rows={rows}
      orders={orderOpts}
      suppliers={((suppliers ?? []) as { name: string }[]).map((s) => s.name)}
      forwarders={forwarders.length ? forwarders : ((partners ?? []) as { name: string }[]).map((p) => p.name)}
    />
  );
}
