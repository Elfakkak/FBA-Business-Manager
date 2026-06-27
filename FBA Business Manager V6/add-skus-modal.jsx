// Add SKUs Modal — Two-column catalog selection
// Shows existing catalog SKUs for selection, adds them as order lines

const CATALOG_FAMILIES = [
  {
    id: "bsc-black",
    parent: "Beaded seat cover",
    color: "Black",
    variantCount: 6,
    supplier: "Sheng Te Long",
    lastOrdered: "May 2026",
    badges: ["Supplier ready", "1 missing image", "Recently ordered"],
    variants: [
      { sku: "SEMI-BSC-1P-BLK", name: "Semi", pack: "1-pack", supplier: "Sheng Te Long", fbaStock: 120, lastCostUsd: 8.34, lastCostRmb: 56.75, status: "Ready", image: true, inOrder: false },
      { sku: "SEMI-BSC-2P-BLK", name: "Semi", pack: "2-pack", supplier: "Sheng Te Long", fbaStock: 80, lastCostUsd: 8.01, lastCostRmb: 54.50, status: "Missing image", image: false, inOrder: false },
      { sku: "CAR-BSC-1P-BLK", name: "Car", pack: "1-pack", supplier: "Sheng Te Long", fbaStock: 96, lastCostUsd: 8.34, lastCostRmb: 56.75, status: "Ready", image: true, inOrder: false },
      { sku: "CAR-BSC-2P-BLK", name: "Car", pack: "2-pack", supplier: "Sheng Te Long", fbaStock: 42, lastCostUsd: 8.01, lastCostRmb: 54.50, status: "Missing title", image: true, inOrder: true },
      { sku: "TRUCK-BSC-1P-BLK", name: "Truck", pack: "1-pack", supplier: "Sheng Te Long", fbaStock: 18, lastCostUsd: 8.72, lastCostRmb: 60.00, status: "Ready", image: true, inOrder: false },
      { sku: "TRUCK-BSC-2P-BLK", name: "Truck", pack: "2-pack", supplier: "Sheng Te Long", fbaStock: 12, lastCostUsd: 8.39, lastCostRmb: 58.00, status: "Ready", image: true, inOrder: false },
    ],
  },
  {
    id: "bsc-tan",
    parent: "Beaded seat cover",
    color: "Tan",
    variantCount: 4,
    supplier: "Sheng Te Long",
    lastOrdered: "Apr 2026",
    badges: ["Supplier ready"],
    variants: [
      { sku: "SEMI-BSC-1P-TAN", name: "Semi", pack: "1-pack", supplier: "Sheng Te Long", fbaStock: 89, lastCostUsd: 8.34, lastCostRmb: 56.75, status: "Ready", image: true, inOrder: false },
      { sku: "CAR-BSC-1P-TAN", name: "Car", pack: "1-pack", supplier: "Sheng Te Long", fbaStock: 210, lastCostUsd: 8.34, lastCostRmb: 56.75, status: "Ready", image: true, inOrder: false },
      { sku: "TRUCK-BSC-1P-TAN", name: "Truck", pack: "1-pack", supplier: "Sheng Te Long", fbaStock: 45, lastCostUsd: 8.72, lastCostRmb: 60.00, status: "Missing cost", image: true, inOrder: false },
      { sku: "TRUCK-BSC-2P-TAN", name: "Truck", pack: "2-pack", supplier: "Sheng Te Long", fbaStock: 28, lastCostUsd: 8.39, lastCostRmb: 58.00, status: "Ready", image: false, inOrder: false },
    ],
  },
  {
    id: "msc",
    parent: "Microfiber steering cover",
    color: null,
    variantCount: 6,
    supplier: "Ningbo Auto Trim",
    lastOrdered: "Mar 2026",
    badges: ["Reorder needed"],
    variants: [
      { sku: "MSC-BLK-S", name: "Black small", pack: "1-pack", supplier: "Ningbo Auto Trim", fbaStock: 24, lastCostUsd: 3.45, lastCostRmb: 24.80, status: "Reorder", image: true, inOrder: false },
      { sku: "MSC-BLK-M", name: "Black medium", pack: "1-pack", supplier: "Ningbo Auto Trim", fbaStock: 18, lastCostUsd: 3.45, lastCostRmb: 24.80, status: "Reorder", image: true, inOrder: false },
      { sku: "MSC-BLK-L", name: "Black large", pack: "1-pack", supplier: "Ningbo Auto Trim", fbaStock: 32, lastCostUsd: 3.45, lastCostRmb: 24.80, status: "Reorder", image: true, inOrder: false },
      { sku: "MSC-GRY-S", name: "Gray small", pack: "1-pack", supplier: "Ningbo Auto Trim", fbaStock: 15, lastCostUsd: 3.45, lastCostRmb: 24.80, status: "Reorder", image: false, inOrder: false },
      { sku: "MSC-GRY-M", name: "Gray medium", pack: "1-pack", supplier: "Ningbo Auto Trim", fbaStock: 21, lastCostUsd: 3.45, lastCostRmb: 24.80, status: "Reorder", image: true, inOrder: false },
      { sku: "MSC-GRY-L", name: "Gray large", pack: "1-pack", supplier: "Ningbo Auto Trim", fbaStock: 19, lastCostUsd: 3.45, lastCostRmb: 24.80, status: "Ready", image: true, inOrder: false },
    ],
  },
  {
    id: "standalone-floor-mat",
    parent: "Premium floor mat set",
    color: null,
    variantCount: 1,
    supplier: "Guangzhou Auto Parts",
    lastOrdered: "Jan 2026",
    badges: ["Standalone"],
    isStandalone: true,
    variants: [
      { sku: "FLR-MAT-UNIV", name: "Universal", pack: "4-piece set", supplier: "Guangzhou Auto Parts", fbaStock: 156, lastCostUsd: 12.80, lastCostRmb: 89.00, status: "Ready", image: true, inOrder: false },
    ],
  },
  {
    id: "standalone-air-fresh",
    parent: "Air freshener clip",
    color: null,
    variantCount: 1,
    supplier: "Yiwu Fragrance Co",
    lastOrdered: "Feb 2026",
    badges: ["Standalone"],
    isStandalone: true,
    variants: [
      { sku: "AIR-FRESH-CLIP", name: "Default", pack: "single", supplier: "Yiwu Fragrance Co", fbaStock: 420, lastCostUsd: 1.25, lastCostRmb: 8.50, status: "Ready", image: true, inOrder: false },
    ],
  },
];

