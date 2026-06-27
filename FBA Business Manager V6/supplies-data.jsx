// supplies-data.jsx — Supplies / packaging LEFTOVER ledger.
// Solves the MOQ problem: you buy 2,000 mailers (MOQ) but this order only uses
// 1,000, so 1,000 + their cost are leftover stock — they must NOT all hit this
// order's COGS, and you need to see what's on hand so you don't re-buy.
//
// Model: each purchase logs { item, unitCost, qtyOrdered, qtyUsed } against an
// order. Used qty × unit cost = the cost that lands on THIS order; the rest is
// carried as on-hand supply value. Aggregated by item across all orders.
// Persisted to localStorage. Load before production-app.jsx / inventory.

const SUPPLIES_KEY = "vy_supplies_v1";

function suppliesLoad() {
  try { const a = JSON.parse(localStorage.getItem(SUPPLIES_KEY) || "[]"); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function suppliesSave(list) {
  try { localStorage.setItem(SUPPLIES_KEY, JSON.stringify(list)); } catch (e) {}
}

// Add a purchase. Returns the stored record (with computed leftovers).
function suppliesAdd({ item, unitCost, qtyOrdered, qtyUsed, orderId, orderTitle }) {
  const list = suppliesLoad();
  const uc = Number(unitCost) || 0;
  const qo = Math.max(0, Number(qtyOrdered) || 0);
  const qu = Math.max(0, Math.min(qo, Number(qtyUsed) || 0));
  const rec = {
    id: "sup-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    item: (item || "Supply").trim(),
    unitCost: uc,
    qtyOrdered: qo,
    qtyUsed: qu,
    leftoverQty: qo - qu,
    usedValue: Math.round(qu * uc * 100) / 100,
    leftoverValue: Math.round((qo - qu) * uc * 100) / 100,
    orderId: orderId || null,
    orderTitle: orderTitle || null,
    date: new Date().toISOString().slice(0, 10),
  };
  list.push(rec);
  suppliesSave(list);
  return rec;
}

function suppliesRemove(id) {
  suppliesSave(suppliesLoad().filter((r) => r.id !== id));
}

// Aggregate on-hand stock by item: leftover qty/value summed across purchases.
// (A future order drawing down leftover would log a negative-leftover usage;
// for now each purchase is independent and we sum remaining.)
function suppliesOnHand() {
  const byItem = {};
  suppliesLoad().forEach((r) => {
    const k = r.item.toLowerCase();
    if (!byItem[k]) byItem[k] = { item: r.item, leftoverQty: 0, leftoverValue: 0, unitCost: r.unitCost, purchases: 0 };
    byItem[k].leftoverQty += r.leftoverQty;
    byItem[k].leftoverValue = Math.round((byItem[k].leftoverValue + r.leftoverValue) * 100) / 100;
    byItem[k].purchases += 1;
  });
  return Object.values(byItem).filter((x) => x.leftoverQty > 0).sort((a, b) => b.leftoverValue - a.leftoverValue);
}

// Leftovers logged against one order (for the order's Production view).
function suppliesForOrder(orderId) {
  return suppliesLoad().filter((r) => r.orderId === orderId && r.leftoverQty > 0);
}

function suppliesTotalOnHandValue() {
  return suppliesOnHand().reduce((n, x) => n + x.leftoverValue, 0);
}

Object.assign(window, {
  suppliesLoad, suppliesAdd, suppliesRemove, suppliesOnHand,
  suppliesForOrder, suppliesTotalOnHandValue,
});
