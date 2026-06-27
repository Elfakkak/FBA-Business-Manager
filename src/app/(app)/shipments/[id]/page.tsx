import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type ShipmentRow } from "@/lib/derive";
import { ShipmentDetail } from "./shipment-detail";
import type { ShipRow, OrderOpt } from "../shipments-table";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: shipment } = await supabase.from("shipments").select("*").eq("id", id).maybeSingle();
  if (!shipment) notFound();
  const s = shipment as ShipmentRow;

  const [{ data: inbounds }, { data: track }, { data: intg }, { data: orders }, { data: suppliers }, { data: partners }] = await Promise.all([
    supabase.from("fba_inbounds").select("id, fc, expected, received, amazon_status, sku_count, shipment_id, order_id"),
    supabase.from("shipment_tracking").select("*").eq("shipment_id", id).maybeSingle(),
    supabase.from("integrations").select("status").eq("id", "track17").maybeSingle(),
    supabase.from("orders").select("id, title, supplier").order("placed_on", { ascending: false }),
    supabase.from("suppliers").select("name").order("name"),
    supabase.from("partners").select("name, type"),
  ]);

  const inb = (inbounds ?? []) as { id: string; fc: string; expected: number; received: number; amazon_status: string; sku_count: number; shipment_id: string | null; order_id: string | null }[];
  const fba = inb.filter((i) => i.shipment_id === id || (!!s.order_id && i.order_id === s.order_id))
    .map((f) => ({ id: f.id, fc: f.fc, expected: f.expected, received: f.received, amazonStatus: f.amazon_status, skuCount: f.sku_count }));

  const row: ShipRow = {
    ...s,
    fba,
    tracking: track ? { trackingNo: track.tracking_no, bookingRef: track.booking_ref, carrier: track.carrier, scac: track.scac, lastSync: track.last_sync, carrierCode: track.carrier_code } : null,
  };
  const checkpoints = ((track?.checkpoints ?? []) as { time: string | null; description: string; location: string; stage: string | null }[]) || [];
  const liveStatus = track?.status ?? null;

  const orderOpts: OrderOpt[] = ((orders ?? []) as { id: string; title: string; supplier: string | null }[]).map((o) => ({ id: o.id, title: o.title, supplier: o.supplier }));
  const forwarders = ((partners ?? []) as { name: string; type: string }[]).filter((p) => /forward|freight|logistic|3pl|carrier/i.test(p.type)).map((p) => p.name);

  return (
    <ShipmentDetail
      row={row}
      checkpoints={checkpoints}
      liveStatus={liveStatus}
      track17Connected={intg?.status === "connected"}
      orders={orderOpts}
      suppliers={((suppliers ?? []) as { name: string }[]).map((x) => x.name)}
      forwarders={forwarders.length ? forwarders : ((partners ?? []) as { name: string }[]).map((p) => p.name)}
    />
  );
}
