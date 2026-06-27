// packaging-data.jsx — standalone PACKAGING INVENTORY.
// Packaging (mailers, master cartons, inserts, polybags, labels…) is tracked
// SEPARATELY from product orders because it's often bought in much larger MOQs
// and reused across many orders. Each item can be ASSIGNED to a product family
// (or left "Any"). Stock moves two ways:
//   • receive  — add stock (bought from the office, or on a separate order)
//   • consume  — draw down when an order uses some
// On-hand = Σreceive − Σconsume. Persisted to localStorage. Load after
// catalog-data.jsx (uses CAT_FAMILIES for the product list).

const PKG_KEY = "vy_packaging_v1";

const PKG_KINDS = ["Mailer", "Master carton", "Insert", "Polybag", "Label", "Box", "Other"];

// Seed a couple of realistic items so the page isn't empty on first load.
function pkgSeed() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    items: [
      { id: "pk-mailer-1013", name: "Poly mailer 10×13", kind: "Mailer", familyId: "semi-swc-18", unitCost: 0.10, reorderPoint: 800, createdAt: today },
      { id: "pk-carton-master", name: "Master carton 50×50×42", kind: "Master carton", familyId: null, unitCost: 1.05, reorderPoint: 150, createdAt: today },
      { id: "pk-insert-thx", name: "Thank-you insert card", kind: "Insert", familyId: null, unitCost: 0.04, reorderPoint: 1000, createdAt: today },
    ],
    moves: [
      { id: "mv-1", itemId: "pk-mailer-1013", type: "receive", qty: 3000, unitCost: 0.10, source: "Separate order · Yiwu Pack Co", note: "MOQ buy", date: today },
      { id: "mv-2", itemId: "pk-mailer-1013", type: "consume", qty: 1600, orderId: "ORD-2026-05-006", note: "Q1 restock", date: today },
      { id: "mv-3", itemId: "pk-carton-master", type: "receive", qty: 400, unitCost: 1.05, source: "Separate order · Ningbo Carton", note: "", date: today },
      { id: "mv-4", itemId: "pk-insert-thx", type: "receive", qty: 5000, unitCost: 0.04, source: "Office order · VistaPrint", note: "", date: today },
    ],
  };
}

function pkgLoad() {
  try {
    const raw = localStorage.getItem(PKG_KEY);
    if (!raw) { const s = pkgSeed(); pkgSave(s); return s; }
    const o = JSON.parse(raw);
    if (!o || !Array.isArray(o.items)) return pkgSeed();
    if (!Array.isArray(o.moves)) o.moves = [];
    return o;
  } catch (e) { return pkgSeed(); }
}
function pkgSave(state) { try { localStorage.setItem(PKG_KEY, JSON.stringify(state)); } catch (e) {} }

function pkgUid(p) { return p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

// On-hand qty + value for one item from its movements.
function pkgItemStats(item, moves) {
  const m = moves.filter((x) => x.itemId === item.id);
  let onHand = 0, received = 0, consumed = 0, lastCost = item.unitCost;
  m.forEach((x) => {
    if (x.type === "receive") { onHand += x.qty; received += x.qty; if (x.unitCost != null) lastCost = x.unitCost; }
    else if (x.type === "consume") { onHand -= x.qty; consumed += x.qty; }
  });
  const unit = item.unitCost != null ? item.unitCost : lastCost;
  return {
    onHand: Math.max(0, onHand), received, consumed,
    value: Math.round(Math.max(0, onHand) * (unit || 0) * 100) / 100,
    low: item.reorderPoint != null && onHand <= item.reorderPoint,
  };
}

// All items with computed stats + assigned product name.
function pkgItems() {
  const { items, moves } = pkgLoad();
  return items.map((it) => {
    const stats = pkgItemStats(it, moves);
    const fam = it.familyId && typeof catFamilyById === "function" ? catFamilyById(it.familyId) : null;
    return { ...it, ...stats, productName: fam ? (fam.parent || fam.id) : "Any product" };
  });
}
function pkgItem(id) { return pkgItems().find((i) => i.id === id) || null; }
function pkgMoves(itemId) {
  return pkgLoad().moves.filter((m) => m.itemId === itemId).slice().reverse();
}

// Create a new packaging item (with an optional opening-stock receive).
function pkgAddItem({ name, kind, familyId, unitCost, reorderPoint, openingQty, source }) {
  const s = pkgLoad();
  const id = pkgUid("pk");
  const today = new Date().toISOString().slice(0, 10);
  s.items.push({ id, name: (name || "Packaging").trim(), kind: kind || "Other", familyId: familyId || null, unitCost: Number(unitCost) || 0, reorderPoint: Number(reorderPoint) || 0, createdAt: today });
  if (Number(openingQty) > 0) {
    s.moves.push({ id: pkgUid("mv"), itemId: id, type: "receive", qty: Number(openingQty), unitCost: Number(unitCost) || 0, source: source || "Opening stock", note: "Opening stock", date: today });
  }
  pkgSave(s);
  return id;
}

// Add stock to an existing item.
function pkgReceive(itemId, qty, unitCost, source, note) {
  const s = pkgLoad();
  if (!s.items.find((i) => i.id === itemId)) return;
  s.moves.push({ id: pkgUid("mv"), itemId, type: "receive", qty: Math.max(0, Number(qty) || 0), unitCost: unitCost != null && unitCost !== "" ? Number(unitCost) : null, source: source || "Received", note: note || "", date: new Date().toISOString().slice(0, 10) });
  pkgSave(s);
}

// Draw down stock (an order using some). Clamped to on-hand.
function pkgConsume(itemId, qty, orderId, note) {
  const s = pkgLoad();
  const it = s.items.find((i) => i.id === itemId);
  if (!it) return 0;
  const stats = pkgItemStats(it, s.moves);
  const take = Math.max(0, Math.min(stats.onHand, Number(qty) || 0));
  if (take <= 0) return 0;
  s.moves.push({ id: pkgUid("mv"), itemId, type: "consume", qty: take, orderId: orderId || null, note: note || "", date: new Date().toISOString().slice(0, 10) });
  pkgSave(s);
  return take;
}

function pkgRemoveItem(id) {
  const s = pkgLoad();
  s.items = s.items.filter((i) => i.id !== id);
  s.moves = s.moves.filter((m) => m.itemId !== id);
  pkgSave(s);
}

// Items assigned to a product family (plus the "Any" items, always usable).
function pkgForFamily(familyId) {
  return pkgItems().filter((i) => !i.familyId || i.familyId === familyId);
}

function pkgTotals() {
  const items = pkgItems();
  return {
    items: items.length,
    onHandValue: Math.round(items.reduce((n, i) => n + i.value, 0) * 100) / 100,
    lowCount: items.filter((i) => i.low).length,
    units: items.reduce((n, i) => n + i.onHand, 0),
  };
}

function pkgReset() { const s = pkgSeed(); pkgSave(s); return s; }

Object.assign(window, {
  PKG_KINDS, pkgLoad, pkgSave, pkgItems, pkgItem, pkgMoves,
  pkgAddItem, pkgReceive, pkgConsume, pkgRemoveItem, pkgForFamily, pkgTotals, pkgReset,
});
