// Logistics dataset — the portfolio-level source of truth shared by BOTH the
// Shipments page (physical freight, MANUAL world) and the FBA Shipments page
// (Amazon inbounds, SYNCED world). One freight shipment can spawn several FBA
// inbounds across FCs; the custody handoff (vessel → Amazon) is the seam
// between the two worlds. Each FBA inbound links back to its parent shipment
// and its order, so the reconciliation chain ordered → packed → shipped →
// received holds across pages.
//
// Source-of-truth convention (matches the order-level Shipping section):
//   Manual : mode, forwarder, incoterm, route, ETD/ETA, BOL/AWB, CBM/weight,
//            cartons, packed, expected (your packing allocation)
//   Amazon : FBA shipment id, FC, amazonStatus, received, synced

// Per-order committed scope (units), for packed-vs-ordered reconciliation.
const LOG_ORDER_SCOPE = {
  "ORD-2026-05-006": 1600,
  "ORD-2026-05-004": 800,
  "ORD-2026-05-003": 2400,
  "ORD-2026-05-002": 900,
  "ORD-2026-04-012": 200,
  "ORD-2026-05-008": 500, // in production, freight not yet booked → fully unpacked
};

// Order directory — used by the portfolio "New shipment" form to attach a
// shipment to its parent order (and auto-fill supplier / route).
const LOG_ORDERS = [
  { id: "ORD-2026-05-006", title: "Q1 restock — Beaded seat covers", supplier: "Sheng Te Long", origin: "Ningbo, CN", destination: "Los Angeles, US" },
  { id: "ORD-2026-05-004", title: "Premium leather wraps — black/tan", supplier: "Huasheng Leather", origin: "Shenzhen, CN", destination: "Los Angeles, US" },
  { id: "ORD-2026-05-003", title: "Microfiber steering covers — 6 colors", supplier: "Ningbo Auto Trim", origin: "Ningbo, CN", destination: "Los Angeles, US" },
  { id: "ORD-2026-05-002", title: "Neoprene truck covers — XL series", supplier: "Fujian PU Goods", origin: "Yantian, CN", destination: "Long Beach, US" },
  { id: "ORD-2026-04-012", title: "Heated steering wheel kit — universal", supplier: "Ningbo Auto Trim", origin: "Shenzhen, CN", destination: "Los Angeles, US" },
  { id: "ORD-2026-05-008", title: "Silicone grip covers — compact", supplier: "Shenzhen Wheel Co", origin: "Shenzhen, CN", destination: "Long Beach, US" },
];

const LOG_STAGES = ["Draft", "Booked", "Picked up", "In transit", "Customs", "Delivered", "At FBA"];

const LOG_FCS = ["ONT8", "LGB8", "MDW2", "ATL6"];

