// recurring-data.jsx — RECURRING operating expenses (the fixed overhead that
// hits every period regardless of sales): salaries/VA, software subscriptions,
// product photography, business cards/branding, prep-center retainers, etc.
// Each item has a cadence (daily / monthly / yearly) normalized to a MONTHLY
// cost so it can be deducted from each month's Amazon payout in the P&L.
// Persisted to localStorage. Load before finances-pnl.jsx.

const RECUR_KEY = "vy_recurring_v1";
const RECUR_CATEGORIES = ["Salary / VA", "Software", "Photography", "Branding", "Prep / 3PL", "Subscription", "Other"];
const RECUR_DAYS_PER_MONTH = 30.4375; // avg days/month

function recurSeed() {
  return [
    { id: "rc-soft", name: "Helium 10 + tools", category: "Software", amount: 290, cadence: "monthly", startDate: "2026-01-01", matchText: "software", note: "" },
    { id: "rc-va", name: "Virtual assistant", category: "Salary / VA", amount: 800, cadence: "monthly", startDate: "2026-01-01", matchText: "", note: "Part-time listing + support" },
    { id: "rc-photo", name: "Product photography retainer", category: "Photography", amount: 1800, cadence: "yearly", startDate: "2026-01-01", matchText: "", note: "Annual shoot package" },
    { id: "rc-brand", name: "Business cards + branding", category: "Branding", amount: 240, cadence: "yearly", startDate: "2026-01-01", matchText: "", note: "" },
  ];
}

function recurLoad() {
  try { const a = JSON.parse(localStorage.getItem(RECUR_KEY) || "null"); if (Array.isArray(a)) return a; } catch (e) {}
  const s = recurSeed(); recurSave(s); return s;
}
function recurSave(list) { try { localStorage.setItem(RECUR_KEY, JSON.stringify(list)); } catch (e) {} }
function recurUid() { return "rc-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

// Normalize any cadence to an equivalent MONTHLY cost.
function recurMonthly(item) {
  const amt = Number(item.amount) || 0;
  if (item.cadence === "daily") return amt * RECUR_DAYS_PER_MONTH;
  if (item.cadence === "yearly") return amt / 12;
  return amt; // monthly
}
// And to a DAILY cost (for the ~14-day settlement-window view).
function recurDaily(item) {
  const amt = Number(item.amount) || 0;
  if (item.cadence === "daily") return amt;
  if (item.cadence === "yearly") return amt / 365.25;
  return amt / RECUR_DAYS_PER_MONTH; // monthly → daily
}

// Total recurring overhead for a given month (only items active by then).
function recurForMonth(monthKey, list) {
  list = list || recurLoad();
  return list.reduce((sum, it) => {
    if (it.startDate && it.startDate.slice(0, 7) > monthKey) return sum; // not started yet
    return sum + recurMonthly(it);
  }, 0);
}
function recurMonthlyTotal(list) {
  list = list || recurLoad();
  return list.reduce((n, it) => n + recurMonthly(it), 0);
}

function recurAdd(item) {
  const list = recurLoad();
  list.push({ id: recurUid(), name: (item.name || "Expense").trim(), category: item.category || "Other", amount: Number(item.amount) || 0, cadence: item.cadence || "monthly", startDate: item.startDate || new Date().toISOString().slice(0, 10), matchText: item.matchText || "", note: item.note || "" });
  recurSave(list); return list;
}
function recurUpdate(id, patch) {
  const list = recurLoad().map((it) => (it.id === id ? { ...it, ...patch } : it));
  recurSave(list); return list;
}
function recurRemove(id) { const list = recurLoad().filter((it) => it.id !== id); recurSave(list); return list; }

// ---- RECONCILIATION against real bank transactions ----
// Like COGS reconciles to invoices, recurring overhead reconciles to the actual
// expense entries that cleared the bank. An item "matches" a manual expense
// entry (finLoadEntries, kind=expense) when the entry's note contains the
// item's matchText (or, if blank, the first word of its name). For a month:
//   • matched items   → their ACTUAL cash is already in the ledger's expenses,
//                        so we must NOT add the plan again (avoids double-count).
//   • unmatched items → no transaction logged, so the PLAN is added as forecast.
// Matching is OPT-IN: only an explicit matchText reconciles to bank expenses.
// (Auto-matching on the name caused false hits like "Product…" → "Product samples".)
function recurMatchKey(item) {
  return (item.matchText || "").trim().toLowerCase();
}
function recurActualForMonth(item, monthKey, entries) {
  entries = entries || ((typeof finLoadEntries === "function") ? finLoadEntries() : []);
  const key = recurMatchKey(item);
  if (!key) return 0;
  return entries
    .filter((e) => e && e.kind === "expense" && (e.date || "").slice(0, 7) === monthKey && (e.note || "").toLowerCase().includes(key))
    .reduce((n, e) => n + (Number(e.amount) || 0), 0);
}
// Per-month reconciliation summary across all items.
function recurReconcileMonth(monthKey, list, entries) {
  list = list || recurLoad();
  entries = entries || ((typeof finLoadEntries === "function") ? finLoadEntries() : []);
  let planned = 0, matchedActual = 0, addable = 0;
  list.forEach((it) => {
    if (it.startDate && it.startDate.slice(0, 7) > monthKey) return;
    const plan = recurMonthly(it);
    planned += plan;
    const actual = recurActualForMonth(it, monthKey, entries);
    if (actual > 0.005) matchedActual += actual;   // real cash, already in ledger opex
    else addable += plan;                          // forecast — add to P&L
  });
  return { planned, matchedActual, addable };
}
// What the P&L should ADD for recurring overhead in a month (forecast-only items).
function recurAddableForMonth(monthKey, list, entries) {
  return recurReconcileMonth(monthKey, list, entries).addable;
}

Object.assign(window, {
  RECUR_KEY, RECUR_CATEGORIES, recurLoad, recurSave, recurMonthly, recurDaily,
  recurForMonth, recurMonthlyTotal, recurAdd, recurUpdate, recurRemove,
  recurMatchKey, recurActualForMonth, recurReconcileMonth, recurAddableForMonth,
});
