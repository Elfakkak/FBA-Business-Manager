// Partners directory — the non-factory vendors you transact with: Agents
// (trading companies), Forwarders (freight), and Inspection agencies. Same
// pattern as suppliers: rollups derived from payables/orders/logistics, MERGED
// with an editable, persisted profile. A partner's open balance counts only
// THEIR own service bills (so it doesn't double-count a supplier's goods).
//
// Load AFTER: orders-data, payables-data, logistics-data.

const PAR_STORE_KEY = "vy_partner_profiles_v1";
const PARTNER_TYPES = ["Agent", "Forwarder", "Inspection"];
const PARTNER_TYPE_TONE = { Agent: "info", Forwarder: "brand", Inspection: "warning" };

function parLoadProfiles() {
  try {
    const raw = localStorage.getItem(PAR_STORE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) { return {}; }
}
function parSaveProfiles(obj) {
  try { localStorage.setItem(PAR_STORE_KEY, JSON.stringify(obj)); } catch (e) { /* ignore */ }
}
function parUpsertProfile(name, patch) {
  const all = parLoadProfiles();
  all[name] = { ...(all[name] || {}), ...patch };
  parSaveProfiles(all);
  return all[name];
}

const PARTNER_PROFILE_FIELDS = ["type", "contact", "email", "phone", "address", "origin", "paymentTerms", "specialty", "notes"];

function parBuildDirectory() {
  const invoices = window.PAY_INVOICES || [];
  const orders = window.ORDERS_LIST || [];
  const shipments = window.LOG_SHIPMENTS || [];
  const profiles = parLoadProfiles();

  // name -> type (first strong signal wins)
  const typeBy = {};
  invoices.forEach((inv) => { if (PARTNER_TYPES.includes(inv.vendorType) && !typeBy[inv.vendor]) typeBy[inv.vendor] = inv.vendorType; });
  shipments.forEach((s) => { if (s.forwarder && !typeBy[s.forwarder]) typeBy[s.forwarder] = "Forwarder"; });
  orders.forEach((o) => { const m = (o.route || "").match(/via\s+(.+)/i); if (m) { const n = m[1].trim(); if (!typeBy[n]) typeBy[n] = "Agent"; } });
  Object.keys(profiles).forEach((n) => { if (!typeBy[n]) typeBy[n] = profiles[n].type || "Agent"; });

  const bal = (inv) => Math.max(0, inv.total - inv.paid);

  return Object.keys(typeBy).map((name) => {
    const prof = profiles[name] || {};
    const type = prof.type || typeBy[name];
    const myBills = invoices.filter((v) => v.vendor === name && v.vendorType === type);
    const ships = shipments.filter((s) => s.forwarder === name);
    const routeOrders = orders.filter((o) => (o.route || "").includes(name));
    const orderIds = new Set([...myBills.map((i) => i.orderId), ...ships.map((s) => s.orderId), ...routeOrders.map((o) => o.id)]);
    const ordersList = orders.filter((o) => orderIds.has(o.id));
    const openBalance = myBills.reduce((n, i) => n + bal(i), 0);

    return {
      name, type,
      invoices: myBills,
      shipments: ships,
      orders: ordersList,
      orderCount: ordersList.length,
      shipmentCount: ships.length,
      invoiceCount: myBills.length,
      openBalance,
      contact: prof.contact || "",
      email: prof.email || "",
      phone: prof.phone || "",
      address: prof.address || "",
      origin: prof.origin || "",
      paymentTerms: prof.paymentTerms || "",
      specialty: prof.specialty || "",
      notes: prof.notes || "",
      isNew: !!prof.isNew,
    };
  }).sort((a, b) => b.openBalance - a.openBalance || b.orderCount - a.orderCount);
}

function parByName(name) {
  return parBuildDirectory().find((p) => p.name === name) || null;
}

function parFmt(n) {
  return "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

Object.assign(window, {
  PARTNERS: parBuildDirectory(), parBuildDirectory, parByName, parFmt,
  PARTNER_TYPES, PARTNER_TYPE_TONE, PARTNER_PROFILE_FIELDS,
  parLoadProfiles, parSaveProfiles, parUpsertProfile,
});
