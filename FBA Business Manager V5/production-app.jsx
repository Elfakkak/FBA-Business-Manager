// Vyonix Production Section — full implementation
// Route: /orders/:id/production

const { useState, useEffect } = React;

// ----------------------------------------------------------------------
// EDIT PATTERNS & SAVE STATE
// ----------------------------------------------------------------------
// Row ⋮ menus: always visible at 30% opacity, 100% on row hover
// Inline cell errors: red border + retry icon when save fails
// Regenerate PO: labeled button in PO block with confirmation
// Remove line/charge/file: 5-second toast with "Undo"
// Save status: "All synced · 2s ago" / "Saving…" / "Save failed — retry" in header

const ORDER_DATA = (function () {
  const o = window.VY_CURRENT_ORDER;
  if (o) return { id: o.id, title: o.title, supplier: o.factory, agent: o.agent && o.agent !== "Direct" ? "via " + o.agent : "Direct" };
  return { id: "ORD-2026-05-006", title: "Q1 restock — Beaded seat covers", supplier: "Sheng Te Long", agent: "via Mutual Trade Union" };
})();

// Per-order scope (null for the canonical sample OR the standalone page, which
// both keep the curated literals below). See order-scope.jsx.
const PROD_SCOPE = (window.VY_ORDER_SCOPE && !window.VY_ORDER_SCOPE.isSample) ? window.VY_ORDER_SCOPE : null;

const PRODUCTION_STATUS = PROD_SCOPE ? {
  stage: PROD_SCOPE.statusLabel || "In production",
  variants: PROD_SCOPE.skuCount,
  totalUnits: PROD_SCOPE.units,
  piCoverage: "PI coverage partial",
  nextMilestone: PROD_SCOPE.inProductionDone ? "Production complete" : "WIP photos due",
} : {
  stage: "In production",
  variants: 4,
  totalUnits: 1600,
  piCoverage: "PI coverage partial",
  nextMilestone: "WIP photos due May 25",
};

const PRODUCTION_KPI = PROD_SCOPE ? [
  { icon: "package", label: "Production scope", value: PROD_SCOPE.skuCount + (PROD_SCOPE.skuCount === 1 ? " SKU" : " SKUs"), sub: PROD_SCOPE.units.toLocaleString() + " pcs · $" + Math.round(PROD_SCOPE.goodsUsd).toLocaleString() + " product cost" },
  { icon: "clipboard", label: "Readiness", value: PROD_SCOPE.inProductionDone ? "On track" : "2 missing", sub: PROD_SCOPE.inProductionDone ? "PI on file" : "PI partial · 2 files needed", tone: PROD_SCOPE.inProductionDone ? "success" : "warning" },
  { icon: "activity", label: "Factory clock", value: PROD_SCOPE.inProductionDone ? "Complete" : "In production", sub: PROD_SCOPE.statusLabel || "—", tone: "info" },
] : [
  { icon: "package", label: "Production scope", value: "4 SKUs", sub: "1,600 pcs · $13,121 product cost" },
  { icon: "clipboard", label: "Readiness", value: "2 missing", sub: "PI partial · 2 files needed", tone: "warning" },
  { icon: "activity", label: "Factory clock", value: "Day 14 of 30", sub: "WIP photos due May 25", tone: "info" },
];

// Non-goods cost pool used to ESTIMATE per-SKU landed cost, kept consistent with
// Closeout's allocation model (fees by value; freight + inspection by units).
const PROD_NONGOODS = PROD_SCOPE ? PROD_SCOPE.nonGoods : { feesByValue: 945.04, byUnitsPool: 1162.0 + 350.0 };

const PRODUCT_LINES = PROD_SCOPE ? [
  {
    parent: PROD_SCOPE.title,
    parentSku: PROD_SCOPE.skus.map((s) => s.sku.split("-")[0]).filter((v, i, a) => a.indexOf(v) === i).join(" / "),
    variants: PROD_SCOPE.skus.map((s) => {
      const unitShare = PROD_SCOPE.units ? s.qty / PROD_SCOPE.units : 0;
      const valueShare = PROD_SCOPE.goodsUsd ? s.line / PROD_SCOPE.goodsUsd : 0;
      const alloc = PROD_NONGOODS.feesByValue * valueShare + PROD_NONGOODS.byUnitsPool * unitShare;
      const landedUnit = s.qty ? (s.line + alloc) / s.qty : 0;
      return { sku: s.sku, qty: s.qty, unitRmb: s.unitRmb, unitUsd: s.unitUsd, line: s.line, landed: landedUnit.toFixed(2) + " est" };
    }),
  },
] : [
  {
    parent: "Beaded seat cover — Black",
    parentSku: "SKU-BSC / CAR-BSC",
    variants: [
      { sku: "SEMI-BSC-1P-BLK", qty: 450, unitRmb: 56.75, unitUsd: 8.34, line: 3755.51, landed: "87.59 est" },
      { sku: "SEMI-BSC-2P-BLK", qty: 350, unitRmb: 54.50, unitUsd: 8.01, line: 2805.15, landed: "85.24 est" },
      { sku: "CAR-BSC-1P-BLK", qty: 450, unitRmb: 56.75, unitUsd: 8.34, line: 3755.51, landed: "87.59 est" },
      { sku: "CAR-BSC-2P-BLK", qty: 350, unitRmb: 54.50, unitUsd: 8.01, line: 2805.15, landed: "85.24 est" },
    ],
  },
];

const FACTORY_CHARGES = PROD_SCOPE ? [
  ...(PROD_SCOPE.agent ? [{ desc: "Agent service fee 5%", section: "Production", lineType: "Agent fee", qty: 1, amount: Math.round(PROD_SCOPE.goodsUsd * 0.05 * 100) / 100, coverage: "Uncovered", treatment: "inventoriable", basis: "value" }] : []),
  { desc: "Cartons export packaging", section: "Production", lineType: "Cartons", qty: 1, amount: Math.round(PROD_SCOPE.units * 0.11 * 100) / 100, coverage: "Uncovered", treatment: "inventoriable", basis: "units" },
  { desc: "Inland freight to port", section: "Shipping", lineType: "Inland freight", qty: 1, amount: Math.round(PROD_SCOPE.units * 0.175 * 100) / 100, coverage: "Uncovered", treatment: "inventoriable", basis: "units" },
  { desc: "Inspection fee estimate", section: "Inspection", lineType: "Inspection fee", qty: 1, amount: 350.00, coverage: "Uncovered", treatment: "inventoriable", basis: "units" },
] : [
  { desc: "Agent service fee 5%", section: "Production", lineType: "Agent fee", qty: 1, amount: 670.84, coverage: "C23REP9917-22", treatment: "inventoriable", basis: "value" },
  { desc: "Cartons export packaging", section: "Production", lineType: "Cartons", qty: 1, amount: 175.00, coverage: "C23REP9917-22", treatment: "inventoriable", basis: "units" },
  { desc: "Inland freight Yiwu to Ningbo", section: "Shipping", lineType: "Inland freight", qty: 1, amount: 279.41, coverage: "C23REP9917-22", treatment: "inventoriable", basis: "units" },
  { desc: "Inspection fee estimate", section: "Inspection", lineType: "Inspection fee", qty: 1, amount: 350.00, coverage: "Uncovered", treatment: "inventoriable", basis: "units" },
];