// Build the picker's family list from the LIVE catalog (catLoadFamilies) so it
// stays in sync with Products / Inventory — created products show up, costs and
// stock reflect the real record. Falls back to the bundled sample only if the
// catalog data isn't loaded on the page. Maps each catalog family/variant into
// the row shape the picker renders.
function catalogPickerFamilies() {
  if (typeof catLoadFamilies !== "function") return CATALOG_FAMILIES;
  const fams = catLoadFamilies().filter((f) => f.variants && f.variants.length);
  return fams.map((f) => ({
    id: f.id,
    parent: f.parent,
    color: f.color || null,
    variantCount: f.variants.length,
    supplier: f.supplier || "—",
    lastOrdered: f.lastOrdered || "—",
    badges: f.badges || [],
    variants: f.variants.map((v) => ({
      sku: v.sku,
      name: v.name || (Array.isArray(v.attrs) ? v.attrs.map((a) => a.value).join(" · ") : ""),
      pack: v.pack || "",
      supplier: v.supplier || f.supplier || "—",
      fbaStock: Number(v.fbaStock) || 0,
      lastCostUsd: Number(v.lastCostUsd) || 0,
      lastCostRmb: Number(v.lastCostRmb) || 0,
      status: v.status || (Number(v.lastCostUsd) > 0 ? "Ready" : "Missing cost"),
      image: v.image != null ? v.image : true,
      inOrder: false,
    })),
  }));
}

