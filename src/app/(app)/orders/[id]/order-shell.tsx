"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead, Chip, SectionTitle } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { updateOrder, setOrderStatus, addOrderLine, deleteOrderLine } from "../actions";
import {
  money, num, ORDER_STATUS_TONE, ORDER_STATUS_LABEL, ORDER_PIPELINE,
  type OrderRow, type InvoiceRow,
} from "@/lib/derive";
import { cn } from "@/lib/utils";
import {
  Factory, Route, Pencil, Check, Hammer, ClipboardCheck, Truck, Receipt,
  PackageCheck, LayoutDashboard, ChevronRight, AlertCircle, Plus, Trash2, Boxes,
} from "lucide-react";

type OrderLine = { id: string; sku: string | null; product_name: string | null; qty: number; unit_cost: number | null };
type VariantOpt = { id: string; sku: string; name: string; last_cost_usd: number | null };

type Tone = "brand" | "success" | "info" | "warning" | "muted";
const SECTIONS: { key: string; label: string; icon: React.ElementType; tone: Tone }[] = [
  { key: "overview", label: "Home", icon: LayoutDashboard, tone: "muted" },
  { key: "production", label: "Production", icon: Hammer, tone: "brand" },
  { key: "inspection", label: "Inspection", icon: ClipboardCheck, tone: "success" },
  { key: "shipping", label: "Shipping", icon: Truck, tone: "info" },
  { key: "invoices", label: "Invoices", icon: Receipt, tone: "warning" },
  { key: "landed", label: "Landed cost", icon: PackageCheck, tone: "success" },
];

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function OrderShell({ order, invoices, lines, variants, rollup }: {
  order: OrderRow;
  invoices: InvoiceRow[];
  lines: OrderLine[];
  variants: VariantOpt[];
  rollup: { total: number; paid: number; balance: number; paidPct: number; invoiceCount: number };
}) {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const curIdx = ORDER_PIPELINE.findIndex((p) => p.key === order.status);
  const units = lines.reduce((s, l) => s + (l.qty ?? 0), 0);
  const cogs = lines.reduce((s, l) => s + (l.qty ?? 0) * (l.unit_cost ?? 0), 0);
  const advance = (key: string) => start(async () => { await setOrderStatus(order.id, key); router.refresh(); });

  // D1/D14/D25/D30 milestones derived from placed_on; tone from pipeline position.
  const placed = order.placed_on;
  const milestones = placed ? [
    { label: "D1 · Materials", date: placed, doneAt: 1, flightAt: 1 },
    { label: "D14 · Production", date: addDays(placed, 13), doneAt: 2, flightAt: 1 },
    { label: "D25 · Inspection", date: addDays(placed, 24), doneAt: 3, flightAt: 2 },
    { label: "D30 · Ready to ship", date: addDays(placed, 29), doneAt: 3, flightAt: 2 },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="text-[12px] text-muted-foreground">
        <Link href="/orders" className="hover:text-foreground">Orders</Link> › {order.id}
      </div>

      <PageHead
        kicker={`Order · ${order.id}`}
        title={order.title}
        actions={
          <>
            <Badge tone={ORDER_STATUS_TONE[order.status] ?? "muted"}>{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge>
            <GhostButton onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</GhostButton>
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        {order.supplier && <Chip icon={Factory}>{order.supplier}</Chip>}
        <Chip icon={Route}>{order.route ?? "Direct supplier"}</Chip>
        {units > 0 && <Chip icon={Boxes}>{num(units)} units · {lines.length} SKU{lines.length === 1 ? "" : "s"}</Chip>}
        {order.placed_on && <Chip>Placed {order.placed_on}</Chip>}
      </div>

      {/* milestone strip */}
      {milestones.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {milestones.map((m) => {
            const done = curIdx >= m.doneAt, flight = !done && curIdx >= m.flightAt;
            return (
              <div key={m.label} className={cn("rounded-lg border px-3 py-2.5",
                done ? "border-success/30 bg-success/10" : flight ? "border-warning/40 bg-warning/10" : "bg-card")}>
                <div className={cn("text-[10px] font-bold uppercase tracking-wide", done ? "text-success" : flight ? "text-warning" : "text-muted-foreground")}>{m.label}</div>
                <div className="mt-0.5 text-[11px]">{done ? `✓ ${m.date}` : flight ? `In flight · ${m.date}` : `est ${m.date}`}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* status pipeline stepper */}
      <Card className="p-4">
        <div className="vy-kicker mb-3">Lifecycle</div>
        <div className="flex flex-wrap gap-2">
          {ORDER_PIPELINE.map((p, i) => {
            const done = i < curIdx, current = i === curIdx;
            return (
              <button key={p.key} onClick={() => advance(p.key)} disabled={pending || current}
                className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  current ? "border-primary bg-primary text-primary-foreground"
                    : done ? "border-success/30 bg-success/10 text-success"
                    : "text-muted-foreground hover:bg-accent")}>
                {done && <Check className="h-3 w-3" />}{p.label}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Order total" value={rollup.total > 0 ? money(rollup.total) : "—"} sub="from invoices" />
        <Kpi label="Paid" value={money(rollup.paid)} sub={`${rollup.paidPct}% paid`} tone="success" progress={rollup.paidPct} />
        <Kpi label="Balance" value={money(rollup.balance)} sub="outstanding" tone={rollup.balance > 0 ? "warning" : "success"} />
        <Kpi label="FBA arrival" value={order.fba_eta ?? "—"} sub="ETA" source="amazon" />
      </div>

      {/* section switcher */}
      <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.key} onClick={() => setTab(s.key)}
              className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition",
                tab === s.key ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
              <Icon className="h-3.5 w-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <Overview order={order} rollup={rollup} curIdx={curIdx} onJump={setTab} />
      ) : tab === "invoices" ? (
        <InvoicesPanel invoices={invoices} />
      ) : tab === "production" ? (
        <ProductionPanel orderId={order.id} lines={lines} variants={variants} units={units} cogs={cogs} />
      ) : (
        <StagePanel tab={tab} status={order.status} />
      )}

      {editing && <EditOrderModal order={order} onClose={() => setEditing(false)} />}
    </div>
  );
}

function Overview({ order, rollup, curIdx, onJump }: {
  order: OrderRow; rollup: { balance: number; invoiceCount: number }; curIdx: number; onJump: (k: string) => void;
}) {
  // needs-attention derived from status + balance
  const needs: { tone: Tone; text: string }[] = [];
  if (rollup.balance > 0) needs.push({ tone: "warning", text: `${money(rollup.balance)} unpaid across ${rollup.invoiceCount} invoice(s)` });
  if (order.status === "draft") needs.push({ tone: "muted", text: "Draft — send deposit to start production" });
  if (order.status === "inspection") needs.push({ tone: "warning", text: "Inspection pending — book QC / review report" });
  if (order.status === "transit") needs.push({ tone: "info", text: "In transit — track shipment to FBA" });
  if (order.status === "fba") needs.push({ tone: "success", text: "At FBA — reconcile receiving & compute landed cost" });

  const cards = SECTIONS.filter((s) => s.key !== "overview").map((s) => {
    const idx = { production: 1, inspection: 2, shipping: 3, invoices: -1, landed: 4 }[s.key] ?? -1;
    const state = s.key === "invoices" ? (rollup.balance > 0 ? "Open" : "Settled")
      : idx < 0 ? "—" : curIdx > idx ? "Done" : curIdx === idx ? "Current" : "Upcoming";
    const tone: Tone = state === "Done" || state === "Settled" ? "success" : state === "Current" || state === "Open" ? "warning" : "muted";
    return { ...s, state, tone };
  });

  return (
    <div className="space-y-4">
      {needs.length > 0 && (
        <Card className="p-5">
          <SectionTitle icon={AlertCircle} tone="warning" title="Needs attention" count={needs.length} />
          <ul className="space-y-2">
            {needs.map((n, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={cn("h-2 w-2 rounded-full",
                  n.tone === "warning" ? "bg-warning" : n.tone === "info" ? "bg-info" : n.tone === "success" ? "bg-success" : "bg-muted-foreground")} />
                {n.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button key={c.key} onClick={() => onJump(c.key)} className="vy-card vy-card-hover flex items-center gap-3 p-4 text-left">
              <span className={cn("inline-grid h-10 w-10 place-items-center rounded-lg",
                c.tone === "success" ? "bg-success/12 text-success" : c.tone === "warning" ? "bg-warning/12 text-warning" : "bg-muted text-muted-foreground")}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.label}</div>
                <div className="text-[12px] text-muted-foreground">{c.state}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>
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
                <span className="font-mono text-[12px] font-semibold">{inv.id}</span>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{inv.vendor_type}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{inv.vendor} · due {inv.due ?? "—"}</span>
                <span className="tabular font-mono text-sm">{money(inv.total)}</span>
                {bal > 0 ? <Badge tone="warning">{money(bal)} due</Badge> : <Badge tone="success">Paid</Badge>}
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
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await addOrderLine(orderId, form);
      if (!res.ok) { setError(res.error); return; }
      setAdding(false);
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
            <select name="variant_id" required className={inputCls} defaultValue="">
              <option value="" disabled>Pick a SKU…</option>
              {variants.map((v) => <option key={v.id} value={v.id}>{v.sku} — {v.name}</option>)}
            </select>
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
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await updateOrder(order.id, form);
      if (!res.ok) { setError(res.error); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${order.id}`}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Title"><input name="title" defaultValue={order.title} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select name="status" defaultValue={order.status} className={inputCls}>
              {ORDER_PIPELINE.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
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
