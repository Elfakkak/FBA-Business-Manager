// Payables dataset — every vendor invoice across ALL orders (the portfolio
// accounts-payable view). The order-level Invoices section is the per-order
// detail; this is the cross-order roll-up that answers "what do I owe, to whom,
// and by when?" — a question a single order can't answer, because bills are
// paid by DUE DATE, not by order.
//
// Each invoice links back to its order. Money math (balance/status/aging) is
// derived so KPIs, the overdue banner, and the aging buckets stay consistent.

// Fixed "today" so aging is stable in the prototype (current date: May 31, 2026).
const PAY_TODAY = new Date("2026-05-31T00:00:00");

const PAY_INVOICES = [
  { id: "PI-2605-MUTU-001", orderId: "ORD-2026-05-006", orderTitle: "Q1 restock — Beaded seat covers", vendor: "Mutual Trade Union", vendorType: "Supplier", issued: "2026-05-05", due: "2026-06-05", total: 14445.77, paid: 8980.14 },
  { id: "AGT-2605-MUTU-002", orderId: "ORD-2026-05-006", orderTitle: "Q1 restock — Beaded seat covers", vendor: "Mutual Trade Union", vendorType: "Agent", issued: "2026-05-08", due: "2026-05-25", total: 670.04, paid: 0 },
  { id: "FRT-YOL-2261", orderId: "ORD-2026-05-006", orderTitle: "Q1 restock — Beaded seat covers", vendor: "Yiwu Ocean Logistics", vendorType: "Forwarder", issued: "2026-05-20", due: "2026-06-20", total: 842.00, paid: 0 },
  { id: "PI-2604-HUA-007", orderId: "ORD-2026-05-004", orderTitle: "Premium leather wraps — black/tan", vendor: "Huasheng Leather", vendorType: "Supplier", issued: "2026-04-28", due: "2026-05-22", total: 9280.00, paid: 6496.00 },
  { id: "INSP-2605-QIMA", orderId: "ORD-2026-05-004", orderTitle: "Premium leather wraps — black/tan", vendor: "QIMA", vendorType: "Inspection", issued: "2026-05-04", due: "2026-05-10", total: 320.00, paid: 320.00 },
  { id: "PI-2605-NING-003", orderId: "ORD-2026-05-003", orderTitle: "Microfiber steering covers — 6 colors", vendor: "Ningbo Auto Trim", vendorType: "Supplier", issued: "2026-04-20", due: "2026-05-28", total: 18920.00, paid: 11352.00 },
  { id: "FRT-FLX-7781", orderId: "ORD-2026-05-003", orderTitle: "Microfiber steering covers — 6 colors", vendor: "Flexport", vendorType: "Forwarder", issued: "2026-05-18", due: "2026-06-12", total: 3200.00, paid: 0 },
  { id: "PI-2604-FUJ-002", orderId: "ORD-2026-05-002", orderTitle: "Neoprene truck covers — XL series", vendor: "Fujian PU Goods", vendorType: "Supplier", issued: "2026-04-15", due: "2026-04-30", total: 7240.00, paid: 7240.00 },
  { id: "FRT-DSV-3390", orderId: "ORD-2026-05-002", orderTitle: "Neoprene truck covers — XL series", vendor: "DSV", vendorType: "Forwarder", issued: "2026-05-22", due: "2026-06-08", total: 1310.00, paid: 0 },
  { id: "PI-2604-NING-014", orderId: "ORD-2026-04-012", orderTitle: "Heated steering wheel kit — universal", vendor: "Ningbo Auto Trim", vendorType: "Supplier", issued: "2026-03-30", due: "2026-04-15", total: 6480.00, paid: 6480.00 },
  { id: "PI-2605-SZW-008", orderId: "ORD-2026-05-008", orderTitle: "Silicone grip covers — compact", vendor: "Shenzhen Wheel Co", vendorType: "Supplier", issued: "2026-05-10", due: "2026-06-18", total: 3860.00, paid: 1158.00 },
];

