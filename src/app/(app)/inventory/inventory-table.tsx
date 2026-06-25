"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead, SourceTag } from "@/components/ui/primitives";
import { INV_HEALTH_TONE, INV_FCS, INV_SAFETY_DAYS, num, type InvHealth } from "@/lib/derive";
import { intgAgo } from "@/lib/integrations";
import { setReorderPoint } from "./actions";
import { cn } from "@/lib/utils";
import {
  Boxes, Package, Truck, AlertCircle, Info, ChevronDown, ChevronRight,
  RefreshCw, ArrowUpRight, Pencil, Check, Plus,
} from "lucide-react";

export type InvRow = {
  id: string; sku: string; fnsku: string | null; familyId: string; family: string; color: string | null;
  category: string; supplier: string | null; onHand: number; reserved: number; available: number;
  inbound: number; unfulfillable: number; daysCover: number | null; reorderPoint: number; health: InvHealth; fc: string;
};

const CHIPS: { key: "all" | InvHealth; label: string }[] = [
  { key: "all", label: "All" }, { key: "Reorder", label: "Reorder" }, { key: "Low", label: "Low" }, { key: "Healthy", label: "Healthy" },
];

export function InventoryTable({ rows, amazonConnected, lastSync }: { rows: InvRow[]; amazonConnected: boolean; lastSync: string | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [health, setHealth] = useState<"all" | InvHealth>("all");
  const [view, setView] = useState<"family" | "sku">("family");
  const [editing, setEditing] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [, start] = useTransition();

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);
  const suppliers = useMemo(() => [...new Set(rows.map((r) => r.supplier).filter((s): s is string => !!s))].sort(), [rows]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (supplier !== "all" && r.supplier !== supplier) return false;
      if (health !== "all" && r.health !== health) return false;
      if (n && !`${r.family} ${r.color ?? ""} ${r.sku} ${r.fnsku ?? ""} ${r.supplier ?? ""} ${r.category}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [rows, q, category, supplier, health]);

  // KPIs over ALL rows
  const onHand = rows.reduce((s, r) => s + r.onHand, 0);
  const available = rows.reduce((s, r) => s + r.available, 0);
  const inbound = rows.reduce((s, r) => s + r.inbound, 0);
  const reorderNow = rows.filter((r) => r.health === "Reorder").length;
  const unfulfillable = rows.reduce((s, r) => s + r.unfulfillable, 0);

  // FC distribution over filtered
  const fcTotals = INV_FCS.map((fc) => ({ fc, total: filtered.filter((r) => r.fc === fc).reduce((s, r) => s + r.onHand, 0) }));
  const fcMax = Math.max(1, ...fcTotals.map((f) => f.total));

  // grouping for family view
  const groups = useMemo(() => {
    const m = new Map<string, InvRow[]>();
    for (const r of filtered) { if (!m.has(r.familyId)) m.set(r.familyId, []); m.get(r.familyId)!.push(r); }
    return [...m.entries()];
  }, [filtered]);

  const saveReorder = (id: string, v: string) => start(async () => { await setReorderPoint(id, v === "" ? null : Number(v)); router.refresh(); });

  const COLS = 10;
  return (
    <div className="space-y-6">
      <PageHead
        kicker="Catalog"
        title="Inventory"
        sub="Live FBA stock per SKU, joined to your catalog. On-hand, reserved and inbound sync from Amazon; reorder points are yours."
        actions={
          <>
            <button className="vy-btn vy-btn--ghost inline-flex items-center gap-1.5"><ArrowUpRight className="h-4 w-4" /> Export</button>
            <button className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><RefreshCw className="h-4 w-4" /> Sync from Amazon</button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="On hand" value={num(onHand)} sub="FBA units" icon={Boxes} source="amazon" />
        <Kpi label="Available" value={num(available)} sub="sellable now" icon={Package} />
        <Kpi label="Inbound" value={num(inbound)} sub="to FBA" icon={Truck} source="amazon" tone="info" />
        <Kpi label="Reorder now" value={num(reorderNow)} sub={reorderNow === 1 ? "SKU" : "SKUs"} icon={AlertCircle} tone={reorderNow ? "danger" : undefined} />
        <Kpi label="Unfulfillable" value={num(unfulfillable)} sub="stranded units" icon={Info} source="amazon" tone={unfulfillable ? "warning" : undefined} />
      </div>

      {/* sync status strip — reflects the real Amazon integration state */}
      {amazonConnected ? (
        <div className="flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm" style={{ background: "hsl(var(--info) / 0.06)", borderColor: "hsl(var(--info) / 0.22)" }}>
          <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><RefreshCw className="h-4 w-4" /></span>
          <span><span className="font-medium">Synced from Seller Central</span><span className="text-muted-foreground"> · On-hand, reserved, inbound &amp; velocity · last sync {intgAgo(lastSync)}</span></span>
          <Badge tone="info" className="ml-auto">FBA Inventory API</Badge>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm" style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.3)" }}>
          <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-warning/12 text-warning"><AlertCircle className="h-4 w-4" /></span>
          <span><span className="font-medium text-warning">Amazon not connected</span><span className="text-muted-foreground"> · Inventory is pulled from Amazon FBA — connect Seller Central to sync live on-hand, inbound &amp; velocity. Figures below are seeded.</span></span>
          <Link href="/integrations/amazon" className="vy-btn vy-btn--outline vy-btn--sm ml-auto inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Connect Amazon</Link>
        </div>
      )}

      {/* filter bar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU, FNSKU, ASIN, product, supplier"
            className="min-w-56 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="all">All categories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="all">All suppliers</option>{suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex overflow-hidden rounded-md border text-sm">
            {(["family", "sku"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("px-3 py-2", view === v ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                {v === "family" ? "By family" : "All SKUs"}
              </button>
            ))}
          </div>
          <button onClick={() => setEditing((e) => !e)} className={cn("vy-btn vy-btn--sm inline-flex items-center gap-1.5", editing ? "vy-btn--primary" : "vy-btn--outline")}>
            {editing ? <><Check className="h-3.5 w-3.5" /> Done</> : <><Pencil className="h-3.5 w-3.5" /> Edit reorder pts</>}
          </button>
        </div>
        <div className="mt-2 flex gap-1">
          {CHIPS.map((c) => (
            <button key={c.key} onClick={() => setHealth(c.key)} className={cn("vy-chip", health === c.key && "is-active")}>{c.label}</button>
          ))}
        </div>
      </Card>

      {/* table */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-4 py-3 text-sm">
          <span className="font-medium">{filtered.length} SKUs</span>
          <span className="text-muted-foreground">Available = on-hand − reserved − unfulfillable</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Product / SKU</th>
                <th className="px-3 py-2 font-medium"><span className="inline-flex items-center gap-1">FNSKU <SourceTag source="amazon" /></span></th>
                <th className="px-3 py-2 text-right font-medium"><span className="inline-flex items-center gap-1">On hand <SourceTag source="amazon" /></span></th>
                <th className="px-3 py-2 text-right font-medium">Reserved</th>
                <th className="px-3 py-2 text-right font-medium">Avail</th>
                <th className="px-3 py-2 text-right font-medium">Inbound</th>
                <th className="px-3 py-2 text-right font-medium">Days cover</th>
                <th className="px-3 py-2 text-right font-medium"><span className="inline-flex items-center gap-1">Reorder pt <SourceTag source="manual" /></span></th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={COLS} className="px-4 py-9 text-center text-muted-foreground">No SKUs match your filters.</td></tr>
              ) : view === "sku" ? (
                filtered.map((r) => <Row key={r.id} r={r} editing={editing} onSave={saveReorder} router={router} />)
              ) : (
                groups.map(([fid, members]) => {
                  const open = collapsed[fid] !== true;
                  const needs = members.filter((m) => m.health === "Reorder").length;
                  const gOn = members.reduce((s, m) => s + m.onHand, 0);
                  const gIn = members.reduce((s, m) => s + m.inbound, 0);
                  return (
                    <FragmentGroup key={fid}>
                      <tr className="cursor-pointer bg-muted/40 hover:bg-muted/60" onClick={() => setCollapsed((c) => ({ ...c, [fid]: open }))}>
                        <td colSpan={COLS} className="px-3 py-2">
                          <div className="flex items-center gap-2 text-[13px]">
                            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <strong>{members[0].family}</strong>
                            <span className="text-muted-foreground">{members.length} SKUs</span>
                            <span className="ml-auto text-muted-foreground">On hand <strong className="text-foreground">{num(gOn)}</strong></span>
                            <span className="text-muted-foreground">Inbound <strong className="text-foreground">{num(gIn)}</strong></span>
                            {needs > 0 ? <Badge tone="danger">{needs} reorder</Badge> : <Badge tone="success">Healthy</Badge>}
                          </div>
                        </td>
                      </tr>
                      {open && members.map((r) => <Row key={r.id} r={r} editing={editing} onSave={saveReorder} router={router} />)}
                    </FragmentGroup>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* FC distribution */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><Truck className="h-4 w-4" /></span>
          <div>
            <div className="flex items-center gap-1.5 font-medium">By fulfillment center <SourceTag source="amazon" /></div>
            <p className="text-[11px] text-muted-foreground">On-hand units across Amazon FCs ({filtered.length} of {rows.length} SKUs shown)</p>
          </div>
        </div>
        <div className="space-y-2">
          {fcTotals.map((f) => (
            <div key={f.fc} className="flex items-center gap-3">
              <span className="w-14 font-mono text-[12px] font-semibold">{f.fc}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-info" style={{ width: `${Math.round((f.total / fcMax) * 100)}%` }} />
              </div>
              <span className="tabular w-16 text-right font-mono text-[12px] font-semibold">{num(f.total)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function FragmentGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Row({ r, editing, onSave, router }: {
  r: InvRow; editing: boolean; onSave: (id: string, v: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <tr className="hover:bg-accent/40">
      <td className="px-3 py-2.5">
        <Link href={`/catalog/${r.familyId}`} className="font-mono text-[12px] font-semibold hover:text-primary">{r.sku}</Link>
        <div className="text-[11px] text-muted-foreground">{r.family}{r.color ? ` · ${r.color}` : ""} · {r.fc}</div>
      </td>
      <td className="px-3 py-2.5 font-mono text-[12px] text-muted-foreground">{r.fnsku ?? "—"}</td>
      <td className="tabular px-3 py-2.5 text-right font-mono font-semibold">{num(r.onHand)}</td>
      <td className="tabular px-3 py-2.5 text-right font-mono text-muted-foreground">{num(r.reserved)}</td>
      <td className="tabular px-3 py-2.5 text-right font-mono font-semibold">{num(r.available)}</td>
      <td className={cn("tabular px-3 py-2.5 text-right font-mono", r.inbound > 0 ? "text-info" : "text-muted-foreground")}>{r.inbound > 0 ? num(r.inbound) : "—"}</td>
      <td className={cn("tabular px-3 py-2.5 text-right font-mono", r.daysCover != null && r.daysCover < INV_SAFETY_DAYS && "text-warning")}>{r.daysCover == null ? "∞" : `${r.daysCover}d`}</td>
      <td className="px-3 py-2.5 text-right">
        {editing ? (
          <input type="number" defaultValue={r.reorderPoint} onBlur={(e) => e.target.value !== String(r.reorderPoint) && onSave(r.id, e.target.value)}
            className="h-7 w-16 rounded border bg-background px-2 text-right font-mono text-[12px] outline-none focus:ring-2 focus:ring-ring" />
        ) : <span className="tabular font-mono text-[12px] text-muted-foreground">{num(r.reorderPoint)}</span>}
      </td>
      <td className="px-3 py-2.5"><Badge tone={INV_HEALTH_TONE[r.health]}>{r.health}</Badge></td>
      <td className="px-3 py-2.5 text-right">
        {r.health !== "Healthy" && (
          <button onClick={() => router.push(`/orders?reorder=1&sku=${encodeURIComponent(r.sku)}`)} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Reorder
          </button>
        )}
      </td>
    </tr>
  );
}
