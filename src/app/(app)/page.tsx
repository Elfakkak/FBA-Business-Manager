import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Kpi, PageHead } from "@/components/ui/primitives";
import { num } from "@/lib/derive";

export default async function Dashboard() {
  const supabase = await createClient();

  const [{ count: productCount }, { count: variantCount }, { data: variants }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("product_variants").select("*", { count: "exact", head: true }),
    supabase.from("product_variants").select("fba_stock, inbound"),
  ]);

  const stock = (variants ?? []).reduce((s, v) => s + (v.fba_stock ?? 0), 0);
  const inbound = (variants ?? []).reduce((s, v) => s + (v.inbound ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Overview"
        title="Dashboard"
        sub="Your FBA business at a glance. Phase 1 — Catalog, Inventory and Packaging are live with your real data."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Products" value={num(productCount ?? 0)} sub="families" tone="info" />
        <Kpi label="Variants" value={num(variantCount ?? 0)} sub="active SKUs" />
        <Kpi label="FBA stock" value={num(stock)} sub="units on hand" source="amazon" tone="success" />
        <Kpi label="Inbound" value={num(inbound)} sub="units to FBA" source="amazon" tone="info" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink href="/catalog" title="Catalog" body="Product families, variants, Amazon identity." />
        <QuickLink href="/inventory" title="Inventory" body="Live FBA stock, coverage and reorder health." />
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
