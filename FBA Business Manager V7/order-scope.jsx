// order-scope.jsx — SINGLE per-order data deriver.
// Turns the current order (window.VY_CURRENT_ORDER, set by vy-order.jsx) into a
// normalized "scope" object that EVERY deep section reads, so opening any order
// shows ITS OWN SKUs / units / supplier / money / lifecycle stage everywhere —
// not the canonical sample's. The sample order (ORD-2026-05-006) keeps its exact
// curated SKUs; all other orders are derived deterministically from the row.
//
// Load AFTER vy-order.jsx, BEFORE the section apps (production/shipping/…).
// The standalone Vyonix Production.html does NOT load this — section files must
// fall back to their curated literal when window.VY_ORDER_SCOPE is absent.

(function () {
  const SAMPLE_ID = "ORD-2026-05-006";
  const RMB = 6.8;

  // Variant label palette + Amazon FCs for generated SKUs.
  const PALETTE = ["Black", "Gray", "Beige", "Navy", "Red", "Tan", "Brown", "Blue", "Charcoal", "Cream"];
  const FCS = ["ONT8", "LGB8", "SMF3", "FTW1", "MDW2"];

  function num(s) { const m = (s || "").match(/\$?([\d,]+(?:\.\d+)?)/); return m ? Number(m[1].replace(/,/g, "")) : 0; }
  function unitsOf(meta) { const m = (meta || "").match(/([\d,]+)\s*units/); return m ? Number(m[1].replace(/,/g, "")) : 0; }
  function skuCountOf(meta) { const m = (meta || "").match(/(\d+)\s*SKUs?/i); return m ? Number(m[1]) : 1; }

  function prefix(title) {
    const base = (title || "Order").split("—")[0];
    const words = base.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean);
    let p = words.map((w) => w[0]).join("").toUpperCase().slice(0, 4);
    if (p.length < 2) p = base.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3) || "ORD";
    return p;
  }
  function productName(title) { return (title || "Order").split("—")[0].trim(); }

  // Split a total into n parts that sum exactly (remainder on the first part).
  function splitUnits(total, n) {
    const each = Math.floor(total / n);
    const arr = Array(n).fill(each);
    arr[0] += total - each * n;
    return arr;
  }

  function toNum(v) { if (typeof v === "number") return v; return Number(String(v || "").replace(/,/g, "")) || 0; }

  // Generate a deterministic, internally-consistent SKU list for a non-sample order.
  function genSkus(order) {
    const meta = order.row && order.row.meta;
    const units = toNum(order.units) || unitsOf(meta) || 0;
    const n = Math.max(1, skuCountOf(meta));
    const total = order.orderTotalUsd || num(order.row && order.row.moneyTotal) || 0;
    const goods = Math.round(total * 0.88 * 100) / 100;          // goods ≈ 88% of order total
    const unitUsd = units ? Math.round((goods / units) * 100) / 100 : 0;
    const qtys = splitUnits(units, n);
    const px = prefix(order.title);
    const pname = productName(order.title);
    return qtys.map((qty, i) => {
      const variant = PALETTE[i % PALETTE.length];
      const line = Math.round(qty * unitUsd * 100) / 100;
      return {
        sku: px + "-" + String(i + 1).padStart(2, "0") + "-" + variant.slice(0, 3).toUpperCase(),
        name: pname + " · " + variant,
        short: pname + " " + variant,
        qty: qty,
        unitUsd: unitUsd,
        unitRmb: Math.round(unitUsd * RMB * 100) / 100,
        line: line,
        fc: FCS[i % FCS.length],
      };
    });
  }

  // Exact curated SKUs for the canonical sample order (must match Production /
  // Shipping / Closeout literals so the sample reads identically).
  const SAMPLE_SKUS = [
    { sku: "SEMI-BSC-1P-BLK", name: "Beaded seat cover · 1pc · Black", short: "Semi 1-pack black", qty: 450, unitRmb: 56.75, unitUsd: 8.34, line: 3755.51, fc: "ONT8" },
    { sku: "SEMI-BSC-2P-BLK", name: "Beaded seat cover · 2pc · Black", short: "Semi 2-pack black", qty: 350, unitRmb: 54.50, unitUsd: 8.01, line: 2805.15, fc: "ONT8" },
    { sku: "CAR-BSC-1P-BLK", name: "Beaded seat cover · 1pc · Car", short: "Car 1-pack black", qty: 450, unitRmb: 56.75, unitUsd: 8.34, line: 3755.51, fc: "LGB8" },
    { sku: "CAR-BSC-2P-BLK", name: "Beaded seat cover · 2pc · Car", short: "Car 2-pack black", qty: 350, unitRmb: 54.50, unitUsd: 8.01, line: 2805.15, fc: "LGB8" },
  ];

  function stageKeyOf(label) {
    if (typeof window.ordStatusKeyFromLabel === "function") return window.ordStatusKeyFromLabel(label);
    const s = (label || "").toLowerCase();
    if (/draft/.test(s)) return "draft";
    if (/inspect/.test(s)) return "inspection";
    if (/transit/.test(s)) return "transit";
    if (/at fba|received|fba/.test(s)) return "fba";
    if (/close/.test(s)) return "closed";
    return "production";
  }

  function buildScope(order) {
    order = order || window.VY_CURRENT_ORDER || {};
    const isSample = order.id === SAMPLE_ID;
    const meta = order.row && order.row.meta;
    const units = toNum(order.units) || unitsOf(meta) || (isSample ? 1600 : 0);
    const skus = isSample ? SAMPLE_SKUS : genSkus(order);
    const goodsUsd = isSample ? 13121.32 : Math.round(skus.reduce((a, s) => a + s.line, 0) * 100) / 100;
    const total = order.orderTotalUsd || num(order.row && order.row.moneyTotal) || 0;
    const stageKey = stageKeyOf(order.status && order.status.label);
    const stageRank = ["draft", "production", "inspection", "transit", "fba", "closed"].indexOf(stageKey);

    return {
      id: order.id,
      title: order.title,
      isSample: isSample,
      supplier: order.factory || "—",
      agent: order.agent && order.agent !== "Direct" ? order.agent : null,
      route: (order.row && order.row.route) || "Direct supplier",
      shipMode: (order.row && order.row.shipping) || "Sea LCL",
      skuCount: skus.length,
      units: units,
      goodsUsd: goodsUsd,
      totalUsd: total,
      paidUsd: order.paidUsd || 0,
      paidPct: order.paidPct || 0,
      balanceUsd: order.balanceDueUsd || 0,
      skus: skus,
      statusLabel: order.status && order.status.label,
      stageKey: stageKey,
      stageRank: stageRank,
      // lifecycle booleans the sections key off
      inProductionDone: stageRank >= 2,
      inspected: stageRank >= 2,         // inspection passes before shipping
      shipped: stageRank >= 3,
      received: stageRank >= 4,
      closed: stageRank >= 5,
      // non-goods cost pool for landed-cost estimates (exact for sample)
      nonGoods: isSample
        ? { feesByValue: 945.04, byUnitsPool: 1512.0 }
        : { feesByValue: Math.round(goodsUsd * 0.072 * 100) / 100, byUnitsPool: Math.round(goodsUsd * 0.115 * 100) / 100 },
    };
  }

  const SCOPE = buildScope();
  window.VY_ORDER_SCOPE = SCOPE;
  window.vyBuildScope = buildScope;
})();
