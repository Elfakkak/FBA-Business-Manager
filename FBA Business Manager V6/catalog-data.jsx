// Catalog data — product families → variants, enriched for the Products list
// and Product detail pages. Built on the same SKUs used across orders so the
// numbers reconcile. Named CAT_* to avoid colliding with the add-skus modal's
// CATALOG_FAMILIES global.
//
// Source-of-truth convention (hybrid model):
//   Amazon (SP-API) : fnsku, asin, fbaStock, inbound, dims, weight, brand
//   Manual          : supplier, lastCostUsd/Rmb, leadTimeDays, moq, material,
//                     category, pack, images
//   Derived         : stock totals, cost range, health — computed in the app

const CAT_FAMILIES = [
  {
    "id": "semi-swc-18",
    "parent": "18\" Semi Truck Steering Wheel Cover",
    "color": null,
    "category": "Steering wheel covers",
    "brand": "Vyonix",
    "material": "—",
    "supplier": "—",
    "supplierRoute": "Direct supplier",
    "leadTimeDays": 30,
    "moq": 200,
    "lastOrdered": "May 2026",
    "dims": "—",
    "weightLbs": 0.6,
    "images": [],
    "badges": [
      "Imported"
    ],
    "costHistory": [],
    "orderHistory": [],
    "variants": [
      {
        "sku": "BLK-SEMI-SWC-18",
        "name": "Black",
        "pack": "1-Pack",
        "fnsku": "B0F9FTG6H1",
        "asin": "B0F9FTG6H1",
        "fbaStock": 325,
        "inbound": 240,
        "lastCostUsd": 3.07,
        "lastCostRmb": 21.8,
        "status": "Ready",
        "image": true,
        "salePrice": 49.99,
        "prep": "Labeled"
      },
      {
        "sku": "BRN-SEMI-SWC-18",
        "name": "Brown",
        "pack": "1-Pack",
        "fnsku": "B0F9FQ64VL",
        "asin": "B0F9FQ64VL",
        "fbaStock": 93,
        "inbound": 96,
        "lastCostUsd": 3.07,
        "lastCostRmb": 21.8,
        "status": "Ready",
        "image": true,
        "salePrice": 49.99,
        "prep": "Labeled"
      },
      {
        "sku": "TAN-RV-SWC-18",
        "name": "Brown (Tan SKU)",
        "pack": "1-Pack",
        "fnsku": "Pending sync",
        "asin": "B0F9FRRWY1",
        "fbaStock": 72,
        "inbound": 0,
        "lastCostUsd": 3.07,
        "lastCostRmb": 21.8,
        "status": "SKU mislabeled",
        "image": true,
        "salePrice": 49.99,
        "prep": "Labeled"
      },
      {
        "sku": "SEMI-SWC-18-BLKRED-STKLS",
        "name": "Carbon Red",
        "pack": "1-Pack",
        "fnsku": "X0051OGUDR",
        "asin": "B0GTMNFLM3",
        "fbaStock": 59,
        "inbound": 48,
        "lastCostUsd": 3.07,
        "lastCostRmb": 21.8,
        "status": "Ready",
        "image": true,
        "salePrice": 49.99,
        "prep": "Stickerless"
      },
      {
        "sku": "SEMI-SWC-18-BLKBRN-STKLS",
        "name": "Carbon Orange",
        "pack": "1-Pack",
        "fnsku": "X0051OH4LJ",
        "asin": "B0GTMZTNQQ",
        "fbaStock": 24,
        "inbound": 48,
        "lastCostUsd": 3.07,
        "lastCostRmb": 21.8,
        "status": "SKU mislabeled",
        "image": true,
        "salePrice": 49.99,
        "prep": "Stickerless"
      },
      {
        "sku": "SEMI-SWC-18-BLKBLU-STKLS",
        "name": "Carbon Blue",
        "pack": "1-Pack",
        "fnsku": "X0051ODLP7",
        "asin": "B0GTMSSW52",
        "fbaStock": 24,
        "inbound": 60,
        "lastCostUsd": 3.07,
        "lastCostRmb": 21.8,
        "status": "Ready",
        "image": true,
        "salePrice": 49.99,
        "prep": "Stickerless"
      }
    ]
  },
  {
    "id": "car-swc-15d",
    "parent": "15\" Carbon Fiber D-Shaped Steering Wheel Cover",
    "color": null,
    "category": "Steering wheel covers",
    "brand": "Vyonix",
    "material": "—",
    "supplier": "—",
    "supplierRoute": "Direct supplier",
    "leadTimeDays": 30,
    "moq": 200,
    "lastOrdered": "May 2026",
    "dims": "—",
    "weightLbs": 0.5,
    "images": [],
    "badges": [
      "Imported"
    ],
    "costHistory": [],
    "orderHistory": [],
    "variants": [
      {
        "sku": "BLK-CAR-SWC-15-D",
        "name": "Black D-shape",
        "pack": "1-Pack",
        "fnsku": "Pending sync",
        "asin": "B0FVYJS213",
        "fbaStock": 5,
        "inbound": 0,
        "lastCostUsd": 2.8,
        "lastCostRmb": 19.88,
        "status": "Ready",
        "image": true,
        "salePrice": 29.99,
        "prep": "Labeled"
      }
    ]
  },
  {
    "id": "semi-bsc",
    "parent": "Semi Truck Beaded Seat Cover",
    "color": null,
    "category": "Seat covers",
    "brand": "Vyonix",
    "material": "—",
    "supplier": "—",
    "supplierRoute": "Direct supplier",
    "leadTimeDays": 35,
    "moq": 200,
    "lastOrdered": "May 2026",
    "dims": "—",
    "weightLbs": 2.4,
    "images": [],
    "badges": [
      "Imported"
    ],
    "costHistory": [],
    "orderHistory": [],
    "variants": [
      {
        "sku": "VYB_SKM_10",
        "name": "Black",
        "pack": "1-Pack",
        "fnsku": "B0DB2LDWPG",
        "asin": "B0DB2LDWPG",
        "fbaStock": 0,
        "inbound": 400,
        "lastCostUsd": 8.23,
        "lastCostRmb": 58.43,
        "status": "Ready",
        "image": true,
        "salePrice": 79.99,
        "prep": "Labeled"
      },
      {
        "sku": "2PACK-SEMI-BSC-BLK-stickerless",
        "name": "Black",
        "pack": "2-Pack",
        "fnsku": "B0FR7FMGB5",
        "asin": "B0FR7FMGB5",
        "fbaStock": 0,
        "inbound": 171,
        "lastCostUsd": 15.81,
        "lastCostRmb": 112.25,
        "status": "Reorder",
        "image": true,
        "salePrice": 109.99,
        "prep": "Stickerless"
      },
      {
        "sku": "SEMI-BSC-WINE-RED-1PACK",
        "name": "Wine Red",
        "pack": "1-Pack",
        "fnsku": "Pending sync",
        "asin": "Pending sync",
        "fbaStock": 0,
        "inbound": 0,
        "lastCostUsd": 8.23,
        "lastCostRmb": 58.43,
        "status": "Not linked",
        "image": false,
        "salePrice": 79.99,
        "prep": "Labeled"
      },
      {
        "sku": "SEMI-BSC-WINE-RED-2PACK",
        "name": "Wine Red",
        "pack": "2-Pack",
        "fnsku": "Pending sync",
        "asin": "Pending sync",
        "fbaStock": 0,
        "inbound": 0,
        "lastCostUsd": 15.81,
        "lastCostRmb": 112.25,
        "status": "Not linked",
        "image": false,
        "salePrice": 109.99,
        "prep": "Labeled"
      },
      {
        "sku": "SEMI-BSC-DARK-GREY-1PACK",
        "name": "Dark Grey",
        "pack": "1-Pack",
        "fnsku": "Pending sync",
        "asin": "Pending sync",
        "fbaStock": 0,
        "inbound": 0,
        "lastCostUsd": 8.23,
        "lastCostRmb": 58.43,
        "status": "Not linked",
        "image": false,
        "salePrice": 79.99,
        "prep": "Labeled"
      },
      {
        "sku": "SEMI-BSC-DARK-GREY-2PACK",
        "name": "Dark Grey",
        "pack": "2-Pack",
        "fnsku": "Pending sync",
        "asin": "Pending sync",
        "fbaStock": 0,
        "inbound": 0,
        "lastCostUsd": 15.81,
        "lastCostRmb": 112.25,
        "status": "Not linked",
        "image": false,
        "salePrice": 109.99,
        "prep": "Labeled"
      },
      {
        "sku": "SEMI-BSC-PURE-COFFEE-1PACK",
        "name": "Coffee",
        "pack": "1-Pack",
        "fnsku": "Pending sync",
        "asin": "Pending sync",
        "fbaStock": 0,
        "inbound": 0,
        "lastCostUsd": 8.23,
        "lastCostRmb": 58.43,
        "status": "Not linked",
        "image": false,
        "salePrice": 79.99,
        "prep": "Labeled"
      },
      {
        "sku": "SEMI-BSC-PURE-COFFEE-2PACK",
        "name": "Coffee",
        "pack": "2-Pack",
        "fnsku": "Pending sync",
        "asin": "Pending sync",
        "fbaStock": 0,
        "inbound": 0,
        "lastCostUsd": 15.81,
        "lastCostRmb": 112.25,
        "status": "Not linked",
        "image": false,
        "salePrice": 109.99,
        "prep": "Labeled"
      },
      {
        "sku": "SEMI-BSC-BLUE-1PACK",
        "name": "Blue",
        "pack": "1-Pack",
        "fnsku": "Pending sync",
        "asin": "Pending sync",
        "fbaStock": 0,
        "inbound": 0,
        "lastCostUsd": 8.23,
        "lastCostRmb": 58.43,
        "status": "Not linked",
        "image": false,
        "salePrice": 79.99,
        "prep": "Labeled"
      },
      {
        "sku": "SEMI-BSC-BLUE-2PACK",
        "name": "Blue",
        "pack": "2-Pack",
        "fnsku": "Pending sync",
        "asin": "Pending sync",
        "fbaStock": 0,
        "inbound": 0,
        "lastCostUsd": 15.81,
        "lastCostRmb": 112.25,
        "status": "Not linked",
        "image": false,
        "salePrice": 109.99,
        "prep": "Labeled"
      }
    ]
  },
  {
    "id": "car-bsc",
    "parent": "Car Beaded Seat Cover",
    "color": null,
    "category": "Seat covers",
    "brand": "Vyonix",
    "material": "—",
    "supplier": "—",
    "supplierRoute": "Direct supplier",
    "leadTimeDays": 35,
    "moq": 200,
    "lastOrdered": "May 2026",
    "dims": "—",
    "weightLbs": 2,
    "images": [],
    "badges": [
      "Imported"
    ],
    "costHistory": [],
    "orderHistory": [],
    "variants": [
      {
        "sku": "VY-001-BLK",
        "name": "Royal Black",
        "pack": "1-Pack",
        "fnsku": "Pending sync",
        "asin": "B0CFCQK58F",
        "fbaStock": 281,
        "inbound": 400,
        "lastCostUsd": 8.23,
        "lastCostRmb": 58.43,
        "status": "Ready",
        "image": true,
        "salePrice": 59.99,
        "prep": "Labeled"
      },
      {
        "sku": "2PACK-CAR-BSC-BLK",
        "name": "Royal Black",
        "pack": "2-Pack",
        "fnsku": "Pending sync",
        "asin": "B0FR71W5XP",
        "fbaStock": 183,
        "inbound": 171,
        "lastCostUsd": 15.81,
        "lastCostRmb": 112.25,
        "status": "Ready",
        "image": true,
        "salePrice": 99.99,
        "prep": "Labeled"
      }
    ]
  },
  {
    "id": "car-asc",
    "parent": "Perforated Suede Seat Cushion (Cars)",
    "color": null,
    "category": "Seat cushions",
    "brand": "Vyonix",
    "material": "—",
    "supplier": "—",
    "supplierRoute": "Direct supplier",
    "leadTimeDays": 35,
    "moq": 200,
    "lastOrdered": "May 2026",
    "dims": "—",
    "weightLbs": 1.6,
    "images": [],
    "badges": [
      "Imported"
    ],
    "costHistory": [],
    "orderHistory": [],
    "variants": [
      {
        "sku": "1PACK-CAR-ASC-BLK",
        "name": "Black",
        "pack": "1-Pack",
        "fnsku": "Pending sync",
        "asin": "B0FR66QS19",
        "fbaStock": 106,
        "inbound": 0,
        "lastCostUsd": 7.13,
        "lastCostRmb": 50.62,
        "status": "Ready",
        "image": true,
        "salePrice": 69,
        "prep": "Labeled"
      },
      {
        "sku": "2PACK-CAR-ASC-BLK",
        "name": "Black",
        "pack": "2-Pack",
        "fnsku": "Pending sync",
        "asin": "B0FR81LQCV",
        "fbaStock": 62,
        "inbound": 0,
        "lastCostUsd": 13.63,
        "lastCostRmb": 96.77,
        "status": "Ready",
        "image": true,
        "salePrice": 109.99,
        "prep": "Labeled"
      }
    ]
  },
  {
    "id": "rv-bsc",
    "parent": "RV Captain Seat Cover",
    "color": null,
    "category": "Seat covers",
    "brand": "Vyonix",
    "material": "—",
    "supplier": "—",
    "supplierRoute": "Direct supplier",
    "leadTimeDays": 40,
    "moq": 150,
    "lastOrdered": "May 2026",
    "dims": "—",
    "weightLbs": 3.1,
    "images": [],
    "badges": [
      "Imported"
    ],
    "costHistory": [],
    "orderHistory": [],
    "variants": [
      {
        "sku": "RV-TAN-BSC-2U-0",
        "name": "Tan Beaded",
        "pack": "2-Pack",
        "fnsku": "X004QS4YLT",
        "asin": "B0FFN8WC94",
        "fbaStock": 148,
        "inbound": 1,
        "lastCostUsd": 17.6,
        "lastCostRmb": 124.96,
        "status": "Ready",
        "image": true,
        "salePrice": 89.99,
        "prep": "Labeled"
      }
    ]
  }
];