// ----- applied payments (two-way link: Review inbox / payments mark a bill
// paid). Persisted override on top of the seed `paid` so PAY_INVOICES stays
// static. payEffectivePaid = seed paid + applied; balance/status derive from it.
const PAY_APPLIED_KEY = "vy_payables_applied_v1";
function payAppliedMap() {
  try { return JSON.parse(localStorage.getItem(PAY_APPLIED_KEY) || "{}") || {}; } catch (e) { return {}; }
}
function payApplyPayment(invId, amount) {
  const m = payAppliedMap();
  m[invId] = (Number(m[invId]) || 0) + (Number(amount) || 0);
  try { localStorage.setItem(PAY_APPLIED_KEY, JSON.stringify(m)); } catch (e) {}
  return m[invId];
}
function payResetApplied() { try { localStorage.removeItem(PAY_APPLIED_KEY); } catch (e) {} }

// ======================================================================
// SINGLE SOURCE OF TRUTH for per-invoice payments + proof + terms.
// Both the Order Shell Invoices section (VyInvoicesBody) and the standalone
// Invoice page (invoice-app.jsx) read/write THIS exact store + record shape,
// so a payment (and its proof) logged in one place shows in the other. No more
// duplicate stores. Keyed: { [orderId]: [ invoiceRecord, ... ] }.
// ----------------------------------------------------------------------
const INV_STORE_KEY = "vy_invoices_v1";

// Curated rich detail, keyed by invoice id (was duplicated in invoices-app.jsx).
// Supplier invoices carry per-SKU GOODS lines (linked to the order's Production
// SKUs) so the bill itemizes what was actually billed per SKU, and we can
// reconcile billed vs ordered. `ordered` = the order's Production goods line.
const PAY_DETAIL = {
  "PI-2605-MUTU-001": {
    goodsSkus: [
      { sku: "SEMI-BSC-1P-BLK", name: "Beaded seat cover · 1pc · Black", qty: 450, billed: 3864.09, ordered: 3755.51 },
      { sku: "SEMI-BSC-2P-BLK", name: "Beaded seat cover · 2pc · Black", qty: 350, billed: 2886.27, ordered: 2805.15 },
      { sku: "CAR-BSC-1P-BLK", name: "Beaded seat cover · 1pc · Carbon", qty: 450, billed: 3864.10, ordered: 3755.51 },
      { sku: "CAR-BSC-2P-BLK", name: "Beaded seat cover · 2pc · Carbon", qty: 350, billed: 2886.27, ordered: 2805.15 },
    ],
    lines: [
      { label: "Agent service fee 5%", type: "Service charge", amount: 670.04 },
      { label: "Cartons export packaging", type: "Service charge", amount: 375.0 },
      { label: "Supplier credit", type: "Discount", amount: -100.0 },
    ],
    payments: [
      { id: "MERC-1104", date: "Nov 04", amount: 2680.14, method: "Mercury", status: "Cleared", proof: true },
      { id: "MERC-1211", date: "Dec 11", amount: 4300.0, method: "Mercury", status: "Cleared", proof: true },
      { id: "MERC-1222", date: "Dec 22", amount: 2000.0, method: "Mercury", status: "Cleared", proof: false },
    ],
  },
};
const PAY_VIA_BY = { Supplier: "Supplier · Goods", Agent: "Agent · Service", Forwarder: "Freight", Inspection: "Service · Inspection" };
const PAY_FILE_BY = { Forwarder: "Freight invoice", Inspection: "Service invoice" };

// CHARGE-TYPE CATALOG — controlled vocabulary for non-product (service) charges,
// the source of truth for services the way SKUs are for goods. Each type is
// owned by the operational step it belongs to. A service line references a
// `chargeType` id; only the amount is invoice-owned. `other` allows a custom label.
const PAY_CHARGE_TYPES = [
  { id: "packaging", label: "Export packaging & handling", owner: "Supplier" },
  { id: "tooling", label: "Tooling / mold cost", owner: "Supplier" },
  { id: "agent_fee", label: "Agent service fee", owner: "Agent" },
  { id: "freight", label: "International freight", owner: "Forwarder" },
  { id: "docs", label: "Documentation & telex release", owner: "Forwarder" },
  { id: "inspection", label: "Pre-shipment inspection", owner: "Inspection" },
  { id: "duty", label: "Duties & taxes", owner: "Broker" },
  { id: "brokerage", label: "Customs brokerage fee", owner: "Broker" },
  { id: "discount", label: "Supplier credit / discount", owner: "Supplier" },
  { id: "other", label: "Other charge", owner: "—" },
];
function payChargeType(id) { return chgLoadTypes().find((c) => c.id === id) || PAY_CHARGE_TYPES.find((c) => c.id === id) || null; }
// Active (non-archived) charge types — the live dropdown vocabulary.
function payChargeTypes() { return chgLoadTypes().filter((c) => !c.archived); }

