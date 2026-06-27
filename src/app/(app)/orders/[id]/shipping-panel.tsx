"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Badge, Kpi, KpiStrip, SectionHeader, SectionTitle } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { money, num, SHIPMENT_STAGES, SHIPMENT_STAGE_TONE, SHIPMENT_MOVING, incotermInfo, type Tone, type OrderRow } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/ui/copy";
import { intgAgo } from "@/lib/integrations";
import {
  bookOrderShipment, updateOrderShipment, advanceOrderShipmentStage, savePackingList,
  linkFbaInbound, linkExistingFbaInbound, updateFbaReceived, saveShipmentFile, pasteTrackingUpdate, deleteOrderShipment,
  type ShipFields, type PackingLineInput,
} from "./shipping-actions";
import {
  Truck, PackageCheck, Box, FileText, Upload, Plus, ChevronRight, AlertTriangle, Check, Link2, Ship, DollarSign, Trash2, Calendar,
} from "lucide-react";

export type ShipmentRow = { id: string; mode: string; stage: string; forwarder: string | null; incoterm: string | null; origin: string | null; destination: string | null; etd: string | null; eta: string | null; cbm: number | null; gross_kg: number | null; net_kg: number | null; cartons: number | null; packed: number; freight_usd: number | null; bol: string | null; customs: string | null };
export type InboundRow = { id: string; fc: string; expected: number; received: number; amazon_status: string; sku_count: number; shipment_id: string | null; eta: string | null; synced: string | null; reference_id: string | null; eta_from: string | null; eta_to: string | null };
export type PackLine = { id: string; shipment_id: string | null; sku: string | null; product_name: string | null; cartons: number; per_ctn: number; packed: number; fc: string | null };
export type ShipFile = { id: string; shipment_id: string | null; slot: string; url: string; name: string | null };
export type TrackRow = { shipment_id: string; tracking_no: string | null; eta_override: string | null };
export type OrderedLine = { sku: string | null; product_name: string | null; qty: number };
export type FreightInvoice = { id: string; total: number; paid: number };

const MODES = ["Sea LCL", "Sea FCL", "Air", "Express", "Rail", "Truck"];
const INCOTERMS = ["EXW", "FOB", "CIF", "DAP", "DDP"];
const FILE_SLOTS = [
  { slot: "bol", title: "BOL / AWB", desc: "Bill of lading / air waybill from the carrier" },
  { slot: "customs", title: "Customs docs", desc: "Import clearance paperwork" },
  { slot: "packing_pdf", title: "Packing PDF", desc: "Carton-level packing list for this shipment" },
];
const TIMELINE: { label: string; stage: string; place: string }[] = [
  { label: "Booking confirmed", stage: "Booked", place: "origin" },
  { label: "Picked up at origin", stage: "Picked up", place: "origin" },
  { label: "Departed — on the water", stage: "In transit", place: "on the water" },
  { label: "Customs clearance", stage: "Customs", place: "destination" },
  { label: "Arrived at destination", stage: "Delivered", place: "destination" },
  { label: "Delivered to Amazon FC", stage: "At FBA", place: "FBA" },
];
const stageIdx = (s: string) => SHIPMENT_STAGES.indexOf(s as (typeof SHIPMENT_STAGES)[number]);

async function pickFile(accept: string, onFile: (f: File) => void) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = accept;
  input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) onFile(f); };
  input.click();
}

