// Fulfillment Inbound API (2024-03-20) — the "Send to Amazon" (STA) workflow.
// The legacy v0 getShipments only returns pre-STA shipments (all old/cancelled), so we
// read live inbound plans → placement options → shipments → items here instead.
// Reuses the LWA token + region host from sp-api.ts (modern SP-API, no SigV4).
import { getAccessToken, hostFor, type AmazonCreds } from "./sp-api";

// fba_status enum: ('Working','Shipped','In transit','Receiving','Closed','Problem')
export type FbaStatus = "Working" | "Shipped" | "In transit" | "Receiving" | "Closed" | "Problem";

const STATUS_MAP: Record<string, FbaStatus> = {
  WORKING: "Working", READY_TO_SHIP: "Working",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In transit", DELIVERED: "In transit",
  CHECKED_IN: "Receiving", RECEIVING: "Receiving",
  CLOSED: "Closed",
  CANCELLED: "Problem", DELETED: "Problem", ERROR: "Problem", VOIDED: "Problem",
};

export type FbaInboundItem = { sellerSku: string; fnSku: string | null; quantityShipped: number; quantityReceived: number };
export type FbaInboundShipment = {
  shipmentId: string; shipmentName: string | null; fc: string; amazonStatus: FbaStatus;
  items: FbaInboundItem[]; expected: number; received: number; skuCount: number;
};

const IB = "/inbound/fba/2024-03-20";

async function getJson(url: string, token: string) {
  const res = await fetch(url, { headers: { "x-amz-access-token": token, "Content-Type": "application/json" }, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.errors?.[0]?.message || `FBA Inbound request failed (HTTP ${res.status}).`);
  return json;
}

export async function fetchFbaInbounds(creds: AmazonCreds): Promise<FbaInboundShipment[]> {
  const token = await getAccessToken(creds);
  const host = hostFor(creds.region);

  // 1) list all inbound plans (paginated)
  const plans: { inboundPlanId: string; name?: string }[] = [];
  let next: string | undefined;
  do {
    const qs = new URLSearchParams({ pageSize: "30" });
    if (next) qs.set("paginationToken", next);
    const json = await getJson(`${host}${IB}/inboundPlans?${qs}`, token);
    for (const p of json.inboundPlans ?? []) plans.push(p);
    next = json.pagination?.paginationToken;
  } while (next);

  // 2) each plan's confirmed (ACCEPTED) placement option exposes the real shipment ids
  const shipments: FbaInboundShipment[] = [];
  const seen = new Set<string>();
  for (const plan of plans) {
    const shipmentIds: string[] = [];
    let pnext: string | undefined;
    do {
      const qs = new URLSearchParams({ pageSize: "20" });
      if (pnext) qs.set("paginationToken", pnext);
      const json = await getJson(`${host}${IB}/inboundPlans/${plan.inboundPlanId}/placementOptions?${qs}`, token);
      for (const opt of json.placementOptions ?? []) {
        if (opt.status === "ACCEPTED") for (const sid of opt.shipmentIds ?? []) shipmentIds.push(sid);
      }
      pnext = json.pagination?.paginationToken;
    } while (pnext);

    for (const sid of shipmentIds) {
      if (seen.has(sid)) continue;
      seen.add(sid);
      const s = await getJson(`${host}${IB}/inboundPlans/${plan.inboundPlanId}/shipments/${sid}`, token);

      // items (paginated)
      const items: FbaInboundItem[] = [];
      let inext: string | undefined;
      do {
        const qs = new URLSearchParams({ pageSize: "100" });
        if (inext) qs.set("paginationToken", inext);
        const json = await getJson(`${host}${IB}/inboundPlans/${plan.inboundPlanId}/shipments/${sid}/items?${qs}`, token);
        for (const it of json.items ?? []) {
          items.push({
            sellerSku: it.msku,
            fnSku: it.fnsku ?? null,
            quantityShipped: it.quantity ?? 0,
            quantityReceived: it.receivedQuantity?.amount ?? 0,
          });
        }
        inext = json.pagination?.paginationToken;
      } while (inext);

      shipments.push({
        shipmentId: s.shipmentConfirmationId || sid, // FBA… ref shown in Seller Central
        shipmentName: s.name ?? plan.name ?? null,
        fc: s.destination?.warehouseId ?? "—",
        amazonStatus: STATUS_MAP[s.status ?? ""] ?? "Problem",
        items,
        expected: items.reduce((n, i) => n + i.quantityShipped, 0),
        received: items.reduce((n, i) => n + i.quantityReceived, 0),
        skuCount: new Set(items.map((i) => i.sellerSku)).size,
      });
    }
  }
  return shipments;
}
