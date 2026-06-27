// Add Non-Product Cost Modal
// For tooling, samples, packaging, setup fees, etc.

function AddNonProductCostModal({ open, onClose, onAdd }) {
  const [description, setDescription] = vyUseState("");
  const [amount, setAmount] = vyUseState("");
  const [currency, setCurrency] = vyUseState("CNY");
  const [vendor, setVendor] = vyUseState("");
  const [invoiceCoverage, setInvoiceCoverage] = vyUseState("uncovered");
  const [costTreatment, setCostTreatment] = vyUseState("inventoriable");
  const [allocation, setAllocation] = vyUseState("by_qty");
  const [detailsExpanded, setDetailsExpanded] = vyUseState(false);
  
  // Optional details fields
  const [costType, setCostType] = vyUseState("");
  const [qtyAffected, setQtyAffected] = vyUseState("");
  const [section, setSection] = vyUseState("");
  const [notes, setNotes] = vyUseState("");

  // Bulk supply / packaging leftover (the MOQ problem). When on, we capture how
  // many were ORDERED vs USED on this order so only the used portion hits COGS
  // and the leftover is carried as on-hand supply stock.
  const [isSupply, setIsSupply] = vyUseState(false);
  const [supplyMode, setSupplyMode] = vyUseState("inventory"); // 'inventory' | 'new'
  const [pkgItemId, setPkgItemId] = vyUseState("");
  const [pkgUseQty, setPkgUseQty] = vyUseState("");
  const [qtyOrdered, setQtyOrdered] = vyUseState("");
  const [qtyUsed, setQtyUsed] = vyUseState("");
  // packaging inventory available to this order's product (assigned or "Any")
  const pkgFamily = (window.VY_ORDER_SCOPE && window.VY_ORDER_SCOPE.familyId) || null;
  const pkgChoices = (typeof pkgForFamily === "function") ? pkgForFamily(pkgFamily) : (typeof pkgItems === "function" ? pkgItems() : []);
  const pkgChosen = pkgChoices.find((p) => p.id === pkgItemId) || null;
  const supUnitCost = (Number(qtyOrdered) > 0 && Number(amount) > 0) ? (Number(amount) / Number(qtyOrdered)) : 0;
  const supLeftoverQty = Math.max(0, (Number(qtyOrdered) || 0) - (Number(qtyUsed) || 0));
  const supLeftoverValue = Math.round(supLeftoverQty * supUnitCost * 100) / 100;
  const supUsedValue = Math.round((Number(qtyUsed) || 0) * supUnitCost * 100) / 100;

  function handleSubmit() {
    if (isSupply && supplyMode === "inventory") {
      // drawing from inventory: description auto-fills from the chosen item
      if (!pkgChosen || !Number(pkgUseQty)) { alert("Pick a packaging item and quantity to use"); return; }
      if (!vendor) { /* vendor optional when drawing from stock */ }
    } else if (!description || !amount || !vendor) {
      alert("Please fill in Description, Amount, and Vendor");
      return;
    }

    const cost = {
      description: (isSupply && supplyMode === "inventory" && pkgChosen) ? pkgChosen.name : description,
      amount: (isSupply && supplyMode === "inventory" && pkgChosen) ? Math.round((Number(pkgUseQty) || 0) * (pkgChosen.unitCost || 0) * 100) / 100 : parseFloat(amount),
      currency: (isSupply && supplyMode === "inventory") ? "USD" : currency,
      vendor: vendor || (isSupply && supplyMode === "inventory" ? "From packaging stock" : vendor),
      invoiceCoverage,
      costTreatment,
      allocation,
      details: detailsExpanded ? { costType, qtyAffected, section, notes } : null,
      supply: isSupply && supplyMode === "new" && Number(qtyOrdered) > 0 ? {
        item: description,
        unitCost: supUnitCost,
        qtyOrdered: Number(qtyOrdered) || 0,
        qtyUsed: Number(qtyUsed) || 0,
        leftoverQty: supLeftoverQty,
        leftoverValue: supLeftoverValue,
        usedValue: supUsedValue,
      } : null,
      // draw down existing packaging inventory instead of a fresh buy
      supplyDraw: isSupply && supplyMode === "inventory" && pkgChosen && Number(pkgUseQty) > 0 ? {
        itemId: pkgChosen.id,
        item: pkgChosen.name,
        qty: Number(pkgUseQty) || 0,
        unitCost: pkgChosen.unitCost,
        usedValue: Math.round((Number(pkgUseQty) || 0) * (pkgChosen.unitCost || 0) * 100) / 100,
      } : null,
    };

    onAdd(cost);
    onClose();
  }

  if (!open) return null;

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
            maxWidth: 580, 
            maxHeight: "90vh",
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
          <div style={{ padding: "20px 24px", borderBottom: "1px solid hsl(var(--border))" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Add non-product cost</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "hsl(var(--muted-fg))" }}>
                  Tooling, samples, packaging, setup — anything that isn't a product line.
                </p>
              </div>
              <button type="button" className="vy-icon-btn" style={{ marginLeft: 12 }}>
                <VyIcon name="more" size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {/* Description */}
            <label className="vy-field" style={{ marginBottom: 16 }}>
              <span className="vy-field-label">Description</span>
              <input
                type="text"
                className="vy-input"
                placeholder='e.g., "Tooling for 18" mold revision"'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ fontSize: 14 }}
              />
            </label>

            {/* Amount + Currency */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 16 }}>
              <label className="vy-field">
                <span className="vy-field-label">Amount</span>
                <input
                  type="number"
                  className="vy-input vy-mono"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.01"
                  style={{ fontSize: 14 }}
                />
              </label>
              <label className="vy-field">
                <span className="vy-field-label">Currency</span>
                <select
                  className="vy-input"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  style={{ fontSize: 14, width: 100 }}
                >
                  <option value="CNY">CNY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>

            {/* Vendor / payee */}
            <label className="vy-field" style={{ marginBottom: 16 }}>
              <span className="vy-field-label">Vendor / payee</span>
              <select
                className="vy-input"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                style={{ fontSize: 14 }}
              >
                <option value="">Select vendor...</option>
                <option value="Mutual Trade Union">Mutual Trade Union</option>
                <option value="Sheng Te Long">Sheng Te Long</option>
                <option value="Ningbo Auto Trim">Ningbo Auto Trim</option>
                <option value="Guangzhou Auto Parts">Guangzhou Auto Parts</option>
                <option value="Other">Other...</option>
              </select>
            </label>

            {/* Invoice coverage */}
            <label className="vy-field" style={{ marginBottom: 20 }}>
              <span className="vy-field-label">Invoice coverage</span>
              <select
                className="vy-input"
                value={invoiceCoverage}
                onChange={(e) => setInvoiceCoverage(e.target.value)}
                style={{ fontSize: 14 }}
              >
                <option value="uncovered">Uncovered for now</option>
                <option value="pi-001">Covered by PI-001</option>
                <option value="pi-002">Covered by PI-002</option>
                <option value="will-invoice">Will invoice later</option>
              </select>
            </label>

            {/* Cost treatment */}
            <div style={{ marginBottom: 20 }}>
              <div className="vy-field-label" style={{ marginBottom: 10 }}>Cost treatment</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div
                  onClick={() => setCostTreatment("inventoriable")}
                  style={{
                    padding: "12px 14px",
                    border: costTreatment === "inventoriable" ? "2px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    background: costTreatment === "inventoriable" ? "hsl(var(--primary) / 0.05)" : "hsl(var(--card))",
                    cursor: "pointer",
                    transition: "all 120ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: costTreatment === "inventoriable" ? "5px solid hsl(var(--primary))" : "2px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Inventoriable</span>
                  </div>
                </div>
                <div
                  onClick={() => setCostTreatment("period_expense")}
                  style={{
                    padding: "12px 14px",
                    border: costTreatment === "period_expense" ? "2px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    background: costTreatment === "period_expense" ? "hsl(var(--primary) / 0.05)" : "hsl(var(--card))",
                    cursor: "pointer",
                    transition: "all 120ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: costTreatment === "period_expense" ? "5px solid hsl(var(--primary))" : "2px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Period expense</span>
                  </div>
                </div>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "hsl(var(--muted-fg))" }}>
                Inventoriable rolls into landed cost. Period expense stays out of COGS.
              </p>
            </div>

            {/* Allocation */}
            <label className="vy-field" style={{ marginBottom: 20 }}>
              <span className="vy-field-label">Allocation</span>
              <select
                className="vy-input"
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                style={{ fontSize: 14 }}
              >
                <option value="by_qty">By qty</option>
                <option value="by_value">By value</option>
                <option value="split_evenly">Split evenly</option>
                <option value="manual">Manual</option>
              </select>
            </label>

            {/* Bulk supply / packaging leftover */}
            <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 16, marginBottom: 4 }}>
              <div
                onClick={() => setIsSupply(!isSupply)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "4px 0" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <VyIcon name="boxes" size={16} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Bulk supply — track leftover</div>
                    <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>For packaging/inserts bought at MOQ — only the used portion hits this order.</div>
                  </div>
                </div>
                <span style={{ width: 40, height: 23, borderRadius: 999, flexShrink: 0, background: isSupply ? "hsl(var(--primary))" : "hsl(var(--muted))", position: "relative", transition: "background 140ms" }}>
                  <span style={{ position: "absolute", top: 2, left: isSupply ? 19 : 2, width: 19, height: 19, borderRadius: 999, background: "#fff", transition: "left 140ms", boxShadow: "0 1px 2px hsla(0,0%,0%,0.3)" }} />
                </span>
              </div>

              {isSupply && (
                <div style={{ marginTop: 12 }}>
                  {/* Mode: draw from inventory vs new bulk buy */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {[["inventory", "Use from inventory"], ["new", "New bulk buy"]].map(([k, lbl]) => {
                      const on = supplyMode === k;
                      return (
                        <button key={k} type="button" onClick={() => setSupplyMode(k)}
                          style={{ flex: 1, padding: "7px 10px", fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? "hsl(var(--primary))" : "hsl(var(--border))"), background: on ? "hsl(var(--primary))" : "hsl(var(--card))", color: on ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" }}>
                          {lbl}
                        </button>
                      );
                    })}
                  </div>

                  {supplyMode === "inventory" ? (
                    <div>
                      <label className="vy-field" style={{ marginBottom: 10 }}>
                        <span className="vy-field-label">Packaging item</span>
                        <select className="vy-input" value={pkgItemId} onChange={(e) => setPkgItemId(e.target.value)} style={{ fontSize: 13 }}>
                          <option value="">Select from inventory…</option>
                          {pkgChoices.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.onHand.toLocaleString()} on hand</option>)}
                        </select>
                      </label>
                      <label className="vy-field">
                        <span className="vy-field-label">Quantity to use this order</span>
                        <input type="number" className="vy-input vy-mono" placeholder="e.g., 1600" value={pkgUseQty} onChange={(e) => setPkgUseQty(e.target.value)} style={{ fontSize: 13 }} />
                      </label>
                      {pkgChosen && Number(pkgUseQty) > 0 ? (
                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "hsl(var(--muted) / 0.4)", fontSize: 12 }}>
                          <span>Cost to this order <strong className="vy-mono">${(Number(pkgUseQty) * (pkgChosen.unitCost || 0)).toFixed(2)}</strong></span>
                          <span style={{ color: "hsl(var(--muted-fg))" }}>·</span>
                          <span style={{ color: Number(pkgUseQty) > pkgChosen.onHand ? "hsl(0 72% 51%)" : "hsl(var(--primary))" }}>
                            {Number(pkgUseQty) > pkgChosen.onHand ? "Exceeds stock (" + pkgChosen.onHand.toLocaleString() + ")" : "Leaves " + (pkgChosen.onHand - Number(pkgUseQty)).toLocaleString() + " on hand"}
                          </span>
                        </div>
                      ) : (
                        <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 8 }}>Draws from your Packaging inventory — only the used portion is costed to this order, stock decrements automatically.</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <label className="vy-field">
                          <span className="vy-field-label">Qty ordered (MOQ)</span>
                          <input type="number" className="vy-input vy-mono" placeholder="e.g., 2000" value={qtyOrdered} onChange={(e) => setQtyOrdered(e.target.value)} style={{ fontSize: 13 }} />
                        </label>
                        <label className="vy-field">
                          <span className="vy-field-label">Qty used this order</span>
                          <input type="number" className="vy-input vy-mono" placeholder="e.g., 1000" value={qtyUsed} onChange={(e) => setQtyUsed(e.target.value)} style={{ fontSize: 13 }} />
                        </label>
                      </div>
                      {Number(qtyOrdered) > 0 && Number(amount) > 0 ? (
                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "hsl(var(--muted) / 0.4)", fontSize: 12 }}>
                          <span>Unit cost <strong className="vy-mono">{currency === "CNY" ? "¥" : "$"}{supUnitCost.toFixed(3)}</strong></span>
                          <span style={{ color: "hsl(var(--muted-fg))" }}>·</span>
                          <span>Lands on this order <strong className="vy-mono">{currency === "CNY" ? "¥" : "$"}{supUsedValue.toLocaleString()}</strong></span>
                          <span style={{ color: "hsl(var(--muted-fg))" }}>·</span>
                          <span style={{ color: "hsl(var(--primary))" }}>Leftover <strong className="vy-mono">{supLeftoverQty.toLocaleString()}</strong> = <strong className="vy-mono">{currency === "CNY" ? "¥" : "$"}{supLeftoverValue.toLocaleString()}</strong> to stock</span>
                        </div>
                      ) : null}
                      <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 8 }}>New bulk buy — the leftover is added to Packaging inventory for future orders.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Add details (expandable) */}
            <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 16 }}>
              <div
                onClick={() => setDetailsExpanded(!detailsExpanded)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  padding: "8px 0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <VyIcon name={detailsExpanded ? "chevronDown" : "chevronRight"} size={16} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Add details</span>
                </div>
                <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>
                  type · qty · section · notes
                </span>
              </div>

              {detailsExpanded && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                  <label className="vy-field">
                    <span className="vy-field-label">Cost type</span>
                    <input
                      type="text"
                      className="vy-input"
                      placeholder="e.g., Tooling, Setup, Packaging"
                      value={costType}
                      onChange={(e) => setCostType(e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </label>
                  <label className="vy-field">
                    <span className="vy-field-label">Quantity affected</span>
                    <input
                      type="number"
                      className="vy-input"
                      placeholder="e.g., 1000"
                      value={qtyAffected}
                      onChange={(e) => setQtyAffected(e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </label>
                  <label className="vy-field">
                    <span className="vy-field-label">Section</span>
                    <input
                      type="text"
                      className="vy-input"
                      placeholder="e.g., Beaded seat covers"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </label>
                  <label className="vy-field">
                    <span className="vy-field-label">Notes</span>
                    <textarea
                      className="vy-input"
                      placeholder="Additional notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      style={{ fontSize: 13, resize: "vertical" }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: "16px 24px",
            borderTop: "1px solid hsl(var(--border))",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: "hsl(var(--card))",
          }}>
            <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="vy-btn vy-btn--primary"
              onClick={handleSubmit}
              disabled={!description || !amount || !vendor}
            >
              Add cost
            </button>
          </div>
        </div>
      </div>
    </React.Fragment>,
    document.body
  );
}

Object.assign(window, { AddNonProductCostModal });
