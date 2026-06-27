// variant-data.jsx — per-SKU dossier helpers (the variant is the atom the whole
// app keys on). Two jobs:
//   1. varInventory(sku)  → the live FBA position for one SKU (INV_ROWS + invStats)
//   2. varHistory(v)      → a deterministic run-over-run history for one SKU
//      (orders that included it → units → billed → landed/unit → received →
//      sell-through). Real per-order line history doesn't exist in the seed
//      (orders carry only a meta string), so this is DERIVED deterministically
//      from the SKU's real fields (last cost, velocity) the same way the rest of
//      the app uses representative seed data. Stable per SKU (hash-seeded).
//
// Load AFTER catalog-data.jsx + inventory-data.jsx. Pure data — no UI.

(function () {
  function round2(n) { return Math.round(n * 100) / 100; }

  // deterministic PRNG so a SKU's history never changes between renders
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // The live FBA position for one SKU (from the shared inventory model).
  function varInventory(sku) {
    const rows = (typeof INV_ROWS !== "undefined" && INV_ROWS) || [];
    const row = rows.find((r) => r.sku === sku);
    if (!row) return null;
    const stats = (typeof invStats === "function") ? invStats(row) : {};
    return { row, stats };
  }

  // Sample order's curated SKUs link to a real order page; others stay as plain
  // historical PO references (no dead links).
  const SAMPLE_ORDER = "ORD-2026-05-006";
  const SAMPLE_SKUS = ["SEMI-BSC-1P-BLK", "SEMI-BSC-2P-BLK", "CAR-BSC-1P-BLK", "CAR-BSC-2P-BLK", "TRUCK-BSC-1P-BLK", "TRUCK-BSC-2P-BLK"];

  const MONTHS = ["Aug 2025", "Oct 2025", "Dec 2025", "Feb 2026", "Apr 2026", "May 2026"];

  // Build a run-over-run history for one variant. Newest last.
  function varHistory(v) {
    if (!v || !v.sku) return { runs: [], totals: null };
    const seed = hash(v.sku);
    const rnd = mulberry32(seed);
    const baseCost = Number(v.lastCostUsd) || round2((Number(v.lastCostRmb) || 0) / 7.1) || 0;
    const inv = varInventory(v.sku);
    const velocity = inv ? inv.row.velocity : 2;

    const n = 2 + (seed % 3); // 2–4 runs
    const runs = [];
    for (let i = 0; i < n; i++) {
      const fromEnd = n - 1 - i;             // 0 = most recent
      // most recent run uses the SKU's real last cost; older runs drift a little
      const drift = 1 - fromEnd * 0.025 + (rnd() - 0.5) * 0.08;
      const unitBilled = round2(Math.max(0.5, baseCost * drift));
      // run size scales with sales velocity, rounded to a tidy MOQ-ish number
      const base = Math.max(100, Math.round((velocity * 60) / 50) * 50);
      const units = Math.max(50, Math.round((base * (0.8 + rnd() * 0.6)) / 50) * 50);
      const landedMult = 1.18 + rnd() * 0.16;  // landed = billed + freight/duty/fees share
      const landedUnit = round2(unitBilled * landedMult);
      const shortPct = rnd() < 0.25 ? rnd() * 0.04 : 0;   // occasional FBA receiving short
      const received = Math.round(units * (1 - shortPct));
      const sellThrough = Math.min(100, Math.round(60 + rnd() * 38));
      const mi = MONTHS.length - 1 - fromEnd;
      runs.push({
        date: MONTHS[Math.max(0, mi)],
        po: SAMPLE_SKUS.includes(v.sku) && fromEnd === 0 ? SAMPLE_ORDER : ("PO-" + (1000 + ((seed >> (i * 3)) & 0x3ff)).toString().slice(0, 4)),
        orderHref: SAMPLE_SKUS.includes(v.sku) && fromEnd === 0 ? ("Vyonix Order Shell.html?order=" + SAMPLE_ORDER) : null,
        units, unitBilled, landedUnit, received, sellThrough,
        spend: round2(units * unitBilled),
        current: fromEnd === 0,
        short: units - received,
      });
    }

    const totalUnits = runs.reduce((s, r) => s + r.units, 0);
    const totalSpend = round2(runs.reduce((s, r) => s + r.spend, 0));
    const totalReceived = runs.reduce((s, r) => s + r.received, 0);
    const avgLanded = round2(runs.reduce((s, r) => s + r.landedUnit * r.units, 0) / (totalUnits || 1));
    const avgBilled = round2(totalSpend / (totalUnits || 1));
    const avgSell = Math.round(runs.reduce((s, r) => s + r.sellThrough, 0) / runs.length);
    // cost trend: most recent vs first run unit billed
    const first = runs[0].unitBilled, last = runs[runs.length - 1].unitBilled;
    const costTrendPct = first ? Math.round(((last - first) / first) * 100) : 0;

    return {
      runs,
      totals: { runCount: runs.length, totalUnits, totalSpend, totalReceived, avgLanded, avgBilled, avgSell, costTrendPct },
    };
  }

  Object.assign(window, { varInventory, varHistory });
})();
