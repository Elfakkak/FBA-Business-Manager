"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, Chip, SectionTitle } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useFormModal } from "@/lib/use-form-modal";
import { updateOrder, setOrderStatus, addOrderLine, deleteOrderLine, addOrderPackaging, removeOrderPackaging } from "../actions";
import {
  money, num, ORDER_STATUS_TONE, ORDER_STATUS_LABEL, ORDER_PIPELINE, orderNeeds,
  type OrderRow, type InvoiceRow,
} from "@/lib/derive";
import { cn } from "@/lib/utils";
import {
  Factory, Route, Pencil, Check, Hammer, ClipboardCheck, Truck, Receipt,
  PackageCheck, LayoutDashboard, ChevronRight, ChevronLeft, AlertCircle, Plus, Trash2, Boxes,
  Home, Activity, ArrowRight, Calendar,
} from "lucide-react";

// Top tab bar (matches the prototype: Home · Production · Shipping · Invoices · Landed cost)
const TABS = [
  { key: "overview", label: "Home", icon: Home },
  { key: "production", label: "Production", icon: Hammer },
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

type OrderLine = { id: string; sku: string | null; product_name: string | null; qty: number; unit_cost: number | null };
type VariantOpt = { id: string; sku: string; name: string; last_cost_usd: number | null };
type PkgItemOpt = { id: string; name: string; kind: string; unit_cost: number };
type PkgUsed = { moveId: string; itemId: string; name: string; qty: number; unitCost: number };
export type OrderShipment = { id: string; mode: string; stage: string; forwarder: string | null; origin: string | null; destination: string | null; eta: string | null; packed: number };
export type OrderInbound = { id: string; fc: string; expected: number; received: number; amazon_status: string; sku_count: number; shipment_id: string | null };

type Tone = "brand" | "success" | "info" | "warning" | "muted" | "danger";
const SECTIONS: { key: string; label: string; icon: React.ElementType; tone: Tone }[] = [
  { key: "overview", label: "Home", icon: LayoutDashboard, tone: "muted" },
  { key: "production", label: "Production", icon: Hammer, tone: "brand" },
  { key: "inspection", label: "Inspection", icon: ClipboardCheck, tone: "success" },
  { key: "shipping", label: "Shipping", icon: Truck, tone: "info" },
  { key: "invoices", label: "Invoices", icon: Receipt, tone: "warning" },
  { key: "landed", label: "Landed cost", icon: PackageCheck, tone: "success" },
];

export function OrderShell({ order, invoices, lines, variants, packagingItems, packaging, shipments, inbounds, rollup, initialTab = "overview" }: {
  order: OrderRow;
  invoices: InvoiceRow[];
  lines: OrderLine[];
  variants: VariantOpt[];
  packagingItems: PkgItemOpt[];
  packaging: PkgUsed[];
  shipments: OrderShipment[];
  inbounds: OrderInbound[];
  rollup: { total: number; paid: number; balance: number; paidPct: number; invoiceCount: number };
  initialTab?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const curIdx = ORDER_PIPELINE.findIndex((p) => p.key === order.status);
  const units = lines.reduce((s, l) => s + (l.qty ?? 0), 0);
  const cogs = lines.reduce((s, l) => s + (l.qty ?? 0) * (l.unit_cost ?? 0), 0);
  const advance = (key: string) => start(async () => { await setOrderStatus(order.id, key); router.refresh(); });

  return (
    <div className="space-y-5">
      {/* breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link href="/orders" className="hover:text-foreground">Orders</Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <span className="font-mono">{order.id}</span>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <span className="font-medium text-foreground">{TABS.find((t) => t.key === tab)?.label ?? "Home"}</span>
      </nav>

      {/* tab bar */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const I = t.icon; const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition",
                active ? "bg-primary text-primary-foreground shadow-sm" : "border text-muted-foreground hover:bg-accent")}>
              <I className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <Overview order={order} rollup={rollup} units={units} skuCount={lines.length} curIdx={curIdx} onJump={setTab} onAdvance={advance} onEdit={() => setEditing(true)} pending={pending} />
      ) : tab === "invoices" ? (
        <InvoicesPanel invoices={invoices} />
      ) : tab === "shipping" ? (
        <ShippingPanel shipments={shipments} inbounds={inbounds} />
      ) : tab === "production" ? (
        <div className="space-y-6">
          <ProductionPanel orderId={order.id} lines={lines} variants={variants} units={units} cogs={cogs} />
          <PackagingPanel orderId={order.id} items={packagingItems} used={packaging} />
        </div>
      ) : (
        <StagePanel tab={tab} status={order.status} />
      )}

      {editing && <EditOrderModal order={order} onClose={() => setEditing(false)} />}
    </div>
  );
}