// ----------------------------------------------------------------------
// PHYSICAL SHIPMENTS (each nests its Amazon FBA inbounds)
// ----------------------------------------------------------------------
const LOG_SHIPMENTS = [
  {
    id: "SHP-2605-001",
    orderId: "ORD-2026-05-006",
    orderTitle: "Q1 restock — Beaded seat covers",
    supplier: "Sheng Te Long",
    mode: "Sea LCL",
    forwarder: "Pacific Star",
    incoterm: "DDP",
    origin: "Ningbo, CN",
    destination: "Los Angeles, US",
    etd: "Jun 12",
    eta: "Jun 24",
    bol: "PSL-NGB-240612",
    stage: "In transit",
    customs: "Pending",
    cbm: 1.64,
    grossKg: 824,
    cartons: 32,
    packed: 900,
    freightUsd: 842,
    fba: [
      { id: "FBA17-WQ4-6B2", fc: "ONT8", skuCount: 2, expected: 450, received: 0, amazonStatus: "Working", synced: "18 min ago" },
      { id: "FBA17-LG8-2N4", fc: "LGB8", skuCount: 2, expected: 450, received: 0, amazonStatus: "Working", synced: "18 min ago" },
    ],
  },
  {
    id: "SHP-2605-002",
    orderId: "ORD-2026-05-006",
    orderTitle: "Q1 restock — Beaded seat covers",
    supplier: "Sheng Te Long",
    mode: "Air",
    forwarder: "DHL",
    incoterm: "DAP",
    origin: "Shenzhen, CN",
    destination: "Los Angeles, US",
    etd: "Jun 28",
    eta: "Jul 03",
    bol: "—",
    stage: "Draft",
    customs: "—",
    cbm: 0.9,
    grossKg: 410,
    cartons: 14,
    packed: 700,
    freightUsd: 1180,
    fba: [],
  },
  {
    id: "SHP-2605-003",
    orderId: "ORD-2026-05-003",
    orderTitle: "Microfiber steering covers — 6 colors",
    supplier: "Ningbo Auto Trim",
    mode: "Sea FCL",
    forwarder: "Flexport",
    incoterm: "DDP",
    origin: "Ningbo, CN",
    destination: "Los Angeles, US",
    etd: "Jun 08",
    eta: "Jul 02",
    bol: "FLX-NGB-240608",
    stage: "Customs",
    customs: "In clearance",
    cbm: 12.4,
    grossKg: 4100,
    cartons: 80,
    packed: 2400,
    freightUsd: 3200,
    fba: [
      { id: "FBA19-MSC-1A2", fc: "ONT8", skuCount: 2, expected: 800, received: 0, amazonStatus: "Working", synced: "1 h ago" },
      { id: "FBA19-MSC-2B3", fc: "ATL6", skuCount: 2, expected: 800, received: 0, amazonStatus: "Working", synced: "1 h ago" },
      { id: "FBA19-MSC-3C4", fc: "MDW2", skuCount: 2, expected: 800, received: 0, amazonStatus: "Working", synced: "1 h ago" },
    ],
  },
  {
    id: "SHP-2605-007",
    orderId: "ORD-2026-05-002",
    orderTitle: "Neoprene truck covers — XL series",
    supplier: "Fujian PU Goods",
    mode: "Sea LCL",
    forwarder: "DSV",
    incoterm: "DAP",
    origin: "Yantian, CN",
    destination: "Long Beach, US",
    etd: "Jun 05",
    eta: "Jun 18",
    bol: "DSV-YTN-240605",
    stage: "In transit",
    customs: "In clearance",
    cbm: 3.1,
    grossKg: 1180,
    cartons: 30,
    packed: 900,
    freightUsd: 1310,
    fba: [
      { id: "FBA18-NEO-3T7", fc: "LGB8", skuCount: 2, expected: 500, received: 0, amazonStatus: "Shipped", synced: "42 min ago" },
      { id: "FBA18-NEO-5T9", fc: "MDW2", skuCount: 1, expected: 400, received: 0, amazonStatus: "Working", synced: "42 min ago" },
    ],
  },
  {
    id: "SHP-2604-021",
    orderId: "ORD-2026-05-004",
    orderTitle: "Premium leather wraps — black/tan",
    supplier: "Huasheng Leather",
    mode: "Air express",
    forwarder: "DHL",
    incoterm: "DAP",
    origin: "Shenzhen, CN",
    destination: "Los Angeles, US",
    etd: "Jun 01",
    eta: "Jun 08",
    bol: "DHL-SZX-240601",
    stage: "Delivered",
    customs: "Cleared",
    cbm: 1.2,
    grossKg: 520,
    cartons: 20,
    packed: 800,
    freightUsd: 1180,
    fba: [
      { id: "FBA17-LW8-7P3", fc: "ONT8", skuCount: 1, expected: 400, received: 390, amazonStatus: "Receiving", synced: "12 min ago" },
      { id: "FBA17-LW8-9Q5", fc: "LGB8", skuCount: 1, expected: 400, received: 400, amazonStatus: "Closed", synced: "12 min ago" },
    ],
  },
  {
    id: "SHP-2604-014",
    orderId: "ORD-2026-04-012",
    orderTitle: "Heated steering wheel kit — universal",
    supplier: "Ningbo Auto Trim",
    mode: "Air express",
    forwarder: "DSV",
    incoterm: "DAP",
    origin: "Shenzhen, CN",
    destination: "Los Angeles, US",
    etd: "May 02",
    eta: "May 09",
    bol: "DSV-SZX-240502",
    stage: "At FBA",
    customs: "Cleared",
    cbm: 0.7,
    grossKg: 240,
    cartons: 8,
    packed: 200,
    freightUsd: 540,
    fba: [
      { id: "FBA15-HT2-9K1", fc: "ONT8", skuCount: 1, expected: 200, received: 200, amazonStatus: "Closed", synced: "2 d ago" },
    ],
  },
];