// Low-stock threshold (units across FBA) for the health/reorder signal.
const CAT_LOW_STOCK = 40;

// ----- derived helpers (shared by both pages) -----
function catFamilyById(id) {
  const list = (typeof catLoadFamilies === "function") ? catLoadFamilies() : CAT_FAMILIES;
  return list.find((f) => f.id === id) || null;
}

function catFamilyStats(f) {
  const variants = f.variants;
  const skuCount = variants.length;
  const stock = variants.reduce((n, v) => n + v.fbaStock, 0);
  const inbound = variants.reduce((n, v) => n + (v.inbound || 0), 0);
  const costs = variants.map((v) => v.lastCostUsd);
  const minCost = costs.length ? Math.min(...costs) : 0;
  const maxCost = costs.length ? Math.max(...costs) : 0;
  const gaps = variants.filter((v) => v.status !== "Ready" && v.status !== "Reorder").length;
  const reorder = variants.filter((v) => v.status === "Reorder" || v.fbaStock <= CAT_LOW_STOCK).length;
  // Family health: worst-case of its variants
  let health = "Ready";
  if (skuCount === 0) health = "Empty";
  else if (gaps > 0) health = "Data gap";
  else if (reorder > 0) health = "Reorder";
  return { skuCount, stock, inbound, minCost, maxCost, gaps, reorder, health };
}

