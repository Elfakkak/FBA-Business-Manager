import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Kpi, PageHead, Badge, SectionTitle } from "@/components/ui/primitives";
import { invStats, reorderQty, INV_HEALTH_TONE, INV_SAFETY_DAYS, num, type Variant, type Product } from "@/lib/derive";
import { Radar } from "lucide-react";

export default async function Dashboard() {
  const supabase = await createClient();

  const [{ data: products }, { data: variants }] = await Promise.all([
    supabase.from("products").select("*"),
    supabase.from("product_variants").select("*"),
  ]);
  const prods = (products ?? []) as Product[];
  const vars = (variants ?? []) as Variant[];
  const leadOf = new Map(prods.map((p) => [p.id, p.lead_time_days ?? 0]));
  const nameOf = new Map(prods.map((p) => [p.id, p.parent]));

  const stock = vars.reduce((s, v) => s + (v.fba_stock ?? 0), 0);
  const inbound = vars.reduce((s, v) => s + (v.inbound ?? 0), 0);
  const haveVelocity = vars.some((v) => (v.velocity ?? 0) > 0);

  // Reorder radar — SKUs below their reorder point, favorites first, worst cover at top
  const radar = vars
    .map((v) => {
      const st = invStats(v, leadOf.get(v.family_id) ?? 0);
      const fav = v.favorite ?? false;
      return { v, st, fav, product: nameOf.get(v.family_id) ?? v.family_id };
    })
    .filter((r) => r.st.health === "Reorder" || r.st.health === "Low")
    .sort((a, b) => (a.fav === b.fav ? (a.st.daysCover ?? 1e9) - (b.st.daysCover ?? 1e9) : a.fav ? -1 : 1))
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <PageHead kicker="Overview" title="Dashboard" sub="Your FBA business at a glance — live from Amazon." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Products" value={num(prods.length)} sub="families" tone="info" />
        <Kpi label="Variants" value={num(vars.length)} sub="active SKUs" />
        <Kpi label="FBA stock" value={num(stock)} sub="units on hand" source="amazon" tone="success" />
        <Kpi label="Inbound" value={num(inbound)} sub="units to FBA" source="amazon" tone="info" />
      </div>

      {/* Reorder radar */}
      <Card className="p-5">
        <SectionTitle icon={Radar} tone="warning" title="Reorder radar" count={radar.length}
          sub="SKUs running low — favorites first, worst days-of-cover at the top." />
        {!haveVelocity ? (
          <div className="rounded-lg border border-dashed bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
            Sales velocity isn&apos;t synced yet, so days-of-cover can&apos;t be computed. Once velocity is pulled from Amazon, this radar lights up with exactly what to reorder.
          </div>
        ) : radar.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background/40 px-4 py-6 text-center text-sm text-success">All SKUs are healthy — nothing to reorder right now. ✓</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">SKU / product</th><th className="px-3 py-2 text-right font-medium">Days cover</th>
                <th className="px-3 py-2 text-right font-medium">Available</th><th className="px-3 py-2 text-right font-medium">Inbound</th>
                <th className="px-3 py-2 text-right font-medium">Suggested qty</th><th className="px-3 py-2 font-medium">Health</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody className="divide-y">
                {radar.map(({ v, st, product }) => {
                  const qty = reorderQty(st.velocity, leadOf.get(v.family_id) ?? 0, st.available, st.inbound);
                  return (
                    <tr key={v.id} className="hover:bg-accent/40">
                      <td className="px-3 py-2"><Link href={`/catalog/${v.family_id}`} className="font-mono text-[12px] font-bold hover:text-primary">{v.sku}</Link><div className="max-w-[240px] truncate text-[11px] text-muted-foreground">{product}</div></td>
                      <td className={`tabular px-3 py-2 text-right font-mono ${st.daysCover !== Infinity && st.daysCover < INV_SAFETY_DAYS ? "text-danger" : "text-warning"}`}>{st.daysCover === Infinity ? "∞" : `${Math.round(st.daysCover)}d`}</td>
                      <td className="tabular px-3 py-2 text-right font-mono">{num(st.available)}</td>
                      <td className={`tabular px-3 py-2 text-right font-mono ${st.inbound > 0 ? "text-info" : "text-muted-foreground"}`}>{st.inbound > 0 ? num(st.inbound) : "—"}</td>
                      <td className="tabular px-3 py-2 text-right font-mono font-semibold">{num(qty)}</td>
                      <td className="px-3 py-2"><Badge tone={INV_HEALTH_TONE[st.health]}>{st.health}</Badge></td>
                      <td className="px-3 py-2 text-right"><Link href={`/orders?reorder=1&sku=${encodeURIComponent(v.sku)}&name=${encodeURIComponent(product)}&qty=${qty}`} className="vy-btn vy-btn--outline vy-btn--sm">Reorder</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/catalog" title="Catalog" body="Product families, variants, Amazon identity." />
        <QuickLink href="/inventory" title="Inventory" body="Live FBA stock, coverage and reorder health." />
        <QuickLink href="/fba-shipments" title="FBA Shipments" body="Inbound shipments — expected vs received." />
        <QuickLink href="/packaging" title="Packaging" body="Mailers, cartons, inserts — on-hand & value." />
      </div>
    </div>
  );
}

function QuickLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href}>
      <Card className="p-5 transition hover:border-primary/40 hover:shadow-md">
        <div className="font-medium">{title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        <div className="mt-3 text-sm font-medium text-primary">Open →</div>
      </Card>
    </Link>
  );
}
