// Supervised health check — run at the end of each phase/session.
// Verifies: Supabase connectivity, every table reachable + row counts,
// RLS enforcement (anon blocked / owner allowed), and the live deployment.
// Exit code 0 = all pass, 1 = at least one failure.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const PROD = "https://fba-business-manager-simos-projects-381039e7.vercel.app";
const OWNER = { email: "mr.elfakkak@gmail.com", password: "Vyonix2026!" };

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

const TABLES = [
  "users", "categories", "products", "product_variants", "product_tech_packs",
  "suppliers", "partners", "contacts", "orders", "order_payment_terms",
  "invoices", "invoice_payments", "shipments", "fba_inbounds", "shipment_tracking",
  "finance_accounts", "finance_entries", "bank_transactions", "categorization_rules",
  "recurring_items", "packaging_items", "packaging_moves", "supplies",
  "amazon_monthly", "amazon_product_perf", "fx_rates", "integrations",
  "brand", "business_profile", "notification_prefs", "asset_uploads",
];
const RLS_GUARDED = ["products", "product_variants", "orders", "invoices", "finance_entries", "suppliers", "partners"];
const ENDPOINTS = [
  ["/login", [200]], ["/", [307, 308]], ["/catalog", [307, 308]], ["/inventory", [307, 308]],
  ["/packaging", [307, 308]], ["/suppliers", [307, 308]], ["/partners", [307, 308]],
];

let failures = 0;
const mark = (ok) => (ok ? "✅" : (failures++, "❌"));

async function checkDatabase() {
  console.log("\n=== 1. DATABASE CONNECTIVITY + TABLES ===");
  let totalRows = 0;
  for (const t of TABLES) {
    const { count, error } = await svc.from(t).select("*", { count: "exact", head: true });
    if (error) { console.log(`  ${mark(false)} ${t.padEnd(22)} ERROR: ${error.message}`); continue; }
    totalRows += count ?? 0;
    console.log(`  ${mark(true)} ${t.padEnd(22)} ${count} rows`);
  }
  console.log(`  -> ${TABLES.length} tables reachable, ${totalRows} total rows`);
}

async function checkRls() {
  console.log("\n=== 2. RLS SECURITY (anonymous must read 0) ===");
  for (const t of RLS_GUARDED) {
    const { data } = await anon.from(t).select("*").limit(5);
    const n = data ? data.length : 0;
    console.log(`  ${mark(n === 0)} anon ${t.padEnd(20)} ${n} rows (expect 0)`);
  }
  const { error: w } = await anon.from("products").insert({ id: "__hc", parent: "x", category: "x", brand: "x" });
  console.log(`  ${mark(!!w)} anon write blocked (${w ? "blocked" : "NOT blocked"})`);
}

async function checkOwner() {
  console.log("\n=== 3. AUTH + OWNER ACCESS ===");
  const { data: s, error } = await anon.auth.signInWithPassword(OWNER);
  console.log(`  ${mark(!error)} owner sign-in (${error ? error.message : s.user.email})`);
  if (!error) {
    const { data } = anon.from ? await anon.from("products").select("id").limit(50) : { data: [] };
    console.log(`  ${mark((data?.length ?? 0) > 0)} owner reads products (${data?.length ?? 0} rows)`);
  }
}

async function checkDeploy() {
  console.log("\n=== 4. LIVE DEPLOYMENT (responsiveness) ===");
  for (const [pathName, okCodes] of ENDPOINTS) {
    try {
      const res = await fetch(PROD + pathName, { redirect: "manual", signal: AbortSignal.timeout(15000) });
      const ok = okCodes.includes(res.status);
      console.log(`  ${mark(ok)} ${pathName.padEnd(14)} HTTP ${res.status} (expect ${okCodes.join("/")})`);
    } catch (e) {
      console.log(`  ${mark(false)} ${pathName.padEnd(14)} fetch error: ${e.message}`);
    }
  }
}

console.log("SUPERVISED CHECK —", env.NEXT_PUBLIC_SUPABASE_URL);
await checkDatabase();
await checkRls();
await checkOwner();
await checkDeploy();
console.log(`\n=== RESULT: ${failures === 0 ? "✅ ALL PASS" : `❌ ${failures} FAILURE(S)`} ===`);
process.exit(failures === 0 ? 0 : 1);