function Overview({ order, rollup, units, skuCount, curIdx, onJump, onAdvance, onEdit, pending }: {
  order: OrderRow; rollup: { total: number; paid: number; balance: number; paidPct: number; invoiceCount: number };
  units: number; skuCount: number; curIdx: number; onJump: (k: string) => void; onAdvance: (k: string) => void; onEdit: () => void; pending: boolean;
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
      {/* Header card — identity + next action */}
      <Card className="overflow-hidden p-0">
        <div className="grid lg:grid-cols-[1.6fr_1fr]">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Badge tone="muted">{order.id}</Badge>
                <Badge tone={liveTone} >{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Activity</button>
                <button onClick={onEdit} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</button>
              </div>
            </div>
            <h1 className="mt-3 text-2xl font-bold">{order.title}</h1>
            <p className="mt-1.5 max-w-[60ch] text-[13px] text-muted-foreground">Hub for this purchase order. Track every stage at a glance — the work happens inside each owning section.</p>
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              <Chip icon={Route}>Agent · {order.agent ?? "Direct"}</Chip>
              {order.supplier && <Chip icon={Factory}>Factory · {order.supplier}</Chip>}
              {units > 0 && <Chip icon={Boxes}>{num(units)} units</Chip>}
              {order.placed_on && <Chip icon={Calendar}>Placed {order.placed_on}</Chip>}
            </div>
          </div>
          {top && (
            <div className="border-t bg-accent/40 p-5 lg:border-l lg:border-t-0">
              <div className="vy-kicker mb-1.5 flex items-center gap-1.5"><span className={cn("h-1.5 w-1.5 rounded-full", top.severity === "warning" ? "bg-warning" : top.severity === "danger" ? "bg-danger" : "bg-info")} /> Next action</div>
              <div className="text-base font-bold">{top.headline}</div>
              <p className="mb-3.5 mt-1 text-[12px] text-muted-foreground">{top.detail}</p>
              <button onClick={() => onJump(top.section)} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5">Open {top.sectionLabel} <ArrowRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Order total" value={rollup.total > 0 ? money(rollup.total) : "—"} sub={`${num(units)} units · ${skuCount} SKU${skuCount === 1 ? "" : "s"}`} icon={Receipt} />
        <Kpi label="Paid" value={money(rollup.paid)} sub={`${rollup.paidPct}% of total`} icon={Check} tone="success" progress={rollup.paidPct} />
        <Kpi label="Balance due" value={money(rollup.balance)} sub="Due before shipment" icon={AlertCircle} tone={rollup.balance > 0.5 ? "warning" : "success"} />
        <Kpi label="Units" value={num(units)} sub="Ordered scope" icon={Boxes} />
        <Kpi label="FBA ETA" value={order.fba_eta ?? "—"} sub="Estimated arrival" icon={Truck} source="amazon" />
      </div>

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

function InvoicesPanel({ invoices }: { invoices: InvoiceRow[] }) {
  return (
    <Card className="p-5">
      <SectionTitle icon={Receipt} tone="warning" title="Invoices & payables" count={invoices.length} />
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices on this order yet.</p>
      ) : (
        <ul className="divide-y">
          {invoices.map((inv) => {
            const bal = Math.max(0, (inv.total ?? 0) - (inv.paid ?? 0));
            return (
              <li key={inv.id} className="flex items-center gap-3 py-2.5">
                <Link href={`/invoices/${inv.id}`} className="font-mono text-[12px] font-semibold hover:text-primary">{inv.id}</Link>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{inv.vendor_type}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{inv.vendor} · due {inv.due ?? "—"}</span>
                <span className="tabular font-mono text-sm">{money(inv.total)}</span>
                {bal > 0 ? <Badge tone="warning">{money(bal)} due</Badge> : <Badge tone="success">Paid</Badge>}
                <Link href={`/invoices/${inv.id}`} className="vy-icon-btn" aria-label="Open"><ChevronRight className="h-4 w-4" /></Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ProductionPanel({ orderId, lines, variants, units, cogs }: {
  orderId: string; lines: OrderLine[]; variants: VariantOpt[]; units: number; cogs: number;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [variantId, setVariantId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await addOrderLine(orderId, form);
      if (!res.ok) { setError(res.error); return; }
      setAdding(false); setVariantId("");
      router.refresh();
    });
  }
  function onDelete(id: string) {
    start(async () => { await deleteOrderLine(id, orderId); router.refresh(); });
  }

  return (
    <Card className="p-5">
      <SectionTitle icon={Hammer} tone="brand" title="Production" count={lines.length}
        action={<GhostButton onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add line</GhostButton>} />

      {lines.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
          No line items yet. Add the SKUs and quantities in this production run.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit cost</th>
                  <th className="px-3 py-2 text-right font-medium">Line total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 font-mono text-[12px] font-semibold">{l.sku}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.product_name}</td>
                    <td className="tabular px-3 py-2 text-right font-mono">{num(l.qty)}</td>
                    <td className="tabular px-3 py-2 text-right font-mono">{money(l.unit_cost)}</td>
                    <td className="tabular px-3 py-2 text-right font-mono font-semibold">{money((l.qty ?? 0) * (l.unit_cost ?? 0))}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => onDelete(l.id)} disabled={pending} className="vy-icon-btn" aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-danger" /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="px-3 py-2" colSpan={2}>Total</td>
                  <td className="tabular px-3 py-2 text-right font-mono">{num(units)}</td>
                  <td></td>
                  <td className="tabular px-3 py-2 text-right font-mono">{money(cogs)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">COGS = Σ qty × unit cost — feeds the order&apos;s landed cost & finance.</p>
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add line item">
        <form onSubmit={onAdd} className="space-y-4">
          <Field label="Variant">
            <Select name="variant_id" value={variantId} onChange={setVariantId} placeholder="Pick a SKU…" searchable
              options={variants.map((v) => ({ value: v.id, label: v.sku, sub: v.name }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity"><input name="qty" type="number" required className={inputCls} placeholder="500" /></Field>
            <Field label="Unit cost (USD)"><input name="unit_cost" type="number" step="0.01" className={inputCls} placeholder="(defaults to variant cost)" /></Field>
          </div>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setAdding(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Adding…" : "Add line"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function PackagingPanel({ orderId, items, used }: { orderId: string; items: PkgItemOpt[]; used: PkgUsed[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
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
    <Card className="p-5">
      <SectionTitle icon={Boxes} tone="info" title="Packaging used" count={used.length}
        action={items.length > 0 ? <GhostButton onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add packaging</GhostButton> : undefined} />

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

function ShippingPanel({ shipments, inbounds }: { shipments: OrderShipment[]; inbounds: OrderInbound[] }) {
  const SHIP_TONE: Record<string, Tone> = { Draft: "muted", Booked: "info", "Picked up": "info", "In transit": "info", Customs: "warning", Delivered: "success", "At FBA": "success" };
  const FBA_TONE: Record<string, Tone> = { Working: "muted", Shipped: "info", "In transit": "info", Receiving: "warning", Closed: "success", Problem: "danger" };
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle icon={Truck} tone="info" title="Freight shipments" count={shipments.length} />
        {shipments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No freight shipments linked to this order. Create one on the <Link href="/shipments" className="font-medium text-primary hover:underline">Shipments</Link> page and set its order to this one.</p>
        ) : (
          <ul className="divide-y">
            {shipments.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Link href={`/shipments/${s.id}`} className="font-mono text-[12px] font-bold hover:text-primary">{s.id}</Link>
                <Badge tone={SHIP_TONE[s.stage] ?? "muted"}>{s.stage}</Badge>
                <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{s.mode}{s.forwarder ? ` · ${s.forwarder}` : ""} · {s.origin || "—"} → {s.destination || "—"}{s.eta ? ` · ETA ${s.eta}` : ""}</span>
                <span className="tabular font-mono text-[12px] font-semibold">{num(s.packed)} packed</span>
                <Link href={`/shipments/${s.id}`} className="vy-icon-btn" aria-label="Open"><ChevronRight className="h-4 w-4" /></Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle icon={PackageCheck} tone="success" title="FBA inbounds" count={inbounds.length} />
        {inbounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Amazon inbounds linked yet. Open an inbound in <Link href="/fba-shipments" className="font-medium text-primary hover:underline">FBA Shipments</Link> and link it to this order.</p>
        ) : (
          <ul className="divide-y">
            {inbounds.map((f) => {
              const variance = f.received > 0 ? f.received - f.expected : 0;
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <Link href={`/fba-shipments/${f.id}`} className="font-mono text-[12px] font-bold hover:text-primary">{f.id}</Link>
                  <Badge tone="muted">{f.fc}</Badge>
                  <Badge tone={FBA_TONE[f.amazon_status] ?? "muted"}>{f.amazon_status}</Badge>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{f.sku_count} SKU{f.sku_count === 1 ? "" : "s"}</span>
                  <span className="tabular font-mono text-[12px]"><span className={cn(f.received <= 0 ? "text-muted-foreground" : variance < 0 ? "text-danger" : variance > 0 ? "text-warning" : "text-success")}>{f.received > 0 ? num(f.received) : "—"}</span> / {num(f.expected)}</span>
                  <Link href={`/fba-shipments/${f.id}`} className="vy-icon-btn" aria-label="Open"><ChevronRight className="h-4 w-4" /></Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
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

function EditOrderModal({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const { error, pending, onSubmit } = useFormModal((form) => updateOrder(order.id, form), { onSuccess: onClose });
  const [status, setStatus] = useState<string>(order.status);

  return (
    <Modal open onClose={onClose} title={`Edit ${order.id}`}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Title"><input name="title" defaultValue={order.title} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select name="status" value={status} onChange={setStatus} options={ORDER_PIPELINE.map((p) => ({ value: p.key, label: p.label }))} />
          </Field>
          <Field label="FBA ETA"><input name="fba_eta" type="date" defaultValue={order.fba_eta ?? ""} className={inputCls} /></Field>
        </div>
        <Field label="Placed on"><input name="placed_on" type="date" defaultValue={order.placed_on ?? ""} className={inputCls} /></Field>
        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
