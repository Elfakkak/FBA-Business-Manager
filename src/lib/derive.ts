// Derived calculations — ported from the prototype *-data.jsx modules.
// PRINCIPLE: these are computed at read time, never stored.
import type { Database } from "@/lib/database.types";

export type Variant = Database["public"]["Tables"]["product_variants"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type PackagingItem = Database["public"]["Tables"]["packaging_items"]["Row"];
export type PackagingMove = Database["public"]["Tables"]["packaging_moves"]["Row"];

export const CAT_LOW_STOCK = 40;
export const INV_SAFETY_DAYS = 14;
export const INV_FCS = ["ONT8", "LGB8", "MDW2", "ATL6"];

// Reorder suggestion: cover lead time + ~45 days, round to 25, floor 50.
export function reorderQty(velocity: number, leadTimeDays: number, available: number, inbound: number) {
  const target = Math.ceil(velocity * (leadTimeDays + 45));
  const have = available + inbound;
  return Math.max(50, Math.ceil(Math.max(0, target - have) / 25) * 25);
}

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
  // real reserved from Amazon when present; fall back to a velocity estimate
  const reserved = v.reserved != null ? v.reserved : Math.min(onHand, Math.round(velocity * 2));
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

// ---------- Amazon details (pulled per SKU; stored in product_variants.amazon_meta) ----------
export type AmazonMeta = {
  dims_in?: { l: number | null; w: number | null; h: number | null } | null;
  weight_lb?: number | null;
  fbaFee?: number | null;
  referralFee?: number | null;
  currency?: string | null;
};

// Amazon US FBA size tiers, classified from package dimensions (inches) + weight (lb).
export function amazonSizeTier(l?: number | null, w?: number | null, h?: number | null, weightLb?: number | null): { tier: string; tone: Tone } {
  const dims = [l, w, h].filter((x): x is number => typeof x === "number" && x > 0).sort((a, b) => b - a);
  if (dims.length < 3) return { tier: "Unknown", tone: "muted" };
  const wt = weightLb ?? 0;
  const [longest, median, shortest] = dims;
  if (longest <= 15 && median <= 12 && shortest <= 0.75 && wt <= 1) return { tier: "Small standard", tone: "success" };
  if (longest <= 18 && median <= 14 && shortest <= 8 && wt <= 20) return { tier: "Large standard", tone: "info" };
  const girth = 2 * (median + shortest);
  if (longest <= 59 && median <= 33 && longest + girth <= 130 && wt <= 50) return { tier: "Large bulky", tone: "warning" };
  return { tier: "Extra-large", tone: "danger" };
}

// ---------- true profitability per SKU (price − COGS − referral − FBA − ad) ----------
// Uses the real FBA fee from amazon_meta when present, real ad spend (30d) for ACoS/TACoS,
// and velocity to spread ad cost per unit. All derived at read time.
export function skuProfit(v: Variant, amazonFee: number | null) {
  const price = v.sale_price ?? 0;
  const cogs = v.last_cost_usd ?? 0;
  const referral = price * FBA_REFERRAL_DEFAULT;
  const fba = amazonFee ?? 0;
  const adSpend = v.ad_spend_30d ?? 0;
  const adSales = v.ad_sales_30d ?? 0;
  const units30 = (v.velocity ?? 0) * 30;
  const sales30 = price * units30;
  const adPerUnit = units30 > 0 ? adSpend / units30 : 0;
  const net = price > 0 ? price - cogs - referral - fba - adPerUnit : null;
  const marginPct = price > 0 && net != null ? Math.round((net / price) * 100) : null;
  const acos = adSales > 0 ? adSpend / adSales : null;       // ad cost / ad-attributed sales
  const tacos = sales30 > 0 ? adSpend / sales30 : null;      // ad cost / total sales
  return { price, cogs, referral, fba, adSpend, adSales, units30, sales30, adPerUnit, net, marginPct, acos, tacos };
}

// ---------- supplier / partner rollups (derived, not stored) ----------
export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
export type ShipmentRow = Database["public"]["Tables"]["shipments"]["Row"];

// Freight shipment stage pipeline (factory → FC) — Amazon takes over at "At FBA".
export const SHIPMENT_STAGES = ["Draft", "Booked", "Picked up", "In transit", "Customs", "Delivered", "At FBA"] as const;
export const SHIPMENT_STAGE_TONE: Record<string, Tone> = {
  Draft: "muted", Booked: "info", "Picked up": "info", "In transit": "info",
  Customs: "warning", Delivered: "success", "At FBA": "success",
};
export const CUSTOMS_TONE: Record<string, Tone> = {
  Cleared: "success", "In clearance": "info", Pending: "warning", "Docs missing": "danger",
};
export const SHIPMENT_CUSTOMS = ["Cleared", "In clearance", "Pending", "Docs missing"] as const;

// Incoterm → who clears customs + pays import duties (the importer's key question).
export function incotermInfo(term: string | null): { customsBy: string; dutiesBy: string; needsBroker: boolean; tone: Tone; blurb: string } {
  const t = (term || "").toUpperCase();
  const map: Record<string, { customsBy: string; dutiesBy: string; needsBroker: boolean; tone: Tone; blurb: string }> = {
    DDP: { customsBy: "Seller / forwarder", dutiesBy: "Seller / forwarder", needsBroker: false, tone: "success", blurb: "Delivered Duty Paid — the seller/forwarder clears customs and pays all duties & taxes. Nothing more for you at the border; it's baked into the freight price." },
    DAP: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Delivered At Place — the forwarder delivers, but YOU are importer of record: you clear customs and pay duties & taxes on arrival. Line up a customs broker." },
    CIF: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Cost, Insurance & Freight — seller covers freight to the destination port; you handle import customs, duties and final delivery. Broker needed." },
    CFR: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Cost & Freight — seller pays freight to the port; you handle import customs + duties. Broker needed." },
    FOB: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Free On Board — your responsibility starts at the origin port: ocean freight, import customs and duties are yours. Broker needed." },
    FCA: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Free Carrier — seller hands off to your carrier at origin; import customs and duties are yours." },
    EXW: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "danger", blurb: "Ex Works — you handle everything from the factory door: export + import customs, freight and all duties. Broker needed." },
  };
  return map[t] || { customsBy: "—", dutiesBy: "—", needsBroker: true, tone: "muted", blurb: "Set the incoterm to see who clears customs and pays import duties." };
}
// shipments whose cargo is moving (left origin) — for "shipped/on-water" rollups
export const SHIPMENT_MOVING = ["Picked up", "In transit", "Customs", "Delivered", "At FBA"];

