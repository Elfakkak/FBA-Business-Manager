// Vyonix Shipments — portfolio list of physical freight movements across ALL
// orders (the MANUAL world). Route: /operations/shipments
// Header → KPIs → ordered→packed→shipped→received funnel → filter → table.
// One freight shipment can spawn several FBA inbounds; the FBA count links
// through to the FBA Shipments page filtered to this shipment.

const { useState: useShpState, useEffect: useShpEffect } = React;

const shpTh = { textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" };
const shpTd = { padding: "12px 12px", color: "hsl(var(--foreground))", fontSize: 12.5, whiteSpace: "nowrap" };
const shpMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const shpInput = { height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

// Source-of-truth marker, identical to the order-level Shipping section.
function ShpSourceTag({ source }) {
  const amazon = source === "amazon";
  return (
    <span title={amazon ? "Synced from Amazon Seller Central" : "Entered manually"}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, flexShrink: 0, background: amazon ? "hsl(var(--info))" : "transparent", boxShadow: amazon ? "none" : "inset 0 0 0 1.5px hsl(var(--muted-fg) / 0.5)" }} />
      {amazon ? "Amazon" : "Manual"}
    </span>
  );
}

// ----------------------------------------------------------------------
// FUNNEL — ordered → packed → shipped → received (portfolio reconciliation)
// ----------------------------------------------------------------------
function ShpFunnel({ ordered, packed, shipped, received }) {
  const steps = [
    { label: "Ordered", value: ordered, source: "manual", hint: "Committed in production" },
    { label: "Packed", value: packed, source: "manual", hint: "Into shipments" },
    { label: "Shipped", value: shipped, source: "manual", hint: "Left origin" },
    { label: "Received", value: received, source: "amazon", hint: "Booked at FBA" },
  ];
  const max = Math.max(1, ordered);
  return (
    <section className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
          <VyIcon name="route" size={15} />
        </span>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Pipeline reconciliation</h3>
          <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>Every ordered unit should flow through to received — the custody chain across all orders.</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {steps.map((s, i) => {
          const pct = Math.round((s.value / max) * 100);
          return (
            <div key={s.label} style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span className="vy-kicker">{s.label}</span>
                <ShpSourceTag source={s.source} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, ...shpMono }}>{s.value.toLocaleString()}</div>
              <div style={{ height: 6, borderRadius: 999, background: "hsl(var(--muted-bg))", overflow: "hidden", margin: "8px 0 6px" }}>
                <span style={{ display: "block", height: "100%", width: pct + "%", borderRadius: 999, background: i === 3 ? "hsl(var(--info))" : "hsl(var(--primary))" }} />
              </div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{s.hint}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
function ShipmentsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useShpState(false);
  const [mobileNavOpen, setMobileNavOpen] = useShpState(false);
  const [isDark, setIsDark] = useShpState(false);
  const [query, setQuery] = useShpState(() => new URLSearchParams(window.location.search).get("q") || "");
  const [mode, setMode] = useShpState("All");
  const [forwarder, setForwarder] = useShpState("All");
  const [stage, setStage] = useShpState("All");

  useShpEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  const [shipments, setShipments] = useShpState(() => logAllShipments());
  const [modal, setModal] = useShpState(null);   // null | 'new'
  const [drawer, setDrawer] = useShpState(null); // shipment object being viewed
  const [editing, setEditing] = useShpState(null); // shipment object being edited
  const [toast, setToast] = useShpState(null);

  useShpEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleCreateShipment(draft) {
    logAddDraft(draft);
    setShipments(logAllShipments());
    setModal(null);
    setToast({ id: draft.id, order: draft.orderTitle });
  }

  function handleSaveEdit(id, patch) {
    logSaveEdit(id, patch);
    const next = logAllShipments();
    setShipments(next);
    const updated = next.find((s) => s.id === id) || null;
    if (drawer && drawer.id === id) setDrawer(updated);
    setEditing(null);
    setToast({ id, order: (updated && updated.orderTitle) || "", edited: true });
  }

  const modes = ["All", ...[...new Set(shipments.map((s) => s.mode))]];
  const forwarders = ["All", ...[...new Set(shipments.map((s) => s.forwarder))]];
  const stageChips = ["All", "Draft", "In transit", "Customs", "Delivered", "At FBA"];

  const filtered = shipments.filter((s) => {
    if (mode !== "All" && s.mode !== mode) return false;
    if (forwarder !== "All" && s.forwarder !== forwarder) return false;
    if (stage !== "All" && s.stage !== stage) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = [s.id, s.orderId, s.orderTitle, s.supplier, s.forwarder, s.bol, s.origin, s.destination].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // KPIs across ALL shipments
  const total = shipments.length;
  const onWater = shipments.filter((s) => s.stage === "In transit" || s.stage === "Customs").length;
  const atCustoms = shipments.filter((s) => s.customs === "In clearance" || s.customs === "Pending").length;
  const freightTotal = shipments.reduce((n, s) => n + (Number(s.freightUsd) || 0), 0);

  // Funnel (dedupe ordered by order)
  const ordered = Object.values(LOG_ORDER_SCOPE).reduce((n, v) => n + v, 0);
  const packed = shipments.reduce((n, s) => n + (Number(s.packed) || 0), 0);
  const movingStages = ["Picked up", "In transit", "Customs", "Delivered", "At FBA"];
  const shipped = shipments.filter((s) => movingStages.includes(s.stage)).reduce((n, s) => n + (Number(s.packed) || 0), 0);
  const received = shipments.reduce((n, s) => n + logShipFbaStats(s).received, 0);
  const coveragePct = ordered ? Math.round((packed / ordered) * 100) : 0;
  const expectedAll = shipments.reduce((n, s) => n + logShipFbaStats(s).expected, 0);

  const kpis = [
    { icon: "ship", label: "Shipments", value: String(total), sub: "in motion" },
    { icon: "route", label: "On the water", value: String(onWater), sub: "in transit / customs" },
    { icon: "package", label: "Packed", value: coveragePct + "%", sub: packed.toLocaleString() + " of " + ordered.toLocaleString() + " ordered", tone: coveragePct < 100 ? "warning" : "success" },
    { icon: "boxes", label: "Received", value: received + " of " + expectedAll, sub: "booked at FBA", source: "amazon" },
    { icon: "dollar", label: "Freight", value: "$" + freightTotal.toLocaleString(), sub: "DDP/DAP estimate" },
  ];

  function goOrder(id) { window.location.href = "Vyonix Order Shell.html?order=" + encodeURIComponent(id); }

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Shipments" />
      <div className="vy-app-main">
        <VyHeader
          onToggleMobileNav={() => setMobileNavOpen(true)}
          onOpenSearch={() => {}}
          onToggleTheme={() => setIsDark(!isDark)}
          isDark={isDark}
          onToggleActivity={() => {}}
          workspaceName="Operations"
          tabs={OPERATIONS_TABS}
          activeTab="shipments"
        />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Page header */}
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Operations</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>Shipments</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0" }}>
                  Physical freight movements across every order — mode, forwarder, customs and packing. The Amazon inbounds each shipment spawns live in FBA Shipments.
                </p>
              </div>
              <div className="vy-page-head-actions" style={{ marginLeft: "auto" }}>
                <button type="button" className="vy-btn vy-btn--ghost" onClick={() => {}}>
                  <VyIcon name="arrowUpRight" size={14} /><span>Export</span>
                </button>
                <button type="button" className="vy-btn vy-btn--primary" onClick={() => setModal("new")}>
                  <VyIcon name="plus" size={14} /><span>New shipment</span>
                </button>
              </div>
            </div>

            {/* KPI strip */}
            <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))" }}>
              {kpis.map((k) => (
                <div className={"vy-card vy-kpi" + (k.tone ? " vy-kpi--" + k.tone : "")} key={k.label}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <VyIcon name={k.icon} size={14} style={{ opacity: 0.7 }} />
                    <span className="vy-kicker">{k.label}</span>
                    {k.source ? <ShpSourceTag source={k.source} /> : null}
                  </div>
                  <div className="vy-kpi-value" style={{ fontSize: 18 }}>{k.value}</div>
                  <div className="vy-kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Pipeline reconciliation funnel */}
            <ShpFunnel ordered={ordered} packed={packed} shipped={shipped} received={received} />

            {/* Filter bar */}
            <div className="vy-card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ position: "relative", flex: "1 1 300px", minWidth: 0 }}>
                  <VyIcon name="search" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-fg))" }} />
                  <input type="text" className="vy-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shipment, order, supplier, forwarder, BOL" style={{ ...shpInput, width: "100%", paddingLeft: 34 }} />
                </div>
                <select className="vy-input" style={{ ...shpInput, width: 140 }} value={mode} onChange={(e) => setMode(e.target.value)}>
                  {modes.map((m) => <option key={m}>{m}</option>)}
                </select>
                <select className="vy-input" style={{ ...shpInput, width: 160 }} value={forwarder} onChange={(e) => setForwarder(e.target.value)}>
                  {forwarders.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {stageChips.map((c) => {
                  const active = stage === c;
                  return (
                    <button key={c} type="button" className="vy-chip" onClick={() => setStage(c)}
                      style={active ? { background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary) / 0.3)" } : {}}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Shipments table */}
            <div className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
                <span className="vy-kicker">{filtered.length} {filtered.length === 1 ? "shipment" : "shipments"}</span>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>One freight shipment can feed several FBA inbounds</span>
              </div>
              <div style={{ overflowX: "auto", borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1040 }}>
                  <thead>
                    <tr style={{ background: "hsl(var(--muted-bg) / 0.5)" }}>
                      <th style={shpTh}>Shipment</th>
                      <th style={shpTh}>Order</th>
                      <th style={shpTh}>Route</th>
                      <th style={shpTh}>Forwarder</th>
                      <th style={shpTh}>ETD → ETA</th>
                      <th style={{ ...shpTh, textAlign: "right" }}>Cargo</th>
                      <th style={{ ...shpTh, textAlign: "right" }}>Packed</th>
                      <th style={shpTh}>FBA inbounds</th>
                      <th style={shpTh}>Customs</th>
                      <th style={shpTh}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const fstats = logShipFbaStats(s);
                      return (
                        <tr key={s.id} className="vy-order-row" onClick={() => setDrawer(s)} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)", cursor: "pointer" }}>
                          <td style={shpTd}>
                            <div style={{ ...shpMono, fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                              <a href={"Vyonix Shipment.html?shipment=" + encodeURIComponent(s.id)} className="vy-row-title" onClick={(e) => e.stopPropagation()} title="Open shipment page" style={{ ...shpMono }}>{s.id}</a>
                              {s.isDraft ? <span className="vy-badge vy-badge--brand" style={{ fontSize: 9, padding: "1px 6px" }}>New</span> : null}
                            </div>
                            <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{s.mode} · {s.bol}</div>
                          </td>
                          <td style={shpTd}>
                            <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(s.orderId)} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none", color: "inherit" }}>
                              <div style={{ ...shpMono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{s.orderId}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{s.orderTitle}</div>
                              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{s.supplier}</div>
                            </a>
                          </td>
                          <td style={{ ...shpTd, fontSize: 12, color: "hsl(var(--muted-fg))" }}>{s.origin}<br />→ {s.destination}</td>
                          <td style={shpTd}>
                            <div style={{ fontWeight: 500 }}>{s.forwarder}</div>
                            <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{s.incoterm}</div>
                          </td>
                          <td style={{ ...shpTd, ...shpMono, fontSize: 12 }}>{s.etd}<br /><span style={{ color: "hsl(var(--muted-fg))" }}>{s.eta}</span></td>
                          <td style={{ ...shpTd, ...shpMono, textAlign: "right", fontSize: 12, color: "hsl(var(--muted-fg))" }}>
                            {s.cbm} CBM<br />{s.grossKg} kg · {s.cartons} ctn
                          </td>
                          <td style={{ ...shpTd, ...shpMono, textAlign: "right", fontWeight: 700 }}>{s.packed}</td>
                          <td style={shpTd}>
                            {fstats.inbounds ? (
                              <a href={"Vyonix FBA Shipments.html?shipment=" + encodeURIComponent(s.id)} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, color: "hsl(var(--primary))", fontWeight: 600, fontSize: 12 }}>
                                <VyIcon name="link" size={12} />
                                {fstats.inbounds} inbound{fstats.inbounds === 1 ? "" : "s"}
                                {fstats.short > 0 ? <span className="vy-badge vy-badge--danger" style={{ marginLeft: 2 }}>{fstats.short} short</span> : null}
                              </a>
                            ) : (
                              <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>None yet</span>
                            )}
                          </td>
                          <td style={shpTd}><span className={"vy-badge vy-badge--" + LOG_CUSTOMS_TONE[s.customs]}>{s.customs === "—" ? "—" : s.customs}</span></td>
                          <td style={shpTd}><span className={"vy-badge vy-badge--" + LOG_STAGE_TONE[s.stage]}>{s.stage}</span></td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 ? (
                      <tr><td colSpan={10} style={{ ...shpTd, textAlign: "center", padding: "36px 12px", color: "hsl(var(--muted-fg))" }}>No shipments match your filters.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Shipments" />

      {modal === "new" ? (
        <ShpNewShipmentModal shipments={shipments} onClose={() => setModal(null)} onSubmit={handleCreateShipment} />
      ) : null}

      {drawer ? (
        <ShpDrawer shipment={drawer} onClose={() => setDrawer(null)} onEdit={() => setEditing(drawer)} />
      ) : null}

      {editing ? (
        <ShpEditModal shipment={editing} onClose={() => setEditing(null)} onSave={handleSaveEdit} />
      ) : null}

      {toast ? (
        <div role="status" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 12, zIndex: 200, padding: "12px 16px", borderRadius: 12, maxWidth: 480, background: "hsl(var(--foreground))", color: "hsl(var(--background))", boxShadow: "0 12px 32px -8px hsl(0 0% 0% / 0.35)" }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", background: "hsl(var(--primary))", color: "#fff", flexShrink: 0 }}>
            <VyIcon name="check" size={14} />
          </span>
          <div style={{ fontSize: 13, lineHeight: 1.35 }}>
            <strong style={{ fontWeight: 600 }}>{toast.edited ? "Shipment updated." : "Shipment created."}</strong>
            <span style={{ opacity: 0.8 }}>&nbsp;{toast.id}{toast.order ? " · " + toast.order : ""}</span>
          </div>
          <button type="button" onClick={() => setToast(null)} style={{ marginLeft: 4, background: "transparent", border: "none", color: "inherit", opacity: 0.7, cursor: "pointer", display: "grid", placeItems: "center" }} aria-label="Dismiss">
            <VyIcon name="x" size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// NEW SHIPMENT MODAL — order-aware, suggests the unpacked remainder
// ----------------------------------------------------------------------
function ShpModalField({ label, children, half, hint }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: half ? "1 1 calc(50% - 7px)" : "1 1 100%", minWidth: 0 }}>
      <span className="vy-kicker">{label}</span>
      {children}
      {hint ? <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{hint}</span> : null}
    </label>
  );
}

function ShpNewShipmentModal({ shipments, onClose, onSubmit }) {
  const suggest = (oid) => Math.max(0, (LOG_ORDER_SCOPE[oid] || 0) - logPackedForOrder(oid));
  const firstOrder = LOG_ORDERS.find((o) => suggest(o.id) > 0) || LOG_ORDERS[0];
  const [form, setForm] = useShpState(() => ({
    orderId: firstOrder.id, mode: "Sea LCL", forwarder: "", incoterm: "DDP",
    etd: "", eta: "", units: String(suggest(firstOrder.id)), cbm: "", grossKg: "", cartons: "", freight: "",
  }));

  useShpEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const order = LOG_ORDERS.find((o) => o.id === form.orderId) || firstOrder;
  const scope = LOG_ORDER_SCOPE[order.id] || 0;
  const packedSoFar = logPackedForOrder(order.id);
  const remainder = Math.max(0, scope - packedSoFar);
  const units = Number(form.units) || 0;
  const over = units > remainder;
  const valid = order.id && units > 0 && form.forwarder.trim();
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  function pickOrder(e) {
    const oid = e.target.value;
    setForm((p) => ({ ...p, orderId: oid, units: String(suggest(oid)) }));
  }

  function submit() {
    onSubmit({
      id: "SHP-NEW-" + Date.now().toString().slice(-4),
      orderId: order.id, orderTitle: order.title, supplier: order.supplier,
      mode: form.mode, forwarder: form.forwarder.trim() || "—", incoterm: form.incoterm,
      origin: order.origin, destination: order.destination,
      etd: form.etd || "—", eta: form.eta || "—", bol: "—",
      stage: "Draft", customs: "—",
      cbm: form.cbm ? Number(form.cbm) : 0, grossKg: form.grossKg ? Number(form.grossKg) : 0,
      cartons: form.cartons ? Number(form.cartons) : 0, packed: units,
      freightUsd: form.freight ? Number(form.freight) : 0, fba: [], isDraft: true,
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>New shipment</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0", maxWidth: "46ch" }}>Attach a freight movement to an order. Packing list and FBA inbounds come after.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="x" size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 24px", overflowY: "auto" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <ShpModalField label="Order">
              <select className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.orderId} onChange={pickOrder}>
                {LOG_ORDERS.map((o) => <option key={o.id} value={o.id}>{o.id} · {o.title}</option>)}
              </select>
            </ShpModalField>
          </div>

          {/* Order context + remainder suggestion */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "12px 0 16px", padding: "10px 14px", borderRadius: 10, background: "hsl(var(--primary) / 0.06)", border: "1px solid hsl(var(--primary) / 0.2)" }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.14)", color: "hsl(var(--primary))", flexShrink: 0 }}>
              <VyIcon name="route" size={13} />
            </span>
            <div style={{ flex: 1, minWidth: 180, fontSize: 12, lineHeight: 1.45 }}>
              <strong style={{ fontWeight: 600 }}>{order.supplier}</strong> · {order.origin} → {order.destination}<br />
              <span style={{ color: "hsl(var(--muted-fg))" }}>{packedSoFar.toLocaleString()} of {scope.toLocaleString()} ordered units packed · </span>
              <strong style={{ fontWeight: 700, color: remainder > 0 ? "hsl(var(--primary))" : "hsl(var(--success))" }}>{remainder.toLocaleString()} unpacked</strong>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <ShpModalField label="Mode" half>
              <select className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.mode} onChange={set("mode")}>
                <option>Sea LCL</option><option>Sea FCL</option><option>Air</option><option>Air express</option><option>Rail</option>
              </select>
            </ShpModalField>
            <ShpModalField label="Units to ship" half hint={over ? "Exceeds the " + remainder.toLocaleString() + " unpacked — that's allowed, just flagging it." : "Suggested from unpacked remainder."}>
              <input type="number" className="vy-input" style={{ ...shpInput, width: "100%", borderColor: over ? "hsl(var(--warning))" : undefined }} value={form.units} onChange={set("units")} placeholder="e.g. 700" />
            </ShpModalField>
            <ShpModalField label="Forwarder" half>
              <input className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.forwarder} onChange={set("forwarder")} placeholder="e.g. Flexport" />
            </ShpModalField>
            <ShpModalField label="Incoterm" half>
              <select className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.incoterm} onChange={set("incoterm")}>
                <option>DDP</option><option>DAP</option><option>FOB</option><option>EXW</option><option>CIF</option>
              </select>
            </ShpModalField>
            <ShpModalField label="ETD" half>
              <input className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.etd} onChange={set("etd")} placeholder="e.g. Jul 02" />
            </ShpModalField>
            <ShpModalField label="ETA" half>
              <input className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.eta} onChange={set("eta")} placeholder="e.g. Jul 24" />
            </ShpModalField>
            <ShpModalField label="CBM" half>
              <input type="number" step="0.01" className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.cbm} onChange={set("cbm")} placeholder="optional" />
            </ShpModalField>
            <ShpModalField label="Cartons" half>
              <input type="number" className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.cartons} onChange={set("cartons")} placeholder="optional" />
            </ShpModalField>
            <ShpModalField label="Freight estimate (USD)" half>
              <input type="number" className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.freight} onChange={set("freight")} placeholder="e.g. 1200" />
            </ShpModalField>
            <ShpModalField label="Gross weight (kg)" half>
              <input type="number" className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.grossKg} onChange={set("grossKg")} placeholder="optional" />
            </ShpModalField>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={submit}>
            <VyIcon name="plus" size={14} /><span>Create shipment</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// SHIPMENT DETAIL DRAWER — right slide-in, self-contained read view
// ----------------------------------------------------------------------
function ShpDrawerField({ label, value, mono }) {
  return (
    <div style={{ flex: "1 1 120px", minWidth: 0 }}>
      <div className="vy-kicker" style={{ marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: mono ? "var(--font-mono, 'JetBrains Mono', monospace)" : undefined }}>{value}</div>
    </div>
  );
}

function ShpDrawer({ shipment: s, onClose, onEdit }) {
  const [shown, setShown] = useShpState(false);
  useShpEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(r); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const fstats = logShipFbaStats(s);
  const [trkTick, setTrkTick] = useShpState(0);
  const [pasteOpen, setPasteOpen] = useShpState(false);
  const [syncing, setSyncing] = useShpState(false);
  const refreshTrk = () => setTrkTick((n) => n + 1);

  const info = trkInfo(s);
  const events = trkEvents(s);
  const tstatus = trkStatus(s);
  const effStage = trkStage(s);
  const currentIdx = LOG_STAGES.indexOf(effStage);
  const hasTracking = !!info.trackingNo;
  const atEnd = currentIdx >= LOG_STAGES.length - 1;
  const t17Connected = (typeof intg17TrackConnected === "function") ? intg17TrackConnected() : false;

  function doSync() {
    if (!hasTracking) return;
    setSyncing(true);
    setTimeout(() => { trkSyncNow(s); setSyncing(false); refreshTrk(); }, 1000);
  }
  function doAdvance() { if (trkAdvance(s)) refreshTrk(); }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.4)", opacity: shown ? 1 : 0, transition: "opacity 200ms ease" }} />
      <aside style={{
        position: "absolute", top: 0, right: 0, height: "100%", width: "min(460px, 92vw)",
        background: "hsl(var(--card))", borderLeft: "1px solid hsl(var(--border))",
        boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
        transform: shown ? "translateX(0)" : "translateX(100%)", transition: "transform 240ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...shpMono, fontSize: 16, fontWeight: 700 }}>{s.id}</span>
                {s.isDraft ? <span className="vy-badge vy-badge--brand" style={{ fontSize: 9, padding: "1px 6px" }}>New</span> : null}
              </div>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 3 }}>{s.mode} · {s.origin} → {s.destination}</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))", flexShrink: 0 }}>
              <VyIcon name="x" size={18} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            <span className={"vy-badge vy-badge--" + LOG_STAGE_TONE[effStage]}>{effStage}</span>
            <span className={"vy-badge vy-badge--" + LOG_CUSTOMS_TONE[s.customs]}>Customs: {s.customs === "—" ? "n/a" : s.customs}</span>
            <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(s.orderId)} style={{ textDecoration: "none" }}>
              <span className="vy-badge vy-badge--muted" style={{ ...shpMono }}>{s.orderId}</span>
            </a>
            {onEdit ? (
              <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ marginLeft: "auto" }} onClick={onEdit}>
                <VyIcon name="pencil" size={12} /><span>Edit</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Order */}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 6 }}>Order</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{s.orderTitle}</div>
            <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{s.supplier}</div>
          </div>

          {/* Tracking — 17TRACK-shaped */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="vy-kicker">Tracking · Forwarder leg</span>
              {hasTracking ? <span className={"vy-badge vy-badge--" + tstatus.tone}>{tstatus.label}</span> : null}
              <span style={{ marginLeft: "auto", fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>
                {hasTracking ? (syncing ? "syncing…" : (t17Connected ? "17TRACK · synced " + trkAgo(info.lastSync || Date.now()) : "17TRACK not connected")) : ""}
              </span>
            </div>

            {hasTracking ? (
              <>
                {/* Tracking IDs */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "10px 12px", borderRadius: 10, background: "hsl(var(--background) / 0.5)", border: "1px solid hsl(var(--border))", marginBottom: 14 }}>
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <div className="vy-kicker" style={{ marginBottom: 2 }}>Tracking no.</div>
                    <div style={{ ...shpMono, fontSize: 13, fontWeight: 700 }}>{info.trackingNo}</div>
                  </div>
                  <div style={{ flex: "1 1 130px", minWidth: 0 }}>
                    <div className="vy-kicker" style={{ marginBottom: 2 }}>Booking ref</div>
                    <div style={{ ...shpMono, fontSize: 12.5 }}>{info.bookingRef || "—"}</div>
                  </div>
                  <div style={{ flex: "1 1 100%", minWidth: 0 }}>
                    <div className="vy-kicker" style={{ marginBottom: 2 }}>Carrier</div>
                    <div style={{ fontSize: 12.5 }}>{info.carrier}{info.scac ? " · " + info.scac : ""}</div>
                  </div>
                </div>

                {/* Checkpoint timeline */}
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {events.map((e, i) => {
                    const color = e.done ? (e.cur ? "hsl(var(--primary))" : "hsl(var(--success))") : "hsl(var(--border))";
                    return (
                      <div key={e.stage} style={{ display: "flex", gap: 12, minHeight: 30 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                          <span style={{ width: 12, height: 12, borderRadius: 999, background: e.done ? color : "hsl(var(--card))", border: "2px solid " + color, flexShrink: 0, marginTop: 4 }} />
                          {i < events.length - 1 ? <span style={{ width: 2, flex: 1, background: e.done && events[i + 1].done ? "hsl(var(--success))" : "hsl(var(--border))", margin: "2px 0" }} /> : null}
                        </div>
                        <div style={{ paddingBottom: i < events.length - 1 ? 10 : 0, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: e.cur ? 700 : 600, color: e.cur ? "hsl(var(--primary))" : e.done ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{e.label}</div>
                          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>
                            {e.done ? <>{e.timeLabel} · {e.location}</> : <span style={{ fontStyle: "italic" }}>{e.location} · pending</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                  {t17Connected ? (
                    <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" disabled={syncing} onClick={doSync}>
                      <VyIcon name={syncing ? "activity" : "refresh"} size={13} /><span>{syncing ? "Syncing…" : "Sync 17TRACK"}</span>
                    </button>
                  ) : (
                    <a href="Vyonix Settings.html?section=integrations" className="vy-btn vy-btn--outline vy-btn--sm">
                      <VyIcon name="link" size={13} /><span>Connect 17TRACK</span>
                    </a>
                  )}
                  <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={() => setPasteOpen(true)}>
                    <VyIcon name="clipboard" size={13} /><span>Paste update</span>
                  </button>
                  {!atEnd ? (
                    <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={doAdvance} title="Demo: advance to next milestone">
                      <VyIcon name="arrowRight" size={13} /><span>Advance</span>
                    </button>
                  ) : null}
                </div>
                <p style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", margin: "8px 0 0", lineHeight: 1.4 }}>
                  {t17Connected
                    ? "Live via 17TRACK — checkpoints auto-feed from the carrier. Paste update or Advance to override manually."
                    : "17TRACK not connected — tracking is manual. Connect it in Settings to auto-feed these checkpoints."}
                </p>
                {/* Handoff to the Amazon leg */}
                {fstats.inbounds ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "8px 10px", borderRadius: 8, background: "hsl(var(--accent) / 0.5)" }}>
                    <VyIcon name="arrowRight" size={12} style={{ color: "hsl(var(--muted-fg))", flexShrink: 0 }} />
                    <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", lineHeight: 1.4 }}>
                      <strong style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>Amazon takes over at the FC.</strong> Checked-in · received · closed events are synced from Seller Central — see <strong style={{ fontWeight: 600 }}>FBA inbounds</strong> below.
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              /* No tracking yet — add it */
              <div style={{ padding: "16px", borderRadius: 10, border: "1px dashed hsl(var(--border))", textAlign: "center" }}>
                <div style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", marginBottom: 10 }}>No tracking number yet. Add one once the forwarder books this shipment.</div>
                <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" onClick={() => setPasteOpen(true)}>
                  <VyIcon name="clipboard" size={13} /><span>Paste forwarder update</span>
                </button>
              </div>
            )}
          </div>

          {/* Logistics */}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Logistics</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <ShpDrawerField label="ETD" value={s.etd} mono />
              <ShpDrawerField label="ETA" value={s.eta} mono />
              <ShpDrawerField label="BOL / AWB" value={s.bol} mono />
              <ShpDrawerField label="Forwarder" value={s.forwarder + " · " + s.incoterm} />
              <ShpDrawerField label="Freight" value={s.freightUsd ? "$" + Number(s.freightUsd).toLocaleString() : "—"} mono />
            </div>
          </div>

          {/* Cargo */}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Cargo</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <ShpDrawerField label="Packed" value={(Number(s.packed) || 0).toLocaleString()} mono />
              <ShpDrawerField label="CBM" value={s.cbm || "—"} mono />
              <ShpDrawerField label="Gross" value={s.grossKg ? s.grossKg + " kg" : "—"} mono />
              <ShpDrawerField label="Cartons" value={s.cartons || "—"} mono />
            </div>
          </div>

          {/* FBA inbounds */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="vy-kicker">FBA inbounds · Amazon leg ({fstats.inbounds})</span>
              {fstats.inbounds ? (
                <a href={"Vyonix FBA Shipments.html?shipment=" + encodeURIComponent(s.id)} style={{ fontSize: 11.5, fontWeight: 600, color: "hsl(var(--primary))", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  View all <VyIcon name="arrowRight" size={11} />
                </a>
              ) : null}
            </div>
            {fstats.inbounds ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {s.fba.map((f) => {
                  const variance = f.received > 0 ? f.received - f.expected : 0;
                  const vTone = f.received <= 0 ? "hsl(var(--muted-fg))" : variance < 0 ? "hsl(var(--danger))" : variance > 0 ? "hsl(var(--warning))" : "hsl(var(--success))";
                  return (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
                      <div style={{ minWidth: 0, flex: "1 1 130px" }}>
                        <div style={{ ...shpMono, fontWeight: 700, fontSize: 12 }}>{f.id}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                          <span className="vy-badge vy-badge--muted">{f.fc}</span>
                          <span className={"vy-badge vy-badge--" + LOG_FBA_TONE[f.amazonStatus]}>{f.amazonStatus}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 14, ...shpMono, fontSize: 12 }}>
                        <div><div className="vy-kicker">Exp</div><div style={{ fontWeight: 700 }}>{f.expected}</div></div>
                        <div><div className="vy-kicker">Rec</div><div style={{ fontWeight: 700 }}>{f.received > 0 ? f.received : "—"}</div></div>
                        <div><div className="vy-kicker">Var</div><div style={{ fontWeight: 700, color: vTone }}>{f.received <= 0 ? "—" : (variance > 0 ? "+" : "") + variance}</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", padding: "12px 14px", border: "1px dashed hsl(var(--border))", borderRadius: 10, textAlign: "center" }}>
                No FBA inbounds linked yet.
              </div>
            )}
          </div>
        </div>

        {/* Footer — deep link to the full page + the order seam */}
        <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))" }}>
          <a href={"Vyonix Shipment.html?shipment=" + encodeURIComponent(s.id)} className="vy-btn vy-btn--primary" style={{ textDecoration: "none", flex: 1, justifyContent: "center" }}>
            <span>Open full shipment</span><VyIcon name="arrowRight" size={14} />
          </a>
          <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(s.orderId)} className="vy-btn vy-btn--outline" style={{ textDecoration: "none" }} title="Open the parent order">
            <VyIcon name="cube" size={14} /><span>Order</span>
          </a>
          <button type="button" className="vy-btn vy-btn--outline" onClick={onClose}>Close</button>
        </div>
      </aside>

      {pasteOpen ? (
        <ShpPasteModal shipment={s} onClose={() => setPasteOpen(false)} onApplied={() => { setPasteOpen(false); refreshTrk(); }} />
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// PASTE FORWARDER UPDATE — parse a booking/tracking email into the shipment
// ----------------------------------------------------------------------
function ShpPasteModal({ shipment: s, onClose, onApplied }) {
  const [text, setText] = useShpState("");
  const parsed = text.trim() ? trkParseForwarderMessage(text) : null;
  const found = parsed && (parsed.trackingNo || parsed.bookingRef || parsed.eta);

  useShpEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function apply() { trkApplyParsed(s, parsed); onApplied(); }

  const row = (label, val) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderTop: "1px solid hsl(var(--border))" }}>
      <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{label}</span>
      <span style={{ ...shpMono, fontSize: 12, fontWeight: val ? 700 : 400, color: val ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{val || "not found"}</span>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 10000, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 540, padding: 0, boxShadow: "var(--shadow-lg)", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Paste forwarder update</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0", maxWidth: "44ch" }}>Paste the booking / tracking message (CN or EN). Vyonix pulls out the numbers and ETA.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "18px 24px", overflowY: "auto" }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder="Paste the forwarder's email here…"
            style={{ width: "100%", height: 120, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", resize: "vertical", fontFamily: "inherit" }} />
          {parsed ? (
            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "hsl(var(--accent) / 0.5)" }}>
              <div className="vy-kicker" style={{ marginBottom: 4 }}>Extracted</div>
              {row("Tracking no.", parsed.trackingNo)}
              {row("Booking ref", parsed.bookingRef)}
              {row("Cargo / container", parsed.cargoNo)}
              {row("Reservation", parsed.reservationNo)}
              {row("ETA", parsed.eta)}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!found} style={found ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={apply}>
            <VyIcon name="check" size={14} /><span>Apply to shipment</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// EDIT SHIPMENT MODAL — structured logistics + cargo fields (not stage/tracking)
// ----------------------------------------------------------------------
function ShpEditModal({ shipment: s, onClose, onSave }) {
  const [form, setForm] = useShpState(() => ({
    mode: s.mode || "Sea LCL",
    forwarder: s.forwarder === "—" ? "" : (s.forwarder || ""),
    incoterm: s.incoterm || "DDP",
    etd: s.etd === "—" ? "" : (s.etd || ""),
    eta: s.eta === "—" ? "" : (s.eta || ""),
    bol: s.bol === "—" ? "" : (s.bol || ""),
    cbm: s.cbm || "",
    grossKg: s.grossKg || "",
    cartons: s.cartons || "",
    packed: s.packed || "",
    freightUsd: s.freightUsd || "",
  }));
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  useShpEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save() {
    onSave(s.id, {
      mode: form.mode,
      forwarder: form.forwarder.trim() || "—",
      incoterm: form.incoterm,
      etd: form.etd.trim() || "—",
      eta: form.eta.trim() || "—",
      bol: form.bol.trim() || "—",
      cbm: form.cbm === "" ? 0 : Number(form.cbm),
      grossKg: form.grossKg === "" ? 0 : Number(form.grossKg),
      cartons: form.cartons === "" ? 0 : Number(form.cartons),
      packed: form.packed === "" ? 0 : Number(form.packed),
      freightUsd: form.freightUsd === "" ? 0 : Number(form.freightUsd),
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 10000, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Edit shipment</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>
              <span style={{ ...shpMono, fontWeight: 600 }}>{s.id}</span> · {s.orderTitle} — stage &amp; tracking live in the tracking timeline.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="x" size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 24px", overflowY: "auto" }}>
          <div className="vy-kicker" style={{ marginBottom: 10 }}>Logistics</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
            <ShpModalField label="Mode" half>
              <select className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.mode} onChange={set("mode")}>
                <option>Sea LCL</option><option>Sea FCL</option><option>Air</option><option>Air express</option><option>Rail</option>
              </select>
            </ShpModalField>
            <ShpModalField label="Incoterm" half>
              <select className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.incoterm} onChange={set("incoterm")}>
                <option>DDP</option><option>DAP</option><option>FOB</option><option>EXW</option><option>CIF</option>
              </select>
            </ShpModalField>
            <ShpModalField label="Forwarder" half>
              <input className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.forwarder} onChange={set("forwarder")} placeholder="e.g. Flexport" />
            </ShpModalField>
            <ShpModalField label="BOL / AWB" half>
              <input className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.bol} onChange={set("bol")} placeholder="e.g. FLX-NGB-240608" />
            </ShpModalField>
            <ShpModalField label="ETD" half>
              <input className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.etd} onChange={set("etd")} placeholder="e.g. Jun 08" />
            </ShpModalField>
            <ShpModalField label="ETA" half>
              <input className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.eta} onChange={set("eta")} placeholder="e.g. Jul 02" />
            </ShpModalField>
          </div>

          <div className="vy-kicker" style={{ marginBottom: 10 }}>Cargo</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <ShpModalField label="Packed units" half>
              <input type="number" className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.packed} onChange={set("packed")} placeholder="units" />
            </ShpModalField>
            <ShpModalField label="Freight (USD)" half>
              <input type="number" className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.freightUsd} onChange={set("freightUsd")} placeholder="e.g. 1200" />
            </ShpModalField>
            <ShpModalField label="CBM" half>
              <input type="number" step="0.01" className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.cbm} onChange={set("cbm")} placeholder="optional" />
            </ShpModalField>
            <ShpModalField label="Gross weight (kg)" half>
              <input type="number" className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.grossKg} onChange={set("grossKg")} placeholder="optional" />
            </ShpModalField>
            <ShpModalField label="Cartons" half>
              <input type="number" className="vy-input" style={{ ...shpInput, width: "100%" }} value={form.cartons} onChange={set("cartons")} placeholder="optional" />
            </ShpModalField>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" onClick={save}>
            <VyIcon name="check" size={14} /><span>Save changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const shpRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
shpRoot.render(<ShipmentsPage />);
