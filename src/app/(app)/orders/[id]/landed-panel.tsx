"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, KpiStrip, SectionHeader } from "@/components/ui/primitives";
import { money, num, productionLanded, costUsd, type OrderRow, type OrderCostRow } from "@/lib/derive";
import { lockLandedCost, unlockLandedCost } from "../actions";
import { PackageCheck, Lock, Unlock, DollarSign, Boxes, Layers, Check } from "lucide-react";

type LandedLine = { id: string; sku: string | null; product_name: string | null; family_id: string | null; qty: number; unit_cost: number | null; unit_cny_ref: number | null };

export function LandedPanel({ order, lines, costs }: { order: OrderRow; lines: LandedLine[]; costs: OrderCostRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const roll = useMemo(() => productionLanded(lines, costs), [lines, costs]);
  const locked = order.status === "closed";
  const inv = costs.filter((c) => c.treatment !== "period"); // inventoriable costs roll into landed
  const allocated = inv.reduce((s, c) => s + costUsd(c), 0);
  const avgLanded = roll.totalUnits > 0 ? roll.totalLanded / roll.totalUnits : 0;

  const lock = () => start(async () => { const r = await lockLandedCost(order.id); if (r.ok) router.refresh(); });
  const unlock = () => start(async () => { const r = await unlockLandedCost(order.id); if (r.ok) router.refresh(); });

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Landed cost"
        blurb="Reconcile goods + freight + duties into the true all-in cost per unit, then lock it to close the order."
        badges={<>
          <Badge tone={locked ? "success" : "muted"}>{locked ? "Locked" : "Provisional"}</Badge>
          <Badge tone="muted">{num(roll.totalUnits)} pcs</Badge>
          <Badge tone="muted">avg {money(avgLanded)}/u</Badge>
        </>}
        nextAction={{
          headline: locked ? "Landed cost locked" : "Lock landed cost",
          detail: locked ? "Final landed cost was written back to each SKU's catalog history. Unlock to revise." : "When goods, freight and duties are in, lock to write the all-in cost back to each SKU and close the order.",
          severity: locked ? undefined : "warning",
          cta: locked
            ? <button type="button" onClick={unlock} disabled={pending} className="vy-btn vy-btn--outline inline-flex items-center gap-1.5"><Unlock className="h-4 w-4" /> {pending ? "…" : "Unlock"}</button>
            : <button type="button" onClick={lock} disabled={pending || roll.totalUnits === 0} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5 disabled:opacity-50"><Lock className="h-4 w-4" /> {pending ? "Locking…" : "Lock landed cost"}</button>,
        }}
      />

      <KpiStrip cols={5}>
        <Kpi label="Total landed" value={money(roll.totalLanded)} sub="goods + costs" icon={DollarSign} />
        <Kpi label="Avg landed / unit" value={money(avgLanded)} sub="all-in per pc" icon={Layers} tone="info" />
        <Kpi label="Units" value={num(roll.totalUnits)} sub={`${roll.withLanded.length} SKUs`} icon={Boxes} />
        <Kpi label="Allocated costs" value={money(allocated)} sub="freight · duties · fees" icon={DollarSign} tone={allocated > 0 ? "warning" : undefined} />
        <Kpi label="Status" value={locked ? "Closed" : "Open"} sub={locked ? "landed locked" : "not locked"} icon={PackageCheck} tone={locked ? "success" : "muted"} />
      </KpiStrip>

      {locked ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: "hsl(var(--success) / 0.08)", borderColor: "hsl(var(--success) / 0.3)" }}>
          <Badge tone="success"><Check className="h-3 w-3" /> Locked</Badge>
          <span><span className="font-semibold">Landed cost is final.</span><span className="text-muted-foreground"> Each SKU&apos;s all-in cost was written to its catalog landed-cost history.</span></span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.3)" }}>
          <Badge tone="warning">Provisional</Badge>
          <span><span className="font-semibold">Estimate — not yet locked.</span><span className="text-muted-foreground"> Add freight &amp; duties in Production, then lock here (duties excluded until entered).</span></span>
        </div>
      )}

      {/* Cost buckets */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><Layers className="h-4 w-4" /></span><div><div className="font-semibold">Cost buckets</div><p className="text-[11px] text-muted-foreground">Goods plus the non-product costs allocated into landed cost. Edit costs in Production.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border bg-background/40 p-3">
            <div className="vy-kicker">Goods (direct)</div>
            <div className="mt-0.5 font-mono text-base font-bold">{money(roll.totalGoods)}</div>
            <div className="text-[11px] text-muted-foreground">across {num(roll.totalUnits)} units</div>
          </div>
          {inv.map((c) => (
            <div key={c.id} className="rounded-lg border bg-background/40 p-3">
              <div className="vy-kicker truncate">{c.description}</div>
              <div className="mt-0.5 font-mono text-base font-bold">{money(costUsd(c))}</div>
              <div className="text-[11px] text-muted-foreground">by {c.basis === "units" ? "qty" : "value"}{c.line_type ? ` · ${c.line_type}` : ""}</div>
            </div>
          ))}
          {inv.length === 0 && <div className="rounded-lg border border-dashed p-3 text-[12px] text-muted-foreground">No allocated costs yet — add freight, duties, fees in Production.</div>}
        </div>
      </Card>

      {/* Per-SKU landed table */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2.5 px-5 py-4"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-primary/12 text-primary"><Boxes className="h-4 w-4" /></span><div><div className="font-semibold">Landed cost per SKU</div><p className="text-[11px] text-muted-foreground">Goods cost + its share of allocated costs = the all-in cost per unit.</p></div></div>
        {roll.withLanded.length === 0 ? (
          <div className="border-t px-5 py-10 text-center text-sm text-muted-foreground">No production lines yet — add SKUs in Production.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-y bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Goods / u</th>
                <th className="px-3 py-2 text-right font-medium">+ Costs / u</th>
                <th className="px-3 py-2 text-right font-medium">Landed / u</th>
                <th className="px-5 py-2 text-right font-medium">Landed total</th>
              </tr></thead>
              <tbody className="divide-y">
                {roll.withLanded.map((l) => {
                  const goodsU = Number(l.unit_cost) || 0;
                  const costsU = Math.max(0, l.landedUnit - goodsU);
                  return (
                    <tr key={l.id}>
                      <td className="px-5 py-2.5 font-mono text-[12px] font-semibold">{l.sku}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono">{num(l.qty)}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono text-muted-foreground">{money(goodsU)}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono text-warning">+{money(costsU)}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono font-semibold text-info">{money(l.landedUnit)}{locked ? "" : " est"}</td>
                      <td className="tabular px-5 py-2.5 text-right font-mono font-semibold">{money(l.landedUnit * Number(l.qty))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="border-t bg-muted/30 font-semibold">
                <td className="px-5 py-3">Order total</td>
                <td className="tabular px-3 py-3 text-right font-mono">{num(roll.totalUnits)}</td>
                <td colSpan={3} />
                <td className="tabular px-5 py-3 text-right font-mono">{money(roll.totalLanded)}</td>
              </tr></tfoot>
            </table>
          </div>
        )}
        <p className="px-5 py-3 text-[11px] text-muted-foreground">Allocated by each cost&apos;s basis (qty or value). {locked ? "Locked — written to catalog landed-cost history." : "Provisional estimate; duties excluded until entered in Production."}</p>
      </Card>
    </div>
  );
}
