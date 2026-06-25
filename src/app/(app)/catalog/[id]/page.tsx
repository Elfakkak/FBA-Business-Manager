import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, Kpi, PageHead, SourceTag, SectionTitle } from "@/components/ui/primitives";
import {
  catFamilyStats, familyEco, variantEco, familyWeightLb, marginTone,
  FAMILY_HEALTH_TONE, VARIANT_STATUS_TONE, money, num, type Variant, type Product,
} from "@/lib/derive";
import { AddVariantButton, EditVariantButton } from "./variant-actions";
import { cn } from "@/lib/utils";
import {
  Package, TrendingUp, Wallet, Warehouse, Boxes, Ruler, FileText, History,
  ShoppingCart, ImageIcon, ArrowUpRight,
} from "lucide-react";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) notFound();
  const { data: variantsData } = await supabase.from("product_variants").select("*").eq("family_id", id).order("sku");
  const variants = (variantsData ?? []) as Variant[];
  const p = product as Product;

  const s = catFamilyStats(variants);
  const weightLb = familyWeightLb(p);
  const eco = familyEco(variants, weightLb);
  const linked = variants.filter((v) => v.asin && v.asin !== "Pending sync").length;
  const dim = (p.dim_cm ?? null) as { l?: number; w?: number; h?: number } | null;
  const carton = (p.carton_cm ?? null) as { l?: number; w?: number; h?: number } | null;

  return (
    <div className="space-y-6">
      <div className="text-[12px] text-muted-foreground">
        <Link href="/catalog" className="hover:text-foreground">Catalog</Link> › Products › {p.parent}
      </div>

      <PageHead
        kicker={p.category}
        title={`${p.parent}${p.color ? ` · ${p.color}` : ""}`}
        actions={
          <>
            <Badge tone={FAMILY_HEALTH_TONE[s.health]}>{s.health}</Badge>
            <Badge tone={linked === variants.length && variants.length > 0 ? "success" : "warning"}>
              {linked === variants.length ? "Linked to Amazon" : `${linked}/${variants.length} linked`}
            </Badge>
            <Link href="/orders" className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><ShoppingCart className="h-4 w-4" /> Reorder</Link>
            <AddVariantButton familyId={id} />
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <span className="vy-chip">{p.category}</span>
        <span className="vy-chip">{p.brand}</span>
        {p.supplier && <span className="vy-chip">{p.supplier}</span>}
        <span className="vy-chip">{variants.length} variants</span>
      </div>

      {/* master economics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Avg net margin" value={eco.avgMargin != null ? `${eco.avgMargin}%` : "—"} sub={`${eco.pricedCount}/${eco.total} priced`} icon={TrendingUp} tone={marginTone(eco.avgMargin)} />
        <Kpi label="Avg FBA fee / unit" value={money(eco.avgFba)} sub="15% referral" icon={Wallet} source="amazon" />
        <Kpi label="Avg COGS" value={eco.avgCogs != null ? money(eco.avgCogs) : "—"} sub="from last orders" icon={Boxes} source="manual" />
        <Kpi label="FBA stock" value={num(s.stock)} sub={`${s.skuCount} SKUs`} icon={Warehouse} source="amazon" tone="success" />
      </div>

      {/* facts */}
      <Card className="p-5">
        <SectionTitle icon={ImageIcon} tone="muted" title="Snapshot" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="FBA stock" value={num(s.stock)} sub="units" source="amazon" />
          <Fact label="Inbound" value={num(s.inbound)} sub="to FBA" source="amazon" />
          <Fact label="Variants" value={num(s.skuCount)} sub="SKUs" />
          <Fact label="Last cost" value={s.costLabel} sub="per unit" source="manual" />
          <Fact label="Lead time" value={p.lead_time_days ? `${p.lead_time_days}d` : "—"} sub="production" source="manual" />
          <Fact label="MOQ" value={p.moq ? `${num(p.moq)}` : "—"} sub="min order" source="manual" />
        </div>
      </Card>

      {/* variants */}
      <Card>
        <SectionTitle icon={Package} tone="brand" title="Variants" count={variants.length}
          action={<span className="text-[11px] text-muted-foreground">click Edit to set cost, price & status</span>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Variant</th>
                <th className="px-4 py-2 font-medium"><span className="inline-flex items-center gap-1">FNSKU <SourceTag source="amazon" /></span></th>
                <th className="px-4 py-2 text-right font-medium">FBA</th>
                <th className="px-4 py-2 text-right font-medium">Cost</th>
                <th className="px-4 py-2 text-right font-medium">Price</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Margin</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {variants.map((v) => {
                const e = variantEco(v, weightLb);
                return (
                  <tr key={v.id} className="hover:bg-accent/40">
                    <td className="px-4 py-2.5 font-mono text-[12px] font-semibold">{v.sku}</td>
                    <td className="px-4 py-2.5">{v.name}<span className="text-muted-foreground"> · {v.pack}</span></td>
                    <td className="px-4 py-2.5 font-mono text-[12px]">{v.fnsku ? v.fnsku : <Badge tone="warning">Not linked</Badge>}</td>
                    <td className={cn("tabular px-4 py-2.5 text-right font-mono", (v.fba_stock ?? 0) <= 40 && "text-warning")}>{num(v.fba_stock)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-mono">{money(v.last_cost_usd)}</td>
                    <td className="tabular px-4 py-2.5 text-right font-mono">{e.price > 0 ? money(e.price) : "—"}</td>
                    <td className="px-4 py-2.5"><Badge tone={VARIANT_STATUS_TONE[v.status] ?? "muted"}>{v.status}</Badge></td>
                    <td className="px-4 py-2.5 text-right">
                      {e.marginPct != null ? <Badge tone={marginTone(e.marginPct)}>{e.marginPct}%</Badge> : <span className="text-[11px] text-muted-foreground">No price</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <EditVariantButton variantId={v.id} familyId={id} sku={v.sku} cost={v.last_cost_usd} salePrice={v.sale_price} status={v.status} reorderPoint={v.reorder_point} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* details */}
      <Card className="p-5">
        <SectionTitle icon={FileText} tone="info" title="Details" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="vy-kicker mb-2">Specs &amp; identity</div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <DField label="Category" source="manual" value={p.category} />
              <DField label="Brand" source="amazon" value={p.brand} />
              <DField label="Material" source="manual" value={p.material ?? "—"} />
              <DField label="MOQ" source="manual" value={p.moq ? `${num(p.moq)} units` : "—"} />
            </dl>
          </div>
          <div>
            <div className="vy-kicker mb-2">Supplier</div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <DField label="Factory" source="manual" value={p.supplier ?? "—"} />
              <DField label="Route" source="manual" value={p.supplier_route ?? "Direct supplier"} />
              <DField label="Lead time" source="manual" value={p.lead_time_days ? `${p.lead_time_days} days` : "—"} />
              <DField label="Last ordered" source="manual" value={p.last_ordered ?? "—"} />
            </dl>
          </div>
        </div>
      </Card>

      {/* dimensions & weight */}
      <Card className="p-5">
        <SectionTitle icon={Ruler} tone="brand" title="Dimensions & weight" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="vy-kicker mb-2">Product — each unit</div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <DField label="Size" value={dim?.l ? `${dim.l}×${dim.w}×${dim.h} cm` : p.dims ?? "—"} />
              <DField label="Weight" value={p.weight_kg ? `${p.weight_kg} kg` : p.weight_lbs ? `${p.weight_lbs} lb` : "—"} />
            </dl>
          </div>
          <div>
            <div className="vy-kicker mb-2">Master carton</div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <DField label="Size" value={carton?.l ? `${carton.l}×${carton.w}×${carton.h} cm` : "—"} />
              <DField label="Pieces / box" value={p.units_per_carton ? num(p.units_per_carton) : "—"} />
            </dl>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">No changes logged yet — dimensions and size/weight history fill in as you log new sizes.</p>
      </Card>

      {/* tech pack */}
      <Card className="p-5">
        <SectionTitle icon={FileText} tone="warning" title="Tech pack" />
        <EmptyBlock>No tech pack uploaded yet. Upload the product spec PDF; re-upload anytime to add a new version.</EmptyBlock>
      </Card>

      {/* cost + order history */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle icon={History} tone="muted" title="Cost history" />
          <EmptyBlock>No cost history yet — it builds as you place orders for this product.</EmptyBlock>
        </Card>
        <Card className="p-5">
          <SectionTitle icon={ShoppingCart} tone="muted" title="Order history" />
          <EmptyBlock>Not ordered yet — orders that include this product will appear here.</EmptyBlock>
        </Card>
      </div>
    </div>
  );
}

function Fact({ label, value, sub, source }: { label: string; value: React.ReactNode; sub?: string; source?: "amazon" | "manual" }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}{source && <SourceTag source={source} />}
      </div>
      <div className="tabular mt-1 font-mono text-sm font-semibold">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function DField({ label, value, source }: { label: string; value: React.ReactNode; source?: "amazon" | "manual" }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}{source && <SourceTag source={source} />}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>
  );
}
