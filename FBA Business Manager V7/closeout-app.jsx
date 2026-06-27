// Vyonix Closeout Section — chrome-less body, embedded inside the Order Shell
// Closeout tab. Exposes VyCloseoutBody via window. Does NOT self-mount.
//
// PURPOSE: calculate the FINAL LANDED COST PER SKU for the order. Rolls up
// every cost bucket (goods, fees, freight, inspection, duties) and allocates
// each across the order's SKUs by a clear basis, producing a landed unit cost.
//
// Same section pattern as Shipping / Invoices / Inspection:
//   header + next-action  →  5-KPI strip  →  finalize banner  →
//   cost-buckets card  →  per-SKU landed-cost table  →  finalize checklist.
// Interactive: "Adjust costs" modal edits bucket amounts + allocation basis;
// "Lock landed cost" finalizes once duties are entered. All math derives live.

const { useState: useCoState } = React;

// ----------------------------------------------------------------------
// DATA — SKUs (from Production) + cost buckets to allocate
// ----------------------------------------------------------------------
const CO_SCOPE = (window.VY_ORDER_SCOPE && !window.VY_ORDER_SCOPE.isSample) ? window.VY_ORDER_SCOPE : null;

// Sale price per SKU — joined from the live catalog (variant.salePrice) by SKU.
// Used by the profitability card to project margin. Returns 0 when unknown.
function coCatalogPrice(sku) {
  try {
    const fams = (typeof catLoadFamilies === "function") ? catLoadFamilies()
      : (typeof CAT_FAMILIES !== "undefined" ? CAT_FAMILIES : []);
    for (const f of fams) {
      const v = (f.variants || []).find((x) => x.sku === sku);
      if (v && typeof v.salePrice === "number") return v.salePrice;
    }
  } catch (e) {}
  return 0;
}

// True when this SKU exists in the catalog — so we only link real SKUs to the
// variant page (no dead links for ad-hoc/sample SKUs).
function coSkuInCatalog(sku) {
  try {
    const fams = (typeof catLoadFamilies === "function") ? catLoadFamilies()
      : (typeof CAT_FAMILIES !== "undefined" ? CAT_FAMILIES : []);
    return fams.some((f) => (f.variants || []).some((v) => v.sku === sku));
  } catch (e) { return false; }
}
// Renders a SKU label that links to its variant page when the SKU is real.
function CoSkuCell({ sku, name }) {
  const linked = coSkuInCatalog(sku);
  return (
    <td style={coTd}>
      {linked
        ? <a href={"Vyonix Variant.html?sku=" + encodeURIComponent(sku)} style={{ fontFamily: coMono, fontWeight: 600, fontSize: 12, color: "hsl(var(--primary))", textDecoration: "none" }}>{sku}</a>
        : <div style={{ fontFamily: coMono, fontWeight: 600, fontSize: 12 }}>{sku}</div>}
      <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{name}</div>
    </td>
  );
}


// Per-SKU BILLED goods from the order's supplier invoice (the structured per-SKU
// billing). Landed cost should reflect what was actually BILLED, not the ordered
// estimate — falls back to ordered when a SKU has no billed line yet.
function coGoodsBilledMap() {
  const map = {};
  try {
    const invs = (typeof INV_INVOICES !== "undefined" && INV_INVOICES) || [];
    invs.forEach((inv) => {
      if (inv.vendorType !== "Supplier") return;
      const goods = (typeof paySupplierGoods === "function") ? paySupplierGoods(inv) : null;
      (goods || []).forEach((g) => { if (g.sku && (g.billed != null || g.ordered != null)) map[g.sku] = (g.billed != null ? g.billed : g.ordered); });
    });
  } catch (e) {}
  return map;
}
const CO_BILLED = coGoodsBilledMap();

const CO_SKUS = CO_SCOPE ? CO_SCOPE.skus.map((s) => ({ sku: s.sku, name: s.name, qty: s.qty, ordered: s.line, goods: (CO_BILLED[s.sku] != null ? CO_BILLED[s.sku] : s.line), goodsBilled: CO_BILLED[s.sku] != null, salePrice: coCatalogPrice(s.sku) })) : [
  { sku: "SEMI-BSC-1P-BLK", name: "Beaded seat cover · 1pc · Black", qty: 450, goods: 3755.51, salePrice: 79.99 },
  { sku: "SEMI-BSC-2P-BLK", name: "Beaded seat cover · 2pc · Black", qty: 350, goods: 2805.15, salePrice: 109.99 },
  { sku: "CAR-BSC-1P-BLK", name: "Beaded seat cover · 1pc · Carbon", qty: 450, goods: 3755.51, salePrice: 59.99 },
  { sku: "CAR-BSC-2P-BLK", name: "Beaded seat cover · 2pc · Carbon", qty: 350, goods: 2805.15, salePrice: 99.99 },
];

// PO vs invoiced reconciliation: per-SKU ORDERED (Production PO) vs BILLED
// (supplier invoice). Ordered = scope line / literal goods; billed = invoice
// per-SKU (CO_BILLED) when a bill exists, else equals ordered (nothing billed
// yet). Surfaces over/under-billing before landed cost is locked.
function coPoReconcile() {
  const rows = CO_SKUS.map((s) => {
    const ordered = s.ordered != null ? s.ordered : s.goods;
    const billed = CO_BILLED[s.sku] != null ? CO_BILLED[s.sku] : ordered;
    const diff = coRound2(billed - ordered);
    return { sku: s.sku, name: s.name, qty: s.qty, ordered: coRound2(ordered), billed: coRound2(billed), diff, hasBill: CO_BILLED[s.sku] != null };
  });
  const ordered = coRound2(rows.reduce((n, r) => n + r.ordered, 0));
  const billed = coRound2(rows.reduce((n, r) => n + r.billed, 0));
  const diff = coRound2(billed - ordered);
  const anyBilled = rows.some((r) => r.hasBill);
  const pct = ordered ? Math.round((diff / ordered) * 1000) / 10 : 0;
  const status = !anyBilled ? "pending" : Math.abs(diff) < 0.01 ? "match" : diff > 0 ? "over" : "under";
  return { rows, ordered, billed, diff, pct, status, anyBilled };
}

