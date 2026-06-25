"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead, Chip, SectionTitle } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { updateOrder, setOrderStatus } from "../actions";
import {
  money, num, ORDER_STATUS_TONE, ORDER_STATUS_LABEL, ORDER_PIPELINE,
  type OrderRow, type InvoiceRow,
} from "@/lib/derive";
import { cn } from "@/lib/utils";
import { Factory, Route, Pencil, Check, Hammer, ClipboardCheck, Truck, Receipt, PackageCheck } from "lucide-react";

const SECTIONS = [
  { key: "production", label: "Production", icon: Hammer },
  { key: "inspection", label: "Inspection", icon: ClipboardCheck },
  { key: "shipping", label: "Shipping", icon: Truck },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "closeout", label: "Closeout", icon: PackageCheck },
] as const;

export function OrderShell({ order, invoices, rollup }: {
  order: OrderRow;
  invoices: InvoiceRow[];
  rollup: { total: number; paid: number; balance: number; paidPct: number; invoiceCount: number };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<string>("invoices");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const curIdx = ORDER_PIPELINE.findIndex((p) => p.key === order.status);

  const advance = (key: string) => start(async () => { await setOrderStatus(order.id, key); router.refresh(); });

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
        {order.placed_on && <Chip>Placed {order.placed_on}</Chip>}
      </div>

      {/* status pipeline stepper */}
      <Card className="p-4">
        <div className="mb-3 vy-kicker">Lifecycle</div>
        <div className="flex flex-wrap gap-2">
          {ORDER_PIPELINE.map((p, i) => {
            const done = i < curIdx, current = i === curIdx;
            return (
              <button
                key={p.key}
                onClick={() => advance(p.key)}
                disabled={pending}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  current ? "border-primary/30 bg-primary/12 text-primary"
                    : done ? "border-success/30 bg-success/10 text-success"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                {done && <Check className="h-3 w-3" />}{p.label}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Order total" value={rollup.total > 0 ? money(rollup.total) : "—"} sub="from invoices" />
        <Kpi label="Paid" value={money(rollup.paid)} sub={`${rollup.paidPct}%`} tone="success" />
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
                tab === s.key ? "bg-primary/12 font-medium text-primary" : "text-muted-foreground hover:bg-accent")}>
              <Icon className="h-3.5 w-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      {tab === "invoices" ? (
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
      ) : (
        <StagePanel tab={tab} status={order.status} />
      )}

      {editing && <EditOrderModal order={order} onClose={() => setEditing(false)} />}
    </div>
  );
}

function StagePanel({ tab, status }: { tab: string; status: string }) {
  const meta: Record<string, { icon: React.ElementType; tone: "brand" | "success" | "info"; title: string; body: string }> = {
    production: { icon: Hammer, tone: "brand", title: "Production", body: "Units, SKU breakdown and WIP milestones for this order. Production tracking lands with the catalog→order line items." },
    inspection: { icon: ClipboardCheck, tone: "success", title: "Inspection", body: "AQL inspection booking, report and pass/fail. Wires up when the inspection partner flow is connected." },
    shipping: { icon: Truck, tone: "info", title: "Shipping", body: "Freight legs, forwarder, incoterm, ETD/ETA and FBA inbounds. Builds with the Logistics phase." },
    closeout: { icon: PackageCheck, tone: "success", title: "Closeout", body: "Reconcile receiving, compute landed cost per unit and close the order. Lights up once shipping + invoices are complete." },
  };
  const m = meta[tab] ?? meta.production;
  const Icon = m.icon;
  return (
    <Card className="p-5">
      <SectionTitle icon={Icon} tone={m.tone} title={m.title} />
      <div className="rounded-lg border border-dashed bg-background/40 px-4 py-10 text-center">
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{m.body}</p>
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
