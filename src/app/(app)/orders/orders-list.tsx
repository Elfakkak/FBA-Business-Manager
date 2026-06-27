"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Badge, Kpi, PageHead, CardHeader } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/drawer";
import { Select } from "@/components/ui/select";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { useFormModal } from "@/lib/use-form-modal";
import { useNewParam } from "@/lib/use-new-param";
import { createOrder } from "./actions";
import { money, num, ORDER_STATUS_TONE, ORDER_STATUS_LABEL, ORDER_PIPELINE, orderNeeds } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { Plus, ChevronRight, Boxes, Wallet, Hammer, ClipboardCheck, Truck, PackageCheck, Receipt, ArrowRight } from "lucide-react";

export type OrderSummary = {
  id: string; title: string; supplier: string | null; agent: string | null;
  status: string; placedOn: string | null; fbaEta: string | null;
  total: number; paid: number; balance: number; paidPct: number;
  units: number; skuCount: number;
};

const CHIPS = [{ key: "all", label: "All" }, ...ORDER_PIPELINE.filter((p) => p.key !== "draft")];

export function OrdersList({ orders, suppliers, agents }: { orders: OrderSummary[]; suppliers: string[]; agents: string[] }) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [peek, setPeek] = useState<OrderSummary | null>(null);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (stage !== "all" && o.status !== stage) return false;
      if (n && !`${o.id} ${o.title} ${o.supplier ?? ""}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [orders, q, stage]);

  const openOrders = orders.filter((o) => o.status !== "closed" && o.status !== "fba").length;
  const outstanding = orders.reduce((s, o) => s + o.balance, 0);
  const byStatus = (k: string) => orders.filter((o) => o.status === k).length;

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Operations command center"
        title="Orders"
        sub="Every purchase order across its lifecycle — production, inspection, shipping, invoices and landed cost."
        actions={<NewOrderButton suppliers={suppliers} agents={agents} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Open orders" value={num(openOrders)} sub="in flight" icon={Boxes} tone="info" />
        <Kpi label="Outstanding" value={money(outstanding)} sub="unpaid exposure" icon={Wallet} tone={outstanding > 0 ? "warning" : "success"} />
        <Kpi label="In production" value={num(byStatus("production"))} sub="being made" icon={Hammer} />
        <Kpi label="Inspection" value={num(byStatus("inspection"))} sub="QC needed" icon={ClipboardCheck} tone={byStatus("inspection") ? "warning" : undefined} />
        <Kpi label="In transit" value={num(byStatus("transit"))} sub="shipping" icon={Truck} />
        <Kpi label="At FBA" value={num(byStatus("fba"))} sub="ready to close" icon={PackageCheck} tone="success" />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order, title, supplier"
            className="min-w-56 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex flex-wrap gap-1">
            {CHIPS.map((c) => (
              <button key={c.key} onClick={() => setStage(c.key)} className={cn("vy-chip", stage === c.key && "is-active")}>{c.label}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={`${filtered.length} orders`} caption="Total / paid derived from invoices" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Supplier</th>
                <th className="px-4 py-2 text-right font-medium">Units</th>
                <th className="px-4 py-2 font-medium">Dates</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Paid</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No orders match your filters.</td></tr>
              ) : filtered.map((o) => (
                <tr key={o.id} className="vy-order-row cursor-pointer hover:bg-accent/40" onClick={() => setPeek(o)}>
                  <td className="px-4 py-2.5">
                    <Link href={`/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12px] font-semibold hover:text-primary">{o.id}</Link>
                    <div className="max-w-[260px] truncate text-[12px] text-muted-foreground">{o.title}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div>{o.supplier ?? "—"}</div>
                    {o.agent && <div className="text-[11px] text-muted-foreground">via {o.agent}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {o.units > 0 ? <><span className="tabular font-mono font-semibold">{num(o.units)}</span><div className="text-[11px] text-muted-foreground">{o.skuCount} SKU{o.skuCount === 1 ? "" : "s"}</div></> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[12px]">
                    <div className="text-muted-foreground">Placed <span className="text-foreground">{o.placedOn ?? "—"}</span></div>
                    <div className="text-muted-foreground">FBA ETA <span className="text-foreground">{o.fbaEta ?? "—"}</span></div>
                  </td>
                  <td className="px-4 py-2.5"><Badge tone={ORDER_STATUS_TONE[o.status] ?? "muted"}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge></td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{o.total > 0 ? money(o.total) : "—"}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">
                    {o.total > 0 ? <>{money(o.paid)}<span className="text-[11px] text-muted-foreground"> · {o.paidPct}%</span></> : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right"><Link href={`/orders/${o.id}`} onClick={(e) => e.stopPropagation()}><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <OrderPeekDrawer order={peek} onClose={() => setPeek(null)} />
    </div>
  );
}

function OrderPeekDrawer({ order: o, onClose }: { order: OrderSummary | null; onClose: () => void }) {
  const needs = o ? orderNeeds({ status: o.status, balance: o.balance, paidPct: o.paidPct, units: o.units, supplier: o.supplier }) : [];
  const top = needs[0];
  const JUMPS = [
    { label: "Shipping", tab: "shipping", icon: Truck },
    { label: "Invoices", tab: "invoices", icon: Receipt },
    { label: "Production", tab: "production", icon: Hammer },
    { label: "Landed cost", tab: "landed", icon: PackageCheck },
  ];
  return (
    <Drawer open={!!o} onClose={onClose} title={o?.title}>
      {o && (
        <div className="space-y-5">
          <div>
            <div className="font-mono text-[12px] text-muted-foreground">{o.id}</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">{o.units > 0 ? `${o.skuCount} SKU${o.skuCount === 1 ? "" : "s"} · ${num(o.units)} units` : "No SKUs yet"}{o.placedOn ? ` · ${o.placedOn}` : ""}</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Badge tone={ORDER_STATUS_TONE[o.status] ?? "muted"}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
              {o.supplier && <Badge tone="muted">{o.supplier}</Badge>}
            </div>
          </div>

          {top && (
            <div className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5" style={{ background: "hsl(var(--primary) / 0.07)", borderColor: "hsl(var(--primary) / 0.2)" }}>
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div><div className="vy-kicker mb-0.5">Next step</div><div className="text-[13px] font-semibold">{top.headline}</div></div>
            </div>
          )}

          <div className="flex gap-4 rounded-lg border bg-background/50 px-3.5 py-3">
            <div className="flex-1"><div className="vy-kicker mb-0.5">Order total</div><div className="font-mono text-[15px] font-bold">{o.total > 0 ? money(o.total) : "—"}</div><div className="text-[11px] text-muted-foreground">{o.total > 0 ? `${o.paidPct}% paid` : "no invoices"}</div></div>
            <div className="flex-1"><div className="vy-kicker mb-0.5">Balance</div><div className={cn("font-mono text-[15px] font-bold", o.balance > 0.5 ? "text-warning" : "text-success")}>{o.balance > 0.5 ? `${money(o.balance)}` : "Paid in full"}</div>{o.balance > 0.5 && <div className="text-[11px] text-muted-foreground">before shipping</div>}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <PeekRow label="Supplier / route" value={o.supplier ?? "—"} sub={o.agent ? `via ${o.agent}` : "Direct supplier"} />
            <PeekRow label="Production" value={ORDER_STATUS_LABEL[o.status] ?? o.status} sub={`${num(o.units)} units`} />
            <PeekRow label="Shipping / FBA" value={o.fbaEta ? `FBA ETA ${o.fbaEta}` : "Not scheduled"} sub={o.placedOn ? `Placed ${o.placedOn}` : "—"} />
            <PeekRow label="Paid / balance" value={money(o.paid)} sub={`${money(o.balance)} due`} />
          </div>

          <div>
            <div className="vy-kicker mb-2">Jump to</div>
            <div className="flex flex-wrap gap-2">
              {JUMPS.map((j) => { const I = j.icon; return (
                <Link key={j.tab} href={`/orders/${o.id}?tab=${j.tab}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold hover:bg-accent"><I className="h-3 w-3 opacity-70" /> {j.label}</Link>
              ); })}
            </div>
          </div>

          <Link href={`/orders/${o.id}`} className="vy-btn vy-btn--primary flex w-full items-center justify-center gap-1.5">Open order <ArrowRight className="h-4 w-4" /></Link>
        </div>
      )}
    </Drawer>
  );
}

function PeekRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div><div className="vy-kicker mb-0.5">{label}</div><div className="text-[13px] font-semibold">{value}</div>{sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}</div>;
}

function NewOrderButton({ suppliers, agents }: { suppliers: string[]; agents: string[] }) {
  const { open, setOpen, error, pending, onSubmit } = useFormModal((form) => createOrder(form));
  const [supplier, setSupplier] = useState("");
  const [agent, setAgent] = useState("");
  useNewParam(() => setOpen(true));

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> New order</PrimaryButton>
      <Modal open={open} onClose={() => setOpen(false)} title="New order">
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">Create a draft purchase order. Add SKUs, invoices and shipping inside the order.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Order title"><input name="title" required autoFocus className={inputCls} placeholder="e.g. Q3 restock — beaded covers" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier">
              <Select name="supplier" value={supplier} onChange={setSupplier} placeholder="Select…"
                options={[{ value: "", label: "Select…" }, ...suppliers.map((s) => ({ value: s, label: s }))]} />
            </Field>
            <Field label="Agent (optional)">
              <Select name="agent" value={agent} onChange={setAgent} placeholder="Direct supplier"
                options={[{ value: "", label: "Direct supplier" }, ...agents.map((a) => ({ value: a, label: a }))]} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Placed on"><input name="placed_on" type="date" className={inputCls} /></Field>
            <Field label="FBA ETA"><input name="fba_eta" type="date" className={inputCls} /></Field>
          </div>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Creating…" : "Create order"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
