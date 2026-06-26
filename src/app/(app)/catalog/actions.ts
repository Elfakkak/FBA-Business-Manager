"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Dim } from "@/lib/derive";
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

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

export async function updateProduct(id: string, form: FormData): Promise<Result> {
  const supabase = await createClient();
  const txt = (k: string) => { const v = form.get(k); return v === null ? undefined : (String(v).trim() || null); };
  const int = (k: string) => { const v = form.get(k); if (v === null || String(v).trim() === "") return undefined; const n = parseInt(String(v)); return Number.isFinite(n) ? n : null; };
  const flt = (k: string) => { const v = form.get(k); if (v === null || String(v).trim() === "") return undefined; const n = parseFloat(String(v)); return Number.isFinite(n) ? n : null; };

  const patch: ProductUpdate = {};
  for (const k of ["material", "supplier", "supplier_route", "last_ordered"]) {
    const v = txt(k); if (v !== undefined) (patch as Record<string, unknown>)[k] = v;
  }
  const lead = int("lead_time_days"); if (lead !== undefined) patch.lead_time_days = lead ?? 0;
  const moq = int("moq"); if (moq !== undefined) patch.moq = moq ?? 0;
  const wkg = flt("weight_kg"); if (wkg !== undefined) patch.weight_kg = wkg;
  const upc = int("units_per_carton"); if (upc !== undefined) patch.units_per_carton = upc;

  // dimensions {l,w,h} for unit + carton, only set when any provided
  const dl = flt("dim_l"), dw = flt("dim_w"), dh = flt("dim_h");
  if (dl !== undefined || dw !== undefined || dh !== undefined) patch.dim_cm = { l: dl ?? null, w: dw ?? null, h: dh ?? null };
  const cl = flt("carton_l"), cw = flt("carton_w"), ch = flt("carton_h");
  if (cl !== undefined || cw !== undefined || ch !== undefined) patch.carton_cm = { l: cl ?? null, w: cw ?? null, h: ch ?? null };

  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update." };
  const { error } = await supabase.from("products").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/catalog/${id}`);
  revalidatePath("/catalog");
  return { ok: true };
}

export async function logNewSize(id: string, form: FormData): Promise<Result> {
  const supabase = await createClient();
  const flt = (k: string) => { const v = String(form.get(k) ?? "").trim(); return v === "" ? null : (parseFloat(v) || null); };
  const intv = (k: string) => { const v = String(form.get(k) ?? "").trim(); return v === "" ? null : (parseInt(v) || null); };
  const dim = { l: flt("dim_l"), w: flt("dim_w"), h: flt("dim_h") };
  const carton = { l: flt("carton_l"), w: flt("carton_w"), h: flt("carton_h") };
  const weight = flt("weight_kg");
  const units = intv("units_per_carton");
  const note = String(form.get("note") ?? "").trim() || null;

  const { data: cur } = await supabase.from("products").select("dim_history, dim_cm, weight_kg, carton_cm, units_per_carton").eq("id", id).maybeSingle();
  const history = Array.isArray(cur?.dim_history) ? [...(cur!.dim_history as unknown[])] : [];
  const today = new Date().toISOString().slice(0, 10);
  // seed an "Earlier" entry from current values if history is empty
  const curDim = cur?.dim_cm as Dim;
  if (history.length === 0 && curDim && (curDim.l || curDim.w || curDim.h)) {
    history.push({ date: "Earlier", dimCm: cur!.dim_cm, weightKg: cur!.weight_kg, cartonCm: cur!.carton_cm, unitsPerCarton: cur!.units_per_carton });
  }
  history.push({ date: today, dimCm: dim, weightKg: weight, cartonCm: carton, unitsPerCarton: units, note });

  const { error } = await supabase.from("products").update({
    dim_cm: dim, weight_kg: weight, carton_cm: carton, units_per_carton: units,
    dim_history: history as never,
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/catalog/${id}`);
  return { ok: true };
}