const isClosed = (status: string) => /closed|fba/i.test(status);
const unpaid = (inv: InvoiceRow) => Math.max(0, (inv.total ?? 0) - (inv.paid ?? 0));

export function supplierRollup(name: string, orders: OrderRow[], invoices: InvoiceRow[], products: Product[]) {
  const myOrders = orders.filter((o) => o.supplier === name);
  const myOrderIds = new Set(myOrders.map((o) => o.id));
  const myProducts = products.filter((p) => p.supplier === name);
  const openBalance = invoices
    .filter((i) => i.order_id && myOrderIds.has(i.order_id) && (i.vendor_type === "Supplier" || i.vendor_type === "Agent"))
    .reduce((s, i) => s + unpaid(i), 0);
  return {
    productCount: myProducts.length,
    orderCount: myOrders.length,
    openOrders: myOrders.filter((o) => !isClosed(o.status)).length,
    openBalance,
  };
}

// Exact "via {name}" or agent match — avoids substring false positives
// (e.g. a partner "Air" matching route "Airfreight").
export function partnerMatchesOrder(o: OrderRow, name: string) {
  return o.agent === name || (o.route ?? "").toLowerCase() === `via ${name}`.toLowerCase();
}

export function partnerRollup(name: string, type: string, orders: OrderRow[], invoices: InvoiceRow[]) {
  const myBills = invoices.filter((i) => i.vendor === name && i.vendor_type === type);
  const billOrderIds = new Set(myBills.map((i) => i.order_id).filter(Boolean) as string[]);
  const routeOrderIds = orders.filter((o) => partnerMatchesOrder(o, name)).map((o) => o.id);
  const orderIds = new Set([...billOrderIds, ...routeOrderIds]);
  return {
    orderCount: orderIds.size,
    invoiceCount: myBills.length,
    openBalance: myBills.reduce((s, i) => s + unpaid(i), 0),
  };
}

