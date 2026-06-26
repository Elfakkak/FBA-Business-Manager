"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

// Attach an Amazon inbound to its physical freight shipment and/or order.
// Linking to a freight shipment inherits that shipment's order when none is set.
export async function linkInbound(inboundId: string, shipmentId: string | null, orderId: string | null): Promise<Result> {
  const supabase = await createClient();
  let order = orderId;
  if (shipmentId && !order) {
    const { data: s } = await supabase.from("shipments").select("order_id").eq("id", shipmentId).maybeSingle();
    order = s?.order_id ?? null;
  }
  const { error } = await supabase.from("fba_inbounds").update({ shipment_id: shipmentId, order_id: order }).eq("id", inboundId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/fba-shipments");
  revalidatePath(`/fba-shipments/${inboundId}`);
  if (shipmentId) revalidatePath(`/shipments/${shipmentId}`);
  if (order) revalidatePath(`/orders/${order}`);
  return { ok: true };
}
