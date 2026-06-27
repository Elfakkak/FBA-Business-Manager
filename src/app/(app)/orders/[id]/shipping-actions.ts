"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { SHIPMENT_STAGES, ORDER_PIPELINE } from "@/lib/derive";

type Result = { ok: true; id?: string } | { ok: false; error: string };
type Stage = Database["public"]["Enums"]["shipment_stage"];
type OrderStatus = Database["public"]["Enums"]["order_status"];
type SB = Awaited<ReturnType<typeof createClient>>;
const STAGES = SHIPMENT_STAGES as readonly Stage[];

function rev(orderId: string, shipmentId?: string) {
  revalidatePath(`/orders/${orderId}`); revalidatePath("/orders"); revalidatePath("/shipments");
  if (shipmentId) revalidatePath(`/shipments/${shipmentId}`);
}

// Advance the order forward only (never backward).
async function advanceOrder(supabase: SB, orderId: string, target: string) {
  const { data: o } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
  if (!o) return;
  const idx = (k: string) => ORDER_PIPELINE.findIndex((s) => s.key === k);
  if (idx(target) > idx(o.status)) await supabase.from("orders").update({ status: target as OrderStatus }).eq("id", orderId);
}

export type ShipFields = { mode: string; forwarder: string | null; incoterm: string | null; origin: string | null; destination: string | null; etd: string | null; eta: string | null; freight_usd: number | null; bol: string | null };

export async function bookOrderShipment(orderId: string, orderTitle: string | null, f: ShipFields): Promise<Result> {
  const supabase = await createClient();
  if (!f.mode?.trim()) return { ok: false, error: "Mode is required." };
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const id = `SHP-${yymm}-${(Date.now() % 1000).toString().padStart(3, "0")}`;
  const { error } = await supabase.from("shipments").insert({ id, order_id: orderId, order_title: orderTitle, stage: "Draft", ...f });
  if (error) return { ok: false, error: error.message };
  rev(orderId, id);
  return { ok: true, id };
}

export async function updateOrderShipment(id: string, orderId: string, f: Partial<ShipFields>): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("shipments").update(f).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rev(orderId, id);
  return { ok: true, id };
}

export async function advanceOrderShipmentStage(id: string, orderId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: s } = await supabase.from("shipments").select("stage").eq("id", id).maybeSingle();
  if (!s) return { ok: false, error: "Shipment not found." };
  const idx = STAGES.indexOf(s.stage as Stage);
  if (idx >= 0 && idx < STAGES.length - 1) {
    const next = STAGES[idx + 1];
    await supabase.from("shipments").update({ stage: next }).eq("id", id);
    if (next === "Delivered" || next === "At FBA") await advanceOrder(supabase, orderId, "fba");
  }
  rev(orderId, id);
  return { ok: true, id };
}

export type PackingLineInput = { sku: string | null; product_name: string | null; cartons: number; per_ctn: number; fc: string | null };
export async function savePackingList(shipmentId: string, orderId: string, data: { cbm: number | null; gross_kg: number | null; net_kg: number | null; lines: PackingLineInput[] }): Promise<Result> {
  const supabase = await createClient();
  await supabase.from("shipment_packing_lines").delete().eq("shipment_id", shipmentId);
  const rows = data.lines.filter((l) => l.sku || l.product_name).map((l, i) => ({
    shipment_id: shipmentId, sku: l.sku, product_name: l.product_name,
    cartons: l.cartons || 0, per_ctn: l.per_ctn || 0, packed: (l.cartons || 0) * (l.per_ctn || 0), fc: l.fc, position: i,
  }));
  if (rows.length) { const { error } = await supabase.from("shipment_packing_lines").insert(rows); if (error) return { ok: false, error: error.message }; }
  const totalPacked = rows.reduce((s, r) => s + r.packed, 0);
  const totalCartons = rows.reduce((s, r) => s + r.cartons, 0);
  const { data: sh } = await supabase.from("shipments").select("stage").eq("id", shipmentId).maybeSingle();
  const stagePatch = sh?.stage === "Draft" ? { stage: "Booked" as Stage } : {};
  await supabase.from("shipments").update({ cbm: data.cbm, gross_kg: data.gross_kg, net_kg: data.net_kg, cartons: totalCartons, packed: totalPacked, ...stagePatch }).eq("id", shipmentId);
  rev(orderId, shipmentId);
  return { ok: true };
}

export async function linkFbaInbound(orderId: string, shipmentId: string, f: { fc: string; expected: number; mode: string | null }): Promise<Result> {
  const supabase = await createClient();
  if (!f.fc?.trim()) return { ok: false, error: "FC is required." };
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const id = `FBA-${yymm}-${(Date.now() % 1000).toString().padStart(3, "0")}`;
  const { error } = await supabase.from("fba_inbounds").insert({ id, order_id: orderId, shipment_id: shipmentId, fc: f.fc.trim(), expected: f.expected || 0, received: 0, amazon_status: "Working", sku_count: 0, mode: f.mode });
  if (error) return { ok: false, error: error.message };
  rev(orderId, shipmentId);
  return { ok: true, id };
}

export async function updateFbaReceived(inboundId: string, orderId: string, received: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("fba_inbounds").update({ received: Math.max(0, received) }).eq("id", inboundId);
  if (error) return { ok: false, error: error.message };
  const { data: inbs } = await supabase.from("fba_inbounds").select("expected, received").eq("order_id", orderId);
  const all = (inbs ?? []) as { expected: number; received: number }[];
  if (all.length > 0 && all.every((i) => i.expected > 0 && i.received >= i.expected)) await advanceOrder(supabase, orderId, "fba");
  rev(orderId);
  return { ok: true };
}

export async function saveShipmentFile(shipmentId: string, orderId: string, slot: string, url: string, name: string): Promise<Result> {
  const supabase = await createClient();
  await supabase.from("shipment_files").delete().eq("shipment_id", shipmentId).eq("slot", slot);
  const { error } = await supabase.from("shipment_files").insert({ shipment_id: shipmentId, slot, url, name });
  if (error) return { ok: false, error: error.message };
  rev(orderId, shipmentId);
  return { ok: true };
}

export async function pasteTrackingUpdate(shipmentId: string, orderId: string, trackingNo: string | null, eta: string | null): Promise<Result> {
  const supabase = await createClient();
  const { data: ex } = await supabase.from("shipment_tracking").select("shipment_id").eq("shipment_id", shipmentId).maybeSingle();
  if (ex) await supabase.from("shipment_tracking").update({ tracking_no: trackingNo, eta_override: eta }).eq("shipment_id", shipmentId);
  else await supabase.from("shipment_tracking").insert({ shipment_id: shipmentId, tracking_no: trackingNo, eta_override: eta });
  if (eta) await supabase.from("shipments").update({ eta }).eq("id", shipmentId);
  rev(orderId, shipmentId);
  return { ok: true };
}

export async function deleteOrderShipment(id: string, orderId: string): Promise<Result> {
  const supabase = await createClient();
  const { count } = await supabase.from("fba_inbounds").select("id", { count: "exact", head: true }).eq("shipment_id", id);
  if (count && count > 0) return { ok: false, error: `${count} FBA inbound(s) linked — unlink first.` };
  const { error } = await supabase.from("shipments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  rev(orderId, id);
  return { ok: true };
}
