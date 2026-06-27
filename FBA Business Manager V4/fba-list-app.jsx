// Vyonix FBA Shipments — portfolio list of Amazon FBA inbounds across ALL
// orders (the SYNCED world). Route: /operations/fba
// Each inbound links back to its parent physical Shipment and its Order.
// Reads ?shipment= / ?order= to scope (cross-linked from the Shipments page).
// Header → Amazon sync strip → KPIs → filter → table → by-FC distribution.

const { useState: useFbaState, useEffect: useFbaEffect } = React;

const fbaTh = { textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" };
const fbaTd = { padding: "12px 12px", color: "hsl(var(--foreground))", fontSize: 12.5, whiteSpace: "nowrap" };
const fbaMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const fbaInput = { height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

function FbaSourceTag({ source }) {
  const amazon = source === "amazon";
  return (
    <span title={amazon ? "Synced from Amazon Seller Central" : "Entered manually"}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, flexShrink: 0, background: amazon ? "hsl(var(--info))" : "transparent", boxShadow: amazon ? "none" : "inset 0 0 0 1.5px hsl(var(--muted-fg) / 0.5)" }} />
      {amazon ? "Amazon" : "Manual"}
    </span>
  );
}

function FbaThSrc({ children, align, source }) {
  return <th style={{ ...fbaTh, textAlign: align || "left" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: align === "right" ? "flex-end" : "flex-start" }}>{children} <FbaSourceTag source={source} /></span></th>;
}