// ---- MANAGED CHARGE-TYPE STORE (the services source-of-truth) -------------
// PAY_CHARGE_TYPES is the seed; once the user adds/renames/archives a type the
// whole list is persisted here and becomes authoritative. This is to services
// what the product Catalog is to goods.
const CHG_STORE_KEY = "vy_charge_types_v1";
function chgLoadTypes() {
  try { const r = JSON.parse(localStorage.getItem(CHG_STORE_KEY) || "null"); if (Array.isArray(r) && r.length) return r; } catch (e) {}
  return PAY_CHARGE_TYPES.map((c) => ({ ...c }));
}
function chgSaveTypes(list) { try { localStorage.setItem(CHG_STORE_KEY, JSON.stringify(list)); } catch (e) {} return list; }
function chgResetTypes() { try { localStorage.removeItem(CHG_STORE_KEY); } catch (e) {} }
function chgSlug(label) {
  const base = String(label || "charge").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "charge";
  const have = chgLoadTypes().map((c) => c.id);
  let id = base, n = 2; while (have.includes(id)) { id = base + "_" + n; n++; }
  return id;
}
function chgAddType(fields) {
  const t = { id: chgSlug(fields.label), label: fields.label || "New charge", owner: fields.owner || "—", desc: fields.desc || "", custom: true };
  chgSaveTypes([...chgLoadTypes(), t]);
  return t;
}
function chgUpdateType(id, patch) { const list = chgLoadTypes().map((c) => (c.id === id ? { ...c, ...patch } : c)); chgSaveTypes(list); return list; }
function chgArchiveType(id, archived) { return chgUpdateType(id, { archived: !!archived }); }
// Spend rolled up per charge type across EVERY invoice in the portfolio — the
// payoff of a structured vocabulary: "how much did we spend on X?" Goods lines
// are excluded; each service line maps via its stored chargeType or by label.
function chgSpendByType() {
  const map = {};
  for (const t of chgLoadTypes()) map[t.id] = { id: t.id, label: t.label, owner: t.owner, archived: !!t.archived, custom: !!t.custom, total: 0, count: 0, orders: {} };
  function bucket(id, amount, orderId) {
    if (!map[id]) { const ct = payChargeType(id); map[id] = { id, label: ct ? ct.label : id, owner: ct ? ct.owner : "—", archived: false, custom: false, total: 0, count: 0, orders: {} }; }
    map[id].total = payRound(map[id].total + (Number(amount) || 0));
    map[id].count += 1;
    if (orderId) map[id].orders[orderId] = true;
  }
  for (const inv of PAY_INVOICES) {
    let lines = [];
    try { lines = payInvoiceLines(inv); } catch (e) { lines = []; }
    for (const l of lines) {
      if (l.sku || l.type === "Product lines") continue;
      const id = l.chargeType || payChargeTypeForLabel(l.label, l.type);
      bucket(id, l.amount, inv.orderId);
    }
  }
  return Object.values(map).map((m) => ({ ...m, orderCount: Object.keys(m.orders).length }));
}
// Best-effort: map an existing free-text service label to a catalog charge type.
function payChargeTypeForLabel(label, type) {
  const s = (label || "").toLowerCase();
  if (/packag|handling|carton/.test(s)) return "packaging";
  if (/tool|mold|mould/.test(s)) return "tooling";
  if (/agent/.test(s)) return "agent_fee";
  if (/freight|ocean|sea|air/.test(s)) return "freight";
  if (/doc|telex|b\/l|bill of lading/.test(s)) return "docs";
  if (/inspect|qc|aql/.test(s)) return "inspection";
  if (/dut(y|ies)|tax|tariff/.test(s)) return "duty";
  if (/broker|clearance|customs/.test(s)) return "brokerage";
  if (/credit|discount|rebate/.test(s) || (type === "Discount")) return "discount";
  return "other";
}

