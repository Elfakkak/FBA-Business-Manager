"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, KpiStrip, SectionHeader, SectionTitle } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { money, num, productionLanded, costUsd, type OrderRow, type OrderCostRow } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { lockLandedCost, unlockLandedCost, saveVariantSalePrice, saveLandedBuckets, type BucketEdit } from "../actions";
import { PackageCheck, Lock, Unlock, DollarSign, Boxes, Layers, Check, Receipt, Pencil } from "lucide-react";

type LandedLine = { id: string; sku: string | null; product_name: string | null; family_id: string | null; qty: number; unit_cost: number | null; unit_cny_ref: number | null };
type VariantLite = { sku: string; sale_price: number | null };

// $ with 2–3 decimals — per-unit landed figures read truer at 3dp (matches prototype coFmt3).
const fmt3 = (n: number) => "$" + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const isDutiesCost = (c: OrderCostRow) => c.line_type === "duties" || /dut(y|ies)|customs/i.test(c.description ?? "");

type Bucket = { id: string | null; label: string; amount: number; basis: string; source: string; isDuties: boolean };

export function LandedPanel({ order, lines, costs, variants }: { order: OrderRow; lines: LandedLine[]; costs: OrderCostRow[]; variants: VariantLite[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adjust, setAdjust] = useState(false);
  const locked = order.status === "closed";

  const roll = useMemo(() => productionLanded(lines, costs), [lines, costs]);
  const inv = useMemo(() => costs.filter((c) => c.treatment !== "period"), [costs]); // inventoriable → roll into landed
  const avgLanded = roll.totalUnits > 0 ? roll.totalLanded / roll.totalUnits : 0;
  const nonGoods = roll.totalLanded - roll.totalGoods;

  // Cost buckets: Goods (direct) is implicit; each inventoriable cost is a bucket.
  // Duties & customs is ALWAYS shown (a manual bucket) — pending until entered.
  const dutiesCost = inv.find(isDutiesCost) ?? null;
  const dutiesEntered = !!dutiesCost && costUsd(dutiesCost) > 0;
  const buckets: Bucket[] = useMemo(() => {
    const b: Bucket[] = inv.filter((c) => !isDutiesCost(c)).map((c) => ({
      id: c.id, label: c.description || "Cost", amount: costUsd(c), basis: c.basis,
      source: c.vendor || (costUsd(c) > 0 ? "Entered in Production" : "pending"), isDuties: false,
    }));
    b.push(dutiesCost
      ? { id: dutiesCost.id, label: "Duties & customs", amount: costUsd(dutiesCost), basis: dutiesCost.basis, source: costUsd(dutiesCost) > 0 ? "Entered" : "pending", isDuties: true }
      : { id: null, label: "Duties & customs", amount: 0, basis: "value", source: "To be entered", isDuties: true });
    return b;
  }, [inv, dutiesCost]);

  const lock = () => start(async () => { const r = await lockLandedCost(order.id); if (r.ok) router.refresh(); });
  const unlock = () => start(async () => { const r = await unlockLandedCost(order.id); if (r.ok) router.refresh(); });

  const nextAction = locked
    ? { headline: "Landed cost locked", detail: "Final landed cost per SKU is locked and written back to each catalog SKU. Unlock to revise.", severity: undefined,
        cta: <button type="button" onClick={unlock} disabled={pending} className="vy-btn vy-btn--outline inline-flex items-center gap-1.5"><Unlock className="h-4 w-4" /> {pending ? "…" : "Unlock"}</button> }
    : !dutiesEntered
    ? { headline: "Add duties & customs", detail: "Enter duties/customs to complete the landed cost before locking it in.", severity: "warning" as const,
        cta: <button type="button" onClick={() => setAdjust(true)} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Pencil className="h-4 w-4" /> Adjust costs</button> }
    : { headline: "Lock landed cost", detail: "All cost buckets entered. Lock the final per-SKU landed cost for this order.", severity: undefined,
        cta: <button type="button" onClick={lock} disabled={pending || roll.totalUnits === 0} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5 disabled:opacity-50"><Lock className="h-4 w-4" /> {pending ? "Locking…" : "Lock landed cost"}</button> };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Landed cost"
        blurb="Roll up every cost on this order and allocate it across SKUs to calculate the final landed cost per unit."
        badges={<>
          <Badge tone={locked ? "success" : "info"}>{locked ? "Locked" : "Draft"}</Badge>
          <Badge tone="muted">{fmt3(avgLanded)} avg / unit</Badge>
          {!locked && !dutiesEntered && <Badge tone="warning">Duties pending</Badge>}
        </>}
        nextAction={nextAction}
      />

      <KpiStrip cols={5}>
        <Kpi label="Total landed cost" value={money(roll.totalLanded)} sub={`goods + ${money(nonGoods)} costs`} icon={DollarSign} />
        <Kpi label="Avg landed / unit" value={fmt3(avgLanded)} sub="across all SKUs" icon={Layers} tone="info" />
        <Kpi label="Units" value={num(roll.totalUnits)} sub={`${roll.withLanded.length} SKUs`} icon={Boxes} />
        <Kpi label="Cost buckets" value={num(buckets.length + 1)} sub={`goods + ${buckets.length} allocated`} icon={Receipt} />
        <Kpi label="Status" value={locked ? "Locked" : "Draft"} sub={locked ? "Final" : dutiesEntered ? "Ready to lock" : "Duties pending"} icon={locked ? Check : PackageCheck} tone={locked ? "success" : dutiesEntered ? "info" : "warning"} />
      </KpiStrip>

      {locked ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: "hsl(var(--success) / 0.08)", borderColor: "hsl(var(--success) / 0.3)" }}>
          <Badge tone="success"><Check className="h-3 w-3" /> Locked</Badge>
          <span><span className="font-semibold">Landed cost is final.</span><span className="text-muted-foreground"> Each SKU&apos;s all-in cost was written to its catalog landed-cost history.</span></span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.3)" }}>
          <Badge tone="warning">Provisional</Badge>
          <span><span className="font-semibold">Landed cost is provisional.</span><span className="text-muted-foreground"> {dutiesEntered ? "Review the buckets, then lock to finalize." : "Enter duties & customs to complete the calculation."}</span></span>
        </div>
      )}

      {/* Cost buckets */}
      <Card className="p-5">
        <SectionTitle icon={Receipt} tone="brand" strong title="Cost buckets" sub="Classified by charge type from this order's costs · allocated across SKUs"
          action={<button type="button" onClick={() => setAdjust(true)} disabled={locked} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5 disabled:opacity-40"><Pencil className="h-3 w-3" /> Adjust</button>} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border bg-background/40 p-3">
            <div className="vy-kicker">Goods (direct)</div>
            <div className="mt-0.5 font-mono text-base font-bold">{money(roll.totalGoods)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground"><Badge tone="info">Auto</Badge> Per SKU · from production</div>
          </div>
          {buckets.map((b, i) => (
            <div key={b.id ?? `new-${i}`} className="rounded-lg border bg-background/40 p-3">
              <div className="vy-kicker truncate">{b.label}</div>
              <div className={cn("mt-0.5 font-mono text-base font-bold", b.amount === 0 && "text-warning")}>{money(b.amount)}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
                <Badge tone={b.isDuties && b.amount === 0 ? "warning" : "muted"}>Manual</Badge>
                <Badge tone="muted">{b.basis === "units" ? "By units" : "By value"}</Badge>
                <span>{b.amount === 0 ? "pending" : b.source}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Costs are entered in Production; duties are entered manually. Use <strong className="font-semibold">Adjust</strong> to override any value or allocation basis.</p>
      </Card>

      {/* Per-SKU landed table */}
      <Card className="overflow-hidden p-0">
        <div className="px-5 pt-4"><SectionTitle icon={Boxes} tone="info" strong title="Landed cost per SKU" sub="Goods + allocated costs ÷ units" /></div>
        {roll.withLanded.length === 0 ? (
          <div className="border-t px-5 py-10 text-center text-sm text-muted-foreground">No production lines yet — add SKUs in Production.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
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
                      <td className="px-5 py-2.5"><div className="font-mono text-[12px] font-semibold">{l.sku}</div>{l.product_name && <div className="text-[11px] text-muted-foreground">{l.product_name}</div>}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono">{num(l.qty)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="tabular font-mono text-muted-foreground">{money(goodsU)}</div>
                        {!locked && <div className="mt-0.5"><span className="rounded bg-warning/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-warning">est</span></div>}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right font-mono text-muted-foreground">+{money(costsU)}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono font-bold text-info">{fmt3(l.landedUnit)}</td>
                      <td className="tabular px-5 py-2.5 text-right font-mono font-semibold">{money(l.landedUnit * Number(l.qty))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="border-t bg-muted/30 font-semibold">
                <td className="px-5 py-3">Order total</td>
                <td className="tabular px-3 py-3 text-right font-mono">{num(roll.totalUnits)}</td>
                <td className="px-3 py-3 text-right font-mono text-muted-foreground">—</td>
                <td className="tabular px-3 py-3 text-right font-mono text-muted-foreground">+{money(nonGoods)}</td>
                <td className="tabular px-3 py-3 text-right font-mono font-bold text-info">{fmt3(avgLanded)}</td>
                <td className="tabular px-5 py-3 text-right font-mono">{money(roll.totalLanded)}</td>
              </tr></tfoot>
            </table>
          </div>
        )}
        <p className="px-5 py-3 text-[11px] text-muted-foreground">&quot;+ Costs / u&quot; = this SKU&apos;s share of fees, freight, inspection and duties. Allocation basis is set per bucket under Adjust costs.</p>
      </Card>

      {/* Did it make money? */}
      <ProfitCard order={order} roll={roll} variants={variants} />

      {adjust && <AdjustModal orderId={order.id} buckets={buckets} onClose={() => setAdjust(false)} onSaved={() => { setAdjust(false); router.refresh(); }} />}
    </div>
  );
}

// ---- Did it make money? — profitability projection -----------------------------
function ProfitCard({ order, roll, variants }: { order: OrderRow; roll: ReturnType<typeof productionLanded>; variants: VariantLite[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const seed = useMemo(() => {
    const m = new Map(variants.map((v) => [v.sku, v.sale_price]));
    const o: Record<string, string> = {};
    for (const l of roll.withLanded) if (l.sku) o[l.sku] = m.get(l.sku) != null ? String(m.get(l.sku)) : "";
    return o;
  }, [variants, roll]);
  const [prices, setPrices] = useState<Record<string, string>>(seed);
  const [referralPct, setReferralPct] = useState("15");
  const [fbaUnit, setFbaUnit] = useState("5.50");

  const ref = (Number(referralPct) || 0) / 100;
  const fba = Number(fbaUnit) || 0;
  const rows = roll.withLanded.map((l) => {
    const qty = Number(l.qty) || 0;
    const price = Number(prices[l.sku ?? ""] ?? "") || 0;
    const priced = price > 0;
    const feeUnit = price * ref + fba;
    const netUnit = price - l.landedUnit - feeUnit;
    return { id: l.id, sku: l.sku, name: l.product_name, qty, price, priced, landedUnit: l.landedUnit, feeUnit, netUnit, marginPct: price > 0 ? netUnit / price : 0, profit: netUnit * qty, revenue: price * qty };
  });
  const priced = rows.filter((r) => r.priced);
  const revenue = priced.reduce((s, r) => s + r.revenue, 0);
  const fees = priced.reduce((s, r) => s + r.feeUnit * r.qty, 0);
  const fbaTotal = priced.reduce((s, r) => s + fba * r.qty, 0);
  const landed = priced.reduce((s, r) => s + r.landedUnit * r.qty, 0);
  const profit = revenue - fees - landed;
  const marginPct = revenue > 0 ? profit / revenue : 0;
  const anyUnpriced = rows.some((r) => !r.priced);

  const savePrice = (sku: string, v: string) => start(async () => { await saveVariantSalePrice(sku, Number(v) || null); router.refresh(); });
  const good = profit >= 0;

  return (
    <Card className="p-5">
      <SectionTitle icon={DollarSign} tone={good ? "success" : "danger"} strong title="Did it make money?" sub="Projected margin = sale price − landed cost − Amazon fees"
        action={<div className="flex flex-wrap items-center gap-3 text-[11.5px] text-muted-foreground">
          <label className="inline-flex items-center gap-1.5">Referral <input type="number" min="0" max="60" value={referralPct} onChange={(e) => setReferralPct(e.target.value)} className="w-14 rounded-md border bg-background px-2 py-1 text-right font-mono text-xs" /> %</label>
          <label className="inline-flex items-center gap-1.5">FBA $/u <input type="number" min="0" step="0.01" value={fbaUnit} onChange={(e) => setFbaUnit(e.target.value)} className="w-16 rounded-md border bg-background px-2 py-1 text-right font-mono text-xs" /></label>
        </div>} />

      <div className="mb-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Projected revenue", value: money(revenue), sub: "at current sale prices", tone: "" },
          { label: "Landed cost", value: money(landed), sub: "all-in COGS", tone: "" },
          { label: "Est. Amazon fees", value: money(fees), sub: `${referralPct}% referral + ${money(fbaTotal)} FBA`, tone: "" },
          { label: "Projected profit", value: money(profit), sub: "after fees + landed", tone: good ? "text-success" : "text-danger" },
          { label: "Net margin", value: `${(marginPct * 100).toFixed(1)}%`, sub: "of revenue", tone: good ? "text-success" : "text-danger" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border bg-background/40 p-3">
            <div className="vy-kicker">{k.label}</div>
            <div className={cn("mt-0.5 font-mono text-lg font-bold", k.tone)}>{k.value}</div>
            <div className="text-[10.5px] text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">SKU</th>
            <th className="px-3 py-2 text-right font-medium">Units</th>
            <th className="px-3 py-2 text-right font-medium">Sale price</th>
            <th className="px-3 py-2 text-right font-medium">Landed / u</th>
            <th className="px-3 py-2 text-right font-medium">Amazon fee / u</th>
            <th className="px-3 py-2 text-right font-medium">Net / u</th>
            <th className="px-3 py-2 text-right font-medium">Margin</th>
            <th className="px-3 py-2 text-right font-medium">Projected profit</th>
          </tr></thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2"><div className="font-mono text-[12px] font-semibold">{r.sku}</div>{r.name && <div className="text-[11px] text-muted-foreground">{r.name}</div>}</td>
                <td className="tabular px-3 py-2 text-right font-mono">{num(r.qty)}</td>
                <td className="px-3 py-2 text-right">
                  <span className="inline-flex items-center justify-end gap-1"><span className="font-mono text-muted-foreground">$</span>
                    <input type="number" min="0" step="0.01" defaultValue={r.price || ""} placeholder="0.00" onBlur={(e) => { const v = e.target.value; setPrices((p) => ({ ...p, [r.sku ?? ""]: v })); if (r.sku) savePrice(r.sku, v); }}
                      className={cn("w-20 rounded-md border bg-background px-2 py-1 text-right font-mono text-xs", !r.priced && "border-warning")} />
                  </span>
                </td>
                <td className="tabular px-3 py-2 text-right font-mono text-muted-foreground">{fmt3(r.landedUnit)}</td>
                <td className="tabular px-3 py-2 text-right font-mono text-muted-foreground">{r.priced ? `−${money(r.feeUnit)}` : "—"}</td>
                <td className={cn("tabular px-3 py-2 text-right font-mono font-bold", r.priced ? (r.netUnit >= 0 ? "text-success" : "text-danger") : "text-muted-foreground")}>{r.priced ? money(r.netUnit) : "—"}</td>
                <td className={cn("tabular px-3 py-2 text-right font-mono", r.priced ? (r.netUnit >= 0 ? "text-success" : "text-danger") : "text-muted-foreground")}>{r.priced ? `${(r.marginPct * 100).toFixed(0)}%` : "—"}</td>
                <td className={cn("tabular px-3 py-2 text-right font-mono font-bold", r.priced ? (r.netUnit >= 0 ? "text-success" : "text-danger") : "text-muted-foreground")}>{r.priced ? money(r.profit) : "set price"}</td>
              </tr>
            ))}
            <tr className="border-t bg-muted/30 font-semibold">
              <td className="px-3 py-2.5">Order total</td>
              <td className="tabular px-3 py-2.5 text-right font-mono">{num(roll.totalUnits)}</td>
              <td className="tabular px-3 py-2.5 text-right font-mono">{money(revenue)}</td>
              <td className="tabular px-3 py-2.5 text-right font-mono text-muted-foreground">{money(landed)}</td>
              <td className="tabular px-3 py-2.5 text-right font-mono text-muted-foreground">−{money(fees)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">—</td>
              <td className={cn("tabular px-3 py-2.5 text-right font-mono", good ? "text-success" : "text-danger")}>{(marginPct * 100).toFixed(0)}%</td>
              <td className={cn("tabular px-3 py-2.5 text-right font-mono", good ? "text-success" : "text-danger")}>{money(profit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2.5 text-[11px] text-muted-foreground">Sale prices are seeded from the catalog, <strong className="font-semibold">editable here and saved</strong> back to the product. Amazon fee = <strong className="font-semibold">{referralPct}% referral</strong> + <strong className="font-semibold">{money(fba)}/unit FBA</strong>{anyUnpriced ? " — set a price on the highlighted SKUs to include them" : ""}. Gross of returns, storage and PPC.</p>
    </Card>
  );
}

// ---- Adjust costs modal --------------------------------------------------------
function AdjustModal({ orderId, buckets, onClose, onSaved }: { orderId: string; buckets: Bucket[]; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(buckets.map((b) => ({ ...b })));
  const [saving, setSaving] = useState(false);
  const total = draft.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const set = (i: number, patch: Partial<Bucket>) => setDraft((p) => p.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));

  const save = async () => {
    setSaving(true);
    const items: BucketEdit[] = draft.map((b) => ({ id: b.id, amount: Math.max(0, Number(b.amount) || 0), basis: b.basis, isDuties: b.isDuties }));
    const r = await saveLandedBuckets(orderId, items);
    setSaving(false);
    if (r.ok) onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Adjust cost buckets">
      <p className="-mt-1 mb-3 text-[12px] text-muted-foreground">Costs come from Production; edit any amount to override, or set duties manually. Allocation basis controls how each spreads across SKUs.</p>
      <div className="space-y-3">
        {draft.map((b, i) => (
          <div key={b.id ?? `new-${i}`} className="flex flex-wrap items-end gap-3 rounded-lg border bg-background/40 p-3">
            <div className="min-w-[140px] flex-1">
              <div className="flex items-center gap-2 text-[13px] font-semibold">{b.label}{b.isDuties && <Badge tone={b.amount > 0 ? "info" : "warning"}>{b.amount > 0 ? "Manual" : "Pending"}</Badge>}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{b.source}</div>
            </div>
            <Field label="Amount (USD)"><input type="number" step="0.01" min="0" value={b.amount} onChange={(e) => set(i, { amount: Number(e.target.value) || 0 })} className={cn(inputCls, "w-28")} /></Field>
            <div className="w-36"><Field label="Allocate"><Select value={b.basis} onChange={(v) => set(i, { basis: v })} options={[{ value: "units", label: "By units" }, { value: "value", label: "By value" }]} /></Field></div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2.5 rounded-lg border bg-accent/50 px-3.5 py-2.5">
        <DollarSign className="h-3.5 w-3.5 text-primary" />
        <span className="vy-kicker">Allocated costs total</span>
        <span className="ml-auto font-mono text-sm font-bold">{money(total)}</span>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> {saving ? "Saving…" : "Save costs"}</PrimaryButton>
      </div>
    </Modal>
  );
}
