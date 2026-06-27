"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Badge } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Package, Boxes } from "lucide-react";

// ---- 2026 US non-peak FBA fee model (mirrors the Product page so a SKU reconciles) ----
const FC_REFERRAL: Record<string, number> = {
  "Steering wheel covers": 0.15, "Seat covers": 0.15, "Seat cushions": 0.15, "Floor mats": 0.15,
  "Air fresheners": 0.15, "Accessories": 0.15, "Automotive & Powersports": 0.12, "Electronics": 0.08,
  "Home & Kitchen": 0.15, "Tools & Home Improvement": 0.15, "Sports & Outdoors": 0.15, "Pet Supplies": 0.15,
  "Toys & Games": 0.15, "Beauty & Personal Care": 0.08, "Grocery": 0.08, "Clothing & Accessories": 0.17,
  "Other (15%)": 0.15,
};
const CATEGORIES = Object.keys(FC_REFERRAL);

const fcNum = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const fcMoney = (n: number) => { const v = Number(n) || 0; return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

function fcSizeTier(weightLbs: number, dims: number[]) {
  const [a, b, c] = [...dims].sort((x, y) => y - x);
  const w = fcNum(weightLbs);
  if (w <= 1 && a <= 15 && b <= 12 && c <= 0.75) return "Small standard";
  if (w <= 20 && a <= 18 && b <= 14 && c <= 8) return "Large standard";
  if (a >= 18 && a <= 37 && w <= 50) return "Small bulky";
  if (w <= 50) return "Large bulky";
  return "Extra-large";
}
function fcFulfillmentFee(weightLbs: number, dims: number[]) {
  const tier = fcSizeTier(weightLbs, dims);
  const w = fcNum(weightLbs);
  let base: number;
  if (tier === "Small standard") base = 3.30 + Math.max(0, w - 0.25) * 0.2;
  else if (tier === "Large standard") base = 4.98 + Math.max(0, w - 1) * 0.42;
  else if (tier === "Small bulky") base = 7.55 + Math.max(0, w - 3) * 0.30;
  else if (tier === "Large bulky") base = 9.61 + Math.max(0, w - 10) * 0.38;
  else base = 26.0 + w * 0.5;
  return Math.round(base * 1.035 * 100) / 100;
}
const fcCuFt = (dims: number[]) => (fcNum(dims[0]) * fcNum(dims[1]) * fcNum(dims[2])) / 1728;
const fcStorageMo = (dims: number[], months: number, peak: boolean) => Math.round(fcCuFt(dims) * (peak ? 2.40 : 0.78) * Math.max(1, fcNum(months, 1)) * 100) / 100;

function fcVerdict(net: number, marginPct: number | null, roiPct: number | null) {
  if (marginPct == null) return { label: "Set a price", tone: "muted" as const };
  if (net <= 0) return { label: "Loss", tone: "danger" as const };
  if (marginPct < 15 || (roiPct != null && roiPct < 30)) return { label: "Thin", tone: "warning" as const };
  if (marginPct < 28) return { label: "Healthy", tone: "info" as const };
  return { label: "Strong", tone: "success" as const };
}

export type CalcVariant = { famId: string; famName: string; sku: string; label: string; cost: number | null; price: number | null; l: number; w: number; h: number; wt: number; category: string };
export type CalcSeed = { sku?: string; label?: string; cost?: number | null; price?: number | null; l?: number; w?: number; h?: number; wt?: number; category?: string; units?: number };

export function FbaCalculator({ variants, seed }: { variants: CalcVariant[]; seed?: CalcSeed }) {
  const [salePrice, setSalePrice] = useState(seed?.price != null ? String(seed.price) : "");
  const [costMode, setCostMode] = useState<"buildup" | "single">("buildup");
  const [unitCost, setUnitCost] = useState(seed?.cost != null ? String(seed.cost) : "");
  const [freightUnit, setFreightUnit] = useState("");
  const [dutyPct, setDutyPct] = useState("0");
  const [landedSingle, setLandedSingle] = useState("");
  const [category, setCategory] = useState(seed?.category && FC_REFERRAL[seed.category] != null ? seed.category : "Other (15%)");
  const [referralPct, setReferralPct] = useState(String((FC_REFERRAL[seed?.category ?? ""] ?? 0.15) * 100));
  const [dimL, setDimL] = useState(seed?.l ? String(seed.l) : "");
  const [dimW, setDimW] = useState(seed?.w ? String(seed.w) : "");
  const [dimH, setDimH] = useState(seed?.h ? String(seed.h) : "");
  const [weight, setWeight] = useState(seed?.wt ? String(seed.wt) : "");
  const [months, setMonths] = useState("2");
  const [peak, setPeak] = useState(false);
  const [units, setUnits] = useState(seed?.units ? String(seed.units) : "500");
  const [skuLabel, setSkuLabel] = useState(seed?.label ?? "");
  // Catalog dims are cm/kg (Chinese suppliers) — default to metric, convert to in/lb for the fee math.
  const [unit, setUnit] = useState<"metric" | "imperial">("metric");
  const toggleUnit = () => {
    const conv = (v: string, f: number) => (v === "" ? "" : String(Math.round(fcNum(v) * f * 100) / 100));
    if (unit === "metric") { setDimL(conv(dimL, 1 / 2.54)); setDimW(conv(dimW, 1 / 2.54)); setDimH(conv(dimH, 1 / 2.54)); setWeight(conv(weight, 2.20462)); setUnit("imperial"); }
    else { setDimL(conv(dimL, 2.54)); setDimW(conv(dimW, 2.54)); setDimH(conv(dimH, 2.54)); setWeight(conv(weight, 1 / 2.20462)); setUnit("metric"); }
  };
  const dimSuffix = unit === "metric" ? "cm" : "in";
  const wtSuffix = unit === "metric" ? "kg" : "lb";

  // Auto-detect Q4 peak window client-side (avoids SSR hydration mismatch).
  useEffect(() => { const mo = new Date().getMonth(); if (mo >= 9 && mo <= 10) setPeak(true); }, []);

  const pickCategory = (cat: string) => { setCategory(cat); setReferralPct(String((FC_REFERRAL[cat] ?? 0.15) * 100)); };
  const loadVariant = (key: string) => {
    const [famId, sku] = key.split("␟");
    const v = variants.find((x) => x.famId === famId && x.sku === sku);
    if (!v) return;
    setCostMode("buildup");
    setUnitCost(v.cost != null ? String(v.cost) : ""); setFreightUnit(""); setDutyPct("0");
    setSalePrice(v.price != null ? String(v.price) : "");
    setDimL(v.l ? String(v.l) : ""); setDimW(v.w ? String(v.w) : ""); setDimH(v.h ? String(v.h) : "");
    setWeight(v.wt ? String(v.wt) : "");
    pickCategory(FC_REFERRAL[v.category] != null ? v.category : "Other (15%)");
    setSkuLabel(v.label);
  };

  const m = useMemo(() => {
    const price = fcNum(salePrice);
    const landed = costMode === "single" ? fcNum(landedSingle) : fcNum(unitCost) + fcNum(freightUnit) + fcNum(unitCost) * (fcNum(dutyPct) / 100);
    const toIn = (v: string) => (unit === "metric" ? fcNum(v) / 2.54 : fcNum(v));
    const dims = [toIn(dimL), toIn(dimW), toIn(dimH)].map((d) => Math.round(d * 100) / 100);
    const hasDims = dims.every((d) => d > 0);
    const ref = fcNum(referralPct) / 100;
    const wt = Math.round((unit === "metric" ? fcNum(weight) * 2.20462 : fcNum(weight)) * 100) / 100;
    const tier = fcSizeTier(wt, dims);
    const fbaFee = hasDims ? fcFulfillmentFee(wt, dims) : 0;
    const storage = hasDims ? fcStorageMo(dims, fcNum(months, 1), peak) : 0;
    const referralFee = price * ref;
    const net = price - landed - referralFee - fbaFee - storage;
    const marginPct = price > 0 ? Math.round((net / price) * 1000) / 10 : null;
    const roiPct = landed > 0 ? Math.round((net / landed) * 1000) / 10 : null;
    const denom = 1 - ref;
    const breakeven = denom > 0 ? (landed + fbaFee + storage) / denom : null;
    const u = Math.max(0, Math.round(fcNum(units)));
    return { price, landed, dims, wt, hasDims, ref, tier, fbaFee, storage, referralFee, net, marginPct, roiPct, breakeven, u, totalProfit: net * u, totalRevenue: price * u, totalLanded: landed * u };
  }, [salePrice, costMode, landedSingle, unitCost, freightUnit, dutyPct, dimL, dimW, dimH, referralPct, weight, months, peak, units, unit]);

  const verdict = fcVerdict(m.net, m.marginPct, m.roiPct);
  const vt = verdict.tone;
  // `muted` has no readable text shade — use muted-fg wherever the tone colors TEXT.
  const vtc = vt === "muted" ? "muted-fg" : vt;

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
      {/* INPUTS */}
      <Card className="flex flex-col gap-[15px] p-[18px]">
        {variants.length > 0 && (
          <div>
            <div className="vy-kicker mb-1.5 flex items-center gap-1.5"><Package className="h-3 w-3" /> Prefill from catalog</div>
            <Select value="" onChange={loadVariant} placeholder="Pick a variant…" searchable
              options={variants.map((v) => ({ value: `${v.famId}␟${v.sku}`, label: `${v.sku} · ${v.label}` }))} />
          </div>
        )}

        <Field label="Target sale price" hint="what it lists for"><Money value={salePrice} onChange={setSalePrice} placeholder="49.99" autoFocus /></Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="vy-kicker">Landed cost / unit</span>
            <div className="inline-flex rounded-[9px] bg-muted p-[3px]">
              {(["buildup", "single"] as const).map((mode) => (
                <button key={mode} type="button" onClick={() => setCostMode(mode)}
                  className={cn("rounded-md px-2.5 py-1 text-[11.5px] font-medium transition", costMode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                  {mode === "buildup" ? "Build it up" : "Single figure"}
                </button>
              ))}
            </div>
          </div>
          {costMode === "buildup" ? (
            <>
              <div className="flex flex-wrap gap-2.5">
                <Field className="flex-[1_1_110px]" label="Unit cost"><Money value={unitCost} onChange={setUnitCost} placeholder="3.07" /></Field>
                <Field className="flex-[1_1_110px]" label="Freight / unit"><Money value={freightUnit} onChange={setFreightUnit} placeholder="0.85" /></Field>
                <Field className="flex-[1_1_90px]" label="Duty"><Suffixed suffix="%" value={dutyPct} onChange={setDutyPct} step={0.1} placeholder="0" /></Field>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">Lands in your FBA warehouse at <strong className="font-mono text-foreground">{fcMoney(m.landed)}</strong>.</p>
            </>
          ) : (
            <Field label="All-in landed cost"><Money value={landedSingle} onChange={setLandedSingle} placeholder="4.20" /></Field>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Field className="flex-[1_1_200px]" label="Category">
            <Select value={category} onChange={pickCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field className="flex-[0_1_110px]" label="Referral" hint="editable"><Suffixed suffix="%" value={referralPct} onChange={setReferralPct} step={0.5} /></Field>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="vy-kicker">Dimensions &amp; weight <span className="font-normal normal-case text-muted-foreground">— sets the FBA size tier</span></span>
            <div className="inline-flex rounded-[9px] bg-muted p-[3px]">
              {(["metric", "imperial"] as const).map((u) => (
                <button key={u} type="button" onClick={() => { if (unit !== u) toggleUnit(); }}
                  className={cn("rounded-md px-2.5 py-1 text-[11.5px] font-medium transition", unit === u ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                  {u === "metric" ? "cm / kg" : "in / lb"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Field className="flex-[1_1_80px]" label="Length"><Suffixed suffix={dimSuffix} value={dimL} onChange={setDimL} step={0.1} /></Field>
            <Field className="flex-[1_1_80px]" label="Width"><Suffixed suffix={dimSuffix} value={dimW} onChange={setDimW} step={0.1} /></Field>
            <Field className="flex-[1_1_80px]" label="Height"><Suffixed suffix={dimSuffix} value={dimH} onChange={setDimH} step={0.1} /></Field>
            <Field className="flex-[1_1_90px]" label="Weight"><Suffixed suffix={wtSuffix} value={weight} onChange={setWeight} step={0.05} /></Field>
          </div>
          {m.hasDims && unit === "metric" && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">→ Amazon sees <strong className="font-mono text-foreground">{m.dims[0]} × {m.dims[1]} × {m.dims[2]} in</strong> · <strong className="font-mono text-foreground">{m.wt} lb</strong></p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={m.hasDims ? "info" : "muted"}><Boxes className="mr-1 inline h-2.5 w-2.5 align-[-1px]" />{m.hasDims ? m.tier : "Enter dims for size tier"}</Badge>
            {m.hasDims && <span className="text-[11px] text-muted-foreground"><strong className="font-mono text-foreground">{fcMoney(m.fbaFee)}</strong> fulfilment / unit</span>}
          </div>
        </div>

        <div>
          <div className="vy-kicker mb-1.5">Storage</div>
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[12.5px]">
            <span className="text-muted-foreground">Hold</span>
            <input type="number" min={1} max={12} value={months} onChange={(e) => setMonths(e.target.value)} className="h-8 w-[52px] rounded-md border bg-background px-2 text-center text-sm outline-none focus:ring-2 focus:ring-ring" />
            <span className="text-muted-foreground">mo</span>
            <button type="button" onClick={() => setPeak((v) => !v)} title="Q4 (Oct–Dec) storage costs ~3× more"
              className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition", peak ? "border-warning/60 bg-warning/12 text-warning" : "text-muted-foreground")}>
              <span className={cn("h-[7px] w-[7px] rounded-full", peak ? "bg-warning" : "bg-muted-foreground/40")} /> Q4 peak rate
            </button>
            {m.hasDims && <span className="ml-auto text-muted-foreground"><strong className="font-mono text-foreground">{fcMoney(m.storage)}</strong>/unit</span>}
          </div>
        </div>
      </Card>

      {/* RESULTS */}
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border p-[22px]" style={vt === "muted" ? { background: "hsl(var(--muted-bg) / 0.4)", borderColor: "hsl(var(--border))" } : { background: `hsl(var(--${vt}) / 0.07)`, borderColor: `hsl(var(--${vt}) / 0.3)` }}>
          <div className="flex items-center justify-between gap-2.5">
            <span className="vy-kicker">Net profit / unit{skuLabel ? ` · ${skuLabel}` : ""}</span>
            <Badge tone={vt}>{verdict.label}</Badge>
          </div>
          <div className="mt-1 font-mono text-[40px] font-extrabold leading-none" style={{ color: `hsl(var(--${vtc}))` }}>{m.marginPct == null ? "—" : fcMoney(m.net)}</div>
          <div className="mt-3.5 flex flex-wrap gap-[22px]">
            <Metric label="Margin" value={m.marginPct == null ? "—" : `${m.marginPct}%`} />
            <Metric label="ROI" value={m.roiPct == null ? "—" : `${m.roiPct}%`} />
            <Metric label="Breakeven price" value={m.breakeven == null ? "—" : fcMoney(m.breakeven)} />
          </div>
        </div>

        <Card className="px-5 pb-4 pt-3.5">
          <div className="vy-kicker mb-1">Per-unit economics</div>
          <Row label="Sale price" value={m.price} />
          <Row label="Landed cost" value={m.landed} minus />
          <Row label="Referral fee" sub={`${Math.round(m.ref * 1000) / 10}%`} value={m.referralFee} minus />
          <Row label="FBA fulfilment" sub={m.hasDims ? m.tier : undefined} value={m.fbaFee} minus />
          <Row label="Storage" sub={`${months} mo${peak ? " · Q4" : ""}`} value={m.storage} minus />
          <Row label="Net per unit" value={m.net} strong tone={vtc} />
        </Card>

        <Card className="px-5 pb-4 pt-3.5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="vy-kicker">If you order</div>
            <div className="flex items-center gap-2 text-[12.5px]">
              <input type="number" min={0} step={50} value={units} onChange={(e) => setUnits(e.target.value)} className="h-8 w-[90px] rounded-md border bg-background px-2 text-right text-sm outline-none focus:ring-2 focus:ring-ring" />
              <span className="text-muted-foreground">units</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Box k="Cash in goods" v={fcMoney(m.totalLanded)} />
            <Box k="Revenue" v={fcMoney(m.totalRevenue)} />
            <Box k="Projected profit" v={fcMoney(m.totalProfit)} tone={vtc} />
          </div>
        </Card>

        <p className="px-0.5 text-[10.5px] leading-relaxed text-muted-foreground">FBA fees are 2026 non-peak US estimates from weight / size / category — the same model the Product page uses, so a SKU reconciles either way. Sync a Seller Central key for exact per-ASIN fees.</p>
      </div>
    </div>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <div className="vy-kicker mb-1">{label}{hint && <span className="ml-1.5 font-normal normal-case text-muted-foreground">{hint}</span>}</div>
      {children}
    </div>
  );
}
function Money({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
      <span className="pl-2.5 text-[13px] text-muted-foreground">$</span>
      <input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} className="w-full bg-transparent px-2 py-2 text-sm outline-none" />
    </div>
  );
}
function Suffixed({ value, onChange, suffix, step, placeholder }: { value: string; onChange: (v: string) => void; suffix: string; step?: number; placeholder?: string }) {
  return (
    <div className="flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
      <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent px-2 py-2 text-sm outline-none" />
      <span className="pr-2.5 text-[12px] text-muted-foreground">{suffix}</span>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="vy-kicker">{label}</div><div className="tabular font-mono text-[18px] font-extrabold">{value}</div></div>;
}
function Row({ label, value, minus, strong, sub, tone }: { label: string; value: number; minus?: boolean; strong?: boolean; sub?: string; tone?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", strong ? "border-t-[1.5px] pb-0.5 pt-3" : "border-t border-border/50 py-2")}>
      <span className={cn(strong ? "text-[14px] font-bold" : "text-[12.5px] font-medium text-muted-foreground")}>{label}{sub && <span className="ml-1.5 text-[10.5px] font-medium text-muted-foreground">{sub}</span>}</span>
      <span className={cn("tabular whitespace-nowrap font-mono", strong ? "text-[18px] font-extrabold" : "text-[13.5px] font-semibold")} style={strong && tone ? { color: `hsl(var(--${tone}))` } : undefined}>{minus && value > 0 ? "−" : ""}{fcMoney(value)}</span>
    </div>
  );
}
function Box({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="rounded-[10px] border border-border/60 bg-muted/50 px-3 py-2.5">
      <div className="vy-kicker">{k}</div>
      <div className="tabular mt-0.5 font-mono text-[15.5px] font-extrabold" style={tone ? { color: `hsl(var(--${tone}))` } : undefined}>{v}</div>
    </div>
  );
}