function payRound(n) { return Math.round(n * 100) / 100; }

// Charge lines derived from vendorType when no curated detail exists.
function payDeriveLines(p) {
  const t = p.total;
  switch (p.vendorType) {
    case "Supplier": { const goods = payRound(t * 0.95); return [{ label: p.orderTitle + " — goods", type: "Product lines", amount: goods }, { label: "Export packaging & handling", type: "Service charge", amount: payRound(t - goods) }]; }
    case "Agent": return [{ label: "Agent service fee", type: "Service charge", amount: t }];
    case "Forwarder": { const fr = payRound(t * 0.88); return [{ label: "International freight", type: "Freight", amount: fr }, { label: "Documentation & telex release", type: "Service charge", amount: payRound(t - fr) }]; }
    case "Inspection": return [{ label: "Pre-shipment inspection (AQL II)", type: "Service", amount: t }];
    default: return [{ label: p.orderTitle, type: "Charge", amount: t }];
  }
}

// ---- Supplier-invoice GOODS lines, linked to the order's Production SKUs ----
// Resolve the order's SKUs: curated detail → live order scope (when the page has
// it) → null. Each SKU carries qty + `ordered` (the Production goods line).
function paySkusForOrder(orderId) {
  const scope = (typeof window !== "undefined" && window.VY_ORDER_SCOPE) || null;
  if (scope && scope.id === orderId && Array.isArray(scope.skus)) {
    return scope.skus.map((s) => ({ sku: s.sku, name: s.name, qty: s.qty, ordered: payRound(s.line || (s.unitUsd || 0) * (s.qty || 0)) }));
  }
  return null;
}
// Per-SKU goods lines for a supplier invoice (curated billed amounts when known,
// else billed = ordered). Returns null for non-supplier invoices / no SKU data.
function paySupplierGoods(inv) {
  if (inv.vendorType !== "Supplier") return null;
  const stored = (typeof payStoredInvoice === "function") ? payStoredInvoice(inv) : null;
  if (stored && Array.isArray(stored.goodsSkus) && stored.goodsSkus.length) return stored.goodsSkus.map((g) => ({ ...g, billed: g.billed != null ? g.billed : g.ordered }));
  if (Array.isArray(inv.goodsSkus) && inv.goodsSkus.length) return inv.goodsSkus.map((g) => ({ ...g }));
  const d = PAY_DETAIL[inv.id];
  if (d && Array.isArray(d.goodsSkus)) return d.goodsSkus.map((g) => ({ ...g, billed: g.billed != null ? g.billed : g.ordered }));
  const skus = paySkusForOrder(inv.orderId);
  if (skus) return skus.map((s) => ({ ...s, billed: s.ordered }));
  return null;
}
// Candidate SKUs to itemize goods against (Production scope → curated detail).
// Used by the Edit-charges modal's "Add SKU" picker.
function payOrderSkuOptions(inv) {
  const scope = paySkusForOrder(inv.orderId);
  if (scope && scope.length) return scope;
  const d = PAY_DETAIL[inv.id];
  if (d && Array.isArray(d.goodsSkus)) return d.goodsSkus.map((g) => ({ sku: g.sku, name: g.name, qty: g.qty, ordered: g.ordered }));
  return [];
}

// Reconcile what the supplier BILLED for goods vs what was ORDERED in Production.
function payGoodsReconcile(inv) {
  const goods = paySupplierGoods(inv);
  if (!goods) return null;
  const billed = payRound(goods.reduce((n, g) => n + (Number(g.billed) || 0), 0));
  const ordered = payRound(goods.reduce((n, g) => n + (Number(g.ordered) || 0), 0));
  const diff = payRound(billed - ordered);
  const status = Math.abs(diff) < 0.01 ? "match" : diff > 0 ? "over" : "under";
  return { billed, ordered, diff, status, perSku: goods };
}