// Non-goods cost buckets are AUTO-POPULATED from the order's invoices and
// classified by each service line's CHARGE TYPE (the services source-of-truth),
// not by guessing from the invoice id. Each charge type maps to a landed-cost
// bucket; buckets only appear when they carry a billed amount.
//   basis = how it spreads across SKUs: units → by qty share, value → by goods value share
function coRound2(n) { return Math.round(n * 100) / 100; }

// charge-type id → landed-cost bucket key
const CO_BUCKET_FOR_CT = {
  freight: "freight", docs: "freight",
  agent_fee: "agent", tooling: "agent", other: "agent",
  packaging: "packaging",
  inspection: "inspection",
  duty: "duties", brokerage: "duties",
  discount: "discount",
};
const CO_BUCKET_META = {
  agent: { label: "Agent & service fees", basis: "value" },
  packaging: { label: "Packaging & handling", basis: "units" },
  freight: { label: "Freight (sea + inland)", basis: "units" },
  inspection: { label: "Inspection", basis: "units" },
  duties: { label: "Duties & customs", basis: "value" },
  discount: { label: "Supplier credits", basis: "value" },
  fbafees: { label: "FBA inbound fees (Amazon)", basis: "units" },
};

function coDeriveBuckets() {
  const invoices = (typeof INV_INVOICES !== "undefined" && INV_INVOICES) || [];
  const sums = {}; const src = {};
  invoices.forEach((inv) => {
    let lines = [];
    try { lines = (typeof payInvoiceLines === "function") ? payInvoiceLines(inv) : (inv.lines || []); }
    catch (e) { lines = inv.lines || []; }
    (lines || []).forEach((l) => {
      if (l.sku || l.type === "Product lines") return; // goods — allocated per SKU directly
      const ct = l.chargeType || ((typeof payChargeTypeForLabel === "function") ? payChargeTypeForLabel(l.label, l.type) : "other");
      const bkey = CO_BUCKET_FOR_CT[ct] || "agent";
      sums[bkey] = coRound2((sums[bkey] || 0) + (Number(l.amount) || 0));
      (src[bkey] = src[bkey] || new Set()).add(inv.id);
    });
  });
  const srcStr = (k) => [...(src[k] || [])].join(" · ");
  const buckets = [];
  // billed service buckets in a sensible order
  ["agent", "packaging", "freight"].forEach((k) => {
    if (Math.abs(sums[k] || 0) > 0.005) buckets.push({ key: k, label: CO_BUCKET_META[k].label, amount: sums[k], basis: CO_BUCKET_META[k].basis, source: srcStr(k) || "Invoices", auto: true });
  });
  // Amazon-side FBA inbound fees (placement + prep + labeling), summed across
  // this order's FBA inbounds. Per-unit Amazon costs → part of true landed cost.
  const fbaFees = coFbaInboundFeesForOrder();
  if (fbaFees > 0.005) buckets.push({ key: "fbafees", label: "FBA inbound fees (Amazon)", amount: fbaFees, basis: "units", source: "Amazon · FBA inbound (est.)", auto: true });
  // inspection: billed bill → else manual estimate (honest "not Auto")
  if (Math.abs(sums.inspection || 0) > 0.005) buckets.push({ key: "inspection", label: "Inspection", amount: sums.inspection, basis: "units", source: srcStr("inspection"), auto: true });
  else buckets.push({ key: "inspection", label: "Inspection", amount: 350.0, basis: "units", source: "Estimate — no inspection bill yet", auto: false });
  // supplier credits (negative) if any
  if (Math.abs(sums.discount || 0) > 0.005) buckets.push({ key: "discount", label: "Supplier credits", amount: sums.discount, basis: "value", source: srcStr("discount"), auto: true });
  // inventoriable costs added in Production
  coExtraBuckets().forEach((b) => buckets.push(b));
  // duties: billed (duty + brokerage) when present, else manual entry
  if (Math.abs(sums.duties || 0) > 0.005) buckets.push({ key: "duties", label: "Duties & customs", amount: sums.duties, basis: "value", source: srcStr("duties"), auto: true });
  else buckets.push({ key: "duties", label: "Duties & customs", amount: 0, basis: "value", source: "To be entered", auto: false });
  return buckets;
}

// Sum this order's Amazon FBA inbound fees (placement + prep + labeling) across
// every inbound linked to the order. Amazon-side, per-unit — folded into landed
// cost as its own bucket.
function coFbaInboundFeesForOrder() {
  const oid = (typeof window !== "undefined" && window.VY_ORDER_SCOPE && window.VY_ORDER_SCOPE.id) || (CO_SCOPE && CO_SCOPE.id);
  if (!oid) return 0;
  try {
    const allRows = (typeof window !== "undefined" && typeof window.logAllFbaRows === "function") ? window.logAllFbaRows() : [];
    const feeFn = (typeof window !== "undefined" && typeof window.fbaInboundFees === "function") ? window.fbaInboundFees : null;
    if (!feeFn) return 0;
    return coRound2(allRows.filter((r) => r.orderId === oid)
      .reduce((n, r) => n + (feeFn(r).total || 0), 0));
  } catch (e) { return 0; }
}

// Inventoriable non-product costs added in Production (published to
// window.__VY_PROD_EXTRA_COSTS) folded in here, grouped by allocation basis.
function coExtraBuckets() {
  const extra = (typeof window !== "undefined" && window.__VY_PROD_EXTRA_COSTS) || [];
  if (!extra.length) return [];
  const byValue = extra.filter((e) => e.basis === "value").reduce((n, e) => n + e.amount, 0);
  const byUnits = extra.filter((e) => e.basis === "units").reduce((n, e) => n + e.amount, 0);
  const out = [];
  if (byValue > 0.005) out.push({ key: "extra-value", label: "Other inventoriable", amount: coRound2(byValue), basis: "value", source: "Production costs", auto: true });
  if (byUnits > 0.005) out.push({ key: "extra-units", label: "Other inventoriable (units)", amount: coRound2(byUnits), basis: "units", source: "Production costs", auto: true });
  return out;
}

