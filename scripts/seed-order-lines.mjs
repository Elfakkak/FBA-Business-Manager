// Seed per-SKU order lines + set variant cost/price so economics, COGS,
// units and product cost/order history all light up.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// variant cost + sale price (USD) — drives margin ~ prototype's 72% for SWC-18
const VARIANT_ECON = {
  "BLK-SEMI-SWC-18--stickerless": { cost: 3.07, price: 49.99 },
  "BRN-SEMI-SWC-18--stickerless": { cost: 3.07, price: 49.99 },
  "TAN-RV-SWC-18-": { cost: 3.07, price: 49.99 },
  "SEMI-SWC-18-BLKRED-STKLS": { cost: 3.07, price: 49.99 },
  "SEMI-SWC-18-BLKBRN-STKLS": { cost: 3.07, price: 49.99 },
  "SEMI-SWC-18-BLKBLU-STKLS": { cost: 3.07, price: 49.99 },
  "BLK-CAR-SWC-15-D": { cost: 2.80, price: 39.99 },
  "VYB_SKM_10": { cost: 8.50, price: 32.99 },
  "2PACK-SEMI-BSC-BLK-stickerless": { cost: 15.81, price: 54.99 },
  "VY-001-BLK": { cost: 6.20, price: 27.99 },
  "2PACK-CAR-BSC-BLK": { cost: 11.40, price: 44.99 },
  "1PACK-CAR-ASC-BLK": { cost: 7.13, price: 24.99 },
  "2PACK-CAR-ASC-BLK": { cost: 13.63, price: 39.99 },
  "RV-TAN-BSC-2U-0": { cost: 17.60, price: 59.99 },
};

// order -> [{ sku, qty }]; unit_cost taken from VARIANT_ECON
const ORDER_LINES = {
  "ORD-2026-05-003": [["BLK-SEMI-SWC-18--stickerless", 500], ["BRN-SEMI-SWC-18--stickerless", 300], ["SEMI-SWC-18-BLKRED-STKLS", 200], ["SEMI-SWC-18-BLKBLU-STKLS", 150]],
  "ORD-2026-04-012": [["BLK-SEMI-SWC-18--stickerless", 240], ["TAN-RV-SWC-18-", 100]],
  "ORD-2026-05-006": [["VYB_SKM_10", 400], ["2PACK-SEMI-BSC-BLK-stickerless", 171]],
  "ORD-2026-05-004": [["VY-001-BLK", 400], ["2PACK-CAR-BSC-BLK", 171]],
  "ORD-2026-05-002": [["RV-TAN-BSC-2U-0", 150], ["1PACK-CAR-ASC-BLK", 100]],
  "ORD-2026-05-008": [["BLK-CAR-SWC-15-D", 100]],
};

const { data: variants } = await sb.from("product_variants").select("id, sku, family_id, name");
const bySku = new Map((variants ?? []).map((v) => [v.sku, v]));

// 1) update variant cost/price
let updated = 0;
for (const [sku, e] of Object.entries(VARIANT_ECON)) {
  const v = bySku.get(sku);
  if (!v) { console.log("  (no variant for", sku + ")"); continue; }
  const { error } = await sb.from("product_variants").update({ last_cost_usd: e.cost, sale_price: e.price }).eq("id", v.id);
  if (error) { console.error("variant update", sku, error.message); process.exit(1); }
  updated++;
}
console.log("✅ variant cost/price set:", updated);

// 2) insert order lines (idempotent-ish: clear existing then insert)
await sb.from("order_lines").delete().neq("id", "00000000-0000-0000-0000-000000000000");
const rows = [];
for (const [orderId, lines] of Object.entries(ORDER_LINES)) {
  for (const [sku, qty] of lines) {
    const v = bySku.get(sku);
    if (!v) continue;
    rows.push({
      id: randomUUID(), order_id: orderId, variant_id: v.id, family_id: v.family_id,
      sku, product_name: v.name, qty, unit_cost: VARIANT_ECON[sku]?.cost ?? null,
    });
  }
}
const { error: le } = await sb.from("order_lines").insert(rows);
if (le) { console.error("order_lines insert", le.message); process.exit(1); }
console.log("✅ order lines:", rows.length);

const { count } = await sb.from("order_lines").select("*", { count: "exact", head: true });
console.log("order_lines total:", count);
