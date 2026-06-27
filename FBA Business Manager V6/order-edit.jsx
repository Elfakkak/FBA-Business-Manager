// order-edit.jsx — "Edit order" right-side drawer. Edits the order's SOURCE
// FACTS (name, supplier, agent, units, SKUs, total, dates, payment terms,
// inspection) — the inputs that order-scope.jsx derives the whole order from.
// Save persists via the order stores + payterms + inspection flag, then reloads
// so ORDER + VY_ORDER_SCOPE re-derive and every section/KPI updates.
// Exposes VyEditOrderDrawer. Load AFTER orders-data, vy-order, payterms-data;
// BEFORE vy-app.

const { useState: useOeState } = React;

const oeInput = { width: "100%", height: 38, padding: "0 12px", fontSize: 13.5, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", boxSizing: "border-box" };
const oeMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };

// Order dates are stored as human labels ("May 5", "Jun 24") but <input type="date">
// needs ISO YYYY-MM-DD. Parse the label (assuming the prototype's current year)
// so the fields seed correctly; pass through values already in ISO form.
function oeToISO(label) {
  if (!label || label === "\u2014") return "";
  const s = String(label).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const yr = new Date().getFullYear();
  const d = new Date(/\d{4}/.test(s) ? s : s + " " + yr);
  if (isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd;
}
// Inverse: ISO YYYY-MM-DD → the app's "MMM D" display label (noon-anchored to
// dodge timezone roll-back). Empty in → empty out.
function oeToLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function OeField({ label, hint, children }) {
  return (
    <label style={{ display: "block" }}>
      <div className="vy-kicker" style={{ marginBottom: 6 }}>{label}</div>
      {children}
      {hint ? <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 4 }}>{hint}</div> : null}
    </label>
  );
}

