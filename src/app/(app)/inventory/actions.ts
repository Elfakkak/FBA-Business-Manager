"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function setReorderPoint(variantId: string, value: number | null): Promise<Result> {
  const supabase = await createClient();
  const v = value != null && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
  const { error } = await supabase.from("product_variants").update({ reorder_point: v }).eq("id", variantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}
