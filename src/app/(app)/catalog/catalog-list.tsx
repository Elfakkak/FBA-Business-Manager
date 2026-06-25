"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Badge, Kpi, PageHead } from "@/components/ui/primitives";
import { Drawer, DrawerStat } from "@/components/ui/drawer";
import { FAMILY_HEALTH_TONE, VARIANT_STATUS_TONE, num, type FamilyHealth } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { ChevronRight, Package, ArrowRight, ArrowUpRight } from "lucide-react";
import { NewProductButton } from "./new-product-button";
import { CategoryManagerButton, type CategoryRow } from "./category-manager";

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
  skus: { sku: string; stock: number; status: string }[];
};

const CHIPS: { key: "all" | FamilyHealth; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Reorder", label: "Reorder" },
  { key: "Data gap", label: "Data gap" },
];

export function CatalogList({ families, categories }: { families: FamilySummary[]; categories: CategoryRow[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [chip, setChip] = useState<"all" | FamilyHealth>("all");
  const [supplier, setSupplier] = useState("all");
  const [peek, setPeek] = useState<FamilySummary | null>(null);

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
      if (needle) {
        const hay = `${f.parent} ${f.category} ${f.supplier ?? ""} ${f.skus.map((s) => s.sku).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [families, q, category, supplier, chip]);

  const variantsTotal = families.reduce((s, f) => s + f.skuCount, 0);
  const reorderCount = families.filter((f) => f.health === "Reorder").length;
  const gapCount = families.filter((f) => f.health === "Data gap").length;

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
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product, SKU, FNSKU, ASIN, supplier"
            className="min-w-56 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="all">All categories</option>
            {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="all">All suppliers</option>
            {supplierNames.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex gap-1">
            {CHIPS.map((c) => (
              <button key={c.key} onClick={() => setChip(c.key)} className={cn("vy-chip", chip === c.key && "is-active")}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b px-4 py-3 text-sm">
          <span className="font-medium">{filtered.length} products</span>
          <span className="text-muted-foreground">Sorted by family</span>
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">No products match your filters.</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((f) => (
              <li key={f.id}>
                <div onClick={() => setPeek(f)} className="vy-cat-row flex cursor-pointer items-center gap-4 px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/catalog/${f.id}`} onClick={(e) => e.stopPropagation()} className="truncate font-medium hover:text-primary">{f.parent}{f.color ? ` · ${f.color}` : ""}</Link>
                      <Badge tone={FAMILY_HEALTH_TONE[f.health]}>{f.health}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      {f.category} · {f.skuCount} {f.skuCount === 1 ? "variant" : "variants"}
                      {f.supplier ? ` · ${f.supplier}` : ""}
                      {f.lastOrdered ? ` · last ordered ${f.lastOrdered}` : ""}
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right">
                    <div className={cn("tabular font-mono text-sm font-semibold", f.lowStock && "text-warning")}>{num(f.stock)}</div>
                    <div className="text-[11px] text-muted-foreground">FBA · {num(f.inbound)} inbound</div>
                  </div>
                  <div className="hidden w-28 shrink-0 text-right sm:block">
                    <div className="tabular font-mono text-sm">{f.costLabel}</div>
                    <div className="text-[11px] text-muted-foreground">last unit cost</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Drawer open={!!peek} onClose={() => setPeek(null)} title={peek?.parent}>
        {peek && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              {peek.category}{peek.supplier ? ` · ${peek.supplier}` : ""}
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={FAMILY_HEALTH_TONE[peek.health]}>{peek.health}</Badge>
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
