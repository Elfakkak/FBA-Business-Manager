// finances-data.jsx — company net + partner capital accounts (draws/distributions).
// The money model for a two-person LLC: every dollar in/out is an ENTRY; net,
// per-partner capital accounts, the settle-up imbalance, and per-account cash
// balances are all DERIVED from those entries + a small config.
//
// Accounting model (the correct shape for a 2-person pass-through LLC):
//   • Company NET = Σ revenue − Σ expense.  Draws are NOT expenses — they're
//     distributions of profit, so they never reduce net.
//   • Each partner is ENTITLED to (ownership share × cumulative net).
//   • A partner's net DRAWN = Σ their draws − Σ their contributions.
//   • Capital BALANCE = entitled − drawn  (positive = under-drawn / can still
//     take; negative = over-drawn / owes the company back).
//   • SETTLE-UP imbalance answers "who took more than their share": compares
//     each partner's draws to their share of TOTAL drawn so far. The over-drawer
//     should pay the under-drawer the difference to rebalance to the split.
//   • Tax reserve is an advisory cash bucket only — it does NOT change the
//     equity math (a pass-through owes tax on its share of net regardless).

const FIN_CONFIG_KEY = "vy_finances_config_v1";
const FIN_ENTRIES_KEY = "vy_finances_v2";
const FIN_INBOX_KEY = "vy_finances_inbox_v2";   // synced txns awaiting categorization
const FIN_RULES_KEY = "vy_finances_rules_v1";   // auto-categorization rules

const FIN_DEFAULT_CONFIG = {
  partners: [
    { id: "me", name: "You (Simo)", initials: "SI", share: 0.5 },
    { id: "partner", name: "Youness", initials: "YO", share: 0.5 },
  ],
  accounts: [
    { id: "mercury", name: "Mercury", kind: "bank", opening: 8000 },
    { id: "cash", name: "Cash", kind: "cash", opening: 1800 },
  ],
  taxReservePct: 0.25, // advisory set-aside for taxes
};

// ---- seed: 4 months (Feb–May 2026) of a realistic FBA private-label P&L ----
// Net by month: Feb 9,330 · Mar 10,560 · Apr 9,710 · May 12,570  → cum 42,170.
// Draws: partner 16,500 / me 10,000 (some months I took more, some he did).
// Revenue = Amazon payouts, which are ALREADY NET of Amazon's deductions
// (referral + FBA fees + your PPC ad spend) — Amazon withholds those before
// paying out, so they are NOT separate bank expenses. Supplier/freight/agent/
// inspection costs are NOT seeded here — they fold in automatically from
// Payables (finPayablesExpenses). What remains seeded: software, cash, draws.
const FIN_SEED = [
  // ---- Founding capital ----
  { id: "c-youness-1", date: "2026-01-10", kind: "contribution", partner: "partner", amount: 10000, account: "mercury", source: "manual", note: "Initial capital contribution — Youness" },
  // ---- February ----
  { id: "f01", date: "2026-02-04", kind: "revenue", partner: null, amount: 21400, account: "mercury", source: "amazon", note: "Amazon payout — Feb (net of fees & ads)" },
  { id: "f04", date: "2026-02-12", kind: "expense", partner: null, amount: 290, account: "mercury", note: "Software (Helium10, etc.)" },
  { id: "f05", date: "2026-02-18", kind: "expense", partner: null, amount: 180, account: "cash", note: "Local courier / misc" },
  { id: "f06", date: "2026-02-25", kind: "draw", partner: "partner", amount: 4000, account: "mercury", note: "Monthly draw" },
  { id: "f07", date: "2026-02-25", kind: "draw", partner: "me", amount: 2000, account: "mercury", note: "Monthly draw" },
  // ---- March ----
  { id: "m01", date: "2026-03-05", kind: "revenue", partner: null, amount: 24900, account: "mercury", source: "amazon", note: "Amazon payout — Mar (net of fees & ads)" },
  { id: "m04", date: "2026-03-12", kind: "expense", partner: null, amount: 290, account: "mercury", note: "Software" },
  { id: "m05", date: "2026-03-20", kind: "expense", partner: null, amount: 350, account: "cash", note: "Inspection fee (cash)" },
  { id: "m06", date: "2026-03-26", kind: "draw", partner: "partner", amount: 4000, account: "mercury", note: "Monthly draw" },
  { id: "m07", date: "2026-03-26", kind: "draw", partner: "me", amount: 3500, account: "mercury", note: "Monthly draw — took more this month" },
  // ---- April ----
  { id: "a01", date: "2026-04-04", kind: "revenue", partner: null, amount: 19800, account: "mercury", source: "amazon", note: "Amazon payout — Apr (net of fees & ads)" },
  { id: "a04", date: "2026-04-12", kind: "expense", partner: null, amount: 290, account: "mercury", note: "Software" },
  { id: "a05", date: "2026-04-24", kind: "draw", partner: "partner", amount: 4500, account: "mercury", note: "Monthly draw — took more this month" },
  { id: "a06", date: "2026-04-24", kind: "draw", partner: "me", amount: 2000, account: "mercury", note: "Monthly draw" },
  { id: "a07", date: "2026-04-28", kind: "draw", partner: "me", amount: 500, account: "cash", note: "Cash draw" },
  // ---- May ----
  { id: "y01", date: "2026-05-05", kind: "revenue", partner: null, amount: 28600, account: "mercury", source: "amazon", note: "Amazon payout — May (net of fees & ads)" },
  { id: "y04", date: "2026-05-12", kind: "expense", partner: null, amount: 290, account: "mercury", note: "Software" },
  { id: "y05", date: "2026-05-16", kind: "expense", partner: null, amount: 240, account: "cash", note: "Product samples (cash)" },
  { id: "y06", date: "2026-05-26", kind: "draw", partner: "partner", amount: 4000, account: "mercury", note: "Monthly draw" },
  { id: "y07", date: "2026-05-26", kind: "draw", partner: "me", amount: 2000, account: "mercury", note: "Monthly draw" },
];

