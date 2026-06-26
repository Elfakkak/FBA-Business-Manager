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
import { Truck, Boxes, PackageCheck, AlertCircle, RefreshCw, ArrowUpRight, Loader2, Check } from "lucide-react";

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

// Amazon "Shipment events" model — mirrors Seller Central's timeline, derived from status + received.
const FBA_EVENTS = [
  { key: "created", label: "Shipment created" },
  { key: "intransit", label: "In transit" },
  { key: "delivered", label: "Delivered to FC" },
  { key: "checkedin", label: "Checked in" },
  { key: "received", label: "Received" },
  { key: "closed", label: "Shipment closed" },
];
function fbaDoneIdx(r: FbaRow) {
  if (r.status === "Closed") return 5;
  if (r.received > 0) return 4;
  if (r.status === "Receiving") return 3;
  if (r.status === "Shipped" || r.status === "In transit") return 1;
  return 0; // Working
}

export function FbaShipmentsTable({ rows, amazonConnected, lastSync }: { rows: FbaRow[]; amazonConnected: boolean; lastSync: string | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [fcFilter, setFcFilter] = useState("all");
  const [peek, setPeek] = useState<FbaRow | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (fcFilter !== "all" && r.fc !== fcFilter) return false;
      if (n && !`${r.id} ${r.fc} ${r.items.map((i) => i.sku).join(" ")}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [rows, q, status, fcFilter]);

  const open = rows.filter((r) => r.status !== "Closed");
  const inTransitUnits = open.filter((r) => r.received === 0).reduce((s, r) => s + r.expected, 0);
  const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  const discrepancies = rows.filter((r) => r.received > 0 && r.received < r.expected).length;
  const fcs = [...new Set(rows.map((r) => r.fc))].sort();
  // open units inbound per destination FC (for the distribution bars)
  const fcTotals = fcs.map((fc) => ({ fc, units: open.filter((r) => r.fc === fc).reduce((s, r) => s + Math.max(0, r.expected - r.received), 0) }))
    .filter((f) => f.units > 0).sort((a, b) => b.units - a.units);
  const fcMax = Math.max(1, ...fcTotals.map((f) => f.units));

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
          <select value={fcFilter} onChange={(e) => setFcFilter(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="all">All FCs</option>{fcs.map((fc) => <option key={fc} value={fc}>{fc}</option>)}
          </select>
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
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">FBA shipment</th>
                <th className="px-3 py-2 font-medium">Parent shipment</th>
                <th className="px-3 py-2 font-medium">Order</th>
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
                <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">{rows.length === 0 ? "No inbound shipments yet — hit “Sync from Amazon”." : "No shipments match your filters."}</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-accent/40" onClick={() => setPeek(r)}>
                  <td className="px-3 py-2.5"><div className="font-mono text-[12px] font-semibold">{r.id}</div><div className="text-[11px] text-muted-foreground">{[r.mode, r.eta && `ETA ${r.eta}`].filter(Boolean).join(" · ") || "Amazon inbound"}</div></td>
                  <td className="px-3 py-2.5 text-[12px]">{r.shipmentId ? <Link href={`/orders`} onClick={(e) => e.stopPropagation()} className="font-mono hover:text-primary">{r.shipmentId}</Link> : <span className="text-muted-foreground">Direct to Amazon</span>}</td>
                  <td className="px-3 py-2.5 text-[12px]">{r.orderId ? <Link href={`/orders/${r.orderId}`} onClick={(e) => e.stopPropagation()} className="font-mono hover:text-primary">{r.orderId}</Link> : <span className="text-muted-foreground">—</span>}</td>
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

      {fcTotals.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><Truck className="h-4 w-4" /></span>
            <div><div className="flex items-center gap-1.5 font-medium">Open units by destination FC <SourceTag source="amazon" /></div><p className="text-[11px] text-muted-foreground">Units not yet received, per Amazon fulfillment center</p></div>
          </div>
          <div className="space-y-2">
            {fcTotals.map((f) => (
              <div key={f.fc} className="flex items-center gap-3">
                <span className="w-16 font-mono text-[12px] font-semibold">{f.fc}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-info" style={{ width: `${Math.round((f.units / fcMax) * 100)}%` }} /></div>
                <span className="tabular w-16 text-right font-mono text-[12px] font-semibold">{num(f.units)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Drawer open={!!peek} onClose={() => setPeek(null)} title={peek?.id}>
        {peek && (() => {
          const variance = peek.variance;
          const vHint = peek.received <= 0 ? "Not yet received — units book as Amazon checks them in."
            : variance === 0 ? "No discrepancies — received the expected units."
            : variance < 0 ? `${Math.abs(variance)} units short of the expected count.`
            : `+${variance} units over the expected count.`;
          const doneIdx = fbaDoneIdx(peek);
          return (
            <div className="space-y-6">
              {/* subtitle + chips */}
              <div>
                <div className="text-[12px] text-muted-foreground">Inbound to {peek.fc} · {peek.mode || "Amazon inbound"}</div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUS_TONE[peek.status] ?? "muted"}>{peek.status}</Badge>
                  <Badge tone="muted">{peek.fc}</Badge>
                  {peek.orderId && <Link href={`/orders/${peek.orderId}`} onClick={(e) => e.stopPropagation()}><Badge tone="muted">{peek.orderId}</Badge></Link>}
                </div>
              </div>

              {/* order / forwarder seam */}
              {peek.orderId ? (
                <Link href={`/orders/${peek.orderId}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2.5 rounded-lg border bg-accent/50 px-3 py-2.5 hover:border-primary/40">
                  <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1"><div className="text-[11px] text-muted-foreground">Linked order</div><div className="font-mono text-[12px] font-bold">{peek.orderId}</div></div>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 rounded-lg border border-dashed bg-background/40 px-3 py-2.5">
                  <PackageCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1"><div className="text-[12px] font-semibold">Not linked to an order</div><div className="text-[11px] text-muted-foreground">Direct from Seller Central — order linking is coming.</div></div>
                </div>
              )}

              {/* Receiving · Amazon leg */}
              <div>
                <div className="vy-kicker mb-2">Receiving · Amazon leg</div>
                <div className="grid grid-cols-4 gap-2">
                  <DrawerStat label="Expected" value={num(peek.expected)} />
                  <DrawerStat label="Received" value={peek.received > 0 ? num(peek.received) : "—"} />
                  <DrawerStat label="Variance" value={peek.received <= 0 ? "—" : `${variance > 0 ? "+" : ""}${num(variance)}`} />
                  <DrawerStat label="SKUs" value={num(peek.skuCount)} />
                </div>
                <p className="mt-2 px-0.5 text-[11px] text-muted-foreground">{vHint}</p>
              </div>

              {/* Shipment events timeline */}
              {peek.status === "Problem" ? (
                <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2.5 text-[12px] text-danger">Cancelled in Seller Central — never received.</div>
              ) : (
                <div>
                  <div className="vy-kicker mb-2.5">Shipment events · from Seller Central</div>
                  <div className="flex flex-col">
                    {FBA_EVENTS.map((e, i) => {
                      const done = i <= doneIdx;
                      const cur = i === doneIdx;
                      const color = done ? (cur ? "hsl(var(--info))" : "hsl(var(--success))") : "hsl(var(--border))";
                      const nextDone = i < FBA_EVENTS.length - 1 && i + 1 <= doneIdx;
                      return (
                        <div key={e.key} className="flex min-h-[30px] gap-3">
                          <div className="flex flex-col items-center self-stretch">
                            <span className="mt-1 grid h-3 w-3 shrink-0 place-items-center rounded-full" style={{ background: done ? color : "hsl(var(--card))", border: `2px solid ${color}` }}>
                              {done && <Check className="h-[7px] w-[7px] text-white" strokeWidth={4} />}
                            </span>
                            {i < FBA_EVENTS.length - 1 && <span className="my-0.5 w-0.5 flex-1" style={{ background: nextDone ? "hsl(var(--success))" : "hsl(var(--border))" }} />}
                          </div>
                          <div className={cn("min-w-0", i < FBA_EVENTS.length - 1 && "pb-2.5")}>
                            <div className={cn("text-[12.5px]", cur ? "font-bold text-info" : done ? "font-semibold" : "font-semibold text-muted-foreground")}>{e.label}</div>
                            <div className="mt-px text-[11px] text-muted-foreground">{done ? (cur ? "current" : "done") : <span className="italic">pending</span>}{cur && e.key === "checkedin" ? ` · ${peek.fc}` : ""}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Items */}
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

              {/* Identifiers */}
              <div>
                <div className="vy-kicker mb-2">Amazon identifiers</div>
                <div className="grid grid-cols-3 gap-2">
                  <DrawerStat label="FBA shipment ID" value={<span className="text-[11px]">{peek.id}</span>} />
                  <DrawerStat label="Dest FC" value={peek.fc} />
                  <DrawerStat label="Synced" value={<span className="text-[11px]">{intgAgo(peek.synced)}</span>} />
                </div>
              </div>

              {/* Footer action */}
              {peek.orderId && (
                <Link href={`/orders/${peek.orderId}`} onClick={(e) => e.stopPropagation()} className="vy-btn vy-btn--primary flex w-full items-center justify-center gap-1.5">Open order <ArrowUpRight className="h-4 w-4" /></Link>
              )}
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
}
