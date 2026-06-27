// Inventory data — flattens the catalog variants into per-SKU inventory rows and
// attaches live-stock fields. Built ON TOP of CAT_FAMILIES (catalog-data.jsx must
// load first). This is where Catalog (master record) and Inventory (live state)
// connect: the join key is SKU → FNSKU.
//
// Source-of-truth convention (hybrid model):
//   Amazon (SP-API FBA Inventory + sales) : onHand, reserved, unfulfillable,
//                                            inbound, velocity, fnsku
//   Manual                                : reorderPoint (you set it)
//   Derived                               : available, daysCover, health

// Daily sales velocity per SKU (Amazon-derived). Fallback below for any SKU
// not listed.
const INV_VELOCITY = {
  "SEMI-BSC-1P-BLK": 6, "SEMI-BSC-2P-BLK": 4, "CAR-BSC-1P-BLK": 5, "CAR-BSC-2P-BLK": 3,
  "TRUCK-BSC-1P-BLK": 1.5, "TRUCK-BSC-2P-BLK": 1,
  "SEMI-BSC-1P-TAN": 3, "CAR-BSC-1P-TAN": 4, "TRUCK-BSC-1P-TAN": 1.5, "TRUCK-BSC-2P-TAN": 1,
  "MSC-BLK-S": 2.5, "MSC-BLK-M": 2, "MSC-BLK-L": 2.2, "MSC-GRY-S": 1.5, "MSC-GRY-M": 2, "MSC-GRY-L": 1.8,
  "FLR-MAT-UNIV": 3, "AIR-FRESH-CLIP": 12,
};

// Stranded / unfulfillable units (Amazon). Most SKUs have none.
const INV_UNFULFILLABLE = { "CAR-BSC-2P-BLK": 2, "MSC-GRY-S": 3 };

const INV_SAFETY_DAYS = 14;             // buffer beyond lead time for reorder point
const INV_FCS = ["ONT8", "LGB8", "MDW2", "ATL6"]; // fulfillment centers (round-robin)

// Build the flat rows from the catalog families (shared persisted store, so
// products created on the Catalog list show up here too).
const INV_ROWS = (() => {
  const rows = [];
  let idx = 0;
  (typeof catLoadFamilies === "function" ? catLoadFamilies() : CAT_FAMILIES).forEach((f) => {
    f.variants.forEach((v) => {
      const velocity = INV_VELOCITY[v.sku] != null ? INV_VELOCITY[v.sku] : Math.max(0.5, Math.round(v.fbaStock / 30));
      const reserved = Math.min(v.fbaStock, Math.round(velocity * 2));
      const unfulfillable = INV_UNFULFILLABLE[v.sku] || 0;
      const reorderPoint = Math.ceil(velocity * (f.leadTimeDays + INV_SAFETY_DAYS));
      const fc = INV_FCS[idx % INV_FCS.length];
      idx++;
      rows.push({
        familyId: f.id, parent: f.parent, color: f.color, category: f.category, supplier: f.supplier,
        sku: v.sku, name: v.name, pack: v.pack, fnsku: v.fnsku, asin: v.asin,
        onHand: v.fbaStock, reserved, unfulfillable, inbound: v.inbound || 0,
        velocity, leadTimeDays: f.leadTimeDays, reorderPoint, fc,
        lastCostUsd: v.lastCostUsd, lastCostRmb: v.lastCostRmb,
      });
    });
  });
  return rows;
})();

function invStats(row) {
  const available = Math.max(0, row.onHand - row.reserved - row.unfulfillable);
  const projected = available + row.inbound;
  const daysCover = row.velocity > 0 ? available / row.velocity : Infinity;
  let health = "Healthy";
  if (projected < Number(row.reorderPoint)) health = "Reorder";
  else if (daysCover < INV_SAFETY_DAYS && row.inbound === 0) health = "Low";
  return { available, projected, daysCover, health };
}

const INV_HEALTH_TONE = { Healthy: "success", Low: "warning", Reorder: "danger" };

// Mock last-sync time (the Amazon connection's heartbeat).
const INV_LAST_SYNC = "18 min ago";

Object.assign(window, { INV_ROWS, INV_FCS, INV_SAFETY_DAYS, invStats, INV_HEALTH_TONE, INV_LAST_SYNC });
