import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHead, Badge } from "@/components/ui/primitives";
import { type Product, type Variant } from "@/lib/derive";
import { ChevronRight, Calculator } from "lucide-react";
import { FbaCalculator, type CalcVariant, type CalcSeed } from "./fba-calculator";

export default async function FbaCalculatorPage({ searchParams }: { searchParams: Promise<{ fam?: string; sku?: string }> }) {
  const { fam, sku } = await searchParams;
  const supabase = await createClient();
  const [{ data: products }, { data: variantsData }] = await Promise.all([
    supabase.from("products").select("id, parent, category, weight_kg, weight_lbs, dim_cm").order("parent"),
    supabase.from("product_variants").select("family_id, sku, name, pack, last_cost_usd, sale_price").order("sku"),
  ]);
  const prodById = new Map((products ?? []).map((p) => [p.id, p as Partial<Product> & { id: string }]));
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const variants: CalcVariant[] = ((variantsData ?? []) as unknown as Variant[]).map((v) => {
    const p = prodById.get(v.family_id);
    const dim = (p?.dim_cm ?? null) as { l?: number; w?: number; h?: number } | null;
    // Native catalog units are cm/kg; the calculator defaults to metric.
    const wtKg = p?.weight_kg != null ? p.weight_kg : (p?.weight_lbs ? round2(p.weight_lbs / 2.20462) : 0);
    return {
      famId: v.family_id, famName: p?.parent ?? "", sku: v.sku,
      label: [v.name, v.pack].filter(Boolean).join(" · ") || v.pack || v.sku,
      cost: v.last_cost_usd, price: v.sale_price,
      l: dim?.l ?? 0, w: dim?.w ?? 0, h: dim?.h ?? 0,
      wt: wtKg, category: p?.category ?? "Other (15%)",
    };
  });

  const seedV = fam && sku ? variants.find((v) => v.famId === fam && v.sku === sku) : undefined;
  const seed: CalcSeed | undefined = seedV
    ? { sku: seedV.sku, label: seedV.label, cost: seedV.cost, price: seedV.price, l: seedV.l, w: seedV.w, h: seedV.h, wt: seedV.wt, category: seedV.category }
    : undefined;

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link href="/catalog" className="hover:text-foreground">Catalog</Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <span className="font-medium text-foreground">FBA calculator</span>
      </nav>

      <PageHead
        kicker="Catalog"
        title="FBA calculator"
        sub="Sanity-check a product before you buy it. Target price + landed cost + dims → the Amazon fee stack, net margin, ROI and breakeven. Prefill from a catalog SKU or run the numbers on something new."
        actions={<Badge tone="info"><Calculator className="mr-1 inline h-2.5 w-2.5 align-[-1px]" /> 2026 fee model</Badge>}
      />

      <FbaCalculator variants={variants} seed={seed} />
    </div>
  );
}
