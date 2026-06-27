"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, KpiStrip, SectionHeader, Chip, SectionTitle } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useFormModal } from "@/lib/use-form-modal";
import { updateOrder, setOrderStatus, addOrderPackaging, removeOrderPackaging } from "../actions";
import { createInvoice, updateInvoice, deleteInvoice } from "../../invoices/actions";
import { InvoiceQuickDrawer } from "../../invoices/invoice-quick-drawer";
import { RecordPaymentModal, InvoiceModal, type InvRow, type VendorOpt } from "../../invoices/invoices-table";
import { ProductionSection, type CatalogVariant } from "./production-panel";
import { LandedPanel } from "./landed-panel";
import { InspectionPanel } from "./inspection-panel";
import { ShippingPanel, type ShipmentRow, type InboundRow, type PackLine, type ShipFile, type TrackRow, type OrderedLine, type FreightInvoice } from "./shipping-panel";
import type { Database } from "@/lib/database.types";

type Inspection = Database["public"]["Tables"]["order_inspections"]["Row"];
import {
  money, num, ORDER_STATUS_TONE, ORDER_STATUS_LABEL, ORDER_PIPELINE, orderNeeds, poVsInvoiced,
  BALANCE_EPSILON, INVOICE_STATUS_TONE, invoiceBalance, invoiceStatus, invoiceAging, payTermSummary,
  PAYTERM_TYPES, PAYTERM_BY_KEY,
  type OrderRow, type PayTermCfg, type OrderCostRow, type CostCheck,
} from "@/lib/derive";
import { cn } from "@/lib/utils";
import {
  Factory, Route, Pencil, Check, Hammer, ClipboardCheck, Truck, Receipt,
  PackageCheck, LayoutDashboard, ChevronRight, ChevronLeft, AlertCircle, Plus, Trash2, Boxes,
  Home, Activity, ArrowRight, Calendar, DollarSign, ShieldCheck, Info,
} from "lucide-react";
import { Drawer, DrawerGuard } from "@/components/ui/drawer";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { deriveOrderActivity } from "@/lib/activity";

// Top tab bar (matches the prototype: Home · Production · Shipping · Invoices · Landed cost)
const TABS = [
  { key: "overview", label: "Home", icon: Home },
  { key: "production", label: "Production", icon: Hammer },
  { key: "inspection", label: "Inspection", icon: ClipboardCheck },
  { key: "shipping", label: "Shipping", icon: Truck },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "landed", label: "Landed cost", icon: PackageCheck },
];
// Owning-section lifecycle nodes for the Order Journey strip.
const JOURNEY = [
  { key: "production", label: "Production", icon: Hammer },
  { key: "inspection", label: "Inspection", icon: ClipboardCheck },
  { key: "shipping", label: "Shipping", icon: Truck },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "landed", label: "Landed cost", icon: PackageCheck },
];
const STATUS_IDX: Record<string, number> = { draft: 0, production: 1, inspection: 2, transit: 3, fba: 4, closed: 5 };

type OrderLine = { id: string; sku: string | null; product_name: string | null; family_id: string | null; qty: number; unit_cost: number | null; unit_cny_ref: number | null };
type ChargeTypeOpt = { id: string; label: string; owner: string };
type PkgItemOpt = { id: string; name: string; kind: string; unit_cost: number };
type PkgUsed = { moveId: string; itemId: string; name: string; qty: number; unitCost: number };
export type { ShipmentRow as OrderShipment, InboundRow as OrderInbound } from "./shipping-panel";

type Tone = "brand" | "success" | "info" | "warning" | "muted" | "danger";
const SECTIONS: { key: string; label: string; icon: React.ElementType; tone: Tone }[] = [
  { key: "overview", label: "Home", icon: LayoutDashboard, tone: "muted" },
  { key: "production", label: "Production", icon: Hammer, tone: "brand" },
  { key: "inspection", label: "Inspection", icon: ClipboardCheck, tone: "success" },
  { key: "shipping", label: "Shipping", icon: Truck, tone: "info" },
  { key: "invoices", label: "Invoices", icon: Receipt, tone: "warning" },
  { key: "landed", label: "Landed cost", icon: PackageCheck, tone: "success" },
];

