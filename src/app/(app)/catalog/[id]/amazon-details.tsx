"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, SectionTitle, SourceTag } from "@/components/ui/primitives";
import { amazonSizeTier, money, num, cmFromIn, kgFromLb, type AmazonMeta } from "@/lib/derive";
import { setPrimarySku } from "../actions";
import { cn } from "@/lib/utils";
import { ShoppingBag, Star, Ruler, Scale, Wallet, Package } from "lucide-react";

export type AmazonVariant = {
  sku: string; asin: string | null; fnsku: string | null; status: string; fbaStock: number; salePrice: number | null; meta: AmazonMeta | null;
};

const dimsLabel = (d?: { l: number | null; w: number | null; h: number | null } | null, conv: (n: number) => number = (n) => n, unit = "in") => {
  if (!d || (!d.l && !d.w && !d.h)) return "—";
  const f = (n: number | null) => (n == null ? "?" : Math.round(conv(n) * 10) / 10);
  return `${f(d.l)} × ${f(d.w)} × ${f(d.h)} ${unit}`;
};

export function AmazonDetailsCard({ familyId, primarySku, variants }: { familyId: string; primarySku: string | null; variants: AmazonVariant[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // default to the highest-stock SKU when none is pinned
  const primary = variants.find((v) => v.sku === primarySku) ?? [...variants].sort((a, b) => b.fbaStock - a.fbaStock)[0];
  const setPrimary = (sku: string) => start(async () => { await setPrimarySku(familyId, sku); router.refresh(); });

  const m = primary?.meta ?? null;
  const dims = m?.dims_in ?? null;
  const tier = amazonSizeTier(dims?.l, dims?.w, dims?.h, m?.weight_lb);
  const referral = primary?.salePrice != null ? primary.salePrice * 0.15 : null;
  const netAfterAmazon = primary?.salePrice != null && m?.fbaFee != null && referral != null ? primary.salePrice - m.fbaFee - referral : null;

  if (!variants.length) return null;

  return (
    <Card className="p-5">
      <SectionTitle icon={ShoppingBag} tone="warning" title="Amazon details"
        sub="Size, weight, tier & FBA fee — pulled per SKU from Amazon. Pick the SKU that represents this product." />

      {/* this product's SKUs — choose which one the details are pulled from */}
      <div className="mb-4 flex flex-wrap gap-2">
        {variants.map((v) => (
          <button key={v.sku} onClick={() => setPrimary(v.sku)} disabled={pending}
            className={cn("rounded-lg border px-3 py-2 text-left transition", v.sku === primary?.sku ? "border-primary bg-primary/12" : "hover:bg-accent")}>
            <div className="flex items-center gap-1.5">
              {v.sku === primary?.sku ? <Star className="h-3.5 w-3.5 fill-warning text-warning" /> : <Package className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="font-mono text-[12px] font-semibold">{v.sku}</span>
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{v.status} · {num(v.fbaStock)} on hand</div>
          </button>
        ))}
      </div>

      {primary && (
        <>
          <div className="mb-3 text-[12px] text-muted-foreground">Showing Amazon data for <span className="font-mono font-semibold text-foreground">{primary.sku}</span>{primary.asin ? <> · ASIN <span className="font-mono">{primary.asin}</span></> : ""}</div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Detail icon={Package} label="Size tier"><Badge tone={tier.tone}>{tier.tier}</Badge></Detail>
            <Detail icon={Ruler} label="Dimensions">
              <div className="font-mono text-sm font-bold">{dimsLabel(dims, cmFromIn, "cm")}</div>
              <div className="text-[10px] text-muted-foreground">{dimsLabel(dims, (n) => n, "in")}</div>
            </Detail>
            <Detail icon={Scale} label="Weight">
              <div className="font-mono text-sm font-bold">{m?.weight_lb != null ? `${(Math.round(kgFromLb(m.weight_lb) * 100) / 100)} kg` : "—"}</div>
              <div className="text-[10px] text-muted-foreground">{m?.weight_lb != null ? `${m.weight_lb} lb` : ""}</div>
            </Detail>
            <Detail icon={Wallet} label="FBA fee" source="amazon">
              <div className="font-mono text-sm font-bold">{m?.fbaFee != null ? money(m.fbaFee) : "—"}</div>
              <div className="text-[10px] text-muted-foreground">fulfillment</div>
            </Detail>
            <Detail icon={Wallet} label="Referral (15%)">
              <div className="font-mono text-sm font-bold">{referral != null ? money(referral) : "—"}</div>
              <div className="text-[10px] text-muted-foreground">{primary.salePrice != null ? `on ${money(primary.salePrice)}` : "set price"}</div>
            </Detail>
            <Detail icon={Wallet} label="Net after Amazon">
              <div className={cn("font-mono text-sm font-bold", netAfterAmazon != null && netAfterAmazon < 0 && "text-danger")}>{netAfterAmazon != null ? money(netAfterAmazon) : "—"}</div>
              <div className="text-[10px] text-muted-foreground">price − FBA − referral</div>
            </Detail>
          </div>
          {(!m || (!dims && m?.weight_lb == null && m?.fbaFee == null)) && (
            <p className="mt-3 text-[12px] text-muted-foreground">No Amazon size/fee data for this SKU yet — run the Amazon import to populate it.</p>
          )}
        </>
      )}
    </Card>
  );
}

function Detail({ icon: Icon, label, source, children }: { icon: React.ElementType; label: string; source?: "amazon" | "manual"; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}{source && <SourceTag source={source} />}
      </div>
      {children}
    </div>
  );
}
