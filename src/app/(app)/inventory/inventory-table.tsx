"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead, SourceTag, CardHeader } from "@/components/ui/primitives";
import { INV_HEALTH_TONE, INV_FCS, INV_SAFETY_DAYS, num, type InvHealth } from "@/lib/derive";
import { intgAgo } from "@/lib/integrations";
import { setReorderPoint, setFavorite } from "./actions";
import { cn } from "@/lib/utils";
import {
  Boxes, Package, Truck, AlertCircle, Info, ChevronDown, ChevronRight,
  RefreshCw, ArrowUpRight, Pencil, Check, Plus, Star, Copy, Layers,
} from "lucide-react";

export type InvRow = {
  id: string; sku: string; fnsku: string | null; asin: string | null; familyId: string; family: string; color: string | null;
  category: string; supplier: string | null; onHand: number; reserved: number; available: number;
  inbound: number; unfulfillable: number; daysCover: number | null; reorderPoint: number; health: InvHealth; fc: string;
  image: string | null; lastCost: number | null; favorite: boolean;
};

// Amazon ships commingled/stickerless units when the FNSKU equals the ASIN
// (no FNSKU label applied). Otherwise the unit is FNSKU-labeled.
const isStickerless = (r: InvRow) => !!r.fnsku && !!r.asin && r.fnsku === r.asin;

type SortKey = "family" | "sku" | "onHand" | "reserved" | "available" | "inbound" | "daysCover" | "reorderPoint";

const CHIPS: { key: "all" | InvHealth; label: string }[] = [
  { key: "all", label: "All" }, { key: "Reorder", label: "Reorder" }, { key: "Low", label: "Low" }, { key: "Healthy", label: "Healthy" },
];

