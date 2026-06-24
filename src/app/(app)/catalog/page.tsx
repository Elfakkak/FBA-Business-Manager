import { createClient } from "@/lib/supabase/server";
import { catFamilyStats, type Variant } from "@/lib/derive";
import { CatalogList, type FamilySummary } from "./catalog-list";

export default async function CatalogPage() {
  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("*").order("parent");
  const { data: variants } = await supabase.from("product_variants").select("*");

  const byFamily = new Map<string, Variant[]>();
  for (const v of (variants ?? []) as Variant[]) {
    if (!byFamily.has(v.family_id)) byFamily.set(v.family_id, []);
    byFamily.get(v.family_id)!.push(v);
  }

  const families: FamilySummary[] = (products ?? []).map((p) => {
    const vs = byFamily.get(p.id) ?? [];
    const s = catFamilyStats(vs);
    return {
      id: p.id,
      parent: p.parent,
      color: p.color,
      category: p.category,
      supplier: p.supplier,
      lastOrdered: p.last_ordered,
      skuCount: s.skuCount,
      stock: s.stock,
      inbound: s.inbound,
      costLabel: s.costLabel,
      health: s.health,
      lowStock: s.lowStock,
    };
  });

  return <CatalogList families={families} />;
}