// ---- persistence ----
// Partners (owners + split) are sourced from Team & roles via team-data.jsx —
// the single source of truth for people. Accounts + tax reserve stay here.
function finLoadConfig() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(FIN_CONFIG_KEY) || "null") || {}; } catch (e) {}
  const base = JSON.parse(JSON.stringify(FIN_DEFAULT_CONFIG));
  const fromTeam = (typeof teamFinPartners === "function") ? teamFinPartners() : null;
  return {
    partners: (fromTeam && fromTeam.length) ? fromTeam : (raw.partners || base.partners),
    accounts: raw.accounts || base.accounts,
    taxReservePct: raw.taxReservePct != null ? raw.taxReservePct : base.taxReservePct,
  };
}
function finSaveConfig(cfg) {
  // Never persist partners here — Team & roles owns them. Save accounts + tax.
  const toSave = { accounts: cfg.accounts, taxReservePct: cfg.taxReservePct };
  try { localStorage.setItem(FIN_CONFIG_KEY, JSON.stringify(toSave)); } catch (e) {}
}
function finLoadEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(FIN_ENTRIES_KEY) || "null");
    if (Array.isArray(raw)) return raw.map(finMigrateEntry);
  } catch (e) {}
  return JSON.parse(JSON.stringify(FIN_SEED));
}
// Backfill the `source` tag on older saved entries (added after first release):
// Amazon settlement payouts are the synced top-line revenue.
function finMigrateEntry(e) {
  if (e && e.source == null) {
    if (e.kind === "revenue" && /amazon|payout|settlement/i.test(e.note || "")) return { ...e, source: "amazon" };
    return { ...e, source: "manual" };
  }
  return e;
}
function finSaveEntries(entries) {
  try { localStorage.setItem(FIN_ENTRIES_KEY, JSON.stringify(entries)); } catch (e) {}
}
function finResetSeed() {
  try {
    localStorage.removeItem(FIN_ENTRIES_KEY); localStorage.removeItem(FIN_CONFIG_KEY);
    localStorage.removeItem(FIN_INBOX_KEY); localStorage.removeItem(FIN_RULES_KEY);
    if (typeof payResetApplied === "function") payResetApplied();
  } catch (e) {}
}

