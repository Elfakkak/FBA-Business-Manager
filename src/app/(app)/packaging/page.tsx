import { createClient } from "@/lib/supabase/server";
import { Kpi, PageHead } from "@/components/ui/primitives";
import { packagingOnHand, money, num, type PackagingItem, type PackagingMove, type Product } from "@/lib/derive";
import { AddPackagingButton } from "./packaging-actions";
import { PackagingTable } from "./packaging-table";

export default async function PackagingPage() {
  const supabase = await createClient();
  const [{ data: items }, { data: moves }, { data: products }] = await Promise.all([
    supabase.from("packaging_items").select("*").order("name"),
    supabase.from("packaging_moves").select("*"),
    supabase.from("products").select("id, parent"),
  ]);

  const allMoves = (moves ?? []) as PackagingMove[];
  const familyName = new Map<string, string>();
  for (const p of (products ?? []) as Pick<Product, "id" | "parent">[]) familyName.set(p.id, p.parent);

  const rows = ((items ?? []) as PackagingItem[]).map((it) => {
    const d = packagingOnHand(it, allMoves);
    return { item: it, ...d, product: it.family_id ? familyName.get(it.family_id) ?? null : null };
  });

  const totalUnits = rows.reduce((s, r) => s + r.onHand, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const lowCount = rows.filter((r) => r.low).length;

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Catalog"
        title="Packaging inventory"
        sub="Mailers, cartons, inserts and labels — tracked on their own, assignable to a product family."
        actions={<AddPackagingButton families={(products ?? []) as { id: string; parent: string }[]} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Packaging items" value={num(rows.length)} sub={`${num(totalUnits)} units on hand`} />
        <Kpi label="Inventory value" value={money(totalValue)} sub="at last unit cost" tone="info" />
        <Kpi label="Low / reorder" value={num(lowCount)} sub="at or below reorder point" tone={lowCount ? "warning" : "success"} />
      </div>

      <PackagingTable rows={rows} moves={allMoves} products={(products ?? []) as { id: string; parent: string }[]} />
    </div>
  );
}
