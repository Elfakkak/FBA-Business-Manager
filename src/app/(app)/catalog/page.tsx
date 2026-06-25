import { createClient } from "@/lib/supabase/server";
import { catFamilyStats, type Variant } from "@/lib/derive";
import { CatalogList, type FamilySummary } from "./catalog-list";
import type { CategoryRow } from "./category-manager";

export default async function CatalogPage() {
  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("*").order("parent");
  const { data: variants } = await supabase.from("product_variants").select("*");
  const { data: categoryList } = await supabase.from("categories").select("id, name").order("name");

  const catCount = new Map<string, number>();
  for (const p of products ?? []) if (p.category) catCount.set(p.category, (catCount.get(p.category) ?? 0) + 1);
  const categories: CategoryRow[] = (categoryList ?? []).map((c) => ({ id: c.id, name: c.name, count: catCount.get(c.name) ?? 0 }));

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
      leadTime: p.lead_time_days,
      skuCount: s.skuCount,
      stock: s.stock,
      inbound: s.inbound,
      costLabel: s.costLabel,
      health: s.health,
      lowStock: s.lowStock,
      skus: vs.map((v) => ({ sku: v.sku, stock: v.fba_stock ?? 0, status: v.status })),
    };
  });

  return <CatalogList families={families} categories={categories} />;
}
