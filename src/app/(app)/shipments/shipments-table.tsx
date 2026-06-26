"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead, SourceTag, CardHeader } from "@/components/ui/primitives";
import { Drawer, DrawerStat } from "@/components/ui/drawer";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { num, money, type ShipmentRow, SHIPMENT_STAGES, SHIPMENT_STAGE_TONE, CUSTOMS_TONE, SHIPMENT_MOVING, type Tone } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { createShipment, updateShipment, deleteShipment, updateTracking } from "./actions";
import { Ship, Route, Boxes, PackageCheck, DollarSign, Plus, ArrowUpRight, Pencil, Trash2, Link as LinkIcon, Check } from "lucide-react";

type FbaLink = { id: string; fc: string; expected: number; received: number; amazonStatus: string; skuCount: number };
export type ShipRow = ShipmentRow & {
  fba: FbaLink[];
  tracking: { trackingNo: string | null; bookingRef: string | null; carrier: string | null; scac: string | null; lastSync: string | null } | null;
};
export type OrderOpt = { id: string; title: string; supplier: string | null };

const MODES = ["Sea LCL", "Sea FCL", "Air", "Express", "Courier", "Truck"];
const INCOTERMS = ["EXW", "FOB", "FCA", "CIF", "CFR", "DDP", "DAP"];
const FBA_TONE: Record<string, Tone> = { Working: "muted", Shipped: "info", "In transit": "info", Receiving: "warning", Closed: "success", Problem: "danger" };
const STAGE_CHIPS = ["All", ...SHIPMENT_STAGES];

