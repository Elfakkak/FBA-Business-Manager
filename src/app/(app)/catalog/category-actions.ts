"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const slug = (s: string) =>
  s.toLowerCase().replace(/["'(),]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

type Result = { ok: true } | { ok: false; error: string };

export async function createCategory(form: FormData): Promise<Result> {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Category name is required." };

  const supabase = await createClient();
  // case-insensitive duplicate guard
  const { data: dupes } = await supabase.from("categories").select("name");
  if ((dupes ?? []).some((c) => c.name.toLowerCase() === name.toLowerCase()))
    return { ok: false, error: `"${name}" already exists.` };

  const id = slug(name) || `cat-${Date.now().toString(36)}`;
  const { error } = await supabase.from("categories").insert({ id, name });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/catalog");
  return { ok: true };
}

export async function renameCategory(id: string, oldName: string, form: FormData): Promise<Result> {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Category name is required." };
  if (name === oldName) return { ok: true };

  const supabase = await createClient();
  const { data: dupes } = await supabase.from("categories").select("id, name");
  if ((dupes ?? []).some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase()))
    return { ok: false, error: `"${name}" already exists.` };

  const { error } = await supabase.from("categories").update({ name }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  // cascade the rename to every product carrying the old label
  await supabase.from("products").update({ category: name }).eq("category", oldName);
  revalidatePath("/catalog");
  return { ok: true };
}

export async function deleteCategory(id: string, name: string): Promise<Result> {
  const supabase = await createClient();
  // unassign any products using it, then remove the category
  await supabase.from("products").update({ category: "" }).eq("category", name);
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/catalog");
  return { ok: true };
}