const BASIS_LABEL = { units: "By units", value: "By value" };

// ----------------------------------------------------------------------
// Formatting
// ----------------------------------------------------------------------
function coFmt(n) {
  return "$" + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function coFmt3(n) {
  return "$" + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

// Core allocation: returns per-SKU rows with each bucket's allocated $ + landed totals.
function coCompute(skus, buckets) {
  const totalUnits = skus.reduce((n, s) => n + s.qty, 0);
  const totalGoods = skus.reduce((n, s) => n + s.goods, 0);
  const rows = skus.map((s) => {
    const unitShare = totalUnits ? s.qty / totalUnits : 0;
    const valueShare = totalGoods ? s.goods / totalGoods : 0;
    const alloc = {};
    buckets.forEach((b) => {
      alloc[b.key] = b.amount * (b.basis === "units" ? unitShare : valueShare);
    });
    const allocSum = Object.values(alloc).reduce((n, v) => n + v, 0);
    const landed = s.goods + allocSum;
    return { ...s, alloc, landed, landedUnit: s.qty ? landed / s.qty : 0, goodsUnit: s.qty ? s.goods / s.qty : 0 };
  });
  const grandLanded = rows.reduce((n, r) => n + r.landed, 0);
  return { rows, totalUnits, totalGoods, grandLanded, avgUnit: totalUnits ? grandLanded / totalUnits : 0 };
}

// Profitability projection: joins landed unit cost (coCompute) with sale price
// per SKU and an Amazon-fee assumption. Amazon charges two ways, so we model
// both honestly: a **referral fee** (% of sale price) + a **per-unit FBA
// fulfillment fee** ($/unit). Net/unit = price − landed − referral − fba;
// projected profit = net/unit × qty.
function coComputeProfit(rows, priceMap, referralPct, fbaFeeUnit) {
  const ref = (Number(referralPct) || 0) / 100;
  const fba = Number(fbaFeeUnit) || 0;
  const out = rows.map((r) => {
    const price = Number(priceMap[r.sku]) || 0;
    const revenue = price * r.qty;
    const referralUnit = price * ref;
    const feeUnit = referralUnit + fba;        // total Amazon cost / unit
    const netUnit = price - r.landedUnit - feeUnit;
    const profit = netUnit * r.qty;
    return {
      sku: r.sku, name: r.name, qty: r.qty, price,
      landedUnit: r.landedUnit, referralUnit, fbaUnit: fba, feeUnit, netUnit, profit, revenue,
      marginPct: price > 0 ? netUnit / price : 0,
      priced: price > 0,
    };
  });
  const revenue = out.reduce((n, r) => n + r.revenue, 0);
  const referral = out.reduce((n, r) => n + r.referralUnit * r.qty, 0);
  const fbaTotal = out.reduce((n, r) => n + (r.priced ? r.fbaUnit * r.qty : 0), 0);
  const fees = referral + fbaTotal;
  const landed = out.reduce((n, r) => n + r.landedUnit * r.qty, 0);
  const profit = out.reduce((n, r) => n + r.profit, 0);
  const anyUnpriced = out.some((r) => !r.priced);
  return { rows: out, revenue, referral, fbaTotal, fees, landed, profit, marginPct: revenue > 0 ? profit / revenue : 0, anyUnpriced };
}

// ----------------------------------------------------------------------
// Sale-price + fee-model persistence (so profitability edits survive reload).
// Sale prices: per order+SKU override store, plus best-effort push to the
// catalog variant (so the Product page reflects it when the SKU is real).
// ----------------------------------------------------------------------
const CO_PRICE_KEY = "vy_closeout_saleprices_v1";
const CO_FEE_KEY = "vy_closeout_feemodel_v1";
function coOrderId() { return (window.VY_CURRENT_ORDER && window.VY_CURRENT_ORDER.id) || "sample"; }
function coLoadPriceStore() {
  try { return JSON.parse(localStorage.getItem(CO_PRICE_KEY) || "{}") || {}; } catch (e) { return {}; }
}
function coSavePriceOverride(sku, price) {
  const all = coLoadPriceStore();
  const oid = coOrderId();
  all[oid] = all[oid] || {};
  all[oid][sku] = price;
  try { localStorage.setItem(CO_PRICE_KEY, JSON.stringify(all)); } catch (e) {}
  // Best-effort: if this SKU exists in the catalog, push the new sale price so
  // the Product page stays consistent (mirrors coPushLandedToCatalog).
  try {
    if (typeof catLoadFamilies === "function" && typeof catUpdateFamilyVariants === "function") {
      catLoadFamilies().forEach((f) => {
        if ((f.variants || []).some((v) => v.sku === sku)) {
          catUpdateFamilyVariants(f.id, f.variants.map((v) => (v.sku === sku ? { ...v, salePrice: Number(price) || 0 } : v)));
        }
      });
    }
  } catch (e) {}
}
function coInitialPrices() {
  const overrides = coLoadPriceStore()[coOrderId()] || {};
  const m = {};
  CO_SKUS.forEach((s) => { m[s.sku] = (s.sku in overrides) ? overrides[s.sku] : (s.salePrice || 0); });
  return m;
}
function coLoadFeeModel() {
  try {
    const o = JSON.parse(localStorage.getItem(CO_FEE_KEY) || "{}") || {};
    return { referralPct: o.referralPct != null ? o.referralPct : 15, fbaFeeUnit: o.fbaFeeUnit != null ? o.fbaFeeUnit : 5.5 };
  } catch (e) { return { referralPct: 15, fbaFeeUnit: 5.5 }; }
}
function coSaveFeeModel(referralPct, fbaFeeUnit) {
  try { localStorage.setItem(CO_FEE_KEY, JSON.stringify({ referralPct, fbaFeeUnit })); } catch (e) {}
}

// Closeout → Product cost: write each SKU's FINAL landed unit cost back to the
// shared catalog (variant.lastCostUsd) and add a family cost-history point, so
// Product margins/economics reflect what was actually paid, not estimates.
// Idempotent per month (re-locking replaces the same-month history point).
function coPushLandedToCatalog(rows) {
  if (typeof catLoadFamilies !== "function" || typeof catUpdateFamily !== "function") return 0;
  const dateLabel = new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" });
  const bySku = {};
  rows.forEach((r) => { bySku[r.sku] = { landed: Math.round(r.landedUnit * 100) / 100, qty: r.qty }; });
  let updated = 0;
  catLoadFamilies().forEach((f) => {
    let touched = false, wSum = 0, qSum = 0;
    const variants = f.variants.map((v) => {
      const e = bySku[v.sku];
      if (e) { touched = true; wSum += e.landed * e.qty; qSum += e.qty; updated++; return { ...v, lastCostUsd: e.landed }; }
      return { ...v };
    });
    if (!touched) return;
    const avg = qSum ? Math.round((wSum / qSum) * 100) / 100 : 0;
    const hist = (f.costHistory || []).slice();
    if (hist.length && hist[hist.length - 1].date === dateLabel) hist[hist.length - 1] = { date: dateLabel, usd: avg };
    else hist.push({ date: dateLabel, usd: avg });
    catUpdateFamily(f.id, { variants, costHistory: hist });
  });
  return updated;
}

// ----------------------------------------------------------------------
// Shared presentational helpers (self-contained — no cross-file coupling)
// ----------------------------------------------------------------------
function CoSectionCard({ icon, title, sub, actions, iconTone = "primary", children }) {
  const toneVar = iconTone === "muted" ? "muted-fg" : iconTone;
  return (
    <section className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: children ? 16 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {icon ? (
            <span style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center",
              background: `hsl(var(--${toneVar}) / 0.12)`, color: `hsl(var(--${toneVar}))`,
            }}>
              <VyIcon name={icon} size={15} />
            </span>
          ) : null}
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
            {sub ? <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>{sub}</p> : null}
          </div>
        </div>
        {actions ? <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

const coTh = {
  textAlign: "left", padding: "10px 12px", fontSize: 10.5, fontWeight: 700,
  letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))",
};
const coTd = { padding: "12px 12px", fontSize: 12.5, color: "hsl(var(--foreground))" };
const coMono = "var(--font-mono, 'JetBrains Mono', monospace)";

const coInputStyle = {
  width: "100%", height: 36, padding: "0 12px", fontSize: 13,
  border: "1px solid hsl(var(--input))", borderRadius: 8,
  background: "hsl(var(--background))", color: "hsl(var(--foreground))",
};

// ----------------------------------------------------------------------
// Invoices-settled check (for data-driven status). Reads the same persisted
// per-order working set the Invoices section uses (vy_invoices_v1[orderId]),
// falling back to the INV_INVOICES seed, and computes each balance the same
// way the section does (total − cleared payments). The order only auto-closes
// when it's locked AND every bill is settled.
function coInvoiceList() {
  try {
    const id = window.VY_CURRENT_ORDER && window.VY_CURRENT_ORDER.id;
    const store = JSON.parse(localStorage.getItem("vy_invoices_v1") || "{}");
    if (id && store && Array.isArray(store[id]) && store[id].length) return store[id];
  } catch (e) {}
  return (typeof INV_INVOICES !== "undefined" && INV_INVOICES) || [];
}
function coInvoiceBalance(inv) {
  const paid = (inv.payments || [])
    .filter((p) => p.status === "Cleared")
    .reduce((n, p) => n + (p.amount || 0), 0);
  return Math.max(0, (inv.total || 0) - paid);
}
function coInvoicesSettled() {
  const list = coInvoiceList();
  return list.length > 0 && list.every((inv) => coInvoiceBalance(inv) <= 0.01);
}

// ----------------------------------------------------------------------
// CLOSEOUT BODY
// ----------------------------------------------------------------------
function VyCloseoutBody() {
  const [buckets, setBuckets] = useCoState(() => coDeriveBuckets());
  const [locked, setLocked] = useCoState(false);
  const [modal, setModal] = useCoState(null); // null | 'adjust'
  const [pushed, setPushed] = useCoState(0); // # of SKUs pushed to Products on lock

  // Profitability projection state — editable sale price per SKU (seeded from
  // catalog/overrides, persisted) + an Amazon referral % and per-unit FBA fee.
  const [salePrices, setSalePrices] = useCoState(coInitialPrices);
  const feeSeed = coLoadFeeModel();
  const [referralPct, setReferralPct] = useCoState(feeSeed.referralPct);
  const [fbaFeeUnit, setFbaFeeUnit] = useCoState(feeSeed.fbaFeeUnit);
  function updateSalePrice(sku, value) {
    setSalePrices((m) => ({ ...m, [sku]: value }));
    coSavePriceOverride(sku, value);
  }
  React.useEffect(() => { coSaveFeeModel(referralPct, fbaFeeUnit); }, [referralPct, fbaFeeUnit]);

  const { rows, totalUnits, totalGoods, grandLanded, avgUnit } = coCompute(CO_SKUS, buckets);
  const dutiesEntered = (buckets.find((b) => b.key === "duties") || {}).amount > 0;
  const nonGoodsTotal = grandLanded - totalGoods;

  // Profitability projection (joins landed cost with sale price + Amazon fees).
  const profit = coComputeProfit(rows, salePrices, referralPct, fbaFeeUnit);

  // Data-driven status: locking landed cost closes the order ONLY when every
  // bill is settled. Forward-only + rising-edge (manual controls override).
  const invoicesSettled = coInvoicesSettled();
  const closeReady = locked && invoicesSettled;
  const coAdvRef = React.useRef(closeReady);
  React.useEffect(() => {
    if (closeReady && !coAdvRef.current && typeof ordAdvanceToAtLeast === "function") {
      const o = window.VY_CURRENT_ORDER;
      if (o && o.id) {
        ordAdvanceToAtLeast(o.id, o.status && o.status.label, "closed", "Closeout locked & bills settled");
      }
    }
    coAdvRef.current = closeReady;
  }, [closeReady]);

  // Next action
  let nextTitle, nextSub, nextBtn;
  if (locked) {
    nextTitle = "Landed cost locked";
    nextSub = "Final landed cost per SKU is locked. Push to inventory or export the cost sheet.";
    nextBtn = { label: "Export cost sheet", icon: "download", onClick: () => alert("Export landed-cost sheet"), outline: true };
  } else if (!dutiesEntered) {
    nextTitle = "Add duties & customs";
    nextSub = "Enter duties/customs to complete the landed cost before locking it in.";
    nextBtn = { label: "Adjust costs", icon: "pencil", onClick: () => setModal("adjust") };
  } else {
    nextTitle = "Lock landed cost";
    nextSub = "All cost buckets entered. Lock the final per-SKU landed cost for this order.";
    nextBtn = { label: "Lock landed cost", icon: "check", onClick: () => { setPushed(coPushLandedToCatalog(rows)); setLocked(true); } };
  }

  const kpis = [
    { icon: "dollar", label: "Total landed cost", value: coFmt(grandLanded), sub: "goods + " + coFmt(nonGoodsTotal) + " costs" },
    { icon: "package", label: "Avg landed / unit", value: coFmt3(avgUnit), sub: "across all SKUs", tone: "info" },
    { icon: "boxes", label: "Units", value: totalUnits.toLocaleString(), sub: CO_SKUS.length + " SKUs" },
    { icon: "receipt", label: "Cost buckets", value: String(buckets.length + 1), sub: "goods + " + buckets.length + " allocated" },
    { icon: locked ? "check" : "clipboard", label: "Status", value: locked ? "Locked" : "Draft", sub: locked ? "Final" : dutiesEntered ? "Ready to lock" : "Duties pending", tone: locked ? "success" : dutiesEntered ? "info" : "warning" },
  ];

  return (
    <>
      {window.VyExampleNote ? <window.VyExampleNote section="closeout" /> : null}
      {/* Header + next action */}
      <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 460px", padding: "20px 22px", minWidth: 0 }}>
            <h1 className="vy-page-title" style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Landed cost</h1>
            <p className="vy-page-sub" style={{ margin: "6px 0 0", maxWidth: "62ch" }}>
              Roll up every cost on this order and allocate it across SKUs to calculate the final landed cost per unit.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <span className={"vy-badge vy-badge--" + (locked ? "success" : "info")}>{locked ? "Locked" : "Draft"}</span>
              <span className="vy-badge vy-badge--muted">{coFmt3(avgUnit)} avg / unit</span>
              {!dutiesEntered ? <span className="vy-badge vy-badge--warning">Duties pending</span> : null}
            </div>
          </div>
          <div style={{
            flex: "1 1 300px", padding: "20px 22px", minWidth: 260,
            borderLeft: "1px solid hsl(var(--border))", background: "hsl(var(--accent) / 0.5)",
          }}>
            <div className="vy-kicker" style={{ marginBottom: 6 }}>Next action</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{nextTitle}</div>
            <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "4px 0 14px" }}>{nextSub}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={"vy-btn " + (nextBtn.outline ? "vy-btn--outline" : "vy-btn--primary")} onClick={nextBtn.onClick}>
                <VyIcon name={nextBtn.icon} size={14} />
                <span>{nextBtn.label}</span>
              </button>
              {!locked && nextBtn.label !== "Adjust costs" ? (
                <button type="button" className="vy-btn vy-btn--ghost" onClick={() => setModal("adjust")}>
                  <VyIcon name="pencil" size={14} /><span>Adjust costs</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* KPI strip */}
      <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {kpis.map((k, i) => (
          <div key={i} className={"vy-card vy-kpi" + (k.tone ? ` vy-kpi--${k.tone}` : "")}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <VyIcon name={k.icon} size={14} style={{ opacity: 0.7 }} />
              <span className="vy-kicker">{k.label}</span>
            </div>
            <div className="vy-kpi-value" style={{ fontSize: 19 }}>{k.value}</div>
            <div className="vy-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Finalize banner */}
      {locked ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderRadius: 10, background: "hsl(var(--success) / 0.08)", border: "1px solid hsl(var(--success) / 0.25)" }}>
          <VyIcon name="check" size={15} style={{ color: "hsl(var(--success))", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
            <strong style={{ fontWeight: 600 }}>Landed cost locked</strong>
            <span style={{ color: "hsl(var(--muted-fg))" }}>&nbsp;&nbsp;{coFmt3(avgUnit)} average per unit across {totalUnits.toLocaleString()} units.{pushed ? " Pushed to " + pushed + " SKU" + (pushed > 1 ? "s" : "") + " in Products." : ""}{invoicesSettled ? " Order closed." : " Order will close once all bills are settled."}</span>
          </div>
          <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => setLocked(false)}>
            <VyIcon name="pencil" size={12} /><span>Unlock</span>
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderRadius: 10, background: "hsl(var(--warning) / 0.08)", border: "1px solid hsl(var(--warning) / 0.25)" }}>
          <VyIcon name="alert" size={15} style={{ color: "hsl(var(--warning))", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
            <strong style={{ fontWeight: 600 }}>{dutiesEntered ? "Ready to lock" : "Landed cost is provisional"}</strong>
            <span style={{ color: "hsl(var(--muted-fg))" }}>
              &nbsp;&nbsp;{dutiesEntered ? "All buckets entered — lock to finalize per-SKU cost." : "Enter duties & customs to complete the calculation."}
            </span>
          </div>
        </div>
      )}

      {/* PO vs invoiced cost check — ordered (Production) vs billed (supplier invoice) */}
      {(() => {
        const recon = coPoReconcile();
        const tone = recon.status === "match" ? "success" : recon.status === "over" ? "danger" : recon.status === "under" ? "warning" : "muted";
        const headline = recon.status === "pending" ? "No supplier bill yet"
          : recon.status === "match" ? "Billed matches the PO"
          : recon.status === "over" ? "Supplier billed over the PO"
          : "Supplier billed under the PO";
        return (
          <CoSectionCard
            icon="clipboard"
            title="PO vs invoiced cost check"
            sub="What Production ordered vs what the supplier actually billed, per SKU"
            iconTone="primary"
            actions={<span className={"vy-badge vy-badge--" + tone}>{recon.status === "pending" ? "Pending" : (recon.diff > 0 ? "+" : "") + coFmt(recon.diff) + (recon.pct ? " · " + (recon.pct > 0 ? "+" : "") + recon.pct + "%" : "")}</span>}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14 }}>
              <div style={{ flex: "1 1 130px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Ordered (PO)</div><div style={{ fontFamily: coMono, fontSize: 17, fontWeight: 800 }}>{coFmt(recon.ordered)}</div></div>
              <div style={{ flex: "1 1 130px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Invoiced (billed)</div><div style={{ fontFamily: coMono, fontSize: 17, fontWeight: 800 }}>{coFmt(recon.billed)}</div></div>
              <div style={{ flex: "1 1 130px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Variance</div><div style={{ fontFamily: coMono, fontSize: 17, fontWeight: 800, color: "hsl(var(--" + tone + "))" }}>{recon.diff > 0 ? "+" : ""}{coFmt(recon.diff)}</div></div>
              <div style={{ flex: "2 1 200px", alignSelf: "center" }}><span className={"vy-badge vy-badge--" + tone} style={{ marginRight: 8 }}>{headline}</span><span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{recon.status === "pending" ? "Itemize the supplier invoice to reconcile." : recon.status === "match" ? "No action needed." : "Review the over/under SKUs before locking landed cost."}</span></div>
            </div>
            {recon.anyBilled ? (
              <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "hsl(var(--muted-bg) / 0.6)" }}>
                      <th style={{ ...coTh, textAlign: "left" }}>SKU</th>
                      <th style={{ ...coTh, textAlign: "right" }}>Ordered</th>
                      <th style={{ ...coTh, textAlign: "right" }}>Billed</th>
                      <th style={{ ...coTh, textAlign: "right" }}>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recon.rows.map((r) => {
                      const rt = !r.hasBill ? "muted" : Math.abs(r.diff) < 0.01 ? "success" : r.diff > 0 ? "danger" : "warning";
                      return (
                        <tr key={r.sku} style={{ borderTop: "1px solid hsl(var(--border))" }}>
                          <CoSkuCell sku={r.sku} name={r.name} />
                          <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, color: "hsl(var(--muted-fg))" }}>{coFmt(r.ordered)}</td>
                          <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, fontWeight: 600 }}>{coFmt(r.billed)}</td>
                          <td style={{ ...coTd, textAlign: "right", fontFamily: coMono }}>{Math.abs(r.diff) < 0.01 ? <span style={{ color: "hsl(var(--muted-fg))" }}>—</span> : <span className={"vy-badge vy-badge--" + rt}>{r.diff > 0 ? "+" : ""}{coFmt(r.diff)}</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CoSectionCard>
        );
      })()}

      {/* Cost buckets */}
      <CoSectionCard
        icon="receipt"
        title="Cost buckets"
        sub="Classified by charge type from this order's invoices · allocated across SKUs"
        iconTone="primary"
        actions={
          <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => setModal("adjust")} disabled={locked} >
            <VyIcon name="pencil" size={12} /><span>Adjust</span>
          </button>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {/* Goods bucket (direct) */}
          <div style={{ padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
            <div className="vy-kicker" style={{ marginBottom: 4 }}>Goods (direct)</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: coMono }}>{coFmt(totalGoods)}</div>
            <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", marginTop: 3 }}>
              <span className="vy-badge vy-badge--info" style={{ fontSize: 9.5, padding: "1px 6px" }}>Auto</span> Per SKU · billed amounts
            </div>
          </div>
          {buckets.map((b) => (
            <div key={b.key} style={{ padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
              <div className="vy-kicker" style={{ marginBottom: 4 }}>{b.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: coMono, color: b.amount === 0 ? "hsl(var(--warning))" : undefined }}>{coFmt(b.amount)}</div>
              <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", marginTop: 3, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <span className={"vy-badge vy-badge--" + (b.auto ? "info" : "warning")} style={{ fontSize: 9.5, padding: "1px 6px" }}>{b.auto ? "Auto" : "Manual"}</span>
                <span className="vy-badge vy-badge--muted" style={{ fontSize: 9.5, padding: "1px 6px" }}>{BASIS_LABEL[b.basis]}</span>
                <span>{b.amount === 0 ? "pending" : b.source}</span>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "hsl(var(--muted-fg))", margin: "12px 2px 0" }}>
          Each service line is bucketed by its <strong style={{ fontWeight: 600 }}>charge type</strong> (freight, agent, packaging, inspection, duties); goods use the <strong style={{ fontWeight: 600 }}>billed</strong> per-SKU amount. Duties are entered manually. Use <strong style={{ fontWeight: 600 }}>Adjust</strong> to override any value.
        </p>
      </CoSectionCard>

      {/* Per-SKU landed cost table */}
      <CoSectionCard icon="package" title="Landed cost per SKU" sub="Goods + allocated costs ÷ units" iconTone="info">
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ background: "hsl(var(--muted-bg) / 0.6)" }}>
                <th style={coTh}>SKU</th>
                <th style={{ ...coTh, textAlign: "right" }}>Qty</th>
                <th style={{ ...coTh, textAlign: "right" }}>Goods / u</th>
                <th style={{ ...coTh, textAlign: "right" }}>+ Costs / u</th>
                <th style={{ ...coTh, textAlign: "right" }}>Landed / u</th>
                <th style={{ ...coTh, textAlign: "right" }}>Landed total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const addedUnit = r.landedUnit - r.goodsUnit;
                return (
                  <tr key={r.sku} style={{ borderTop: "1px solid hsl(var(--border))" }}>
                    <CoSkuCell sku={r.sku} name={r.name} />
                    <td style={{ ...coTd, textAlign: "right", fontFamily: coMono }}>{r.qty}</td>
                    <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, color: "hsl(var(--muted-fg))" }}>
                      <div>{coFmt(r.goodsUnit)}</div>
                      <div style={{ marginTop: 2, fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
                        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", padding: "1px 5px", borderRadius: 999, background: r.goodsBilled ? "hsl(var(--success) / 0.12)" : "hsl(var(--warning) / 0.14)", color: r.goodsBilled ? "hsl(var(--success))" : "hsl(var(--warning))" }} title={r.goodsBilled ? "Reconciled to a supplier invoice" : "Still on the ordered estimate — no billed line yet"}>{r.goodsBilled ? "billed" : "est."}</span>
                      </div>
                    </td>
                    <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, color: "hsl(var(--muted-fg))" }}>+{coFmt(addedUnit)}</td>
                    <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, fontWeight: 700, color: "hsl(var(--info))" }}>{coFmt3(r.landedUnit)}</td>
                    <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, fontWeight: 600 }}>{coFmt(r.landed)}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid hsl(var(--border))", background: "hsl(var(--muted-bg) / 0.4)" }}>
                <td style={{ ...coTd, fontWeight: 700 }}>Order total</td>
                <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, fontWeight: 700 }}>{totalUnits}</td>
                <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, color: "hsl(var(--muted-fg))" }}>—</td>
                <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, color: "hsl(var(--muted-fg))" }}>+{coFmt(nonGoodsTotal)}</td>
                <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, fontWeight: 700, color: "hsl(var(--info))" }}>{coFmt3(avgUnit)}</td>
                <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, fontWeight: 700 }}>{coFmt(grandLanded)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: "hsl(var(--muted-fg))", margin: "10px 2px 0" }}>
          "+ Costs / u" = this SKU's share of fees, freight, inspection and duties. Allocation basis is set per bucket under Adjust costs.
        </p>
      </CoSectionCard>

      {/* Did it make money? — profitability projection */}
      <CoSectionCard
        icon="dollar"
        title="Did it make money?"
        sub="Projected margin = sale price − landed cost − Amazon fees"
        iconTone={profit.profit >= 0 ? "success" : "danger"}
        actions={
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>
              <span>Referral</span>
              <input
                type="number" min="0" max="60" step="1" value={referralPct}
                onChange={(e) => setReferralPct(e.target.value)}
                style={{ width: 50, padding: "4px 7px", border: "1px solid hsl(var(--border))", borderRadius: 7, background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontFamily: coMono, fontSize: 12, textAlign: "right" }}
              />
              <span>%</span>
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>
              <span>FBA $/u</span>
              <input
                type="number" min="0" step="0.01" value={fbaFeeUnit}
                onChange={(e) => setFbaFeeUnit(e.target.value)}
                style={{ width: 64, padding: "4px 7px", border: "1px solid hsl(var(--border))", borderRadius: 7, background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontFamily: coMono, fontSize: 12, textAlign: "right" }}
              />
            </label>
          </div>
        }
      >
        {/* Summary KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Projected revenue", value: coFmt(profit.revenue), sub: "at current sale prices" },
            { label: "Landed cost", value: coFmt(profit.landed), sub: "all-in COGS" },
            { label: "Est. Amazon fees", value: coFmt(profit.fees), sub: referralPct + "% referral + " + coFmt(profit.fbaTotal) + " FBA" },
            { label: "Projected profit", value: coFmt(profit.profit), sub: "after fees + landed", tone: profit.profit >= 0 ? "success" : "danger" },
            { label: "Net margin", value: (profit.marginPct * 100).toFixed(1) + "%", sub: "of revenue", tone: profit.profit >= 0 ? "success" : "danger" },
          ].map((k, i) => (
            <div key={i} style={{ padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
              <div className="vy-kicker" style={{ marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: coMono, color: k.tone ? "hsl(var(--" + k.tone + "))" : undefined }}>{k.value}</div>
              <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", marginTop: 3 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Per-SKU profitability table */}
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ background: "hsl(var(--muted-bg) / 0.6)" }}>
                <th style={coTh}>SKU</th>
                <th style={{ ...coTh, textAlign: "right" }}>Units</th>
                <th style={{ ...coTh, textAlign: "right" }}>Sale price</th>
                <th style={{ ...coTh, textAlign: "right" }}>Landed / u</th>
                <th style={{ ...coTh, textAlign: "right" }}>Amazon fee / u</th>
                <th style={{ ...coTh, textAlign: "right" }}>Net / u</th>
                <th style={{ ...coTh, textAlign: "right" }}>Margin</th>
                <th style={{ ...coTh, textAlign: "right" }}>Projected profit</th>
              </tr>
            </thead>
            <tbody>
              {profit.rows.map((r) => {
                const tone = r.netUnit >= 0 ? "success" : "danger";
                return (
                  <tr key={r.sku} style={{ borderTop: "1px solid hsl(var(--border))" }}>
                    <CoSkuCell sku={r.sku} name={r.name} />
                    <td style={{ ...coTd, textAlign: "right", fontFamily: coMono }}>{r.qty}</td>
                    <td style={{ ...coTd, textAlign: "right" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 2, justifyContent: "flex-end" }}>
                        <span style={{ color: "hsl(var(--muted-fg))", fontFamily: coMono }}>$</span>
                        <input
                          type="number" min="0" step="0.01" value={r.price || ""}
                          onChange={(e) => updateSalePrice(r.sku, e.target.value)}
                          placeholder="0.00"
                          style={{ width: 78, padding: "4px 7px", border: "1px solid " + (r.priced ? "hsl(var(--border))" : "hsl(var(--warning))"), borderRadius: 7, background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontFamily: coMono, fontSize: 12, textAlign: "right" }}
                        />
                      </span>
                    </td>
                    <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, color: "hsl(var(--muted-fg))" }}>{coFmt3(r.landedUnit)}</td>
                    <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, color: "hsl(var(--muted-fg))" }}>{r.priced ? "−" + coFmt(r.feeUnit) : "—"}</td>
                    <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, fontWeight: 700, color: r.priced ? "hsl(var(--" + tone + "))" : "hsl(var(--muted-fg))" }}>{r.priced ? coFmt(r.netUnit) : "—"}</td>
                    <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, color: r.priced ? "hsl(var(--" + tone + "))" : "hsl(var(--muted-fg))" }}>{r.priced ? (r.marginPct * 100).toFixed(0) + "%" : "—"}</td>
                    <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, fontWeight: 700, color: r.priced ? "hsl(var(--" + tone + "))" : "hsl(var(--muted-fg))" }}>{r.priced ? coFmt(r.profit) : "set price"}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid hsl(var(--border))", background: "hsl(var(--muted-bg) / 0.4)" }}>
                <td style={{ ...coTd, fontWeight: 700 }}>Order total</td>
                <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, fontWeight: 700 }}>{totalUnits}</td>
                <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, fontWeight: 700 }}>{coFmt(profit.revenue)}</td>
                <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, color: "hsl(var(--muted-fg))" }}>{coFmt(profit.landed)}</td>
                <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, color: "hsl(var(--muted-fg))" }}>−{coFmt(profit.fees)}</td>
                <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, color: "hsl(var(--muted-fg))" }}>—</td>
                <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, fontWeight: 700, color: "hsl(var(--" + (profit.profit >= 0 ? "success" : "danger") + "))" }}>{(profit.marginPct * 100).toFixed(0) + "%"}</td>
                <td style={{ ...coTd, textAlign: "right", fontFamily: coMono, fontWeight: 700, color: "hsl(var(--" + (profit.profit >= 0 ? "success" : "danger") + "))" }}>{coFmt(profit.profit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: "hsl(var(--muted-fg))", margin: "10px 2px 0" }}>
          Sale prices are seeded from the catalog ({"variant.salePrice"}), <strong style={{ fontWeight: 600 }}>editable here and saved</strong> (pushed back to the product when the SKU is linked). Amazon fee = <strong style={{ fontWeight: 600 }}>{referralPct}% referral</strong> + <strong style={{ fontWeight: 600 }}>{coFmt(fbaFeeUnit)}/unit FBA</strong>{profit.anyUnpriced ? " — set a price on the highlighted SKUs to include them" : ""}. <strong style={{ fontWeight: 600 }}>Gross of</strong> returns, storage and PPC.
        </p>
      </CoSectionCard>

      {/* Adjust costs modal */}
      {modal === "adjust" ? (
        <CoAdjustModal buckets={buckets} onClose={() => setModal(null)} onSave={(b) => { setBuckets(b); setModal(null); }} />
      ) : null}
    </>
  );
}