const PI_COVERAGE = [
  { ref: "C23REP9917-22", agent: "Mutual Trade Union", total: "$14,440.77", status: "Partial", file: true },
  { ref: "Supplier PI reference", supplier: "Sheng Te Long", total: "$0", status: "Reference only", file: false },
  { ref: "Supplier PO PDF", supplier: "BDJ Trading LLC", total: "Ready to send", status: "Ready", file: true },
];

// Related RFQs (only shown if data exists)
const RELATED_RFQS = [
  { ref: "RFQ-2026-042", status: "Quoted", suppliers: "3 suppliers", lastActivity: "2 days ago" },
  { ref: "RFQ-2026-038", status: "Declined", suppliers: "2 suppliers", lastActivity: "May 18" },
];

// Non-goods cost pool used to ESTIMATE per-SKU landed cost, kept consistent
// Non-goods cost pool — defined above (PROD_SCOPE-aware). Landed cost uses the
// same allocation model as Closeout (fees by value; freight + inspection by
// units). Duties excluded here — landed shown as "est".
function prodLandedUnit(variant, totalUnits, totalGoods) {
  const unitShare = totalUnits ? variant.qty / totalUnits : 0;
  const valueShare = totalGoods ? variant.line / totalGoods : 0;
  const alloc = PROD_NONGOODS.feesByValue * valueShare + PROD_NONGOODS.byUnitsPool * unitShare;
  return variant.qty ? (variant.line + alloc) / variant.qty : 0;
}

// ----------------------------------------------------------------------
// PRODUCTION PAGE
// ----------------------------------------------------------------------
// PRODUCTION BODY — chrome-less section content (used by standalone page
// AND embedded inside the Order Shell Production tab)
// ----------------------------------------------------------------------
const prodMenuItem = {
  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
  padding: "8px 10px", fontSize: 13, border: "none", background: "transparent",
  borderRadius: 7, cursor: "pointer", color: "hsl(var(--foreground))",
};