// ----------------------------------------------------------------------
// Amazon-leg event model — mirrors Amazon's "Shipment events" timeline. Derived
// from the inbound's amazonStatus + received units. Starts at the FC handoff;
// the freight (Forwarder) leg lives on the parent shipment.
// ----------------------------------------------------------------------
const FBA_AMZ_EVENTS = [
  { key: "created",   label: "Shipment created",  offset: -30 },
  { key: "intransit", label: "In transit",        offset: -14 },
  { key: "delivered", label: "Delivered to FC",   offset: 0 },
  { key: "checkedin", label: "Checked in",        offset: 1 },
  { key: "received",  label: "Received",          offset: 1 },
  { key: "closed",    label: "Shipment closed",   offset: 18 },
];
const FBA_MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function fbaParseEta(label) {
  if (!label) return null;
  const m = String(label).match(/([A-Za-z]{3})\s*(\d{1,2})/);
  if (!m || FBA_MONTHS[m[1].slice(0, 3)] == null) return null;
  return new Date(2026, FBA_MONTHS[m[1].slice(0, 3)], Number(m[2]), 10, 14);
}
function fbaFmtDate(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + ", " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
// Furthest event reached, from amazonStatus + received.
function fbaDoneIdx(r) {
  if (r.amazonStatus === "Closed") return 5;
  if (r.received > 0) return 4;            // Received (booked some units)
  if (r.amazonStatus === "Receiving") return 3; // Checked in, receiving
  if (r.amazonStatus === "Shipped" || r.amazonStatus === "In transit") return 1;
  return 0;                                 // Working
}
function fbaAmazonEvents(r) {
  const doneIdx = fbaDoneIdx(r);
  const eta = fbaParseEta(r.eta) || new Date(2026, 5, 1, 10, 0);
  return FBA_AMZ_EVENTS.map((e, i) => {
    const done = i <= doneIdx;
    const d = new Date(eta.getTime() + e.offset * 864e5);
    return { ...e, done, cur: i === doneIdx, dateLabel: done ? fbaFmtDate(d) : null };
  });
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
function FbaShipmentsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useFbaState(false);
  const [mobileNavOpen, setMobileNavOpen] = useFbaState(false);
  const [isDark, setIsDark] = useFbaState(false);
  const [query, setQuery] = useFbaState("");
  const [fc, setFc] = useFbaState("All");
  const [status, setStatus] = useFbaState("All");
  const [drawer, setDrawer] = useFbaState(null);
  const [linkTarget, setLinkTarget] = useFbaState(null); // unlinked row being linked
  const [tick, setTick] = useFbaState(0);
  const refresh = () => setTick((n) => n + 1);

  function handleLink(fbaId, link) {
    logSaveFbaLink(fbaId, link);
    setLinkTarget(null);
    setDrawer(null);
    refresh();
  }

  // Cross-link scope from the Shipments page.
  const params = new URLSearchParams(window.location.search);
  const scopeShipment = params.get("shipment");
  const scopeOrder = params.get("order");

  useFbaEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  const allRows = logAllFbaRows();
  const fcs = ["All", ...[...new Set(allRows.map((r) => r.fc))]];
  const statusChips = ["All", "Working", "Shipped", "Receiving", "Closed"];
  const unlinkedCount = allRows.filter((r) => r.unlinked).length;

  const filtered = allRows.filter((r) => {
    if (scopeShipment && r.shipmentId !== scopeShipment) return false;
    if (scopeOrder && r.orderId !== scopeOrder) return false;
    if (status === "Unlinked") { if (!r.unlinked) return false; }
    else if (status !== "All" && r.amazonStatus !== status) return false;
    if (fc !== "All" && r.fc !== fc) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = [r.id, r.shipmentId, r.orderId, r.orderTitle, r.fc, r.supplier].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // KPIs across ALL inbounds (not filtered)
  const totalInbounds = allRows.length;
  const inTransitUnits = allRows.filter((r) => r.amazonStatus !== "Closed" && r.received === 0).reduce((n, r) => n + r.expected, 0);
  const expectedTotal = allRows.reduce((n, r) => n + r.expected, 0);
  const receivedTotal = allRows.reduce((n, r) => n + r.received, 0);
  const shortCount = allRows.filter((r) => r.received > 0 && r.received < r.expected).length;
  const fcCount = new Set(allRows.map((r) => r.fc)).size;

  const kpis = [
    { icon: "truck", label: "Inbounds", value: String(totalInbounds), sub: "FBA shipments", source: "amazon" },
    { icon: "route", label: "In transit", value: inTransitUnits.toLocaleString(), sub: "units to FCs", source: "amazon" },
    { icon: "boxes", label: "Received", value: receivedTotal + " of " + expectedTotal, sub: "units booked", source: "amazon" },
    { icon: "alert", label: "Discrepancies", value: String(shortCount), sub: shortCount === 1 ? "inbound short" : "inbounds short", tone: shortCount ? "danger" : undefined, source: "amazon" },
    { icon: "package", label: "Destination FCs", value: String(fcCount), sub: [...new Set(allRows.map((r) => r.fc))].join(" · ") },
  ];

  // By-FC distribution (filtered) — expected units per FC
  const fcTotals = {};
  LOG_FCS.forEach((f) => { fcTotals[f] = 0; });
  filtered.forEach((r) => { fcTotals[r.fc] = (fcTotals[r.fc] || 0) + r.expected; });
  const fcMax = Math.max(1, ...Object.values(fcTotals));

  const scopeLabel = scopeShipment ? "shipment " + scopeShipment : scopeOrder ? "order " + scopeOrder : null;

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="FBA Shipments" />
      <div className="vy-app-main">
        <VyHeader
          onToggleMobileNav={() => setMobileNavOpen(true)}
          onOpenSearch={() => {}}
          onToggleTheme={() => setIsDark(!isDark)}
          isDark={isDark}
          onToggleActivity={() => {}}
          workspaceName="Operations"
          tabs={OPERATIONS_TABS}
          activeTab="fba"
        />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Page header */}
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Operations</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>FBA Shipments</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0" }}>
                  Amazon inbounds across every order — destination FC, expected vs received, and status synced from Seller Central. Each links back to its physical shipment.
                </p>
              </div>
              <div className="vy-page-head-actions" style={{ marginLeft: "auto" }}>
                <button type="button" className="vy-btn vy-btn--ghost" onClick={() => {}}>
                  <VyIcon name="arrowUpRight" size={14} /><span>Export</span>
                </button>
                <button type="button" className="vy-btn vy-btn--primary" onClick={() => {}}>
                  <VyIcon name="refresh" size={14} /><span>Sync from Amazon</span>
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
                    {k.source ? <FbaSourceTag source={k.source} /> : null}
                  </div>
                  <div className="vy-kpi-value" style={{ fontSize: 18 }}>{k.value}</div>
                  <div className="vy-kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Sync status strip — the Amazon heartbeat */}
            {(function () {
              const amzConn = typeof intgAmazonConnected === "function" ? intgAmazonConnected() : true;
              const amz = typeof intgAmazon === "function" ? intgAmazon() : null;
              const last = amz && amz.lastSync && typeof intgAgo === "function" ? intgAgo(amz.lastSync) : null;
              if (amzConn) {
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", borderRadius: 10, background: "hsl(var(--info) / 0.06)", border: "1px solid hsl(var(--info) / 0.22)" }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--info) / 0.14)", color: "hsl(var(--info))", flexShrink: 0 }}>
                      <VyIcon name="refresh" size={14} />
                    </span>
                    <div style={{ flex: 1, minWidth: 220, fontSize: 12.5 }}>
                      <strong style={{ fontWeight: 600 }}>Synced from Seller Central</strong>
                      <span style={{ color: "hsl(var(--muted-fg))" }}>&nbsp;&nbsp;Shipment status &amp; received units{last ? " · last sync " + last : ""} · expected is your packing allocation</span>
                    </div>
                    <span className="vy-badge vy-badge--info" style={{ flexShrink: 0 }}>FBA Inbound API</span>
                  </div>
                );
              }
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", borderRadius: 10, background: "hsl(var(--warning) / 0.08)", border: "1px solid hsl(var(--warning) / 0.28)" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--warning) / 0.16)", color: "hsl(var(--warning))", flexShrink: 0 }}>
                    <VyIcon name="alert" size={14} />
                  </span>
                  <div style={{ flex: 1, minWidth: 220, fontSize: 12.5 }}>
                    <strong style={{ fontWeight: 600 }}>Amazon not connected</strong>
                    <span style={{ color: "hsl(var(--muted-fg))" }}>&nbsp;&nbsp;Inbound status &amp; received units aren't syncing — reconnect to resume.</span>
                  </div>
                  <a href="Vyonix Settings.html?section=integrations" className="vy-btn vy-btn--outline vy-btn--sm" style={{ flexShrink: 0 }}>
                    <VyIcon name="link" size={12} /><span>Reconnect</span>
                  </a>
                </div>
              );
            })()}

            {/* Unlinked inbounds banner — orphans from Amazon sync */}
            {unlinkedCount > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", borderRadius: 10, background: "hsl(var(--warning) / 0.08)", border: "1px solid hsl(var(--warning) / 0.28)" }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--warning) / 0.16)", color: "hsl(var(--warning))", flexShrink: 0 }}>
                  <VyIcon name="link" size={14} />
                </span>
                <div style={{ flex: 1, minWidth: 220, fontSize: 12.5 }}>
                  <strong style={{ fontWeight: 600 }}>{unlinkedCount} unlinked inbound{unlinkedCount === 1 ? "" : "s"}</strong>
                  <span style={{ color: "hsl(var(--muted-fg))" }}>&nbsp;&nbsp;Created in Seller Central, not tied to one of your shipments. Link them to an order or keep standalone.</span>
                </div>
                <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ flexShrink: 0 }} onClick={() => setStatus("Unlinked")}>
                  <VyIcon name="alert" size={12} /><span>Review</span>
                </button>
              </div>
            ) : null}

            {/* Scope context banner (from cross-link) */}
            {scopeLabel ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", borderRadius: 10, background: "hsl(var(--primary) / 0.07)", border: "1px solid hsl(var(--primary) / 0.22)" }}>
                <span className="vy-badge vy-badge--brand" style={{ flexShrink: 0 }}>Filtered</span>
                <div style={{ flex: 1, minWidth: 200, fontSize: 12.5 }}>
                  Showing inbounds for <strong style={{ fontWeight: 600 }}>{scopeLabel}</strong>
                </div>
                <a href="Vyonix FBA Shipments.html" className="vy-btn vy-btn--outline vy-btn--sm" style={{ flexShrink: 0, textDecoration: "none", fontSize: 12 }}>
                  <VyIcon name="x" size={12} /><span>Clear filter</span>
                </a>
              </div>
            ) : null}

            {/* Filter bar */}
            <div className="vy-card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ position: "relative", flex: "1 1 300px", minWidth: 0 }}>
                  <VyIcon name="search" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-fg))" }} />
                  <input type="text" className="vy-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search FBA ID, shipment, order, FC, supplier" style={{ ...fbaInput, width: "100%", paddingLeft: 34 }} />
                </div>
                <select className="vy-input" style={{ ...fbaInput, width: 130 }} value={fc} onChange={(e) => setFc(e.target.value)}>
                  {fcs.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {statusChips.map((c) => {
                  const active = status === c;
                  return (
                    <button key={c} type="button" className="vy-chip" onClick={() => setStatus(c)}
                      style={active ? { background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary) / 0.3)" } : {}}>
                      {c}
                    </button>
                  );
                })}
                {unlinkedCount > 0 ? (
                  <button type="button" className="vy-chip" onClick={() => setStatus("Unlinked")}
                    style={status === "Unlinked"
                      ? { background: "hsl(var(--warning) / 0.16)", color: "hsl(var(--warning))", borderColor: "hsl(var(--warning) / 0.4)" }
                      : { borderColor: "hsl(var(--warning) / 0.4)", color: "hsl(var(--warning))" }}>
                    Unlinked ({unlinkedCount})
                  </button>
                ) : null}
              </div>
            </div>

            {/* FBA table */}
            <div className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
                <span className="vy-kicker">{filtered.length} {filtered.length === 1 ? "inbound" : "inbounds"}</span>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Variance = received − expected</span>
              </div>
              <div style={{ overflowX: "auto", borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 940 }}>
                  <thead>
                    <tr style={{ background: "hsl(var(--muted-bg) / 0.5)" }}>
                      <FbaThSrc source="amazon">FBA shipment</FbaThSrc>
                      <th style={fbaTh}>Parent shipment</th>
                      <th style={fbaTh}>Order</th>
                      <th style={fbaTh}>Dest FC</th>
                      <th style={{ ...fbaTh, textAlign: "right" }}>SKUs</th>
                      <FbaThSrc align="right" source="manual">Expected</FbaThSrc>
                      <FbaThSrc align="right" source="amazon">Received</FbaThSrc>
                      <th style={{ ...fbaTh, textAlign: "right" }}>Variance</th>
                      <FbaThSrc source="amazon">Status</FbaThSrc>
                      <th style={fbaTh}>Synced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const vTone = r.received <= 0 ? "hsl(var(--muted-fg))" : r.variance < 0 ? "hsl(var(--danger))" : r.variance > 0 ? "hsl(var(--warning))" : "hsl(var(--success))";
                      const vDisplay = r.received <= 0 ? "—" : (r.variance > 0 ? "+" : "") + r.variance;
                      return (
                        <tr key={r.id} className="vy-order-row" onClick={() => setDrawer(r)} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)", cursor: "pointer" }}>
                          <td style={fbaTd}>
                            <a href={"Vyonix FBA Shipment.html?fba=" + encodeURIComponent(r.id)} onClick={(e) => e.stopPropagation()} className="vy-row-title" title="Open FBA inbound page" style={{ ...fbaMono, fontWeight: 700, fontSize: 12, color: "inherit", textDecoration: "none" }}>{r.id}</a>
                            <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{r.mode} · ETA {r.eta}</div>
                          </td>
                          <td style={fbaTd}>
                            {r.unlinked ? (
                              <button type="button" onClick={(e) => { e.stopPropagation(); setLinkTarget(r); }} className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11, borderColor: "hsl(var(--warning) / 0.5)", color: "hsl(var(--warning))" }}>
                                <VyIcon name="link" size={11} /><span>Link</span>
                              </button>
                            ) : r.standalone ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>
                                <VyIcon name="cube" size={12} />Direct to Amazon
                              </span>
                            ) : (
                              <a href={"Vyonix Shipments.html?q=" + encodeURIComponent(r.shipmentId)} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, color: "hsl(var(--primary))", fontWeight: 600, fontSize: 12, ...fbaMono }}>
                                <VyIcon name="ship" size={12} />{r.shipmentId}
                              </a>
                            )}
                          </td>
                          <td style={fbaTd}>
                            {r.orderId ? (
                              <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(r.orderId)} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none", color: "inherit" }}>
                                <div style={{ ...fbaMono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{r.orderId}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{r.orderTitle}</div>
                              </a>
                            ) : (
                              <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>{r.unlinked ? "—" : r.orderTitle}</span>
                            )}
                          </td>
                          <td style={fbaTd}><span className="vy-badge vy-badge--muted">{r.fc}</span></td>
                          <td style={{ ...fbaTd, ...fbaMono, textAlign: "right", color: "hsl(var(--muted-fg))" }}>{r.skuCount}</td>
                          <td style={{ ...fbaTd, ...fbaMono, textAlign: "right" }}>{r.expected}</td>
                          <td style={{ ...fbaTd, ...fbaMono, textAlign: "right", fontWeight: 700 }}>{r.received > 0 ? r.received : "—"}</td>
                          <td style={{ ...fbaTd, ...fbaMono, textAlign: "right", fontWeight: 700, color: vTone }}>{vDisplay}</td>
                          <td style={fbaTd}><span className={"vy-badge vy-badge--" + LOG_FBA_TONE[r.amazonStatus]}>{r.amazonStatus}</span></td>
                          <td style={{ ...fbaTd, fontSize: 11, color: "hsl(var(--muted-fg))" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><VyIcon name="refresh" size={11} style={{ opacity: 0.7 }} />{r.synced}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 ? (
                      <tr><td colSpan={10} style={{ ...fbaTd, textAlign: "center", padding: "36px 12px", color: "hsl(var(--muted-fg))" }}>No inbounds match your filters.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {/* By-FC distribution */}
            <section className="vy-card" style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--info) / 0.12)", color: "hsl(var(--info))" }}>
                  <VyIcon name="package" size={15} />
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>By destination FC <FbaSourceTag source="amazon" /></h3>
                  <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>Expected units inbound to each Amazon FC ({filtered.length} of {allRows.length} inbounds shown)</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {LOG_FCS.map((f) => {
                  const val = fcTotals[f] || 0;
                  const pct = Math.round((val / fcMax) * 100);
                  return (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 56, fontSize: 12, fontWeight: 600, ...fbaMono, flexShrink: 0 }}>{f}</span>
                      <div style={{ flex: 1, height: 10, borderRadius: 999, background: "hsl(var(--muted-bg))", overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: pct + "%", background: "hsl(var(--info))", borderRadius: 999 }} />
                      </div>
                      <span style={{ width: 64, textAlign: "right", fontSize: 12.5, fontWeight: 700, ...fbaMono }}>{val.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="FBA Shipments" />

      {drawer ? <FbaDrawer row={drawer} onClose={() => setDrawer(null)} onLink={() => setLinkTarget(drawer)} /> : null}
      {linkTarget ? <FbaLinkModal row={linkTarget} onClose={() => setLinkTarget(null)} onLink={handleLink} /> : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// FBA INBOUND DRAWER — the AMAZON leg (mirror of the Shipments drawer's
// Forwarder leg). Amazon event timeline + receiving reconciliation, with a
// "← Forwarder leg" back-link to the parent physical shipment.
// ----------------------------------------------------------------------
function FbaDrawerStat({ label, value, tone }) {
  return (
    <div style={{ flex: "1 1 80px", minWidth: 0 }}>
      <div className="vy-kicker" style={{ marginBottom: 3 }}>{label}</div>
      <div style={{ ...fbaMono, fontSize: 16, fontWeight: 700, color: tone ? "hsl(var(--" + tone + "))" : undefined }}>{value}</div>
    </div>
  );
}

function FbaDrawer({ row: r, onClose, onLink }) {
  const [shown, setShown] = useFbaState(false);
  useFbaEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const events = fbaAmazonEvents(r);
  const variance = r.received > 0 ? r.received - r.expected : 0;
  const vTone = r.received <= 0 ? "muted-fg" : variance < 0 ? "danger" : variance > 0 ? "warning" : "success";
  const amzRef = "7" + r.id.replace(/[^A-Z0-9]/gi, "").slice(-6).toUpperCase();

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
                <span style={{ ...fbaMono, fontSize: 16, fontWeight: 700 }}>{r.id}</span>
                <FbaSourceTag source="amazon" />
              </div>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 3 }}>Inbound to {r.fc} · {r.mode}</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))", flexShrink: 0 }}>
              <VyIcon name="x" size={18} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            <span className={"vy-badge vy-badge--" + LOG_FBA_TONE[r.amazonStatus]}>{r.amazonStatus}</span>
            <span className="vy-badge vy-badge--muted">{r.fc}</span>
            <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(r.orderId)} style={{ textDecoration: "none" }}>
              <span className="vy-badge vy-badge--muted" style={{ ...fbaMono }}>{r.orderId}</span>
            </a>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Forwarder-leg back-link (the seam) — or unlinked / standalone state */}
          {r.unlinked ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid hsl(var(--warning) / 0.4)", background: "hsl(var(--warning) / 0.08)" }}>
              <VyIcon name="link" size={15} style={{ color: "hsl(var(--warning))", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Not linked to a shipment</div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Created in Seller Central — attach to an order or keep standalone.</div>
              </div>
              <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" style={{ flexShrink: 0 }} onClick={onLink}>
                <VyIcon name="link" size={12} /><span>Link</span>
              </button>
            </div>
          ) : r.standalone ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--accent) / 0.5)" }}>
              <VyIcon name="cube" size={15} style={{ color: "hsl(var(--muted-fg))", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Direct to Amazon</div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Standalone inbound — no forwarder leg tracked.</div>
              </div>
              <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ flexShrink: 0 }} onClick={onLink}>Link</button>
            </div>
          ) : (
            <a href={"Vyonix Shipments.html?q=" + encodeURIComponent(r.shipmentId)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--accent) / 0.5)", textDecoration: "none", color: "inherit" }}>
              <VyIcon name="ship" size={15} style={{ color: "hsl(var(--muted-fg))", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>← Forwarder leg (freight to the FC)</div>
                <div style={{ ...fbaMono, fontSize: 12.5, fontWeight: 700 }}>{r.shipmentId}</div>
              </div>
              <VyIcon name="arrowRight" size={13} style={{ opacity: 0.5 }} />
            </a>
          )}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Receiving · Amazon leg</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "12px 14px", borderRadius: 10, background: "hsl(var(--background) / 0.5)", border: "1px solid hsl(var(--border))" }}>
              <FbaDrawerStat label="Expected" value={r.expected} />
              <FbaDrawerStat label="Received" value={r.received > 0 ? r.received : "—"} />
              <FbaDrawerStat label="Variance" value={r.received <= 0 ? "—" : (variance > 0 ? "+" : "") + variance} tone={vTone} />
              <FbaDrawerStat label="SKUs" value={r.skuCount} />
            </div>
            <p style={{ fontSize: 11, color: "hsl(var(--muted-fg))", margin: "8px 2px 0" }}>
              {r.received <= 0 ? "Not yet received — units book as Amazon checks them in."
                : variance === 0 ? "No discrepancies — received the expected units."
                : variance < 0 ? Math.abs(variance) + " units short of the expected count."
                : "+" + variance + " units over the expected count."}
            </p>
          </div>

          {/* Amazon event timeline */}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 10 }}>Shipment events · from Seller Central</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {events.map((e, i) => {
                const color = e.done ? (e.cur ? "hsl(var(--info))" : "hsl(var(--success))") : "hsl(var(--border))";
                return (
                  <div key={e.key} style={{ display: "flex", gap: 12, minHeight: 30 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                      <span style={{ width: 12, height: 12, borderRadius: 999, display: "grid", placeItems: "center", background: e.done ? color : "hsl(var(--card))", border: "2px solid " + color, flexShrink: 0, marginTop: 4 }}>
                        {e.done ? <VyIcon name="check" size={7} style={{ color: "#fff" }} /> : null}
                      </span>
                      {i < events.length - 1 ? <span style={{ width: 2, flex: 1, background: e.done && events[i + 1].done ? "hsl(var(--success))" : "hsl(var(--border))", margin: "2px 0" }} /> : null}
                    </div>
                    <div style={{ paddingBottom: i < events.length - 1 ? 10 : 0, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: e.cur ? 700 : 600, color: e.cur ? "hsl(var(--info))" : e.done ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{e.label}</div>
                      <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>
                        {e.done ? (e.key === "checkedin" ? e.dateLabel + " · " + r.fc : e.dateLabel) : <span style={{ fontStyle: "italic" }}>pending</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Identifiers */}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Amazon identifiers</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <FbaDrawerStat label="FBA shipment ID" value={r.id} />
              <FbaDrawerStat label="Amazon ref" value={amzRef} />
              <FbaDrawerStat label="Dest FC" value={r.fc} />
              <FbaDrawerStat label="ETA" value={r.eta} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))" }}>
          <a href={"Vyonix FBA Shipment.html?fba=" + encodeURIComponent(r.id)} className="vy-btn vy-btn--primary" style={{ textDecoration: "none", width: "100%", justifyContent: "center" }}>
            <VyIcon name="boxes" size={14} /><span>View full details &amp; contents</span><VyIcon name="arrowRight" size={14} />
          </a>
          <div style={{ display: "flex", gap: 10 }}>
            {r.shipmentId ? (
              <a href={"Vyonix Shipment.html?shipment=" + encodeURIComponent(r.shipmentId)} className="vy-btn vy-btn--outline" style={{ textDecoration: "none", flex: 1, justifyContent: "center" }}>
                <VyIcon name="ship" size={14} /><span>Forwarder leg</span>
              </a>
            ) : null}
            {r.orderId ? (
              <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(r.orderId)} className="vy-btn vy-btn--ghost" style={{ textDecoration: "none", flex: 1, justifyContent: "center" }}>
                <span>Open order</span><VyIcon name="arrowRight" size={14} />
              </a>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ----------------------------------------------------------------------
// LINK MODAL — attach an unlinked inbound to a shipment/order, or keep standalone
// ----------------------------------------------------------------------
function FbaLinkModal({ row: r, onClose, onLink }) {
  const ships = logAllShipments();
  // Suggest likely parents: same destination region / has remaining capacity.
  const [shipmentId, setShipmentId] = useFbaState(ships[0] ? ships[0].id : "");

  useFbaEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chosen = ships.find((s) => s.id === shipmentId);

  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 10000, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 480, padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Link FBA inbound</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>
              <span style={{ ...fbaMono, fontWeight: 600 }}>{r.id}</span> · {r.fc} · {r.expected} units. Attach it to one of your shipments, or keep it standalone.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Attach to shipment</span>
            <select className="vy-input" style={{ ...fbaInput, width: "100%" }} value={shipmentId} onChange={(e) => setShipmentId(e.target.value)}>
              {ships.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.orderTitle} ({s.packed} pcs)</option>)}
            </select>
          </label>
          {chosen ? (
            <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", padding: "8px 12px", borderRadius: 8, background: "hsl(var(--accent) / 0.5)" }}>
              Links to order <strong style={{ color: "hsl(var(--foreground))" }}>{chosen.orderId}</strong> — {chosen.orderTitle}. This inbound's received units will reconcile against that order.
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={() => onLink(r.id, { standalone: true })}>Keep standalone</button>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="vy-btn vy-btn--primary" disabled={!shipmentId} onClick={() => onLink(r.id, { shipmentId })}>
              <VyIcon name="link" size={14} /><span>Link</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const fbaRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
fbaRoot.render(<FbaShipmentsPage />);