export function ShipmentsTable({ rows, orders, suppliers, forwarders }: { rows: ShipRow[]; orders: OrderOpt[]; suppliers: string[]; forwarders: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("All");
  const [forwarder, setForwarder] = useState("All");
  const [stage, setStage] = useState("All");
  const [peek, setPeek] = useState<ShipRow | null>(null);
  const [modal, setModal] = useState<"new" | null>(null);
  const [editing, setEditing] = useState<ShipRow | null>(null);
  const [trackingFor, setTrackingFor] = useState<ShipRow | null>(null);

  const modes = ["All", ...new Set(rows.map((r) => r.mode))];
  const fwds = ["All", ...new Set(rows.map((r) => r.forwarder).filter(Boolean) as string[])];

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((s) => {
      if (mode !== "All" && s.mode !== mode) return false;
      if (forwarder !== "All" && s.forwarder !== forwarder) return false;
      if (stage !== "All" && s.stage !== stage) return false;
      if (n && ![s.id, s.order_id, s.order_title, s.supplier, s.forwarder, s.bol, s.origin, s.destination].filter(Boolean).join(" ").toLowerCase().includes(n)) return false;
      return true;
    });
  }, [rows, q, mode, forwarder, stage]);

  // rollups
  const onWater = rows.filter((s) => s.stage === "In transit" || s.stage === "Customs").length;
  const packed = rows.reduce((n, s) => n + (s.packed || 0), 0);
  const shipped = rows.filter((s) => SHIPMENT_MOVING.includes(s.stage)).reduce((n, s) => n + (s.packed || 0), 0);
  const received = rows.reduce((n, s) => n + s.fba.reduce((a, f) => a + f.received, 0), 0);
  const freightTotal = rows.reduce((n, s) => n + (s.freight_usd || 0), 0);
  const funnelMax = Math.max(1, packed);
  const funnel = [
    { label: "Packed", value: packed, source: "manual", hint: "Into shipments", info: false },
    { label: "Shipped", value: shipped, source: "manual", hint: "Left origin", info: false },
    { label: "Received", value: received, source: "amazon", hint: "Booked at FBA", info: true },
  ];

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Operations"
        title="Shipments"
        sub="Physical freight movements across every order — mode, forwarder, customs and packing. The Amazon inbounds each shipment spawns live in FBA Shipments."
        actions={
          <>
            <button className="vy-btn vy-btn--ghost inline-flex items-center gap-1.5"><ArrowUpRight className="h-4 w-4" /> Export</button>
            <button onClick={() => setModal("new")} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> New shipment</button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Shipments" value={num(rows.length)} sub="in motion" icon={Ship} />
        <Kpi label="On the water" value={num(onWater)} sub="in transit / customs" icon={Route} tone="info" />
        <Kpi label="Packed" value={num(packed)} sub="units into shipments" icon={Boxes} />
        <Kpi label="Received" value={`${num(received)}`} sub="booked at FBA" icon={PackageCheck} source="amazon" tone="success" />
        <Kpi label="Freight" value={money(freightTotal)} sub="DDP/DAP estimate" icon={DollarSign} />
      </div>

      {/* Pipeline reconciliation funnel */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-primary/12 text-primary"><Route className="h-4 w-4" /></span>
          <div><div className="font-semibold">Pipeline reconciliation</div><p className="text-[11px] text-muted-foreground">Every packed unit should flow through to received — the custody chain across all shipments.</p></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {funnel.map((s) => {
            const pct = Math.round((s.value / funnelMax) * 100);
            return (
              <div key={s.label}>
                <div className="mb-1.5 flex items-center gap-1.5"><span className="vy-kicker">{s.label}</span>{s.source === "amazon" && <SourceTag source="amazon" />}</div>
                <div className="tabular font-mono text-[22px] font-bold">{num(s.value)}</div>
                <div className="my-2 h-1.5 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", s.info ? "bg-info" : "bg-primary")} style={{ width: `${pct}%` }} /></div>
                <div className="text-[11px] text-muted-foreground">{s.hint}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shipment, order, supplier, forwarder, BOL" className="min-w-56 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">{modes.map((m) => <option key={m}>{m}</option>)}</select>
          <select value={forwarder} onChange={(e) => setForwarder(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">{fwds.map((f) => <option key={f}>{f}</option>)}</select>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">{STAGE_CHIPS.map((c) => <button key={c} onClick={() => setStage(c)} className={cn("vy-chip", stage === c && "is-active")}>{c}</button>)}</div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <CardHeader title={`${filtered.length} ${filtered.length === 1 ? "shipment" : "shipments"}`} caption="One freight shipment can feed several FBA inbounds" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Shipment</th>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Route</th>
                <th className="px-3 py-2 font-medium">Forwarder</th>
                <th className="px-3 py-2 font-medium">ETD → ETA</th>
                <th className="px-3 py-2 text-right font-medium">Cargo</th>
                <th className="px-3 py-2 text-right font-medium">Packed</th>
                <th className="px-3 py-2 font-medium">FBA inbounds</th>
                <th className="px-3 py-2 font-medium">Customs</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">{rows.length === 0 ? "No shipments yet — hit “New shipment”." : "No shipments match your filters."}</td></tr>
              ) : filtered.map((s) => {
                const short = s.fba.filter((f) => f.received > 0 && f.received < f.expected).length;
                return (
                  <tr key={s.id} className="cursor-pointer hover:bg-accent/40" onClick={() => setPeek(s)}>
                    <td className="px-3 py-2.5"><div className="font-mono text-[12px] font-bold">{s.id}</div><div className="text-[11px] text-muted-foreground">{[s.mode, s.bol].filter(Boolean).join(" · ")}</div></td>
                    <td className="px-3 py-2.5">{s.order_id ? <Link href={`/orders/${s.order_id}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary"><div className="font-mono text-[11px] text-muted-foreground">{s.order_id}</div><div className="max-w-[200px] truncate text-[12px] font-semibold">{s.order_title}</div><div className="text-[11px] text-muted-foreground">{s.supplier}</div></Link> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{s.origin || "—"}<br />→ {s.destination || "—"}</td>
                    <td className="px-3 py-2.5"><div className="font-medium">{s.forwarder || "—"}</div><div className="text-[11px] text-muted-foreground">{s.incoterm}</div></td>
                    <td className="px-3 py-2.5 font-mono text-[12px]">{s.etd || "—"}<br /><span className="text-muted-foreground">{s.eta || "—"}</span></td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-muted-foreground">{s.cbm ? `${s.cbm} CBM` : "—"}<br />{[s.gross_kg && `${s.gross_kg} kg`, s.cartons && `${s.cartons} ctn`].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="tabular px-3 py-2.5 text-right font-mono font-bold">{num(s.packed)}</td>
                    <td className="px-3 py-2.5">{s.fba.length ? <Link href={`/fba-shipments`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline"><LinkIcon className="h-3 w-3" />{s.fba.length} inbound{s.fba.length === 1 ? "" : "s"}{short > 0 && <Badge tone="danger">{short} short</Badge>}</Link> : <span className="text-[11px] text-muted-foreground">None yet</span>}</td>
                    <td className="px-3 py-2.5">{s.customs ? <Badge tone={CUSTOMS_TONE[s.customs] ?? "muted"}>{s.customs}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5"><Badge tone={SHIPMENT_STAGE_TONE[s.stage] ?? "muted"}>{s.stage}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Drawer */}
      <Drawer open={!!peek} onClose={() => setPeek(null)} title={peek?.id}>
        {peek && <ShipmentDetail s={peek} onEdit={() => { setEditing(peek); setPeek(null); }} onTracking={() => { setTrackingFor(peek); }} />}
      </Drawer>

      {/* New / Edit modals */}
      {modal === "new" && <ShipmentModal title="New shipment" orders={orders} suppliers={suppliers} forwarders={forwarders} onClose={() => setModal(null)} onSubmit={(fd) => createShipment(fd)} />}
      {editing && <ShipmentModal title={`Edit ${editing.id}`} shipment={editing} orders={orders} suppliers={suppliers} forwarders={forwarders} onClose={() => setEditing(null)} onSubmit={(fd) => updateShipment(editing.id, fd)} onDelete={async () => { await deleteShipment(editing.id); setEditing(null); router.refresh(); }} />}
      {trackingFor && <TrackingModal s={trackingFor} onClose={() => setTrackingFor(null)} />}
    </div>
  );
}

function ShipmentDetail({ s, onEdit, onTracking }: { s: ShipRow; onEdit: () => void; onTracking: () => void }) {
  const curIdx = SHIPMENT_STAGES.indexOf(s.stage as typeof SHIPMENT_STAGES[number]);
  const hasTracking = !!s.tracking?.trackingNo;
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[12px] text-muted-foreground">{s.mode} · {s.origin || "—"} → {s.destination || "—"}</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={SHIPMENT_STAGE_TONE[s.stage] ?? "muted"}>{s.stage}</Badge>
          {s.customs && <Badge tone={CUSTOMS_TONE[s.customs] ?? "muted"}>Customs: {s.customs}</Badge>}
          {s.order_id && <Link href={`/orders/${s.order_id}`}><Badge tone="muted">{s.order_id}</Badge></Link>}
          <button onClick={onEdit} className="vy-btn vy-btn--outline vy-btn--sm ml-auto inline-flex items-center gap-1.5"><Pencil className="h-3 w-3" /> Edit</button>
        </div>
      </div>

      {s.order_title && (
        <div><div className="vy-kicker mb-1.5">Order</div><div className="text-sm font-semibold">{s.order_title}</div>{s.supplier && <div className="text-[12px] text-muted-foreground">{s.supplier}</div>}</div>
      )}

      {/* Tracking · forwarder leg */}
      <div>
        <div className="mb-2.5 flex items-center gap-2"><span className="vy-kicker">Tracking · Forwarder leg</span><button onClick={onTracking} className="ml-auto text-[11px] font-medium text-primary hover:underline">{hasTracking ? "Edit" : "Add tracking"}</button></div>
        {hasTracking ? (
          <div className="mb-3 flex flex-wrap gap-3 rounded-lg border bg-background/50 px-3 py-2.5">
            <div className="min-w-0 flex-1"><div className="vy-kicker mb-0.5">Tracking no.</div><div className="font-mono text-[13px] font-bold">{s.tracking!.trackingNo}</div></div>
            <div className="min-w-0 flex-1"><div className="vy-kicker mb-0.5">Booking ref</div><div className="font-mono text-[12px]">{s.tracking!.bookingRef || "—"}</div></div>
            <div className="min-w-0 basis-full"><div className="vy-kicker mb-0.5">Carrier</div><div className="text-[12px]">{s.tracking!.carrier || "—"}{s.tracking!.scac ? ` · ${s.tracking!.scac}` : ""}</div></div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-4 text-center text-[12px] text-muted-foreground">No tracking number yet. Add one once the forwarder books this shipment.</div>
        )}
        {/* Stage checkpoint timeline */}
        <div className="mt-2 flex flex-col">
          {SHIPMENT_STAGES.map((st, i) => {
            const done = i <= curIdx; const cur = i === curIdx;
            const color = done ? (cur ? "hsl(var(--primary))" : "hsl(var(--success))") : "hsl(var(--border))";
            const nextDone = i < SHIPMENT_STAGES.length - 1 && i + 1 <= curIdx;
            return (
              <div key={st} className="flex min-h-[28px] gap-3">
                <div className="flex flex-col items-center self-stretch">
                  <span className="mt-1 grid h-3 w-3 shrink-0 place-items-center rounded-full" style={{ background: done ? color : "hsl(var(--card))", border: `2px solid ${color}` }}>{done && <Check className="h-[7px] w-[7px] text-white" strokeWidth={4} />}</span>
                  {i < SHIPMENT_STAGES.length - 1 && <span className="my-0.5 w-0.5 flex-1" style={{ background: nextDone ? "hsl(var(--success))" : "hsl(var(--border))" }} />}
                </div>
                <div className={cn("min-w-0", i < SHIPMENT_STAGES.length - 1 && "pb-2")}><div className={cn("text-[12.5px]", cur ? "font-bold text-primary" : done ? "font-semibold" : "font-semibold text-muted-foreground")}>{st}</div>{!done && <div className="text-[11px] italic text-muted-foreground">pending</div>}</div>
              </div>
            );
          })}
        </div>
        {s.fba.length > 0 && <p className="mt-3 rounded-md bg-accent/50 px-2.5 py-2 text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">Amazon takes over at the FC.</span> Checked-in · received · closed events sync from Seller Central — see FBA inbounds below.</p>}
      </div>

      {/* Logistics */}
      <div><div className="vy-kicker mb-2">Logistics</div><div className="grid grid-cols-3 gap-2">
        <DrawerStat label="ETD" value={s.etd || "—"} />
        <DrawerStat label="ETA" value={s.eta || "—"} />
        <DrawerStat label="BOL / AWB" value={<span className="text-[11px]">{s.bol || "—"}</span>} />
        <DrawerStat label="Forwarder" value={<span className="text-[11px]">{s.forwarder || "—"}</span>} />
        <DrawerStat label="Incoterm" value={s.incoterm || "—"} />
        <DrawerStat label="Freight" value={s.freight_usd ? money(s.freight_usd) : "—"} />
      </div></div>

      {/* Cargo */}
      <div><div className="vy-kicker mb-2">Cargo</div><div className="grid grid-cols-4 gap-2">
        <DrawerStat label="Packed" value={num(s.packed)} />
        <DrawerStat label="CBM" value={s.cbm ?? "—"} />
        <DrawerStat label="Gross" value={s.gross_kg ? `${s.gross_kg}kg` : "—"} />
        <DrawerStat label="Cartons" value={s.cartons ?? "—"} />
      </div></div>

      {/* FBA inbounds */}
      <div>
        <div className="mb-2 flex items-center justify-between"><span className="vy-kicker">FBA inbounds · Amazon leg ({s.fba.length})</span>{s.fba.length > 0 && <Link href="/fba-shipments" className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">View all <ArrowUpRight className="h-3 w-3" /></Link>}</div>
        {s.fba.length ? (
          <div className="space-y-2">
            {s.fba.map((f) => {
              const variance = f.received > 0 ? f.received - f.expected : 0;
              return (
                <div key={f.id} className="flex flex-wrap items-center gap-2.5 rounded-lg border bg-background/40 px-3 py-2.5">
                  <div className="min-w-0 flex-1"><div className="font-mono text-[12px] font-bold">{f.id}</div><div className="mt-1 flex items-center gap-1.5"><Badge tone="muted">{f.fc}</Badge><Badge tone={FBA_TONE[f.amazonStatus] ?? "muted"}>{f.amazonStatus}</Badge></div></div>
                  <div className="text-right font-mono text-[12px]"><span className={cn(f.received <= 0 ? "text-muted-foreground" : variance < 0 ? "text-danger" : variance > 0 ? "text-warning" : "text-success")}>{f.received <= 0 ? "—" : num(f.received)}</span> / {num(f.expected)}</div>
                </div>
              );
            })}
          </div>
        ) : <p className="rounded-lg border border-dashed px-3 py-3 text-[12px] text-muted-foreground">No FBA inbounds linked yet — they appear once Amazon creates inbounds for this shipment&apos;s order.</p>}
      </div>
    </div>
  );
}

function ShipmentModal({ title, shipment, orders, suppliers, forwarders, onClose, onSubmit, onDelete }: {
  title: string; shipment?: ShipRow; orders: OrderOpt[]; suppliers: string[]; forwarders: string[];
  onClose: () => void; onSubmit: (fd: FormData) => Promise<{ ok: boolean; error?: string }>; onDelete?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const s = shipment;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => { const r = await onSubmit(fd); if (!r.ok) { setErr(r.error ?? "Failed."); return; } onClose(); router.refresh(); });
  }
  function onPickOrder(e: React.ChangeEvent<HTMLSelectElement>) {
    const o = orders.find((x) => x.id === e.target.value);
    const form = e.target.form!;
    (form.elements.namedItem("order_title") as HTMLInputElement).value = o?.title ?? "";
    if (o?.supplier) (form.elements.namedItem("supplier") as HTMLSelectElement).value = o.supplier;
  }

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <div className="vy-kicker">Order &amp; supplier</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Order"><select name="order_id" defaultValue={s?.order_id ?? ""} onChange={onPickOrder} className={inputCls}><option value="">— none —</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.title}</option>)}</select></Field>
          <Field label="Supplier"><select name="supplier" defaultValue={s?.supplier ?? ""} className={inputCls}><option value="">— none —</option>{suppliers.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
        </div>
        <input type="hidden" name="order_title" defaultValue={s?.order_title ?? ""} />

        <div className="vy-kicker pt-1">Freight</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mode"><select name="mode" defaultValue={s?.mode ?? "Sea LCL"} className={inputCls}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Forwarder"><select name="forwarder" defaultValue={s?.forwarder ?? ""} className={inputCls}><option value="">— none —</option>{forwarders.map((f) => <option key={f} value={f}>{f}</option>)}</select></Field>
          <Field label="Incoterm"><select name="incoterm" defaultValue={s?.incoterm ?? ""} className={inputCls}><option value="">—</option>{INCOTERMS.map((i) => <option key={i}>{i}</option>)}</select></Field>
          <Field label="BOL / AWB"><input name="bol" defaultValue={s?.bol ?? ""} className={inputCls} /></Field>
          <Field label="Origin"><input name="origin" defaultValue={s?.origin ?? ""} className={inputCls} placeholder="Ningbo, CN" /></Field>
          <Field label="Destination"><input name="destination" defaultValue={s?.destination ?? ""} className={inputCls} placeholder="ONT8, US" /></Field>
          <Field label="ETD"><input name="etd" type="date" defaultValue={s?.etd ?? ""} className={inputCls} /></Field>
          <Field label="ETA"><input name="eta" type="date" defaultValue={s?.eta ?? ""} className={inputCls} /></Field>
          <Field label="Stage"><select name="stage" defaultValue={s?.stage ?? "Draft"} className={inputCls}>{SHIPMENT_STAGES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Customs"><select name="customs" defaultValue={s?.customs ?? ""} className={inputCls}><option value="">—</option>{Object.keys(CUSTOMS_TONE).map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>

        <div className="vy-kicker pt-1">Cargo</div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Packed (units)"><input name="packed" type="number" defaultValue={s?.packed ?? 0} className={inputCls} /></Field>
          <Field label="CBM"><input name="cbm" type="number" step="0.01" defaultValue={s?.cbm ?? ""} className={inputCls} /></Field>
          <Field label="Gross kg"><input name="gross_kg" type="number" step="0.1" defaultValue={s?.gross_kg ?? ""} className={inputCls} /></Field>
          <Field label="Cartons"><input name="cartons" type="number" defaultValue={s?.cartons ?? ""} className={inputCls} /></Field>
          <Field label="Freight (USD)"><input name="freight_usd" type="number" step="0.01" defaultValue={s?.freight_usd ?? ""} className={inputCls} /></Field>
        </div>

        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex items-center justify-between gap-2">
          {onDelete ? <button type="button" onClick={() => { if (confirm(`Delete ${s?.id}?`)) onDelete(); }} className="vy-btn vy-btn--ghost inline-flex items-center gap-1.5 text-danger"><Trash2 className="h-3.5 w-3.5" /> Delete</button> : <span />}
          <div className="flex gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save shipment"}</PrimaryButton></div>
        </div>
      </form>
    </Modal>
  );
}

function TrackingModal({ s, onClose }: { s: ShipRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => { const r = await updateTracking(s.id, fd); if (!r.ok) { setErr(r.error); return; } onClose(); router.refresh(); });
  }
  return (
    <Modal open onClose={onClose} title={`Tracking — ${s.id}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-[12px] text-muted-foreground">Manual forwarder-leg tracking. (17TRACK auto-sync isn&apos;t connected.)</p>
        <Field label="Tracking number"><input name="tracking_no" defaultValue={s.tracking?.trackingNo ?? ""} autoFocus className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Booking ref"><input name="booking_ref" defaultValue={s.tracking?.bookingRef ?? ""} className={inputCls} /></Field>
          <Field label="SCAC"><input name="scac" defaultValue={s.tracking?.scac ?? ""} className={inputCls} /></Field>
        </div>
        <Field label="Carrier"><input name="carrier" defaultValue={s.tracking?.carrier ?? ""} className={inputCls} placeholder="Maersk / DHL …" /></Field>
        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save tracking"}</PrimaryButton></div>
      </form>
    </Modal>
  );
}