// FBA inbound "Shipment events" pipeline (Amazon custody leg) — shared by the FBA list
// drawer and the FBA detail page so the timeline logic lives in one place.
export const FBA_EVENTS = [
  { key: "created", label: "Shipment created" },
  { key: "intransit", label: "In transit" },
  { key: "delivered", label: "Delivered to FC" },
  { key: "checkedin", label: "Checked in" },
  { key: "received", label: "Received" },
  { key: "closed", label: "Shipment closed" },
] as const;
export function fbaDoneIdx(status: string, received: number): number {
  if (status === "Closed") return 5;
  if (received > 0) return 4;
  if (status === "Receiving") return 3;
  if (status === "Shipped" || status === "In transit") return 1;
  return 0; // Working
}

// ---------- Invoices / accounts payable ----------
export const INVOICE_STATUS_TONE: Record<string, Tone> = { Paid: "success", Partial: "warning", Unpaid: "danger" };
export const PAY_STATUS_TONE: Record<string, Tone> = { Cleared: "success", Scheduled: "info", Pending: "warning" };
// half-cent tolerance so float rounding doesn't leave an invoice "1¢ unpaid"
export const BALANCE_EPSILON = 0.005;
export function invoiceBalance(i: Pick<InvoiceRow, "total" | "paid">) { return Math.max(0, (i.total ?? 0) - (i.paid ?? 0)); }
export function invoiceStatus(i: Pick<InvoiceRow, "total" | "paid">): "Paid" | "Partial" | "Unpaid" {
  if (invoiceBalance(i) <= BALANCE_EPSILON) return "Paid";
  if ((i.paid ?? 0) > 0) return "Partial";
  return "Unpaid";
}
export function invoiceAging(dueISO: string | null, balance: number, nowMs: number): { days: number; label: "Settled" | "Overdue" | "Due soon" | "Upcoming"; tone: Tone } {
  if (balance <= BALANCE_EPSILON) return { days: 0, label: "Settled", tone: "success" };
  if (!dueISO) return { days: 0, label: "Upcoming", tone: "muted" };
  const days = Math.round((new Date(dueISO + "T00:00:00").getTime() - nowMs) / 86_400_000);
  if (days < 0) return { days, label: "Overdue", tone: "danger" };
  if (days <= 7) return { days, label: "Due soon", tone: "warning" };
  return { days, label: "Upcoming", tone: "muted" };
}

// Vendor type derived from the vendor's own record: suppliers are always
// "Supplier"; a partner's role is inferred from its free-text specialty.
export type VendorType = "Supplier" | "Forwarder" | "Agent" | "Inspection";
export function partnerVendorType(specialty: string | null | undefined): VendorType {
  const s = (specialty || "").toLowerCase();
  if (/agent|sourc/.test(s)) return "Agent";
  if (/inspec|\baql\b|quality/.test(s)) return "Inspection";
  return "Forwarder"; // freight / forwarding / express / logistics / sea / air
}

