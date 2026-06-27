// Suppliers directory — aggregated from data the app already has, MERGED with an
// editable, persisted profile per supplier. A supplier's rollups (products /
// orders / open AP / origin) are derived from catalog/orders/payables/logistics;
// its profile (contact, terms, notes, lead-time/MOQ overrides) is yours to edit
// and lives in localStorage. New suppliers are profile-only until orders exist.
//
// Load AFTER: catalog-data, orders-data, payables-data, logistics-data.

const SUP_STORE_KEY = "vy_supplier_profiles_v1";

function supLoadProfiles() {
  try {
    const raw = localStorage.getItem(SUP_STORE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) { return {}; }
}
function supSaveProfiles(obj) {
  try { localStorage.setItem(SUP_STORE_KEY, JSON.stringify(obj)); } catch (e) { /* ignore */ }
}
function supUpsertProfile(name, patch) {
  const all = supLoadProfiles();
  all[name] = { ...(all[name] || {}), ...patch };
  supSaveProfiles(all);
  return all[name];
}

const SUP_PROFILE_FIELDS = ["contact", "email", "phone", "address", "origin", "paymentTerms", "incoterm", "leadTimeDays", "moq", "notes"];

function supBuildDirectory() {
  const fams = (typeof catLoadFamilies === "function") ? catLoadFamilies() : (window.CAT_FAMILIES || []);
  const orders = window.ORDERS_LIST || [];
  const invoices = window.PAY_INVOICES || [];
  const logOrders = window.LOG_ORDERS || [];
  const profiles = supLoadProfiles();

  // Canonical supplier names = catalog factories ∪ order suppliers ∪ saved profiles.
  const names = new Set();
  fams.forEach((f) => f.supplier && names.add(f.supplier));
  orders.forEach((o) => o.supplier && names.add(o.supplier));
  Object.keys(profiles).forEach((n) => names.add(n));

  const originBy = {};
  logOrders.forEach((o) => { if (o.supplier && !originBy[o.supplier]) originBy[o.supplier] = o.origin; });

  const bal = (inv) => Math.max(0, inv.total - inv.paid);

  return [...names].map((name) => {
    const prof = profiles[name] || {};
    const products = fams.filter((f) => f.supplier === name);
    const skuCount = products.reduce((n, f) => n + (f.variants ? f.variants.length : 0), 0);
    const supOrders = orders.filter((o) => o.supplier === name);
    const orderIds = new Set(supOrders.map((o) => o.id));
    const supInvoices = invoices.filter((inv) => orderIds.has(inv.orderId) && (inv.vendorType === "Supplier" || inv.vendorType === "Agent"));
    const openBalance = supInvoices.reduce((n, inv) => n + bal(inv), 0);
    const openOrders = supOrders.filter((o) => !/closed|at fba/i.test(o.status || "")).length;
    const leads = products.map((f) => f.leadTimeDays || 0).filter(Boolean);
    const moqs = products.map((f) => f.moq || 0).filter(Boolean);
    const derivedRoute = (products.find((f) => f.supplierRoute) || {}).supplierRoute
      || (supOrders.find((o) => /via/i.test(o.route || "")) || {}).route
      || "Direct";

    return {
      name,
      // derived (with profile overrides where set)
      origin: prof.origin || originBy[name] || "—",
      route: prof.route || derivedRoute,
      leadTimeDays: prof.leadTimeDays != null && prof.leadTimeDays !== "" ? Number(prof.leadTimeDays) : (leads.length ? Math.min(...leads) : null),
      moq: prof.moq != null && prof.moq !== "" ? Number(prof.moq) : (moqs.length ? Math.min(...moqs) : null),
      productCount: products.length,
      skuCount,
      products,
      orderCount: supOrders.length,
      openOrders,
      orders: supOrders,
      invoices: supInvoices,
      openBalance,
      // editable profile
      contact: prof.contact || "",
      email: prof.email || "",
      phone: prof.phone || "",
      address: prof.address || "",
      paymentTerms: prof.paymentTerms || "",
      incoterm: prof.incoterm || "",
      notes: prof.notes || "",
      isNew: !!prof.isNew,
      hasProfile: Object.keys(prof).length > 0,
    };
  }).sort((a, b) => b.openBalance - a.openBalance || b.orderCount - a.orderCount);
}

function supByName(name) {
  return supBuildDirectory().find((s) => s.name === name) || null;
}

function supFmt(n) {
  return "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

Object.assign(window, {
  SUP_SUPPLIERS: supBuildDirectory(), supBuildDirectory, supByName, supFmt,
  supLoadProfiles, supSaveProfiles, supUpsertProfile, SUP_PROFILE_FIELDS,
});
