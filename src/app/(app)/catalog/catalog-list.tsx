"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead, CardHeader } from "@/components/ui/primitives";
import { Drawer, DrawerStat } from "@/components/ui/drawer";
import { Select } from "@/components/ui/select";
import { FAMILY_HEALTH_TONE, VARIANT_STATUS_TONE, marginTone, num, type FamilyHealth, type Tone } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown, Package, ArrowRight, ArrowUpRight, Layers, Star } from "lucide-react";
import { NewProductButton } from "./new-product-button";
import { CategoryManagerButton, type CategoryRow } from "./category-manager";
import { setProductFavorite, bulkSetProductStatus } from "./actions";

const STATUS_TONE: Record<string, Tone> = { active: "success", draft: "info", archived: "muted" };

export type FamilySummary = {
  id: string;
  parent: string;
  color: string | null;
  category: string;
  supplier: string | null;
  lastOrdered: string | null;
  leadTime: number | null;
  skuCount: number;
  stock: number;
  inbound: number;
  costLabel: string;
  health: FamilyHealth;
  lowStock: boolean;
  avgMargin: number | null;
  status: string;
  favorite: boolean;
  skus: { sku: string; asin: string | null; stock: number; status: string }[];
};

const CHIPS: { key: "all" | FamilyHealth; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Reorder", label: "Reorder" },
  { key: "Data gap", label: "Data gap" },
];

type SortKey = "parent" | "category" | "skuCount" | "stock" | "inbound" | "avgMargin";