export function OrderShell({ order, invoices, vendors, lines, costs, chargeTypes, companyName, orderFiles, packagingOnHand, variants, packagingItems, packaging, shipments, inbounds, packLines, shipFiles, shipTracking, forwarders, suppliers, agents, freightInvoice, ordered, unlinkedInbounds, inspection, rollup, nowMs, initialTab = "overview" }: {
  order: OrderRow;
  invoices: InvRow[];
  vendors: VendorOpt[];
  lines: OrderLine[];
  costs: OrderCostRow[];
  chargeTypes: ChargeTypeOpt[];
  companyName: string;
  orderFiles: { slot: string; name: string | null; url: string }[];
  packagingOnHand: { id: string; name: string; kind: string; unitCost: number; onHand: number }[];
  variants: CatalogVariant[];
  packagingItems: PkgItemOpt[];
  packaging: PkgUsed[];
  shipments: ShipmentRow[];
  inbounds: InboundRow[];
  packLines: PackLine[];
  shipFiles: ShipFile[];
  shipTracking: TrackRow[];
  forwarders: string[];
  suppliers: string[];
  agents: string[];
  freightInvoice: FreightInvoice | null;
  ordered: OrderedLine[];
  unlinkedInbounds: InboundRow[];
  inspection: Inspection | null;
  rollup: { total: number; paid: number; balance: number; paidPct: number; invoiceCount: number };
  nowMs: number;
  initialTab?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  // Inspection is opt-in per order — hide its tab when not required (route to Home if landed there).
  const showInspection = order.inspection_required;
  const visibleTabs = TABS.filter((t) => t.key !== "inspection" || showInspection);
  const activeTab = tab === "inspection" && !showInspection ? "overview" : tab;
  // Remember the active tab in the URL so a refresh stays on it (not back to Home).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") !== tab) { url.searchParams.set("tab", tab); window.history.replaceState(null, "", url.toString()); }
  }, [tab]);
  const [editing, setEditing] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [pending, start] = useTransition();
  const activity = useMemo(() => deriveOrderActivity(order.id, { placedOn: order.placed_on, invoices, inspection, shipments }), [order.id, order.placed_on, invoices, inspection, shipments]);
  const curIdx = ORDER_PIPELINE.findIndex((p) => p.key === order.status);
  const units = lines.reduce((s, l) => s + (l.qty ?? 0), 0);
  // PO (planned) vs invoiced (actual) goods cost — surfaced on Home + Production.
  const costCheck = poVsInvoiced(lines, invoices);
  const advance = (key: string) => start(async () => { await setOrderStatus(order.id, key); router.refresh(); });

  return (
    <div className="space-y-5">
      {/* page switcher: breadcrumb + single segmented pill bar */}
      <div className="vy-order-shell-head">
        <nav className="vy-breadcrumb" aria-label="Breadcrumb">
          <Link href="/orders" className="vy-bc-link">Orders</Link>
          <ChevronRight className="vy-bc-sep h-3 w-3" />
          <span className="vy-bc-id">{order.id}</span>
          <ChevronRight className="vy-bc-sep h-3 w-3" />
          <span className="vy-bc-current">{TABS.find((t) => t.key === activeTab)?.label ?? "Home"}</span>
        </nav>

        <div className="vy-pageswitch" role="tablist">
        {visibleTabs.map((t) => {
          const I = t.icon; const active = activeTab === t.key;
          return (
            <button key={t.key} role="tab" aria-selected={active} onClick={() => setTab(t.key)}
              className={cn("vy-page-pill", active && "is-active")}>
              <I className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
        </div>
      </div>

      <div key={activeTab} className="vy-page-in">
      {activeTab === "overview" ? (
        <Overview order={order} rollup={rollup} units={units} skuCount={lines.length} curIdx={curIdx} onJump={setTab} onAdvance={advance} onEdit={() => setEditing(true)} onOpenActivity={() => setActivityOpen(true)} pending={pending} costCheck={costCheck} />
      ) : activeTab === "invoices" ? (
        <InvoicesPanel order={order} invoices={invoices} vendors={vendors} lines={lines} chargeTypes={chargeTypes} />
      ) : activeTab === "shipping" ? (
        <ShippingPanel order={order} shipments={shipments} inbounds={inbounds} packLines={packLines} shipFiles={shipFiles} tracking={shipTracking} ordered={ordered} forwarders={forwarders} freightInvoice={freightInvoice} unlinkedInbounds={unlinkedInbounds} />
      ) : activeTab === "production" ? (
        <div className="space-y-6">
          <ProductionSection order={order} lines={lines} costs={costs} variants={variants} chargeTypes={chargeTypes} vendors={vendors} companyName={companyName} orderFiles={orderFiles} packagingOnHand={packagingOnHand} costCheck={costCheck} />
          <PackagingPanel orderId={order.id} items={packagingItems} used={packaging} />
        </div>
      ) : activeTab === "landed" ? (
        <LandedPanel order={order} lines={lines} costs={costs} variants={variants} />
      ) : activeTab === "inspection" ? (
        <InspectionPanel order={order} inspection={inspection} orderFiles={orderFiles} />
      ) : (
        <StagePanel tab={activeTab} status={order.status} />
      )}
      </div>

      {editing && <EditOrderModal order={order} suppliers={suppliers} agents={agents} onClose={() => setEditing(false)} />}

      <Drawer open={activityOpen} onClose={() => setActivityOpen(false)} width={480}
        title="Order activity" subtitle={<span className="font-mono">{order.id}</span>}
        footer={<Link href="/activity" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline">See full journal <ArrowRight className="h-3.5 w-3.5" /></Link>}>
        <ActivityFeed events={activity} nowMs={nowMs} variant="drawer" />
      </Drawer>
    </div>
  );
}

function Overview({ order, rollup, units, skuCount, curIdx, onJump, onAdvance, onEdit, onOpenActivity, pending, costCheck }: {
  order: OrderRow; rollup: { total: number; paid: number; balance: number; paidPct: number; invoiceCount: number };
  units: number; skuCount: number; curIdx: number; onJump: (k: string) => void; onAdvance: (k: string) => void; onEdit: () => void; onOpenActivity: () => void; pending: boolean; costCheck: CostCheck;
}) {
  const needs = orderNeeds({ status: order.status, balance: rollup.balance, paidPct: rollup.paidPct, units, supplier: order.supplier });
  const top = needs[0];
  const sIdx = STATUS_IDX[order.status] ?? 0;
  const next = ORDER_PIPELINE[curIdx + 1];
  const liveTone = ORDER_STATUS_TONE[order.status] ?? "muted";

  function nodeState(key: string): "done" | "current" | "upcoming" | "skipped" | "open" {
    if (key === "inspection" && !order.inspection_required) return "skipped";
    if (key === "invoices") return rollup.balance <= 0.5 && rollup.total > 0 ? "done" : "open";
    const at: Record<string, number> = { production: 1, inspection: 2, shipping: 3, landed: 4 };
    const cur = key === "shipping" ? 3 : key === "landed" ? (sIdx >= 5 ? 99 : 4) : at[key];
    if (key === "landed") return sIdx >= 5 ? "done" : sIdx === 4 ? "current" : "upcoming";
    if (sIdx > cur) return "done";
    if (sIdx === cur) return "current";
    return "upcoming";
  }
  const stTone: Record<string, Tone> = { done: "success", current: "brand", open: "warning", upcoming: "muted", skipped: "muted" };
  const stPill: Record<string, string> = { done: "Done", current: "Current", open: "Balance due", upcoming: "Open", skipped: "Skipped" };

  return (
    <div className="space-y-5">
      {/* Header — identity + next action (shared SectionHeader) */}
      <SectionHeader
        title={order.title}
        blurb="Hub for this purchase order. Track every stage at a glance — the work happens inside each owning section."
        topBadges={<>
          <Badge tone="muted">{order.id}</Badge>
          <Badge tone={liveTone}>{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge>
        </>}
        actions={<>
          <button onClick={onOpenActivity} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Activity</button>
          <button onClick={onEdit} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</button>
        </>}
        badges={<>
          <Chip icon={Route}>Agent · {order.agent ?? "Direct"}</Chip>
          {order.supplier && <Chip icon={Factory}>Factory · {order.supplier}</Chip>}
          {units > 0 && <Chip icon={Boxes}>{num(units)} units</Chip>}
          {order.placed_on && <Chip icon={Calendar}>Placed {order.placed_on}</Chip>}
        </>}
        nextAction={top ? {
          severity: top.severity,
          headline: top.headline,
          detail: top.detail,
          cta: <button onClick={() => onJump(top.section)} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5">Open {top.sectionLabel} <ArrowRight className="h-4 w-4" /></button>,
        } : null}
      />

      {/* KPI strip */}
      <KpiStrip cols={5}>
        <Kpi label="Order total" value={rollup.total > 0 ? money(rollup.total) : "—"} sub={`${num(units)} units · ${skuCount} SKU${skuCount === 1 ? "" : "s"}`} icon={Receipt} />
        <Kpi label="Paid" value={money(rollup.paid)} sub={`${rollup.paidPct}% of total`} icon={Check} tone="success" progress={rollup.paidPct} />
        <Kpi label="Balance due" value={money(rollup.balance)} sub="Due before shipment" icon={AlertCircle} tone={rollup.balance > 0.5 ? "warning" : "success"} />
        <Kpi label="Units" value={num(units)} sub="Ordered scope" icon={Boxes} />
        <Kpi label="FBA ETA" value={order.fba_eta ?? "—"} sub="Estimated arrival" icon={Truck} source="amazon" />
      </KpiStrip>

      {/* PO vs invoiced cost check — warns when the supplier billed differs from the PO */}
      {costCheck.mismatch ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.3)" }}>
          <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
          <span><span className="font-semibold">PO price ≠ invoiced price.</span><span className="text-muted-foreground"> Planned {money(costCheck.poGoods)} vs invoiced {money(costCheck.invGoods)} (<span className={costCheck.variance > 0 ? "text-danger" : "text-success"}>{costCheck.variance > 0 ? "+" : ""}{money(costCheck.variance)}</span>). Reconcile so the PO matches the bill.</span></span>
          <button onClick={() => onJump("invoices")} className="vy-btn vy-btn--outline vy-btn--sm ml-auto">Review invoices</button>
        </div>
      ) : costCheck.hasInvoiceGoods ? (
        <div className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[12px]" style={{ background: "hsl(var(--success) / 0.06)", borderColor: "hsl(var(--success) / 0.25)" }}>
          <Check className="h-3.5 w-3.5 shrink-0 text-success" /><span className="text-muted-foreground"><span className="font-medium text-foreground">PO matches invoiced</span> — planned {money(costCheck.poGoods)} = invoiced {money(costCheck.invGoods)}.</span>
        </div>
      ) : null}

      {/* Order journey */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div><div className="vy-kicker">Order journey</div><p className="mt-0.5 text-[11.5px] text-muted-foreground">Where this order sits across its lifecycle. Click a stage to open it.</p></div>
          <div className="flex items-center gap-2">
            <Badge tone={liveTone}>{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge>
            <button disabled={curIdx <= 0 || pending} onClick={() => onAdvance(ORDER_PIPELINE[curIdx - 1].key)} className="vy-btn vy-btn--outline vy-btn--sm disabled:opacity-40" aria-label="Step back"><ChevronLeft className="h-3.5 w-3.5" /></button>
            {next ? <button disabled={pending} onClick={() => onAdvance(next.key)} className="vy-btn vy-btn--primary vy-btn--sm inline-flex items-center gap-1.5">Advance to {next.label} <ArrowRight className="h-3.5 w-3.5" /></button>
              : <Badge tone="success">Complete</Badge>}
          </div>
        </div>
        <div className="flex items-start">
          {JOURNEY.map((n, i) => {
            const st = nodeState(n.key); const Icon = n.icon;
            const tone = stTone[st];
            return (
              <div key={n.key} className="contents">
                <button onClick={() => st !== "skipped" && onJump(n.key)} disabled={st === "skipped"} className={cn("flex flex-1 flex-col items-center gap-1.5 px-1", st === "skipped" ? "cursor-default opacity-55" : "cursor-pointer")}>
                  <span className={cn("relative grid h-9 w-9 place-items-center rounded-xl", st === "current" && "ring-[3px] ring-primary/20")} style={{ background: `hsl(var(--${tone === "brand" ? "primary" : tone}) / 0.12)`, color: `hsl(var(--${tone === "brand" ? "primary" : tone}))`, border: st === "skipped" ? "1px dashed hsl(var(--muted-foreground) / 0.5)" : "none" }}>
                    <Icon className="h-[17px] w-[17px]" />
                    {st === "done" && <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full border-2 border-card bg-success text-white"><Check className="h-2 w-2" strokeWidth={4} /></span>}
                  </span>
                  <span className={cn("whitespace-nowrap text-[12.5px] font-semibold", st === "skipped" && "line-through")}>{n.label}</span>
                  <Badge tone={tone}>{stPill[st]}</Badge>
                </button>
                {i < JOURNEY.length - 1 && <div className="mt-[18px] h-0.5 flex-1 rounded" style={{ background: st === "done" ? "hsl(var(--success))" : "hsl(var(--border))" }} />}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Needs attention */}
      <Card className="p-5">
        <SectionTitle icon={AlertCircle} tone="warning" title="Needs attention" count={needs.length} />
        <p className="-mt-2 mb-3 text-[11.5px] text-muted-foreground">Derived from the owning sections. Read-only — fix it where it lives.</p>
        {needs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing needs attention — this order is on track.</p>
        ) : (
          <div className="space-y-2">
            {needs.map((n) => (
              <button key={n.key} onClick={() => onJump(n.section)} className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left hover:bg-accent/40">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", n.severity === "warning" ? "bg-warning" : n.severity === "danger" ? "bg-danger" : "bg-info")} />
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[13px] font-semibold">{n.headline}</span><span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{n.sectionLabel}</span></div><div className="text-[12px] text-muted-foreground">{n.detail}</div></div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const fmtDue = (iso: string | null) => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
const VENDOR_KIND: Record<string, string> = { Supplier: "Goods", Agent: "Service", Forwarder: "Freight", Inspection: "Inspection" };
function invTermCfg(i: InvRow): PayTermCfg { return { type: (i.term_type as PayTermCfg["type"]) ?? "TT", depositPct: i.term_deposit_pct, netDays: i.term_net_days }; }

function InvoicesPanel({ order, invoices, vendors, lines, chargeTypes }: { order: OrderRow; invoices: InvRow[]; vendors: VendorOpt[]; lines: OrderLine[]; chargeTypes: ChargeTypeOpt[] }) {
  const orderLinesLite = lines.map((l) => ({ id: l.id, sku: l.sku, product_name: l.product_name, qty: l.qty, unit_cost: l.unit_cost }));
  const router = useRouter();
  // Track the open invoice by ID and derive the LIVE row from props, so edits
  // (charges, payment terms…) reflect immediately after router.refresh().
  const [peekId, setPeekId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<InvRow | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const peek = peekId ? invoices.find((x) => x.id === peekId) ?? null : null;
  const editing = editingId ? invoices.find((x) => x.id === editingId) ?? null : null;
  const now = Date.now();

  const total = invoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const paid = invoices.reduce((s, i) => s + (i.paid ?? 0), 0);
  const balance = invoices.reduce((s, i) => s + invoiceBalance(i), 0);
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const openInv = invoices.filter((i) => invoiceBalance(i) > BALANCE_EPSILON);
  const nextDue = [...openInv].filter((i) => i.due).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""))[0] ?? null;
  const proofMissing = invoices.reduce((n, i) => n + i.payments.filter((p) => p.status === "Cleared" && !p.proof_url).length, 0);
  const partialCount = invoices.filter((i) => invoiceStatus(i) === "Partial").length;
  const orderOpts = [{ id: order.id, title: order.title }];

  return (
    <div className="space-y-5">
      {/* Header + next action (shared SectionHeader) */}
      <SectionHeader
        title="Invoices"
        blurb="Vendor bills, balances, payments, and proof of payment for this order."
        badges={<>
          {partialCount > 0 && <Badge tone="warning">{partialCount} partial</Badge>}
          {proofMissing > 0 && <Badge tone="warning">{proofMissing} proof missing</Badge>}
          {invoices.length === 0 && <Badge tone="muted">No invoices yet</Badge>}
        </>}
        nextAction={balance > BALANCE_EPSILON ? {
          headline: "Settle balance due",
          detail: `${money(balance)} open across ${openInv.length} ${openInv.length === 1 ? "invoice" : "invoices"}${nextDue ? ` · next due ${fmtDue(nextDue.due)}` : ""}`,
          cta: <button onClick={() => setPayFor(nextDue ?? openInv[0] ?? null)} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> Log payment</button>,
        } : null}
      />

      {/* KPI strip */}
      <KpiStrip cols={5}>
        <Kpi label="Total invoiced" value={total > 0 ? money(total) : "—"} sub={`${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"}`} icon={Receipt} />
        <Kpi label="Paid" value={money(paid)} sub={`${paidPct}% of total`} icon={Check} tone="success" progress={paidPct} />
        <Kpi label="Balance due" value={money(balance)} sub={`${openInv.length} open`} icon={DollarSign} tone={balance > BALANCE_EPSILON ? "warning" : "success"} />
        <Kpi label="Next due" value={nextDue ? fmtDue(nextDue.due) : "—"} sub={nextDue?.id ?? "All settled"} icon={Calendar} />
        <Kpi label="Proof missing" value={String(proofMissing)} sub="Receipts needed" icon={ShieldCheck} tone={proofMissing ? "warning" : "success"} />
      </KpiStrip>

      {/* Action banner */}
      {balance > BALANCE_EPSILON && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.3)" }}>
          <Badge tone="warning">Action needed</Badge>
          <span><span className="font-semibold">{money(balance)} balance due before shipment release</span><span className="text-muted-foreground"> · Log the payment, then upload its receipt as proof.</span></span>
          <button onClick={() => setPayFor(nextDue ?? openInv[0] ?? null)} className="vy-btn vy-btn--primary vy-btn--sm ml-auto inline-flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Log payment</button>
        </div>
      )}

      {/* Invoice cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {invoices.map((inv) => {
          const bal = invoiceBalance(inv); const st = invoiceStatus(inv); const a = invoiceAging(inv.due, bal, now);
          const pct = (inv.total ?? 0) > 0 ? Math.round(((inv.paid ?? 0) / (inv.total ?? 1)) * 100) : 0;
          const pm = inv.payments.filter((p) => p.status === "Cleared" && !p.proof_url).length;
          return (
            <Card key={inv.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button onClick={() => setPeekId(inv.id)} className="font-mono text-[13px] font-bold hover:text-primary">{inv.id}</button>
                  <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{inv.vendor} · {inv.vendor_type} · {VENDOR_KIND[inv.vendor_type] ?? "—"}</div>
                </div>
                <Badge tone={INVOICE_STATUS_TONE[st]}>{st}</Badge>
              </div>
              <div className="mt-2"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{payTermSummary(invTermCfg(inv))}</span></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", st === "Paid" ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} /></div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground"><span>{pct}% paid</span><span>{inv.payments.length} {inv.payments.length === 1 ? "payment" : "payments"}</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">
                <div><div className="vy-kicker">Total</div><div className="mt-0.5 font-mono text-[13px] font-semibold">{money(inv.total)}</div></div>
                <div><div className="vy-kicker">Paid</div><div className="mt-0.5 font-mono text-[13px] font-semibold text-success">{money(inv.paid)}</div></div>
                <div><div className="vy-kicker">Balance</div><div className="mt-0.5 font-mono text-[13px] font-semibold text-warning">{bal > BALANCE_EPSILON ? money(bal) : money(0)}</div></div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-2.5">
                {pm > 0 ? <span className="inline-flex items-center gap-1 text-[12px] text-warning"><AlertCircle className="h-3.5 w-3.5" /> {pm} proof missing</span>
                  : a.label !== "Settled" && inv.due ? <span className="text-[12px] text-muted-foreground">Due {fmtDue(inv.due)}</span> : <span className="text-[12px] text-muted-foreground">Settled</span>}
                <button onClick={() => setPeekId(inv.id)} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">Quick view <ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
            </Card>
          );
        })}

        {/* New invoice card */}
        <button onClick={() => setNewOpen(true)} className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-muted"><Plus className="h-5 w-5" /></span>
          <span className="text-[13px] font-semibold">New invoice</span>
          <span className="text-[11px]">Add a vendor bill to this order</span>
        </button>
      </div>

      <InvoiceQuickDrawer
        open={!!peek}
        invoice={peek}
        onClose={() => setPeekId(null)}
        onRecord={() => peek && setPayFor(peek)}
        onEdit={() => { if (peek) setEditingId(peek.id); }}
        onDelete={async () => { if (!peek || !confirm(`Delete ${peek.id}?`)) return; await deleteInvoice(peek.id); setPeekId(null); router.refresh(); }}
        orderLines={orderLinesLite}
        chargeTypes={chargeTypes}
      />
      {payFor && <RecordPaymentModal invoice={payFor} invoices={invoices} onClose={() => setPayFor(null)} />}
      {newOpen && <InvoiceModal title="New invoice" orders={orderOpts} vendors={vendors} lockedOrderId={order.id} onClose={() => setNewOpen(false)} onSubmit={(fd) => { fd.set("order_id", order.id); return createInvoice(fd); }} />}
      {editing && <InvoiceModal title={`Edit ${editing.id}`} invoice={editing} orders={orderOpts} vendors={vendors} lockedOrderId={order.id} onClose={() => setEditingId(null)} onSubmit={(fd) => updateInvoice(editing.id, fd)} />}
    </div>
  );
}

function PackagingPanel({ orderId, items, used }: { orderId: string; items: PkgItemOpt[]; used: PkgUsed[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false); // optional · collapsed by default
  const [itemId, setItemId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const totalCost = used.reduce((s, u) => s + u.qty * u.unitCost, 0);

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await addOrderPackaging(orderId, form);
      if (!res.ok) { setError(res.error); return; }
      setAdding(false); setItemId("");
      router.refresh();
    });
  }
  function onRemove(moveId: string) {
    start(async () => { await removeOrderPackaging(moveId, orderId); router.refresh(); });
  }

  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 px-5 py-4 text-left">
        <span className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-md bg-info/12 text-info"><Boxes className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="font-medium">Packaging used <span className="text-[11px] font-normal text-muted-foreground">· optional</span></div>
          <p className="text-[11px] text-muted-foreground">{used.length === 0 ? "Only if you supply packaging separately from the supplier price." : `${used.length} item${used.length === 1 ? "" : "s"} · ${money(totalCost)} drawn from stock.`}</p>
        </div>
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-90")} />
      </button>
      {open && (<div className="border-t p-5">
      <div className="mb-3 flex justify-end">{items.length > 0 && <GhostButton onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add packaging</GhostButton>}</div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
          No packaging items yet. Add some on the <Link href="/packaging" className="font-medium text-primary hover:underline">Packaging</Link> page first.
        </div>
      ) : used.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
          Optional — add packaging this order consumes and it&apos;s deducted from packaging stock.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Packaging</th>
                <th className="px-3 py-2 text-right font-medium">Qty used</th>
                <th className="px-3 py-2 text-right font-medium">Unit cost</th>
                <th className="px-3 py-2 text-right font-medium">Cost</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {used.map((u) => (
                <tr key={u.moveId}>
                  <td className="px-3 py-2 font-medium">{u.name}</td>
                  <td className="tabular px-3 py-2 text-right font-mono">{num(u.qty)}</td>
                  <td className="tabular px-3 py-2 text-right font-mono text-muted-foreground">{money(u.unitCost)}</td>
                  <td className="tabular px-3 py-2 text-right font-mono font-semibold">{money(u.qty * u.unitCost)}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => onRemove(u.moveId)} disabled={pending} className="vy-icon-btn" aria-label="Remove"><Trash2 className="h-3.5 w-3.5 text-danger" /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="px-3 py-2" colSpan={3}>Total packaging cost</td>
                <td className="tabular px-3 py-2 text-right font-mono">{money(totalCost)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">Adding packaging here records a consume move that deducts it from packaging on-hand. Remove a line to restore the stock.</p>
      </div>)}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add packaging used">
        <form onSubmit={onAdd} className="space-y-4">
          <Field label="Packaging">
            <Select name="item_id" value={itemId} onChange={setItemId} placeholder="Pick a packaging item…"
              options={items.map((i) => ({ value: i.id, label: i.name, sub: i.kind }))} />
          </Field>
          <Field label="Quantity used"><input name="qty" type="number" required autoFocus className={inputCls} placeholder="500" /></Field>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setAdding(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Adding…" : "Add packaging"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function StagePanel({ tab, status }: { tab: string; status: string }) {
  const meta: Record<string, { body: string }> = {
    production: { body: "Units, SKU breakdown and WIP milestones for this order. Production tracking lands with the catalog→order line items." },
    inspection: { body: "AQL inspection booking, report and pass/fail. Wires up when the inspection partner flow is connected." },
    shipping: { body: "Freight legs, forwarder, incoterm, ETD/ETA and FBA inbounds. Builds with the Logistics phase." },
    landed: { body: "Reconcile receiving and compute landed cost per unit, then close the order. Lights up once shipping + invoices are complete." },
  };
  const sec = SECTIONS.find((s) => s.key === tab)!;
  const Icon = sec.icon;
  return (
    <Card className="p-5">
      <SectionTitle icon={Icon} tone={sec.tone} title={sec.label} />
      <div className="rounded-lg border border-dashed bg-background/40 px-4 py-10 text-center">
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{meta[tab]?.body}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">Current order status: <span className="font-medium text-foreground">{ORDER_STATUS_LABEL[status] ?? status}</span></p>
      </div>
    </Card>
  );
}

function EditOrderModal({ order, suppliers, agents, onClose }: { order: OrderRow; suppliers: string[]; agents: string[]; onClose: () => void }) {
  const { error, pending, onSubmit } = useFormModal((form) => updateOrder(order.id, form), { onSuccess: onClose });
  const [title, setTitle] = useState(order.title);
  const [supplier, setSupplier] = useState(order.supplier ?? "");
  const [agent, setAgent] = useState(order.agent ?? "");
  const [placed, setPlaced] = useState(order.placed_on ?? "");
  const [eta, setEta] = useState(order.fba_eta ?? "");
  const [term, setTerm] = useState<string>(order.term_type ?? "TT");
  const [deposit, setDeposit] = useState<string>(order.term_deposit_pct != null ? String(order.term_deposit_pct) : "30");
  const [inspection, setInspection] = useState<boolean>(order.inspection_required);
  const [dirty, setDirty] = useState(false);
  const touch = () => setDirty(true);

  const t = PAYTERM_BY_KEY[term] ?? PAYTERM_BY_KEY.TT;
  const dep = parseFloat(deposit);
  const balance = Number.isFinite(dep) ? Math.max(0, 100 - dep) : null;
  const supplierOpts = [{ value: "", label: "— none —" }, ...[...new Set([order.supplier, ...suppliers].filter((x): x is string => !!x))].map((s) => ({ value: s, label: s }))];
  const agentOpts = [{ value: "", label: "Direct supplier" }, ...[...new Set([order.agent, ...agents].filter((x): x is string => !!x))].map((a) => ({ value: a, label: a }))];

  return (
    <Drawer
      open onClose={onClose} width={520}
      title={<span className="inline-flex items-baseline gap-2"><span className="font-medium">Edit order</span><span className="font-mono text-[12px] text-muted-foreground">{order.id}</span></span>}
      subtitle="The order's identity & terms. Units and SKUs live in Production; the order total comes from its invoices."
      footer={
        <div className="flex items-center justify-end gap-2">
          <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" form="edit-order-form" disabled={pending} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> {pending ? "Saving…" : "Save changes"}</PrimaryButton>
        </div>
      }
    >
      {/* Editable drawer → guard unsaved edits (confirm-on-dirty). */}
      <DrawerGuard active={dirty && !pending} />
      <form id="edit-order-form" onSubmit={onSubmit} className="space-y-5">
        <input type="hidden" name="term_type" value={term} />
        <input type="hidden" name="inspection_required" value={String(inspection)} />
        {!t.hasDeposit && <input type="hidden" name="term_deposit_pct" value="" />}

        <Field label="Order name"><input name="title" value={title} onChange={(e) => { setTitle(e.target.value); touch(); }} className={inputCls} /></Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Supplier / factory"><Select name="supplier" value={supplier} onChange={(v) => { setSupplier(v); touch(); }} options={supplierOpts} /></Field>
          <Field label="Agent"><Select name="agent" value={agent} onChange={(v) => { setAgent(v); touch(); }} options={agentOpts} /><p className="mt-1 text-[11px] text-muted-foreground">Direct = no agent</p></Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Placed date"><input name="placed_on" type="date" value={placed} onChange={(e) => { setPlaced(e.target.value); touch(); }} className={inputCls} /></Field>
          <Field label="FBA ETA"><input name="fba_eta" type="date" value={eta} onChange={(e) => { setEta(e.target.value); touch(); }} className={inputCls} /></Field>
        </div>

        <div>
          <div className="vy-kicker mb-1.5">Payment terms</div>
          <div className="flex flex-wrap gap-1.5">
            {PAYTERM_TYPES.map((p) => (
              <button type="button" key={p.key} onClick={() => { setTerm(p.key); touch(); }} className={cn("vy-chip", term === p.key && "is-active")}>{p.label}</button>
            ))}
          </div>
          {t.hasDeposit && (
            <div className="mt-2.5 flex items-center gap-2 text-[13px]">
              <span className="text-muted-foreground">Deposit</span>
              <input name="term_deposit_pct" type="number" min={0} max={100} value={deposit} onChange={(e) => { setDeposit(e.target.value); touch(); }} className={cn(inputCls, "w-20 text-center")} />
              <span className="text-muted-foreground">% / {balance != null ? `${balance}% balance` : "balance"}</span>
            </div>
          )}
          <div className="mt-3 flex gap-2.5 rounded-lg border px-3 py-2.5" style={{ background: "hsl(var(--info) / 0.06)", borderColor: "hsl(var(--info) / 0.22)" }}>
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <div><div className="text-[13px] font-semibold">{t.label} · {t.name}</div><p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{t.blurb}</p></div>
          </div>
        </div>

        <button type="button" onClick={() => { setInspection((v) => !v); touch(); }} className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left hover:border-primary/40">
          <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">Inspection required</div><p className="text-[11px] text-muted-foreground">Off for trusted suppliers — hides the Inspection tab.</p></div>
          <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", inspection ? "bg-primary" : "bg-muted")}><span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", inspection ? "left-[22px]" : "left-0.5")} /></span>
        </button>

        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      </form>
    </Drawer>
  );
}
