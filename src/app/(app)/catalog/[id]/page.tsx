import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, Kpi, PageHead, SourceTag, SectionTitle } from "@/components/ui/primitives";
import {
  catFamilyStats, familyEco, familyWeightLb, marginTone, invStats,
  FAMILY_HEALTH_TONE, ORDER_STATUS_TONE, ORDER_STATUS_LABEL,
  money, num, type Variant, type Product, type AmazonMeta,
} from "@/lib/derive";
import { VariantsTable } from "./variants-table";
import { EditProductButton } from "./edit-product-button";
import { StorageBar, DimensionsCard, TechPackCard } from "./product-extras";
import { ProductImages } from "./product-images";
import { AmazonDetailsCard } from "./amazon-details";
import { cn } from "@/lib/utils";
import {
  TrendingUp, Wallet, Warehouse, Boxes, FileText, History,
  ShoppingCart, ImageIcon, Truck,
} from "lucide-react";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) notFound();
  const { data: variantsData } = await supabase.from("product_variants").select("*").eq("family_id", id).order("sku");
  const variants = (variantsData ?? []) as Variant[];
  const p = product as Product;

  // inbound shipments touching this family's SKUs → "what's coming to FBA & when"
  const skus = variants.map((v) => v.sku);
  type InbItem = { sku: string; expected: number; received: number; fba_inbounds: { id: string; fc: string; amazon_status: string; eta: string | null } | null };
  // fba_inbound_items isn't in the generated types yet — loose handle for this read
  const sb = supabase as unknown as { from: (t: string) => { select: (s: string) => { in: (c: string, v: string[]) => Promise<{ data: unknown[] | null }> } } };
  const { data: inbItemRows } = skus.length
    ? await sb.from("fba_inbound_items").select("sku, expected, received, fba_inbounds(id, fc, amazon_status, eta)").in("sku", skus)
    : { data: [] };
  const inbItems = ((inbItemRows ?? []) as unknown as InbItem[])
    .filter((i) => i.fba_inbounds && i.fba_inbounds.amazon_status !== "Closed" && i.expected > i.received)
    .map((i) => ({ sku: i.sku, remaining: i.expected - i.received, expected: i.expected, received: i.received, shipmentId: i.fba_inbounds!.id, fc: i.fba_inbounds!.fc, status: i.fba_inbounds!.amazon_status, eta: i.fba_inbounds!.eta }))
    .sort((a, b) => (a.eta ?? "~").localeCompare(b.eta ?? "~"));
  const inboundUnits = inbItems.reduce((s, i) => s + i.remaining, 0);
  // restock signal: variants below their reorder point (same invStats the inventory uses)
  const restock = variants.filter((v) => { const h = invStats(v, p.lead_time_days ?? 0).health; return h === "Reorder" || h === "Low"; });

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
  const { data: techPacks } = await supabase.from("product_tech_packs").select("id, version, file_name, note, doc_date, asset_ref, file_size").eq("family_id", id);
  const dimHistory = Array.isArray(p.dim_history) ? (p.dim_history as never[]) : [];

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

      {restock.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm" style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.3)" }}>
          <span className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-md bg-warning/12 text-warning"><Warehouse className="h-4 w-4" /></span>
          <span>
            <span className="font-medium text-warning">{restock.length} SKU{restock.length > 1 ? "s" : ""} need restocking</span>
            <span className="text-muted-foreground"> — {restock.map((v) => v.sku).slice(0, 4).join(", ")}{restock.length > 4 ? "…" : ""}. {inboundUnits > 0 ? `${num(inboundUnits)} units already inbound.` : "Nothing inbound yet."}</span>
          </span>
          <Link href={`/inventory?q=${encodeURIComponent(p.parent)}`} className="vy-btn vy-btn--outline vy-btn--sm ml-auto">View in Inventory</Link>
        </div>
      )}

      <StorageBar dimCm={dim} />

      {/* images + facts */}
      <Card className="p-5">
        <SectionTitle icon={ImageIcon} tone="muted" title="Images" sub="Drag your own product shots onto a slot — they persist." />
        <div className="flex flex-wrap gap-[18px]">
          <ProductImages id={id} images={Array.isArray(p.images) ? (p.images as string[]) : []} />
          <div className="grid min-w-[240px] flex-[1_1_280px] grid-cols-2 content-start overflow-hidden rounded-[10px] border bg-background/40">
            {[
              { label: "FBA stock", value: num(s.stock), sub: "units", source: "amazon" as const },
              { label: "Inbound", value: num(s.inbound), sub: "to FBA", source: "amazon" as const },
              { label: "Variants", value: num(s.skuCount), sub: "SKUs", source: undefined },
              { label: "Last cost", value: s.costLabel, sub: "per unit", source: "manual" as const },
              { label: "Lead time", value: p.lead_time_days ? `${p.lead_time_days}d` : "—", sub: "production", source: "manual" as const },
              { label: "MOQ", value: p.moq ? `${num(p.moq)}` : "—", sub: "min order", source: "manual" as const },
            ].map((f, i) => (
              <div key={f.label} className={cn("px-3.5 py-3", i % 2 === 1 && "border-l", i >= 2 && "border-t")}>
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="vy-kicker">{f.label}</span>
                  {f.source && <SourceTag source={f.source} />}
                </div>
                <div className="tabular font-mono text-base font-bold">{f.value}</div>
                <div className="text-[10.5px] text-muted-foreground">{f.sub}</div>
              </div>
            ))}
          </div>
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
          // same invStats the Inventory page uses → product & inventory always agree
          invHealth: invStats(v, p.lead_time_days ?? 0).health,
        }))}
      />

      {/* Amazon details (size/weight/tier/fee) — per SKU, choose the source SKU */}
      <AmazonDetailsCard
        familyId={id}
        primarySku={(p as Product & { primary_sku?: string | null }).primary_sku ?? null}
        variants={variants.map((v) => ({
          sku: v.sku, asin: v.asin, fnsku: v.fnsku, status: v.status, fbaStock: v.fba_stock ?? 0, salePrice: v.sale_price,
          meta: ((v as Variant & { amazon_meta?: AmazonMeta | null }).amazon_meta) ?? null,
        }))}
      />

      {/* Inbound to FBA — what's coming for this product & when */}
      <Card className="p-5">
        <SectionTitle icon={Truck} tone="info" title="Inbound to FBA"
          sub="Units on the way to Amazon for this product's SKUs — from your FBA shipments." />
        {inbItems.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
            No active inbound shipments for this product. New shipments appear here once synced on <Link href="/fba-shipments" className="font-medium text-primary hover:underline">FBA Shipments</Link>.
          </div>
        ) : (
          <>
            <div className="mb-3 text-sm"><span className="font-mono text-lg font-bold text-info">{num(inboundUnits)}</span> <span className="text-muted-foreground">units inbound across {new Set(inbItems.map((i) => i.shipmentId)).size} shipment(s)</span></div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Shipment</th><th className="px-3 py-2 font-medium">SKU</th><th className="px-3 py-2 font-medium">FC</th>
                  <th className="px-3 py-2 text-right font-medium">Coming</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">ETA</th>
                </tr></thead>
                <tbody className="divide-y">
                  {inbItems.map((i, n) => (
                    <tr key={`${i.shipmentId}-${i.sku}-${n}`} className="hover:bg-accent/40">
                      <td className="px-3 py-2"><Link href="/fba-shipments" className="font-mono text-[12px] hover:text-primary">{i.shipmentId}</Link></td>
                      <td className="px-3 py-2 font-mono text-[12px]">{i.sku}</td>
                      <td className="px-3 py-2"><Badge tone="muted">{i.fc}</Badge></td>
                      <td className="tabular px-3 py-2 text-right font-mono font-semibold text-info">{num(i.remaining)}</td>
                      <td className="px-3 py-2"><Badge tone={i.status === "Receiving" ? "warning" : "info"}>{i.status}</Badge></td>
                      <td className="px-3 py-2 text-[12px] text-muted-foreground">{i.eta ?? "set on shipment"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
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
      <DimensionsCard
        id={id}
        dimCm={dim}
        weightKg={p.weight_kg}
        cartonCm={carton}
        unitsPerCarton={p.units_per_carton}
        history={dimHistory}
      />

      {/* tech pack */}
      <TechPackCard familyId={id} packs={techPacks ?? []} />

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