// ----------------------------------------------------------------------
// Tone maps + small derivations
// ----------------------------------------------------------------------
const LOG_STAGE_TONE = {
  Draft: "muted", Booked: "info", "Picked up": "info", "In transit": "info",
  Customs: "warning", Delivered: "success", "At FBA": "success",
};
const LOG_CUSTOMS_TONE = {
  Cleared: "success", "In clearance": "warning", Pending: "muted", "Docs missing": "danger", "—": "muted",
};
const LOG_FBA_TONE = {
  Working: "muted", Shipped: "info", "In transit": "info", Receiving: "warning",
  Closed: "success", Problem: "danger",
};

// One physical shipment → roll up its FBA inbounds.
function logShipFbaStats(s) {
  const expected = s.fba.reduce((n, f) => n + f.expected, 0);
  const received = s.fba.reduce((n, f) => n + f.received, 0);
  const started = s.fba.filter((f) => f.received > 0);
  const variance = received - started.reduce((n, f) => n + f.expected, 0);
  const short = s.fba.filter((f) => f.received > 0 && f.received < f.expected).length;
  return { inbounds: s.fba.length, expected, received, variance, short };
}

// ----------------------------------------------------------------------
// Orphan / UNLINKED FBA inbounds — FBA shipments Amazon returns on sync that
// were created directly in Seller Central ("Send to Amazon"), not via one of
// your freight shipments. They have no parent until you link them. Links the
// user makes persist (vy_fba_links_v1): attach to a shipment, or keep standalone.
// ----------------------------------------------------------------------
const LOG_UNLINKED_FBA = [
  { id: "FBA1A9GYMP8C", fc: "FTW5", skuCount: 5, expected: 168, received: 168, amazonStatus: "Closed", synced: "9 min ago", mode: "Amazon Partnered", eta: "May 3", defaultShipmentId: "SHP-2605-007" },
  { id: "FBA22XK7TLP1", fc: "ONT8", skuCount: 3, expected: 240, received: 0, amazonStatus: "Shipped", synced: "9 min ago", mode: "Amazon Partnered", eta: "Jun 20", defaultShipmentId: "SHP-2605-003" },
  { id: "FBA20QW9RMB7", fc: "MDW2", skuCount: 1, expected: 90, received: 0, amazonStatus: "Working", synced: "9 min ago", mode: "Amazon Partnered", eta: "Jun 26", defaultShipmentId: "SHP-2604-021" },
];

const LOG_FBA_LINK_KEY = "vy_fba_links_v1";
function logLoadFbaLinks() {
  try { const r = localStorage.getItem(LOG_FBA_LINK_KEY); const o = r ? JSON.parse(r) : {}; return o && typeof o === "object" ? o : {}; }
  catch (e) { return {}; }
}
function logSaveFbaLink(fbaId, link) {
  const all = logLoadFbaLinks();
  if (link === null) { delete all[fbaId]; } else { all[fbaId] = link; }
  try { localStorage.setItem(LOG_FBA_LINK_KEY, JSON.stringify(all)); } catch (e) {}
  return all[fbaId];
}

