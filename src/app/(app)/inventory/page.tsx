import { createClient } from "@/lib/supabase/server";
import { invStats, type Variant, type Product } from "@/lib/derive";
import { InventoryTable, type InvRow } from "./inventory-table";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("*");
  const { data: variants } = await supabase.from("product_variants").select("*").order("sku");

  const productById = new Map<string, Product>();
  for (const p of (products ?? []) as Product[]) productById.set(p.id, p);

  const rows: InvRow[] = ((variants ?? []) as Variant[]).map((v) => {
    const p = productById.get(v.family_id);
    const st = invStats(v, p?.lead_time_days ?? 0);
    return {
      id: v.id,
      sku: v.sku,
      fnsku: v.fnsku,
      family: p?.parent ?? v.family_id,
      familyId: v.family_id,
      category: p?.category ?? "—",
      onHand: st.onHand,
      reserved: st.reserved,
      available: st.available,
      inbound: st.inbound,
      unfulfillable: st.unfulfillable,
      daysCover: st.daysCover === Infinity ? null : Math.round(st.daysCover),
      reorderPoint: st.reorderPoint,
      health: st.health,
    };
  });

  return <InventoryTable rows={rows} />;
}
