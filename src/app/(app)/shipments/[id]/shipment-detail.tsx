"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/primitives";
import { StatCard, GridField } from "@/components/ui/detail";
import { num, money, SHIPMENT_STAGES, SHIPMENT_STAGE_TONE, CUSTOMS_TONE, type Tone } from "@/lib/derive";
import { STATUS17_TONE } from "@/lib/track17";
import { cn } from "@/lib/utils";
import { ShipmentModal, TrackingModal, type ShipRow, type OrderOpt } from "../shipments-table";
import { syncShipmentTracking, advanceShipmentStage, setShipmentArchived, updateShipment } from "../actions";
import {
  ChevronRight, Ship, MapPin, Factory, Truck, Package, Pencil, Check, RefreshCw, ArrowRight,
  ArrowUpRight, Boxes, Shield, AlertCircle, Loader2, Archive, Plus, Clipboard,
} from "lucide-react";

type Checkpoint = { time: string | null; description: string; location: string; stage: string | null };
const FBA_TONE: Record<string, Tone> = { Working: "muted", Shipped: "info", "In transit": "info", Receiving: "warning", Closed: "success", Problem: "danger" };

// Incoterm → who clears customs + pays import duties (the importer's key question).
function incoterm(term: string | null): { customsBy: string; dutiesBy: string; needsBroker: boolean; tone: Tone; blurb: string } {
  const t = (term || "").toUpperCase();
  const map: Record<string, { customsBy: string; dutiesBy: string; needsBroker: boolean; tone: Tone; blurb: string }> = {
    DDP: { customsBy: "Seller / forwarder", dutiesBy: "Seller / forwarder", needsBroker: false, tone: "success", blurb: "Delivered Duty Paid — the seller/forwarder clears customs and pays all duties & taxes. Nothing more for you at the border; it's baked into the freight price." },
    DAP: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Delivered At Place — the forwarder delivers, but YOU are importer of record: you clear customs and pay duties & taxes on arrival. Line up a customs broker." },
    CIF: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Cost, Insurance & Freight — seller covers freight to the destination port; you handle import customs, duties and final delivery. Broker needed." },
    CFR: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Cost & Freight — seller pays freight to the port; you handle import customs + duties. Broker needed." },
    FOB: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Free On Board — your responsibility starts at the origin port: ocean freight, import customs and duties are yours. Broker needed." },
    FCA: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Free Carrier — seller hands off to your carrier at origin; import customs and duties are yours." },
    EXW: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "danger", blurb: "Ex Works — you handle everything from the factory door: export + import customs, freight and all duties. Broker needed." },
  };
  return map[t] || { customsBy: "—", dutiesBy: "—", needsBroker: true, tone: "muted", blurb: "Set the incoterm to see who clears customs and pays import duties." };
}

