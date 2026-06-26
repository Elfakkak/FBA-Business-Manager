// 17TRACK Tracking API (v2.4) client — universal carrier tracking for the forwarder leg.
// Auth: header `17token: <api_key>`. All endpoints are POST with a JSON array body.
const BASE = "https://api.17track.net/track/v2.4";

export type Track17Event = { time: string | null; description: string; location: string; stage: string | null };
export type Track17Result = { status: string | null; subStatus: string | null; carrier: string | null; events: Track17Event[] };

// 17TRACK main status → our freight shipment_stage (null = leave stage unchanged).
export function map17ToStage(status: string | null, sub: string | null): string | null {
  if (/customs/i.test(sub ?? "")) return "Customs";
  switch (status) {
    case "InfoReceived": return "Booked";
    case "InTransit":
    case "AvailableForPickup":
    case "OutForDelivery": return "In transit";
    case "Delivered": return "Delivered";
    default: return null; // NotFound / Exception / DeliveryFailure / Expired
  }
}

import type { Tone } from "@/lib/derive";
export const STATUS17_TONE: Record<string, Tone> = {
  Delivered: "success", InTransit: "info", OutForDelivery: "info", AvailableForPickup: "info",
  InfoReceived: "muted", Exception: "danger", DeliveryFailure: "danger", Expired: "warning", NotFound: "muted",
};

async function post(apiKey: string, path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "17token": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.msg || `17TRACK request failed (HTTP ${res.status}).`);
  return json;
}

// Register a number (idempotent — "already registered" rejections are fine).
export async function track17Register(apiKey: string, number: string, carrier?: number) {
  await post(apiKey, "/register", [carrier ? { number, carrier } : { number }]);
}

// Pull the latest status + checkpoint events for a tracking number.
export async function track17Get(apiKey: string, number: string, carrier?: number): Promise<Track17Result | null> {
  const json = await post(apiKey, "/gettrackinfo", [carrier ? { number, carrier } : { number }]);
  const item = json?.data?.accepted?.[0];
  if (!item) return null;
  const ti = item.track_info ?? {};
  const providers = ti.tracking?.providers ?? ti.providers ?? [];
  const events: Track17Event[] = [];
  for (const p of providers) {
    for (const e of p.events ?? []) {
      events.push({ time: e.time_iso ?? null, description: e.description ?? "", location: e.location ?? "", stage: e.stage ?? null });
    }
  }
  // newest first
  events.sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""));
  const provName = providers[0]?.provider?.name ?? null;
  return {
    status: ti.latest_status?.status ?? null,
    subStatus: ti.latest_status?.sub_status ?? null,
    carrier: provName,
    events,
  };
}