function VyProductionBody() {
  const [saveStatus, setSaveStatus] = useState('synced'); // 'synced' | 'saving' | 'error'
  const [lastSyncTime, setLastSyncTime] = useState('2s ago');
  const [showAddSkus, setShowAddSkus] = useState(false);
  const [showAddNonProductCost, setShowAddNonProductCost] = useState(false);
  const [showGeneratePO, setShowGeneratePO] = useState(false);
  const [showPageMenu, setShowPageMenu] = useState(false);
  const [pageMenuPos, setPageMenuPos] = useState(null);
  const prodMoreRef = React.useRef(null);
  function togglePageMenu() {
    if (showPageMenu) { setShowPageMenu(false); return; }
    const r = prodMoreRef.current.getBoundingClientRect();
    setPageMenuPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    setShowPageMenu(true);
  }

  // Mutable data — Add SKUs / Add non-product cost actually append here.
  const [productLines, setProductLines] = useState(PRODUCT_LINES);
  const [charges, setCharges] = useState(FACTORY_CHARGES);

  // Briefly flash the "Saving… → All synced" status after a mutation.
  function flashSaved() {
    setSaveStatus('saving');
    setTimeout(() => { setSaveStatus('synced'); setLastSyncTime('just now'); }, 600);
  }

  function handleAddSkus(lines) {
    if (!lines || !lines.length) return;
    const newVariants = lines.map((l) => ({
      sku: l.sku,
      qty: Number(l.qty) || 0,
      unitRmb: Number(l.unitRmb) || 0,
      unitUsd: Number(l.unitUsd) || 0,
      line: (Number(l.qty) || 0) * (Number(l.unitUsd) || 0),
      added: true,
    }));
    setProductLines((prev) => {
      const next = prev.map((p) => ({ ...p, variants: [...p.variants] }));
      // Append to the first product family (prototype keeps one parent group).
      next[0] = { ...next[0], variants: [...next[0].variants, ...newVariants] };
      return next;
    });
    flashSaved();
  }

  function handleAddCharge(cost) {
    const fullUsd = (typeof fxToUsd === "function") ? fxToUsd(cost.amount, cost.currency) : (cost.currency === "USD" ? cost.amount : cost.amount / (cost.currency === "CNY" ? 7.2 : cost.currency === "EUR" ? 0.92 : 1));
    const rate = (typeof fxRate === "function") ? fxRate(cost.currency) : 1;
    const section = (cost.details && cost.details.section) || "Production";
    const basisMap = { by_qty: "units", by_value: "value", split_evenly: "units", manual: "value" };

    // Bulk supply (packaging at MOQ): only the USED portion lands on this order;
    // the leftover is recorded as on-hand packaging stock, not expensed here.
    let amountUsd = fullUsd;
    let leftoverNote = null;
    const oid = (window.VY_CURRENT_ORDER && window.VY_CURRENT_ORDER.id) || null;
    const otitle = (window.VY_CURRENT_ORDER && window.VY_CURRENT_ORDER.title) || null;

    if (cost.supplyDraw && cost.supplyDraw.qty > 0 && typeof pkgConsume === "function") {
      // Draw from existing packaging inventory — decrement stock, cost the used value.
      const took = pkgConsume(cost.supplyDraw.itemId, cost.supplyDraw.qty, oid, otitle || "Order use");
      amountUsd = cost.supplyDraw.usedValue != null ? cost.supplyDraw.usedValue : amountUsd;
      leftoverNote = "from stock · " + took.toLocaleString() + " used";
      window.dispatchEvent(new CustomEvent("vy:packaging-changed"));
    } else if (cost.supply && cost.supply.qtyOrdered > 0) {
      const usedFrac = cost.supply.qtyOrdered > 0 ? (cost.supply.qtyUsed / cost.supply.qtyOrdered) : 1;
      amountUsd = Math.round(fullUsd * usedFrac * 100) / 100;
      const unitUsd = cost.supply.qtyOrdered > 0 ? fullUsd / cost.supply.qtyOrdered : 0;
      // Add the bulk buy to packaging inventory (top up if the item already
      // exists by name), then consume the used portion.
      if (typeof pkgAddItem === "function" && typeof pkgConsume === "function") {
        const famId = (window.VY_ORDER_SCOPE && window.VY_ORDER_SCOPE.familyId) || null;
        const existing = (typeof pkgItems === "function" ? pkgItems() : []).find((p) => (p.name || "").trim().toLowerCase() === (cost.description || "").trim().toLowerCase());
        let itemId;
        if (existing && typeof pkgReceive === "function") {
          pkgReceive(existing.id, cost.supply.qtyOrdered, unitUsd, "New bulk buy · " + (oid || "order"));
          itemId = existing.id;
        } else {
          itemId = pkgAddItem({ name: cost.description, kind: "Other", familyId: famId, unitCost: unitUsd, reorderPoint: 0, openingQty: cost.supply.qtyOrdered, source: "New bulk buy · " + (oid || "order") });
        }
        pkgConsume(itemId, cost.supply.qtyUsed, oid, otitle || "Order use");
        window.dispatchEvent(new CustomEvent("vy:packaging-changed"));
      } else if (typeof suppliesAdd === "function") {
        suppliesAdd({ item: cost.description, unitCost: unitUsd, qtyOrdered: cost.supply.qtyOrdered, qtyUsed: cost.supply.qtyUsed, orderId: oid, orderTitle: otitle });
      }
      leftoverNote = cost.supply.leftoverQty + " to stock";
      window.dispatchEvent(new CustomEvent("vy:supplies-changed"));
    }

    setCharges((prev) => [...prev, {
      desc: cost.description,
      section: ["Production", "Shipping", "Inspection"].includes(section) ? section : "Production",
      lineType: (cost.details && cost.details.costType) || ((cost.supply || cost.supplyDraw) ? "Packaging" : "Other"),
      qty: cost.supplyDraw ? cost.supplyDraw.qty : (cost.supply && cost.supply.qtyUsed ? cost.supply.qtyUsed : 1),
      amount: amountUsd,
      coverage: cost.invoiceCoverage === "uncovered" || !cost.invoiceCoverage ? "Uncovered" : cost.invoiceCoverage,
      treatment: cost.costTreatment || "inventoriable",   // inventoriable | period_expense
      basis: basisMap[cost.allocation] || "value",        // how it allocates in landed cost
      leftoverNote,
      added: true,
    }]);
    flashSaved();
  }

  // Inline-edit an existing production line's qty / unit cost.
  function handleUpdateVariant(sku, field, value) {
    setProductLines((prev) => prev.map((p) => ({
      ...p,
      variants: p.variants.map((v) => {
        if (v.sku !== sku) return v;
        const nv = { ...v, [field]: value === "" ? 0 : Number(value) };
        nv.line = (Number(nv.qty) || 0) * (Number(nv.unitUsd) || 0);
        return nv;
      }),
    })));
    flashSaved();
  }

  function handleRemoveVariant(sku) {
    setProductLines((prev) => prev.map((p) => ({ ...p, variants: p.variants.filter((v) => v.sku !== sku) })));
    flashSaved();
  }

  // Inline-edit / remove an existing non-product charge (by index).
  function handleUpdateCharge(index, field, value) {
    setCharges((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: field === "amount" || field === "qty" ? (value === "" ? 0 : Number(value)) : value } : c)));
    flashSaved();
  }

  function handleRemoveCharge(index) {
    setCharges((prev) => prev.filter((_, i) => i !== index));
    flashSaved();
  }

  // Publish user-added INVENTORIABLE charges so Closeout can fold them into
  // landed cost. Seeded charges are excluded (already represented via invoices);
  // period-expense charges are excluded (stay out of COGS).
  useEffect(() => {
    window.__VY_PROD_EXTRA_COSTS = charges
      .filter((c) => c.added && c.treatment === "inventoriable")
      .map((c) => ({ label: c.desc, amount: c.amount, basis: c.basis || "value" }));
    window.dispatchEvent(new CustomEvent("vy:prod-costs-changed"));
  }, [charges]);

  // Live scope — drives the first KPI + landed estimates.
  const allVariants = productLines.flatMap((p) => p.variants);
  const totalUnits = allVariants.reduce((n, v) => n + (v.qty || 0), 0);
  const totalGoods = allVariants.reduce((n, v) => n + (v.line || 0), 0);
  const skuCount = allVariants.length;

  const kpis = [
    { icon: "package", label: "Production scope", value: skuCount + " SKUs", sub: totalUnits.toLocaleString() + " pcs · $" + Math.round(totalGoods).toLocaleString() + " product cost" },
    PRODUCTION_KPI[1],
    PRODUCTION_KPI[2],
  ];

  return (
    <>
            {window.VyExampleNote ? <window.VyExampleNote section="production" /> : null}
            {/* Page header — shared two-column pattern (matches Invoices / Shipping) */}
            <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                {/* Left: identity + status */}
                <div style={{ flex: "1 1 460px", padding: "20px 22px", minWidth: 0 }}>
                  <h1 className="vy-page-title" style={{ fontSize: 24, margin: 0, fontWeight: 600 }}>Production</h1>
                  <p className="vy-page-sub" style={{ margin: "6px 0 0", maxWidth: "62ch" }}>
                    Factory scope, product lines, charges, readiness, and supplier files.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                    <span className="vy-badge vy-badge--info">{PRODUCTION_STATUS.stage}</span>
                    <span className="vy-badge vy-badge--muted">{skuCount} variants</span>
                    <span className="vy-badge vy-badge--muted">{totalUnits.toLocaleString()} pcs</span>
                    <span className="vy-badge vy-badge--warning">{PRODUCTION_STATUS.piCoverage}</span>
                    <span className="vy-badge vy-badge--brand">{PRODUCTION_STATUS.nextMilestone}</span>
                  </div>
                </div>
                {/* Right: next action */}
                <div style={{ flex: "1 1 300px", padding: "20px 22px", minWidth: 260, borderLeft: "1px solid hsl(var(--border))", background: "hsl(var(--accent) / 0.5)" }}>
                  <div className="vy-kicker" style={{ marginBottom: 6 }}>Next action</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Close readiness gaps</div>
                  <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "4px 0 14px" }}>
                    PI coverage partial · WIP photos due May 25 — build the scope, then generate the PO.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button type="button" className="vy-btn vy-btn--primary" onClick={() => setShowGeneratePO(true)}>
                      <VyIcon name="fileText" size={14} /><span>Generate PO</span>
                    </button>
                    <div style={{ position: "relative" }}>
                      <button ref={prodMoreRef} type="button" className="vy-btn vy-btn--outline" aria-label="More actions" aria-haspopup="true" aria-expanded={showPageMenu} onClick={togglePageMenu} style={{ padding: "0 10px" }}>
                        <VyIcon name="more" size={16} />
                      </button>
                      {showPageMenu && pageMenuPos ? ReactDOM.createPortal(
                        <>
                          <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setShowPageMenu(false)}></div>
                          <div className="vy-card" style={{ position: "fixed", top: pageMenuPos.top, right: pageMenuPos.right, zIndex: 9999, padding: 6, minWidth: 190, boxShadow: "var(--shadow-lg)" }}>
                            <button type="button" onClick={() => setShowPageMenu(false)} style={prodMenuItem}>
                              <VyIcon name="download" size={14} style={{ opacity: 0.7 }} /><span>Export production data</span>
                            </button>
                          </div>
                        </>,
                        document.body
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Next action banner - only show when action isn't obvious */}
            {false && ( // Hidden when "Add SKUs" button is already in header
              <div style={{ 
                padding: "10px 14px", 
                marginBottom: 16, 
                background: "hsl(var(--accent))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 12.5,
              }}>
                <VyIcon name="alertCircle" size={14} style={{ color: "hsl(var(--primary))" }} />
                <span style={{ flex: 1 }}>Waiting on PI from Mutual Trade Union</span>
                <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ height: 26, fontSize: 11.5 }}>
                  Go to Invoices
                </button>
              </div>
            )}

            {/* KPI cards */}
            <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              {kpis.map((kpi, i) => (
                <div key={i} className={"vy-card vy-kpi" + (kpi.tone ? ` vy-kpi--${kpi.tone}` : "")}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <VyIcon name={kpi.icon} size={14} style={{ opacity: 0.7 }} />
                    <span className="vy-kicker">{kpi.label}</span>
                  </div>
                  <div className="vy-kpi-value">{kpi.value}</div>
                  <div className="vy-kpi-sub">{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Scope & cost band — the money: what you're buying and for how much */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="vy-kicker" style={{ fontSize: 11 }}>Scope &amp; cost</div>

              {/* Production lines */}
              <ProductionLinesSection productLines={productLines} totalUnits={totalUnits} totalGoods={totalGoods} onAddSku={() => setShowAddSkus(true)} onUpdateVariant={handleUpdateVariant} onRemoveVariant={handleRemoveVariant} />

              {/* Factory charges */}
              <FactoryChargesSection charges={charges} productSubtotal={totalGoods} onAddCost={() => setShowAddNonProductCost(true)} onUpdateCharge={handleUpdateCharge} onRemoveCharge={handleRemoveCharge} />

              {/* Supplies on hand — leftover packaging from MOQ buys */}
              <SuppliesOnHandSection />

              {/* Purchase order — the output of scope + cost */}
              <PICoverageSection onOpenGeneratePO={() => setShowGeneratePO(true)} skuCount={skuCount} totalUnits={totalUnits} totalGoods={totalGoods} />
            </div>

            {/* Readiness band — supporting docs before this order can ship */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="vy-kicker" style={{ fontSize: 11 }}>Supporting files</div>

              {/* Production files */}
              <ProductionFilesSection />
            </div>

      <AddSkusModal 
        open={showAddSkus} 
        onClose={() => setShowAddSkus(false)}
        onAdd={handleAddSkus}
        existingSkus={allVariants.map((v) => v.sku)}
      />

      <AddNonProductCostModal
        open={showAddNonProductCost}
        onClose={() => setShowAddNonProductCost(false)}
        onAdd={handleAddCharge}
      />

      <GeneratePOSheet
        open={showGeneratePO}
        onClose={() => setShowGeneratePO(false)}
        onGenerate={(po) => {
          console.log("Generating PO:", po);
        }}
      />
    </>
  );
}

function ProductionPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [sheetKey, setSheetKey] = useState(null);
  
  
  

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <div className="vy-app">
      <VySidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="vy-app-main">
        <VyHeader
          onToggleMobileNav={() => setMobileNavOpen(true)}
          onOpenSearch={() => alert("Search")}
          onToggleTheme={() => setIsDark(!isDark)}
          isDark={isDark}
          onToggleActivity={() => alert("Activity")}
        />

        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Breadcrumb */}
            <nav className="vy-breadcrumb" aria-label="Breadcrumb">
              <a href="Vyonix Orders List.html" className="vy-bc-link">Orders</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <a href="Vyonix Order Shell.html" className="vy-bc-link vy-bc-mono">{ORDER_DATA.id}</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <span className="vy-bc-current" aria-current="page">Production</span>
            </nav>

            {/* Page switcher pills */}
            <nav className="vy-pageswitch" aria-label="Order pages">
              <a href="Vyonix Order Shell.html" className="vy-page-pill">
                <VyIcon name="orderHome" size={13} />
                <span>Home</span>
              </a>
              <button type="button" className="vy-page-pill is-active" aria-current="page">
                <VyIcon name="hammer" size={13} />
                <span>Production</span>
              </button>
              <button type="button" className="vy-page-pill">
                <VyIcon name="truck" size={13} />
                <span>Shipping</span>
              </button>
              <button type="button" className="vy-page-pill">
                <VyIcon name="clipboard" size={13} />
                <span>Inspection</span>
              </button>
              <button type="button" className="vy-page-pill">
                <VyIcon name="receipt" size={13} />
                <span>Invoices</span>
              </button>
              <button type="button" className="vy-page-pill">
                <VyIcon name="closeout" size={13} />
                <span>Landed cost</span>
              </button>
            </nav>

            <VyProductionBody />
          </div>
        </main>
      </div>

      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      
      <VySheet sheetKey={sheetKey} onClose={() => setSheetKey(null)} />
    </div>
  );
}

