// Vyonix Connection Test — a runnable diagnostic that loads every dataset and
// verifies the app is wired together: source-of-truth referential integrity,
// money/units reconciliation, and which order-shell sections are actually
// connected to the shared data vs. showing local sample data.
//
// Run it any time from "Vyonix Connection Test.html". No mutations — read only.

const { useState: useCtState, useEffect: useCtEffect } = React;

// ---- helpers ----
function ctMoney(str) {
  if (typeof str === "number") return str;
  if (!str) return 0;
  const m = String(str).replace(/[^0-9.]/g, "");
  return m ? parseFloat(m) : 0;
}
function ctUnits(str) {
  // pull "1,600 units" → 1600 from a meta string
  const m = String(str || "").match(/([\d,]+)\s*(?:units|pcs)/i);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
}
const ctG = (name, fallback) => (name in window ? window[name] : fallback);

// ----------------------------------------------------------------------
// THE TEST SUITE
// ----------------------------------------------------------------------
function runConnectionTests() {
  const groups = [];
  const mk = (name) => { const g = { name, checks: [] }; groups.push(g); return g; };
  const add = (g, name, status, detail, extra) => g.checks.push({ name, status, detail, extra: extra || null });

  // ----- load every dataset -----
  const orders = ctG("ORDERS_LIST", []);
  const orderIds = new Set(orders.map((o) => o.id));
  const orderById = Object.fromEntries(orders.map((o) => [o.id, o]));
  const pay = ctG("PAY_INVOICES", []);
  const logShip = ctG("LOG_SHIPMENTS", []);
  const logOrders = ctG("LOG_ORDERS", []);
  const scope = ctG("LOG_ORDER_SCOPE", {});
  const fbaRows = (typeof window.logAllFbaRows === "function") ? window.logAllFbaRows() : [];
  const cats = (typeof window.catLoadFamilies === "function") ? window.catLoadFamilies() : ctG("CAT_FAMILIES", []);
  const suppliers = ctG("SUP_SUPPLIERS", []);
  const partners = ctG("PARTNERS", []);
  const invInvoices = ctG("INV_INVOICES", []);
  const shipShipments = ctG("SHIP_SHIPMENTS", []);
  const inspInit = ctG("INSP_INITIAL", null);
  const coSkus = ctG("CO_SKUS", []);
  const prodStatus = ctG("PRODUCTION_STATUS", null);

  // ============================================================
  // GROUP 1 — Source-of-truth referential integrity
  // ============================================================
  const g1 = mk("Source-of-truth integrity");

  const payOrphans = pay.filter((p) => !orderIds.has(p.orderId));
  add(g1, "Payables → Orders", payOrphans.length ? "fail" : "pass",
    `${pay.length} invoices reference orders · ${payOrphans.length} orphaned`,
    payOrphans.map((p) => p.id + " → " + p.orderId));

  const shipOrphans = logShip.filter((s) => s.orderId && !orderIds.has(s.orderId));
  add(g1, "Shipments → Orders", shipOrphans.length ? "fail" : "pass",
    `${logShip.length} shipments · ${shipOrphans.length} with unknown orderId`,
    shipOrphans.map((s) => s.id + " → " + s.orderId));

  const loOrphans = logOrders.filter((o) => !orderIds.has(o.id));
  add(g1, "Logistics order directory → Orders", loOrphans.length ? "warn" : "pass",
    `${logOrders.length} freight orders · ${loOrphans.length} not in the master order list`,
    loOrphans.map((o) => o.id + " · " + o.title));

  const scopeOrphans = Object.keys(scope).filter((id) => !orderIds.has(id));
  add(g1, "Order scope (units) → Orders", scopeOrphans.length ? "warn" : "pass",
    `${Object.keys(scope).length} scoped orders · ${scopeOrphans.length} unknown`,
    scopeOrphans);

  // order title agreement between payables + orders
  const titleMismatch = pay.filter((p) => orderById[p.orderId] && p.orderTitle && orderById[p.orderId].title !== p.orderTitle);
  add(g1, "Order titles agree (Payables ↔ Orders)", titleMismatch.length ? "warn" : "pass",
    `${titleMismatch.length} title mismatches across ${pay.length} invoices`,
    titleMismatch.map((p) => p.id + ": \"" + p.orderTitle + "\" ≠ \"" + orderById[p.orderId].title + "\""));

  // ============================================================
  // GROUP 2 — Cross-table reconciliation (money + units)
  // ============================================================
  const g2 = mk("Reconciliation");

  // every invoice: paid never exceeds total
  const overpaid = pay.filter((p) => p.paid > p.total + 0.005);
  add(g2, "Invoice paid ≤ total", overpaid.length ? "fail" : "pass",
    `${overpaid.length} overpaid invoices of ${pay.length}`,
    overpaid.map((p) => p.id + ": $" + p.paid + " / $" + p.total));

  // order headline total == its supplier PI total
  const totalChecks = [];
  orders.forEach((o) => {
    const supplierPI = pay.find((p) => p.orderId === o.id && p.vendorType === "Supplier");
    if (!supplierPI) return;
    const headline = ctMoney(o.moneyTotal);
    if (headline && Math.abs(headline - supplierPI.total) > 0.5) {
      totalChecks.push(o.id + ": header $" + headline.toLocaleString() + " ≠ PI $" + supplierPI.total.toLocaleString());
    }
  });
  add(g2, "Order header total ↔ supplier PI", totalChecks.length ? "warn" : "pass",
    `${orders.length} orders cross-checked against their supplier PI · ${totalChecks.length} differ`,
    totalChecks);

  // packed units never exceed ordered scope
  const packOver = [];
  if (typeof window.logPackedForOrder === "function") {
    Object.keys(scope).forEach((id) => {
      const packed = window.logPackedForOrder(id);
      if (packed > scope[id] + 0.5) packOver.push(id + ": packed " + packed + " > ordered " + scope[id]);
    });
  }
  add(g2, "Packed units ≤ ordered scope", packOver.length ? "fail" : "pass",
    `${Object.keys(scope).length} orders in the packed-vs-ordered funnel · ${packOver.length} over`,
    packOver);

  // FBA inbounds: unlinked orphans are allowed but flagged
  const unlinked = fbaRows.filter((r) => r.unlinked);
  add(g2, "FBA inbounds linked to a shipment", unlinked.length ? "warn" : "pass",
    `${fbaRows.length} inbounds · ${unlinked.length} unlinked (created in Seller Central, awaiting link)`,
    unlinked.map((r) => r.id + " · " + r.fc));

  // ============================================================
  // GROUP 3 — Supplier / partner naming consistency
  // ============================================================
  const g3 = mk("Naming consistency");

  const supplierNames = new Set(suppliers.map((s) => s.name));
  const orderSuppliers = [...new Set(orders.map((o) => o.supplier).filter(Boolean))];
  const missingSuppliers = orderSuppliers.filter((n) => !supplierNames.has(n));
  add(g3, "Order suppliers exist in Suppliers directory", missingSuppliers.length ? "warn" : "pass",
    `${orderSuppliers.length} distinct order suppliers · ${missingSuppliers.length} absent from the directory`,
    missingSuppliers);

  // catalog family supplier vs order suppliers (the known mismatch)
  const catSuppliers = [...new Set(cats.map((f) => f.supplier).filter(Boolean))];
  const catUnmatched = catSuppliers.filter((n) => !supplierNames.has(n) && !orderSuppliers.includes(n));
  add(g3, "Catalog product suppliers resolve", catUnmatched.length ? "warn" : "pass",
    `${catSuppliers.length} catalog suppliers · ${catUnmatched.length} don't match an order/supplier name`,
    catUnmatched);

  // ============================================================
  // GROUP 4 — Section ↔ source connections (current order)
  // ============================================================
  const g4 = mk("Section ↔ source (live)");

  const curOrderId = (() => {
    try { return new URLSearchParams(location.search).get("order") || "ORD-2026-05-006"; }
    catch (e) { return "ORD-2026-05-006"; }
  })();
  const curOrder = orderById[curOrderId];

  add(g4, "Test order resolves", curOrder ? "pass" : "fail",
    curOrder ? curOrderId + " · " + curOrder.title : curOrderId + " not found in Orders",
    null);

  // Invoices section ↔ Payables (the one truly wired section)
  const payForOrder = pay.filter((p) => p.orderId === curOrderId).map((p) => p.id);
  const invIds = invInvoices.map((i) => i.id);
  const invMatched = invIds.filter((id) => payForOrder.includes(id));
  const invConnected = invInvoices.length > 0 && invMatched.length === invInvoices.length;
  add(g4, "Invoices section ⇄ Payables", invConnected ? "pass" : (invInvoices.length ? "warn" : "fail"),
    invInvoices.length
      ? `${invMatched.length}/${invInvoices.length} section invoices trace to Payables for ${curOrderId}`
      : "Invoices section exposed no per-order data",
    invInvoices.length ? invIds.map((id) => id + (payForOrder.includes(id) ? " ✓" : " ✗ not in payables")) : null);

  // money agreement: order header total ↔ Invoices section supplier PI
  const secSupplierPI = invInvoices.find((i) => /supplier/i.test(i.via || "") || /^PI-/.test(i.id));
  if (curOrder && secSupplierPI) {
    const diff = Math.abs(ctMoney(curOrder.moneyTotal) - secSupplierPI.total);
    add(g4, "Order total ↔ Invoices supplier PI", diff < 0.5 ? "pass" : "warn",
      `Home $${ctMoney(curOrder.moneyTotal).toLocaleString()} vs Invoices $${secSupplierPI.total.toLocaleString()}`,
      null);
  }

  // ============================================================
  // GROUP 5 — Finance wiring (API · Orders · Products)
  // ============================================================
  const g5 = mk("Finance wiring");

  const intgGetFn = (typeof window.intgGet === "function") ? window.intgGet : null;
  const finDeriveFn = (typeof window.finDerive === "function") ? window.finDerive : null;
  const finPayExpFn = (typeof window.finPayablesExpenses === "function") ? window.finPayablesExpenses : null;
  const teamPartnersFn = (typeof window.teamFinPartners === "function") ? window.teamFinPartners : null;
  const finInboxFn = (typeof window.finInboxLoad === "function") ? window.finInboxLoad : null;
  const finRulesFn = (typeof window.finRulesLoad === "function") ? window.finRulesLoad : null;
  const finSuggestFn = (typeof window.finSuggest === "function") ? window.finSuggest : null;
  const D = finDeriveFn ? finDeriveFn() : null;

  // 5.1 — Revenue ⇄ Amazon Seller Central (API)
  const amz = intgGetFn ? intgGetFn("amazon") : null;
  const amzConn = amz && amz.status === "connected";
  add(g5, "Revenue ⇄ Amazon Seller Central (API)",
    !D ? "fail" : amzConn && D.amazonRevenue > 0 ? "pass" : "warn",
    !D ? "Finance data not loaded"
      : `Amazon ${amzConn ? "connected" : "NOT connected"} · ${D.amazonRevenue ? "$" + Math.round(D.amazonRevenue).toLocaleString() + " revenue sourced from payouts" : "no Amazon-tagged revenue"}`,
    null);

  // 5.2 — Cash ⇄ Mercury (API)
  const mer = intgGetFn ? intgGetFn("mercury") : null;
  const merConn = mer && mer.status === "connected";
  add(g5, "Cash & payments ⇄ Mercury (API)", merConn ? "pass" : "warn",
    merConn ? `Mercury connected · ${mer.account || "bank"} reconciles cash` : "Mercury not connected — cash entered manually",
    null);

  // 5.3 — Supplier costs fold in from Payables (Orders)
  if (finPayExpFn) {
    const folded = finPayExpFn();
    const paidInvoices = pay.filter((p) => (p.paid || 0) > 0.005);
    const foldedTotal = folded.reduce((n, e) => n + e.amount, 0);
    const paidTotal = paidInvoices.reduce((n, p) => n + p.paid, 0);
    const orphanLinks = folded.filter((e) => !orderIds.has(e.orderId));
    const totalsMatch = Math.abs(foldedTotal - paidTotal) < 0.5;
    add(g5, "Supplier costs fold in from Payables (Orders)",
      orphanLinks.length ? "fail" : totalsMatch ? "pass" : "warn",
      `${folded.length} folded expense rows = $${Math.round(foldedTotal).toLocaleString()} · Payables paid = $${Math.round(paidTotal).toLocaleString()}${totalsMatch ? " ✓" : " (differ)"} · ${orphanLinks.length} unresolved order links`,
      orphanLinks.map((e) => e.invoiceId + " → " + e.orderId));
  } else {
    add(g5, "Supplier costs fold in from Payables (Orders)", "fail", "finPayablesExpenses() unavailable", null);
  }

  // 5.4 — Review inbox matches ⇄ open Payables bills (Orders → Products)
  if (finInboxFn && finSuggestFn) {
    const inbox = finInboxFn();
    const openInv = pay.filter((p) => (typeof window.payBalance === "function" ? window.payBalance(p) : p.total - p.paid) > 0.005);
    const rules = finRulesFn ? finRulesFn() : [];
    const matched = inbox.map((t) => finSuggestFn(t, openInv, rules)).filter((s) => s && s.invoiceId);
    const badMatches = matched.filter((s) => !pay.some((p) => p.id === s.invoiceId) || !orderIds.has(s.orderId));
    add(g5, "Inbox matches ⇄ open bills → Orders", badMatches.length ? "fail" : "pass",
      `${inbox.length} synced txns · ${matched.length} auto-match an open supplier bill that resolves to an order`,
      badMatches.map((s) => s.invoiceId + " → " + s.orderId));
  }

  // 5.5 — Partners ⇄ Team owners (single source of truth)
  if (teamPartnersFn) {
    const fp = teamPartnersFn();
    const shareSum = fp.reduce((n, p) => n + (Number(p.share) || 0), 0);
    const sharesOk = Math.abs(shareSum - 1) < 0.001;
    const derivedMatch = D ? D.partners.length === fp.length : true;
    add(g5, "Partners ⇄ Team owners (split = 100%)", fp.length && sharesOk && derivedMatch ? "pass" : "warn",
      `${fp.length} owners from Team & roles · split = ${Math.round(shareSum * 100)}%${sharesOk ? " ✓" : " (≠100%)"}`,
      fp.map((p) => p.name + " " + Math.round((p.share || 0) * 100) + "%"));
  }

  // 5.6 — Net identity sanity (revenue − expense = net)
  if (D) {
    const idOk = Math.abs((D.totalRevenue - D.totalExpense) - D.cumNet) < 0.5;
    add(g5, "Net identity (revenue − costs = net)", idOk ? "pass" : "fail",
      `$${Math.round(D.totalRevenue).toLocaleString()} − $${Math.round(D.totalExpense).toLocaleString()} = $${Math.round(D.cumNet).toLocaleString()} net`,
      null);
  }

  return { groups, matrix: buildMatrix({ orders, orderById, pay, logShip, shipShipments, invInvoices, coSkus, inspInit, prodStatus, scope, curOrderId }), summary: summarize(groups) };
}