// ----------------------------------------------------------------------
// Per-SKU CONTENTS of an FBA inbound. Amazon receives at the SKU level, so the
// reconciliation that actually matters — "which SKU came up short?" — lives
// here, not in the inbound total. Derived deterministically from the inbound
// (id + skuCount + expected/received) so lines are stable across reloads
// without bloating every seed row. `expected` = your packing allocation
// (manual); `received` = what Amazon booked in (synced).
// ----------------------------------------------------------------------
const LOG_SKU_POOL = [
  { code: "SCV", name: "Seat cover" },
  { code: "STW", name: "Steering wheel cover" },
  { code: "FLM", name: "Floor mat set" },
  { code: "TRM", name: "Trunk organizer" },
  { code: "SBP", name: "Seat belt pad" },
  { code: "ARM", name: "Armrest cover" },
  { code: "HDR", name: "Headrest pillow" },
  { code: "VNT", name: "Vent air freshener" },
];
const LOG_SKU_COLORS = ["BLK", "GRY", "BEI", "RED", "BLU"];
const LOG_SKU_SIZES = ["S", "M", "L", "XL", "STD"];
function logHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }

// Split `total` into n positive integer parts that sum EXACTLY to total, with
// mild deterministic jitter so parts aren't all identical.
function logSplit(total, n, seed) {
  const parts = [];
  let rem = total, left = n;
  for (let i = 0; i < n; i++) {
    if (left === 1) { parts.push(rem); break; }
    const avg = Math.floor(rem / left);
    const jitter = avg > 10 ? (((seed >>> (i * 3)) % 7) - 3) * Math.max(1, Math.round(avg / 18)) : 0;
    let part = Math.max(1, avg + jitter);
    part = Math.min(part, rem - (left - 1)); // leave ≥1 for every remaining line
    part = Math.max(1, part);
    parts.push(part); rem -= part; left--;
  }
  return parts;
}

function logFbaLines(f) {
  const n = Math.max(1, f.skuCount || 1);
  const seed = logHash(f.id);
  const exp = logSplit(f.expected, n, seed);
  const lines = exp.map((e, i) => {
    const pool = LOG_SKU_POOL[(seed + i * 7) % LOG_SKU_POOL.length];
    const color = LOG_SKU_COLORS[(seed >>> (i + 2)) % LOG_SKU_COLORS.length];
    const size = LOG_SKU_SIZES[(seed >>> (i + 5)) % LOG_SKU_SIZES.length];
    const sku = pool.code + "-" + color + "-" + size;
    const fnsku = "X00" + String.fromCharCode(65 + ((seed >>> i) % 26)) + (((seed >>> (i + 3)) % 9000) + 1000) + pool.code.slice(0, 2);
    return { sku, name: pool.name + " · " + color + (size !== "STD" ? " · " + size : ""), fnsku, expected: e, received: 0 };
  });
  // Allocate received units across lines, exact-sum.
  let received = f.received || 0;
  if (received > 0) {
    if (received >= f.expected) {
      lines.forEach((l) => { l.received = l.expected; });
      lines[0].received += received - f.expected; // overage lands on first line
    } else {
      // Short receipt: proportional floor, then hand remainder to the largest
      // fractional parts — keeps the sum exact and spreads the shortfall.
      const fr = lines.map((l, i) => ({ i, base: Math.floor(l.expected * received / f.expected), frac: (l.expected * received / f.expected) % 1 }));
      let used = fr.reduce((n2, x) => n2 + x.base, 0);
      fr.sort((a, b) => b.frac - a.frac);
      let extra = received - used;
      fr.forEach((x) => { lines[x.i].received = x.base; });
      for (let k = 0; k < fr.length && extra > 0; k++) { lines[fr[k].i].received += 1; extra--; }
    }
  }
  return lines;
}

