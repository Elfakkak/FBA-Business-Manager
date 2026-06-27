// vy-data.jsx — CENTRAL DATA LAYER REGISTRY (single source of truth map).
//
// This prototype persists everything in the browser's localStorage. Each
// feature module owns its own store + load/save helpers; this file is the ONE
// place that documents them all: the key, what it holds, who reads/writes it,
// and the table it maps to when this becomes a real backend.
//
// It does NOT replace the per-module helpers (those stay the API surface) — it
// is the manifest. `window.VY_STORES` exposes the registry at runtime so any
// tool (the Connection Test, an export, or the eventual migration) can
// enumerate every persisted store in one call.
//
//   ⚑ Backend handoff: each entry's `table` + `shape` is the schema. Replacing
//     localStorage with a server means: store → table, load/save → API calls.

const VY_STORES = [
  {
    key: "vy_catalog_families_v1",
    holds: "Product families + their variants (SKUs) — the catalog master record.",
    owner: "catalog-data.jsx",
    helpers: ["catLoadFamilies", "catSaveFamilies", "catUpdateFamily", "catUpdateFamilyVariants", "catNormalizeFamily", "catResetFamilies"],
    table: "products (family) + product_variants (variant)",
    shape: "Family{ id, parent, color, category, brand, supplier, leadTimeDays, moq, dims, weightLbs, images[], costHistory[], orderHistory[], variants[] } · Variant{ sku, name, pack, fnsku, asin, fbaStock, inbound, lastCostUsd, lastCostRmb, salePrice, status, prep, image }",
    derivesInto: ["Inventory (INV_ROWS)", "Add SKUs picker", "Order scope SKUs"],
  },
  {
    key: "vy_orders_drafts_v1",
    holds: "Orders created in-app (prepended to the seed ORDERS_LIST).",
    owner: "orders-data.jsx",
    helpers: ["ordLoadDrafts", "ordSaveDrafts", "ordAddDraft", "ordAllOrders", "ordClearDrafts"],
    table: "orders",
    shape: "Order{ id, title, supplier, route, status, statusTone, nextStep, meta, moneyTotal, moneyPaid, moneyPct, ... }",
  },
  {
    key: "vy_order_status_v1",
    holds: "Per-order lifecycle status overrides (Draft→…→Closed).",
    owner: "orders-data.jsx",
    helpers: ["ordStatusKey", "ordSetStatus", "ordAdvanceStatus", "ordStepBackStatus", "ordResetStatus", "ordStageForStatus"],
    table: "orders.status (column)",
    shape: "{ [orderId]: pipelineKey }  // pipeline: draft·production·inspection·transit·fba·closed",
  },
  {
    key: "vy_order_titles_v1",
    holds: "Per-order rename overrides (name only, never the order number).",
    owner: "orders-data.jsx",
    helpers: ["ordRenameOrder"],
    table: "orders.title (column)",
    shape: "{ [orderId]: name }",
  },
  {
    key: "vy_invoices_v1",
    holds: "Per-order invoice + payment state (order Invoices section).",
    owner: "invoices-app.jsx",
    helpers: ["invBuildForOrder (seed from PAY_INVOICES)", "internal useInvState persistence"],
    table: "invoices + invoice_payments",
    shape: "Invoice{ id, vendor, vendorType, total, due, file, lines[], payments[] }",
  },
  {
    key: "vy_payables_applied_v1",
    holds: "Extra payments applied to vendor bills (two-way link from Finance Review).",
    owner: "payables-data.jsx",
    helpers: ["payApplyPayment", "payAppliedMap", "payEffectivePaid", "payResetApplied"],
    table: "invoice_payments (applied on top of seed paid)",
    shape: "{ [invoiceId]: extraPaidUsd }",
  },
  {
    key: "vy_finances_v2",
    holds: "Company finance ledger — every revenue/expense/draw/contribution entry.",
    owner: "finances-data.jsx",
    helpers: ["finLoadEntries", "finSaveEntries", "finDerive (net/capital/settle/cash)"],
    table: "finance_entries",
    shape: "Entry{ id, date, kind: revenue|expense|draw|contribution, partner, amount, account, source, note }",
    note: "Supplier costs are NOT stored here — they fold in live from Payables (finPayablesExpenses).",
  },
  {
    key: "vy_finances_config_v1",
    holds: "Finance accounts (Mercury/Cash + opening balances) + tax-reserve %.",
    owner: "finances-data.jsx",
    helpers: ["finLoadConfig", "finSaveConfig"],
    table: "finance_accounts + workspace_settings",
    shape: "{ accounts[{id,name,kind,opening}], taxReservePct }  // partners come from Team, not here",
  },
  {
    key: "vy_finances_inbox_v2",
    holds: "Synced bank/Amazon transactions awaiting categorization (Review inbox).",
    owner: "finances-data.jsx",
    helpers: ["finInboxLoad", "finInboxSave", "finSuggest"],
    table: "bank_transactions (status: needs_review)",
    shape: "Txn{ id, date, source, direction, amount, account, desc }",
  },
  {
    key: "vy_finances_rules_v1",
    holds: "Auto-categorization rules for the Review inbox.",
    owner: "finances-data.jsx",
    helpers: ["finRulesLoad", "finRulesSave"],
    table: "categorization_rules",
    shape: "Rule{ id, match, kind, partner, label }",
  },
  {
    key: "vy_team_v1",
    holds: "Workspace PEOPLE — single source of truth for members AND owners/equity.",
    owner: "team-data.jsx",
    helpers: ["teamLoad", "teamSave", "teamOwners", "teamFinPartners", "teamUpdateOwner", "teamSetShares"],
    table: "users (+ ownership columns)",
    shape: "Member{ id, name, email, role, status, you, owner, share, finId }",
    note: "Finance partners derive from owners here; access roles live here too.",
  },
  {
    key: "vy_integrations_v1",
    holds: "Connection state for Amazon SP-API, Mercury, 17TRACK, etc.",
    owner: "integrations-data.jsx",
    helpers: ["intgList", "intgGet", "intgConnect", "intgDisconnect", "intgSyncNow"],
    table: "integrations (oauth tokens + status)",
    shape: "{ [id]: { status, lastSync, note } }",
  },
  {
    key: "vy_business_profile_v1",
    holds: "LLC legal profile (entity, EIN, registered agent, address).",
    owner: "settings-app.jsx",
    table: "workspace_settings.business",
    shape: "{ company, entityType, ein, registeredAgent, address, ... }",
  },
  {
    key: "vy_brand_v1",
    holds: "Private-label brand registry (name, trademark, Amazon Brand Registry).",
    owner: "brand-data.jsx",
    helpers: ["brandLoad", "brandSave", "brandName"],
    table: "workspace_settings.brand",
    shape: "{ name, tagline, color, registryEnrolled, tmNumber, ... }",
  },
  {
    key: "vy_notifications_v1",
    holds: "Notification preferences.",
    owner: "settings-app.jsx",
    table: "workspace_settings.notifications",
    shape: "{ [channelKey]: bool }",
  },
  {
    key: "vy_fba_links_v1",
    holds: "Manual FBA-inbound → shipment link overrides.",
    owner: "logistics-data.jsx",
    helpers: ["logAllFbaRows", "(link/standalone overrides)"],
    table: "fba_inbounds.shipment_id",
    shape: "{ [fbaId]: { shipmentId | standalone } }",
  },
  {
    key: "image-slot (sidecar, per id)",
    holds: "User-dropped images, keyed by slot id (pvar-<sku>, vy-brand-logo, …).",
    owner: "image-slot.js",
    table: "asset_uploads",
    shape: "{ [slotId]: dataURL/blobRef }",
  },
];

// Runtime helpers ------------------------------------------------------
function vyStoreKeys() { return VY_STORES.map((s) => s.key); }
// Snapshot every readable store's raw value (for export / migration / debugging).
function vyExportAll() {
  const out = {};
  VY_STORES.forEach((s) => {
    if (/[ (]/.test(s.key)) return; // skip the non-literal (sidecar) entry
    try { const raw = localStorage.getItem(s.key); out[s.key] = raw ? JSON.parse(raw) : null; } catch (e) { out[s.key] = "‹unreadable›"; }
  });
  return out;
}

Object.assign(window, { VY_STORES, vyStoreKeys, vyExportAll });
