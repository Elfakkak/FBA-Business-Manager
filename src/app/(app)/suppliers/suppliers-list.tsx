"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead, Avatar } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Drawer, DrawerStat } from "@/components/ui/drawer";
import { createSupplier } from "./actions";
import { money, num } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { Plus, ArrowRight } from "lucide-react";

export type SupplierSummary = {
  name: string;
  origin: string | null;
  route: string | null;
  leadTimeDays: number | null;
  isNew: boolean | null;
  productCount: number;
  orderCount: number;
  openOrders: number;
  openBalance: number;
};

export function SuppliersList({ suppliers }: { suppliers: SupplierSummary[] }) {
  const [q, setQ] = useState("");
  const [peek, setPeek] = useState<SupplierSummary | null>(null);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return suppliers.filter((s) => !n || `${s.name} ${s.origin ?? ""} ${s.route ?? ""}`.toLowerCase().includes(n));
  }, [suppliers, q]);

  const totalProducts = suppliers.reduce((s, x) => s + x.productCount, 0);
  const openOrders = suppliers.reduce((s, x) => s + x.openOrders, 0);
  const openAP = suppliers.reduce((s, x) => s + x.openBalance, 0);

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Partners"
        title="Suppliers"
        sub="Every factory you buy from — products sourced, orders in flight, lead time and what you owe."
        actions={<NewSupplierButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Suppliers" value={num(suppliers.length)} sub="active factories" />
        <Kpi label="Products" value={num(totalProducts)} sub="families sourced" />
        <Kpi label="Open orders" value={num(openOrders)} sub="in flight" tone="info" />
        <Kpi label="Open AP" value={money(openAP)} sub="owed to suppliers" tone={openAP > 0 ? "warning" : "success"} />
      </div>

      <Card className="p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supplier, origin, agent"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b px-4 py-3 text-sm">
          <span className="font-medium">{filtered.length} suppliers</span>
          <span className="text-muted-foreground">Open AP = unpaid goods + agent bills on their orders</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Supplier</th>
                <th className="px-4 py-2 font-medium">Origin</th>
                <th className="px-4 py-2 text-right font-medium">Products</th>
                <th className="px-4 py-2 text-right font-medium">Orders</th>
                <th className="px-4 py-2 text-right font-medium">Lead time</th>
                <th className="px-4 py-2 text-right font-medium">Open AP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No suppliers match your search.</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.name} className="cursor-pointer hover:bg-accent/40" onClick={() => setPeek(s)}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={s.name} tone="brand" />
                      <div>
                        <Link href={`/suppliers/${encodeURIComponent(s.name)}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primary">{s.name}</Link>
                        {s.isNew && <Badge tone="brand" className="ml-1.5">New</Badge>}
                        {s.route && <div className="text-[11px] text-muted-foreground">{s.route}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.origin ?? "—"}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{num(s.productCount)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{num(s.orderCount)}<span className="text-[11px] text-info"> · {s.openOrders} open</span></td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{s.leadTimeDays ? `${s.leadTimeDays}d` : "—"}</td>
                  <td className={cn("tabular px-4 py-2.5 text-right font-mono font-semibold", s.openBalance > 0 ? "text-warning" : "text-muted-foreground")}>{s.openBalance > 0 ? money(s.openBalance) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer open={!!peek} onClose={() => setPeek(null)} title="Supplier">
        {peek && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={peek.name} tone="brand" size={44} />
              <div>
                <div className="flex items-center gap-1.5 font-medium">{peek.name}{peek.isNew && <Badge tone="brand">New</Badge>}</div>
                <div className="text-[12px] text-muted-foreground">{peek.route ?? "Direct"}{peek.origin ? ` · ${peek.origin}` : ""}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <DrawerStat label="Products" value={num(peek.productCount)} />
              <DrawerStat label="Orders" value={num(peek.orderCount)} sub={`${peek.openOrders} open`} />
              <DrawerStat label="Open AP" value={peek.openBalance > 0 ? money(peek.openBalance) : "—"} />
            </div>
            <Link href={`/suppliers/${encodeURIComponent(peek.name)}`} className="vy-btn vy-btn--primary w-full justify-center">
              Open full supplier <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function NewSupplierButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await createSupplier(form);
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      router.push(`/suppliers/${encodeURIComponent(String(form.get("name")))}`);
      router.refresh();
    });
  }

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> New supplier</PrimaryButton>
      <Modal open={open} onClose={() => setOpen(false)} title="New supplier">
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">Create a supplier record. You can fill in the full profile next.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Supplier name"><input name="name" required autoFocus className={inputCls} placeholder="e.g. Ningbo Auto Trim" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origin"><input name="origin" className={inputCls} placeholder="Dongguan, CN" /></Field>
            <Field label="Contact"><input name="contact" className={inputCls} placeholder="Lily Chen" /></Field>
          </div>
          <Field label="Payment terms"><input name="payment_terms" className={inputCls} placeholder="30% deposit / 70% before ship" /></Field>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Creating…" : "Create supplier"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