export function InventoryTable({ rows, amazonConnected, lastSync, initialQ }: { rows: InvRow[]; amazonConnected: boolean; lastSync: string | null; initialQ?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ ?? "");
  const [category, setCategory] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [health, setHealth] = useState<"all" | InvHealth>("all");
  const [view, setView] = useState<"family" | "sku">(initialQ ? "sku" : "family");
  const [editing, setEditing] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [dupOnly, setDupOnly] = useState(false);
  const [singleOnly, setSingleOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [, start] = useTransition();

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "family" || key === "sku" ? "asc" : "desc" }));
  const sortRows = (arr: InvRow[]) => {
    if (!sort) return arr;
    const { key, dir } = sort; const f = dir === "asc" ? 1 : -1;
    return [...arr].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === "string" || typeof bv === "string") return String(av ?? "").localeCompare(String(bv ?? "")) * f;
      return (((av as number) ?? Infinity) - ((bv as number) ?? Infinity)) * f; // nulls (∞ cover) sort last on asc
    });
  };

  // duplicate listings: the same ASIN sold under more than one SKU (splits your stock)
  const dupAsins = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) if (r.asin) counts.set(r.asin, (counts.get(r.asin) ?? 0) + 1);
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([a]) => a));
  }, [rows]);
  const isDup = (r: InvRow) => !!r.asin && dupAsins.has(r.asin);
  // standalone products: SKUs whose family has only one variant
  const familyCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.familyId, (m.get(r.familyId) ?? 0) + 1);
    return m;
  }, [rows]);
  const singleCount = [...familyCounts.values()].filter((c) => c === 1).length;

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);
  const suppliers = useMemo(() => [...new Set(rows.map((r) => r.supplier).filter((s): s is string => !!s))].sort(), [rows]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (supplier !== "all" && r.supplier !== supplier) return false;
      if (health !== "all" && r.health !== health) return false;
      if (favOnly && !r.favorite) return false;
      if (dupOnly && !(r.asin && dupAsins.has(r.asin))) return false;
      if (singleOnly && (familyCounts.get(r.familyId) ?? 0) > 1) return false;
      if (n && !`${r.family} ${r.color ?? ""} ${r.sku} ${r.fnsku ?? ""} ${r.asin ?? ""} ${r.supplier ?? ""} ${r.category}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [rows, q, category, supplier, health, favOnly, dupOnly, singleOnly, dupAsins, familyCounts]);

  const favCount = rows.filter((r) => r.favorite).length;
  const dupCount = rows.filter((r) => r.asin && dupAsins.has(r.asin)).length;

  // KPIs over ALL rows
  const onHand = rows.reduce((s, r) => s + r.onHand, 0);
  const available = rows.reduce((s, r) => s + r.available, 0);
  const inbound = rows.reduce((s, r) => s + r.inbound, 0);
  const reorderNow = rows.filter((r) => r.health === "Reorder").length;
  const unfulfillable = rows.reduce((s, r) => s + r.unfulfillable, 0);

  // FC distribution over filtered
  const fcTotals = INV_FCS.map((fc) => ({ fc, total: filtered.filter((r) => r.fc === fc).reduce((s, r) => s + r.onHand, 0) }));
  const fcMax = Math.max(1, ...fcTotals.map((f) => f.total));

  // grouping for family view (sort within each family)
  const groups = useMemo(() => {
    const m = new Map<string, InvRow[]>();
    for (const r of filtered) { if (!m.has(r.familyId)) m.set(r.familyId, []); m.get(r.familyId)!.push(r); }
    return [...m.entries()];
  }, [filtered]);

  // pagination — in SKU view the unit is a SKU; in family view it's a family
  const sortedSkus = useMemo(() => sortRows(filtered), [filtered, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalItems = view === "sku" ? sortedSkus.length : groups.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, pageCount);
  const from = (safePage - 1) * pageSize;
  const pageSkus = sortedSkus.slice(from, from + pageSize);
  const pageGroups = groups.slice(from, from + pageSize);
  // reset to page 1 whenever the result set or view changes
  useEffect(() => { setPage(1); }, [q, category, supplier, health, favOnly, dupOnly, singleOnly, view, pageSize]);

  const saveReorder = (id: string, v: string) => start(async () => { await setReorderPoint(id, v === "" ? null : Number(v)); router.refresh(); });
  const toggleFav = (id: string, v: boolean) => start(async () => { await setFavorite(id, v); router.refresh(); });

  const COLS = 11;
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
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {CHIPS.map((c) => (
            <button key={c.key} onClick={() => setHealth(c.key)} className={cn("vy-chip", health === c.key && "is-active")}>{c.label}</button>
          ))}
          <button onClick={() => setFavOnly((f) => !f)} className={cn("vy-chip ml-1 inline-flex items-center gap-1", favOnly && "is-active")} title="Show only favorited SKUs">
            <Star className={cn("h-3 w-3", favOnly && "fill-current")} /> Favorites{favCount ? ` (${favCount})` : ""}
          </button>
          <button onClick={() => setDupOnly((d) => !d)} className={cn("vy-chip inline-flex items-center gap-1", dupOnly && "is-active", dupCount > 0 && !dupOnly && "text-danger")} title="ASINs sold under more than one SKU — your stock is split across duplicate listings">
            <Copy className="h-3 w-3" /> Duplicate ASINs{dupCount ? ` (${dupCount})` : ""}
          </button>
          <button onClick={() => setSingleOnly((v) => !v)} className={cn("vy-chip inline-flex items-center gap-1", singleOnly && "is-active")} title="Standalone products — only one SKU in their family">
            <Layers className="h-3 w-3" /> Single-SKU{singleCount ? ` (${singleCount})` : ""}
          </button>
        </div>
      </Card>

      {/* table */}
      <Card className="overflow-hidden p-0">
        <CardHeader title={`${filtered.length} SKUs`} caption="Available = on-hand − reserved − unfulfillable" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <SortTh label="Product" k="family" sort={sort} onSort={toggleSort} />
                <SortTh label="SKU" k="sku" sort={sort} onSort={toggleSort} />
                <th className="whitespace-nowrap px-3 py-2 font-medium"><span className="inline-flex items-center gap-1">FNSKU / Prep <SourceTag source="amazon" /></span></th>
                <SortTh label="On hand" k="onHand" right sort={sort} onSort={toggleSort} extra={<SourceTag source="amazon" />} />
                <SortTh label="Reserved" k="reserved" right sort={sort} onSort={toggleSort} />
                <SortTh label="Avail" k="available" right sort={sort} onSort={toggleSort} />
                <SortTh label="Inbound" k="inbound" right sort={sort} onSort={toggleSort} />
                <SortTh label="Days cover" k="daysCover" right sort={sort} onSort={toggleSort} />
                <SortTh label="Reorder pt" k="reorderPoint" right sort={sort} onSort={toggleSort} extra={<SourceTag source="manual" />} />
                <th className="whitespace-nowrap px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={COLS} className="px-4 py-9 text-center text-muted-foreground">No SKUs match your filters.</td></tr>
              ) : view === "sku" ? (
                pageSkus.map((r) => <Row key={r.id} r={r} editing={editing} onSave={saveReorder} onFav={toggleFav} dup={isDup(r)} router={router} />)
              ) : (
                pageGroups.map(([fid, members]) => {
                  // standalone product (one SKU) → a single flat row, no folder/tree
                  if (members.length === 1) return <Row key={fid} r={members[0]} editing={editing} onSave={saveReorder} onFav={toggleFav} dup={isDup(members[0])} router={router} />;
                  const open = collapsed[fid] !== true;
                  const needs = members.filter((m) => m.health === "Reorder").length;
                  const gOn = members.reduce((s, m) => s + m.onHand, 0);
                  const gReserved = members.reduce((s, m) => s + m.reserved, 0);
                  const gAvail = members.reduce((s, m) => s + m.available, 0);
                  const gIn = members.reduce((s, m) => s + m.inbound, 0);
                  const favd = members.some((m) => m.favorite);
                  const img = members.find((m) => m.image)?.image ?? null;
                  return (
                    <FragmentGroup key={fid}>
                      {/* parent header — sums aligned under the same columns as the variants */}
                      <tr className="cursor-pointer bg-muted/40 hover:bg-muted/60" onClick={() => setCollapsed((c) => ({ ...c, [fid]: open }))}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2 text-[13px]">
                            {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                            <span className="relative inline-grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded border bg-muted text-muted-foreground">
                              {img ? <Image src={img} alt="" fill sizes="28px" className="object-cover" /> : <Package className="h-3.5 w-3.5" />}
                            </span>
                            {favd && <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" />}
                            <Link href={`/catalog/${fid}`} onClick={(e) => e.stopPropagation()} className="max-w-[280px] truncate font-semibold hover:text-primary" title={members[0].family}>{members[0].family}</Link>
                            <span className="shrink-0 text-muted-foreground">{members.length} SKUs</span>
                          </div>
                        </td>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2" />
                        <td className="tabular px-3 py-2 text-right font-mono font-semibold">{num(gOn)}</td>
                        <td className="tabular px-3 py-2 text-right font-mono text-muted-foreground">{num(gReserved)}</td>
                        <td className="tabular px-3 py-2 text-right font-mono font-semibold">{num(gAvail)}</td>
                        <td className={cn("tabular px-3 py-2 text-right font-mono", gIn > 0 ? "text-info" : "text-muted-foreground")}>{gIn > 0 ? num(gIn) : "—"}</td>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2">{needs > 0 ? <Badge tone="danger">{needs} reorder</Badge> : <Badge tone="success">Healthy</Badge>}</td>
                        <td className="px-3 py-2" />
                      </tr>
                      {open && sortRows(members).map((r) => <Row key={r.id} r={r} editing={editing} onSave={saveReorder} onFav={toggleFav} dup={isDup(r)} indent router={router} />)}
                    </FragmentGroup>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows:</span>
            {[25, 50, 100].map((n) => (
              <button key={n} onClick={() => setPageSize(n)} className={cn("rounded px-2 py-0.5", pageSize === n ? "bg-primary/12 font-medium text-primary" : "hover:bg-accent")}>{n}</button>
            ))}
          </div>
          <div>Showing {totalItems === 0 ? 0 : from + 1}–{Math.min(from + pageSize, totalItems)} of {num(totalItems)} {view === "sku" ? "SKUs" : "families"}</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="vy-btn vy-btn--outline vy-btn--sm disabled:opacity-40">Prev</button>
            <span>Page {safePage} / {pageCount}</span>
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount} className="vy-btn vy-btn--outline vy-btn--sm disabled:opacity-40">Next</button>
          </div>
        </div>
      </Card>

      {/* FC distribution */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><Truck className="h-4 w-4" /></span>
          <div>
            <div className="flex items-center gap-1.5 font-medium">By fulfillment center <Badge tone="muted">Estimated</Badge></div>
            <p className="text-[11px] text-muted-foreground">Indicative split — real per-FC data needs the FBA inbound/placement feed ({filtered.length} of {rows.length} SKUs shown)</p>
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

function FragmentGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function SortTh({ label, k, right, sort, onSort, extra }: {
  label: string; k: SortKey; right?: boolean; sort: { key: SortKey; dir: "asc" | "desc" } | null; onSort: (k: SortKey) => void; extra?: ReactNode;
}) {
  const active = sort?.key === k;
  return (
    <th className={cn("cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium hover:text-foreground", right && "text-right")} onClick={() => onSort(k)}>
      <span className="inline-flex items-center gap-1">{label}{extra}{active && <span className="text-[8px]">{sort!.dir === "asc" ? "▲" : "▼"}</span>}</span>
    </th>
  );
}

function Row({ r, editing, onSave, onFav, dup, indent, router }: {
  r: InvRow; editing: boolean; onSave: (id: string, v: string) => void; onFav: (id: string, v: boolean) => void; dup: boolean; indent?: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const sticker = isStickerless(r);
  return (
    <tr className="hover:bg-accent/40">
      {/* Product — indented under its parent in family view (tree hierarchy) */}
      <td className={cn("py-2.5 pr-3", indent ? "pl-9" : "pl-3")}>
        <div className="flex items-center gap-2.5">
          <button onClick={() => onFav(r.id, !r.favorite)} className="shrink-0 text-muted-foreground hover:text-warning" title={r.favorite ? "Unfavorite" : "Mark favorite"} aria-label="Toggle favorite">
            <Star className={cn("h-4 w-4", r.favorite && "fill-warning text-warning")} />
          </button>
          <span className="relative inline-grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
            {r.image ? <Image src={r.image} alt="" fill sizes="32px" className="object-cover" /> : <Package className="h-4 w-4" />}
          </span>
          <Link href={`/catalog/${r.familyId}`} className="block max-w-[260px] truncate text-[13px] font-medium hover:text-primary" title={r.family}>
            {r.family}{r.color ? ` · ${r.color}` : ""}
          </Link>
        </div>
      </td>
      {/* SKU — the hero, in its own column */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Link href={`/inventory?q=${encodeURIComponent(r.sku)}`} className="font-mono text-[13px] font-bold hover:text-primary">{r.sku}</Link>
          {dup && <span title={`ASIN ${r.asin} is sold under more than one SKU — stock is split across duplicate listings`}><Badge tone="danger">Dup</Badge></span>}
        </div>
        {r.asin && <div className="font-mono text-[10px] text-muted-foreground">ASIN {r.asin}</div>}
      </td>
      <td className="px-3 py-2.5">
        {sticker
          ? <Badge tone="warning" >Stickerless</Badge>
          : <span className="font-mono text-[12px] text-muted-foreground">{r.fnsku ?? "—"}</span>}
      </td>
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
          <button onClick={() => router.push(`/orders?reorder=1&sku=${encodeURIComponent(r.sku)}&name=${encodeURIComponent(r.family)}${r.supplier ? `&supplier=${encodeURIComponent(r.supplier)}` : ""}${r.lastCost != null ? `&cost=${r.lastCost}` : ""}`)} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Reorder
          </button>
        )}
      </td>
    </tr>
  );
}
