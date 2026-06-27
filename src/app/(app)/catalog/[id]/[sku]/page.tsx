import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, SourceTag } from "@/components/ui/primitives";
import {
  variantEco, invStats, familyWeightLb, marginTone, INV_HEALTH_TONE,
  money, num, type Variant, type Product,
} from "@/lib/derive";
import { cn } from "@/lib/utils";
import { ChevronRight, Package, Boxes, Calculator, Check, AlertCircle, Factory } from "lucide-react";

// Standalone full-page SKU view (the "Full page" target of the variant drawer) —
// the complete story for one SKU: economics, live FBA position, and every
// production run it appeared in. Matches the V5 variant-app.jsx handoff.
export default async function VariantPage({ params }: { params: Promise<{ id: string; sku: string }> }) {
  const { id, sku: rawSku } = await params;
  const sku = decodeURIComponent(rawSku);
  const supabase = await createClient();
  const [
    { data: product }, { data: variantData }, { data: lineRows }, { data: vchRows }, { data: lvchRows },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_variants").select("*").eq("family_id", id).eq("sku", sku).maybeSingle(),
    supabase.from("order_lines").select("order_id, qty, unit_cost, orders(title, placed_on)").eq("family_id", id).eq("sku", sku),
    supabase.from("variant_cost_history").select("unit_cost, recorded_at, order_id").eq("family_id", id).eq("sku", sku).eq("kind", "product").order("recorded_at", { ascending: true }),
    supabase.from("variant_cost_history").select("unit_cost, recorded_at, order_id").eq("family_id", id).eq("sku", sku).eq("kind", "landed").order("recorded_at", { ascending: true }),
  ]);
  if (!product || !variantData) notFound();
  const p = product as Product;
  const v = variantData as Variant;
  const weightLb = familyWeightLb(p);
  const eco = variantEco(v, weightLb);
  const inv = invStats(v, p.lead_time_days ?? 0);
  const linked = !!v.asin && v.asin !== "Pending sync";
  const mtone = marginTone(eco.marginPct);

  // Per-order maps for billed/u (from invoices) and landed/u (from closeout).
  const billedByOrder = new Map<string, number>();
  for (const h of (vchRows ?? []) as { unit_cost: number; order_id: string | null }[]) if (h.order_id) billedByOrder.set(h.order_id, h.unit_cost);
  const landedByOrder = new Map<string, number>();
  for (const h of (lvchRows ?? []) as { unit_cost: number; order_id: string | null }[]) if (h.order_id) landedByOrder.set(h.order_id, h.unit_cost);
  const landedAll = ((lvchRows ?? []) as { unit_cost: number }[]).map((h) => h.unit_cost);
  const avgLanded = landedAll.length ? landedAll.reduce((s, n) => s + n, 0) / landedAll.length : (v.last_cost_usd ?? null);

  // Production runs that included this SKU (one row per order).
  type Line = { order_id: string; qty: number; unit_cost: number | null; orders: { title: string; placed_on: string | null } | null };
  const byOrder = new Map<string, { orderId: string; title: string; date: string | null; units: number; billed: number | null }>();
  for (const l of (lineRows ?? []) as unknown as Line[]) {
    const cur = byOrder.get(l.order_id) ?? { orderId: l.order_id, title: l.orders?.title ?? l.order_id, date: l.orders?.placed_on ?? null, units: 0, billed: billedByOrder.get(l.order_id) ?? l.unit_cost ?? null };
    cur.units += l.qty ?? 0;
    byOrder.set(l.order_id, cur);
  }
  const runs = [...byOrder.values()].map((r) => ({ ...r, landed: landedByOrder.get(r.orderId) ?? null }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const totalUnits = runs.reduce((s, r) => s + r.units, 0);
  const totalSpend = runs.reduce((s, r) => s + r.units * (r.billed ?? 0), 0);
  const avgBilled = totalUnits > 0 ? totalSpend / totalUnits : null;

  const fmtDate = (iso: string | null) => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—";
  const variantLabel = [v.name, v.pack].filter(Boolean).join(" · ") || v.pack || "";

  return (
    <div className="space-y-5">
      {/* breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link href="/catalog" className="hover:text-foreground">Catalog</Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <Link href="/catalog" className="hover:text-foreground">Products</Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <Link href={`/catalog/${id}`} className="hover:text-foreground">{p.parent}</Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <span className="font-mono font-medium text-foreground">{v.sku}</span>
      </nav>

      {/* header card */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            {p.images && Array.isArray(p.images) && p.images.length
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={p.images[0] as string} alt="" className="shrink-0 rounded-[10px] border object-cover" style={{ height: 52, width: 52 }} />
              : <span className="grid shrink-0 place-items-center rounded-[10px] border bg-muted text-[10px] font-semibold text-muted-foreground" style={{ height: 52, width: 52 }}>{v.sku.slice(-4)}</span>}
            <div className="min-w-0">
              <h1 className="font-mono text-[22px] font-bold leading-tight">{v.sku}</h1>
              <div className="mt-0.5 text-[13.5px] text-muted-foreground">{p.parent}{variantLabel ? ` · ${variantLabel}` : ""}</div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {linked
                  ? <Badge tone="success"><Check className="mr-0.5 inline h-2.5 w-2.5 align-[-1px]" /> Linked to Amazon</Badge>
                  : <Badge tone="warning"><AlertCircle className="mr-0.5 inline h-2.5 w-2.5 align-[-1px]" /> Not linked</Badge>}
                <Badge tone="muted">{v.status}</Badge>
                {p.supplier && <span className="vy-chip"><Factory className="h-3 w-3" /> {p.supplier}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/catalog/${id}`} className="vy-btn vy-btn--outline inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Product</Link>
            <Link href={`/inventory?q=${encodeURIComponent(v.sku)}`} className="vy-btn vy-btn--outline inline-flex items-center gap-1.5"><Boxes className="h-3.5 w-3.5" /> Inventory</Link>
            <Link href="/orders" className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5" /> Model reorder</Link>
          </div>
        </div>
      </Card>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <VarKpi label="Net margin / unit" value={eco.marginPct == null ? "—" : money(eco.net)} sub={eco.marginPct == null ? "set a sale price" : `${eco.marginPct}% margin`} tone={mtone} />
        <VarKpi label="Available" value={num(inv.available)} sub={`${num(inv.onHand)} on hand · ${num(inv.inbound)} inbound`} tone={INV_HEALTH_TONE[inv.health]} />
        <VarKpi label="Days of cover" value={inv.daysCover === Infinity ? "∞" : `${Math.round(inv.daysCover)}d`} sub={inv.velocity > 0 ? `${inv.velocity.toFixed(1)}/day velocity` : "no velocity"} />
        <VarKpi label="Avg landed / unit" value={avgLanded != null ? money(avgLanded) : "—"} sub={runs.length ? `${runs.length} runs · ${num(totalUnits)} units` : "no history"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* left: live FBA + unit economics */}
        <div className="space-y-5">
          <Card className="p-5">
            <div className="vy-kicker mb-3">Live FBA position</div>
            {linked ? (
              <>
                <div className="flex flex-wrap gap-4">
                  {([["On hand", num(inv.onHand)], ["Available", num(inv.available)], ["Reserved", num(inv.reserved)], ["Inbound", num(inv.inbound)], ["Reorder point", num(inv.reorderPoint)], ["Primary FC", "—"]] as [string, string][]).map(([l, val]) => (
                    <div key={l} className="min-w-0 flex-[1_1_88px]">
                      <div className="vy-kicker mb-0.5">{l}</div>
                      <div className="font-mono text-[14.5px] font-bold">{val}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge tone={INV_HEALTH_TONE[inv.health]}>{inv.health}</Badge>
                  <span className="text-[11px] text-muted-foreground">Stock &amp; velocity sync from Amazon</span>
                </div>
              </>
            ) : (
              <div className="rounded-[10px] border border-dashed px-3.5 py-3.5 text-[12.5px] text-muted-foreground">Not linked to an Amazon inventory record — link it on the product page to see live stock.</div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-1 flex items-baseline justify-between">
              <div className="vy-kicker">Unit economics</div>
              <Badge tone={mtone}>{eco.marginPct == null ? "No price" : `${eco.marginPct}% net`}</Badge>
            </div>
            <MoneyRow label="Sale price" value={eco.price} />
            <MoneyRow label="COGS (landed unit cost)" value={eco.cogs} minus />
            <MoneyRow label="Referral fee (15%)" value={eco.referral} minus />
            <MoneyRow label="FBA fulfilment fee" value={eco.fba} minus />
            <MoneyRow label="Storage / mo" value={0} minus />
            <MoneyRow label="Net per unit" value={eco.net} strong tone={mtone} />
            <p className="mt-2.5 text-[10.5px] leading-relaxed text-muted-foreground">FBA fees are 2026 estimates from small-standard tier / weight / category. COGS = the SKU&apos;s last landed unit cost.</p>
          </Card>
        </div>

        {/* right: order & cost history */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="vy-kicker">Order &amp; cost history</div>
            {runs.length > 0 && <span className="text-[11px] text-muted-foreground">{runs.length} runs · avg landed {avgLanded != null ? money(avgLanded) : "—"}</span>}
          </div>
          <p className="mb-3 mt-1 text-[11px] text-muted-foreground">Every production run that included this SKU — units, what you were billed, and the landed cost that run.</p>
          {runs.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">No production runs yet — this builds as you order &amp; invoice this SKU.</div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[420px] text-[12.5px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Run</th>
                      <th className="px-3 py-2 text-right font-medium">Units</th>
                      <th className="px-3 py-2 text-right font-medium">Billed/u</th>
                      <th className="px-3 py-2 text-right font-medium">Landed/u</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {runs.map((r, i) => (
                      <tr key={r.orderId} className="hover:bg-accent/40">
                        <td className="px-3 py-2">
                          <div className="font-semibold">{fmtDate(r.date)}{i === 0 && <Badge tone="info" className="ml-1.5 align-[1px] text-[9px]">latest</Badge>}</div>
                          <Link href={`/orders/${r.orderId}`} className="font-mono text-[10.5px] text-muted-foreground hover:text-primary">{r.orderId}</Link>
                        </td>
                        <td className="tabular px-3 py-2 text-right font-mono">{num(r.units)}</td>
                        <td className="tabular px-3 py-2 text-right font-mono">{r.billed != null ? money(r.billed) : "—"}</td>
                        <td className="tabular px-3 py-2 text-right font-mono">{r.landed != null ? money(r.landed) : "—"}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-muted/30 font-bold">
                      <td className="px-3 py-2">All runs</td>
                      <td className="tabular px-3 py-2 text-right font-mono">{num(totalUnits)}</td>
                      <td className="tabular px-3 py-2 text-right font-mono">{avgBilled != null ? money(avgBilled) : "—"}</td>
                      <td className="tabular px-3 py-2 text-right font-mono">{avgLanded != null ? money(avgLanded) : "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3.5 flex flex-wrap gap-4 border-t pt-3.5">
                <Foot label="Total spend" value={money(totalSpend)} />
                <Foot label="Lifetime units" value={num(totalUnits)} />
                <Foot label="Runs" value={num(runs.length)} />
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function VarKpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <span className="vy-kicker">{label}</span>
      <div className="mt-0.5 font-mono text-[23px] font-extrabold" style={tone ? { color: `hsl(var(--${tone}))` } : undefined}>{value}</div>
      {sub && <span className="text-[11.5px] text-muted-foreground">{sub}</span>}
    </Card>
  );
}

function MoneyRow({ label, value, minus, strong, tone }: { label: string; value: number; minus?: boolean; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border/60 py-2">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-[13px]", strong ? "font-bold" : "font-semibold")} style={strong && tone ? { color: `hsl(var(--${tone}))` } : undefined}>{minus ? "−" : ""}{money(value)}</span>
    </div>
  );
}

function Foot({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-[1_1_120px]">
      <div className="vy-kicker mb-0.5">{label}</div>
      <div className="font-mono text-[16px] font-extrabold">{value}</div>
    </div>
  );
}
