// amazon-source.jsx — THE Amazon data contract for the whole app.
// =====================================================================
// This is the single seam between Vyonix and Amazon Seller Central.
// Every figure that ultimately comes from Amazon — units sold, gross sales,
// the fee breakdown (referral / FBA / ads), and the net settlement payout —
// is read THROUGH this module. Today it returns seeded SAMPLE data; when the
// real Selling Partner API (SP-API) is connected, ONLY the fetch functions
// below change — their RETURN SHAPE is the contract the rest of the app relies
// on, so nothing downstream needs rewriting.
//
// ---- THE CONTRACT (what every period record looks like) ----
//   {
//     month:      "YYYY-MM",
//     units:      Number,   // units ordered (Business Report: "Units Ordered")
//     grossSales: Number,   // product sales before any deductions
//     referralFees: Number, // Amazon referral (category %) 
//     fbaFees:    Number,   // FBA fulfillment + storage
//     adSpend:    Number,   // Sponsored Products/Brands (PPC)
//     refunds:    Number,   // refunded amount
//     netPayout:  Number,   // = gross − referral − fba − ads − refunds  (what hits Mercury)
//   }
// netPayout is what the Finance ledger already records as "revenue"; the other
// fields are the breakdown that lets the P&L show gross → fees → ads → net,
// TACoS, and true per-unit economics once we surface them.
//
// ---- WIRING THE REAL API (developer note) ----
//   • amzConnected()      → read true token/connection status (already reads the
//                           integration store; swap to real OAuth token check).
//   • amzMonthly()        → replace the SEED with SP-API calls:
//        - Reports API  → GET_SALES_AND_TRAFFIC_REPORT  (units, grossSales)
//        - Finances API → listFinancialEvents           (referral, fba, refunds)
//        - Reports API  → ad reports / Amazon Ads API    (adSpend)
//     Map each into the contract object above, keyed by month. Everything else
//     (P&L, dashboards, per-unit COGS) keeps working unchanged.

// Seeded sample months — kept CONSISTENT with the Finance revenue seed:
// netPayout here == the Amazon payout amounts in finances-data.jsx
// (Feb 21,400 · Mar 24,900 · Apr 19,800 · May 28,600).
const AMZ_SEED = [
  { month: "2026-02", units: 1180, grossSales: 30600, referralFees: 4590, fbaFees: 3100, adSpend: 1510, refunds: 0, netPayout: 21400 },
  { month: "2026-03", units: 1395, grossSales: 35900, referralFees: 5385, fbaFees: 3600, adSpend: 2015, refunds: 0, netPayout: 24900 },
  { month: "2026-04", units: 1120, grossSales: 28800, referralFees: 4320, fbaFees: 2900, adSpend: 1780, refunds: 0, netPayout: 19800 },
  { month: "2026-05", units: 1620, grossSales: 41000, referralFees: 6150, fbaFees: 4200, adSpend: 2050, refunds: 0, netPayout: 28600 },
];

// Is the live Amazon connection active? (Drives "sample vs live" provenance.)
function amzConnected() {
  return (typeof intgAmazonConnected === "function") ? intgAmazonConnected() : false;
}

// All monthly records (the contract array). SAMPLE today; SP-API later.
function amzMonthly() {
  // When connected, this is where live SP-API report data is mapped in.
  return AMZ_SEED.map((r) => ({ ...r, source: amzConnected() ? "amazon" : "sample" }));
}

// One month's record (or null).
function amzForMonth(monthKey) {
  return amzMonthly().find((r) => r.month === monthKey) || null;
}

// Units sold across a [startKey, endKey] inclusive month range — answers
// "how many units in the last 14 days / month / year" once date ranges map to
// months. (Day-level granularity arrives with the live Sales & Traffic report.)
function amzUnitsInRange(startKey, endKey) {
  return amzMonthly()
    .filter((r) => (!startKey || r.month >= startKey) && (!endKey || r.month <= endKey))
    .reduce((n, r) => n + r.units, 0);
}

// Totals across all loaded months.
function amzTotals() {
  const m = amzMonthly();
  const sum = (f) => m.reduce((n, r) => n + f(r), 0);
  const grossSales = sum((r) => r.grossSales);
  const adSpend = sum((r) => r.adSpend);
  return {
    units: sum((r) => r.units),
    grossSales,
    referralFees: sum((r) => r.referralFees),
    fbaFees: sum((r) => r.fbaFees),
    adSpend,
    netPayout: sum((r) => r.netPayout),
    tacos: grossSales > 0 ? adSpend / grossSales : 0, // total ad cost of sales
    connected: amzConnected(),
  };
}

