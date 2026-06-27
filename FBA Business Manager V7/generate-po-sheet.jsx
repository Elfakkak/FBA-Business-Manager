// Generate PO Sheet
// Single-sheet PO builder — pick products and charges, generate PDF

function GeneratePOSheet({ open, onClose, onGenerate }) {
  const [selectedProducts, setSelectedProducts] = vyUseState(new Set(["SEMI-BSC-1P-BLK", "SEMI-BSC-2P-BLK", "CAR-BSC-1P-BLK", "CAR-BSC-2P-BLK"]));
  const [selectedCharges, setSelectedCharges] = vyUseState(new Set(["tooling", "setup"]));

  const products = [
    { sku: "SEMI-BSC-1P-BLK", variant: "Semi · 1-pack · Black", qty: 400, unitPrice: 8.34, lineTotal: 3336.00 },
    { sku: "SEMI-BSC-2P-BLK", variant: "Semi · 2-pack · Black", qty: 200, unitPrice: 8.01, lineTotal: 1602.00 },
    { sku: "CAR-BSC-1P-BLK", variant: "Car · 1-pack · Black", qty: 500, unitPrice: 8.34, lineTotal: 4170.00 },
    { sku: "CAR-BSC-2P-BLK", variant: "Car · 2-pack · Black", qty: 500, unitPrice: 8.01, lineTotal: 4005.00 },
  ];

  const charges = [
    { id: "tooling", description: "Tooling for 18\" mold revision", amount: 2400.00 },
    { id: "setup", description: "Setup and sampling", amount: 350.00 },
  ];

  const productSubtotal = products
    .filter(p => selectedProducts.has(p.sku))
    .reduce((sum, p) => sum + p.lineTotal, 0);

  const chargeSubtotal = charges
    .filter(c => selectedCharges.has(c.id))
    .reduce((sum, c) => sum + c.amount, 0);

  const total = productSubtotal + chargeSubtotal;

  function toggleProduct(sku) {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sku)) {
        newSet.delete(sku);
      } else {
        newSet.add(sku);
      }
      return newSet;
    });
  }

  function toggleCharge(id) {
    setSelectedCharges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  function handleGenerate() {
    const selectedProductsList = products.filter(p => selectedProducts.has(p.sku));
    const selectedChargesList = charges.filter(c => selectedCharges.has(c.id));
    
    onGenerate({
      products: selectedProductsList,
      charges: selectedChargesList,
      total,
    });
    
    alert(`PO generated!\n\nProducts: ${selectedProductsList.length}\nCharges: ${selectedChargesList.length}\nTotal: $${total.toFixed(2)}\n\nPDF saved to Production files.\nOrder set to "PO locked."`);
    onClose();
  }

  if (!open) return null;

  return (
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
            maxWidth: 900, 
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
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Generate PO</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "hsl(var(--muted-fg))" }}>
                  Pick what to include. We'll build the PDF with your company info.
                </p>
              </div>
              <button type="button" className="vy-icon-btn" onClick={onClose}>
                <VyIcon name="x" size={16} />
              </button>
            </div>
            
            {/* Addressed to (read-only) */}
            <div style={{ 
              marginTop: 16, 
              padding: "10px 12px", 
              background: "hsl(var(--accent))", 
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 13,
            }}>
              <span style={{ fontWeight: 600 }}>Addressed to:</span>{" "}
              <span>Sheng Te Long · factory</span>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {/* Products */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Products</h3>
              
              {/* Column headers */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "32px 130px 1fr 80px 90px 100px", 
                gap: 12, 
                padding: "8px 12px",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                color: "hsl(var(--muted-fg))",
                borderBottom: "1px solid hsl(var(--border))",
              }}>
                <div></div>
                <div>SKU</div>
                <div>Variant</div>
                <div style={{ textAlign: "right" }}>QTY</div>
                <div style={{ textAlign: "right" }}>UNIT PRICE</div>
                <div style={{ textAlign: "right" }}>LINE TOTAL</div>
              </div>

              <div style={{ border: "1px solid hsl(var(--border))", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
                {products.map((product, idx) => {
                  const isChecked = selectedProducts.has(product.sku);
                  return (
                    <div
                      key={product.sku}
                      onClick={() => toggleProduct(product.sku)}
                      style={{
                        padding: "10px 12px",
                        borderBottom: idx < products.length - 1 ? "1px solid hsl(var(--border))" : "none",
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: "32px 130px 1fr 80px 90px 100px",
                        gap: 12,
                        alignItems: "center",
                        background: isChecked ? "hsl(var(--background))" : "hsl(var(--muted) / 0.03)",
                        transition: "background 120ms ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isChecked ? "hsl(var(--accent))" : "hsl(var(--muted) / 0.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isChecked ? "hsl(var(--background))" : "hsl(var(--muted) / 0.03)";
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                      <span className="vy-mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{product.sku}</span>
                      <span style={{ fontSize: 12.5 }}>{product.variant}</span>
                      <span style={{ fontSize: 12.5, textAlign: "right" }}>{product.qty}</span>
                      <span className="vy-mono" style={{ fontSize: 12.5, textAlign: "right" }}>${product.unitPrice.toFixed(2)}</span>
                      <span className="vy-mono" style={{ fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>${product.lineTotal.toFixed(2)}</span>
                    </div>
                  );
                })}
                <div style={{ padding: "10px 12px", background: "hsl(var(--muted) / 0.05)", borderTop: "1px solid hsl(var(--border))" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Subtotal:</span>
                    <span className="vy-mono" style={{ fontSize: 14, fontWeight: 700, width: 100, textAlign: "right" }}>
                      ${productSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Non-product costs */}
            <div>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Non-product costs</h3>
              <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 6, overflow: "hidden" }}>
                {charges.map((charge, idx) => {
                  const isChecked = selectedCharges.has(charge.id);
                  return (
                    <div
                      key={charge.id}
                      onClick={() => toggleCharge(charge.id)}
                      style={{
                        padding: "10px 12px",
                        borderBottom: idx < charges.length - 1 ? "1px solid hsl(var(--border))" : "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: isChecked ? "hsl(var(--background))" : "hsl(var(--muted) / 0.03)",
                        transition: "background 120ms ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isChecked ? "hsl(var(--accent))" : "hsl(var(--muted) / 0.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isChecked ? "hsl(var(--background))" : "hsl(var(--muted) / 0.03)";
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                      <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12.5 }}>{charge.description}</span>
                        <span className="vy-mono" style={{ fontSize: 12.5, fontWeight: 600 }}>${charge.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ padding: "10px 12px", background: "hsl(var(--muted) / 0.05)", borderTop: "1px solid hsl(var(--border))" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Subtotal:</span>
                    <span className="vy-mono" style={{ fontSize: 14, fontWeight: 700 }}>
                      ${chargeSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: "16px 24px",
            borderTop: "1px solid hsl(var(--border))",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "hsl(var(--card))",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              Total: <span className="vy-mono" style={{ color: "hsl(var(--primary))" }}>${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="vy-btn vy-btn--primary"
                onClick={handleGenerate}
                disabled={selectedProducts.size === 0}
              >
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { GeneratePOSheet });