// Canonical line items for a rendered invoice: lead with fresh per-SKU GOODS
// lines (so SKUs always show, even over a stale stored record), then service
// charges (curated → stored non-goods → derived). Non-supplier bills fall back
// to stored lines → synthesized. This is what BOTH views should render.
function payInvoiceLines(inv) {
  const goods = paySupplierGoods(inv);
  if (goods && goods.length) {
    const goodsLines = goods.map((g) => ({ label: g.name, sku: g.sku, qty: g.qty, type: "Product lines", amount: payRound(g.billed != null ? g.billed : g.ordered) }));
    const detail = PAY_DETAIL[inv.id];
    let rest;
    if (detail && Array.isArray(detail.lines)) rest = detail.lines.map((l) => ({ ...l }));
    else {
      const stored = payStoredInvoice(inv);
      const src = (stored && Array.isArray(stored.lines)) ? stored.lines : payDeriveLines(inv);
      rest = src.filter((l) => !l.sku && l.type !== "Product lines");
    }
    return [...goodsLines, ...rest];
  }
  const stored = payStoredInvoice(inv);
  if (stored && Array.isArray(stored.lines) && stored.lines.length) return stored.lines.map((l) => ({ ...l }));
  return payLines(inv);
}

// Seed payment records for an invoice: curated → else one record from `paid`.
function paySeedPayments(p) {
  const d = PAY_DETAIL[p.id];
  if (d) return d.payments.map((x) => ({ ...x }));
  if ((Number(p.paid) || 0) > 0.005) {
    return [{ id: "MERC-" + String(p.id).replace(/[^0-9]/g, "").slice(-4), date: payDueLabel(p.issued), amount: payRound(p.paid), method: "Mercury", status: "Cleared", proof: true }];
  }
  return [];
}

// Seed PAYMENT TERMS per invoice, by vendor relationship (not per order). Each
// vendor type carries the term a China-import seller actually meets.
function paySeedTerms(p) {
  if (p.vendorType === "Supplier") {
    const dep = (window.PAYTERM_SEED && window.PAYTERM_SEED[p.orderId] && window.PAYTERM_SEED[p.orderId].depositPct);
    return { type: "TT", depositPct: (dep == null ? 30 : dep), netDays: 0 };
  }
  if (p.vendorType === "Forwarder") return { type: "OA", depositPct: 0, netDays: 15 };
  if (p.vendorType === "Agent") return { type: "TT", depositPct: 0, netDays: 0 };
  if (p.vendorType === "Inspection") return { type: "OA", depositPct: 0, netDays: 7 };
  return { type: "TT", depositPct: 30, netDays: 0 };
}

// Canonical invoice record (the shape the Invoices section persists & renders).
function payBuildInvoiceRecord(p) {
  const detail = PAY_DETAIL[p.id];
  const goodsSkus = detail && Array.isArray(detail.goodsSkus) ? detail.goodsSkus.map((g) => ({ ...g })) : null;
  // Per-SKU goods lines lead the line-items for supplier invoices, then services.
  const goodsLines = goodsSkus ? goodsSkus.map((g) => ({ label: g.name, sku: g.sku, qty: g.qty, type: "Product lines", amount: payRound(g.billed != null ? g.billed : g.ordered) })) : [];
  const restLines = detail ? detail.lines.map((l) => ({ ...l })) : payDeriveLines(p);
  return {
    id: p.id, vendor: p.vendor, vendorType: p.vendorType, orderId: p.orderId, orderTitle: p.orderTitle,
    via: PAY_VIA_BY[p.vendorType] || p.vendorType, kind: "Payable",
    file: { name: p.id + ".pdf", label: PAY_FILE_BY[p.vendorType] || "Invoice PDF" },
    total: p.total, due: payDueLabel(p.due),
    goodsSkus: goodsSkus,
    lines: [...goodsLines, ...restLines],
    payments: paySeedPayments(p),
    terms: paySeedTerms(p),
  };
}
function payBuildOrderInvoices(orderId) { return PAY_INVOICES.filter((p) => p.orderId === orderId).map(payBuildInvoiceRecord); }

