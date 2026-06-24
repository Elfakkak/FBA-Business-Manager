import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, Kpi, PageHead, SourceTag } from "@/components/ui/primitives";
import { catFamilyStats, FAMILY_HEALTH_TONE, VARIANT_STATUS_TONE, money, num, type Variant } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { AddVariantButton, EditVariantButton } from "./variant-actions";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) notFound();
  const { data: variantsData } = await supabase.from("product_variants").select("*").eq("family_id", id).order("sku");
  const variants = (variantsData ?? []) as Variant[];
  const s = catFamilyStats(variants);
  const linked = variants.filter((v) => v.asin && v.asin !== "Pending sync").length;

  return (
    <div className="space-y-6">
      <div className="text-[12px] text-muted-foreground">
        <Link href="/catalog" className="hover:text-foreground">Catalog</Link> › Products › {product.parent}
      </div>

      <PageHead
        kicker={product.category}
        title={`${product.parent}${product.color ? ` · ${product.color}` : ""}`}
        actions={
          <>
            <Badge tone={FAMILY_HEALTH_TONE[s.health]}>{s.health}</Badge>
            <Badge tone={linked === variants.length && variants.length > 0 ? "success" : "warning"}>
              {linked === variants.length ? "Linked to Amazon" : `${linked}/${variants.length} linked`}
            </Badge>
            <AddVariantButton familyId={id} />
          </>
        }
      />

      <div className="flex flex-wrap gap-2 text-[12px] text-muted-foreground">
        <span className="rounded-md border bg-card px-2 py-1">{product.category}</span>
        <span className="rounded-md border bg-card px-2 py-1">{product.brand}</span>
        {product.supplier && <span className="rounded-md border bg-card px-2 py-1">{product.supplier}</span>}
        <span className="rounded-md border bg-card px-2 py-1">{variants.length} variants</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="FBA stock" value={num(s.stock)} sub={`${s.skuCount} SKUs`} source="amazon" tone="success" />
        <Kpi label="Inbound" value={num(s.inbound)} sub="units to FBA" source="amazon" tone="info" />
        <Kpi label="Variants" value={num(s.skuCount)} sub="active SKUs" />
        <Kpi label="Unit cost" value={s.costLabel} sub="last cost" source="manual" />
      </div>

      <Card>
        <div className="border-b px-4 py-3 text-sm font-medium">Variants</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Variant</th>
                <th className="px-4 py-2 font-medium">Pack</th>
                <th className="px-4 py-2 font-medium"><span className="inline-flex items-center gap-1">FNSKU <SourceTag source="amazon" /></span></th>
                <th className="px-4 py-2 text-right font-medium">FBA</th>
                <th className="px-4 py-2 text-right font-medium">Cost</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {variants.map((v) => (
                <tr key={v.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-mono text-[12px] font-semibold">{v.sku}</td>
                  <td className="px-4 py-2.5">{v.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{v.pack}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px]">
                    {v.fnsku ? v.fnsku : <Badge tone="warning">Not linked</Badge>}
                  </td>
                  <td className={cn("tabular px-4 py-2.5 text-right font-mono", (v.fba_stock ?? 0) <= 40 && "text-warning")}>{num(v.fba_stock)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{money(v.last_cost_usd)}</td>
                  <td className="px-4 py-2.5"><Badge tone={VARIANT_STATUS_TONE[v.status] ?? "muted"}>{v.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right">
                    <EditVariantButton
                      variantId={v.id}
                      familyId={id}
                      sku={v.sku}
                      cost={v.last_cost_usd}
                      status={v.status}
                      reorderPoint={v.reorder_point}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
