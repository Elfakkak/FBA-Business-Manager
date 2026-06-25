// Seed Phase 2 operational data: suppliers, partners, contacts, orders, invoices.
// Sample dataset (from the prototype) so directories show real derived rollups.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const suppliers = [
  { name: "Ningbo Auto Trim", origin: "Ningbo, CN", route: "via Mutual Trade Union" },
  { name: "Sheng Te Long", origin: "Ningbo, CN", route: "via Mutual Trade Union" },
  { name: "Huasheng Leather", origin: "Shenzhen, CN", route: "Direct supplier" },
  { name: "Shenzhen Wheel Co", origin: "Shenzhen, CN", route: "Direct supplier" },
  { name: "Fujian PU Goods", origin: "Yantian, CN", route: "Direct supplier" },
];

const partners = [
  { name: "Mutual Trade Union", type: "Agent", specialty: "Sourcing agent · Ningbo" },
  { name: "Yiwu Ocean Logistics", type: "Forwarder", specialty: "Sea LCL · China → US" },
  { name: "Flexport", type: "Forwarder", specialty: "Sea/Air freight" },
  { name: "DSV", type: "Forwarder", specialty: "Global freight" },
  { name: "QIMA", type: "Inspection", specialty: "AQL inspection · China" },
  { name: "Pacific Star", type: "Forwarder", specialty: "Sea freight" },
  { name: "DHL", type: "Forwarder", specialty: "Air express" },
];

const contacts = [
  { id: "ct-1", company: "Mutual Trade Union", name: "Lucy Chen", role: "Sales rep", wechat: "lucy_mtu", phone: "+86 138 0013 8000", email: "lucy@mutualtrade.cn", is_primary: true, note: "Main account manager" },
  { id: "ct-2", company: "Mutual Trade Union", name: "David Wu", role: "QC / inspection", wechat: "davidwu_qc", phone: "+86 139 2200 1188", email: "qc@mutualtrade.cn", is_primary: false, note: "Handles AQL checks" },
  { id: "ct-3", company: "Mutual Trade Union", name: "Coco Zhang", role: "Logistics", wechat: "coco_logi", phone: null, email: "ship@mutualtrade.cn", is_primary: false, note: "Booking + docs" },
];

const orders = [
  { id: "ORD-2026-05-006", title: "Q1 restock — Beaded seat covers", supplier: "Sheng Te Long", agent: "Mutual Trade Union", route: "via Mutual Trade Union", status: "production", placed_on: "2026-05-06", fba_eta: "2026-07-02" },
  { id: "ORD-2026-05-004", title: "Premium leather wraps — black/tan", supplier: "Huasheng Leather", agent: null, route: "Direct supplier", status: "inspection", placed_on: "2026-05-04", fba_eta: "2026-06-28" },
  { id: "ORD-2026-05-003", title: "Microfiber steering covers — 6 colors", supplier: "Ningbo Auto Trim", agent: "Mutual Trade Union", route: "via Mutual Trade Union", status: "production", placed_on: "2026-05-03", fba_eta: "2026-06-30" },
  { id: "ORD-2026-05-002", title: "Neoprene truck covers — XL series", supplier: "Fujian PU Goods", agent: null, route: "Direct supplier", status: "transit", placed_on: "2026-05-02", fba_eta: "2026-06-20" },
  { id: "ORD-2026-05-008", title: "Silicone grip covers — compact", supplier: "Shenzhen Wheel Co", agent: null, route: "Direct supplier", status: "production", placed_on: "2026-05-08", fba_eta: "2026-07-05" },
  { id: "ORD-2026-04-012", title: "Heated steering wheel kit — universal", supplier: "Ningbo Auto Trim", agent: "Mutual Trade Union", route: "via Mutual Trade Union", status: "fba", placed_on: "2026-04-12", fba_eta: "2026-06-01" },
  { id: "ORD-2026-05-009", title: "Velour dashboard covers — sedan", supplier: "Huasheng Leather", agent: null, route: "Direct supplier", status: "draft", placed_on: "2026-05-09", fba_eta: null },
];

const invoices = [
  { id: "PI-2605-NING-003", order_id: "ORD-2026-05-003", vendor: "Ningbo Auto Trim", vendor_type: "Supplier", issued: "2026-05-03", due: "2026-06-02", total: 18920, paid: 11352 },
  { id: "PI-2604-NING-014", order_id: "ORD-2026-04-012", vendor: "Ningbo Auto Trim", vendor_type: "Supplier", issued: "2026-04-12", due: "2026-05-12", total: 12000, paid: 12000 },
  { id: "PI-2605-MUTU-001", order_id: "ORD-2026-05-006", vendor: "Sheng Te Long", vendor_type: "Supplier", issued: "2026-05-06", due: "2026-06-05", total: 14445.77, paid: 8980.14 },
  { id: "AGT-2605-MUTU-002", order_id: "ORD-2026-05-006", vendor: "Mutual Trade Union", vendor_type: "Agent", issued: "2026-05-06", due: "2026-06-05", total: 670.04, paid: 0 },
  { id: "PI-2604-HUA-007", order_id: "ORD-2026-05-004", vendor: "Huasheng Leather", vendor_type: "Supplier", issued: "2026-05-04", due: "2026-06-03", total: 9280, paid: 6496 },
  { id: "PI-2605-SZW-008", order_id: "ORD-2026-05-008", vendor: "Shenzhen Wheel Co", vendor_type: "Supplier", issued: "2026-05-08", due: "2026-06-07", total: 3860, paid: 1158 },
  { id: "PI-2604-FUJ-002", order_id: "ORD-2026-05-002", vendor: "Fujian PU Goods", vendor_type: "Supplier", issued: "2026-05-02", due: "2026-06-01", total: 8000, paid: 8000 },
  { id: "FRT-YOL-2261", order_id: "ORD-2026-05-006", vendor: "Yiwu Ocean Logistics", vendor_type: "Forwarder", issued: "2026-05-10", due: "2026-06-09", total: 842, paid: 0 },
  { id: "FRT-FLX-7781", order_id: "ORD-2026-05-003", vendor: "Flexport", vendor_type: "Forwarder", issued: "2026-05-11", due: "2026-06-10", total: 3200, paid: 0 },
  { id: "FRT-DSV-3390", order_id: "ORD-2026-05-002", vendor: "DSV", vendor_type: "Forwarder", issued: "2026-05-09", due: "2026-06-08", total: 1310, paid: 0 },
  { id: "INSP-2605-QIMA", order_id: "ORD-2026-05-004", vendor: "QIMA", vendor_type: "Inspection", issued: "2026-05-20", due: "2026-06-19", total: 320, paid: 320 },
];

async function up(table, rows, conflict) {
  const { error } = await sb.from(table).upsert(rows, { onConflict: conflict });
  if (error) { console.error(`${table}:`, error.message); process.exit(1); }
  console.log(`✅ ${table}: ${rows.length}`);
}

await up("suppliers", suppliers, "name");
await up("partners", partners, "name");
await up("orders", orders, "id");          // FK supplier/agent now satisfied
await up("invoices", invoices, "id");
await up("contacts", contacts, "id");
console.log("done");