function payStoreLoad() {
  try { const o = JSON.parse(localStorage.getItem(INV_STORE_KEY) || "{}"); return o && typeof o === "object" ? o : {}; }
  catch (e) { return {}; }
}
function payStoreSaveOrder(orderId, list) {
  const all = payStoreLoad(); all[orderId] = list;
  try { localStorage.setItem(INV_STORE_KEY, JSON.stringify(all)); } catch (e) {}
}
// Replay a saved order snapshot, appending any seed invoices added since.
function payOrderInitial(orderId) {
  const seed = payBuildOrderInvoices(orderId);
  const saved = payStoreLoad()[orderId];
  if (!Array.isArray(saved)) return seed;
  const ids = new Set(saved.map((i) => i.id));
  return [...saved, ...seed.filter((s) => !ids.has(s.id))];
}
// The persisted record for one invoice (raw PAY_INVOICES entry passed in).
function payStoredInvoice(inv) {
  const list = payStoreLoad()[inv.orderId];
  if (Array.isArray(list)) { const r = list.find((i) => i.id === inv.id); if (r) return r; }
  return null;
}
// SINGLE source of payment records for an invoice: stored working set → seed.
function payInvoicePayments(inv) {
  const rec = payStoredInvoice(inv);
  if (rec && Array.isArray(rec.payments)) return rec.payments;
  return paySeedPayments(inv);
}
function payClearedPaid(inv) { return payInvoicePayments(inv).filter((p) => p.status === "Cleared").reduce((n, p) => n + (Number(p.amount) || 0), 0); }
function payProofMissing(inv) { return payInvoicePayments(inv).filter((p) => p.status === "Cleared" && !p.proof).length; }

// Append a real payment record (carrying its proof) to the shared store,
// seeding the order's whole list the first time it's touched so the section and
// the page agree from the very first write.
function payLogPayment(inv, record) {
  const all = payStoreLoad();
  let list = Array.isArray(all[inv.orderId]) ? all[inv.orderId] : payBuildOrderInvoices(inv.orderId);
  let rec = list.find((i) => i.id === inv.id);
  if (!rec) { rec = payBuildInvoiceRecord(inv); list = [...list, rec]; }
  rec.payments = [...(rec.payments || []), record];
  all[inv.orderId] = list;
  try { localStorage.setItem(INV_STORE_KEY, JSON.stringify(all)); } catch (e) {}
  return rec;
}

// Patch one payment record in place (e.g. attach/replace its proof of payment),
// materializing the order's seed into the store first if untouched.
function payUpdatePayment(inv, idx, patch) {
  const all = payStoreLoad();
  let list = Array.isArray(all[inv.orderId]) ? all[inv.orderId] : payBuildOrderInvoices(inv.orderId);
  let rec = list.find((i) => i.id === inv.id);
  if (!rec) { rec = payBuildInvoiceRecord(inv); list = [...list, rec]; }
  const pays = Array.isArray(rec.payments) ? rec.payments.slice() : paySeedPayments(inv);
  if (pays[idx]) pays[idx] = { ...pays[idx], ...patch };
  rec.payments = pays;
  all[inv.orderId] = list;
  try { localStorage.setItem(INV_STORE_KEY, JSON.stringify(all)); } catch (e) {}
  return rec;
}

// Patch an invoice's editable identity fields (vendor / type / total / due),
// shared so an edit on the standalone page shows in the order's section too.
function paySaveInvoiceFields(inv, patch) {
  const all = payStoreLoad();
  let list = Array.isArray(all[inv.orderId]) ? all[inv.orderId] : payBuildOrderInvoices(inv.orderId);
  let rec = list.find((i) => i.id === inv.id);
  if (!rec) { rec = payBuildInvoiceRecord(inv); list = [...list, rec]; }
  Object.assign(rec, patch);
  all[inv.orderId] = list;
  try { localStorage.setItem(INV_STORE_KEY, JSON.stringify(all)); } catch (e) {}
  return rec;
}

