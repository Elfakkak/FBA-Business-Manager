"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { createOrder } from "./actions";
import { money, num, ORDER_STATUS_TONE, ORDER_STATUS_LABEL, ORDER_PIPELINE } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { Plus, ChevronRight } from "lucide-react";

export type OrderSummary = {
  id: string; title: string; supplier: string | null; agent: string | null;
  status: string; placedOn: string | null; fbaEta: string | null;
  total: number; paid: number; balance: number; paidPct: number;
};

const CHIPS = [{ key: "all", label: "All" }, ...ORDER_PIPELINE.filter((p) => p.key !== "draft")];

export function OrdersList({ orders, suppliers, agents }: { orders: OrderSummary[]; suppliers: string[]; agents: string[] }) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (stage !== "all" && o.status !== stage) return false;
      if (n && !`${o.id} ${o.title} ${o.supplier ?? ""}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [orders, q, stage]);

  const openOrders = orders.filter((o) => o.status !== "closed" && o.status !== "fba").length;
  const totalValue = orders.reduce((s, o) => s + o.total, 0);
  const outstanding = orders.reduce((s, o) => s + o.balance, 0);

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Operations"
        title="Orders"
        sub="Every purchase order across its lifecycle — production, inspection, shipping, invoices and landed cost."
        actions={<NewOrderButton suppliers={suppliers} agents={agents} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Orders" value={num(orders.length)} sub={`${openOrders} in flight`} />
        <Kpi label="Open orders" value={num(openOrders)} sub="not yet at FBA" tone="info" />
        <Kpi label="Order value" value={money(totalValue)} sub="invoiced total" />
        <Kpi label="Outstanding" value={money(outstanding)} sub="unpaid balance" tone={outstanding > 0 ? "warning" : "success"} />
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

      <Card>
        <div className="flex items-center justify-between border-b px-4 py-3 text-sm">
          <span className="font-medium">{filtered.length} orders</span>
          <span className="text-muted-foreground">Total / paid derived from invoices</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Supplier</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Paid</th>
                <th className="px-4 py-2 text-right font-medium">FBA ETA</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No orders match your filters.</td></tr>
              ) : filtered.map((o) => (
                <tr key={o.id} className="vy-order-row hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/orders/${o.id}`} className="font-mono text-[12px] font-semibold hover:text-primary">{o.id}</Link>
                    <div className="max-w-[260px] truncate text-[12px] text-muted-foreground">{o.title}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div>{o.supplier ?? "—"}</div>
                    {o.agent && <div className="text-[11px] text-muted-foreground">via {o.agent}</div>}
                  </td>
                  <td className="px-4 py-2.5"><Badge tone={ORDER_STATUS_TONE[o.status] ?? "muted"}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge></td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{o.total > 0 ? money(o.total) : "—"}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">
                    {o.total > 0 ? <>{money(o.paid)}<span className="text-[11px] text-muted-foreground"> · {o.paidPct}%</span></> : "—"}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right font-mono text-muted-foreground">{o.fbaEta ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right"><Link href={`/orders/${o.id}`}><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function NewOrderButton({ suppliers, agents }: { suppliers: string[]; agents: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await createOrder(form);
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> New order</PrimaryButton>
      <Modal open={open} onClose={() => setOpen(false)} title="New order">
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">Create a draft purchase order. Add SKUs, invoices and shipping inside the order.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Order title"><input name="title" required autoFocus className={inputCls} placeholder="e.g. Q3 restock — beaded covers" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier">
              <select name="supplier" className={inputCls} defaultValue="">
                <option value="">Select…</option>
                {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Agent (optional)">
              <select name="agent" className={inputCls} defaultValue="">
                <option value="">Direct supplier</option>
                {agents.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
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