function VyEditOrderDrawer({ open, onClose }) {
  const O = window.VY_CURRENT_ORDER || {};
  const id = O.id;

  // Seed from the current derived order.
  const [name, setName] = useOeState(O.title || "");
  const [supplier, setSupplier] = useOeState(O.factory && O.factory !== "—" ? O.factory : "");
  const [agent, setAgent] = useOeState(O.agent && O.agent !== "Direct" ? O.agent : "");
  const [placed, setPlaced] = useOeState(oeToISO(O.placedOn));
  const [eta, setEta] = useOeState(oeToISO(O.fbaEta));

  // Dropdown options — suppliers from the catalog + every order; agents from
  // the orders' routes. Always include the current value so it's never lost.
  const supplierOpts = useOeState(() => {
    const set = new Set();
    try { (typeof catLoadFamilies === "function" ? catLoadFamilies() : []).forEach((f) => f.supplier && f.supplier !== "—" && set.add(f.supplier)); } catch (e) {}
    try { (typeof ordAllOrders === "function" ? ordAllOrders() : []).forEach((o) => o.supplier && set.add(o.supplier)); } catch (e) {}
    if (supplier) set.add(supplier);
    return Array.from(set).sort();
  })[0];
  const agentOpts = useOeState(() => {
    const set = new Set();
    try {
      (typeof ordAllOrders === "function" ? ordAllOrders() : []).forEach((o) => {
        const r = (o.route || "").replace(/^via\s+/i, "").trim();
        if (r && !/direct/i.test(r)) set.add(r);
      });
    } catch (e) {}
    if (agent) set.add(agent);
    return Array.from(set).sort();
  })[0];

  // Payment terms (reuse payterms-data model).
  const termCfg = (typeof payTermFor === "function") ? payTermFor(id) : { type: "TT", depositPct: 30 };
  const [termType, setTermType] = useOeState(termCfg.type || "TT");
  const [depositPct, setDepositPct] = useOeState(termCfg.depositPct != null ? termCfg.depositPct : 30);
  const termTypes = (typeof PAYTERM_TYPES !== "undefined") ? PAYTERM_TYPES : [];

  // Inspection required.
  const [inspReq, setInspReq] = useOeState((typeof ordInspectionRequired === "function") ? ordInspectionRequired(id) : true);

  function save() {
    if (typeof ordRenameOrder === "function" && name.trim() && name.trim() !== O.title) ordRenameOrder(id, name.trim());
    if (typeof ordSaveEdits === "function") {
      ordSaveEdits(id, {
        supplier: supplier.trim() || undefined,
        agent: agent.trim() ? agent.trim() : "Direct",
        placedOn: placed.trim() ? oeToLabel(placed.trim()) : undefined,
        fbaEta: eta.trim() ? oeToLabel(eta.trim()) : undefined,
      });
    }
    if (typeof payTermSave === "function") payTermSave(id, { ...termCfg, type: termType, depositPct: Number(depositPct) || 0 });
    if (typeof ordSetInspectionRequired === "function") ordSetInspectionRequired(id, inspReq);
    location.reload();
  }

  if (!open) return null;

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.4)" }} />
      <div role="dialog" aria-label="Edit order" style={{
        position: "absolute", top: 0, right: 0, height: "100%", width: "min(440px, 94vw)",
        background: "hsl(var(--card))", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
        borderLeft: "1px solid hsl(var(--border))",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "18px 22px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Edit order</h2>
              <span className="vy-mono" style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{id}</span>
            </div>
            <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "4px 0 0", maxWidth: "40ch" }}>The order's identity &amp; terms. Units and SKUs live in Production; the order total comes from its invoices.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <OeField label="Order name">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={oeInput} placeholder="e.g. Q3 restock — beaded covers" />
          </OeField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <OeField label="Supplier / factory">
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)} style={oeInput}>
                <option value="">Select supplier…</option>
                {supplierOpts.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </OeField>
            <OeField label="Agent" hint="Direct = no agent">
              <select value={agent} onChange={(e) => setAgent(e.target.value)} style={oeInput}>
                <option value="">Direct supplier</option>
                {agentOpts.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </OeField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <OeField label="Placed date">
              <input type="date" value={placed} onChange={(e) => setPlaced(e.target.value)} style={oeInput} />
            </OeField>
            <OeField label="FBA ETA">
              <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} style={oeInput} />
            </OeField>
          </div>

          {/* Payment terms */}
          {termTypes.length ? (
            <div>
              <div className="vy-kicker" style={{ marginBottom: 6 }}>Payment terms</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {termTypes.map((t) => {
                  const on = termType === t.key;
                  return (
                    <button key={t.key} type="button" onClick={() => setTermType(t.key)} title={t.name}
                      style={{ padding: "6px 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? "hsl(var(--primary))" : "hsl(var(--border))"), background: on ? "hsl(var(--primary))" : "hsl(var(--background))", color: on ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {termType === "TT" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>Deposit</span>
                  <input type="number" min="0" max="100" value={depositPct} onChange={(e) => setDepositPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} style={{ ...oeInput, ...oeMono, width: 80, height: 34 }} />
                  <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>% / {100 - (Number(depositPct) || 0)}% balance</span>
                </div>
              ) : null}
              {(() => {
                const t = (typeof PAYTERM_BY_KEY !== "undefined") ? PAYTERM_BY_KEY[termType] : null;
                if (!t) return null;
                return (
                  <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 10, padding: "10px 12px", borderRadius: 9, background: "hsl(var(--info) / 0.07)", border: "1px solid hsl(var(--info) / 0.22)" }}>
                    <VyIcon name="info" size={13} style={{ color: "hsl(var(--info))", flexShrink: 0, marginTop: 1 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{t.label} · {t.name}</div>
                      <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0", lineHeight: 1.45 }}>{t.blurb}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null}

          {/* Inspection toggle */}
          <button type="button" onClick={() => setInspReq((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.5)", cursor: "pointer", textAlign: "left" }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: "block" }}>Inspection required</span>
              <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>Off for trusted suppliers — hides the Inspection tab.</span>
            </span>
            <span style={{ width: 40, height: 23, borderRadius: 999, flexShrink: 0, background: inspReq ? "hsl(var(--primary))" : "hsl(var(--muted))", position: "relative", transition: "background 140ms" }}>
              <span style={{ position: "absolute", top: 2, left: inspReq ? 19 : 2, width: 19, height: 19, borderRadius: 999, background: "#fff", transition: "left 140ms", boxShadow: "0 1px 2px hsl(0 0% 0% / 0.3)" }} />
            </span>
          </button>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" onClick={save}><VyIcon name="check" size={14} /><span>Save changes</span></button>
        </div>
      </div>
    </div>,
    document.body
  );
}

Object.assign(window, { VyEditOrderDrawer });