export function ShipmentDetail({ row: s, checkpoints, liveStatus, track17Connected, orders, suppliers, forwarders }: {
  row: ShipRow; checkpoints: Checkpoint[]; liveStatus: string | null; track17Connected: boolean;
  orders: OrderOpt[]; suppliers: string[]; forwarders: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fbaReceived = s.fba.reduce((n, f) => n + f.received, 0);
  const fbaExpected = s.fba.reduce((n, f) => n + f.expected, 0);
  const curIdx = SHIPMENT_STAGES.indexOf(s.stage as typeof SHIPMENT_STAGES[number]);
  const hasTracking = !!s.tracking?.trackingNo;
  const atEnd = curIdx >= SHIPMENT_STAGES.length - 1;
  const ic = incoterm(s.incoterm);
  const icTone = ic.tone;

  const doSync = () => { setErr(null); start(async () => { const r = await syncShipmentTracking(s.id); if (!r.ok) setErr(r.error); router.refresh(); }); };
  const doAdvance = () => start(async () => { await advanceShipmentStage(s.id); router.refresh(); });
  const doArchive = () => start(async () => { await setShipmentArchived(s.id, !s.archived); router.refresh(); });

  const kpis = [
    { label: "Stage", value: s.stage, sub: s.eta ? `ETA ${s.eta}` : "—", tone: SHIPMENT_STAGE_TONE[s.stage] },
    { label: "Packed", value: num(s.packed), sub: "units" },
    { label: "Volume", value: s.cbm ? `${s.cbm} CBM` : "—", sub: s.gross_kg ? `${s.gross_kg} kg` : "—" },
    { label: "Cartons", value: s.cartons ?? "—", sub: "boxes" },
    { label: "Freight", value: s.freight_usd ? money(s.freight_usd) : "—", sub: s.incoterm ?? "—" },
    { label: "FBA received", value: `${num(fbaReceived)} / ${num(fbaExpected)}`, sub: `${s.fba.length} inbound${s.fba.length === 1 ? "" : "s"}`, tone: (s.fba.length ? (fbaReceived >= fbaExpected && fbaExpected > 0 ? "success" : "info") : undefined) as Tone | undefined },
  ];

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link href="/shipments" className="hover:text-foreground">Operations</Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <Link href="/shipments" className="hover:text-foreground">Shipments</Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <span className="font-medium text-foreground">{s.id}</span>
      </nav>

      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-2xl font-bold">{s.id}</h1>
              <Badge tone={SHIPMENT_STAGE_TONE[s.stage] ?? "muted"}>{s.stage}</Badge>
              {s.customs && <Badge tone={CUSTOMS_TONE[s.customs] ?? "muted"}>Customs: {s.customs}</Badge>}
              {s.archived && <Badge tone="muted">Archived</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="vy-chip inline-flex items-center gap-1"><Ship className="h-3 w-3" />{s.mode}</span>
              <span className="vy-chip inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.origin || "—"} → {s.destination || "—"}</span>
              {s.supplier && <span className="vy-chip inline-flex items-center gap-1"><Factory className="h-3 w-3" />{s.supplier}</span>}
              {s.forwarder && <span className="vy-chip inline-flex items-center gap-1"><Truck className="h-3 w-3" />{s.forwarder}</span>}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {s.order_id && <Link href={`/orders/${s.order_id}`} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Open in order</Link>}
            <button onClick={() => setEditing(true)} className="vy-btn vy-btn--outline inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button onClick={doArchive} disabled={pending} className="vy-btn vy-btn--ghost inline-flex items-center gap-1.5"><Archive className="h-3.5 w-3.5" /> {s.archived ? "Unarchive" : "Archive"}</button>
          </div>
        </div>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => <StatCard key={k.label} label={k.label} value={k.value} sub={k.sub} tone={k.tone} />)}
      </div>

      {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}

      <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Tracking */}
        <Card className="p-5">
          <div className="mb-3.5 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><MapPin className="h-4 w-4" /></span>
              <div><div className="font-semibold">Tracking</div><p className="text-[11px] text-muted-foreground">Forwarder leg — vessel/air until Amazon takes custody at the FC.</p></div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {hasTracking && track17Connected && <button onClick={doSync} disabled={pending} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5">{pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Sync</button>}
              {hasTracking && !atEnd && <button onClick={doAdvance} disabled={pending} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1.5"><ArrowRight className="h-3 w-3" /> Advance</button>}
              <button onClick={() => setTrackingOpen(true)} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1.5">{hasTracking ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {hasTracking ? "Edit" : "Add"}</button>
            </div>
          </div>

          {hasTracking ? (
            <>
              <div className="mb-3 flex items-center gap-2">
                {liveStatus ? <Badge tone={STATUS17_TONE[liveStatus] ?? "muted"}>{liveStatus}</Badge> : <Badge tone={SHIPMENT_STAGE_TONE[s.stage] ?? "muted"}>{s.stage}</Badge>}
                <span className="font-mono text-[11px] text-muted-foreground">{s.tracking!.trackingNo}</span>
                <span className="ml-auto text-[10.5px] text-muted-foreground">{track17Connected ? `17TRACK${s.tracking!.lastSync ? " · synced" : ""}` : "17TRACK not connected"}</span>
              </div>
              {/* live checkpoints, else stage-derived timeline */}
              {checkpoints.length > 0 ? (
                <Timeline items={[...checkpoints].reverse().map((c, i, arr) => ({ label: c.description || c.stage || "Update", sub: [c.location, fmtTime(c.time)].filter(Boolean).join(" · "), done: true, cur: i === arr.length - 1 }))} />
              ) : (
                <Timeline items={SHIPMENT_STAGES.map((st, i) => ({ label: st, sub: i > curIdx ? "pending" : "", done: i <= curIdx, cur: i === curIdx }))} />
              )}
              {!track17Connected && <Link href="/integrations/track17" className="mt-3 inline-flex vy-btn vy-btn--outline vy-btn--sm items-center gap-1.5"><LinkIconDummy /> Connect 17TRACK</Link>}
            </>
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-[12.5px] text-muted-foreground">No tracking number yet. Add one once the forwarder books this shipment.</div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {/* Logistics */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-primary/12 text-primary"><Truck className="h-4 w-4" /></span><div className="font-semibold">Logistics</div></div>
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-background/40 [&>*]:border-t [&>*:nth-child(-n+2)]:border-t-0 [&>*:nth-child(odd)]:border-l-0 [&>*]:border-l">
              <GridField label="ETD" value={<span className="font-mono">{s.etd || "—"}</span>} />
              <GridField label="ETA" value={<span className="font-mono">{s.eta || "—"}</span>} />
              <GridField label="Mode" value={s.mode} />
              <GridField label="Forwarder" value={s.forwarder || "—"} />
              <GridField label="Incoterm" value={s.incoterm || "—"} />
              <GridField label="BOL / AWB" value={<span className="font-mono text-[12px]">{s.bol || "—"}</span>} />
            </div>
          </Card>
          {/* Cargo */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-muted text-muted-foreground"><Boxes className="h-4 w-4" /></span><div className="font-semibold">Cargo</div></div>
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-background/40 [&>*]:border-t [&>*:nth-child(-n+2)]:border-t-0 [&>*:nth-child(odd)]:border-l-0 [&>*]:border-l">
              <GridField label="Packed (units)" value={<span className="font-mono">{num(s.packed)}</span>} />
              <GridField label="CBM" value={<span className="font-mono">{s.cbm ?? "—"}</span>} />
              <GridField label="Gross (kg)" value={<span className="font-mono">{s.gross_kg ? `${s.gross_kg} kg` : "—"}</span>} />
              <GridField label="Cartons" value={<span className="font-mono">{s.cartons ?? "—"}</span>} />
              <GridField label="Freight (USD)" value={<span className="font-mono">{s.freight_usd ? money(s.freight_usd) : "—"}</span>} />
            </div>
          </Card>
        </div>
      </div>

      {/* Customs & duties */}
      <Card className="p-5">
        <div className="mb-3.5 flex items-center gap-2.5"><span className={cn("inline-grid h-7 w-7 place-items-center rounded-md")} style={{ background: `hsl(var(--${icTone === "muted" ? "primary" : icTone}) / 0.12)`, color: `hsl(var(--${icTone === "muted" ? "primary" : icTone}))` }}><Shield className="h-4 w-4" /></span><div><div className="font-semibold">Customs &amp; duties</div><p className="text-[11px] text-muted-foreground">Who clears customs and pays import duties — decided by the incoterm.</p></div></div>
        <div className="mb-3.5 flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: `hsl(var(--${icTone === "muted" ? "border" : icTone}) / 0.3)`, background: `hsl(var(--${icTone === "muted" ? "muted" : icTone}) / 0.06)` }}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md" style={{ background: `hsl(var(--${icTone === "muted" ? "primary" : icTone}) / 0.15)`, color: `hsl(var(--${icTone === "muted" ? "primary" : icTone}))` }}>{ic.needsBroker ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">{s.incoterm && <Badge tone="info">{s.incoterm}</Badge>}<span className="text-[13px] font-bold" style={{ color: `hsl(var(--${icTone === "muted" ? "foreground" : icTone}))` }}>{ic.needsBroker ? "You clear & pay import" : "Seller / forwarder handles import"}</span></div>
            <div className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{ic.blurb}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-background/40 [&>*]:border-t [&>*:nth-child(-n+2)]:border-t-0 [&>*:nth-child(odd)]:border-l-0 [&>*]:border-l">
          <GridField label="Customs cleared by" value={ic.customsBy} />
          <GridField label="Duties & taxes paid by" value={ic.dutiesBy} />
          <GridField label="Customs broker" value={s.broker || (ic.needsBroker ? "— (recommended)" : "Not needed")} />
          <GridField label="Duties & taxes (USD)" value={<span className="font-mono">{s.duties_usd ? money(s.duties_usd) : (ic.needsBroker ? "—" : "In freight price")}</span>} />
        </div>
      </Card>

      {/* FBA inbounds */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-success/12 text-success"><Package className="h-4 w-4" /></span><div><div className="font-semibold">FBA inbounds · Amazon leg ({s.fba.length})</div><p className="text-[11px] text-muted-foreground">Once cargo reaches the FC, Amazon owns the receive — these sync from Seller Central.</p></div></div>{s.fba.length > 0 && <Link href="/fba-shipments" className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5">View all <ArrowRight className="h-3 w-3" /></Link>}</div>
        {s.fba.length ? (
          <div className="space-y-2">
            {s.fba.map((f) => {
              const variance = f.received > 0 ? f.received - f.expected : 0;
              return (
                <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-background/40 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1"><div className="font-mono text-[12.5px] font-bold">{f.id}</div><div className="mt-1 flex items-center gap-1.5"><Badge tone="muted">{f.fc}</Badge><Badge tone={FBA_TONE[f.amazonStatus] ?? "muted"}>{f.amazonStatus}</Badge><span className="text-[10.5px] text-muted-foreground">{f.skuCount} SKU{f.skuCount === 1 ? "" : "s"}</span></div></div>
                  <div className="flex gap-4 font-mono text-[12.5px]">
                    <div><div className="vy-kicker">Exp</div><div className="font-bold">{num(f.expected)}</div></div>
                    <div><div className="vy-kicker">Rec</div><div className="font-bold">{f.received > 0 ? num(f.received) : "—"}</div></div>
                    <div><div className="vy-kicker">Var</div><div className="font-bold" style={{ color: `hsl(var(--${f.received <= 0 ? "muted-foreground" : variance < 0 ? "danger" : variance > 0 ? "warning" : "success"}))` }}>{f.received <= 0 ? "—" : `${variance > 0 ? "+" : ""}${variance}`}</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="rounded-lg border border-dashed px-4 py-5 text-center text-[12.5px] text-muted-foreground">No FBA inbounds linked yet — they appear here once Amazon creates the inbound for this shipment.</div>}
      </Card>

      {/* Order */}
      {s.order_id && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-primary/12 text-primary"><Package className="h-4 w-4" /></span><div className="font-semibold">Order</div></div>
          <Link href={`/orders/${s.order_id}`} className="flex items-center gap-3.5 rounded-lg border bg-background/40 px-4 py-3 hover:border-primary/40">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary"><Package className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><div className="font-mono text-[11px] text-muted-foreground">{s.order_id}</div><div className="text-[13.5px] font-semibold">{s.order_title}</div></div>
            <ArrowRight className="h-4 w-4 shrink-0 opacity-50" />
          </Link>
        </Card>
      )}

      {editing && <ShipmentModal title={`Edit ${s.id}`} shipment={s} orders={orders} suppliers={suppliers} forwarders={forwarders} onClose={() => setEditing(false)} onSubmit={(fd) => updateShipment(s.id, fd)} />}
      {trackingOpen && <TrackingModal s={s} onClose={() => setTrackingOpen(false)} />}
    </div>
  );
}

function Timeline({ items }: { items: { label: string; sub: string; done: boolean; cur: boolean }[] }) {
  return (
    <div className="flex flex-col">
      {items.map((e, i) => {
        const color = e.done ? (e.cur ? "hsl(var(--primary))" : "hsl(var(--success))") : "hsl(var(--border))";
        const nextDone = i < items.length - 1 && items[i + 1].done;
        return (
          <div key={i} className="flex min-h-[34px] gap-3">
            <div className="flex flex-col items-center self-stretch">
              <span className="mt-1 grid h-3 w-3 shrink-0 place-items-center rounded-full" style={{ background: e.done ? color : "hsl(var(--card))", border: `2px solid ${color}` }}>{e.done && <Check className="h-[7px] w-[7px] text-white" strokeWidth={4} />}</span>
              {i < items.length - 1 && <span className="my-0.5 w-0.5 flex-1" style={{ background: nextDone ? "hsl(var(--success))" : "hsl(var(--border))" }} />}
            </div>
            <div className={cn("min-w-0", i < items.length - 1 && "pb-3")}>
              <div className={cn("text-[13px]", e.cur ? "font-bold text-primary" : e.done ? "font-semibold" : "font-semibold text-muted-foreground")}>{e.label}</div>
              {e.sub && <div className={cn("mt-px text-[11px] text-muted-foreground", !e.done && "italic")}>{e.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LinkIconDummy() { return <Clipboard className="h-3 w-3" />; }

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
