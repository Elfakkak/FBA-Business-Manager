// Fulfillment Inbound API (v0) — lists inbound FBA shipments and their per-SKU items.
// Reuses the LWA token + region host from sp-api.ts (modern SP-API, no SigV4).
import { getAccessToken, hostFor, type AmazonCreds } from "./sp-api";

// fba_status enum: ('Working','Shipped','In transit','Receiving','Closed','Problem')
export type FbaStatus = "Working" | "Shipped" | "In transit" | "Receiving" | "Closed" | "Problem";

const STATUS_MAP: Record<string, FbaStatus> = {
  WORKING: "Working", SHIPPED: "Shipped", IN_TRANSIT: "In transit", DELIVERED: "In transit",
  CHECKED_IN: "Receiving", RECEIVING: "Receiving", CLOSED: "Closed",
  CANCELLED: "Problem", DELETED: "Problem", ERROR: "Problem",
};
const ALL_STATUSES = "WORKING,SHIPPED,IN_TRANSIT,DELIVERED,CHECKED_IN,RECEIVING,CLOSED";

export type FbaInboundItem = { sellerSku: string; fnSku: string | null; quantityShipped: number; quantityReceived: number };
export type FbaInboundShipment = {
  shipmentId: string; shipmentName: string | null; fc: string; amazonStatus: FbaStatus;
  items: FbaInboundItem[]; expected: number; received: number; skuCount: number;
};

async function getJson(url: string, token: string) {
  const res = await fetch(url, { headers: { "x-amz-access-token": token, "Content-Type": "application/json" }, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.errors?.[0]?.message || `FBA Inbound request failed (HTTP ${res.status}).`);
  return json;
}

export async function fetchFbaInbounds(creds: AmazonCreds): Promise<FbaInboundShipment[]> {
  const token = await getAccessToken(creds);
  const host = hostFor(creds.region);
  const marketplace = creds.marketplace_id || "ATVPDKIKX0DER";

  // 1) list shipments (paginated; NextToken switches QueryType to NEXT_TOKEN)
  const raw: { ShipmentId: string; ShipmentName?: string; DestinationFulfillmentCenterId?: string; ShipmentStatus?: string }[] = [];
  let next: string | undefined;
  do {
    const qs = next
      ? new URLSearchParams({ QueryType: "NEXT_TOKEN", NextToken: next })
      : new URLSearchParams({ MarketplaceId: marketplace, QueryType: "SHIPMENT", ShipmentStatusList: ALL_STATUSES });
    const json = await getJson(`${host}/fba/inbound/v0/shipments?${qs}`, token);
    for (const s of json.payload?.ShipmentData ?? []) raw.push(s);
    next = json.pagination?.NextToken;
  } while (next);

  // 2) per-shipment items
  const shipments: FbaInboundShipment[] = [];
  for (const s of raw) {
    const items: FbaInboundItem[] = [];
    let itoken: string | undefined;
    do {
      const qs = new URLSearchParams({ MarketplaceId: marketplace });
      if (itoken) qs.set("NextToken", itoken);
      const json = await getJson(`${host}/fba/inbound/v0/shipments/${s.ShipmentId}/items?${qs}`, token);
      for (const it of json.payload?.ItemData ?? []) {
        items.push({ sellerSku: it.SellerSKU, fnSku: it.FulfillmentNetworkSKU ?? null, quantityShipped: it.QuantityShipped ?? 0, quantityReceived: it.QuantityReceived ?? 0 });
      }
      itoken = json.pagination?.NextToken;
    } while (itoken);

    shipments.push({
      shipmentId: s.ShipmentId,
      shipmentName: s.ShipmentName ?? null,
      fc: s.DestinationFulfillmentCenterId ?? "—",
      amazonStatus: STATUS_MAP[s.ShipmentStatus ?? ""] ?? "Problem",
      items,
      expected: items.reduce((n, i) => n + i.quantityShipped, 0),
      received: items.reduce((n, i) => n + i.quantityReceived, 0),
      skuCount: new Set(items.map((i) => i.sellerSku)).size,
    });
  }
  return shipments;
}