export function CatalogList({ families, categories }: { families: FamilySummary[]; categories: CategoryRow[] }) {
  const router = useRouter();
  const [, startFav] = useTransition();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [chip, setChip] = useState<"all" | FamilyHealth>("all");
  const [supplier, setSupplier] = useState("all");
  const [singleOnly, setSingleOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"current" | "active" | "draft" | "archived" | "all">("current");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [, startBulk] = useTransition();
  const toggleSel = (id: string) => setSel((s) => { const c = new Set(s); if (c.has(id)) c.delete(id); else c.add(id); return c; });
  const bulkApply = (status: "active" | "draft" | "archived") => startBulk(async () => { await bulkSetProductStatus([...sel], status); setSel(new Set()); router.refresh(); });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [peek, setPeek] = useState<FamilySummary | null>(null);

  const toggleFav = (id: string, v: boolean) => startFav(async () => { await setProductFavorite(id, v); router.refresh(); });

  const categoryNames = categories.map((c) => c.name);
  const supplierNames = useMemo(
    () => [...new Set(families.map((f) => f.supplier).filter((s): s is string => !!s))].sort(),
    [families]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return families.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (supplier !== "all" && f.supplier !== supplier) return false;
      if (chip !== "all" && f.health !== chip) return false;
      if (singleOnly && f.skuCount > 1) return false;
      if (favOnly && !f.favorite) return false;
      if (statusFilter === "current" ? f.status === "archived" : statusFilter !== "all" && f.status !== statusFilter) return false;
      if (needle) {
        const hay = `${f.parent} ${f.category} ${f.supplier ?? ""} ${f.skus.map((s) => s.sku).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [families, q, category, supplier, chip, singleOnly, favOnly, statusFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const { key, dir } = sort; const f = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === "string" || typeof bv === "string") return String(av ?? "").localeCompare(String(bv ?? "")) * f;
      return (((av as number) ?? -Infinity) - ((bv as number) ?? -Infinity)) * f;
    });
  }, [filtered, sort]);

  const variantsTotal = families.reduce((s, f) => s + f.skuCount, 0);
  const reorderCount = families.filter((f) => f.health === "Reorder").length;
  const gapCount = families.filter((f) => f.health === "Data gap").length;
  const singleCount = families.filter((f) => f.skuCount === 1).length;
  const favCount = families.filter((f) => f.favorite).length;
  const draftCount = families.filter((f) => f.status === "draft").length;

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const from = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(from, from + pageSize);
  useEffect(() => { setPage(1); }, [q, category, supplier, chip, singleOnly, favOnly, statusFilter, pageSize]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "parent" || key === "category" ? "asc" : "desc" }));

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Catalog"
        title="Products"
        sub="Every product family you buy and sell. Open one to see variants, costs, Amazon identity, and order history."
        actions={<><CategoryManagerButton categories={categories} /><NewProductButton categories={categoryNames} /></>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Products" value={num(families.length)} sub="families" />
        <Kpi label="Variants" value={num(variantsTotal)} sub="active SKUs" />
        <Kpi label="Reorder" value={num(reorderCount)} sub={reorderCount === 1 ? "family low" : "families low"} tone={reorderCount ? "warning" : undefined} />
        <Kpi label="Data gaps" value={num(gapCount)} sub="need attention" tone={gapCount ? "danger" : undefined} />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, SKU, FNSKU, ASIN, supplier"
            className="min-w-56 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <Select value={category} onChange={setCategory} className="w-44" options={[{ value: "all", label: "All categories" }, ...categoryNames.map((c) => ({ value: c, label: c }))]} />
          <Select value={supplier} onChange={setSupplier} className="w-44" options={[{ value: "all", label: "All suppliers" }, ...supplierNames.map((s) => ({ value: s, label: s }))]} />
          <div className="flex flex-wrap gap-1">
            {CHIPS.map((c) => (
              <button key={c.key} onClick={() => setChip(c.key)} className={cn("vy-chip", chip === c.key && "is-active")}>{c.label}</button>
            ))}
            <button onClick={() => setSingleOnly((v) => !v)} className={cn("vy-chip inline-flex items-center gap-1", singleOnly && "is-active")} title="Single-SKU products — likely orphans to group under a parent">
              <Layers className="h-3 w-3" /> Single-SKU{singleCount ? ` (${singleCount})` : ""}
            </button>
            <button onClick={() => setFavOnly((v) => !v)} className={cn("vy-chip inline-flex items-center gap-1", favOnly && "is-active")} title="Favorited products">
              <Star className={cn("h-3 w-3", favOnly && "fill-current")} /> Favorites{favCount ? ` (${favCount})` : ""}
            </button>
          </div>
        </div>
        {/* lifecycle status */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[11px] text-muted-foreground">Status:</span>
          {([["current", "Current"], ["active", "Active"], ["draft", `Draft${draftCount ? ` (${draftCount})` : ""}`], ["archived", "Archived"], ["all", "All"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setStatusFilter(k)} className={cn("vy-chip", statusFilter === k && "is-active")}>{label}</button>
          ))}
        </div>
      </Card>

      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border bg-accent/50 px-4 py-2.5 text-sm">
          <span className="font-semibold">{sel.size} selected</span>
          <span className="text-[12px] text-muted-foreground">Bulk lifecycle — archive soft-hides them but keeps history.</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => bulkApply("archived")} className="vy-btn vy-btn--outline vy-btn--sm">Archive</button>
            <button type="button" onClick={() => bulkApply("active")} className="vy-btn vy-btn--ghost vy-btn--sm">Activate</button>
            <button type="button" onClick={() => setSel(new Set())} className="vy-btn vy-btn--ghost vy-btn--sm">Clear</button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader title={`${sorted.length} products`} caption="Click a row for a quick look · the name opens the product" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <SortTh label="Product" k="parent" sort={sort} onSort={toggleSort} />
                <SortTh label="Category" k="category" sort={sort} onSort={toggleSort} />
                <SortTh label="SKUs" k="skuCount" right sort={sort} onSort={toggleSort} />
                <SortTh label="FBA stock" k="stock" right sort={sort} onSort={toggleSort} />
                <SortTh label="Inbound" k="inbound" right sort={sort} onSort={toggleSort} />
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Last cost</th>
                <SortTh label="Margin" k="avgMargin" right sort={sort} onSort={toggleSort} />
                <th className="whitespace-nowrap px-3 py-2 font-medium">Health</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {pageRows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No products match your filters.</td></tr>
              ) : pageRows.map((f) => {
                const open = !!expanded[f.id];
                return (
                <FamilyRows key={f.id}>
                  <tr onClick={() => setPeek(f)} className={cn("cursor-pointer hover:bg-accent/40", f.status === "archived" && "opacity-60")}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={sel.has(f.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleSel(f.id)} className="h-4 w-4 shrink-0 accent-primary" aria-label="Select product" />
                        {f.skuCount > 1 ? (
                          <button onClick={(e) => { e.stopPropagation(); setExpanded((s) => ({ ...s, [f.id]: !open })); }} className="shrink-0 text-muted-foreground hover:text-foreground" title={open ? "Collapse" : "Show variants"} aria-label="Toggle variants">
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        ) : <span className="h-4 w-4 shrink-0" />}
                        <button onClick={(e) => { e.stopPropagation(); toggleFav(f.id, !f.favorite); }} className="shrink-0 text-muted-foreground hover:text-warning" title={f.favorite ? "Unfavorite" : "Favorite"} aria-label="Toggle favorite">
                          <Star className={cn("h-4 w-4", f.favorite && "fill-warning text-warning")} />
                        </button>
                        <span className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground"><Package className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/catalog/${f.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-[240px] truncate font-medium hover:text-primary" title={f.parent}>{f.parent}{f.color ? ` · ${f.color}` : ""}</Link>
                            {f.status !== "active" && <Badge tone={STATUS_TONE[f.status] ?? "muted"}>{f.status}</Badge>}
                          </div>
                          {f.supplier && <div className="text-[11px] text-muted-foreground">{f.supplier}{f.lastOrdered ? ` · last ordered ${f.lastOrdered}` : ""}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{f.category}</td>
                    <td className="tabular px-3 py-2.5 text-right font-mono">{num(f.skuCount)}</td>
                    <td className={cn("tabular px-3 py-2.5 text-right font-mono font-semibold", f.lowStock && "text-warning")}>{num(f.stock)}</td>
                    <td className={cn("tabular px-3 py-2.5 text-right font-mono", f.inbound > 0 ? "text-info" : "text-muted-foreground")}>{f.inbound > 0 ? num(f.inbound) : "—"}</td>
                    <td className="tabular px-3 py-2.5 text-right font-mono text-muted-foreground">{f.costLabel}</td>
                    <td className="px-3 py-2.5 text-right">{f.avgMargin != null ? <Badge tone={marginTone(f.avgMargin)}>{f.avgMargin}%</Badge> : <span className="text-[11px] text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5"><Badge tone={FAMILY_HEALTH_TONE[f.health]}>{f.health}</Badge></td>
                    <td className="px-3 py-2.5 text-right"><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                  {open && f.skus.map((sk) => (
                    <tr key={sk.sku} className="bg-muted/20 text-[12px]">
                      <td className="py-1.5 pl-14 pr-3">
                        <Link href={`/inventory?q=${encodeURIComponent(sk.sku)}`} className="font-mono hover:text-primary">{sk.sku}</Link>
                        {sk.asin && <span className="ml-2 font-mono text-[10px] text-muted-foreground">ASIN {sk.asin}</span>}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">variant</td>
                      <td />
                      <td className={cn("tabular px-3 py-1.5 text-right font-mono", sk.stock <= 40 && "text-warning")}>{num(sk.stock)}</td>
                      <td colSpan={3} />
                      <td className="px-3 py-1.5"><Badge tone={VARIANT_STATUS_TONE[sk.status] ?? "muted"}>{sk.status}</Badge></td>
                      <td />
                    </tr>
                  ))}
                </FamilyRows>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows:</span>
            {[25, 50, 100].map((n) => (
              <button key={n} onClick={() => setPageSize(n)} className={cn("rounded px-2 py-0.5", pageSize === n ? "bg-primary/12 font-medium text-primary" : "hover:bg-accent")}>{n}</button>
            ))}
          </div>
          <div>Showing {sorted.length === 0 ? 0 : from + 1}–{Math.min(from + pageSize, sorted.length)} of {num(sorted.length)} products</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="vy-btn vy-btn--outline vy-btn--sm disabled:opacity-40">Prev</button>
            <span>Page {safePage} / {pageCount}</span>
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount} className="vy-btn vy-btn--outline vy-btn--sm disabled:opacity-40">Next</button>
          </div>
        </div>
      </Card>

      <Drawer open={!!peek} onClose={() => setPeek(null)} title={peek?.parent}>
        {peek && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              {peek.category}{peek.supplier ? ` · ${peek.supplier}` : ""}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={FAMILY_HEALTH_TONE[peek.health]}>{peek.health}</Badge>
              {peek.avgMargin != null && <Badge tone={marginTone(peek.avgMargin)}>{peek.avgMargin}% margin</Badge>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <DrawerStat label="Variants" value={num(peek.skuCount)} />
              <DrawerStat label="Unit cost" value={peek.costLabel} />
              <DrawerStat label="Lead time" value={peek.leadTime ? `${peek.leadTime}d` : "—"} />
            </div>
            <Link href={`/inventory?q=${encodeURIComponent(peek.parent)}`} className="flex items-center justify-between rounded-lg border bg-accent/40 px-3 py-2.5 text-sm hover:bg-accent">
              <span><span className="font-mono font-semibold">{num(peek.stock)}</span> FBA units · {num(peek.inbound)} inbound<div className="text-[11px] text-muted-foreground">View in Inventory</div></span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div>
              <div className="vy-kicker mb-2">SKUs</div>
              <ul className="space-y-1.5">
                {peek.skus.map((s) => (
                  <li key={s.sku} className="flex items-center gap-2 rounded-md border px-3 py-2 text-[12px]">
                    <span className="min-w-0 flex-1 truncate font-mono">{s.sku}</span>
                    <span className={cn("tabular font-mono", s.stock <= 40 && "text-warning")}>{num(s.stock)} u</span>
                    <Badge tone={VARIANT_STATUS_TONE[s.status] ?? "muted"}>{s.status}</Badge>
                    {s.asin
                      ? <a href={`https://www.amazon.com/dp/${s.asin}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-0.5 font-medium text-primary hover:underline" title={`Open ${s.asin} on Amazon`}>Amazon <ArrowUpRight className="h-3 w-3" /></a>
                      : <span className="shrink-0 text-[10px] text-muted-foreground">no ASIN</span>}
                  </li>
                ))}
              </ul>
            </div>
            <Link href={`/catalog/${peek.id}`} className="vy-btn vy-btn--primary w-full justify-center">
              Open product <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function FamilyRows({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function SortTh({ label, k, right, sort, onSort }: {
  label: string; k: SortKey; right?: boolean; sort: { key: SortKey; dir: "asc" | "desc" } | null; onSort: (k: SortKey) => void;
}) {
  const active = sort?.key === k;
  return (
    <th className={cn("cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium hover:text-foreground", right && "text-right")} onClick={() => onSort(k)}>
      <span className="inline-flex items-center gap-1">{label}{active && <span className="text-[8px]">{sort!.dir === "asc" ? "▲" : "▼"}</span>}</span>
    </th>
  );
}