// ---------- Invoice lines / charges (V2 itemization) ----------
export type InvoiceLineRow = Database["public"]["Tables"]["invoice_lines"]["Row"];
export type InvoiceLineKind = "goods" | "service" | "discount";
export const INVOICE_LINE_KIND_LABEL: Record<string, string> = { goods: "Product lines", service: "Service charge", discount: "Discount" };
// Sort lines for display: goods first (by position), then services, then discounts.
const LINE_KIND_ORDER: Record<string, number> = { goods: 0, service: 1, discount: 2 };
export function sortInvoiceLines<T extends Pick<InvoiceLineRow, "kind" | "position">>(lines: T[]): T[] {
  return [...lines].sort((a, b) => (LINE_KIND_ORDER[a.kind] ?? 1) - (LINE_KIND_ORDER[b.kind] ?? 1) || (a.position ?? 0) - (b.position ?? 0));
}
// Roll up itemized lines: goods (per-SKU) vs services vs discounts, plus
// billed-vs-ordered variance for goods (when lines link back to order_lines).
export function invoiceLinesRollup(lines: InvoiceLineRow[]) {
  const num = (v: number | null) => Number(v) || 0;
  const goods = lines.filter((l) => l.kind === "goods");
  const services = lines.filter((l) => l.kind === "service");
  const discounts = lines.filter((l) => l.kind === "discount");
  const sum = (a: InvoiceLineRow[]) => a.reduce((s, l) => s + num(l.billed), 0);
  const goodsBilled = sum(goods);
  // Variance compares only order-linked goods (a manual line has no ordered
  // counterpart, so it must not inflate the billed-vs-ordered gap).
  const orderLinked = goods.filter((l) => l.ordered_amount != null);
  const goodsOrdered = orderLinked.reduce((s, l) => s + num(l.ordered_amount), 0);
  const orderedGoodsBilled = orderLinked.reduce((s, l) => s + num(l.billed), 0);
  const servicesBilled = sum(services);
  const discountsBilled = sum(discounts); // negative
  const itemized = goodsBilled + servicesBilled + discountsBilled;
  return {
    goods, services, discounts,
    goodsBilled, goodsOrdered, orderedGoodsBilled, servicesBilled, discountsBilled, itemized,
    variance: orderedGoodsBilled - goodsOrdered, // + = billed over the order
    hasOrdered: orderLinked.length > 0,
    count: lines.length,
  };
}

// ---------- Production scope & cost (V2 Production page) ----------
export type OrderCostRow = Database["public"]["Tables"]["order_costs"]["Row"];
export const PROD_SECTIONS = ["Production", "Shipping", "Inspection"] as const;
export const PROD_LINE_TYPES = ["Agent fee", "Cartons", "Inland freight", "Inspection fee", "Packaging", "Tooling", "Duties", "Other"] as const;
export const PROD_BASES = ["value", "units"] as const;

type ProdLine = { id: string; sku: string | null; product_name: string | null; family_id?: string | null; qty: number; unit_cost: number | null; unit_cny_ref?: number | null };
type ProdCost = Pick<OrderCostRow, "amount" | "basis" | "treatment">;

// All calculation amounts are USD. RMB (¥) is reference-only and never feeds math.
export function costUsd(c: { amount: number | null }): number {
  return Number(c.amount) || 0;
}

// Per-SKU landed-cost estimate: spread the INVENTORIABLE non-product cost pool
// (period expenses stay out of COGS) over the goods lines by each cost's basis
// (per-unit or by line value), then landed = (line + allocated)/qty. Costs are
// normalized to USD. Duties are out of scope here, so it's an estimate ("est").
export function productionLanded(lines: ProdLine[], costs: ProdCost[]) {
  const num = (v: number | null | undefined) => Number(v) || 0;
  const inv = costs.filter((c) => c.treatment !== "period");
  const totalUnits = lines.reduce((s, l) => s + num(l.qty), 0);
  const totalGoods = lines.reduce((s, l) => s + num(l.qty) * num(l.unit_cost), 0);
  const costPool = inv.reduce((s, c) => s + costUsd(c), 0);
  const withLanded = lines.map((l) => {
    const qty = num(l.qty);
    const line = qty * num(l.unit_cost);
    let alloc = 0;
    for (const c of inv) {
      const amt = costUsd(c);
      // value-basis falls back to per-unit when goods aren't priced yet, so the
      // cost still lands somewhere instead of silently vanishing.
      if (c.basis === "units" || totalGoods <= 0) alloc += totalUnits ? (amt * qty) / totalUnits : 0;
      else alloc += (amt * line) / totalGoods;
    }
    return { ...l, line, landedUnit: qty ? (line + alloc) / qty : 0 };
  });
  return { totalUnits, totalGoods, costPool, totalLanded: totalGoods + costPool, withLanded };
}