function AddSkusModal({ open, onClose, onAdd, existingSkus = [] }) {
  const [searchQuery, setSearchQuery] = vyUseState("");
  const [selectedFilter, setSelectedFilter] = vyUseState("All");
  const [expandedFamilies, setExpandedFamilies] = vyUseState(["bsc-black", "standalone-floor-mat", "standalone-air-fresh"]);
  const [selectedLines, setSelectedLines] = vyUseState([]);
  const [infoExpanded, setInfoExpanded] = vyUseState(false);

  function toggleFamily(familyId) {
    setExpandedFamilies(prev => 
      prev.includes(familyId) 
        ? prev.filter(id => id !== familyId)
        : [...prev, familyId]
    );
  }

  function toggleVariant(family, variant) {
    if (variant.inOrder || existingSkus.includes(variant.sku)) return;

    const lineId = variant.sku;
    const existing = selectedLines.find(l => l.sku === variant.sku);

    if (existing) {
      setSelectedLines(prev => prev.filter(l => l.sku !== variant.sku));
    } else {
      setSelectedLines(prev => [...prev, {
        sku: variant.sku,
        name: `${family.parent}${family.color ? ` — ${family.color}` : ""} · ${variant.name} · ${variant.pack}`,
        qty: 100,
        unitUsd: variant.lastCostUsd || 0,
        unitRmb: variant.lastCostRmb || 0,
        image: variant.image,
        status: variant.status,
      }]);
    }
  }

  function selectAllVariants(family) {
    const availableVariants = family.variants.filter(v => !v.inOrder && !existingSkus.includes(v.sku));
    const allSelected = availableVariants.every(v => selectedLines.some(l => l.sku === v.sku));

    if (allSelected) {
      // Deselect all
      setSelectedLines(prev => prev.filter(l => !availableVariants.some(v => v.sku === l.sku)));
    } else {
      // Select all available
      const newLines = availableVariants
        .filter(v => !selectedLines.some(l => l.sku === v.sku))
        .map(variant => ({
          sku: variant.sku,
          name: `${family.parent}${family.color ? ` — ${family.color}` : ""} · ${variant.name} · ${variant.pack}`,
          qty: 100,
          unitUsd: variant.lastCostUsd || 0,
          unitRmb: variant.lastCostRmb || 0,
          image: variant.image,
          status: variant.status,
        }));
      setSelectedLines(prev => [...prev, ...newLines]);
    }
  }

  function updateLine(sku, field, value) {
    setSelectedLines(prev => prev.map(l => 
      l.sku === sku ? { ...l, [field]: parseFloat(value) || 0 } : l
    ));
  }

  function removeLine(sku) {
    setSelectedLines(prev => prev.filter(l => l.sku !== sku));
  }

  const totalUnits = selectedLines.reduce((sum, l) => sum + l.qty, 0);
  const totalCost = selectedLines.reduce((sum, l) => sum + (l.qty * l.unitUsd), 0);
  const hasIssues = selectedLines.some(l => l.qty <= 0 || l.unitUsd <= 0 || !l.image || l.status !== "Ready");

  if (!open) return null;

  const pickerFamilies = catalogPickerFamilies();

  return ReactDOM.createPortal(
    <React.Fragment>
      <div 
        className="vy-scrim is-open" 
        onClick={onClose}
        style={{ 
          background: "hsla(0, 0%, 0%, 0.4)",
          backdropFilter: "blur(2px)",
        }}
      />
      <div 
        style={{ 
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "20px",
          pointerEvents: "none",
        }}
      >
        <div 
          style={{ 
            width: "100%",
            maxWidth: 1120, 
            maxHeight: "82vh",
            display: "flex",
            flexDirection: "column",
            background: "hsl(var(--card))",
            borderRadius: 8,
            border: "1px solid hsl(var(--border))",
            boxShadow: "0 8px 32px hsla(0, 0%, 0%, 0.12), 0 2px 8px hsla(0, 0%, 0%, 0.08)",
            pointerEvents: "auto",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--card))", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "hsl(var(--foreground))" }}>Add SKUs</h2>
                  <button 
                    type="button" 
                    className="vy-icon-btn"
                    onClick={() => setInfoExpanded(!infoExpanded)}
                    style={{ 
                      width: 20, 
                      height: 20,
                      opacity: 0.6,
                    }}
                    title="Info about adding SKUs"
                  >
                    <VyIcon name="help" size={14} />
                  </button>
                </div>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "hsl(var(--muted-fg))" }}>
                  Select existing catalog variants for this production order.
                </p>
                {infoExpanded && (
                  <div style={{ 
                    marginTop: 10, 
                    padding: "8px 10px", 
                    background: "hsl(var(--info) / 0.08)", 
                    border: "1px solid hsl(var(--info) / 0.2)",
                    borderRadius: 6,
                    fontSize: 11.5,
                    color: "hsl(var(--foreground))",
                  }}>
                    <strong>Missing images or data?</strong> No problem — add the SKU anyway. You can fill in details later in the production lines table.
                  </div>
                )}
              </div>
              <button type="button" className="vy-icon-btn" onClick={onClose} style={{ marginTop: -4 }}>
                <VyIcon name="x" size={18} />
              </button>
            </div>
          </div>

          {/* Body — two columns */}
          <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
            {/* Left: Catalog */}
            <div style={{ flex: "0 0 68%", display: "flex", flexDirection: "column", borderRight: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}>
              {/* Search + filters */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}>
                <input
                  type="text"
                  className="vy-input"
                  placeholder="Search SKU, title, ASIN, family, supplier"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ marginBottom: 10, fontSize: 13 }}
                />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {["All", "Reorder needed", "Missing cost", "Missing image", "Recently ordered"].map(f => (
                    <button
                      key={f}
                      type="button"
                      className="vy-chip"
                      onClick={() => setSelectedFilter(f)}
                      style={
                        selectedFilter === f
                          ? { 
                              background: "hsl(var(--primary) / 0.12)", 
                              color: "hsl(var(--primary))", 
                              border: "1px solid hsl(var(--primary) / 0.3)", 
                              fontSize: 11,
                              padding: "4px 10px",
                              borderRadius: 4,
                              cursor: "pointer"
                            }
                          : { 
                              fontSize: 11, 
                              background: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              color: "hsl(var(--foreground))",
                              padding: "4px 10px",
                              borderRadius: 4,
                              cursor: "pointer"
                            }
                      }
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div style={{ padding: "8px 10px", background: "hsl(var(--accent))", border: "1px solid hsl(var(--border))", borderRadius: 5, fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>
                  Add SKUs creates order lines only. Catalog products, invoices, payments, shipments, and service charges stay in their own sections.
                </div>
              </div>

              {/* Catalog list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", background: "hsl(var(--muted-bg) / 0.5)" }}>
                {pickerFamilies.map(family => {
                  const isExpanded = expandedFamilies.includes(family.id);
                  const availableVariants = family.variants.filter(v => !v.inOrder);
                  const selectedCount = availableVariants.filter(v => selectedLines.some(l => l.sku === v.sku)).length;
                  const allSelected = availableVariants.length > 0 && selectedCount === availableVariants.length;
                  
                  return (
                    <div key={family.id} style={{ marginBottom: 12 }}>
                      {/* Family header */}
                      <div
                        style={{
                          padding: "12px 14px",
                          background: "hsl(var(--card))",
                          border: "1px solid " + (selectedCount > 0 ? "hsl(var(--primary) / 0.5)" : "hsl(var(--border))"),
                          borderLeft: "3px solid " + (selectedCount > 0 ? "hsl(var(--primary))" : "hsl(var(--border))"),
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: isExpanded ? 6 : 0,
                          boxShadow: "0 1px 2px hsla(0,0%,0%,0.04)",
                          transition: "all 120ms ease",
                        }}
                      >
                        <div 
                          onClick={() => toggleFamily(family.id)}
                          style={{ flex: 1, cursor: "pointer" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.parentElement.style.background = "hsl(var(--accent))";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.parentElement.style.background = "hsl(var(--card))";
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>
                            {family.parent}{family.color ? ` · ${family.color}` : ""}
                            {selectedCount > 0 && (
                              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: "hsl(var(--primary))" }}>
                                ({selectedCount} of {availableVariants.length} selected)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 2 }}>
                            {family.isStandalone ? "1 SKU" : `${family.variantCount} variants`} · factory {family.supplier} · last ordered {family.lastOrdered}
                          </div>
                          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                            {family.badges.map((badge, i) => (
                              <span 
                                key={i} 
                                className={badge === "Standalone" ? "vy-badge vy-badge--primary" : "vy-badge vy-badge--muted"} 
                                style={{ fontSize: 9 }}
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isExpanded && availableVariants.length > 1 && (
                            <button
                              type="button"
                              className="vy-btn vy-btn--ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectAllVariants(family);
                              }}
                              style={{ fontSize: 11, padding: "4px 8px", height: 26 }}
                            >
                              {allSelected ? "Deselect all" : "Select all"}
                            </button>
                          )}
                          <VyIcon name={isExpanded ? "chevronDown" : "chevronRight"} size={14} style={{ color: "hsl(var(--muted-fg))" }} />
                        </div>
                      </div>

                      {/* Variant rows */}
                      {isExpanded && (
                        <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 2px hsla(0,0%,0%,0.04)" }}>
                          {family.variants.map((variant, idx) => {
                            const isSelected = selectedLines.some(l => l.sku === variant.sku);
                            const isDisabled = variant.inOrder || existingSkus.includes(variant.sku);

                            return (
                              <div
                                key={variant.sku}
                                onClick={() => !isDisabled && toggleVariant(family, variant)}
                                style={{
                                  padding: "9px 12px",
                                  background: isDisabled ? "hsl(var(--muted-bg) / 0.4)" : isSelected ? "hsl(var(--primary) / 0.1)" : "hsl(var(--card))",
                                  borderLeft: "3px solid " + (isSelected ? "hsl(var(--primary))" : "transparent"),
                                  borderBottom: idx < family.variants.length - 1 ? "1px solid hsl(var(--border) / 0.6)" : "none",
                                  cursor: isDisabled ? "not-allowed" : "pointer",
                                  opacity: isDisabled ? 0.55 : 1,
                                  display: "grid",
                                  gridTemplateColumns: "24px 36px 140px 160px 80px 70px 70px auto",
                                  gap: 10,
                                  alignItems: "center",
                                  fontSize: 11.5,
                                  transition: "background 100ms ease",
                                }}
                                onMouseEnter={(e) => {
                                  if (!isDisabled) e.currentTarget.style.background = isSelected ? "hsl(var(--primary) / 0.16)" : "hsl(var(--accent))";
                                }}
                                onMouseLeave={(e) => {
                                  if (!isDisabled) e.currentTarget.style.background = isSelected ? "hsl(var(--primary) / 0.1)" : "hsl(var(--card))";
                                }}
                              >
                                <input type="checkbox" checked={isSelected} readOnly disabled={isDisabled} style={{ width: 17, height: 17, margin: 0, accentColor: "hsl(var(--primary))", cursor: isDisabled ? "not-allowed" : "pointer" }} />
                                <div style={{ width: 36, height: 36, borderRadius: 5, background: variant.image ? "hsl(var(--accent))" : "hsl(var(--warning) / 0.1)", border: "1px solid hsl(var(--border))", display: "grid", placeItems: "center" }}>
                                  <VyIcon name={variant.image ? "package" : "alert"} size={15} style={{ color: variant.image ? "hsl(var(--muted-fg))" : "hsl(var(--warning))" }} />
                                </div>
                                <div className="vy-mono" style={{ fontSize: 10.5, fontWeight: 700, color: isSelected ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}>{variant.sku}</div>
                                <div style={{ fontSize: 11.5, fontWeight: 500 }}>{variant.name} · {variant.pack}</div>
                                <div style={{ color: "hsl(var(--muted-fg))", fontSize: 10.5, textAlign: "right" }}>{variant.fbaStock} FBA</div>
                                <div className="vy-mono" style={{ fontWeight: 700, fontSize: 11.5, textAlign: "right" }}>${variant.lastCostUsd?.toFixed(2) || "—"}</div>
                                <div className="vy-mono" style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", textAlign: "right" }}>¥{variant.lastCostRmb?.toFixed(2) || "—"}</div>
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                  <span className={`vy-badge vy-badge--${variant.status === "Ready" ? "success" : "warning"}`} style={{ fontSize: 9 }}>
                                    {isDisabled ? "In order" : variant.status}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div style={{ padding: "12px 0", textAlign: "center", color: "hsl(var(--muted-fg))", fontSize: 12 }}>
                  Need a new SKU? <a href="#" style={{ color: "hsl(var(--primary))", textDecoration: "none", fontWeight: 600 }}>Add it in Products</a>
                </div>
              </div>
            </div>

            {/* Right: Selected lines */}
            <div style={{ flex: "0 0 32%", display: "flex", flexDirection: "column", background: "hsl(var(--accent))" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid hsl(var(--border))", flexShrink: 0, background: "hsl(var(--card))" }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Selected lines</h3>
                <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 3 }}>
                  Review quantities and pricing before adding
                </div>
                {hasIssues && (
                  <div style={{ marginTop: 8, padding: "6px 8px", background: "hsl(var(--warning) / 0.1)", border: "1px solid hsl(var(--warning) / 0.3)", borderRadius: 4, fontSize: 10.5, color: "hsl(var(--warning))" }}>
                    Needs review: missing images, titles, or costs
                  </div>
                )}
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
                {selectedLines.length === 0 ? (
                  <div style={{ 
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: "32px 20px",
                    height: "100%",
                  }}>
                    <div style={{ 
                      width: 56, 
                      height: 56, 
                      borderRadius: "50%", 
                      background: "hsl(var(--accent))",
                      display: "grid",
                      placeItems: "center",
                      marginBottom: 16
                    }}>
                      <VyIcon name="package" size={24} style={{ color: "hsl(var(--muted-fg))" }} />
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 6 }}>
                      No SKUs selected
                    </div>
                    <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", lineHeight: 1.5, marginBottom: 16 }}>
                      Select variants from the catalog list. Only selected SKU rows become order lines.
                    </div>
                    <div style={{ 
                      textAlign: "left", 
                      fontSize: 11, 
                      color: "hsl(var(--muted-fg))",
                      background: "hsl(var(--accent))",
                      padding: "10px 12px",
                      borderRadius: 4,
                      border: "1px solid hsl(var(--border))",
                      width: "100%"
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 6, color: "hsl(var(--foreground))" }}>This action creates:</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <VyIcon name="check" size={12} style={{ color: "hsl(var(--success))" }} />
                        <span>order_line_items only</span>
                      </div>
                      <div style={{ fontWeight: 600, marginTop: 10, marginBottom: 6, color: "hsl(var(--foreground))" }}>Does not create:</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <VyIcon name="x" size={12} style={{ color: "hsl(var(--muted-fg))" }} />
                        <span>Invoices</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <VyIcon name="x" size={12} style={{ color: "hsl(var(--muted-fg))" }} />
                        <span>Shipments</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <VyIcon name="x" size={12} style={{ color: "hsl(var(--muted-fg))" }} />
                        <span>Catalog creation</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedLines.map(line => (
                      <div key={line.sku} style={{ 
                        padding: "10px 12px", 
                        background: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))", 
                        borderRadius: 5 
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                          <div style={{ 
                            width: 30, 
                            height: 30, 
                            borderRadius: 3, 
                            background: line.image ? "hsl(var(--accent))" : "hsl(var(--warning) / 0.1)", 
                            border: "1px solid hsl(var(--border))",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0
                          }}>
                            <VyIcon name={line.image ? "package" : "alert"} size={13} style={{ color: line.image ? "hsl(var(--muted-fg))" : "hsl(var(--warning))" }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="vy-mono" style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 2 }}>{line.sku}</div>
                            <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", lineHeight: 1.3 }}>{line.name}</div>
                            {(!line.image || line.status !== "Ready") && (
                              <div style={{ marginTop: 3, fontSize: 9, color: "hsl(var(--warning))" }}>
                                {!line.image && "Missing image"}
                                {!line.image && line.status !== "Ready" && " · "}
                                {line.status !== "Ready" && line.status}
                              </div>
                            )}
                          </div>
                          <button type="button" className="vy-icon-btn" onClick={() => removeLine(line.sku)} style={{ width: 22, height: 22, marginTop: -2 }}>
                            <VyIcon name="x" size={12} />
                          </button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                          <label className="vy-field" style={{ margin: 0 }}>
                            <span className="vy-field-label" style={{ fontSize: 10, marginBottom: 2 }}>Qty</span>
                            <input
                              type="number"
                              className="vy-input"
                              value={line.qty}
                              onChange={(e) => updateLine(line.sku, "qty", e.target.value)}
                              style={{ fontSize: 11.5, height: 30, padding: "4px 8px" }}
                            />
                          </label>
                          <label className="vy-field" style={{ margin: 0 }}>
                            <span className="vy-field-label" style={{ fontSize: 10, marginBottom: 2 }}>Unit $</span>
                            <input
                              type="number"
                              className="vy-input vy-mono"
                              value={line.unitUsd}
                              onChange={(e) => updateLine(line.sku, "unitUsd", e.target.value)}
                              step="0.01"
                              style={{ fontSize: 11.5, height: 30, padding: "4px 8px" }}
                            />
                          </label>
                        </div>
                        <label className="vy-field" style={{ margin: 0, marginBottom: 6 }}>
                          <span className="vy-field-label" style={{ fontSize: 10, marginBottom: 2 }}>Supplier ¥</span>
                          <input
                            type="number"
                            className="vy-input vy-mono"
                            value={line.unitRmb}
                            onChange={(e) => updateLine(line.sku, "unitRmb", e.target.value)}
                            step="0.01"
                            lang="en-US"
                            style={{ fontSize: 11.5, height: 30, padding: "4px 8px" }}
                          />
                        </label>
                        <div style={{ 
                          paddingTop: 6, 
                          borderTop: "1px solid hsl(var(--border))", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "space-between" 
                        }}>
                          <span style={{ color: "hsl(var(--muted-fg))", fontSize: 10 }}>Line total</span>
                          <span className="vy-mono" style={{ fontWeight: 700, color: "hsl(var(--primary))", fontSize: 13 }}>${(line.qty * line.unitUsd).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ 
            padding: "12px 20px", 
            borderTop: "1px solid hsl(var(--border))", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between",
            background: "hsl(var(--card))",
            flexShrink: 0
          }}>
            <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>
              {selectedLines.length} SKUs · {totalUnits} units · <span className="vy-mono" style={{ fontWeight: 600, color: "hsl(var(--foreground))", fontSize: 13 }}>${totalCost.toFixed(2)}</span> subtotal
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="vy-btn vy-btn--primary"
                disabled={selectedLines.length === 0 || selectedLines.some(l => l.qty <= 0 || l.unitUsd <= 0)}
                onClick={() => {
                  onAdd(selectedLines);
                  onClose();
                }}
              >
                Add selected lines
              </button>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>,
    document.body
  );
}

Object.assign(window, { AddSkusModal });
