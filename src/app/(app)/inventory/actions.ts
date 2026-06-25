"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function setFavorite(variantId: string, favorite: boolean): Promise<Result> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("product_variants").update({ favorite } as never).eq("id", variantId).select("family_id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/catalog");
  if (row?.family_id) revalidatePath(`/catalog/${row.family_id}`);
  return { ok: true };
}

export async function setReorderPoint(variantId: string, value: number | null): Promise<Result> {
  const supabase = await createClient();
  const v = value != null && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
  const { data: row, error } = await supabase
    .from("product_variants").update({ reorder_point: v }).eq("id", variantId).select("family_id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  // reorder point is shared by Inventory and the product/catalog views — revalidate all
  revalidatePath("/inventory");
  revalidatePath("/catalog");
  if (row?.family_id) revalidatePath(`/catalog/${row.family_id}`);
  return { ok: true };
}
