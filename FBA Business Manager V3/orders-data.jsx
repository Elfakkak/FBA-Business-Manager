// Orders list data — KPIs, dummy orders, needs-attention queue

const ORDERS_KPI = [
  { label: "Open orders", value: "7", sub: "across 4 suppliers", kicker: "Activity" },
  { label: "Unpaid exposure", value: "$26,400", sub: "outstanding balance", kicker: "Money", tone: "warning" },
  { label: "Awaiting receipt", value: "2", sub: "supplier confirmation", kicker: "Production" },
  { label: "Inspection needed", value: "1", sub: "schedule inspector", kicker: "QC" },
  { label: "Shipping blockers", value: "2", sub: "payment or docs", kicker: "Ship", tone: "warning" },
  { label: "Ready to close", value: "1", sub: "calculate landed cost", kicker: "Landed cost", tone: "success" },
];

const NEEDS_ATTENTION = [
  {
    severity: "danger",
    headline: "Supplier receipt overdue",
    orderId: "ORD-2026-05-006",
    detail: "3d overdue",
  },
  {
    severity: "warning",
    headline: "Inspection not scheduled",
    orderId: "ORD-2026-05-004",
    detail: "due in 3d",
  },
  {
    severity: "warning",
    headline: "Balance due before shipping",
    orderId: "ORD-2026-05-003",
    detail: "$7,568",
  },
];

const ORDERS_LIST = [
  {
    id: "ORD-2026-05-006",
    title: "Q1 restock — Beaded seat covers",
    meta: "4 SKUs · 1,600 units · May 5",
    supplier: "Sheng Te Long",
    route: "via Mutual Trade Union",
    production: "Day 14 of 30",
    productionSub: "WIP photos due",
    moneyTotal: "$14,445.77 total",
    moneyDue: "$5,465.63 before shipping",
    moneyPct: "62% paid",
    moneySub: "Stage 4 pending",
    shipping: "Sea LCL",
    shippingSub: "Forwarder pending · FBA ETA Jun 24",
    proof: "5/12 filled",
    proofSub: "BOL missing · Packing list missing",
    nextStep: "Confirm supplier receipt",
    status: "In production",
    statusTone: "info",
  },
  {
    id: "ORD-2026-05-004",
    title: "Premium leather wraps — black/tan",
    meta: "2 SKUs · 800 units · Apr 28",
    supplier: "Huasheng Leather",
    route: "Direct supplier",
    production: "Day 22 of 25",
    productionSub: "Inspection window",
    moneyTotal: "$9,280.00 total",
    moneyDue: "$2,784.00 balance before ship",
    moneyPct: "70% paid",
    moneySub: "",
    shipping: "Air express",
    shippingSub: "DSV · ETA Jun 8",
    proof: "8/12 filled",
    proofSub: "Inspection report missing",
    nextStep: "Schedule inspection",
    status: "Inspection",
    statusTone: "warning",
  },
  {
    id: "ORD-2026-05-003",
    title: "Microfiber steering covers — 6 colors",
    meta: "6 SKUs · 2,400 units · Apr 20",
    supplier: "Ningbo Auto Trim",
    route: "via Mutual Trade Union",
    production: "Day 25 of 30",
    productionSub: "Inspection passed",
    moneyTotal: "$18,920.00 total",
    moneyDue: "$7,568.00 balance due before shipping",
    moneyPct: "60% paid",
    moneySub: "",
    shipping: "Sea FCL",
    shippingSub: "Flexport · ETA Jul 2",
    proof: "9/12 filled",
    proofSub: "Packing list attached",
    nextStep: "Pay balance before shipping",
    status: "In production",
    statusTone: "info",
  },
  {
    id: "ORD-2026-05-002",
    title: "Neoprene truck covers — XL series",
    meta: "3 SKUs · 900 units · Apr 15",
    supplier: "Fujian PU Goods",
    route: "Direct supplier",
    production: "Complete",
    productionSub: "Shipped",
    moneyTotal: "$7,240.00",
    moneyDue: "Paid in full",
    moneyPct: "",
    moneySub: "",
    shipping: "Sea LCL",
    shippingSub: "DSV · ETA Jun 18",
    proof: "10/12 filled",
    proofSub: "Customs docs pending",
    nextStep: "Track shipment ETA",
    status: "In transit",
    statusTone: "info",
  },
  {
    id: "ORD-2026-05-008",
    title: "Silicone grip covers — compact",
    meta: "2 SKUs · 500 units · May 8",
    supplier: "Shenzhen Wheel Co",
    route: "Direct supplier",
    production: "Day 7 of 20",
    productionSub: "Material cutting",
    moneyTotal: "$3,860.00 total",
    moneyDue: "$2,702 after QC pass",
    moneyPct: "30% paid",
    moneySub: "",
    shipping: "Sea LCL planned",
    shippingSub: "FBA not linked",
    proof: "3/12 filled",
    proofSub: "QC photos missing",
    nextStep: "Await QC photos",
    status: "In production",
    statusTone: "info",
  },
  {
    id: "ORD-2026-04-012",
    title: "Heated steering wheel kit — universal",
    meta: "1 SKU · 200 units · Mar 30",
    supplier: "Ningbo Auto Trim",
    route: "via Mutual Trade Union",
    production: "Complete",
    productionSub: "At FBA",
    moneyTotal: "$6,480.00",
    moneyDue: "Paid in full",
    moneyPct: "",
    moneySub: "",
    shipping: "Air express",
    shippingSub: "FBA received",
    proof: "11/12 filled",
    proofSub: "Landed cost ready",
    nextStep: "Close order",
    status: "At FBA",
    statusTone: "success",
  },
  {
    id: "ORD-2026-05-009",
    title: "Velour dashboard covers — sedan",
    meta: "3 SKUs · 600 units · May 10",
    supplier: "Huasheng Leather",
    route: "Direct supplier",
    production: "Draft",
    productionSub: "awaiting deposit",
    moneyTotal: "$4,520.00 total",
    moneyDue: "$1,356 deposit needed",
    moneyPct: "0% paid",
    moneySub: "",
    shipping: "TBD",
    shippingSub: "FBA not linked",
    proof: "1/12 filled",
    proofSub: "Supplier PO draft",
    nextStep: "Send deposit to start production",
    status: "Draft",
    statusTone: "muted",
  },
];

