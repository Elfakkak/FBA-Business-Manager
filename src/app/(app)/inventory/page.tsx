import { createClient } from "@/lib/supabase/server";
import { invStats, INV_FCS, type Variant, type Product } from "@/lib/derive";
import { InventoryTable, type InvRow } from "./inventory-table";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("*");
  const { data: variants } = await supabase.from("product_variants").select("*").order("family_id").order("sku");
  const { data: amazon } = await supabase.from("integrations").select("status, last_sync").eq("id", "amazon").maybeSingle();
  const amazonConnected = amazon?.status === "connected";

  const productById = new Map<string, Product>();
  for (const p of (products ?? []) as Product[]) productById.set(p.id, p);

  const rows: InvRow[] = ((variants ?? []) as Variant[]).map((v, i) => {
    const p = productById.get(v.family_id);
    const st = invStats(v, p?.lead_time_days ?? 0);
    return {
      id: v.id,
      sku: v.sku,
      fnsku: v.fnsku,
      familyId: v.family_id,
      family: p?.parent ?? v.family_id,
      color: p?.color ?? null,
      category: p?.category ?? "Other",
      supplier: p?.supplier ?? null,
      onHand: st.onHand,
      reserved: st.reserved,
      available: st.available,
      inbound: st.inbound,
      unfulfillable: st.unfulfillable,
      daysCover: st.daysCover === Infinity ? null : Math.round(st.daysCover),
      reorderPoint: st.reorderPoint,
      health: st.health,
      fc: INV_FCS[i % INV_FCS.length],
      image: Array.isArray(p?.images) && p!.images.length ? (p!.images[0] as string) : null,
      lastCost: v.last_cost_usd ?? null,
    };
  });

  return <InventoryTable rows={rows} amazonConnected={amazonConnected} lastSync={amazon?.last_sync ?? null} initialQ={q} />;
}
