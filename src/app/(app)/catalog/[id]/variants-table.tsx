"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, SourceTag, TableCard } from "@/components/ui/primitives";
import { Drawer, DrawerStat } from "@/components/ui/drawer";
import { variantEco, marginTone, VARIANT_STATUS_TONE, INV_HEALTH_TONE, money, num, type InvHealth } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { Package, ArrowUpRight } from "lucide-react";
import { AddVariantButton, EditVariantButton } from "./variant-actions";

export type VRow = {
  id: string; sku: string; name: string; pack: string; fnsku: string | null; asin: string | null;
  fba_stock: number; last_cost_usd: number | null; sale_price: number | null; status: string; prep: string; reorder_point: number | null;
  invHealth: InvHealth;
};

export function VariantsTable({ familyId, weightLb, variants }: { familyId: string; weightLb: number; variants: VRow[] }) {
  const [peek, setPeek] = useState<VRow | null>(null);
  const eco = peek ? variantEco(peek as never, weightLb) : null;

  return (
    <>
      <TableCard icon={Package} tone="brand" title="Variants" count={variants.length} action={<AddVariantButton familyId={familyId} />}>
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Variant</th>
              <th className="px-4 py-2 font-medium"><span className="inline-flex items-center gap-1">FNSKU <SourceTag source="amazon" /></span></th>
              <th className="px-4 py-2 text-right font-medium"><span className="inline-flex items-center gap-1">FBA <SourceTag source="amazon" /></span></th>
              <th className="px-4 py-2 font-medium">Stock</th>
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
                  <td className="px-4 py-2.5 font-mono text-[12px] font-semibold">{v.sku}</td>
                  <td className="px-4 py-2.5">{v.name}<span className="text-muted-foreground"> · {v.pack}</span></td>
                  <td className="px-4 py-2.5 font-mono text-[12px]">{v.fnsku ? v.fnsku : <Badge tone="warning">Not linked</Badge>}</td>
                  <td className="px-4 py-2.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <Link href={`/inventory?q=${encodeURIComponent(v.sku)}`} title="View in Inventory"
                      className={cn("inline-flex items-center justify-end gap-1 font-mono tabular hover:underline", (v.fba_stock ?? 0) <= 40 ? "text-warning" : "hover:text-primary")}>
                      {num(v.fba_stock)} <ArrowUpRight className="h-3 w-3 opacity-60" />
                    </Link>
                  </td>
                  <td className="px-4 py-2.5"><Badge tone={INV_HEALTH_TONE[v.invHealth]}>{v.invHealth}</Badge></td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{money(v.last_cost_usd)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{e.price > 0 ? money(e.price) : "—"}</td>
                  <td className="px-4 py-2.5"><Badge tone={VARIANT_STATUS_TONE[v.status] ?? "muted"}>{v.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right">
                    {e.marginPct != null ? <Badge tone={marginTone(e.marginPct)}>{e.marginPct}%</Badge> : <span className="text-[11px] text-muted-foreground">No price</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <EditVariantButton variantId={v.id} familyId={familyId} sku={v.sku} cost={v.last_cost_usd} salePrice={v.sale_price} status={v.status} reorderPoint={v.reorder_point} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>

      <Drawer open={!!peek} onClose={() => setPeek(null)} title={peek?.sku}>
        {peek && eco && (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium">{peek.name} · {peek.pack}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge tone={VARIANT_STATUS_TONE[peek.status] ?? "muted"}>{peek.status}</Badge>
                <Badge tone={INV_HEALTH_TONE[peek.invHealth]}>{peek.invHealth}</Badge>
                <Badge tone={peek.prep === "Stickerless" ? "warning" : "muted"}>{peek.prep}</Badge>
                {eco.marginPct != null && <Badge tone={marginTone(eco.marginPct)}>{eco.marginPct}% margin</Badge>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <DrawerStat label="FBA stock" value={num(peek.fba_stock)} />
              <DrawerStat label="Cost" value={money(peek.last_cost_usd)} />
              <DrawerStat label="Price" value={eco.price > 0 ? money(eco.price) : "—"} />
            </div>

            <div className="rounded-lg border p-3">
              <div className="vy-kicker mb-2">Unit economics</div>
              <Econ label="Sale price" value={eco.price} />
              <Econ label="− COGS" value={-eco.cogs} />
              <Econ label="− Referral (15%)" value={-eco.referral} />
              <Econ label="− FBA fee" value={-eco.fba} />
              <div className="mt-1 flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
                <span>Net / unit</span>
                <span className={cn("font-mono", eco.net > 0 ? "text-net" : "text-danger")}>{money(eco.net)}</span>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-[12px]">
              <div className="vy-kicker mb-1">Amazon identity</div>
              <div className="flex justify-between"><span className="text-muted-foreground">FNSKU</span><span className="font-mono">{peek.fnsku ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">ASIN</span><span className="font-mono">{peek.asin ?? "—"}</span></div>
            </div>

            <div className="flex gap-2">
              <EditVariantButton variantId={peek.id} familyId={familyId} sku={peek.sku} cost={peek.last_cost_usd} salePrice={peek.sale_price} status={peek.status} reorderPoint={peek.reorder_point} />
              <Link href={`/inventory?q=${encodeURIComponent(peek.sku)}`} className="vy-btn vy-btn--outline inline-flex items-center gap-1.5">
                View in Inventory <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

function Econ({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{money(value)}</span>
    </div>
  );
}