// ---------- Structured supplier payment terms (T/T · L/C · O/A · D/P · D/A) ----------
export type PayTermType = "TT" | "LC" | "OA" | "DP" | "DA";
export type PayTermCfg = { type: PayTermType; depositPct?: number | null; netDays?: number | null };
export const PAYTERM_TYPES: { key: PayTermType; label: string; name: string; blurb: string; hasDeposit: boolean }[] = [
  { key: "TT", label: "T/T", name: "Telegraphic Transfer (bank wire)", blurb: "A direct bank wire, normally split into a deposit to start production and a balance before the goods ship. The most common term for China factories — fast, but unsecured, so trust matters.", hasDeposit: true },
  { key: "LC", label: "L/C", name: "Letter of Credit", blurb: "Your bank guarantees payment to the supplier once they present shipping documents that match the L/C exactly. Safest for large or first-time orders, but slower and carries bank fees.", hasDeposit: true },
  { key: "OA", label: "O/A", name: "Open Account", blurb: "You receive the goods first and pay later — net 30/60/90 days after shipment. Best cash flow for you; only offered by suppliers who already trust you.", hasDeposit: false },
  { key: "DP", label: "D/P", name: "Documents against Payment", blurb: "The bank releases the shipping documents (which you need to collect the goods) only after you pay. Often a deposit to start production, then the balance to release the documents.", hasDeposit: true },
  { key: "DA", label: "D/A", name: "Documents against Acceptance", blurb: "You get the documents by accepting (signing) a draft to pay on a future date. Often a deposit up front, then the balance payable at draft maturity.", hasDeposit: true },
];
export const PAYTERM_BY_KEY: Record<string, (typeof PAYTERM_TYPES)[number]> = Object.fromEntries(PAYTERM_TYPES.map((t) => [t.key, t]));
export const PAYTERM_TT_PRESETS = [30, 50, 0, 100];

export type PayScheduleStep = { label: string; when: string; pct: number; amount: number; paidAmt: number; settled: boolean; partial: boolean };
// Given a term config + supplier-invoice total & paid-to-date, produce ordered milestones
// (deposit first, then balance) with paid/partial/settled status. Mirrors the prototype.
export function payTermSchedule(cfg: PayTermCfg | null | undefined, total: number, paid: number): PayScheduleStep[] {
  total = Number(total) || 0;
  paid = Number(paid) || 0;
  const type = cfg?.type ?? "TT";
  const dep = Math.max(0, Math.min(100, Number(cfg?.depositPct) || 0));
  // Each term's trigger for the balance / single full payment.
  const balWhen: Record<string, string> = {
    TT: "Before goods ship",
    DP: "To release shipping documents",
    DA: "Payable at draft maturity",
    LC: "On compliant document presentation",
  };
  const fullLabel: Record<string, string> = { TT: "Full payment", DP: "Full payment", DA: "Accepted draft", LC: "L/C settlement" };
  let steps: { label: string; when: string; pct: number; amount: number }[] = [];
  if (type === "OA") {
    const nd = Number(cfg?.netDays) || 30;
    steps = [{ label: "Full payment", when: `Net ${nd} days after shipment`, pct: 100, amount: total }];
  } else if (dep >= 100) {
    steps = [{ label: "Full payment", when: "Upfront, before production", pct: 100, amount: total }];
  } else if (dep > 0) {
    // Deposit to start production, then the balance on the term's trigger — works for T/T, D/P, D/A, L/C.
    steps = [
      { label: "Deposit", when: "To start production", pct: dep, amount: Math.round(total * dep) / 100 },
      { label: "Balance", when: balWhen[type] ?? "Before goods ship", pct: 100 - dep, amount: Math.round(total * (100 - dep)) / 100 },
    ];
  } else {
    steps = [{ label: fullLabel[type] ?? "Full payment", when: balWhen[type] ?? "Before goods ship", pct: 100, amount: total }];
  }
  let remaining = paid;
  return steps.map((s) => {
    const covered = Math.min(s.amount, Math.max(0, remaining));
    remaining -= covered;
    const settled = covered >= s.amount - 0.005 && s.amount > 0;
    return { ...s, paidAmt: covered, settled, partial: covered > 0.005 && !settled };
  });
}
export function payTermSummary(cfg: PayTermCfg | null | undefined): string {
  const t = PAYTERM_BY_KEY[cfg?.type ?? "TT"];
  if (!t) return "—";
  if (t.key === "OA") return `O/A · net ${Number(cfg?.netDays) || 30}`;
  const d = Number(cfg?.depositPct) || 0;
  if (t.hasDeposit && d >= 100) return `${t.label} · 100% upfront`;
  if (t.hasDeposit && d > 0) return `${t.label} · ${d} / ${100 - d}`;
  return `${t.label} · ${t.name}`;
}

