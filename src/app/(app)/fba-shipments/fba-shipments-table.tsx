"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead, SourceTag, CardHeader } from "@/components/ui/primitives";
import { Drawer, DrawerStat } from "@/components/ui/drawer";
import { intgAgo } from "@/lib/integrations";
import { syncFbaInbounds } from "../integrations/actions";
import { num } from "@/lib/derive";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/derive";
import { Truck, Boxes, PackageCheck, AlertCircle, RefreshCw, ArrowUpRight, Loader2 } from "lucide-react";

export type FbaRow = {
  id: string; fc: string; skuCount: number; expected: number; received: number; variance: number;
  status: string; synced: string | null; eta: string | null; mode: string | null;
  shipmentId: string | null; orderId: string | null;
  items: { sku: string; fnsku: string | null; expected: number; received: number }[];
};

const STATUS_TONE: Record<string, Tone> = {
  Working: "muted", Shipped: "info", "In transit": "info", Receiving: "warning", Closed: "success", Problem: "danger",
};
const STATUSES = ["all", "Working", "Shipped", "In transit", "Receiving", "Closed", "Problem"];

export function FbaShipmentsTable({ rows, amazonConnected, lastSync }: { rows: FbaRow[]; amazonConnected: boolean; lastSync: string | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [peek, setPeek] = useState<FbaRow | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (n && !`${r.id} ${r.fc} ${r.items.map((i) => i.sku).join(" ")}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [rows, q, status]);

  const open = rows.filter((r) => r.status !== "Closed");
  const inTransitUnits = open.filter((r) => r.received === 0).reduce((s, r) => s + r.expected, 0);
  const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  const discrepancies = rows.filter((r) => r.received > 0 && r.received < r.expected).length;
  const fcs = [...new Set(rows.map((r) => r.fc))];

  const sync = () => { setErr(null); start(async () => { const r = await syncFbaInbounds(); if (!r.ok) setErr(r.error); router.refresh(); }); };

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Operations"
        title="FBA Shipments"
        sub="Inbound shipments to Amazon — what's on the way, at the dock, and being received. Expected vs received per shipment, live from the FBA Inbound API."
        actions={
          <>
            <button className="vy-btn vy-btn--ghost inline-flex items-center gap-1.5"><ArrowUpRight className="h-4 w-4" /> Export</button>
            <button onClick={sync} disabled={pending} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync from Amazon
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Inbounds" value={num(rows.length)} sub={`${open.length} open`} icon={Truck} source="amazon" />
        <Kpi label="In transit" value={num(inTransitUnits)} sub="units not yet received" icon={Boxes} source="amazon" tone="info" />
        <Kpi label="Received" value={`${num(totalReceived)} / ${num(totalExpected)}`} sub="units" icon={PackageCheck} source="amazon" tone="success" />
        <Kpi label="Discrepancies" value={num(discrepancies)} sub="short receipts" icon={AlertCircle} tone={discrepancies ? "danger" : undefined} />
        <Kpi label="Destination FCs" value={num(fcs.length)} sub={fcs.slice(0, 4).join(" · ") || "—"} icon={Truck} />
      </div>

      {amazonConnected ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm" style={{ background: "hsl(var(--info) / 0.06)", borderColor: "hsl(var(--info) / 0.22)" }}>
          <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><RefreshCw className="h-4 w-4" /></span>
          <span><span className="font-medium">Synced from Seller Central</span><span className="text-muted-foreground"> · Inbound shipments &amp; per-SKU receipts · last sync {intgAgo(lastSync)}</span></span>
          <Badge tone="info" className="ml-auto">FBA Inbound API</Badge>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm" style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.3)" }}>
          <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-warning/12 text-warning"><AlertCircle className="h-4 w-4" /></span>
          <span><span className="font-medium text-warning">Amazon not connected</span><span className="text-muted-foreground"> · Connect Seller Central to pull inbound shipments.</span></span>
          <Link href="/integrations/amazon" className="vy-btn vy-btn--outline vy-btn--sm ml-auto">Connect Amazon</Link>
        </div>
      )}
      {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shipment, FC, SKU"
            className="min-w-56 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={cn("vy-chip", status === s && "is-active")}>{s === "all" ? "All" : s}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader title={`${filtered.length} shipments`} caption="Variance = received − expected" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">FBA shipment</th>
                <th className="px-3 py-2 font-medium">Dest FC</th>
                <th className="px-3 py-2 text-right font-medium">SKUs</th>
                <th className="px-3 py-2 text-right font-medium">Expected</th>
                <th className="px-3 py-2 text-right font-medium"><span className="inline-flex items-center gap-1">Received <SourceTag source="amazon" /></span></th>
                <th className="px-3 py-2 text-right font-medium">Variance</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Synced</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">{rows.length === 0 ? "No inbound shipments yet — hit “Sync from Amazon”." : "No shipments match your filters."}</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-accent/40" onClick={() => setPeek(r)}>
                  <td className="px-3 py-2.5"><div className="font-mono text-[12px] font-semibold">{r.id}</div><div className="text-[11px] text-muted-foreground">{[r.mode, r.eta && `ETA ${r.eta}`].filter(Boolean).join(" · ") || "Amazon inbound"}</div></td>
                  <td className="px-3 py-2.5"><Badge tone="muted">{r.fc}</Badge></td>
                  <td className="tabular px-3 py-2.5 text-right font-mono">{num(r.skuCount)}</td>
                  <td className="tabular px-3 py-2.5 text-right font-mono">{num(r.expected)}</td>
                  <td className="tabular px-3 py-2.5 text-right font-mono font-semibold">{num(r.received)}</td>
                  <td className={cn("tabular px-3 py-2.5 text-right font-mono", r.received === 0 ? "text-muted-foreground" : r.variance < 0 ? "text-danger" : r.variance > 0 ? "text-warning" : "text-success")}>
                    {r.received === 0 ? "—" : `${r.variance > 0 ? "+" : ""}${num(r.variance)}`}
                  </td>
                  <td className="px-3 py-2.5"><Badge tone={STATUS_TONE[r.status] ?? "muted"}>{r.status}</Badge></td>
                  <td className="px-3 py-2.5 text-right text-[11px] text-muted-foreground">{intgAgo(r.synced)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer open={!!peek} onClose={() => setPeek(null)} title={peek?.id}>
        {peek && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={STATUS_TONE[peek.status] ?? "muted"}>{peek.status}</Badge>
              <Badge tone="muted">{peek.fc}</Badge>
              {peek.eta && <Badge tone="info">ETA {peek.eta}</Badge>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <DrawerStat label="Expected" value={num(peek.expected)} />
              <DrawerStat label="Received" value={num(peek.received)} />
              <DrawerStat label="Variance" value={peek.received === 0 ? "—" : `${peek.variance > 0 ? "+" : ""}${num(peek.variance)}`} />
            </div>
            <div>
              <div className="vy-kicker mb-2">Items ({peek.items.length})</div>
              <ul className="space-y-1.5">
                {peek.items.map((i) => (
                  <li key={i.sku} className="flex items-center gap-2 rounded-md border px-3 py-2 text-[12px]">
                    <Link href={`/inventory?q=${encodeURIComponent(i.sku)}`} onClick={(e) => e.stopPropagation()} className="min-w-0 flex-1 truncate font-mono hover:text-primary">{i.sku}</Link>
                    <span className="tabular font-mono text-muted-foreground">{num(i.received)} / {num(i.expected)}</span>
                    {i.received < i.expected && i.received > 0 ? <Badge tone="warning">short</Badge> : i.received >= i.expected && i.expected > 0 ? <Badge tone="success">✓</Badge> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