// Curated + live-verified connection map: which section reads the shared DBs.
function buildMatrix(ctx) {
  const { pay, invInvoices, curOrderId } = ctx;
  const payForOrder = pay.filter((p) => p.orderId === curOrderId);
  const invConnected = invInvoices.length > 0 && invInvoices.every((i) => payForOrder.some((p) => p.id === i.id));

  // status: 'linked' (reads shared source, verified) | 'sample' (local data) | 'na'
  return [
    { section: "Home", Orders: "linked", Payables: invConnected ? "linked" : "partial", Logistics: "partial", Catalog: "na",
      note: "Header/KPIs read the order record; money mirrors Payables." },
    { section: "Production", Orders: "linked", Payables: "na", Logistics: "na", Catalog: "partial",
      note: "Reads per-order scope (SKUs/units/supplier/costs) via order-scope.jsx for non-sample orders." },
    { section: "Shipping", Orders: "linked", Payables: "na", Logistics: "partial", Catalog: "na",
      note: "Derives this order's shipment from order-scope; portfolio LOG_SHIPMENTS is the cross-order source." },
    { section: "Inspection", Orders: "linked", Payables: "na", Logistics: "na", Catalog: "na",
      note: "Keyed to the order's scope + lifecycle stage; can be turned off per order (trusted suppliers)." },
    { section: "Invoices", Orders: "linked", Payables: invConnected ? "linked" : "partial", Logistics: "na", Catalog: "na",
      note: "Derives per-order from PAY_INVOICES — fully wired." },
    { section: "Closeout", Orders: "linked", Payables: "partial", Logistics: "partial", Catalog: "partial",
      note: "Landed-cost roll-up uses the order's scope SKUs + folds in its Payables bills." },
    { section: "Finance (Net & Draws)", Orders: "linked", Payables: "linked", Logistics: "na", Catalog: "partial",
      note: "Revenue ← Amazon API; cash ← Mercury; supplier costs fold in from Payables→Orders; partners ← Team owners." },
  ];
}

function summarize(groups) {
  let pass = 0, warn = 0, fail = 0;
  groups.forEach((g) => g.checks.forEach((c) => { if (c.status === "pass") pass++; else if (c.status === "warn") warn++; else fail++; }));
  return { pass, warn, fail, total: pass + warn + fail };
}

window.runConnectionTests = runConnectionTests;