// Derived "needs attention" / next-actions for an order — shared by the order Home
// page and the orders-list peek drawer so both surface the same guidance.
export type OrderNeed = { key: string; headline: string; detail: string; section: string; sectionLabel: string; severity: Tone };
export function orderNeeds(o: { status: string; balance: number; paidPct: number; units: number; supplier?: string | null }): OrderNeed[] {
  const needs: OrderNeed[] = [];
  if (o.status === "production") needs.push({ key: "prod", headline: "Confirm supplier receipt", detail: `In production · ${o.supplier ?? "supplier"} · ${o.units.toLocaleString()} units`, section: "production", sectionLabel: "Production", severity: "info" });
  if (o.status === "inspection") needs.push({ key: "insp", headline: "Schedule pre-shipment inspection", detail: "AQL check before the order ships", section: "inspection", sectionLabel: "Inspection", severity: "warning" });
  if (o.status === "transit") needs.push({ key: "ship", headline: "Track inbound shipment", detail: "Monitor the freight leg to the FC", section: "shipping", sectionLabel: "Shipping", severity: "info" });
  if (o.balance > 0.5) needs.push({ key: "bal", headline: "Balance due before shipment release", detail: `${money(o.balance)} outstanding · ${o.paidPct}% paid`, section: "invoices", sectionLabel: "Invoices", severity: "warning" });
  if (o.status === "fba") needs.push({ key: "land", headline: "Reconcile landed cost", detail: "Close out duties, freight and fees", section: "landed", sectionLabel: "Landed cost", severity: "info" });
  return needs;
}

// Order money rollup — total/paid/balance derived from its invoices.
export function orderRollup(orderId: string, invoices: InvoiceRow[]) {
  const mine = invoices.filter((i) => i.order_id === orderId);
  const total = mine.reduce((s, i) => s + (i.total ?? 0), 0);
  const paid = mine.reduce((s, i) => s + (i.paid ?? 0), 0);
  const balance = Math.max(0, total - paid);
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;
  return { total, paid, balance, paidPct, invoiceCount: mine.length };
}

// Pipeline order for the status stepper.
export const ORDER_PIPELINE: { key: string; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "production", label: "Production" },
  { key: "inspection", label: "Inspection" },
  { key: "transit", label: "In transit" },
  { key: "fba", label: "At FBA" },
  { key: "closed", label: "Closed" },
];

export const PARTNER_TYPE_TONE: Record<string, Tone> = {
  Agent: "info",
  Forwarder: "brand",
  Inspection: "warning",
};

export const ORDER_STATUS_TONE: Record<string, Tone> = {
  draft: "muted",
  production: "info",
  inspection: "warning",
  transit: "info",
  fba: "success",
  closed: "success",
};
export const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  production: "In production",
  inspection: "Inspection",
  transit: "In transit",
  fba: "At FBA",
  closed: "Closed",
};

// ---------- unit economics (Amazon FBA, estimated) ----------
export const FBA_REFERRAL_DEFAULT = 0.15;

export function estFbaFee(weightLb: number) {
  const w = weightLb > 0 ? weightLb : 0.5;
  if (w <= 0.75) return 3.49;   // small standard
  if (w <= 1) return 4.2;
  if (w <= 2) return 5.4;       // large standard
  return 5.4 + (w - 2) * 0.4;
}

export function familyWeightLb(p: Product) {
  if (p.weight_lbs) return p.weight_lbs;
  if (p.weight_kg) return Math.round(p.weight_kg * 2.205 * 100) / 100;
  return 0;
}

