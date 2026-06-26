"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/primitives";
import { inputCls } from "@/components/ui/modal";
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

  function onShip(v: string) {
    setShip(v);
    // auto-fill order from the chosen freight shipment when order is empty
    const s = shipments.find((x) => x.id === v);
    if (v && s?.order_id && !order) setOrder(s.order_id);
  }
  function save() {
    setErr(null); setSaved(false);
    start(async () => {
      const r = await linkInbound(inboundId, ship || null, order || null);
      if (!r.ok) { setErr(r.error); return; }
      setSaved(true); router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-primary/12 text-primary"><Link2 className="h-4 w-4" /></span><div><div className="font-semibold">Link this inbound</div><p className="text-[11px] text-muted-foreground">Attach to its freight shipment + order so it shows on those pages.</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="vy-kicker mb-1 block">Freight shipment</span>
          <select value={ship} onChange={(e) => onShip(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {shipments.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="block"><span className="vy-kicker mb-1 block">Order</span>
          <select value={order} onChange={(e) => setOrder(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.title}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} disabled={pending} className="vy-btn vy-btn--primary vy-btn--sm inline-flex items-center gap-1.5">{saved ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />} {pending ? "Saving…" : saved ? "Linked" : "Save link"}</button>
        {err && <span className="text-[12px] text-danger">{err}</span>}
      </div>
    </Card>
  );
}
