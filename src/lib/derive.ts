// Derived calculations — ported from the prototype *-data.jsx modules.
// PRINCIPLE: these are computed at read time, never stored.
import type { Database } from "@/lib/database.types";

export type Variant = Database["public"]["Tables"]["product_variants"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type PackagingItem = Database["public"]["Tables"]["packaging_items"]["Row"];
export type PackagingMove = Database["public"]["Tables"]["packaging_moves"]["Row"];

export const CAT_LOW_STOCK = 40;
export const INV_SAFETY_DAYS = 14;

export type Tone = "success" | "warning" | "danger" | "info" | "brand" | "muted";

// ---------- catalog family stats ----------
export type FamilyHealth = "Ready" | "Reorder" | "Data gap" | "Empty";

export function catFamilyStats(variants: Variant[]) {
  const skuCount = variants.length;
  const stock = variants.reduce((s, v) => s + (v.fba_stock ?? 0), 0);
  const inbound = variants.reduce((s, v) => s + (v.inbound ?? 0), 0);
  const costs = variants.map((v) => v.last_cost_usd).filter((c): c is number => c != null);
  const minCost = costs.length ? Math.min(...costs) : null;
  const maxCost = costs.length ? Math.max(...costs) : null;
  const gaps = variants.filter((v) => v.status !== "Ready" && v.status !== "Reorder").length;
  const reorder = variants.filter(
    (v) => v.status === "Reorder" || (v.fba_stock ?? 0) <= CAT_LOW_STOCK
  ).length;
  let health: FamilyHealth = "Ready";
  if (skuCount === 0) health = "Empty";
  else if (gaps > 0) health = "Data gap";
  else if (reorder > 0) health = "Reorder";
  const costLabel =
    minCost == null ? "—" : minCost === maxCost ? money(minCost) : `${money(minCost)}–${money(maxCost!)}`;
  const lowStock = stock <= CAT_LOW_STOCK * Math.max(1, Math.round(skuCount / 2));
  return { skuCount, stock, inbound, minCost, maxCost, costLabel, gaps, reorder, health, lowStock };
}

export const FAMILY_HEALTH_TONE: Record<FamilyHealth, Tone> = {
  Ready: "success",
  Reorder: "warning",
  "Data gap": "danger",
  Empty: "muted",
};

export const VARIANT_STATUS_TONE: Record<string, Tone> = {
  Ready: "success",
  Reorder: "warning",
  "SKU mislabeled": "danger",
  "Not linked": "muted",
};

// ---------- inventory per-SKU stats ----------
export type InvHealth = "Healthy" | "Low" | "Reorder";

export function invStats(v: Variant, leadTimeDays: number) {
  const onHand = v.fba_stock ?? 0;
  const velocity = v.velocity ?? 0;
  const inbound = v.inbound ?? 0;
  const unfulfillable = v.unfulfillable ?? 0;
  const reserved = Math.min(onHand, Math.round(velocity * 2));
  const available = Math.max(0, onHand - reserved - unfulfillable);
  const projected = available + inbound;
  const daysCover = velocity > 0 ? available / velocity : Infinity;
  const reorderPoint = v.reorder_point ?? Math.ceil(velocity * (leadTimeDays + INV_SAFETY_DAYS));
  let health: InvHealth = "Healthy";
  if (projected < reorderPoint && reorderPoint > 0) health = "Reorder";
  else if (daysCover < INV_SAFETY_DAYS && inbound === 0 && velocity > 0) health = "Low";
  return { onHand, velocity, inbound, unfulfillable, reserved, available, projected, daysCover, reorderPoint, health };
}

export const INV_HEALTH_TONE: Record<InvHealth, Tone> = {
  Healthy: "success",
  Low: "warning",
  Reorder: "danger",
};

// ---------- packaging on-hand ----------
export function packagingOnHand(item: PackagingItem, moves: PackagingMove[]) {
  const mine = moves.filter((m) => m.item_id === item.id);
  const received = mine.filter((m) => m.type === "receive").reduce((s, m) => s + m.qty, 0);
  const consumed = mine.filter((m) => m.type === "consume").reduce((s, m) => s + m.qty, 0);
  const onHand = Math.max(0, received - consumed);
  const unit = item.unit_cost ?? 0;
  const value = Math.round(onHand * unit * 100) / 100;
  const low = item.reorder_point != null && onHand <= item.reorder_point;
  return { onHand, unit, value, low };
}

// ---------- formatting ----------
export function money(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function num(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}
export function daysLabel(d: number) {
  return d === Infinity ? "∞" : `${Math.round(d)}d`;
}