export function variantEco(v: Variant, weightLb: number) {
  const cogs = v.last_cost_usd ?? 0;
  const price = v.sale_price && v.sale_price > 0 ? v.sale_price : cogs > 0 ? Math.round(cogs * 3 * 100) / 100 : 0;
  const referral = price * FBA_REFERRAL_DEFAULT;
  const fba = price > 0 ? estFbaFee(weightLb) : 0;
  const net = price - cogs - referral - fba;
  const marginPct = price > 0 ? Math.round((net / price) * 100) : null;
  return { cogs, price, referral, fba, net, marginPct };
}

export function familyEco(variants: Variant[], weightLb: number) {
  const ecos = variants.map((v) => variantEco(v, weightLb));
  const priced = ecos.filter((e) => e.marginPct != null);
  const avgMargin = priced.length ? Math.round(priced.reduce((s, e) => s + (e.marginPct ?? 0), 0) / priced.length) : null;
  const costs = variants.map((v) => v.last_cost_usd).filter((c): c is number => c != null);
  const avgCogs = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null;
  const avgFba = estFbaFee(weightLb);
  return { avgMargin, avgCogs, avgFba, pricedCount: priced.length, total: variants.length };
}

// ---------- dual-unit conversions + Amazon size compliance + storage ----------
const CM_PER_IN = 2.54, LB_PER_KG = 2.20462;
export const inFromCm = (cm: number) => Math.round((cm / CM_PER_IN) * 10) / 10;
export const cmFromIn = (i: number) => Math.round(i * CM_PER_IN * 10) / 10;
export const lbFromKg = (kg: number) => Math.round(kg * LB_PER_KG * 100) / 100;
export const kgFromLb = (lb: number) => Math.round((lb / LB_PER_KG) * 100) / 100;

export type Dim = { l?: number | null; w?: number | null; h?: number | null } | null;

export function sizeCompliance(dimCm: Dim, weightKg: number | null) {
  const lb = weightKg ? lbFromKg(weightKg) : 0;
  const hasDims = !!(dimCm && (dimCm.l || dimCm.w || dimCm.h));
  let level: "standard" | "oversize" | "over-max" = "standard";
  if (hasDims) {
    const ins = [dimCm!.l ?? 0, dimCm!.w ?? 0, dimCm!.h ?? 0].map(inFromCm).sort((a, b) => b - a);
    const [a, b, c] = ins;
    const girth = a + 2 * (b + c);
    if (a > 108 || girth > 165 || lb > 150) level = "over-max";
    else if (a > 18 || b > 14 || c > 8 || lb > 20) level = "oversize";
    const stdOk = a <= 18 && b <= 14 && c <= 8 && lb <= 20;
    const awdOk = a <= 25 && lb <= 50;
    return compliance(level, stdOk, awdOk);
  }
  if (lb > 150) level = "over-max"; else if (lb > 20) level = "oversize";
  return compliance(level, lb <= 20, lb <= 50);
}
function compliance(level: "standard" | "oversize" | "over-max", stdOk: boolean, awdOk: boolean) {
  const map = {
    standard: { tone: "success" as Tone, label: "Within Amazon standard size", detail: "Inside the standard-size limit — lowest FBA fees." },
    oversize: { tone: "danger" as Tone, label: "Over standard — oversize", detail: "Past the standard-size limit, so it ships at higher oversize fees." },
    "over-max": { tone: "danger" as Tone, label: "Exceeds Amazon maximum", detail: "Over Amazon's absolute limit (108in longest · 165in length+girth · 150lb)." },
  };
  return { level, stdOk, awdOk, ...map[level] };
}

export function storagePerUnit(dimCm: Dim, months: number, peak: boolean) {
  if (!dimCm || !(dimCm.l && dimCm.w && dimCm.h)) return 0;
  const cuFt = (inFromCm(dimCm.l) * inFromCm(dimCm.w) * inFromCm(dimCm.h)) / 1728;
  const rate = peak ? 2.4 : 0.78;
  return Math.round(cuFt * rate * months * 100) / 100;
}

export function marginTone(marginPct: number | null): Tone {
  if (marginPct == null) return "muted";
  if (marginPct <= 0) return "danger";
  if (marginPct < 20) return "warning";
  return "success";
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
