// payterms-data.jsx — structured supplier PAYMENT TERMS for an order.
// Free-text "30% / 70%" lived on the supplier profile; this turns the term into
// a typed model (T/T, L/C, O/A, D/P, D/A) that (for T/T) drives a deposit →
// balance milestone schedule tied to the real supplier-invoice total & paid.
// Each type carries a plain-English blurb so the term is self-explaining.
// Persisted per orderId. Load BEFORE invoices-app.jsx (after payables-data.jsx).

// ----------------------------------------------------------------------
// Term catalogue — the terms a China-import seller actually meets.
// `milestones(total, depositPct)` returns the payment steps for that term.
// ----------------------------------------------------------------------
const PAYTERM_TYPES = [
  {
    key: "TT",
    label: "T/T",
    name: "Telegraphic Transfer (bank wire)",
    blurb: "A direct bank wire, normally split into a deposit to start production and a balance before the goods ship. The most common term for China factories — fast, but unsecured, so trust matters.",
    hasDeposit: true,
  },
  {
    key: "LC",
    label: "L/C",
    name: "Letter of Credit",
    blurb: "Your bank guarantees payment to the supplier once they present shipping documents that match the L/C exactly. Safest for large or first-time orders, but slower and carries bank fees. Needs an issue and expiry date.",
    hasDeposit: false,
  },
  {
    key: "OA",
    label: "O/A",
    name: "Open Account",
    blurb: "You receive the goods first and pay later — net 30/60/90 days after shipment. Best cash flow for you; only offered by suppliers who already trust you.",
    hasDeposit: false,
  },
  {
    key: "DP",
    label: "D/P",
    name: "Documents against Payment",
    blurb: "The bank releases the shipping documents (which you need to collect the goods) only after you pay in full. A middle ground — safer than T/T balance, cheaper than an L/C.",
    hasDeposit: false,
  },
  {
    key: "DA",
    label: "D/A",
    name: "Documents against Acceptance",
    blurb: "You get the documents by accepting (signing) a draft to pay on a future date. Effectively short-term credit from the supplier, secured by your accepted draft.",
    hasDeposit: false,
  },
];

const PAYTERM_BY_KEY = PAYTERM_TYPES.reduce((m, t) => { m[t.key] = t; return m; }, {});

// Common T/T deposit splits offered as quick presets.
const PAYTERM_TT_PRESETS = [30, 50, 0, 100];

// ----------------------------------------------------------------------
// Persistence — per-order term config: { type, depositPct, netDays }.
// ----------------------------------------------------------------------
const PAYTERM_KEY = "vy_payment_terms_v1";
function payTermLoadAll() {
  try { const r = localStorage.getItem(PAYTERM_KEY); const o = r ? JSON.parse(r) : {}; return o && typeof o === "object" ? o : {}; }
  catch (e) { return {}; }
}
function payTermFor(orderId) {
  const cfg = payTermLoadAll()[orderId];
  if (cfg && cfg.type) return cfg;
  return payTermDefault(orderId);
}
function payTermSave(orderId, cfg) {
  const all = payTermLoadAll();
  all[orderId] = cfg;
  try { localStorage.setItem(PAYTERM_KEY, JSON.stringify(all)); } catch (e) {}
  return cfg;
}

// Seed sensible defaults per order (and infer from the supplier's free-text
// "30% / 70%" profile note when we can) so the card is never empty on arrival.
const PAYTERM_SEED = {
  "ORD-2026-05-006": { type: "TT", depositPct: 30, netDays: 0 },
  "ORD-2026-05-004": { type: "TT", depositPct: 30, netDays: 0 },
  "ORD-2026-05-003": { type: "TT", depositPct: 40, netDays: 0 },
  "ORD-2026-05-002": { type: "TT", depositPct: 50, netDays: 0 },
  "ORD-2026-04-012": { type: "TT", depositPct: 50, netDays: 0 },
  "ORD-2026-05-008": { type: "TT", depositPct: 30, netDays: 0 },
};
function payTermDefault(orderId) {
  if (PAYTERM_SEED[orderId]) return { ...PAYTERM_SEED[orderId] };
  return { type: "TT", depositPct: 30, netDays: 0 };
}

// Parse a free-text supplier note like "30% deposit / 70% before ship" → pct.
function payTermDepositFromText(text) {
  if (!text) return null;
  const m = String(text).match(/(\d{1,3})\s*%/);
  if (m) { const n = Number(m[1]); if (n >= 0 && n <= 100) return n; }
  return null;
}

// ----------------------------------------------------------------------
// Schedule — given a config + the supplier-invoice total & paid-to-date,
// produce the ordered milestones with amount + paid/due status. Payments are
// applied to milestones in order (deposit first, then balance).
// ----------------------------------------------------------------------
function payTermSchedule(cfg, total, paid) {
  total = Number(total) || 0;
  paid = Number(paid) || 0;
  const type = (cfg && cfg.type) || "TT";
  let steps = [];
  if (type === "TT") {
    const dep = Math.max(0, Math.min(100, Number(cfg.depositPct) || 0));
    if (dep > 0 && dep < 100) {
      steps = [
        { label: "Deposit", when: "To start production", pct: dep, amount: Math.round(total * dep) / 100 },
        { label: "Balance", when: "Before goods ship", pct: 100 - dep, amount: Math.round(total * (100 - dep)) / 100 },
      ];
    } else if (dep >= 100) {
      steps = [{ label: "Full payment", when: "Upfront, before production", pct: 100, amount: total }];
    } else {
      steps = [{ label: "Full payment", when: "Before goods ship", pct: 100, amount: total }];
    }
  } else if (type === "OA") {
    const nd = Number(cfg.netDays) || 30;
    steps = [{ label: "Full payment", when: "Net " + nd + " days after shipment", pct: 100, amount: total }];
  } else if (type === "LC") {
    steps = [{ label: "L/C settlement", when: "On compliant document presentation", pct: 100, amount: total }];
  } else if (type === "DP") {
    steps = [{ label: "Full payment", when: "To release shipping documents", pct: 100, amount: total }];
  } else if (type === "DA") {
    steps = [{ label: "Accepted draft", when: "Payable at draft maturity", pct: 100, amount: total }];
  }
  // apply paid amount across steps in order
  let remaining = paid;
  return steps.map((s) => {
    const covered = Math.min(s.amount, Math.max(0, remaining));
    remaining -= covered;
    const settled = covered >= s.amount - 0.005 && s.amount > 0;
    return { ...s, paidAmt: covered, settled, partial: covered > 0.005 && !settled };
  });
}

// Short one-line summary for headers/badges, e.g. "T/T 30 / 70".
function payTermSummary(cfg) {
  const t = PAYTERM_BY_KEY[(cfg && cfg.type) || "TT"];
  if (!t) return "—";
  if (t.key === "TT") {
    const d = Number(cfg.depositPct) || 0;
    if (d <= 0) return "T/T · balance before ship";
    if (d >= 100) return "T/T · 100% upfront";
    return "T/T · " + d + " / " + (100 - d);
  }
  if (t.key === "OA") return "O/A · net " + (Number(cfg.netDays) || 30);
  return t.label + " · " + t.name;
}

Object.assign(window, {
  PAYTERM_TYPES, PAYTERM_BY_KEY, PAYTERM_TT_PRESETS, PAYTERM_SEED,
  payTermFor, payTermSave, payTermDefault, payTermDepositFromText,
  payTermSchedule, payTermSummary,
});