// ======================================================================
// REVIEW INBOX — raw synced transactions awaiting categorization.
// A bank/Seller-Central feed only gives raw money movements; meaning is
// assigned here (auto-suggested from source + open-invoice match + rules,
// confirmed into the ledger). `desc` is the raw memo as it'd arrive.
// ======================================================================
const FIN_INBOX_SEED = [
  { id: "t01", date: "2026-06-02", source: "amazon",  direction: "in",  amount: 26800, account: "mercury", desc: "AMAZON PAYMENTS — settlement payout" },
  { id: "t02", date: "2026-06-02", source: "mercury", direction: "out", amount: 842.00, account: "mercury", desc: "Wire — Yiwu Ocean Logistics" },
  { id: "t03", date: "2026-06-03", source: "mercury", direction: "out", amount: 3200.00, account: "mercury", desc: "Wire — Flexport Inc freight" },
  { id: "t04", date: "2026-06-03", source: "mercury", direction: "out", amount: 312.00, account: "mercury", desc: "ULINE — shipping supplies" },
  { id: "t05", date: "2026-06-04", source: "mercury", direction: "out", amount: 4000.00, account: "mercury", desc: "Transfer to ···8821 (Youness)" },
  { id: "t06", date: "2026-06-04", source: "mercury", direction: "out", amount: 2000.00, account: "mercury", desc: "Transfer to ···2093 (Simo)" },
  { id: "t07", date: "2026-06-05", source: "mercury", direction: "out", amount: 600.00, account: "mercury", desc: "Zelle — J. Carter" },
  { id: "t08", date: "2026-06-05", source: "mercury", direction: "out", amount: 14.00, account: "mercury", desc: "Mercury wire fee" },
];

// Seed rules so recurring transfers to each owner's personal account auto-tag
// as that owner's draw (the human-judgment ones you'd otherwise assign by hand).
const FIN_RULES_SEED = [
  { id: "r1", match: "8821", kind: "draw", partner: "partner", label: "Transfers to ···8821 → Youness draw" },
  { id: "r2", match: "2093", kind: "draw", partner: "me", label: "Transfers to ···2093 → my draw" },
];

function finInboxLoad() {
  try { const raw = JSON.parse(localStorage.getItem(FIN_INBOX_KEY) || "null"); if (Array.isArray(raw)) return raw; } catch (e) {}
  return JSON.parse(JSON.stringify(FIN_INBOX_SEED));
}
function finInboxSave(list) { try { localStorage.setItem(FIN_INBOX_KEY, JSON.stringify(list)); } catch (e) {} }
function finRulesLoad() {
  try { const raw = JSON.parse(localStorage.getItem(FIN_RULES_KEY) || "null"); if (Array.isArray(raw)) return raw; } catch (e) {}
  return JSON.parse(JSON.stringify(FIN_RULES_SEED));
}
function finRulesSave(list) { try { localStorage.setItem(FIN_RULES_KEY, JSON.stringify(list)); } catch (e) {} }

function finOpenInvoices() {
  if (typeof PAY_INVOICES === "undefined") return [];
  return PAY_INVOICES.filter((i) => (typeof payBalance === "function" ? payBalance(i) : (i.total - i.paid)) > 0.005);
}

// Supplier / freight / agent / inspection spend FOLDS IN from Payables — every
// amount actually PAID on an order's vendor bills is a real company expense, so
// it counts toward net automatically (no re-typing). These are DERIVED, READ-
// ONLY ledger rows (edit them in the order's Invoices section, not here),
// tagged source "payables" with a link back to the order.
function finPayablesExpenses() {
  if (typeof PAY_INVOICES === "undefined") return [];
  const paidOf = (i) => (typeof payEffectivePaid === "function") ? payEffectivePaid(i) : (i.paid || 0);
  return PAY_INVOICES.filter((i) => paidOf(i) > 0.005).map((i) => {
    const issued = new Date((i.issued || "2026-01-01") + "T00:00:00");
    const d = new Date(issued.getTime() + 3 * 86400000);
    return {
      id: "pay-" + i.id,
      date: d.toISOString().slice(0, 10),
      kind: "expense", partner: null, amount: Math.round(paidOf(i) * 100) / 100,
      account: "mercury", source: "payables",
      note: i.vendor + " — " + (i.vendorType || "bill") + " · " + i.id,
      orderId: i.orderId, invoiceId: i.id, locked: true,
    };
  });
}
// The full ledger = manual entries + the Payables-derived expenses.
function finAllEntries(entries) {
  entries = entries || finLoadEntries();
  return entries.concat(finPayablesExpenses());
}

