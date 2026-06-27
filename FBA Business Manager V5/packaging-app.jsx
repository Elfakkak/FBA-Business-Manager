// packaging-app.jsx — standalone Packaging inventory page (Vyonix Packaging.html).
// Add packaging items from the office, receive stock, assign to a product, and
// see on-hand qty + value + movement history. Reads packaging-data globals.

const { useState: usePkgState, useEffect: usePkgEffect, useMemo: usePkgMemo } = React;

function pkgFmt(n) { return "$" + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const pkgMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const pkgInput = { width: "100%", height: 38, padding: "0 12px", fontSize: 13.5, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", boxSizing: "border-box" };

function PackagingPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = usePkgState(false);
  const [mobileNavOpen, setMobileNavOpen] = usePkgState(false);
  const [isDark, setIsDark] = usePkgState(false);
  const [tick, setTick] = usePkgState(0);
  const [modal, setModal] = usePkgState(null);       // null | 'add' | {receive:id} | {moves:id}
  const [toast, setToast] = usePkgState(null);
  usePkgEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);
  usePkgEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t); }, [toast]);

  const items = usePkgMemo(() => (typeof pkgItems === "function" ? pkgItems() : []), [tick]);
  const totals = usePkgMemo(() => (typeof pkgTotals === "function" ? pkgTotals() : { items: 0, onHandValue: 0, lowCount: 0, units: 0 }), [tick]);
  const refresh = () => setTick((n) => n + 1);

  const kpis = [
    { icon: "boxes", label: "Packaging items", value: String(totals.items), sub: totals.units.toLocaleString() + " units on hand" },
    { icon: "money", label: "Inventory value", value: pkgFmt(totals.onHandValue), sub: "at last unit cost", tone: "info" },
    { icon: "alert", label: "Low / reorder", value: String(totals.lowCount), sub: "at or below reorder point", tone: totals.lowCount ? "warning" : "success" },
  ];

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Packaging" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => {}} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} workspaceName="Catalog" tabs={[{ key: "pkg", label: "Packaging" }]} activeTab="pkg" />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Head */}
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Catalog</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>Packaging inventory</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0", maxWidth: "62ch" }}>Mailers, cartons, inserts and labels — tracked on their own because they're bought in bigger runs and reused across orders. Assign each to a product, and orders draw stock from here.</p>
              </div>
              <div className="vy-page-head-actions" style={{ marginLeft: "auto" }}>
                <button type="button" className="vy-btn vy-btn--primary" onClick={() => setModal("add")}><VyIcon name="plus" size={14} /><span>Add packaging</span></button>
              </div>
            </div>

            {/* KPIs */}
            <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              {kpis.map((k) => (
                <div className={"vy-card vy-kpi" + (k.tone ? " vy-kpi--" + k.tone : "")} key={k.label}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><VyIcon name={k.icon} size={14} style={{ opacity: 0.7 }} /><span className="vy-kicker">{k.label}</span></div>
                  <div className="vy-kpi-value" style={{ fontSize: 19 }}>{k.value}</div>
                  <div className="vy-kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Table */}
            <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                      {["Packaging", "For product", "On hand", "Unit cost", "Value", "Status", ""].map((h, i) => (
                        <th key={i} style={{ padding: "11px 14px", textAlign: i >= 2 && i <= 4 ? "right" : "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: "30px", textAlign: "center", color: "hsl(var(--muted-fg))", fontSize: 13 }}>No packaging yet. Click <strong>Add packaging</strong> to create your first item.</td></tr>
                    ) : items.map((it) => (
                      <tr key={it.id} style={{ borderTop: "1px solid hsl(var(--border) / 0.6)" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--info) / 0.12)", color: "hsl(var(--info))" }}><VyIcon name="boxes" size={14} /></span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{it.name}</div>
                              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{it.kind}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12.5 }}>
                          {it.familyId ? <span className="vy-badge vy-badge--brand">{it.productName}</span> : <span style={{ color: "hsl(var(--muted-fg))" }}>Any product</span>}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", ...pkgMono, fontSize: 13.5, fontWeight: 700, color: it.low ? "hsl(38 92% 45%)" : undefined }}>{it.onHand.toLocaleString()}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", ...pkgMono, fontSize: 12.5, color: "hsl(var(--muted-fg))" }}>{pkgFmt(it.unitCost)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", ...pkgMono, fontSize: 13, fontWeight: 600 }}>{pkgFmt(it.value)}</td>
                        <td style={{ padding: "12px 14px" }}>
                          {it.low ? <span className="vy-badge vy-badge--warning">Reorder</span> : <span className="vy-badge vy-badge--success">In stock</span>}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11 }} onClick={() => setModal({ receive: it.id })}><VyIcon name="plus" size={11} /><span>Receive</span></button>
                          <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ fontSize: 11, marginLeft: 4 }} onClick={() => setModal({ moves: it.id })}>History</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>

      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Packaging" />

      {modal === "add" ? <PkgAddModal onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); setToast("Packaging added"); }} /> : null}
      {modal && modal.receive ? <PkgReceiveModal item={pkgItem(modal.receive)} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); setToast("Stock received"); }} /> : null}
      {modal && modal.moves ? <PkgMovesModal item={pkgItem(modal.moves)} onClose={() => setModal(null)} /> : null}

      {toast ? <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "hsl(var(--foreground))", color: "hsl(var(--background))", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999 }}>{toast}</div> : null}
    </div>
  );
}

// ---- shared modal shell ----
function PkgModalShell({ title, sub, onClose, children, footer, maxW = 460 }) {
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: maxW, maxHeight: "88vh", overflowY: "auto", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 22px 12px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>{sub ? <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "3px 0 0", maxWidth: "42ch" }}>{sub}</p> : null}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 22px 16px", borderTop: "1px solid hsl(var(--border))" }}>{footer}</div>
      </div>
    </div>,
    document.body
  );
}

