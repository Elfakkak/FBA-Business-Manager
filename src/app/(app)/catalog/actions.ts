"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type VariantUpdate = Database["public"]["Tables"]["product_variants"]["Update"];

const slug = (s: string) =>
  s.toLowerCase().replace(/["'(),]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

type Result = { ok: true } | { ok: false; error: string };

export async function createProduct(form: FormData): Promise<Result> {
  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "").trim() || "Other";
  if (!name) return { ok: false, error: "Product name is required." };

  const supabase = await createClient();
  let id = slug(name);
  if (!id) return { ok: false, error: "Could not derive an id from the name." };

  // ensure unique id
  const { data: existing } = await supabase.from("products").select("id").eq("id", id).maybeSingle();
  if (existing) id = `${id}-${Date.now().toString(36).slice(-4)}`;

  const { error } = await supabase.from("products").insert({
    id,
    parent: name,
    category,
    brand: "Vyonix",
    images: [],
    badges: [],
    cost_history: [],
    order_history: [],
  });
  if (error) return { ok: false, error: error.message };

  // keep the managed category list in sync if a new one was typed
  if (category && category !== "Other") {
    const { data: cats } = await supabase.from("categories").select("name");
    const exists = (cats ?? []).some((c) => c.name.toLowerCase() === category.toLowerCase());
    if (!exists) {
      await supabase.from("categories").insert({ id: slug(category) || `cat-${Date.now().toString(36)}`, name: category });
    }
  }
  revalidatePath("/catalog");
  return { ok: true };
}

export async function addVariant(familyId: string, form: FormData): Promise<Result> {
  const sku = String(form.get("sku") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const pack = String(form.get("pack") ?? "1-Pack").trim() || "1-Pack";
  const cost = parseFloat(String(form.get("cost") ?? ""));
  const asin = String(form.get("asin") ?? "").trim() || null;
  const fnsku = String(form.get("fnsku") ?? "").trim() || null;
  if (!sku) return { ok: false, error: "SKU is required." };
  if (!name) return { ok: false, error: "Variant name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").insert({
    family_id: familyId,
    sku,
    name,
    pack,
    last_cost_usd: Number.isFinite(cost) ? cost : null,
    asin,
    fnsku,
    status: asin ? "Ready" : "Not linked",
    prep: /stickerless|stkls/i.test(sku) ? "Stickerless" : "Labeled",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/catalog/${familyId}`);
  revalidatePath("/inventory");
  return { ok: true };
}

export async function updateVariant(variantId: string, familyId: string, form: FormData): Promise<Result> {
  const cost = parseFloat(String(form.get("cost") ?? ""));
  const reorder = parseInt(String(form.get("reorder_point") ?? ""));
  const status = String(form.get("status") ?? "").trim();

  const price = parseFloat(String(form.get("sale_price") ?? ""));
  const patch: VariantUpdate = {};
  if (String(form.get("cost") ?? "") !== "") patch.last_cost_usd = Number.isFinite(cost) ? cost : null;
  if (String(form.get("sale_price") ?? "") !== "") patch.sale_price = Number.isFinite(price) ? price : null;
  if (String(form.get("reorder_point") ?? "") !== "") patch.reorder_point = Number.isFinite(reorder) ? reorder : null;
  if (status) patch.status = status as VariantUpdate["status"];
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update." };

  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").update(patch).eq("id", variantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/catalog/${familyId}`);
  revalidatePath("/inventory");
  return { ok: true };
}