// Flatten every FBA inbound into a row carrying its parent shipment + order.
function logAllFbaRows() {
  const rows = [];
  const ships = logAllShipments();
  const shipById = {};
  ships.forEach((s) => { shipById[s.id] = s; });

  ships.forEach((s) => {
    s.fba.forEach((f) => {
      const variance = f.received > 0 ? f.received - f.expected : 0;
      rows.push({
        ...f, variance,
        shipmentId: s.id, orderId: s.orderId, orderTitle: s.orderTitle,
        supplier: s.supplier, mode: s.mode, eta: s.eta,
        unlinked: false, standalone: false,
      });
    });
  });

  // Orphan inbounds — resolve against the user's saved links.
  const links = logLoadFbaLinks();
  LOG_UNLINKED_FBA.forEach((f) => {
    const variance = f.received > 0 ? f.received - f.expected : 0;
    const link = links[f.id];
    // saved override wins; otherwise fall back to the seeded default link.
    const effShipId = (link && link.shipmentId) ? link.shipmentId
      : (link && link.standalone) ? null
      : (f.defaultShipmentId || null);
    if (effShipId && shipById[effShipId]) {
      const s = shipById[effShipId];
      rows.push({ ...f, variance, shipmentId: s.id, orderId: s.orderId, orderTitle: s.orderTitle, supplier: s.supplier, unlinked: false, standalone: false, wasUnlinked: true });
    } else if (link && link.standalone) {
      rows.push({ ...f, variance, shipmentId: null, orderId: null, orderTitle: "Direct to Amazon", supplier: "Seller Central", unlinked: false, standalone: true });
    } else {
      rows.push({ ...f, variance, shipmentId: null, orderId: null, orderTitle: "—", supplier: "Seller Central", unlinked: true, standalone: false });
    }
  });
  return rows;
}

// ----------------------------------------------------------------------
// Shared draft-shipment persistence (localStorage). Shipments created via the
// portfolio "New shipment" form survive reloads and prepend to LOG_SHIPMENTS.
// Mirrors the orders draft store pattern.
// ----------------------------------------------------------------------
const LOG_STORE_KEY = "vy_shipments_drafts_v1";

function logLoadDrafts() {
  try {
    const raw = localStorage.getItem(LOG_STORE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function logSaveDrafts(list) {
  try { localStorage.setItem(LOG_STORE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}

function logAddDraft(draft) {
  const list = logLoadDrafts();
  list.unshift(draft);
  logSaveDrafts(list);
  return draft;
}

function logClearDrafts() { logSaveDrafts([]); }

// ----------------------------------------------------------------------
// Shipment field edits (override store). Edits to ANY shipment — seed or draft —
// layer on top via localStorage, so we never mutate base data. Mirrors the
// supplier-profile / tracking override pattern.
// ----------------------------------------------------------------------
const LOG_EDIT_KEY = "vy_shipment_edits_v1";
const LOG_EDITABLE = ["mode", "forwarder", "incoterm", "etd", "eta", "bol", "cbm", "grossKg", "cartons", "packed", "freightUsd"];

function logLoadEdits() {
  try { const r = localStorage.getItem(LOG_EDIT_KEY); const o = r ? JSON.parse(r) : {}; return o && typeof o === "object" ? o : {}; }
  catch (e) { return {}; }
}
function logSaveEdit(id, patch) {
  const all = logLoadEdits();
  all[id] = { ...(all[id] || {}), ...patch };
  try { localStorage.setItem(LOG_EDIT_KEY, JSON.stringify(all)); } catch (e) {}
  return all[id];
}
function logApplyEdits(s) {
  const e = logLoadEdits()[s.id];
  return e ? { ...s, ...e } : s;
}

// Drafts first, then the seed shipments (dedupe by id); edits applied on top.
function logAllShipments() {
  const drafts = logLoadDrafts();
  const seen = new Set(drafts.map((d) => d.id));
  const merged = [...drafts, ...LOG_SHIPMENTS.filter((s) => !seen.has(s.id))];
  return merged.map(logApplyEdits);
}

// Units already packed for an order across all its shipments (incl. drafts).
function logPackedForOrder(orderId) {
  return logAllShipments().filter((s) => s.orderId === orderId).reduce((n, s) => n + (Number(s.packed) || 0), 0);
}

Object.assign(window, {
  LOG_SHIPMENTS, LOG_ORDER_SCOPE, LOG_ORDERS, LOG_STAGES, LOG_FCS,
  LOG_STAGE_TONE, LOG_CUSTOMS_TONE, LOG_FBA_TONE,
  logShipFbaStats, logAllFbaRows, logFbaLines,
  logLoadDrafts, logSaveDrafts, logAddDraft, logClearDrafts, logAllShipments, logPackedForOrder,
  logLoadEdits, logSaveEdit, logApplyEdits, LOG_EDITABLE,
  LOG_UNLINKED_FBA, logLoadFbaLinks, logSaveFbaLink,
});