// Move a variant (SKU) to another product family — or to a brand-new product.
// Absorbs orphan SKUs into a parent, creates parents on the fly, and regroups.
export async function moveVariant(variantId: string, targetFamilyId: string, newProductName?: string): Promise<Result & { familyId?: string }> {
  const supabase = await createClient();
  let familyId = targetFamilyId;
  let createdId: string | null = null;

  if (newProductName?.trim()) {
    const name = newProductName.trim();
    const id = "p-" + (name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "product") + "-" + Math.random().toString(36).slice(2, 6);
    const { error: e1 } = await supabase.from("products").insert({ id, parent: name, category: "Uncategorized" });
    if (e1) return { ok: false, error: e1.message };
    familyId = id; createdId = id;
  } else if (familyId) {
    // validate the target exists (this action is callable directly, not only from the picker)
    const { data: tgt } = await supabase.from("products").select("id").eq("id", familyId).maybeSingle();
    if (!tgt) return { ok: false, error: "Target product not found." };
  }
  if (!familyId) return { ok: false, error: "Pick a product to move this SKU into." };

  const { data: cur } = await supabase.from("product_variants").select("family_id").eq("id", variantId).maybeSingle();
  const oldFamily = cur?.family_id;
  if (oldFamily === familyId) return { ok: true, familyId };

  const { error } = await supabase.from("product_variants").update({ family_id: familyId }).eq("id", variantId);
  if (error) {
    if (createdId) await supabase.from("products").delete().eq("id", createdId); // don't leave an empty new product
    return { ok: false, error: error.message };
  }

  // remove the old family if it's now empty AND was an auto-imported orphan
  if (oldFamily && String(oldFamily).startsWith("amz-")) {
    const { count } = await supabase.from("product_variants").select("id", { count: "exact", head: true }).eq("family_id", oldFamily);
    if (!count) await supabase.from("products").delete().eq("id", oldFamily);
  }
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${familyId}`);
  if (oldFamily) revalidatePath(`/catalog/${oldFamily}`);
  return { ok: true, familyId };
}

// Choose which SKU's Amazon details (size/weight/fee) represent this product family.
export async function setPrimarySku(familyId: string, sku: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ primary_sku: sku }).eq("id", familyId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/catalog/${familyId}`);
  return { ok: true };
}

export async function addProductImage(id: string, url: string): Promise<Result> {
  if (!url) return { ok: false, error: "No image." };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("products").select("images").eq("id", id).maybeSingle();
  const images = Array.isArray(cur?.images) ? [...(cur!.images as string[])] : [];
  images.push(url);
  const { error } = await supabase.from("products").update({ images }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/catalog/${id}`);
  return { ok: true };
}

export async function removeProductImage(id: string, url: string): Promise<Result> {
  const supabase = await createClient();
  const { data: cur } = await supabase.from("products").select("images").eq("id", id).maybeSingle();
  const images = (Array.isArray(cur?.images) ? (cur!.images as string[]) : []).filter((u) => u !== url);
  const { error } = await supabase.from("products").update({ images }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  // also delete the underlying storage object so the bucket doesn't accumulate orphans
  const marker = "/product-media/";
  const i = url.indexOf(marker);
  if (i !== -1) await supabase.storage.from("product-media").remove([url.slice(i + marker.length)]);
  revalidatePath(`/catalog/${id}`);
  return { ok: true };
}

export async function addTechPack(familyId: string, form: FormData): Promise<Result> {
  const fileName = String(form.get("file_name") ?? "").trim();
  const note = String(form.get("note") ?? "").trim() || null;
  const assetRef = String(form.get("asset_ref") ?? "").trim() || null;
  const fileSize = parseInt(String(form.get("file_size") ?? "")) || null;
  if (!fileName) return { ok: false, error: "File name is required." };
  const supabase = await createClient();
  const { data: latest } = await supabase.from("product_tech_packs").select("version").eq("family_id", familyId).order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (latest?.version ?? 0) + 1;
  const { error } = await supabase.from("product_tech_packs").insert({
    family_id: familyId, version, file_name: fileName, note, asset_ref: assetRef, file_size: fileSize, doc_date: new Date().toISOString().slice(0, 10),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/catalog/${familyId}`);
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