export function ShippingPanel({ order, shipments, inbounds, packLines, shipFiles, tracking, ordered, forwarders, freightInvoice, unlinkedInbounds }: {
  order: OrderRow; shipments: ShipmentRow[]; inbounds: InboundRow[]; packLines: PackLine[]; shipFiles: ShipFile[]; tracking: TrackRow[]; ordered: OrderedLine[]; forwarders: string[]; freightInvoice: FreightInvoice | null; unlinkedInbounds: InboundRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [active, setActive] = useState<string | null>(shipments[0]?.id ?? null);
  const [booking, setBooking] = useState<ShipmentRow | null | "new">(null);
  const [packingFor, setPackingFor] = useState<ShipmentRow | null>(null);
  const [linkingFor, setLinkingFor] = useState<ShipmentRow | null>(null);
  const [pasteFor, setPasteFor] = useState<ShipmentRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setErr(null); const r = await fn(); if (!r.ok) setErr(r.error ?? "Something went wrong."); router.refresh(); });

  // ---- roll-ups ----
  const orderedTotal = ordered.reduce((s, l) => s + (l.qty || 0), 0);
  const packedTotal = shipments.reduce((s, sh) => s + (sh.packed || 0), 0);
  const coverPct = orderedTotal > 0 ? Math.min(100, Math.round((packedTotal / orderedTotal) * 100)) : 0;
  const atFactory = Math.max(0, orderedTotal - packedTotal);
  const inTransit = shipments.filter((s) => SHIPMENT_MOVING.includes(s.stage)).length;
  const freightTotal = shipments.reduce((s, sh) => s + (sh.freight_usd || 0), 0);
  const recvTotal = inbounds.reduce((s, i) => s + (i.received || 0), 0);
  const expectTotal = inbounds.reduce((s, i) => s + (i.expected || 0), 0);
  const filesFilled = shipments.reduce((acc, sh) => acc + FILE_SLOTS.filter((sl) => shipFiles.some((f) => f.shipment_id === sh.id && f.slot === sl.slot)).length, 0);
  const filesTotal = shipments.length * FILE_SLOTS.length;
  const packingMissing = shipments.filter((s) => !packLines.some((p) => p.shipment_id === s.id));
  const nextEta = shipments.map((s) => s.eta).filter(Boolean).sort()[0] ?? null;

  // per-SKU coverage
  const skuCover = useMemo(() => {
    const m = new Map<string, { sku: string; product: string; ordered: number; packed: number }>();
    for (const l of ordered) { const k = l.sku ?? l.product_name ?? "—"; const c = m.get(k) ?? { sku: l.sku ?? "—", product: l.product_name ?? "", ordered: 0, packed: 0 }; c.ordered += l.qty || 0; m.set(k, c); }
    for (const p of packLines) { const k = p.sku ?? "—"; const c = m.get(k); if (c) c.packed += p.packed || 0; }
    return [...m.values()];
  }, [ordered, packLines]);

  const activeShip = shipments.find((s) => s.id === active) ?? null;
  const activeInbounds = inbounds.filter((i) => i.shipment_id === active);
  const inbLastSync = activeInbounds.map((i) => i.synced).filter(Boolean).sort().at(-1) ?? null;
  const activeFiles = shipFiles.filter((f) => f.shipment_id === active);
  const activeTrack = tracking.find((t) => t.shipment_id === active) ?? null;

  // next action
  const next = shipments.length === 0
    ? { headline: "Book first shipment", detail: "Add a freight shipment to start tracking how this order moves to Amazon.", severity: "warning" as const,
        cta: <button type="button" onClick={() => setBooking("new")} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add shipment</button> }
    : packingMissing.length > 0
    ? { headline: "Create packing list", detail: `Shipment ${shipments.indexOf(packingMissing[0]) + 1} needs carton truth before FBA inbound links can be created.`, severity: "warning" as const,
        cta: <button type="button" onClick={() => { setActive(packingMissing[0].id); setPackingFor(packingMissing[0]); }} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Create packing</button> }
    : recvTotal < expectTotal || inbounds.length === 0
    ? { headline: "Link & receive FBA inbounds", detail: "Packing is done. Link Amazon inbound shipments and track received vs expected units.", severity: undefined,
        cta: activeShip ? <button type="button" onClick={() => setLinkingFor(activeShip)} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Link2 className="h-4 w-4" /> Link FBA</button> : undefined }
    : { headline: "On the way to FBA", detail: "All packed and linked. Track receipts; the order moves to FBA once every inbound is received.", severity: undefined, cta: undefined };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Shipping"
        blurb="Physical shipment data, packing lists, FBA inbound links, freight context, and shipment files."
        badges={<>
          <Badge tone="muted">{shipments.length} shipment{shipments.length === 1 ? "" : "s"}</Badge>
          <Badge tone="muted">{num(packedTotal)} pcs</Badge>
          {inTransit > 0 && <Badge tone="info">{inTransit} in transit</Badge>}
          {packingMissing.length > 0 ? <Badge tone="warning">Packing missing</Badge> : shipments.length > 0 && <Badge tone="success">All packed</Badge>}
        </>}
        nextAction={next}
        actions={<button type="button" onClick={() => setBooking("new")} className="vy-btn vy-btn--outline inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add shipment</button>}
      />

      <KpiStrip cols={3}>
        <Kpi label="Shipments" value={`${shipments.length} active`} sub={[...new Set(shipments.map((s) => s.mode))].join(" · ") || "—"} icon={Ship} />
        <Kpi label="Freight (est.)" value={money(freightTotal)} sub={[...new Set(shipments.map((s) => s.forwarder).filter(Boolean))].join(" · ") || "no forwarder"} icon={DollarSign} tone={freightTotal > 0 ? "info" : undefined} />
        <Kpi label="Files" value={`${filesFilled} of ${filesTotal}`} sub={filesTotal - filesFilled > 0 ? `${filesTotal - filesFilled} missing` : "all uploaded"} icon={FileText} tone={filesTotal > 0 && filesFilled < filesTotal ? "warning" : undefined} />
      </KpiStrip>

      {err && <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">{err}</div>}

      {packingMissing.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.3)" }}>
          <Badge tone="warning">Action needed</Badge>
          <span><span className="font-semibold">A shipment needs a packing list before FBA link.</span><span className="text-muted-foreground"> Create carton truth first, then link FBA inbound shipments.</span></span>
          <button type="button" onClick={() => { setActive(packingMissing[0].id); setPackingFor(packingMissing[0]); }} className="vy-btn vy-btn--primary vy-btn--sm ml-auto inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Create packing</button>
        </div>
      )}

      {/* Order coverage */}
      <Card className="p-5">
        <SectionTitle icon={Box} tone="brand" strong title="Order coverage" sub="Every ordered unit must be packed into a shipment."
          action={atFactory > 0 ? <Badge tone="warning">{num(atFactory)} units to ship</Badge> : <Badge tone="success">All units shipped</Badge>} />
        <div className="mb-1 flex items-center justify-between text-[12px]"><span>Packed <span className="font-mono font-bold">{num(packedTotal)}</span> of {num(orderedTotal)} ordered units</span><span className="font-mono font-bold">{coverPct}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${coverPct}%` }} /></div>

        {shipments.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground"><span>Track each shipment · {shipments.length} batch{shipments.length === 1 ? "" : "es"}</span><span>{num(packedTotal)} shipped · {num(atFactory)} at factory</span></div>
            <div className="divide-y">
              {shipments.map((sh, i) => {
                const sinb = inbounds.filter((x) => x.shipment_id === sh.id);
                const rec = sinbSum(sinb, "received"), exp = sinbSum(sinb, "expected");
                return (
                  <div key={sh.id} className={cn("flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-[12px]", active === sh.id && "bg-primary/5")}>
                    <button type="button" onClick={() => setActive(sh.id)} className="flex min-w-[160px] items-center gap-2 text-left">
                      <span className={cn("h-2 w-2 rounded-full", SHIPMENT_MOVING.includes(sh.stage) ? "bg-info" : sh.stage === "At FBA" ? "bg-success" : "bg-muted-foreground")} />
                      <span><span className="font-semibold">Shipment {i + 1}</span><div className="text-[11px] text-muted-foreground">{sh.mode}{sh.eta ? ` · ETA ${sh.eta}` : ""}</div></span>
                    </button>
                    <div className="min-w-[120px]"><div className="text-[10px] uppercase text-muted-foreground">Tracking</div><div className="font-mono text-[11px]">{activeTrackNo(tracking, sh.id) ?? "not booked"} <Badge tone={SHIPMENT_STAGE_TONE[sh.stage] ?? "muted"}>{sh.stage}</Badge></div></div>
                    <div className="ml-auto text-right"><div className="text-[10px] uppercase text-muted-foreground">Units</div><div className="font-mono font-bold">{num(sh.packed)}</div></div>
                    <div className="text-right"><div className="text-[10px] uppercase text-muted-foreground">Freight</div><div className="font-mono font-bold">{sh.freight_usd ? money(sh.freight_usd) : "—"}</div></div>
                    <div className="text-right"><div className="text-[10px] uppercase text-muted-foreground">FBA received</div><div className="font-mono">{sinb.length === 0 ? <span className="text-muted-foreground">no inbounds</span> : <span className={cn(rec >= exp && exp > 0 ? "text-success" : rec > 0 ? "text-warning" : "text-muted-foreground")}>{num(rec)}/{num(exp)}</span>}</div></div>
                  </div>
                );
              })}
              {atFactory > 0 && <div className="flex items-center gap-2 border-t border-dashed px-4 py-2.5 text-[12px] text-muted-foreground"><span className="h-2 w-2 rounded-full border border-dashed" /> Still at factory · <span className="font-mono font-semibold">{num(atFactory)}</span> units not on any shipment</div>}
            </div>
          </div>
        )}

        {skuCover.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="px-4 py-2">SKU</th><th className="px-3 py-2 text-right">Ordered</th><th className="px-3 py-2 text-right">Packed</th><th className="px-3 py-2 text-right">To ship</th><th className="px-4 py-2 text-right">Status</th></tr></thead>
              <tbody className="divide-y">
                {skuCover.map((r) => { const toShip = Math.max(0, r.ordered - r.packed); return (
                  <tr key={r.sku}><td className="px-4 py-2 font-mono text-[12px] font-semibold">{r.sku}</td><td className="tabular px-3 py-2 text-right font-mono">{num(r.ordered)}</td><td className="tabular px-3 py-2 text-right font-mono">{num(r.packed)}</td><td className={cn("tabular px-3 py-2 text-right font-mono", toShip > 0 && "text-warning")}>{num(toShip)}</td><td className="px-4 py-2 text-right"><Badge tone={toShip <= 0 ? "success" : "warning"}>{toShip <= 0 ? "Packed" : "Partial"}</Badge></td></tr>
                ); })}
                <tr className="border-t bg-muted/30 font-semibold"><td className="px-4 py-2.5">Total</td><td className="tabular px-3 py-2.5 text-right font-mono">{num(orderedTotal)}</td><td className="tabular px-3 py-2.5 text-right font-mono">{num(packedTotal)}</td><td className="tabular px-3 py-2.5 text-right font-mono text-warning">{num(atFactory)}</td><td /></tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Shipment switcher */}
      {shipments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Shipments</span>
          {shipments.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setActive(s.id)} className={cn("rounded-lg border px-3 py-1.5 text-left text-[12px]", active === s.id ? "border-primary bg-primary/10" : "hover:bg-accent/40")}>
              <span className={cn("font-semibold", active === s.id && "text-primary")}>Shipment {i + 1}</span> <span className="text-muted-foreground">{s.mode} · {num(s.packed)} pcs{s.eta ? ` · ${s.eta}` : ""}</span>
            </button>
          ))}
          <button type="button" onClick={() => setBooking("new")} className="rounded-lg border border-dashed px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-accent/40"><Plus className="mr-1 inline h-3.5 w-3.5" />Add</button>
        </div>
      )}

      {activeShip && (
        <>
          {/* Active shipment */}
          <Card className="p-5">
            <SectionTitle icon={Ship} tone="info" strong title={`Shipment ${shipments.indexOf(activeShip) + 1} of ${shipments.length}`} sub={`${activeShip.origin || "—"} → ${activeShip.destination || "FBA"}`}
              action={<div className="flex gap-1.5">
                <button type="button" onClick={() => setBooking(activeShip)} className="vy-btn vy-btn--outline vy-btn--sm">Edit</button>
                {stageIdx(activeShip.stage) < SHIPMENT_STAGES.length - 1 && <button type="button" disabled={pending} onClick={() => run(() => advanceOrderShipmentStage(activeShip.id, order.id))} className="vy-btn vy-btn--primary vy-btn--sm">Advance → {SHIPMENT_STAGES[stageIdx(activeShip.stage) + 1]}</button>}
              </div>} />
            <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
              {[["ETD", activeShip.etd || "—"], ["ETA", activeShip.eta || "—"], ["Tracking", activeTrack?.tracking_no || "—"]].map(([k, v]) => (
                <div key={k} className="bg-card px-4 py-3"><div className="vy-kicker">{k}</div><div className={cn("mt-0.5 text-[13px] font-semibold", k === "Tracking" && "font-mono")}>{v}</div></div>
              ))}
            </div>
            {/* timeline */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tracking detail · forwarder leg {activeTrack?.tracking_no ? "" : "· no tracking"}</span>
                <button type="button" onClick={() => setPasteFor(activeShip)} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Paste update</button>
              </div>
              <ol className="space-y-2.5">
                {TIMELINE.map((m) => { const done = stageIdx(activeShip.stage) >= stageIdx(m.stage); return (
                  <li key={m.label} className="flex items-start gap-2.5">
                    <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border", done ? "border-success bg-success text-white" : "border-muted-foreground/40")}>{done && <Check className="h-2.5 w-2.5" />}</span>
                    <div className="text-[12px]"><span className={cn("font-medium", !done && "text-muted-foreground")}>{m.label}</span><div className="text-[11px] text-muted-foreground capitalize">{m.place} · {done ? "done" : "pending"}</div></div>
                  </li>
                ); })}
              </ol>
              <p className="mt-2 text-[11px] text-muted-foreground">Forwarder leg only (via 17TRACK). Once delivered to the FC, Amazon takes over — received events appear in the FBA section below.</p>
            </div>
          </Card>

          {/* Packing list */}
          <Card className="p-5">
            <PackingCard shipment={activeShip} lines={packLines.filter((p) => p.shipment_id === activeShip.id)} onCreate={() => setPackingFor(activeShip)} />
          </Card>

          {/* FBA inbounds */}
          <Card className="p-5">
            <SectionTitle icon={PackageCheck} tone="success" strong title="FBA inbound shipments" sub={`Status & received units sync from Seller Central${inbLastSync ? ` · synced ${intgAgo(inbLastSync)}` : ""}`}
              action={<div className="flex items-center gap-1.5">
                {activeInbounds.length > 0 && <CopyButton label="Copy all for forwarder" text={activeInbounds.map((f) => [
                  `FBA shipment ID: ${f.id}`,
                  f.reference_id ? `Reference ID: ${f.reference_id}` : null,
                  `Dest FC: ${f.fc}`,
                  (f.eta_from || f.eta_to) ? `FBA arrival: ${f.eta_from || "?"} – ${f.eta_to || "?"}` : null,
                ].filter(Boolean).join("\n")).join("\n\n")} />}
                <button type="button" onClick={() => setLinkingFor(activeShip)} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Link FBA</button>
              </div>} />
            {activeInbounds.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center"><span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground"><Link2 className="h-4 w-4" /></span><div className="text-[13px] font-semibold">No FBA inbounds linked</div><p className="mt-0.5 text-[11px] text-muted-foreground">Create the packing list first, then link Amazon FBA inbound shipments to track expected vs. received units.</p></div>
            ) : (
              <div className="space-y-2.5">
                {activeInbounds.map((f) => { const variance = f.received - f.expected; const win = f.eta_from || f.eta_to ? `${f.eta_from || "?"} – ${f.eta_to || "?"}` : f.eta || null; const rowCopy = [`FBA shipment ID: ${f.id}`, f.reference_id ? `Reference ID: ${f.reference_id}` : null, `Dest FC: ${f.fc}`, (f.eta_from || f.eta_to) ? `FBA arrival: ${f.eta_from || "?"} – ${f.eta_to || "?"}` : null].filter(Boolean).join("\n"); return (
                  <div key={f.id} className="rounded-lg border bg-background/40 px-4 py-3">
                    {/* IDs — copy the whole set with 'Copy all for forwarder' above */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/fba-shipments/${f.id}`} className="font-mono text-[12px] font-bold hover:text-primary">{f.id}</Link>
                      {f.reference_id && <span className="font-mono text-[11px] text-muted-foreground">ref {f.reference_id}</span>}
                      <Badge tone="muted">{f.fc}</Badge>
                      <Badge tone={f.amazon_status === "Closed" ? "success" : f.amazon_status === "Problem" ? "danger" : f.amazon_status === "Receiving" ? "warning" : "info"}>{f.amazon_status}</Badge>
                      <div className="ml-auto flex items-center gap-1.5">
                        <CopyButton label="Copy" text={rowCopy} />
                        <Link href={`/fba-shipments/${f.id}`} className="vy-icon-btn" aria-label="Open"><ChevronRight className="h-4 w-4" /></Link>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                      <span>exp {num(f.expected)} · rec <span className={cn(f.received >= f.expected && f.expected > 0 ? "text-success" : f.received > 0 ? "text-warning" : "text-muted-foreground")}>{num(f.received)}</span>{f.received > 0 && variance !== 0 ? <span className={variance < 0 ? "text-danger" : "text-warning"}> ({variance > 0 ? "+" : ""}{num(variance)})</span> : null}</span>
                      {win && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> FBA arrival {win}</span>}
                      <button type="button" onClick={() => { const v = window.prompt(`Received units for ${f.id}`, String(f.received)); if (v != null) run(() => updateFbaReceived(f.id, order.id, Number(v) || 0)); }} className="vy-btn vy-btn--ghost vy-btn--sm ml-auto">Update received</button>
                    </div>
                  </div>
                ); })}
              </div>
            )}
          </Card>

          {/* Freight & customs */}
          <Card className="p-5">
            <SectionTitle icon={Truck} tone="info" strong title="Freight & customs" sub="Invoices live in the Invoices tab" />
            <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
              <div className="bg-card px-4 py-3"><div className="vy-kicker">Forwarder</div><div className="mt-0.5 text-[13px] font-semibold">{activeShip.forwarder || "—"}{activeShip.incoterm ? ` · ${activeShip.incoterm}` : ""}</div></div>
              <div className="bg-card px-4 py-3"><div className="vy-kicker">Freight estimate</div><div className="mt-0.5 font-mono text-[13px] font-semibold">{activeShip.freight_usd ? money(activeShip.freight_usd) : "—"}</div></div>
              <div className="bg-card px-4 py-3"><div className="vy-kicker">Freight invoice</div>{freightInvoice ? <div className="mt-0.5 text-[13px]"><Link href={`/orders/${order.id}?tab=invoices`} className="font-mono font-semibold text-primary hover:underline">{freightInvoice.id}</Link> <Badge tone={freightInvoice.paid >= freightInvoice.total ? "success" : "warning"}>{freightInvoice.paid >= freightInvoice.total ? "Paid" : "Unpaid"}</Badge></div> : <div className="mt-0.5 text-[12px] text-muted-foreground">none linked</div>}</div>
            </div>
          </Card>

          {/* Files */}
          <Card className="p-5">
            <SectionTitle icon={FileText} tone="muted" strong title="Files" />
            <div className="grid gap-3 sm:grid-cols-2">
              {FILE_SLOTS.map((sl) => { const f = activeFiles.find((x) => x.slot === sl.slot); return (
                <div key={sl.slot} className="flex items-center gap-3 rounded-lg border bg-background/40 px-3.5 py-3">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md", f ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>{f ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span>
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{sl.title}</div><div className="truncate text-[11px] text-muted-foreground">{f ? (f.name ?? "uploaded") : sl.desc}</div></div>
                  <button type="button" disabled={busy === sl.slot} onClick={() => pickFile(".pdf,.png,.jpg,.jpeg", async (file) => {
                    setBusy(sl.slot); setErr(null);
                    const supabase = createClient();
                    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
                    const path = `orders/${order.id}/shipments/${activeShip.id}/${sl.slot}/${Date.now()}-${safe}`;
                    const { error } = await supabase.storage.from("product-media").upload(path, file, { upsert: true });
                    if (error) { setErr(`Upload failed: ${error.message}`); setBusy(null); return; }
                    const url = supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl;
                    await saveShipmentFile(activeShip.id, order.id, sl.slot, url, file.name);
                    setBusy(null); router.refresh();
                  })} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex shrink-0 items-center gap-1"><Upload className="h-3.5 w-3.5" /> {busy === sl.slot ? "…" : f ? "Replace" : "Upload"}</button>
                </div>
              ); })}
            </div>
          </Card>
        </>
      )}

      {booking != null && <BookModal order={order} shipment={booking === "new" ? null : booking} forwarders={forwarders} onClose={() => setBooking(null)} onSaved={() => { setBooking(null); router.refresh(); }} onDelete={booking !== "new" ? () => { run(() => deleteOrderShipment((booking as ShipmentRow).id, order.id)); setBooking(null); } : undefined} />}
      {packingFor && <PackingModal shipment={packingFor} orderId={order.id} ordered={ordered} existing={packLines.filter((p) => p.shipment_id === packingFor.id)} onClose={() => setPackingFor(null)} onSaved={() => { setPackingFor(null); router.refresh(); }} />}
      {linkingFor && <LinkFbaModal shipment={linkingFor} orderId={order.id} unlinked={unlinkedInbounds} onClose={() => setLinkingFor(null)} onSaved={() => { setLinkingFor(null); router.refresh(); }} />}
      {pasteFor && <PasteModal shipment={pasteFor} orderId={order.id} onClose={() => setPasteFor(null)} onSaved={() => { setPasteFor(null); router.refresh(); }} />}
    </div>
  );
}