function PkgField({ label, children }) {
  return <label style={{ display: "block" }}><div className="vy-kicker" style={{ marginBottom: 6 }}>{label}</div>{children}</label>;
}

function PkgAddModal({ onClose, onSaved }) {
  const fams = (typeof catLoadFamilies === "function") ? catLoadFamilies() : [];
  const [name, setName] = usePkgState("");
  const [kind, setKind] = usePkgState("Mailer");
  const [familyId, setFamilyId] = usePkgState("");
  const [unitCost, setUnitCost] = usePkgState("");
  const [openingQty, setOpeningQty] = usePkgState("");
  const [reorder, setReorder] = usePkgState("");
  const [source, setSource] = usePkgState("");
  const valid = name.trim();
  function save() {
    pkgAddItem({ name, kind, familyId: familyId || null, unitCost, reorderPoint: reorder, openingQty, source });
    onSaved();
  }
  return (
    <PkgModalShell title="Add packaging" sub="Create a packaging item and (optionally) its opening stock. Add more stock anytime with Receive." onClose={onClose}
      footer={<><button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button><button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={save}><VyIcon name="check" size={14} /><span>Add</span></button></>}>
      <PkgField label="Name"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Poly mailer 10×13" style={pkgInput} /></PkgField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PkgField label="Type"><select value={kind} onChange={(e) => setKind(e.target.value)} style={pkgInput}>{PKG_KINDS.map((k) => <option key={k}>{k}</option>)}</select></PkgField>
        <PkgField label="For product"><select value={familyId} onChange={(e) => setFamilyId(e.target.value)} style={pkgInput}><option value="">Any product</option>{fams.map((f) => <option key={f.id} value={f.id}>{f.parent || f.id}</option>)}</select></PkgField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PkgField label="Unit cost (USD)"><input type="number" min="0" step="0.001" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0.00" style={{ ...pkgInput, ...pkgMono }} /></PkgField>
        <PkgField label="Reorder point"><input type="number" min="0" value={reorder} onChange={(e) => setReorder(e.target.value)} placeholder="e.g. 800" style={{ ...pkgInput, ...pkgMono }} /></PkgField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PkgField label="Opening stock (qty)"><input type="number" min="0" value={openingQty} onChange={(e) => setOpeningQty(e.target.value)} placeholder="e.g. 3000" style={{ ...pkgInput, ...pkgMono }} /></PkgField>
        <PkgField label="Source"><input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Office order / supplier" style={pkgInput} /></PkgField>
      </div>
    </PkgModalShell>
  );
}

function PkgReceiveModal({ item, onClose, onSaved }) {
  const [qty, setQty] = usePkgState("");
  const [unitCost, setUnitCost] = usePkgState(item ? String(item.unitCost) : "");
  const [source, setSource] = usePkgState("");
  if (!item) return null;
  const valid = Number(qty) > 0;
  function save() { pkgReceive(item.id, qty, unitCost, source || "Received"); onSaved(); }
  return (
    <PkgModalShell title={"Receive stock · " + item.name} sub="Add stock from an office order or a separate packaging purchase." onClose={onClose}
      footer={<><button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button><button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={save}><VyIcon name="check" size={14} /><span>Receive</span></button></>}>
      <div style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))" }}>On hand now: <strong style={{ color: "hsl(var(--foreground))", ...pkgMono }}>{item.onHand.toLocaleString()}</strong></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PkgField label="Qty received"><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 2000" style={{ ...pkgInput, ...pkgMono }} /></PkgField>
        <PkgField label="Unit cost (USD)"><input type="number" min="0" step="0.001" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} style={{ ...pkgInput, ...pkgMono }} /></PkgField>
      </div>
      <PkgField label="Source"><input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Separate order · Yiwu Pack Co" style={pkgInput} /></PkgField>
    </PkgModalShell>
  );
}

function PkgMovesModal({ item, onClose }) {
  if (!item) return null;
  const moves = (typeof pkgMoves === "function") ? pkgMoves(item.id) : [];
  return (
    <PkgModalShell title={"Movements · " + item.name} sub="Every receive (in) and consume (out) for this item." onClose={onClose} maxW={500}
      footer={<button type="button" className="vy-btn vy-btn--primary" onClick={onClose}>Done</button>}>
      {moves.length === 0 ? <div style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))" }}>No movements yet.</div> : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {moves.map((m, i) => {
            const inbound = m.type === "receive";
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: i > 0 ? "1px solid hsl(var(--border) / 0.6)" : "none" }}>
                <span style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", background: inbound ? "hsl(var(--success, 142 71% 45%) / 0.14)" : "hsl(38 92% 50% / 0.14)", color: inbound ? "hsl(var(--success, 142 71% 45%))" : "hsl(38 92% 45%)" }}><VyIcon name={inbound ? "plus" : "arrowUpRight"} size={13} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{inbound ? "Received" : "Used"}{m.orderId ? <span style={{ fontWeight: 400, color: "hsl(var(--muted-fg))" }}> · {m.orderId}</span> : null}</div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{m.source || m.note || (inbound ? "Received" : "Order use")} · {m.date}</div>
                </div>
                <div style={{ ...pkgMono, fontSize: 13.5, fontWeight: 700, color: inbound ? "hsl(var(--success, 142 71% 45%))" : "hsl(38 92% 45%)" }}>{inbound ? "+" : "−"}{m.qty.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      )}
    </PkgModalShell>
  );
}

ReactDOM.createRoot(document.getElementById("vy-root")).render(<PackagingPage />);
