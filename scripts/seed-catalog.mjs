// Seed products + product_variants from the two prototype CSVs.
// Catalog CSV = curated families/variants (source of truth).
// Inventory CSV = Amazon live FBA feed; joined on SKU to enrich stock.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --- tiny CSV parser. A quote is only a field-delimiter when it's the
//     FIRST char of a field; mid-field quotes (e.g. 18") are literal. ---
function parseCsv(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const out = []; let cur = "", q = false, atStart = true;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"' && atStart) { q = true; atStart = false; }
      else if (c === ",") { out.push(cur); cur = ""; atStart = true; }
      else { cur += c; atStart = false; }
    }
    out.push(cur);
    rows.push(out.map((s) => s.trim()));
  }
  return rows;
}

const slug = (s) =>
  s.toLowerCase().replace(/["'(),]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

const catalogPath = path.join(ROOT, "_design/prototype/uploads/vyonix-fba-catalog.csv");
const invPath = path.join(ROOT, "_design/prototype/uploads/vyonix-fba-live-inventory.csv");

const catRows = parseCsv(fs.readFileSync(catalogPath, "utf8")).slice(1);
const invRows = parseCsv(fs.readFileSync(invPath, "utf8")).slice(1);

// inventory map: SKU -> { fba_stock, inbound, velocity }
const invBySku = new Map();
for (const r of invRows) {
  const [hier, , sku, , , , , fba, inbound, , vel] = r;
  if (hier !== "CHILD" || !sku) continue;
  invBySku.set(sku, {
    fba_stock: parseInt(fba) || 0,
    inbound: parseInt(inbound) || 0,
    velocity: parseFloat(vel) || 0,
  });
}

function category(family) {
  const f = family.toLowerCase();
  if (f.includes("steering")) return "Steering wheel covers";
  if (f.includes("cushion")) return "Seat cushions";
  if (f.includes("seat")) return "Seat covers";
  return "Other";
}
function mapStatus(s) {
  if (/mislabeled/i.test(s)) return "SKU mislabeled";
  if (/^active/i.test(s)) return "Ready";
  return "Not linked";
}

const families = new Map(); // id -> product row
const variants = [];
const seenSku = new Set();

for (const r of catRows) {
  const [family, , variant, color, pack, asin, amazonSku, , fnsku, status] = r;
  if (!family) continue;
  const id = slug(family);
  if (!families.has(id)) {
    families.set(id, {
      id, parent: family, color: color || null, category: category(family),
      brand: "Vyonix", lead_time_days: 0, moq: 0,
      images: [], badges: [], cost_history: [], order_history: [],
    });
  }
  const sku = amazonSku || asin; // fall back to ASIN when no seller SKU
  if (!sku || seenSku.has(sku)) continue;
  seenSku.add(sku);
  const live = invBySku.get(amazonSku) || {};
  const prep = /stickerless|stkls/i.test(amazonSku) ? "Stickerless" : "Labeled";
  variants.push({
    family_id: id, sku, name: variant || color || sku, pack: pack || "1-Pack",
    fnsku: fnsku || null, asin: asin || null,
    fba_stock: live.fba_stock || 0, inbound: live.inbound || 0, velocity: live.velocity ?? null,
    status: mapStatus(status), prep,
  });
}

const familyRows = [...families.values()];
console.log(`families: ${familyRows.length}, variants: ${variants.length}`);

// upsert families first (FK target), then variants
const { error: fe } = await sb.from("products").upsert(familyRows, { onConflict: "id" });
if (fe) { console.error("products upsert error:", fe.message); process.exit(1); }

const { error: ve } = await sb.from("product_variants").upsert(variants, { onConflict: "sku" });
if (ve) { console.error("variants upsert error:", ve.message); process.exit(1); }

// report
const { count: pc } = await sb.from("products").select("*", { count: "exact", head: true });
const { count: vc } = await sb.from("product_variants").select("*", { count: "exact", head: true });
const totalStock = variants.reduce((s, v) => s + v.fba_stock, 0);
const totalInbound = variants.reduce((s, v) => s + v.inbound, 0);
console.log(`✅ seeded — products=${pc} variants=${vc} | FBA stock=${totalStock} inbound=${totalInbound}`);