// ----------------------------------------------------------------------
// PRODUCTION LINES SECTION
// ----------------------------------------------------------------------
function ProductionLinesSection({ productLines, totalUnits, totalGoods, onAddSku, onUpdateVariant, onRemoveVariant }) {
  const [editing, setEditing] = useState(false);
  const editInput = { width: "100%", height: 28, padding: "2px 8px", textAlign: "right", fontSize: 11.5, fontFamily: "JetBrains Mono, monospace", border: "1px solid hsl(var(--input))", borderRadius: 6, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };
  return (
    <>
      <div className="vy-card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <VyIcon name="package" size={16} style={{ color: "hsl(var(--primary))" }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Production lines</h3>
            </div>
            <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>
              {editing ? "Editing — change quantities or unit cost; totals update live." : "Sellable SKUs and variants included in this factory commitment."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button 
              type="button" 
              className="vy-btn vy-btn--outline vy-btn--sm"
              onClick={onAddSku}
              style={{ fontSize: 11.5 }}
            >
              <VyIcon name="plus" size={12} />
              <span>Add SKU</span>
            </button>
            <button 
              type="button" 
              className={"vy-btn vy-btn--sm " + (editing ? "vy-btn--primary" : "vy-btn--ghost")}
              onClick={() => setEditing((e) => !e)}
              style={{ fontSize: 11.5 }}
            >
              <VyIcon name={editing ? "check" : "pencil"} size={12} />
              <span>{editing ? "Done" : "Edit"}</span>
            </button>
          </div>
        </div>

      {productLines.map((product, i) => (
        <div key={i} style={{ marginBottom: i < productLines.length - 1 ? 20 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 12px", background: "hsl(var(--accent))", borderRadius: 8 }}>
            <VyIcon name="package" size={14} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{product.parent}</div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{product.parentSku}</div>
            </div>
            <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>
              {product.variants.length} variants · {product.variants.reduce((sum, v) => sum + v.qty, 0)} pcs
            </span>
            <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ height: 26, fontSize: 11 }} onClick={onAddSku}>
              <VyIcon name="plus" size={11} />
              <span>Add SKU</span>
            </button>
          </div>

          <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 30 }}></th>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))" }}>SKU</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 80 }}>QTY</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 90 }}>UNIT ¥ REF</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 100 }}>UNIT $ INVOICE</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 100 }}>LINE $</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 100 }}>EST LANDED / U</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((v, vi) => {
                const landedUnit = prodLandedUnit(v, totalUnits, totalGoods);
                return (
                <tr key={vi} style={{ borderBottom: "1px solid hsl(var(--border) / 0.6)" }}>
                  <td style={{ padding: "10px 10px" }}>
                    {editing ? (
                      <button type="button" className="vy-icon-btn" onClick={() => onRemoveVariant(v.sku)} title="Remove line" style={{ width: 22, height: 22, color: "hsl(var(--danger))" }}>
                        <VyIcon name="x" size={12} />
                      </button>
                    ) : null}
                  </td>
                  <td style={{ padding: "10px 10px", fontFamily: "JetBrains Mono, monospace", fontSize: 11.5 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <image-slot id={"pvar-" + v.sku} style={{ width: "26px", height: "26px", flexShrink: 0 }} shape="rounded" radius="6" placeholder={v.sku}></image-slot>
                      <span>{v.sku}{v.added ? <span className="vy-badge vy-badge--brand" style={{ fontSize: 9, marginLeft: 6, padding: "1px 5px" }}>New</span> : null}</span>
                    </span>
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 500 }}>
                    {editing
                      ? <input type="number" min="0" value={v.qty} onChange={(e) => onUpdateVariant(v.sku, "qty", e.target.value)} style={editInput} />
                      : v.qty}
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: 11.5 }}>
                    {editing
                      ? <input type="number" min="0" step="0.01" value={v.unitRmb || 0} onChange={(e) => onUpdateVariant(v.sku, "unitRmb", e.target.value)} style={editInput} />
                      : "¥" + (v.unitRmb || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                    {editing
                      ? <input type="number" min="0" step="0.01" value={v.unitUsd || 0} onChange={(e) => onUpdateVariant(v.sku, "unitUsd", e.target.value)} style={editInput} />
                      : "$" + (v.unitUsd || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>${v.line.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td style={{ padding: "10px 10px", textAlign: "right" }}>
                    <span style={{ fontSize: 11.5, fontFamily: "JetBrains Mono, monospace", color: "hsl(var(--info))", background: "hsl(var(--info) / 0.1)", padding: "2px 6px", borderRadius: 4 }}>
                      ${landedUnit.toFixed(2)} est
                    </span>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid hsl(var(--border))" }}>
            <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>
              {product.variants.reduce((sum, v) => sum + v.qty, 0)} pcs
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
              Product subtotal ${product.variants.reduce((sum, v) => sum + v.line, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </span>
          </div>
        </div>
      ))}
    </div>
  </>
  );
}

// ----------------------------------------------------------------------
// SUPPLIES ON HAND — leftover packaging/inserts from MOQ buys
// ----------------------------------------------------------------------
function SuppliesOnHandSection() {
  const [, force] = useState(0);
  useEffect(() => {
    const h = () => force((n) => n + 1);
    window.addEventListener("vy:supplies-changed", h);
    window.addEventListener("vy:packaging-changed", h);
    return () => { window.removeEventListener("vy:supplies-changed", h); window.removeEventListener("vy:packaging-changed", h); };
  }, []);
  const onHand = (typeof pkgItems === "function") ? pkgItems().filter((x) => x.onHand > 0) : [];
  const fmt = (n) => "$" + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!onHand.length) return null;
  const totalVal = onHand.reduce((n, x) => n + x.value, 0);
  return (
    <section className="vy-card" style={{ padding: "16px 18px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--info) / 0.12)", color: "hsl(var(--info))" }}><VyIcon name="boxes" size={15} /></span>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Packaging on hand</h3>
            <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>Live from your Packaging inventory — orders draw from here.</p>
          </div>
        </div>
        <a href="Vyonix Packaging.html" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ textDecoration: "none", flexShrink: 0 }}><span>Manage</span><VyIcon name="arrowRight" size={12} /></a>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {onHand.map((x, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", border: "1px solid hsl(var(--border))", borderRadius: 9, background: "hsl(var(--background) / 0.4)" }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>{x.name}{x.familyId ? null : <span style={{ fontWeight: 400, color: "hsl(var(--muted-fg))" }}> · Any</span>}</span>
            <span style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: x.low ? "hsl(38 92% 45%)" : "hsl(var(--muted-fg))" }}>{x.onHand.toLocaleString()} on hand</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", minWidth: 90, textAlign: "right" }}>{fmt(x.value)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, fontSize: 12, color: "hsl(var(--muted-fg))" }}>Total value&nbsp;<strong style={{ color: "hsl(var(--foreground))", fontFamily: "JetBrains Mono, monospace" }}>{fmt(totalVal)}</strong></div>
    </section>
  );
}

// ----------------------------------------------------------------------
// NON-PRODUCT COSTS SECTION
// ----------------------------------------------------------------------
function FactoryChargesSection({ charges, productSubtotal, onAddCost, onUpdateCharge, onRemoveCharge }) {
  const [editing, setEditing] = useState(false);
  const nonProductTotal = charges.reduce((n, c) => n + (c.amount || 0), 0);
  const productionTotal = productSubtotal + nonProductTotal;
  const fmt = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const editInput = { width: "100%", height: 28, padding: "2px 8px", fontSize: 11.5, border: "1px solid hsl(var(--input))", borderRadius: 6, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

  // ---- coverage: reconcile each charge against the order's real Payables bills ----
  const fcOrderId = (() => { try { return new URLSearchParams(location.search).get("order") || "ORD-2026-05-006"; } catch (e) { return "ORD-2026-05-006"; } })();
  const fcBills = (window.PAY_INVOICES || []).filter((b) => b.orderId === fcOrderId && b.vendorType !== "Supplier");
  function fcCoverage(charge) {
    const lt = (charge.lineType || "").toLowerCase();
    if (lt.includes("carton") || lt.includes("packaging")) return { status: "pi", label: "In supplier PI" };
    let vtype = lt.includes("agent") ? "Agent" : lt.includes("freight") ? "Forwarder" : lt.includes("inspection") ? "Inspection" : null;
    if (!vtype) return { status: "uncovered" };
    const bill = fcBills.find((b) => b.vendorType === vtype);
    return bill ? { status: "covered", bill } : { status: "uncovered" };
  }
  const fcCov = charges.map(fcCoverage);
  const fcUncoveredAmt = charges.reduce((s, c, i) => s + (fcCov[i].status === "uncovered" ? (Number(c.amount) || 0) : 0), 0);
  const fcCoveredAmt = nonProductTotal - fcUncoveredAmt;
  const fcUncoveredCount = fcCov.filter((c) => c.status === "uncovered").length;

  return (
    <>
      <div className="vy-card" style={{ padding: "18px 20px" }}>
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <VyIcon name="dollar" size={16} style={{ color: "hsl(var(--primary))" }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Non-product costs</h3>
            </div>
            <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>
              {editing ? "Editing — adjust description, qty or amount; totals update live." : "Service fees, packaging, freight, and other charges bundled into production or the agent CI."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button 
              type="button" 
              className="vy-btn vy-btn--outline vy-btn--sm"
              onClick={onAddCost}
              style={{ fontSize: 11.5 }}
            >
              <VyIcon name="plus" size={12} />
              <span>Add cost</span>
            </button>
            <button 
              type="button" 
              className={"vy-btn vy-btn--sm " + (editing ? "vy-btn--primary" : "vy-btn--ghost")}
              onClick={() => setEditing((e) => !e)}
              style={{ fontSize: 11.5 }}
            >
              <VyIcon name={editing ? "check" : "pencil"} size={12} />
              <span>{editing ? "Done" : "Edit"}</span>
            </button>
          </div>
        </div>

      <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))" }}>Description</th>
            <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 100 }}>Section</th>
            <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 120 }}>Line type</th>
            <th style={{ padding: "8px 10px", textAlign: "center", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 60 }}>QTY</th>
            <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 100 }}>Amount</th>
            <th style={{ padding: "8px 10px", textAlign: "center", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 140 }}>{editing ? "" : "Coverage"}</th>
          </tr>
        </thead>
        <tbody>
          {charges.map((charge, i) => (
            <tr key={i} style={{ borderBottom: "1px solid hsl(var(--border) / 0.6)" }}>
              <td style={{ padding: editing ? "6px 10px" : "10px 10px" }}>
                {editing
                  ? <input type="text" value={charge.desc} onChange={(e) => onUpdateCharge(i, "desc", e.target.value)} style={editInput} />
                  : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span>{charge.desc}</span>
                      {charge.treatment ? (
                        <span className={"vy-badge vy-badge--" + (charge.treatment === "inventoriable" ? "success" : "muted")} style={{ fontSize: 9, padding: "1px 5px" }} title={charge.treatment === "inventoriable" ? "Rolls into landed cost (allocated " + (charge.basis === "units" ? "by units" : "by value") + ")" : "Period expense — stays out of COGS"}>
                          {charge.treatment === "inventoriable" ? "Inventoriable" : "Period"}
                        </span>
                      ) : null}
                      {charge.leftoverNote ? (
                        <span className="vy-badge vy-badge--info" style={{ fontSize: 9, padding: "1px 5px" }} title="Leftover supply carried as on-hand stock, not expensed to this order">
                          {charge.leftoverNote}
                        </span>
                      ) : null}
                    </div>
                  )}
              </td>
              <td style={{ padding: "10px 10px" }}>
                {editing ? (
                  <select value={charge.section} onChange={(e) => onUpdateCharge(i, "section", e.target.value)} style={{ ...editInput, height: 28 }}>
                    <option>Production</option><option>Shipping</option><option>Inspection</option>
                  </select>
                ) : (
                  <span className={`vy-badge vy-badge--${charge.section === "Production" ? "brand" : charge.section === "Shipping" ? "info" : "warning"}`} style={{ fontSize: 10 }}>
                    {charge.section}
                  </span>
                )}
              </td>
              <td style={{ padding: "10px 10px", fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{charge.lineType}</td>
              <td style={{ padding: "6px 10px", textAlign: "center" }}>
                {editing
                  ? <input type="number" min="0" value={charge.qty} onChange={(e) => onUpdateCharge(i, "qty", e.target.value)} style={{ ...editInput, textAlign: "center" }} />
                  : charge.qty}
              </td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                {editing
                  ? <input type="number" min="0" step="0.01" value={charge.amount} onChange={(e) => onUpdateCharge(i, "amount", e.target.value)} style={{ ...editInput, textAlign: "right", fontFamily: "JetBrains Mono, monospace" }} />
                  : "$" + charge.amount.toFixed(2)}
              </td>
              <td style={{ padding: "10px 10px", textAlign: "center", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>
                {editing ? (
                  <button type="button" className="vy-icon-btn" onClick={() => onRemoveCharge(i)} title="Remove charge" style={{ width: 22, height: 22, color: "hsl(var(--danger))" }}>
                    <VyIcon name="x" size={12} />
                  </button>
                ) : (() => {
                  const cov = fcCov[i];
                  if (cov.status === "covered") return <a href={"Vyonix Order Shell.html?order=" + fcOrderId + "#invoices"} title={"Covered by " + cov.bill.id} style={{ color: "hsl(var(--success))", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><VyIcon name="check" size={11} />{cov.bill.id}</a>;
                  if (cov.status === "pi") return <span style={{ color: "hsl(var(--muted-fg))", display: "inline-flex", alignItems: "center", gap: 4 }} title="Bundled into the supplier proforma invoice"><VyIcon name="check" size={11} />In PI</span>;
                  return <span style={{ color: "hsl(var(--warning))", display: "inline-flex", alignItems: "center", gap: 4 }} title="No vendor bill yet — still an estimate"><VyIcon name="alert" size={11} />Uncovered</span>;
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "11px 14px", borderRadius: 8, background: fcUncoveredCount ? "hsl(var(--warning) / 0.08)" : "hsl(var(--success) / 0.08)", border: "1px solid " + (fcUncoveredCount ? "hsl(var(--warning) / 0.3)" : "hsl(var(--success) / 0.3)") }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", background: fcUncoveredCount ? "hsl(var(--warning) / 0.16)" : "hsl(var(--success) / 0.16)", color: fcUncoveredCount ? "hsl(var(--warning))" : "hsl(var(--success))" }}>
          <VyIcon name="receipt" size={13} />
        </span>
        <div style={{ flex: 1, minWidth: 200, fontSize: 12 }}>
          <strong style={{ fontWeight: 600 }}>Reconciled against Payables</strong>
          <span style={{ color: "hsl(var(--muted-fg))" }}>&nbsp;&nbsp;Planned <strong style={{ color: "hsl(var(--foreground))", fontFamily: "JetBrains Mono, monospace" }}>{fmt(nonProductTotal)}</strong> · covered <strong style={{ color: "hsl(var(--success))", fontFamily: "JetBrains Mono, monospace" }}>{fmt(fcCoveredAmt)}</strong>{fcUncoveredCount ? <> · <strong style={{ color: "hsl(var(--warning))", fontFamily: "JetBrains Mono, monospace" }}>{fmt(fcUncoveredAmt)} uncovered</strong></> : null}</span>
        </div>
        {fcUncoveredCount ? (
          <a href={"Vyonix Order Shell.html?order=" + fcOrderId + "#invoices"} className="vy-btn vy-btn--outline vy-btn--sm" style={{ flexShrink: 0, fontSize: 11.5 }}>
            <VyIcon name="receipt" size={12} /><span>Add the bills</span>
          </a>
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: "1px solid hsl(var(--border))" }}>
        <div>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>PRODUCT SUBTOTAL</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>{fmt(productSubtotal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>NON-PRODUCT COSTS</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>{fmt(nonProductTotal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>PRODUCTION TOTAL</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>{fmt(productionTotal)}</div>
        </div>
      </div>
    </div>
  </>
  );
}

// ----------------------------------------------------------------------
// PURCHASE ORDER SECTION
// ----------------------------------------------------------------------
function PICoverageSection({ onOpenGeneratePO, skuCount = 0, totalUnits = 0, totalGoods = 0 }) {
  const [hasPO, setHasPO] = useState(false);
  const [showPOMenu, setShowPOMenu] = useState(false);
  const [poMenuPos, setPoMenuPos] = useState(null);
  const poMoreRef = React.useRef(null);
  function togglePoMenu() {
    if (showPOMenu) { setShowPOMenu(false); return; }
    const r = poMoreRef.current.getBoundingClientRect();
    setPoMenuPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    setShowPOMenu(true);
  }

  return (
    <div className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <VyIcon name="fileText" size={16} style={{ color: "hsl(var(--primary))" }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Purchase order</h3>
        </div>
        <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>
          Outgoing purchase order sent to supplier. Incoming PIs and invoices are tracked in the Invoices section.
        </p>
      </div>

      {!hasPO ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", background: "hsl(var(--accent) / 0.6)", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: "hsl(var(--muted-bg))", display: "grid", placeItems: "center", color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="fileText" size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Not generated yet</div>
            <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 1 }}>
              Builds from your scope above — {skuCount} SKU{skuCount === 1 ? "" : "s"} · {totalUnits.toLocaleString()} pcs · ${Math.round(totalGoods).toLocaleString()} goods
            </div>
          </div>
          <button 
            type="button" 
            className="vy-btn vy-btn--primary"
            style={{ flexShrink: 0 }}
            onClick={() => {
              setHasPO(true);
              onOpenGeneratePO();
            }}
          >
            <VyIcon name="fileText" size={14} />
            <span>Generate PO</span>
          </button>
        </div>
      ) : (
        <div style={{ padding: "12px 14px", background: "hsl(var(--background) / 0.6)", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "hsl(var(--success) / 0.15)", display: "grid", placeItems: "center" }}>
              <VyIcon name="fileText" size={16} style={{ color: "hsl(var(--success))" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>PO-ORD-2026-05-006</div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>
                BDJ Trading LLC → Sheng Te Long · $14,740.77
              </div>
            </div>
            <span className="vy-badge vy-badge--success">Open</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ height: 28, fontSize: 11.5 }}>
                <VyIcon name="eye" size={12} />
                <span>Open</span>
              </button>
              <button 
                type="button" 
                className="vy-btn vy-btn--ghost vy-btn--sm" 
                style={{ height: 28, fontSize: 11.5 }}
                onClick={onOpenGeneratePO}
              >
                <VyIcon name="pencil" size={12} />
                <span>Edit</span>
              </button>
              <button 
                type="button" 
                className="vy-btn vy-btn--ghost vy-btn--sm" 
                style={{ height: 28, fontSize: 11.5 }}
                onClick={() => alert('Export PDF feature coming soon')}
              >
                <VyIcon name="download" size={12} />
                <span>Export PDF</span>
              </button>
              <div style={{ position: "relative" }}>
                <button 
                  ref={poMoreRef}
                  type="button" 
                  className="vy-btn vy-btn--ghost vy-btn--icon vy-btn--sm" 
                  style={{ height: 28, width: 28 }}
                  aria-label="More PO actions"
                  onClick={togglePoMenu}
                >
                  <VyIcon name="more" size={12} />
                </button>
                {showPOMenu && poMenuPos ? ReactDOM.createPortal(
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setShowPOMenu(false)}></div>
                    <div className="vy-card" style={{ position: "fixed", top: poMenuPos.top, right: poMenuPos.right, zIndex: 9999, padding: 6, minWidth: 180, boxShadow: "var(--shadow-lg)" }}>
                      <button type="button" onClick={() => setShowPOMenu(false)} style={prodMenuItem}>
                        <VyIcon name="archive" size={14} style={{ opacity: 0.7 }} /><span>File history</span>
                      </button>
                      <button type="button" onClick={() => setShowPOMenu(false)} style={prodMenuItem}>
                        <VyIcon name="copy" size={14} style={{ opacity: 0.7 }} /><span>Duplicate</span>
                      </button>
                      <div style={{ height: 1, background: "hsl(var(--border))", margin: "4px 6px" }}></div>
                      <button 
                        type="button" 
                        style={prodMenuItem}
                        onClick={() => {
                          if (confirm('Replace the current PO. The old version is kept in file history.')) {
                            setShowPOMenu(false);
                            onOpenGeneratePO();
                          }
                        }}
                      >
                        <VyIcon name="refreshCw" size={14} style={{ opacity: 0.7 }} /><span>Regenerate from data</span>
                      </button>
                    </div>
                  </>,
                  document.body
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// PRODUCTION FILES SECTION
// ----------------------------------------------------------------------
function ProductionFilesSection() {
  const [fileSlots, setFileSlots] = useState([
    { label: "WIP photos", status: "missing", required: true, file: null, description: "Work-in-progress photos from factory floor", accept: "image/*" },
    { label: "Sample photos", status: "missing", required: true, file: null, description: "Final sample imagery before mass production", accept: "image/*" },
    { label: "Carton spec sheet", status: "uploaded", required: false, file: { name: "carton-spec-2024.pdf" }, description: "Packaging specifications and dimensions", accept: ".pdf,.xlsx,.docx" },
    { label: "Packing list template", status: "uploaded", required: false, file: { name: "packing-list.xlsx" }, description: "Template for shipment packing lists", accept: ".xlsx,.xls,.csv" },
    { label: "Factory master packing list", status: "missing", required: false, file: null, description: "Factory's full-order packing doc (whole run, before shipment splits)", accept: ".pdf,.xlsx,.xls,.csv" },
    { label: "Product spec sheet", status: null, required: false, file: null, description: "Detailed product specifications", accept: ".pdf,.xlsx,.docx" },
    { label: "Factory audit", status: null, required: false, file: null, description: "Factory compliance and audit documentation", accept: ".pdf,.docx" },
  ]);

  const [uploadModal, setUploadModal] = useState(null);

  function handleFileClick(index) {
    setUploadModal(index);
  }

  function proceedWithUpload() {
    const index = uploadModal;
    const slot = fileSlots[index];
    
    const input = document.createElement("input");
    input.type = "file";
    input.accept = slot.accept || "*/*";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        setFileSlots((prev) => {
          const newSlots = [...prev];
          newSlots[index] = {
            ...newSlots[index],
            status: "uploaded",
            file: { name: file.name },
          };
          return newSlots;
        });
      }
    };
    input.click();
    setUploadModal(null);
  }

  return (
    <>
      <div className="vy-card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <VyIcon name="clipboard" size={16} style={{ color: "hsl(var(--primary))" }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Production files</h3>
            </div>
            <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>
              WIP photos, specs, and documentation. Separate from PI/PO attachments.
            </p>
          </div>
          <button 
            type="button" 
            className="vy-btn vy-btn--outline vy-btn--sm" 
            style={{ height: 28, fontSize: 11.5 }}
            onClick={() => {
              const firstMissing = fileSlots.findIndex(s => s.status !== "uploaded");
              handleFileClick(firstMissing >= 0 ? firstMissing : 0);
            }}
          >
            <VyIcon name="plus" size={12} />
            <span>Upload file</span>
          </button>
        </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {fileSlots.map((slot, i) => (
          <div
            key={i}
            onClick={() => handleFileClick(i)}
            style={{
              padding: "14px 16px",
              borderRadius: 8,
              border: slot.status === "missing" 
                ? "2px solid hsl(var(--warning) / 0.4)" 
                : slot.status === "uploaded"
                ? "1px solid hsl(var(--success) / 0.4)"
                : "1px solid hsl(var(--border))",
              background: slot.status === "missing"
                ? "hsl(var(--warning) / 0.05)"
                : slot.status === "uploaded"
                ? "hsl(var(--success) / 0.05)"
                : "hsl(var(--background) / 0.6)",
              cursor: "pointer",
              transition: "all 120ms ease",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "var(--shadow-sm)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: slot.status === "uploaded" 
                ? "hsl(var(--success) / 0.15)" 
                : "hsl(var(--accent))",
              display: "grid",
              placeItems: "center",
            }}>
              <VyIcon 
                name={slot.status === "uploaded" ? "check" : "clipboard"} 
                size={18} 
                style={{ 
                  color: slot.status === "uploaded" 
                    ? "hsl(var(--success))" 
                    : "hsl(var(--muted-fg))" 
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontSize: 13, 
                fontWeight: 600,
                color: slot.status === "missing" ? "hsl(var(--warning))" : "hsl(var(--foreground))",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                {slot.label}
                {slot.required && slot.status === "missing" && (
                  <span style={{ 
                    fontSize: 9, 
                    fontWeight: 700, 
                    textTransform: "uppercase", 
                    color: "hsl(var(--warning))",
                    background: "hsl(var(--warning) / 0.15)",
                    padding: "2px 5px",
                    borderRadius: 3,
                  }}>
                    Required
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 2, lineHeight: 1.35 }}>
                {slot.description}
              </div>
              {slot.status === "uploaded" && slot.file ? (
                <div style={{ fontSize: 11, color: "hsl(var(--success))", marginTop: 3, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <VyIcon name="check" size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />{slot.file.name}
                </div>
              ) : null}
            </div>
            {slot.status === "uploaded" ? (
              <button 
                type="button" 
                className="vy-btn vy-btn--ghost vy-btn--sm" 
                style={{ height: 26, fontSize: 11 }}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  alert(`View file: ${slot.file.name}`); 
                }}
              >
                View
              </button>
            ) : (
              <VyIcon name="plus" size={14} style={{ color: "hsl(var(--muted-fg))" }} />
            )}
          </div>
        ))}
      </div>
      </div>

      {/* Upload Modal */}
      {uploadModal !== null && ReactDOM.createPortal((
        <div 
          style={{
            position: "fixed",
            inset: 0,
            background: "hsl(0 0% 0% / 0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setUploadModal(null)}
        >
          <div 
            style={{
              background: "hsl(var(--background))",
              borderRadius: 12,
              boxShadow: "var(--shadow-lg)",
              maxWidth: 480,
              width: "100%",
              padding: "24px 28px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  Upload file
                </h3>
                <p style={{ fontSize: 13, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>
                  Choose a file for this document slot
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadModal(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  borderRadius: 4,
                  display: "grid",
                  placeItems: "center",
                  color: "hsl(var(--muted-fg))",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "hsl(var(--accent))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <VyIcon name="x" size={18} />
              </button>
            </div>

            <div style={{
              padding: "16px 18px",
              background: "hsl(var(--accent))",
              borderRadius: 8,
              marginBottom: 20,
              border: "1px solid hsl(var(--border))",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  background: "hsl(var(--primary) / 0.15)",
                  display: "grid",
                  placeItems: "center",
                }}>
                  <VyIcon name="clipboard" size={16} style={{ color: "hsl(var(--primary))" }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {fileSlots[uploadModal].label}
                    {fileSlots[uploadModal].required && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "hsl(var(--warning))",
                        background: "hsl(var(--warning) / 0.15)",
                        padding: "2px 5px",
                        borderRadius: 3,
                        marginLeft: 8,
                      }}>
                        Required
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>
                    {fileSlots[uploadModal].description}
                  </div>
                </div>
              </div>

              <div style={{
                fontSize: 11,
                color: "hsl(var(--muted-fg))",
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid hsl(var(--border))",
              }}>
                <strong>Accepted formats:</strong> {fileSlots[uploadModal].accept === "image/*" ? "Images (JPG, PNG, etc.)" : fileSlots[uploadModal].accept.replace(/\./g, '').toUpperCase().split(',').join(', ')}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="vy-btn vy-btn--ghost"
                onClick={() => setUploadModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="vy-btn vy-btn--primary"
                onClick={proceedWithUpload}
              >
                <VyIcon name="upload" size={14} />
                <span>Choose file</span>
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
}

// ----------------------------------------------------------------------
// RELATED RFQs SECTION
// ----------------------------------------------------------------------
function RelatedRFQsSection() {
  return (
    <div className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <VyIcon name="clipboard" size={16} style={{ color: "hsl(var(--primary))" }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Related RFQs</h3>
        </div>
        <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>
          Quote requests that reference SKUs in this order.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {RELATED_RFQS.map((rfq, i) => (
          <div
            key={i}
            onClick={() => alert(`Navigate to /quote-requests/${rfq.ref}`)}
            style={{
              padding: "10px 12px",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              cursor: "pointer",
              transition: "all 120ms ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "hsl(var(--accent))";
              e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "hsl(var(--border))";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="vy-mono" style={{ fontSize: 12.5, fontWeight: 600 }}>
                {rfq.ref}
              </span>
              <span 
                className={`vy-badge vy-badge--${
                  rfq.status === "Quoted" ? "success" : 
                  rfq.status === "Declined" ? "muted" : 
                  "info"
                }`}
                style={{ fontSize: 10 }}
              >
                {rfq.status}
              </span>
              <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>
                {rfq.suppliers}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>
                {rfq.lastActivity}
              </span>
              <VyIcon name="chevronRight" size={12} style={{ color: "hsl(var(--muted-fg))" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Footer link to create new RFQ */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid hsl(var(--border))" }}>
        <a
          href={`#/quote-requests/new?fromOrder=${ORDER_DATA.id}&skus=SEMI-BSC-1P-BLK,SEMI-BSC-2P-BLK,CAR-BSC-1P-BLK,CAR-BSC-2P-BLK`}
          onClick={(e) => {
            e.preventDefault();
            alert(`Navigate to /quote-requests/new?fromOrder=${ORDER_DATA.id}&skus=...`);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "hsl(var(--primary))",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = "underline";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = "none";
          }}
        >
          <span>Start an RFQ for these SKUs</span>
          <VyIcon name="arrowRight" size={12} />
        </a>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// LANDED COST SECTION
// ----------------------------------------------------------------------
function LandedCostSection() {
  return (
    <div className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <VyIcon name="receipt" size={16} style={{ color: "hsl(var(--primary))" }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Landed cost preview</h3>
          </div>
          <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>
            Preview only. Landed cost locks after shipping and receiving.
          </p>
        </div>
        <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ height: 28, fontSize: 11.5 }}>
          Open Landed cost
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", background: "hsl(var(--accent))", borderRadius: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>PRODUCT SUBTOTAL</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>$13,121.32</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>FACTORY CHARGES</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>$1,424.45</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>ESTIMATED LANDED /UNIT</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>$9.58</div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// RECENT ACTIVITY SECTION
// ----------------------------------------------------------------------
function RecentActivitySection() {
  const activities = [
    { title: "Packaging spec requested", time: "2h", icon: "clipboard", tone: "info" },
    { title: "WIP photo reminder queued", time: "1d", icon: "alert", tone: "warning" },
    { title: "Product image updated", time: "3d", icon: "package", tone: "success" },
  ];

  return (
    <div className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <VyIcon name="activity" size={16} style={{ color: "hsl(var(--primary))" }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Recent production activity</h3>
          </div>
        </div>
        <a href="#" style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--info))", textDecoration: "none" }}>
          View all
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {activities.map((act, i) => (
          <div key={i} style={{ padding: "12px 14px", background: "hsl(var(--background) / 0.6)", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{act.title}</div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{act.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MOUNT
// ----------------------------------------------------------------------
Object.assign(window, { ProductionPage, VyProductionBody, PRODUCTION_STATUS, PRODUCTION_KPI, FACTORY_CHARGES });

// Only auto-mount when loaded as the standalone page. The Order Shell sets
// window.__VY_EMBED before loading this file and renders <VyProductionBody />
// inside its own Production tab instead.
if (!window.__VY_EMBED) {
  const root = ReactDOM.createRoot(document.getElementById("vy-root"));
  root.render(<ProductionPage />);
}