// ----------------------------------------------------------------------
// Adjust costs modal
// ----------------------------------------------------------------------
function CoModalShell({ title, sub, onClose, children, footer, width = 560 }) {
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: width, maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
            {sub ? <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0", maxWidth: "48ch" }}>{sub}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 24px", overflowY: "auto" }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>{footer}</div>
      </div>
    </div>,
    document.body
  );
}

function CoAdjustModal({ buckets, onClose, onSave }) {
  const [draft, setDraft] = useCoState(buckets.map((b) => ({ ...b })));
  const setAmount = (i, v) => setDraft((p) => p.map((b, idx) => (idx === i ? { ...b, amount: Math.max(0, Number(v) || 0), auto: b.key === "duties" ? Number(v) > 0 ? false : b.auto : false } : b)));
  const setBasis = (i, v) => setDraft((p) => p.map((b, idx) => (idx === i ? { ...b, basis: v } : b)));
  const resetAuto = () => setDraft(coDeriveBuckets());
  const total = draft.reduce((n, b) => n + b.amount, 0);

  return (
    <CoModalShell
      title="Adjust cost buckets"
      sub="Auto-pulled from the order's invoices by charge type. Edit any amount to override, or set duties manually."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={resetAuto} style={{ marginRight: "auto" }}>
            <VyIcon name="refresh" size={14} /><span>Reset to invoice values</span>
          </button>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" onClick={() => onSave(draft)}>
            <VyIcon name="check" size={14} /><span>Save costs</span>
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {draft.map((b, i) => (
          <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
            <div style={{ flex: "1 1 160px", minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {b.label}
                <span className={"vy-badge vy-badge--" + (b.auto ? "info" : "warning")} style={{ fontSize: 9.5, padding: "1px 6px" }}>{b.auto ? "Auto" : "Manual"}</span>
              </div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{b.source}</div>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 3, width: 120 }}>
              <span className="vy-kicker">Amount</span>
              <input type="number" step="0.01" min="0" className="vy-input" style={coInputStyle} value={b.amount} onChange={(e) => setAmount(i, e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 3, width: 130 }}>
              <span className="vy-kicker">Allocate</span>
              <select className="vy-input" style={coInputStyle} value={b.basis} onChange={(e) => setBasis(i, e.target.value)}>
                <option value="units">By units</option>
                <option value="value">By value</option>
              </select>
            </label>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "hsl(var(--accent) / 0.6)", border: "1px solid hsl(var(--border))" }}>
        <VyIcon name="dollar" size={13} style={{ color: "hsl(var(--primary))" }} />
        <span className="vy-kicker">Allocated costs total</span>
        <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 700, fontFamily: coMono }}>{coFmt(total)}</span>
      </div>
    </CoModalShell>
  );
}

Object.assign(window, { VyCloseoutBody, CO_SKUS, coDeriveBuckets });