// Auto-suggest an assignment for a raw transaction. Order: rules → Amazon
// revenue → open-invoice match → expense keywords → unassigned (needs review).
function finSuggest(txn, openInvoices, rules) {
  rules = rules || [];
  const desc = (txn.desc || "").toLowerCase();
  for (const r of rules) {
    if (r.match && desc.includes(String(r.match).toLowerCase())) {
      return { kind: r.kind, partner: r.partner || null, account: txn.account, source: "manual", invoiceId: null, reason: "Rule: " + (r.label || r.match), confidence: "high" };
    }
  }
  if (txn.direction === "in") {
    if (txn.source === "amazon" || /amazon/.test(desc))
      return { kind: "revenue", partner: null, account: txn.account, source: "amazon", invoiceId: null, reason: "Amazon payout → revenue", confidence: "high" };
    return { kind: "revenue", partner: null, account: txn.account, source: "manual", invoiceId: null, reason: "Money in → revenue", confidence: "low" };
  }
  // outgoing — match an open supplier/vendor bill
  const inv = (openInvoices || []).find((i) => {
    const v = (i.vendor || "").toLowerCase();
    const firstWord = v.split(/\s+/)[0];
    const nameHit = firstWord && firstWord.length > 2 && desc.includes(firstWord);
    const bal = typeof payBalance === "function" ? payBalance(i) : (i.total - i.paid);
    const amtHit = Math.abs(bal - txn.amount) < 0.5 || Math.abs(i.total - txn.amount) < 0.5;
    return nameHit && amtHit ? true : nameHit || amtHit;
  });
  if (inv) return { kind: "expense", partner: null, account: txn.account, source: "manual", invoiceId: inv.id, orderId: inv.orderId, reason: "Matches open bill " + inv.id, confidence: "high" };
  if (/advertis|ppc|\bads\b|software|fee|subscription/.test(desc))
    return { kind: "expense", partner: null, account: txn.account, source: "manual", invoiceId: null, reason: "Likely a business expense", confidence: "med" };
  return null; // needs review
}

// ---- formatting ----
function finFmt(n, opts) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(Math.round(n));
  return sign + "$" + v.toLocaleString();
}
function finFmtSigned(n) { return (n > 0 ? "+" : n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n)).toLocaleString(); }

const FIN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function finMonthKey(date) { return (date || "").slice(0, 7); } // YYYY-MM
function finMonthLabel(key) {
  const [y, m] = key.split("-");
  return FIN_MONTHS[Number(m) - 1] + " " + y.slice(2);
}

