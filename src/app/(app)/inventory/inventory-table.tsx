"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Badge, Kpi, PageHead, SourceTag } from "@/components/ui/primitives";
import { INV_HEALTH_TONE, num, type InvHealth } from "@/lib/derive";
import { cn } from "@/lib/utils";

export type InvRow = {
  id: string;
  sku: string;
  fnsku: string | null;
  family: string;
  familyId: string;
  category: string;
  onHand: number;
  reserved: number;
  available: number;
  inbound: number;
  unfulfillable: number;
  daysCover: number | null;
  reorderPoint: number;
  health: InvHealth;
};

const CHIPS: { key: "all" | InvHealth; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Reorder", label: "Reorder" },
  { key: "Low", label: "Low" },
  { key: "Healthy", label: "Healthy" },
];

export function InventoryTable({ rows }: { rows: InvRow[] }) {
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<"all" | InvHealth>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (chip !== "all" && r.health !== chip) return false;
      if (needle && !`${r.sku} ${r.fnsku ?? ""} ${r.family}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, chip]);

  const onHand = rows.reduce((s, r) => s + r.onHand, 0);
  const available = rows.reduce((s, r) => s + r.available, 0);
  const inbound = rows.reduce((s, r) => s + r.inbound, 0);
  const reorderNow = rows.filter((r) => r.health === "Reorder").length;
  const unfulfillable = rows.reduce((s, r) => s + r.unfulfillable, 0);

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Catalog"
        title="Inventory"
        sub="Live FBA stock per SKU, joined to your catalog. On-hand, reserved and inbound sync from Amazon; reorder points are yours."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="On hand" value={num(onHand)} sub="FBA units" source="amazon" tone="success" />
        <Kpi label="Available" value={num(available)} sub="sellable now" />
        <Kpi label="Inbound" value={num(inbound)} sub="to FBA" source="amazon" tone="info" />
        <Kpi label="Reorder now" value={num(reorderNow)} sub="SKUs" tone={reorderNow ? "danger" : undefined} />
        <Kpi label="Unfulfillable" value={num(unfulfillable)} sub="stranded" source="amazon" tone={unfulfillable ? "warning" : undefined} />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search SKU, FNSKU, product"
            className="min-w-56 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-1">
            {CHIPS.map((c) => (
              <button
                key={c.key}
                onClick={() => setChip(c.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  chip === c.key ? "border-primary/30 bg-primary/12 text-primary" : "hover:bg-accent"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b px-4 py-3 text-sm">
          <span className="font-medium">{filtered.length} SKUs</span>
          <span className="text-muted-foreground">Available = on-hand − reserved − unfulfillable</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Product / SKU</th>
                <th className="px-4 py-2 font-medium"><span className="inline-flex items-center gap-1">FNSKU <SourceTag source="amazon" /></span></th>
                <th className="px-4 py-2 text-right font-medium">On hand</th>
                <th className="px-4 py-2 text-right font-medium">Reserved</th>
                <th className="px-4 py-2 text-right font-medium">Avail</th>
                <th className="px-4 py-2 text-right font-medium">Inbound</th>
                <th className="px-4 py-2 text-right font-medium">Days cover</th>
                <th className="px-4 py-2 text-right font-medium"><span className="inline-flex items-center gap-1">Reorder pt <SourceTag source="manual" /></span></th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No SKUs match your filters.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/catalog/${r.familyId}`} className="font-mono text-[12px] font-semibold hover:text-primary">{r.sku}</Link>
                    <div className="text-[11px] text-muted-foreground">{r.family}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-muted-foreground">{r.fnsku ?? "—"}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono font-semibold">{num(r.onHand)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono text-muted-foreground">{num(r.reserved)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono font-semibold">{num(r.available)}</td>
                  <td className={cn("tabular px-4 py-2.5 text-right font-mono", r.inbound > 0 ? "text-info" : "text-muted-foreground")}>{r.inbound > 0 ? num(r.inbound) : "—"}</td>
                  <td className={cn("tabular px-4 py-2.5 text-right font-mono", r.daysCover != null && r.daysCover < 14 && "text-warning")}>{r.daysCover == null ? "∞" : `${r.daysCover}d`}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono text-muted-foreground">{num(r.reorderPoint)}</td>
                  <td className="px-4 py-2.5"><Badge tone={INV_HEALTH_TONE[r.health]}>{r.health}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
