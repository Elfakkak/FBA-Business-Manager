// Integration connection state — the single source of truth for "what's
// connected". Persisted to localStorage so toggling Connect/Disconnect sticks
// AND the Amazon sync strips on Inventory / FBA Shipments read the same state.
//
// Prototype honesty: there's no real API. "Connected" is simulated state; the
// Connect flow mimics an OAuth handoff. When this becomes real, these helpers
// just read true token status instead of localStorage.

const INTG_STORE_KEY = "vy_integrations_v1";

// Definitions (static). `seed` = the default connection state on first load.
const INTG_DEFS = [
  {
    id: "amazon",
    name: "Amazon Seller Central",
    icon: "cube",
    tone: "warning",
    syncs: "FBA inventory · inbound shipments · orders",
    account: "Seller ID A1B2C3DEF4",
    blurb: "Pulls live FBA stock, inbound shipment status and order data into Vyonix.",
    primary: true,
    seed: { status: "connected", lastSync: Date.now() - 18 * 60 * 1000 },
  },
  {
    id: "amazonads",
    name: "Amazon Ads",
    icon: "marketing",
    tone: "warning",
    syncs: "PPC spend · ACoS / TACoS · campaigns",
    account: "",
    blurb: "Pulls Sponsored Products/Brands ad spend and performance so the P&L can break ads out of the Amazon payout and show true ACoS / TACoS per product.",
    seed: { status: "disconnected", lastSync: null },
  },
  {
    id: "mercury",
    name: "Mercury",
    icon: "dollar",
    tone: "info",
    syncs: "Bank balance · payments · FX rates",
    account: "Checking ···· 4471",
    blurb: "Reads cleared payments and balances so invoice payments reconcile automatically.",
    seed: { status: "connected", lastSync: Date.now() - 2 * 60 * 60 * 1000 },
  },
  {
    id: "track17",
    name: "17TRACK",
    icon: "mapPin",
    tone: "info",
    syncs: "Live container & parcel tracking",
    account: "",
    blurb: "Universal carrier tracking — paste a booking/container number and Vyonix polls live milestones for the Shipments timeline.",
    seed: { status: "disconnected", lastSync: null },
  },
  {
    id: "forwarder",
    name: "Freight forwarder (EDI)",
    icon: "ship",
    tone: "brand",
    syncs: "Shipment milestones · container tracking",
    account: "",
    blurb: "Receives milestone + tracking events (booked, departed, arrived, customs) over EDI.",
    seed: { status: "disconnected", lastSync: null },
  },
  {
    id: "sheets",
    name: "Google Sheets export",
    icon: "fileText",
    tone: "success",
    syncs: "Scheduled CSV / sheet export",
    account: "",
    blurb: "Pushes orders, invoices and inventory to a Google Sheet on a schedule.",
    seed: { status: "error", lastSync: Date.now() - 6 * 24 * 60 * 60 * 1000, note: "Re-authorization required" },
  },
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    icon: "receipt",
    tone: "success",
    syncs: "Invoices · bills · COGS · partner draws",
    account: "",
    blurb: "Syncs supplier bills, landed cost and partner draws to your books — so year-end tax and the pass-through split come straight from real accounting.",
    seed: { status: "disconnected", lastSync: null },
  },
  {
    id: "fx",
    name: "FX rates (Wise)",
    icon: "dollar",
    tone: "info",
    syncs: "Live USD ↔ RMB rate · payment FX",
    account: "",
    blurb: "Pulls the live USD↔RMB rate so supplier costs paid in RMB land in USD exactly, and FX gain/loss is tracked against the rate at order time.",
    seed: { status: "disconnected", lastSync: null },
  },
];

function intgLoadOverrides() {
  try {
    const raw = localStorage.getItem(INTG_STORE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) { return {}; }
}
function intgSaveOverrides(obj) {
  try { localStorage.setItem(INTG_STORE_KEY, JSON.stringify(obj)); } catch (e) { /* ignore */ }
}

// Merge static defs with persisted state.
function intgList() {
  const ov = intgLoadOverrides();
  return INTG_DEFS.map((d) => {
    const s = ov[d.id] || d.seed;
    return { ...d, status: s.status, lastSync: s.lastSync, note: s.note != null ? s.note : d.seed.note };
  });
}
function intgGet(id) { return intgList().find((i) => i.id === id) || null; }

function intgPatch(id, patch) {
  const ov = intgLoadOverrides();
  const def = INTG_DEFS.find((d) => d.id === id);
  const cur = ov[id] || (def ? def.seed : {});
  ov[id] = { ...cur, ...patch };
  intgSaveOverrides(ov);
  return ov[id];
}

function intgConnect(id) { return intgPatch(id, { status: "connected", lastSync: Date.now(), note: null }); }
function intgDisconnect(id) { return intgPatch(id, { status: "disconnected", lastSync: null, note: null }); }
function intgSyncNow(id) { return intgPatch(id, { lastSync: Date.now() }); }

// Convenience for downstream pages (Inventory / FBA sync strips).
function intgAmazon() { return intgGet("amazon"); }
function intgAmazonConnected() { const a = intgGet("amazon"); return !!a && a.status === "connected"; }
// 17TRACK drives live shipment tracking on the Shipments page.
function intg17Track() { return intgGet("track17"); }
function intg17TrackConnected() { const t = intgGet("track17"); return !!t && t.status === "connected"; }

// "18 min ago" / "2 h ago" / "6 d ago"
function intgAgo(ts) {
  if (!ts) return "never";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " h ago";
  const d = Math.floor(h / 24);
  return d + " d ago";
}

const INTG_STATUS_TONE = { connected: "success", disconnected: "muted", error: "danger", syncing: "info" };
const INTG_STATUS_LABEL = { connected: "Connected", disconnected: "Not connected", error: "Action needed", syncing: "Syncing…" };
// brand tone isn't a real color var — map to primary for inline hsl()
const INTG_TONE_VAR = { info: "info", warning: "warning", brand: "primary", danger: "danger", success: "success", muted: "muted-fg" };

Object.assign(window, {
  INTG_DEFS, intgList, intgGet, intgConnect, intgDisconnect, intgSyncNow,
  intgAmazon, intgAmazonConnected, intg17Track, intg17TrackConnected, intgAgo, intgLoadOverrides,
  INTG_STATUS_TONE, INTG_STATUS_LABEL, INTG_TONE_VAR,
});