Object.assign(window, {
  AMZ_SEED, amzConnected, amzMonthly, amzForMonth, amzUnitsInRange, amzTotals,
});

// =====================================================================
// PER-PRODUCT performance (units sold + profit by product) and the
// REORDER projection. Per-product velocity comes from the same Amazon feed
// (Sales & Traffic report → "Units Ordered" by ASIN/SKU); today it's seeded.
// Keyed by catalog familyId so it joins to the catalog + live FBA stock.
//   contract per product:
//     { familyId, avgUnitsMonth, sellPrice, netPerUnit }
// =====================================================================
const AMZ_PRODUCT_SEED = [
  { familyId: "car-bsc",     avgUnitsMonth: 320, sellPrice: 19, netPerUnit: 5 },
  { familyId: "semi-swc-18", avgUnitsMonth: 280, sellPrice: 26, netPerUnit: 8 },
  { familyId: "semi-bsc",    avgUnitsMonth: 240, sellPrice: 22, netPerUnit: 6 },
  { familyId: "car-swc-15d", avgUnitsMonth: 210, sellPrice: 32, netPerUnit: 11 },
  { familyId: "car-asc",     avgUnitsMonth: 160, sellPrice: 28, netPerUnit: 9 },
  { familyId: "rv-bsc",      avgUnitsMonth: 120, sellPrice: 24, netPerUnit: 7 },
];

// How many months of sales the seed represents (matches the 4 seeded months).
function amzMonthsCount() { return amzMonthly().length || 1; }

// Per-product performance: units sold, revenue, net profit over the window.
function amzProductPerf() {
  const months = amzMonthsCount();
  return AMZ_PRODUCT_SEED.map((p) => {
    const fam = (typeof catFamilyById === "function") ? catFamilyById(p.familyId) : null;
    const unitsSold = Math.round(p.avgUnitsMonth * months);
    const revenue = unitsSold * p.sellPrice;
    const netProfit = unitsSold * p.netPerUnit;
    const stats = fam && typeof catFamilyStats === "function" ? catFamilyStats(fam) : null;
    return {
      familyId: p.familyId,
      name: fam ? (fam.parent || fam.id) : p.familyId,
      avgUnitsMonth: p.avgUnitsMonth,
      unitsSold, revenue, netProfit,
      netPerUnit: p.netPerUnit,
      margin: revenue > 0 ? netProfit / revenue : 0,
      onHand: stats ? stats.stock : 0,
      inbound: stats ? stats.inbound : 0,
      leadDays: fam && fam.leadTimeDays ? fam.leadTimeDays : 30,
      moq: fam && fam.moq ? fam.moq : 0,
      connected: amzConnected(),
    };
  }).sort((a, b) => b.netProfit - a.netProfit);
}

// Reorder projection. For a target days-of-cover, suggest how much to order:
//   need = velocity/day × (leadDays + coverDays) − (onHand + inbound)
// Days of cover left = onHand ÷ velocity/day. Rounded to MOQ when set.
function amzReorderPlan(coverDays) {
  coverDays = coverDays || 60;
  return amzProductPerf().map((p) => {
    const perDay = p.avgUnitsMonth / 30.4375;
    const daysLeft = perDay > 0 ? (p.onHand / perDay) : Infinity;
    const target = perDay * (p.leadDays + coverDays);
    let need = Math.max(0, Math.round(target - (p.onHand + p.inbound)));
    if (p.moq && need > 0) need = Math.max(need, p.moq);          // respect MOQ
    if (p.moq && need > 0) need = Math.ceil(need / p.moq) * p.moq; // round up to MOQ multiples
    // urgency: will stock run out before a new order (lead time) could arrive?
    const urgency = daysLeft <= p.leadDays ? "now" : daysLeft <= p.leadDays + 21 ? "soon" : "ok";
    return { ...p, perDay, daysLeft, need, urgency };
  });
}

Object.assign(window, {
  AMZ_PRODUCT_SEED, amzMonthsCount, amzProductPerf, amzReorderPlan,
});
