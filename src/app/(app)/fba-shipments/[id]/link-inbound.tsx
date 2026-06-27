"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { linkInbound } from "../actions";
import { Link2, Check } from "lucide-react";

export function LinkInboundCard({ inboundId, shipmentId, orderId, shipments, orders }: {
  inboundId: string; shipmentId: string | null; orderId: string | null;
  shipments: { id: string; label: string; order_id: string | null }[]; orders: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ship, setShip] = useState(shipmentId ?? "");
  const [order, setOrder] = useState(orderId ?? "");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // The order is OWNED by the freight shipment — when a shipment is chosen, the
  // order is derived from it (read-only). Only a shipment-less (direct-to-Amazon)
  // inbound needs a manual order pick.
  const shipOrder = ship ? (shipments.find((x) => x.id === ship)?.order_id ?? null) : null;
  const effOrder = ship ? shipOrder : (order || null);
  function save() {
    setErr(null); setSaved(false);
    start(async () => {
      const r = await linkInbound(inboundId, ship || null, effOrder);
      if (!r.ok) { setErr(r.error); return; }
      setSaved(true); router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-primary/12 text-primary"><Link2 className="h-4 w-4" /></span><div><div className="font-semibold">Link this inbound</div><p className="text-[11px] text-muted-foreground">Attach to a freight shipment — the order comes from it automatically. Pick an order directly only if there&apos;s no shipment.</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="vy-kicker mb-1 block">Freight shipment</span>
          <Select value={ship} onChange={setShip} placeholder="— none —" options={[{ value: "", label: "— none —" }, ...shipments.map((s) => ({ value: s.id, label: s.label }))]} />
        </label>
        <label className="block"><span className="vy-kicker mb-1 block">Order</span>
          {ship
            ? <div className="flex h-[38px] items-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 text-sm">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {shipOrder ? <span className="font-mono font-medium">{shipOrder}</span> : <span className="text-muted-foreground">Shipment has no order</span>}
                <Badge tone="muted" className="ml-auto">auto · from shipment</Badge>
              </div>
            : <Select value={order} onChange={setOrder} placeholder="— none —" options={[{ value: "", label: "— none —" }, ...orders.map((o) => ({ value: o.id, label: o.id, sub: o.title }))]} />}
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} disabled={pending || (!!ship && !shipOrder)} title={ship && !shipOrder ? "That shipment isn't tied to an order yet — linking would clear this inbound's order." : undefined} className="vy-btn vy-btn--primary vy-btn--sm inline-flex items-center gap-1.5 disabled:opacity-50">{saved ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />} {pending ? "Saving…" : saved ? "Linked" : "Save link"}</button>
        {err && <span className="text-[12px] text-danger">{err}</span>}
      </div>
    </Card>
  );
}