// ---- THE derivation: entries + config → everything the UI shows ----
function finDerive(entries, config) {
  entries = entries || finLoadEntries();
  config = config || finLoadConfig();
  const partners = config.partners;
  // fold in the Payables-derived supplier expenses (real paid vendor bills)
  const all = (typeof finPayablesExpenses === "function") ? entries.concat(finPayablesExpenses()) : entries;

  let totalRevenue = 0, totalExpense = 0;
  let amazonRevenue = 0, manualRevenue = 0;
  let lastAmazonPayout = null;
  const drawnByPartner = {}; // net draws (draws − contributions)
  partners.forEach((p) => { drawnByPartner[p.id] = 0; });

  // cash flow per account
  const flow = {};
  config.accounts.forEach((a) => { flow[a.id] = { inflow: 0, outflow: 0 }; });

  // month buckets
  const monthMap = {};
  function bucket(k) {
    if (!monthMap[k]) monthMap[k] = { key: k, revenue: 0, expense: 0, draws: 0 };
    return monthMap[k];
  }

  all.forEach((e) => {
    const amt = Number(e.amount) || 0;
    const mk = finMonthKey(e.date);
    const acct = flow[e.account] || (flow[e.account] = { inflow: 0, outflow: 0 });
    if (e.kind === "revenue") {
      totalRevenue += amt; bucket(mk).revenue += amt; acct.inflow += amt;
      if (e.source === "amazon") { amazonRevenue += amt; if (!lastAmazonPayout || e.date > lastAmazonPayout) lastAmazonPayout = e.date; }
      else manualRevenue += amt;
    } else if (e.kind === "expense") {
      totalExpense += amt; bucket(mk).expense += amt; acct.outflow += amt;
    } else if (e.kind === "draw") {
      if (e.partner in drawnByPartner) drawnByPartner[e.partner] += amt;
      bucket(mk).draws += amt; acct.outflow += amt;
    } else if (e.kind === "contribution") {
      if (e.partner in drawnByPartner) drawnByPartner[e.partner] -= amt;
      acct.inflow += amt;
    }
  });

  const cumNet = totalRevenue - totalExpense;
  let totalDrawn = 0;
  partners.forEach((p) => { totalDrawn += drawnByPartner[p.id]; });
  const retained = cumNet - totalDrawn;

  // per-partner capital accounts + draw-fairness imbalance
  const partnerRows = partners.map((p) => {
    const entitled = p.share * cumNet;
    const drawn = drawnByPartner[p.id];
    const fairOfDrawn = p.share * totalDrawn; // their share of what's been distributed
    return {
      id: p.id, name: p.name, initials: p.initials, share: p.share,
      entitled: entitled,
      drawn: drawn,
      balance: entitled - drawn,         // can still take (>0) / over-drawn (<0)
      imbalance: drawn - fairOfDrawn,    // >0 over-drawn vs split, <0 under-drawn
    };
  });

  // settle-up (two-partner): the over-drawer pays the under-drawer |imbalance|.
  let settle = null;
  if (partnerRows.length === 2) {
    const over = partnerRows.find((r) => r.imbalance > 0.5);
    const under = partnerRows.find((r) => r.imbalance < -0.5);
    if (over && under) {
      settle = { fromId: over.id, fromName: over.name, toId: under.id, toName: under.name, amount: over.imbalance };
    }
  }

  // cash accounts
  const accounts = config.accounts.map((a) => {
    const f = flow[a.id] || { inflow: 0, outflow: 0 };
    return { id: a.id, name: a.name, kind: a.kind, opening: a.opening || 0, inflow: f.inflow, outflow: f.outflow, balance: (a.opening || 0) + f.inflow - f.outflow };
  });
  const cashOnHand = accounts.reduce((n, a) => n + a.balance, 0);

  // months sorted ascending, with running retained
  const months = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key)).map((m) => ({
    key: m.key, label: finMonthLabel(m.key),
    revenue: m.revenue, expense: m.expense, net: m.revenue - m.expense, draws: m.draws,
  }));

  return {
    totalRevenue, totalExpense, cumNet, totalDrawn, retained,
    amazonRevenue, manualRevenue, lastAmazonPayout,
    partners: partnerRows, settle, accounts, cashOnHand, months,
    taxReserve: Math.max(0, cumNet) * (config.taxReservePct || 0),
    taxReservePct: config.taxReservePct || 0,
  };
}

Object.assign(window, {
  FIN_CONFIG_KEY, FIN_ENTRIES_KEY, FIN_INBOX_KEY, FIN_RULES_KEY, FIN_DEFAULT_CONFIG, FIN_SEED, FIN_MONTHS,
  finLoadConfig, finSaveConfig, finLoadEntries, finSaveEntries, finResetSeed,
  finFmt, finFmtSigned, finMonthKey, finMonthLabel, finDerive,
  FIN_INBOX_SEED, FIN_RULES_SEED, finInboxLoad, finInboxSave, finRulesLoad, finRulesSave,
  finOpenInvoices, finSuggest, finPayablesExpenses, finAllEntries,
});