const CAT_BRAND = (typeof window.brandName === "function") ? window.brandName() : "Vyonix";

const CAT_HEALTH_TONE = { Ready: "success", Reorder: "warning", "Data gap": "danger", Empty: "muted" };

// ----- shared persistence (localStorage) -----
// Lets created products + variant edits survive reloads AND be shared across
// the Catalog list, Product page, and Inventory (which all read the same store).
const CAT_STORE_KEY = "vy_catalog_families_v1";

// Fill safe defaults so a partial / created / legacy family can't crash the
// Product page (which expects costHistory/orderHistory/images/dims/etc).
function catNormalizeFamily(f) {
  const d = { color: null, category: "Uncategorized", material: "—", supplier: "—", supplierRoute: "Direct supplier", leadTimeDays: 30, moq: 0, lastOrdered: "—", dims: "—", weightLbs: 0, images: [], badges: [], costHistory: [], orderHistory: [], variants: [] };
  const out = { ...d, ...f };
  out.images = out.images || [];
  out.badges = out.badges || [];
  out.costHistory = out.costHistory || [];
  out.orderHistory = out.orderHistory || [];
  out.variants = (out.variants || []).map((v) => ({ ...v }));
  out.brand = out.brand || (typeof CAT_BRAND !== "undefined" ? CAT_BRAND : "Vyonix");
  return out;
}