const FILTER_CHIPS = [
  "Needs payment",
  "Awaiting receipt",
  "In production",
  "Inspection needed",
  "Shipping blocker",
  "At FBA",
  "Ready to close",
  "Watch",
];

// ----------------------------------------------------------------------
// Shared draft-order persistence (localStorage). Drafts created via the
// create-order sheet survive reloads and prepend to the seed ORDERS_LIST.
// Mirrors the catalog store pattern (catLoadFamilies/…).
// ----------------------------------------------------------------------
const ORD_STORE_KEY = "vy_orders_drafts_v1";

function ordLoadDrafts() {
  try {
    const raw = localStorage.getItem(ORD_STORE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function ordSaveDrafts(list) {
  try {
    localStorage.setItem(ORD_STORE_KEY, JSON.stringify(list));
  } catch (e) {
    /* ignore quota / private-mode errors */
  }
}

function ordAddDraft(draft) {
  const list = ordLoadDrafts();
  list.unshift(draft);
  ordSaveDrafts(list);
  return draft;
}

function ordClearDrafts() {
  ordSaveDrafts([]);
}

// Persisted drafts first, then the seed list (dedupe by id). Applies saved
// title overrides (vy_order_titles_v1) so renames show everywhere.
function ordAllOrders() {
  const drafts = ordLoadDrafts();
  const seen = new Set(drafts.map((d) => d.id));
  let titles = {};
  try { titles = JSON.parse(localStorage.getItem("vy_order_titles_v1") || "{}") || {}; } catch (e) {}
  let statuses = {};
  try { statuses = JSON.parse(localStorage.getItem(ORD_STATUS_KEY) || "{}") || {}; } catch (e) {}
  return [...drafts, ...ORDERS_LIST.filter((o) => !seen.has(o.id))].map((o) => {
    let row = titles[o.id] ? { ...o, title: titles[o.id] } : o;
    const sk = statuses[o.id];
    if (sk) {
      const info = ordStatusInfo(sk);
      row = { ...row, status: info.label, statusTone: info.tone, nextStep: info.next };
    }
    row = (typeof ordApplyEdits === "function") ? ordApplyEdits(row) : row;
    return row;
  });
}

function ordRenameOrder(id, name) {
  try {
    const m = JSON.parse(localStorage.getItem("vy_order_titles_v1") || "{}");
    m[id] = name;
    localStorage.setItem("vy_order_titles_v1", JSON.stringify(m));
  } catch (e) {}
}

// ----------------------------------------------------------------------
// Per-order field EDITS (the Edit-order drawer). Canonical fields persisted
// per orderId and patched onto the row in ordAllOrders, so a saved edit shows
// in the list, the Order Shell identity, AND the derived per-order scope.
//   { supplier, agent, units, skuCount, totalUsd, placedOn, fbaEta }
// ----------------------------------------------------------------------
const ORD_EDITS_KEY = "vy_order_edits_v1";
function ordEditsStore() {
  try { const o = JSON.parse(localStorage.getItem(ORD_EDITS_KEY) || "{}"); return o && typeof o === "object" ? o : {}; }
  catch (e) { return {}; }
}
function ordEdits(id) { return (id && ordEditsStore()[id]) || null; }
function ordSaveEdits(id, patch) {
  if (!id) return;
  const s = ordEditsStore();
  s[id] = { ...(s[id] || {}), ...patch };
  try { localStorage.setItem(ORD_EDITS_KEY, JSON.stringify(s)); } catch (e) {}
}
function ordApplyEdits(order) {
  const e = ordEdits(order.id);
  if (!e) return order;
  const o = { ...order };
  if (e.supplier) o.supplier = e.supplier;
  if (e.agent != null) o.route = (e.agent && e.agent !== "Direct") ? ("via " + e.agent) : "Direct supplier";
  const curMeta = order.meta || "";
  const skuM = curMeta.match(/(\d+)\s*SKUs?/i);
  const unitM = curMeta.match(/([\d,]+)\s*units/i);
  const parts = curMeta.split("·").map((s) => s.trim()).filter(Boolean);
  const placed = e.placedOn || (parts.length ? parts[parts.length - 1] : "");
  const sku = e.skuCount != null ? e.skuCount : (skuM ? Number(skuM[1]) : 1);
  const units = e.units != null ? e.units : (unitM ? Number(unitM[1].replace(/,/g, "")) : 0);
  o.meta = sku + " SKU" + (sku === 1 ? "" : "s") + " · " + Number(units).toLocaleString() + " units" + (placed ? " · " + placed : "");
  if (e.totalUsd != null) o.moneyTotal = "$" + Number(e.totalUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " total";
  if (e.fbaEta) {
    const sub = order.shippingSub || "";
    o.shippingSub = /FBA ETA/i.test(sub) ? sub.replace(/FBA ETA\s*[A-Za-z0-9 ]+/i, "FBA ETA " + e.fbaEta) : (sub ? sub + " · FBA ETA " + e.fbaEta : "FBA ETA " + e.fbaEta);
  }
  return o;
}

// ----------------------------------------------------------------------
// Order STATUS engine (persisted, per order). The canonical lifecycle every
// order moves through. An order's status can be advanced one step at a time
// (or reset); overrides persist in localStorage and apply everywhere the
// order shows (the list, the Order Shell identity + journey + needs).
//   Draft → In production → Inspection → In transit → At FBA → Closed
// Each stage maps to the journey node it should highlight + the live
// next-action so the whole app stays internally consistent.
// ----------------------------------------------------------------------
const ORD_STATUS_KEY = "vy_order_status_v1";
const ORD_PIPELINE = [
  { key: "draft",      label: "Draft",         tone: "muted",   stage: "production", next: "Send deposit to start production" },
  { key: "production", label: "In production", tone: "info",    stage: "production", next: "Confirm supplier receipt" },
  { key: "inspection", label: "Inspection",    tone: "warning", stage: "inspection", next: "Schedule inspection" },
  { key: "transit",    label: "In transit",    tone: "info",    stage: "shipping",   next: "Track shipment to FBA" },
  { key: "fba",        label: "At FBA",        tone: "success", stage: "closeout",   next: "Reconcile receiving & landed cost" },
  { key: "closed",     label: "Closed",        tone: "success", stage: "closeout",   next: "Order closed" },
];

function ordStatusKeyFromLabel(label) {
  const s = (label || "").toLowerCase();
  if (/draft/.test(s)) return "draft";
  if (/inspect/.test(s)) return "inspection";
  if (/transit/.test(s)) return "transit";
  if (/at fba|received|fba/.test(s)) return "fba";
  if (/close/.test(s)) return "closed";
  return "production";
}
function ordStatusInfo(key) { return ORD_PIPELINE.find((p) => p.key === key) || ORD_PIPELINE[1]; }
function ordStatusMap() {
  try { return JSON.parse(localStorage.getItem(ORD_STATUS_KEY) || "{}") || {}; } catch (e) { return {}; }
}
// Effective status key for an order: explicit override, else derived from seed.
function ordStatusKey(id, seedLabel) {
  const m = ordStatusMap();
  return m[id] || ordStatusKeyFromLabel(seedLabel);
}
function ordSetStatus(id, key) {
  const m = ordStatusMap();
  m[id] = key;
  try { localStorage.setItem(ORD_STATUS_KEY, JSON.stringify(m)); } catch (e) {}
  // Notify any live view (e.g. the Order Shell journey) that status moved,
  // so it can re-read without a full reload.
  try { window.dispatchEvent(new CustomEvent("vy-order-status-changed", { detail: { id: id, key: key } })); } catch (e) {}
  return ordStatusInfo(key);
}
function ordAdvanceStatus(id, seedLabel) {
  const cur = ordStatusKey(id, seedLabel);
  const i = ORD_PIPELINE.findIndex((p) => p.key === cur);
  const next = ORD_PIPELINE[Math.min(i + 1, ORD_PIPELINE.length - 1)];
  return ordSetStatus(id, next.key);
}
function ordStepBackStatus(id, seedLabel) {
  const cur = ordStatusKey(id, seedLabel);
  const i = ORD_PIPELINE.findIndex((p) => p.key === cur);
  const prev = ORD_PIPELINE[Math.max(i - 1, 0)];
  return ordSetStatus(id, prev.key);
}
function ordResetStatus(id) {
  const m = ordStatusMap();
  delete m[id];
  try { localStorage.setItem(ORD_STATUS_KEY, JSON.stringify(m)); } catch (e) {}
}
function ordStageForStatus(label) { return ordStatusInfo(ordStatusKeyFromLabel(label)).stage; }

// ----------------------------------------------------------------------
// DATA-DRIVEN STATUS — section milestones auto-advance the order.
// ----------------------------------------------------------------------
// Sections report a milestone (inspection passed, all inbounds received,
// closeout locked + bills settled). `ordAdvanceToAtLeast` moves the order
// FORWARD ONLY to the milestone's stage — it never regresses an order, so a
// manual Step-back stays put and the manual Advance/Reset remain the override.
function ordRankOf(key) {
  const i = ORD_PIPELINE.findIndex((p) => p.key === key);
  return i < 0 ? 1 : i;
}
// reason = short human cause ("Inspection passed"); shown in the toast.
// Returns { advanced, fromKey, toKey, info }.
function ordAdvanceToAtLeast(id, seedLabel, targetKey, reason) {
  if (!id) return { advanced: false };
  const curKey = ordStatusKey(id, seedLabel);
  if (ordRankOf(curKey) >= ordRankOf(targetKey)) {
    return { advanced: false, fromKey: curKey, toKey: curKey, info: ordStatusInfo(curKey) };
  }
  const info = ordSetStatus(id, targetKey); // dispatches vy-order-status-changed
  try {
    vyFlashStatus((reason ? reason + " — " : "") + "order advanced to \u201C" + info.label + ".\u201D");
  } catch (e) {}
  return { advanced: true, fromKey: curKey, toKey: targetKey, info: info };
}

// Lightweight imperative toast for the cross-cutting "order advanced" event —
// sections don't each need their own toast state for this. Bottom-center,
// brand-tinted, auto-dismisses; click to close. Reuses app CSS vars.
function vyFlashStatus(msg) {
  if (typeof document === "undefined") return;
  let host = document.getElementById("vy-status-flash");
  if (!host) {
    host = document.createElement("div");
    host.id = "vy-status-flash";
    host.style.cssText =
      "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9999;" +
      "display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;";
    document.body.appendChild(host);
  }
  const t = document.createElement("div");
  t.style.cssText =
    "pointer-events:auto;cursor:pointer;display:flex;align-items:center;gap:10px;" +
    "max-width:min(92vw,440px);padding:11px 15px;border-radius:11px;" +
    "background:hsl(var(--foreground));color:hsl(var(--background));" +
    "box-shadow:0 10px 30px -8px rgba(0,0,0,.45);font-size:13px;font-weight:500;" +
    "border:1px solid hsl(var(--border));opacity:0;transform:translateY(6px);" +
    "transition:opacity .18s ease,transform .18s ease;";
  const dot = document.createElement("span");
  dot.style.cssText =
    "flex:0 0 auto;width:8px;height:8px;border-radius:999px;background:hsl(var(--primary));";
  const span = document.createElement("span");
  span.textContent = msg;
  span.style.cssText = "flex:1 1 auto;line-height:1.35;";
  t.appendChild(dot);
  t.appendChild(span);
  host.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = "1"; t.style.transform = "translateY(0)"; });
  const close = () => {
    t.style.opacity = "0"; t.style.transform = "translateY(6px)";
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
  };
  t.addEventListener("click", close);
  setTimeout(close, 4600);
}

// ----------------------------------------------------------------------
// Per-order "inspection required" flag. Some suppliers are trusted/repeat and
// don't need a third-party inspection, so the order can opt out and the
// Inspection tab disappears from its shell. Default = required (true).
// ----------------------------------------------------------------------
const ORD_INSPECTION_KEY = "vy_order_inspection_v1";
function ordInspectionStore() {
  try { const o = JSON.parse(localStorage.getItem(ORD_INSPECTION_KEY) || "{}"); return o && typeof o === "object" ? o : {}; }
  catch (e) { return {}; }
}
function ordInspectionRequired(id) {
  if (!id) return true;
  const v = ordInspectionStore()[id];
  return v === undefined ? true : !!v;
}
function ordSetInspectionRequired(id, required) {
  if (!id) return;
  const store = ordInspectionStore();
  store[id] = !!required;
  try { localStorage.setItem(ORD_INSPECTION_KEY, JSON.stringify(store)); } catch (e) {}
}

Object.assign(window, {
  ORDERS_KPI, NEEDS_ATTENTION, ORDERS_LIST, FILTER_CHIPS,
  ordLoadDrafts, ordSaveDrafts, ordAddDraft, ordClearDrafts, ordAllOrders, ordRenameOrder,
  ORD_PIPELINE, ordStatusKeyFromLabel, ordStatusInfo, ordStatusKey, ordSetStatus,
  ordAdvanceStatus, ordStepBackStatus, ordResetStatus, ordStageForStatus,
  ordRankOf, ordAdvanceToAtLeast, vyFlashStatus,
  ordInspectionRequired, ordSetInspectionRequired,
  ordEdits, ordSaveEdits, ordApplyEdits,
});
