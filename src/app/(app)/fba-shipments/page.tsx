import { createClient } from "@/lib/supabase/server";
import { FbaShipmentsTable, type FbaRow } from "./fba-shipments-table";

export default async function FbaShipmentsPage() {
  const supabase = await createClient();
  const { data: inbounds } = await supabase
    .from("fba_inbounds")
    .select("id, fc, sku_count, expected, received, amazon_status, synced, eta, mode, shipment_id, order_id, fba_inbound_items(sku, fnsku, expected, received)")
    .order("synced", { ascending: false, nullsFirst: false });
  const { data: amazon } = await supabase.from("integrations").select("status, last_sync").eq("id", "amazon").maybeSingle();

  type Row = {
    id: string; fc: string; sku_count: number; expected: number; received: number; amazon_status: string;
    synced: string | null; eta: string | null; mode: string | null; shipment_id: string | null; order_id: string | null;
    fba_inbound_items: { sku: string; fnsku: string | null; expected: number; received: number }[];
  };
  const rows: FbaRow[] = ((inbounds ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    fc: r.fc,
    skuCount: r.sku_count,
    expected: r.expected,
    received: r.received,
    variance: r.received - r.expected,
    status: r.amazon_status,
    synced: r.synced,
    eta: r.eta,
    mode: r.mode,
    shipmentId: r.shipment_id,
    orderId: r.order_id,
    items: (r.fba_inbound_items ?? []).map((i) => ({ sku: i.sku, fnsku: i.fnsku, expected: i.expected, received: i.received })),
  }));

  return <FbaShipmentsTable rows={rows} amazonConnected={amazon?.status === "connected"} lastSync={amazon?.last_sync ?? null} />;
}
