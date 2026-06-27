"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, SourceTag, TableCard, CostHistoryList } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/drawer";
import { variantEco, marginTone, VARIANT_STATUS_TONE, INV_HEALTH_TONE, money, num, type InvHealth } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { Package, ArrowUpRight, Check, Layers, History, ShoppingCart, ArrowRight } from "lucide-react";
import { AddVariantButton, EditVariantButton } from "./variant-actions";

export type VRow = {
  id: string; sku: string; name: string; pack: string; fnsku: string | null; asin: string | null;
  fba_stock: number; last_cost_usd: number | null; sale_price: number | null; status: string; prep: string; reorder_point: number | null;
  invHealth: InvHealth; fbaFee: number | null; inbound: number;
};
type CostH = { sku: string | null; date: string | null; cost: number; qty: number | null; invoiceId: string | null; orderId: string | null; vendor: string | null };
type LandedH = { sku: string | null; date: string | null; cost: number; orderId: string | null; orderTitle: string | null };
type SkuOrder = { id: string; title: string; placedOn: string | null; qty: number };

export function VariantsTable({ familyId, familyName, familyImage, weightLb, variants, products, costHistory, landedHistory, skuOrders }: {
  familyId: string; familyName: string; familyImage: string | null; weightLb: number; variants: VRow[]; products: { id: string; parent: string }[];
  costHistory: CostH[]; landedHistory: LandedH[]; skuOrders: Record<string, SkuOrder[]>;
}) {
  const [peek, setPeek] = useState<VRow | null>(null);
  const eco = peek ? variantEco(peek as never, weightLb) : null;
  const linked = !!peek?.asin && peek.asin !== "Pending sync";
  const skuCost = peek ? costHistory.filter((h) => h.sku === peek.sku) : [];
  const skuLanded = peek ? landedHistory.filter((h) => h.sku === peek.sku) : [];
  const skuOrderList = peek ? (skuOrders[peek.sku] ?? []) : [];

  const Thumb = ({ big }: { big?: boolean }) => {
    const sz = big ? "h-12 w-12" : "h-8 w-8";
    return familyImage
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={familyImage} alt="" className={cn(sz, "shrink-0 rounded-md border object-cover")} />
      : <span className={cn(sz, "grid shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground")}><Package className="h-4 w-4" /></span>;
  };

  return (
    <>
      <TableCard icon={Package} tone="brand" title="Variants" count={variants.length} action={<AddVariantButton familyId={familyId} familyName={familyName} />}>
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Variant</th>
              <th className="px-4 py-2 font-medium"><span className="inline-flex items-center gap-1">FNSKU <SourceTag source="amazon" /></span></th>
              <th className="px-4 py-2 text-right font-medium"><span className="inline-flex items-center gap-1">FBA <SourceTag source="amazon" /></span></th>
              <th className="px-4 py-2 text-right font-medium"><span className="inline-flex items-center gap-1">Inbound <SourceTag source="amazon" /></span></th>
              <th className="px-4 py-2 font-medium">Stock</th>
              <th className="px-4 py-2 text-right font-medium"><span className="inline-flex items-center gap-1">FBA fee <SourceTag source="amazon" /></span></th>
              <th className="px-4 py-2 text-right font-medium">Cost</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Margin</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {variants.map((v) => {
              const e = variantEco(v as never, weightLb);
              return (
                <tr key={v.id} className="cursor-pointer hover:bg-accent/40" onClick={() => setPeek(v)}>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Thumb />
                      <div>
                        <div className="font-mono text-[12px] font-semibold">{v.sku}</div>
                        {v.asin && <div className="font-mono text-[10px] text-muted-foreground">ASIN {v.asin}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><div className="max-w-[260px] truncate" title={`${v.name} · ${v.pack}`}>{v.name}<span className="text-muted-foreground"> · {v.pack}</span></div></td>
                  <td className="px-4 py-2.5 font-mono text-[12px]">{v.fnsku ? v.fnsku : <Badge tone="warning">Not linked</Badge>}</td>
                  <td className="px-4 py-2.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <Link href={`/inventory?q=${encodeURIComponent(v.sku)}`} title="View in Inventory"
                      className={cn("inline-flex items-center justify-end gap-1 font-mono tabular hover:underline", (v.fba_stock ?? 0) <= 40 ? "text-warning" : "hover:text-primary")}>
                      {num(v.fba_stock)} <ArrowUpRight className="h-3 w-3 opacity-60" />
                    </Link>
                  </td>
                  <td className={cn("tabular px-4 py-2.5 text-right font-mono", v.inbound > 0 ? "text-info" : "text-muted-foreground")}>{v.inbound > 0 ? num(v.inbound) : "—"}</td>
                  <td className="px-4 py-2.5"><Badge tone={INV_HEALTH_TONE[v.invHealth]}>{v.invHealth}</Badge></td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{v.fbaFee != null ? money(v.fbaFee) : "—"}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{money(v.last_cost_usd)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{e.price > 0 ? money(e.price) : "—"}</td>
                  <td className="px-4 py-2.5"><Badge tone={VARIANT_STATUS_TONE[v.status] ?? "muted"}>{v.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right">
                    {e.marginPct != null ? <Badge tone={marginTone(e.marginPct)}>{e.marginPct}%</Badge> : <span className="text-[11px] text-muted-foreground">No price</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <EditVariantButton variantId={v.id} familyId={familyId} sku={v.sku} cost={v.last_cost_usd} salePrice={v.sale_price} status={v.status} reorderPoint={v.reorder_point} products={products} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>

      <Drawer open={!!peek} onClose={() => setPeek(null)} width={520} title={peek?.sku} dismissable={false}>
        {peek && eco && (
          <div className="space-y-4">
            {/* header — image, name/pack, parent, linked status */}
            <div className="flex items-start gap-3">
              <Thumb big />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{peek.name} · {peek.pack}</div>
                <Link href={`/catalog/${familyId}`} className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"><Layers className="h-3 w-3" /> {familyName}</Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone={linked ? "success" : "warning"}>{linked ? <><Check className="h-3 w-3" /> Linked to Amazon</> : "Not linked"}</Badge>
                  <Badge tone={VARIANT_STATUS_TONE[peek.status] ?? "muted"}>{peek.status}</Badge>
                  <Badge tone={INV_HEALTH_TONE[peek.invHealth]}>{peek.invHealth}</Badge>
                  <Badge tone={peek.prep === "Stickerless" ? "warning" : "muted"}>{peek.prep}</Badge>
                </div>
              </div>
            </div>

            {/* net margin hero */}
            <div className={cn("rounded-xl border px-4 py-3.5", eco.net > 0 ? "bg-success/8 border-success/30" : "bg-danger/8 border-danger/30")}>
              <div className="flex items-center justify-between">
                <span className="vy-kicker">Net margin / unit</span>
                {eco.marginPct != null && <Badge tone={marginTone(eco.marginPct)}>{eco.marginPct}%</Badge>}
              </div>
              <div className={cn("mt-1 font-mono text-2xl font-bold", eco.net > 0 ? "text-success" : "text-danger")}>{money(eco.net)}</div>
            </div>

            {/* identity */}
            <div className="rounded-lg border p-3 text-[12px]">
              <div className="vy-kicker mb-2">Identity</div>
              <div className="grid grid-cols-3 gap-2">
                <div><div className="text-[10px] uppercase text-muted-foreground">FNSKU</div><div className="font-mono">{peek.fnsku ?? "—"}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">ASIN</div><div className="font-mono">{peek.asin ?? "—"}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Status</div><div className="font-semibold">{peek.status}</div></div>
              </div>
              {linked && <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">Linked to <span className="font-mono font-medium text-foreground">{peek.asin}</span> — FBA stock &amp; fees sync from this Amazon record.</p>}
            </div>

            {/* unit economics */}
            <div className="rounded-lg border p-3">
              <div className="vy-kicker mb-2">Unit economics</div>
              <Econ label="Sale price" value={eco.price} />
              <Econ label="− COGS (your cost)" value={-eco.cogs} />
              <Econ label="− Referral (15%)" value={-eco.referral} />
              <Econ label="− FBA fee" value={-eco.fba} />
              <div className="mt-1 flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
                <span>Net per unit</span>
                <span className={cn("font-mono", eco.net > 0 ? "text-net" : "text-danger")}>{money(eco.net)}</span>
              </div>
            </div>

            {/* per-SKU histories */}
            <Section icon={History} title="Product cost history" sub="Actual price paid — from invoices">
              {skuCost.length ? <CostHistoryList highlight="primary" items={skuCost.map((h) => ({ date: h.date, href: h.invoiceId ? `/invoices/${h.invoiceId}` : null, code: h.invoiceId ?? "manual", subtitle: h.vendor, href2: h.orderId ? `/orders/${h.orderId}` : null, code2: h.orderId, amount: h.cost }))} />
                : <Empty>No cost history yet for this SKU.</Empty>}
            </Section>
            <Section icon={Layers} title="Landed cost history" sub="All-in cost, locked at closeout">
              {skuLanded.length ? <CostHistoryList highlight="info" items={skuLanded.map((h) => ({ date: h.date, href: h.orderId ? `/orders/${h.orderId}` : null, code: h.orderId, subtitle: h.orderTitle, amount: h.cost }))} />
                : <Empty>No landed cost locked yet for this SKU.</Empty>}
            </Section>
            <Section icon={ShoppingCart} title="Order history" sub="Orders that bought this SKU">
              {skuOrderList.length ? (
                <ul className="divide-y">
                  {skuOrderList.map((o) => (
                    <li key={o.id} className="flex items-center gap-2.5 py-2 text-sm">
                      <span className="w-[88px] shrink-0 text-[12px] text-muted-foreground">{o.placedOn ?? "—"}</span>
                      <Link href={`/orders/${o.id}`} className="font-mono text-[12px] font-medium hover:text-primary" title={o.title}>{o.id}</Link>
                      <span className="tabular ml-auto shrink-0 font-mono text-[12px]">{num(o.qty)} u</span>
                    </li>
                  ))}
                </ul>
              ) : <Empty>Not ordered yet.</Empty>}
            </Section>

            <div className="flex flex-wrap gap-2">
              <EditVariantButton variantId={peek.id} familyId={familyId} sku={peek.sku} cost={peek.last_cost_usd} salePrice={peek.sale_price} status={peek.status} reorderPoint={peek.reorder_point} products={products} />
              <Link href={`/inventory?q=${encodeURIComponent(peek.sku)}`} className="vy-btn vy-btn--outline inline-flex items-center gap-1.5">View in Inventory <ArrowUpRight className="h-4 w-4" /></Link>
              <Link href={`/catalog/${familyId}`} className="vy-btn vy-btn--ghost inline-flex items-center gap-1.5">Open product <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

function Section({ icon: Icon, title, sub, children }: { icon: React.ElementType; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1.5 flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" /><div><div className="text-[13px] font-semibold">{title}</div><div className="text-[10.5px] text-muted-foreground">{sub}</div></div></div>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed px-3 py-3 text-center text-[11px] text-muted-foreground">{children}</p>;
}
function Econ({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{money(value)}</span>
    </div>
  );
}