// Persist EDITED charges: per-SKU goods (each {sku,name,qty,ordered,billed}) +
// service lines ([{label,type,amount}]). Rebuilds the rendered `lines` (goods
// lead, then services) so both views show the itemized bill. Shared store.
function paySaveInvoiceCharges(inv, goodsSkus, serviceLines) {
  const all = payStoreLoad();
  let list = Array.isArray(all[inv.orderId]) ? all[inv.orderId] : payBuildOrderInvoices(inv.orderId);
  let rec = list.find((i) => i.id === inv.id);
  if (!rec) { rec = payBuildInvoiceRecord(inv); list = [...list, rec]; }
  const goods = (goodsSkus || []).map((g) => ({ sku: g.sku, name: g.name, qty: Number(g.qty) || 0, ordered: payRound(Number(g.ordered) || 0), billed: payRound(Number(g.billed) || 0) }));
  const services = (serviceLines || []).map((l) => ({ chargeType: l.chargeType || null, label: l.label, type: l.type || "Service charge", amount: payRound(Number(l.amount) || 0) }));
  const goodsLines = goods.map((g) => ({ label: g.name, sku: g.sku, qty: g.qty, type: "Product lines", amount: g.billed }));
  rec.goodsSkus = goods.length ? goods : null;
  rec.lines = [...goodsLines, ...services];
  all[inv.orderId] = list;
  try { localStorage.setItem(INV_STORE_KEY, JSON.stringify(all)); } catch (e) {}
  return rec;
}
function payInvoiceTerms(inv) {
  const rec = payStoredInvoice(inv);
  if (rec && rec.terms && rec.terms.type) return rec.terms;
  return paySeedTerms(inv);
}
function paySaveInvoiceTerms(inv, cfg) {
  const all = payStoreLoad();
  let list = Array.isArray(all[inv.orderId]) ? all[inv.orderId] : payBuildOrderInvoices(inv.orderId);
  let rec = list.find((i) => i.id === inv.id);
  if (!rec) { rec = payBuildInvoiceRecord(inv); list = [...list, rec]; }
  rec.terms = cfg;
  all[inv.orderId] = list;
  try { localStorage.setItem(INV_STORE_KEY, JSON.stringify(all)); } catch (e) {}
  return cfg;
}

// Effective paid: stored working set is authoritative once an order is touched;
// otherwise the seed `paid` plus any Review-inbox applied amount.
function payEffectivePaid(inv) {
  const rec = payStoredInvoice(inv);
  if (rec && Array.isArray(rec.payments)) return rec.payments.filter((p) => p.status === "Cleared").reduce((n, p) => n + (Number(p.amount) || 0), 0);
  return (Number(inv.paid) || 0) + (Number(payAppliedMap()[inv.id]) || 0);
}

// ----- derivations -----
function payBalance(inv) { return Math.max(0, inv.total - payEffectivePaid(inv)); }

function payStatus(inv) {
  if (payBalance(inv) <= 0.005) return "Paid";
  if (payEffectivePaid(inv) > 0) return "Partial";
  return "Unpaid";
}

// Days until due (negative = overdue). Aging label only matters while a balance
// is outstanding; settled invoices are "Settled".
function payAging(inv) {
  const due = new Date(inv.due + "T00:00:00");
  const days = Math.round((due - PAY_TODAY) / 86400000);
  if (payBalance(inv) <= 0.005) return { days: isNaN(days) ? 0 : days, label: "Settled", tone: "success" };
  if (isNaN(days)) return { days: 0, label: "Upcoming", tone: "muted" };
  if (days < 0) return { days, label: "Overdue", tone: "danger" };
  if (days <= 7) return { days, label: "Due soon", tone: "warning" };
  return { days, label: "Upcoming", tone: "muted" };
}

function payFmt(n) {
  const neg = n < 0;
  const s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (neg ? "-$" : "$") + s;
}

