import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, Kpi, PageHead, SourceTag, SectionTitle } from "@/components/ui/primitives";
import {
  catFamilyStats, familyEco, familyWeightLb, marginTone,
  FAMILY_HEALTH_TONE, ORDER_STATUS_TONE, ORDER_STATUS_LABEL,
  money, num, type Variant, type Product,
} from "@/lib/derive";
import { VariantsTable } from "./variants-table";
import { EditProductButton } from "./edit-product-button";
import { cn } from "@/lib/utils";
import {
  TrendingUp, Wallet, Warehouse, Boxes, Ruler, FileText, History,
  ShoppingCart, ImageIcon,
} from "lucide-react";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) notFound();
  const { data: variantsData } = await supabase.from("product_variants").select("*").eq("family_id", id).order("sku");
  const variants = (variantsData ?? []) as Variant[];
  const p = product as Product;

  // order-line history for this family → cost history + order history
  const { data: lineRows } = await supabase
    .from("order_lines")
    .select("id, order_id, qty, unit_cost, orders(title, status, placed_on)")
    .eq("family_id", id);
  type LineJoin = { order_id: string; qty: number; unit_cost: number | null; orders: { title: string; status: string; placed_on: string | null } | null };
  const lines = (lineRows ?? []) as unknown as LineJoin[];
  const costHistory = lines
    .filter((l) => l.unit_cost != null)
    .map((l) => ({ date: l.orders?.placed_on ?? null, cost: l.unit_cost as number, order: l.order_id }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const orderMap = new Map<string, { id: string; title: string; status: string; placedOn: string | null; qty: number }>();
  for (const l of lines) {
    const cur = orderMap.get(l.order_id) ?? { id: l.order_id, title: l.orders?.title ?? l.order_id, status: l.orders?.status ?? "draft", placedOn: l.orders?.placed_on ?? null, qty: 0 };
    cur.qty += l.qty ?? 0;
    orderMap.set(l.order_id, cur);
  }
  const orderHistory = [...orderMap.values()].sort((a, b) => (b.placedOn ?? "").localeCompare(a.placedOn ?? ""));

  const s = catFamilyStats(variants);
  const weightLb = familyWeightLb(p);
  const eco = familyEco(variants, weightLb);
  const linked = variants.filter((v) => v.asin && v.asin !== "Pending sync").length;
  const dim = (p.dim_cm ?? null) as { l?: number; w?: number; h?: number } | null;
  const carton = (p.carton_cm ?? null) as { l?: number; w?: number; h?: number } | null;
  const { data: supplierList } = await supabase.from("suppliers").select("name").order("name");
  const supplierNames = (supplierList ?? []).map((s) => s.name);

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
            <EditProductButton
              product={{
                id: p.id, material: p.material, supplier: p.supplier, supplier_route: p.supplier_route,
                lead_time_days: p.lead_time_days, moq: p.moq, last_ordered: p.last_ordered,
                weight_kg: p.weight_kg, units_per_carton: p.units_per_carton, dim_cm: dim, carton_cm: carton,
              }}
              suppliers={supplierNames}
            />
            <Link href="/orders" className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><ShoppingCart className="h-4 w-4" /> Reorder</Link>
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

      {/* variants — click a row for the detail drawer */}
      <VariantsTable
        familyId={id}
        weightLb={weightLb}
        variants={variants.map((v) => ({
          id: v.id, sku: v.sku, name: v.name, pack: v.pack, fnsku: v.fnsku, asin: v.asin,
          fba_stock: v.fba_stock ?? 0, last_cost_usd: v.last_cost_usd, sale_price: v.sale_price,
          status: v.status, prep: v.prep, reorder_point: v.reorder_point,
        }))}
      />

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
          <SectionTitle icon={History} tone="muted" title="Cost history" count={costHistory.length || undefined} />
          {costHistory.length === 0 ? (
            <EmptyBlock>No cost history yet — it builds as you place orders for this product.</EmptyBlock>
          ) : (
            <ul className="divide-y">
              {costHistory.map((c, i) => (
                <li key={i} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-24 text-[12px] text-muted-foreground">{c.date ?? "—"}</span>
                  <span className="font-mono text-[12px] text-muted-foreground">{c.order}</span>
                  <span className={cn("tabular ml-auto font-mono font-semibold", i === costHistory.length - 1 && "text-primary")}>{money(c.cost)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle icon={ShoppingCart} tone="muted" title="Order history" count={orderHistory.length || undefined} />
          {orderHistory.length === 0 ? (
            <EmptyBlock>Not ordered yet — orders that include this product will appear here.</EmptyBlock>
          ) : (
            <ul className="divide-y">
              {orderHistory.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2">
                  <Link href={`/orders/${o.id}`} className="font-mono text-[12px] font-semibold hover:text-primary">{o.id}</Link>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{o.title}</span>
                  <span className="tabular font-mono text-[12px]">{num(o.qty)} u</span>
                  <Badge tone={ORDER_STATUS_TONE[o.status] ?? "muted"}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                </li>
              ))}
            </ul>
          )}
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