function catLoadFamilies() {
  try {
    const raw = localStorage.getItem(CAT_STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length) return saved.map(catNormalizeFamily);
    }
  } catch (e) { /* ignore */ }
  return CAT_FAMILIES.map(catNormalizeFamily);
}

function catSaveFamilies(families) {
  try { localStorage.setItem(CAT_STORE_KEY, JSON.stringify(families)); } catch (e) { /* ignore */ }
}

// Replace one family's variants in the store and persist.
function catUpdateFamilyVariants(familyId, variants) {
  const all = catLoadFamilies().map((f) => (f.id === familyId ? { ...f, variants } : f));
  catSaveFamilies(all);
  return all;
}

// Patch family-level fields (name, category, supplier, leadTimeDays, moq, …).
function catUpdateFamily(familyId, patch) {
  const all = catLoadFamilies().map((f) => (f.id === familyId ? { ...f, ...patch } : f));
  catSaveFamilies(all);
  return all;
}

function catResetFamilies() {
  try { localStorage.removeItem(CAT_STORE_KEY); } catch (e) { /* ignore */ }
}

// ----------------------------------------------------------------------
// Product FAVORITES (persisted, shared by Catalog + Inventory). Keyed by
// family id so starring a product is consistent wherever it shows.
// ----------------------------------------------------------------------
const CAT_FAV_KEY = "vy_favorites_v1";
function catFavSet() {
  try { const a = JSON.parse(localStorage.getItem(CAT_FAV_KEY) || "[]"); return new Set(Array.isArray(a) ? a : []); }
  catch (e) { return new Set(); }
}
function catIsFav(id) { return catFavSet().has(id); }
function catToggleFav(id) {
  const s = catFavSet();
  s.has(id) ? s.delete(id) : s.add(id);
  try { localStorage.setItem(CAT_FAV_KEY, JSON.stringify([...s])); } catch (e) {}
  return s.has(id);
}

Object.assign(window, {
  CAT_FAMILIES, CAT_LOW_STOCK, catFamilyById, catFamilyStats, CAT_HEALTH_TONE,
  CAT_STORE_KEY, catLoadFamilies, catSaveFamilies, catUpdateFamilyVariants, catUpdateFamily, catResetFamilies, catNormalizeFamily,
  catFavSet, catIsFav, catToggleFav,
});