function sinbSum(rows: InboundRow[], k: "received" | "expected") { return rows.reduce((s, r) => s + (r[k] || 0), 0); }
function activeTrackNo(tracking: TrackRow[], id: string) { return tracking.find((t) => t.shipment_id === id)?.tracking_no ?? null; }

function PackingCard({ shipment, lines, onCreate }: { shipment: ShipmentRow; lines: PackLine[]; onCreate: () => void }) {
  return (
    <>
      <SectionTitle icon={Box} tone="warning" strong title="Packing list" sub="Carton truth for this shipment only"
        action={lines.length > 0 ? <button type="button" onClick={onCreate} className="vy-btn vy-btn--outline vy-btn--sm">Edit</button> : undefined} />
      {lines.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center"><span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground"><Box className="h-4 w-4" /></span><div className="text-[13px] font-semibold">No packing list yet</div><p className="mt-0.5 text-[11px] text-muted-foreground">Add carton dimensions, weights, and per-SKU counts to create the carton truth for this shipment.</p><button type="button" onClick={onCreate} className="vy-btn vy-btn--primary mt-3 inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Create packing list</button></div>
      ) : (
        <>
          <div className="mb-3 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
            {[["CBM", shipment.cbm != null ? `${shipment.cbm} m³` : "—"], ["Gross", shipment.gross_kg != null ? `${shipment.gross_kg} kg` : "—"], ["Net", shipment.net_kg != null ? `${shipment.net_kg} kg` : "—"]].map(([k, v]) => (
              <div key={k} className="bg-card px-4 py-3"><div className="vy-kicker">{k}</div><div className="mt-0.5 font-mono text-[13px] font-semibold">{v}</div></div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="px-4 py-2">SKU</th><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Cartons</th><th className="px-3 py-2 text-right">Units/ctn</th><th className="px-3 py-2 text-right">Packed</th><th className="px-4 py-2">FC</th></tr></thead>
              <tbody className="divide-y">
                {lines.map((l) => (
                  <tr key={l.id}><td className="px-4 py-2 font-mono text-[12px] font-semibold">{l.sku}</td><td className="px-3 py-2 text-[12px] text-muted-foreground">{l.product_name}</td><td className="tabular px-3 py-2 text-right font-mono">{num(l.cartons)}</td><td className="tabular px-3 py-2 text-right font-mono">{num(l.per_ctn)}</td><td className="tabular px-3 py-2 text-right font-mono font-semibold">{num(l.packed)}</td><td className="px-4 py-2 text-[12px]">{l.fc || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function BookModal({ order, shipment, forwarders, onClose, onSaved, onDelete }: { order: OrderRow; shipment: ShipmentRow | null; forwarders: string[]; onClose: () => void; onSaved: () => void; onDelete?: () => void }) {
  const [f, setF] = useState<ShipFields>({
    mode: shipment?.mode ?? MODES[0], forwarder: shipment?.forwarder ?? null, incoterm: shipment?.incoterm ?? null,
    origin: shipment?.origin ?? null, destination: shipment?.destination ?? null, etd: shipment?.etd ?? null, eta: shipment?.eta ?? null,
    freight_usd: shipment?.freight_usd ?? null, bol: shipment?.bol ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<ShipFields>) => setF((c) => ({ ...c, ...p }));
  const save = async () => {
    setSaving(true); setErr(null);
    const r = shipment ? await updateOrderShipment(shipment.id, order.id, f) : await bookOrderShipment(order.id, order.title ?? null, f);
    setSaving(false); if (r.ok) onSaved(); else setErr(r.error);
  };
  return (
    <Modal open onClose={onClose} title={shipment ? "Edit shipment" : "Add shipment"} subtitle="Freight booking for this order's goods."
      footer={<div className="flex items-center gap-2">{onDelete && <button type="button" onClick={onDelete} className="vy-btn vy-btn--ghost vy-btn--sm mr-auto inline-flex items-center gap-1 text-danger"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}<GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : shipment ? "Save" : "Add shipment"}</PrimaryButton></div>}>
      <div className="space-y-4">
        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mode"><Select value={f.mode} onChange={(v) => set({ mode: v })} options={MODES.map((m) => ({ value: m, label: m }))} /></Field>
          <Field label="Forwarder"><Select value={f.forwarder ?? ""} onChange={(v) => set({ forwarder: v || null })} placeholder="Select forwarder…" searchable options={[{ value: "", label: "— none —" }, ...forwarders.map((n) => ({ value: n, label: n }))]} /></Field>
          <Field label="Incoterm"><Select value={f.incoterm ?? ""} onChange={(v) => set({ incoterm: v || null })} options={[{ value: "", label: "— none —" }, ...INCOTERMS.map((t) => ({ value: t, label: t }))]} />{f.incoterm && <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{incotermInfo(f.incoterm).blurb} · Customs: {incotermInfo(f.incoterm).customsBy} · Duties: {incotermInfo(f.incoterm).dutiesBy}</p>}</Field>
          <Field label="Freight estimate (USD, optional)"><input type="number" step="0.01" className={inputCls} value={f.freight_usd ?? ""} onChange={(e) => set({ freight_usd: e.target.value === "" ? null : Number(e.target.value) })} placeholder="0.00" /><p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">A planning number. The actual cost comes from the forwarder&apos;s invoice in the Invoices tab — that&apos;s what lands in Landed cost.</p></Field>
          <Field label="Origin"><input className={inputCls} value={f.origin ?? ""} onChange={(e) => set({ origin: e.target.value || null })} placeholder="e.g. Ningbo" /><p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">Departure port.</p></Field>
          <Field label="Destination"><input className={inputCls} value={f.destination ?? ""} onChange={(e) => set({ destination: e.target.value || null })} placeholder="e.g. Los Angeles" /><p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">Arrival port — not Amazon. The FC is tracked on the FBA inbound.</p></Field>
          <Field label="ETD"><input className={inputCls} value={f.etd ?? ""} onChange={(e) => set({ etd: e.target.value || null })} placeholder="e.g. Jun 12" /><p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">Estimated departure — leaves the origin port.</p></Field>
          <Field label="ETA"><input className={inputCls} value={f.eta ?? ""} onChange={(e) => set({ eta: e.target.value || null })} placeholder="e.g. Jun 24" /><p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">Estimated arrival at the destination port. The FBA arrival date is on the FBA inbound below.</p></Field>
        </div>
        <Field label="BOL / AWB no."><input className={inputCls} value={f.bol ?? ""} onChange={(e) => set({ bol: e.target.value || null })} placeholder="Bill of lading / air waybill" /></Field>
      </div>
    </Modal>
  );
}

function PackingModal({ shipment, orderId, ordered, existing, onClose, onSaved }: { shipment: ShipmentRow; orderId: string; ordered: OrderedLine[]; existing: PackLine[]; onClose: () => void; onSaved: () => void }) {
  const seedRows = (existing.length ? existing.map((e) => ({ sku: e.sku, product_name: e.product_name, cartons: e.cartons, per_ctn: e.per_ctn, fc: e.fc })) : ordered.map((o) => ({ sku: o.sku, product_name: o.product_name, cartons: 0, per_ctn: 0, fc: null as string | null }))) as PackingLineInput[];
  const [cbm, setCbm] = useState(shipment.cbm != null ? String(shipment.cbm) : "");
  const [gross, setGross] = useState(shipment.gross_kg != null ? String(shipment.gross_kg) : "");
  const [net, setNet] = useState(shipment.net_kg != null ? String(shipment.net_kg) : "");
  const [rows, setRows] = useState<PackingLineInput[]>(seedRows);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const setRow = (i: number, p: Partial<PackingLineInput>) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  const numv = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : 0; };
  const totalPacked = rows.reduce((s, r) => s + (r.cartons || 0) * (r.per_ctn || 0), 0);
  const save = async () => {
    setSaving(true); setErr(null);
    const r = await savePackingList(shipment.id, orderId, { cbm: cbm === "" ? null : numv(cbm), gross_kg: gross === "" ? null : numv(gross), net_kg: net === "" ? null : numv(net), lines: rows });
    setSaving(false); if (r.ok) onSaved(); else setErr(r.error);
  };
  return (
    <Modal open onClose={onClose} title="Packing list" subtitle="Carton truth for this shipment — cartons × units/ctn = packed." size="lg"
      footer={<div className="flex items-center gap-3"><span className="text-[12px] text-muted-foreground">Packed <span className="font-mono font-bold text-foreground">{num(totalPacked)}</span> units</span><div className="ml-auto flex gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save packing list"}</PrimaryButton></div></div>}>
      <div className="space-y-4">
        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="CBM (m³)"><input type="number" step="0.01" className={inputCls} value={cbm} onChange={(e) => setCbm(e.target.value)} placeholder="0.00" /></Field>
          <Field label="Gross (kg)"><input type="number" step="0.01" className={inputCls} value={gross} onChange={(e) => setGross(e.target.value)} placeholder="0" /></Field>
          <Field label="Net (kg)"><input type="number" step="0.01" className={inputCls} value={net} onChange={(e) => setNet(e.target.value)} placeholder="0" /></Field>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2">SKU</th><th className="px-2 py-2 text-right">Cartons</th><th className="px-2 py-2 text-right">Units/ctn</th><th className="px-2 py-2 text-right">Packed</th><th className="px-3 py-2">FC</th></tr></thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5"><div className="font-mono text-[12px] font-semibold">{r.sku}</div><div className="text-[10px] text-muted-foreground">{r.product_name}</div></td>
                  <td className="px-2 py-1.5 text-right"><input type="number" value={r.cartons || ""} onChange={(e) => setRow(i, { cartons: numv(e.target.value) })} className="w-16 rounded-md border bg-background px-2 py-1 text-right font-mono text-[12px]" /></td>
                  <td className="px-2 py-1.5 text-right"><input type="number" value={r.per_ctn || ""} onChange={(e) => setRow(i, { per_ctn: numv(e.target.value) })} className="w-16 rounded-md border bg-background px-2 py-1 text-right font-mono text-[12px]" /></td>
                  <td className="tabular px-2 py-1.5 text-right font-mono font-semibold">{num((r.cartons || 0) * (r.per_ctn || 0))}</td>
                  <td className="px-3 py-1.5"><input value={r.fc ?? ""} onChange={(e) => setRow(i, { fc: e.target.value || null })} className="w-24 rounded-md border bg-background px-2 py-1 text-[12px]" placeholder="FC" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function LinkFbaModal({ shipment, orderId, unlinked, onClose, onSaved }: { shipment: ShipmentRow; orderId: string; unlinked: InboundRow[]; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<"existing" | "new">(unlinked.length ? "existing" : "new");
  const [pick, setPick] = useState("");
  const [fc, setFc] = useState("");
  const [expected, setExpected] = useState(String(shipment.packed || ""));
  const [refId, setRefId] = useState("");
  const [etaFrom, setEtaFrom] = useState("");
  const [etaTo, setEtaTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canSave = mode === "existing" ? !!pick : !!fc.trim();
  const save = async () => {
    setSaving(true); setErr(null);
    const r = mode === "existing"
      ? await linkExistingFbaInbound(orderId, shipment.id, pick)
      : await linkFbaInbound(orderId, shipment.id, { fc, expected: Number(expected) || 0, mode: shipment.mode, reference_id: refId, eta_from: etaFrom, eta_to: etaTo });
    setSaving(false); if (r.ok) onSaved(); else setErr(r.error);
  };
  return (
    <Modal open onClose={onClose} title="Link FBA inbound" subtitle="Attach an Amazon inbound to this shipment — the order is set automatically from the shipment."
      footer={<div className="flex justify-end gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="button" onClick={save} disabled={saving || !canSave}>{saving ? "Linking…" : "Link inbound"}</PrimaryButton></div>}>
      <div className="space-y-4">
        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        {unlinked.length > 0 && (
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setMode("existing")} className={cn("vy-chip", mode === "existing" && "is-active")}>Link existing</button>
            <button type="button" onClick={() => setMode("new")} className={cn("vy-chip", mode === "new" && "is-active")}>Create new</button>
          </div>
        )}
        {mode === "existing" ? (
          <Field label="Unlinked Amazon inbound"><Select value={pick} onChange={setPick} placeholder="Pick an inbound from FBA Shipments…" searchable options={unlinked.map((u) => ({ value: u.id, label: u.id, sub: `${u.fc} · ${num(u.expected)} exp${u.reference_id ? ` · ref ${u.reference_id}` : ""}` }))} /></Field>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fulfillment center (FC)"><input className={inputCls} value={fc} onChange={(e) => setFc(e.target.value)} placeholder="e.g. ONT8" autoFocus /></Field>
              <Field label="Expected units"><input type="number" className={inputCls} value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="0" /></Field>
              <Field label="Reference ID (optional)"><input className={inputCls} value={refId} onChange={(e) => setRefId(e.target.value)} placeholder="Amazon ref / your ref" /></Field>
              <div className="hidden sm:block" />
              <Field label="FBA arrival — from"><input className={inputCls} value={etaFrom} onChange={(e) => setEtaFrom(e.target.value)} placeholder="e.g. Jul 10" /></Field>
              <Field label="FBA arrival — to"><input className={inputCls} value={etaTo} onChange={(e) => setEtaTo(e.target.value)} placeholder="e.g. Jul 17" /></Field>
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">The forwarder often gives a window (e.g. &quot;hits FBA in 10–15 days&quot;). Enter it here to track the expected FBA arrival.</p>
          </>
        )}
      </div>
    </Modal>
  );
}

function PasteModal({ shipment, orderId, onClose, onSaved }: { shipment: ShipmentRow; orderId: string; onClose: () => void; onSaved: () => void }) {
  const [tracking, setTracking] = useState("");
  const [eta, setEta] = useState(shipment.eta ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); const r = await pasteTrackingUpdate(shipment.id, orderId, tracking.trim() || null, eta.trim() || null); setSaving(false); if (r.ok) onSaved(); };
  return (
    <Modal open onClose={onClose} title="Paste tracking update" subtitle="Fill the tracking number & ETA from the forwarder's booking email."
      footer={<div className="flex justify-end gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</PrimaryButton></div>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tracking / booking no."><input className={inputCls} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. PSL-NGB-240612" autoFocus /></Field>
        <Field label="ETA"><input className={inputCls} value={eta} onChange={(e) => setEta(e.target.value)} placeholder="e.g. Jun 24" /></Field>
      </div>
    </Modal>
  );
}