// "2026-06-05" -> "Jun 5"; passes through already-formatted labels (e.g. "Jun 8").
function payDueLabel(iso) {
  if (!iso) return "—";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return String(iso);
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const PAY_STATUS_TONE = { Paid: "success", Partial: "warning", Unpaid: "danger" };
const PAY_VENDOR_TYPES = ["Supplier", "Forwarder", "Agent", "Inspection"];

// Derived line items for the invoice drawer (the AP dataset stores totals only,
// so lines are synthesized from vendorType — honest, drawer-only detail).
function payLines(inv) {
  const t = inv.total;
  if (inv.vendorType === "Supplier") {
    return [
      { label: inv.vendor + " — goods", type: "Product", amount: Math.round(t * 0.94 * 100) / 100 },
      { label: "Tooling / packaging", type: "Charge", amount: Math.round(t * 0.06 * 100) / 100 },
    ];
  }
  const map = { Forwarder: "Freight & customs", Agent: "Agent / trading fee", Inspection: "Inspection service" };
  return [{ label: map[inv.vendorType] || "Charge", type: inv.vendorType, amount: t }];
}

// Derived payment history from paid amount (1–2 synthetic records).
function payPayments(inv) {
  if (inv.paid <= 0.005) return [];
  const issued = new Date(inv.issued + "T00:00:00");
  const d1 = new Date(issued.getTime() + 3 * 86400000);
  const lbl = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  // If partially paid, one payment = deposit; if fully paid, deposit + balance.
  if (payBalance(inv) <= 0.005 && inv.paid > inv.total * 0.5) {
    const dep = Math.round(inv.total * 0.3 * 100) / 100;
    const bal = Math.round((inv.paid - dep) * 100) / 100;
    const d2 = new Date(issued.getTime() + 20 * 86400000);
    return [
      { date: lbl(d1), amount: dep, method: "Mercury", status: "Cleared", proof: true },
      { date: lbl(d2), amount: bal, method: "Mercury", status: "Cleared", proof: false },
    ];
  }
  return [{ date: lbl(d1), amount: inv.paid, method: "Mercury", status: "Cleared", proof: true }];
}

// Payment TERMS + schedule (page-level detail; drawer shows totals only).
// Supplier PIs are split deposit/balance (the standard import term); service
// bills (freight/agent/inspection) are a single payment due on the due date.
// Each installment is reconciled against the effective paid amount so the
// schedule shows what's actually settled vs still due.
function payTerms(inv) {
  if (inv.vendorType === "Supplier") return { label: "30% deposit / 70% balance", installments: [{ key: "deposit", label: "Deposit", pct: 0.3 }, { key: "balance", label: "Balance before ship", pct: 0.7 }] };
  return { label: "Net — due on date", installments: [{ key: "full", label: "Full payment", pct: 1 }] };
}
function paySchedule(inv) {
  const terms = payTerms(inv);
  const issued = new Date(inv.issued + "T00:00:00");
  let paidLeft = payEffectivePaid(inv);
  return terms.installments.map((inst, i) => {
    const amount = Math.round(inv.total * inst.pct * 100) / 100;
    // Deposit is due at issue; later installments at the invoice due date.
    const dueIso = terms.installments.length > 1 && i === 0
      ? new Date(issued.getTime() + 3 * 86400000).toISOString().slice(0, 10)
      : inv.due;
    const applied = Math.min(amount, Math.max(0, paidLeft));
    paidLeft -= applied;
    const state = applied >= amount - 0.005 ? "Paid" : applied > 0.005 ? "Partial" : "Due";
    return { ...inst, amount, dueIso, applied, state };
  });
}
// Running-balance payment ledger (page view) — built from the REAL shared
// payment records (stored working set → seed), not a synthetic reconstruction.
function payLedger(inv) {
  let running = inv.total;
  return payInvoicePayments(inv).map((p) => { running = Math.round((running - (Number(p.amount) || 0)) * 100) / 100; return { ...p, balanceAfter: Math.max(0, running) }; });
}

Object.assign(window, {
  PAY_TODAY, PAY_INVOICES, PAY_STATUS_TONE, PAY_VENDOR_TYPES,
  payBalance, payStatus, payAging, payFmt, payDueLabel, payLines, payPayments,
  payTerms, paySchedule, payLedger,
  PAY_APPLIED_KEY, payApplyPayment, payResetApplied, payEffectivePaid, payAppliedMap,
  // shared single-source store (payments + proof + terms)
  INV_STORE_KEY, PAY_DETAIL, payBuildInvoiceRecord, payBuildOrderInvoices,
  payStoreLoad, payStoreSaveOrder, payOrderInitial, payStoredInvoice,
  payInvoicePayments, payClearedPaid, payProofMissing, payLogPayment,
  payInvoiceTerms, paySaveInvoiceTerms, paySeedTerms, paySeedPayments, payDeriveLines,
  payUpdatePayment, paySaveInvoiceFields,
  paySkusForOrder, paySupplierGoods, payGoodsReconcile, payInvoiceLines,
  paySaveInvoiceCharges, payOrderSkuOptions,
  PAY_CHARGE_TYPES, payChargeType, payChargeTypes, payChargeTypeForLabel,
  chgLoadTypes, chgSaveTypes, chgResetTypes, chgAddType, chgUpdateType, chgArchiveType, chgSpendByType,
});
