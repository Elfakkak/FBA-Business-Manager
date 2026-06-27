// fba-app.jsx — full detail PAGE for one Amazon FBA inbound (the Amazon leg).
// Route: Vyonix FBA Shipment.html?fba=<id>. The FBA list-row title links here.
// This is the deep view that replaces the old quick drawer: header, KPI strip,
// per-SKU CONTENTS table (the centerpiece — receiving reconciliation at the SKU
// level), the Amazon shipment-events timeline, identifiers, the "← Forwarder
// leg" seam back to the physical shipment, and the linked order.
// Reads from logAllFbaRows() / logFbaLines() in logistics-data.jsx.
// Load AFTER logistics-data.jsx, integrations-data.jsx.

const { useState: useFbState, useEffect: useFbEffect } = React;

const fbMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };

// ----- Amazon-leg event model (mirrors the list drawer's timeline) ----------
const FB_AMZ_EVENTS = [
  { key: "created",   label: "Shipment created",  offset: -30 },
  { key: "intransit", label: "In transit",        offset: -14 },
  { key: "delivered", label: "Delivered to FC",   offset: 0 },
  { key: "checkedin", label: "Checked in",        offset: 1 },
  { key: "received",  label: "Received",          offset: 1 },
  { key: "closed",    label: "Shipment closed",   offset: 18 },
];
const FB_MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function fbParseEta(label) {
  if (!label) return null;
  const m = String(label).match(/([A-Za-z]{3})\s*(\d{1,2})/);
  if (!m || FB_MONTHS[m[1].slice(0, 3)] == null) return null;
  return new Date(2026, FB_MONTHS[m[1].slice(0, 3)], Number(m[2]), 10, 14);
}
function fbFmtDate(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + ", " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function fbDoneIdx(r) {
  if (r.amazonStatus === "Closed") return 5;
  if (r.received > 0) return 4;
  if (r.amazonStatus === "Receiving") return 3;
  if (r.amazonStatus === "Shipped" || r.amazonStatus === "In transit") return 1;
  return 0;
}
function fbAmazonEvents(r) {
  const doneIdx = fbDoneIdx(r);
  const eta = fbParseEta(r.eta) || new Date(2026, 5, 1, 10, 0);
  return FB_AMZ_EVENTS.map((e, i) => {
    const done = i <= doneIdx;
    const d = new Date(eta.getTime() + e.offset * 864e5);
    return { ...e, done, cur: i === doneIdx, dateLabel: done ? fbFmtDate(d) : null };
  });
}

// ----- Source tag (Amazon ● / Manual ○) -------------------------------------
function FbSourceTag({ source }) {
  const amazon = source === "amazon";
  return (
    <span title={amazon ? "Synced from Amazon Seller Central" : "Entered manually"}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, flexShrink: 0, background: amazon ? "hsl(var(--info))" : "transparent", boxShadow: amazon ? "none" : "inset 0 0 0 1.5px hsl(var(--muted-fg) / 0.5)" }} />
      {amazon ? "Amazon" : "Manual"}
    </span>
  );
}

function FbCard({ title, sub, actions, icon, iconTone = "primary", children, pad = "16px 18px" }) {
  return (
    <section className="vy-card" style={{ padding: pad }}>
      {(title || actions) ? (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: children ? 14 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {icon ? <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--" + iconTone + ") / 0.12)", color: "hsl(var(--" + iconTone + "))" }}><VyIcon name={icon} size={15} /></span> : null}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{title}</h3>
              {sub ? <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>{sub}</p> : null}
            </div>
          </div>
          {actions ? <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function FbStat({ label, value, tone, source }) {
  return (
    <div style={{ flex: "1 1 90px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span className="vy-kicker">{label}</span>
        {source ? <FbSourceTag source={source} /> : null}
      </div>
      <div style={{ ...fbMono, fontSize: 16, fontWeight: 700, color: tone ? "hsl(var(--" + tone + "))" : undefined }}>{value}</div>
    </div>
  );
}

// Ship From / Ship To address block (Amazon "Shipment summary" mirror).
function FbAddressCard({ row: r }) {
  const a = (typeof fbaAddresses === "function") ? fbaAddresses(r) : null;
  if (!a) return null;
  const colLabel = { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", marginBottom: 6 };
  return (
    <FbCard icon="mapPin" iconTone="muted-fg" title="Ship from / Ship to" sub="Factory origin → destination fulfillment center.">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={colLabel}>Ship from</div>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.from.name}</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", lineHeight: 1.5 }}>
            {a.from.company}<br />
            {a.from.lines.map((ln, i) => <span key={i}>{ln}<br /></span>)}
            {a.from.phone}
          </div>
        </div>
        <div>
          <div style={colLabel}>Ship to</div>
          <div style={{ ...fbMono, fontSize: 12.5, fontWeight: 700 }}>{a.to.fcCode}</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", lineHeight: 1.5 }}>
            {a.to.city}{a.to.state ? ", " + a.to.state : ""}<br />
            {a.to.country}
          </div>
        </div>
      </div>
    </FbCard>
  );
}

// Carrier updates / Bill of Lading — the Amazon carrier feed (BOL + checkpoints).
function FbCarrierCard({ row: r }) {
  const c = (typeof fbaCarrierUpdates === "function") ? fbaCarrierUpdates(r) : null;
  if (!c) return null;
  const fmt = (ts) => new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <FbCard icon="route" iconTone="info" title={<>Carrier updates <FbSourceTag source="amazon" /></>} sub="Bill of Lading + carrier checkpoints, from the inbound's freight carrier.">
      {c.isShipTrack ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, background: "hsl(var(--info) / 0.08)", marginBottom: 12, fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>
          <VyIcon name="info" size={13} style={{ color: "hsl(var(--info))", flexShrink: 0 }} />
          <span>ShipTrack carrier — tracking ID auto-filled from the carrier once shipped.</span>
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14 }}>
        <FbStat label="BOL number" value={c.bolNumber || "—"} />
        <div style={{ flex: "2 1 200px", minWidth: 0 }}>
          <div className="vy-kicker" style={{ marginBottom: 3 }}>Pro / Freight</div>
          <div style={{ ...fbMono, fontSize: 13, fontWeight: 700, wordBreak: "break-all" }}>{c.proFreight}</div>
          <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", marginTop: 2 }}>First entered {fmt(c.firstEnteredAt)}</div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid hsl(var(--border) / 0.7)", paddingTop: 12 }}>
        <div className="vy-kicker" style={{ marginBottom: 8 }}>Tracking checkpoints</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {c.checkpoints.map((cp, i) => (
            <div key={i} style={{ display: "flex", gap: 12, minHeight: 30 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: i === 0 ? "hsl(var(--info))" : "hsl(var(--success))", flexShrink: 0, marginTop: 5 }} />
                {i < c.checkpoints.length - 1 ? <span style={{ width: 2, flex: 1, background: "hsl(var(--border))", margin: "2px 0" }} /> : null}
              </div>
              <div style={{ paddingBottom: i < c.checkpoints.length - 1 ? 10 : 0, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{cp.description}</div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{fmt(cp.at)} · {cp.location}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FbCard>
  );
}

// Shipment events timeline (Amazon custody leg) — extracted so it composes in
// the main column.
function FbEventsCard({ events, fc }) {
  return (
    <FbCard icon="route" iconTone="info" title={<>Shipment events <FbSourceTag source="amazon" /></>} sub="From Seller Central — the Amazon custody leg, starting at the FC handoff.">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {events.map((e, i) => {
          const color = e.done ? (e.cur ? "hsl(var(--info))" : "hsl(var(--success))") : "hsl(var(--border))";
          return (
            <div key={e.key} style={{ display: "flex", gap: 12, minHeight: 32 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                <span style={{ width: 12, height: 12, borderRadius: 999, display: "grid", placeItems: "center", background: e.done ? color : "hsl(var(--card))", border: "2px solid " + color, flexShrink: 0, marginTop: 4 }}>
                  {e.done ? <VyIcon name="check" size={7} style={{ color: "#fff" }} /> : null}
                </span>
                {i < events.length - 1 ? <span style={{ width: 2, flex: 1, background: e.done && events[i + 1].done ? "hsl(var(--success))" : "hsl(var(--border))", margin: "2px 0" }} /> : null}
              </div>
              <div style={{ paddingBottom: i < events.length - 1 ? 12 : 0, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: e.cur ? 700 : 600, color: e.cur ? "hsl(var(--info))" : e.done ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{e.label}</div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>
                  {e.done ? (e.key === "checkedin" ? e.dateLabel + " · " + fc : e.dateLabel) : <span style={{ fontStyle: "italic" }}>pending</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </FbCard>
  );
}

// ----------------------------------------------------------------------
// LINK MODAL — attach an unlinked inbound to a shipment, or keep standalone.
// ----------------------------------------------------------------------
function FbLinkModal({ row: r, onClose, onLinked }) {
  const ships = logAllShipments();
  const [shipmentId, setShipmentId] = useFbState(ships[0] ? ships[0].id : "");
  useFbEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const chosen = ships.find((s) => s.id === shipmentId);
  function commit(link) { logSaveFbaLink(r.id, link); onLinked(); }
  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 10000, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 480, padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Link FBA inbound</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>
              <span style={{ ...fbMono, fontWeight: 600 }}>{r.id}</span> · {r.fc} · {r.expected} units. Attach it to one of your shipments, or keep it standalone.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Attach to shipment</span>
            <select className="vy-input" style={{ width: "100%", height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" }} value={shipmentId} onChange={(e) => setShipmentId(e.target.value)}>
              {ships.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.orderTitle} ({s.packed} pcs)</option>)}
            </select>
          </label>
          {chosen ? (
            <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", padding: "8px 12px", borderRadius: 8, background: "hsl(var(--accent) / 0.5)" }}>
              Links to order <strong style={{ color: "hsl(var(--foreground))" }}>{chosen.orderId}</strong> — {chosen.orderTitle}. Received units will reconcile against that order.
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={() => commit({ standalone: true })}>Keep standalone</button>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="vy-btn vy-btn--primary" disabled={!shipmentId} onClick={() => commit({ shipmentId })}>
              <VyIcon name="link" size={14} /><span>Link</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
function FbaInboundPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useFbState(false);
  const [mobileNavOpen, setMobileNavOpen] = useFbState(false);
  const [isDark, setIsDark] = useFbState(false);
  const [linkOpen, setLinkOpen] = useFbState(false);
  const [tick, setTick] = useFbState(0);

  useFbEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  const params = new URLSearchParams(window.location.search);
  const fbaId = params.get("fba");
  const rows = logAllFbaRows();
  const r = rows.find((x) => x.id === fbaId) || null;

  if (!r) {
    return (
      <div className="vy-app">
        <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} active="FBA Shipments" />
        <div className="vy-app-main">
          <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} />
          <main className="vy-content"><div className="vy-content-inner">
            <div className="vy-card" style={{ padding: 40, textAlign: "center" }}>
              <p style={{ color: "hsl(var(--muted-fg))" }}>FBA inbound not found.</p>
              <a href="Vyonix FBA Shipments.html" className="vy-btn vy-btn--primary" style={{ textDecoration: "none", marginTop: 12 }}>Back to FBA Shipments</a>
            </div>
          </div></main>
        </div>
        <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="FBA Shipments" />
      </div>
    );
  }

  const lines = logFbaLines(r);
  const events = fbAmazonEvents(r);
  const variance = r.received > 0 ? r.received - r.expected : 0;
  const vTone = r.received <= 0 ? "muted-fg" : variance < 0 ? "danger" : variance > 0 ? "warning" : "success";
  const amzRef = "7" + r.id.replace(/[^A-Z0-9]/gi, "").slice(-6).toUpperCase();
  const fees = (typeof fbaInboundFees === "function") ? fbaInboundFees(r) : null;
  const recPct = r.expected > 0 ? Math.min(100, Math.round((r.received / r.expected) * 100)) : 0;

  const amzConn = typeof intgAmazonConnected === "function" ? intgAmazonConnected() : true;

  const kpis = [
    { label: "Status", value: r.amazonStatus, sub: "ETA " + r.eta, tone: LOG_FBA_TONE[r.amazonStatus], source: "amazon" },
    { label: "Expected", value: r.expected.toLocaleString(), sub: "units packed", source: "manual" },
    { label: "Received", value: r.received > 0 ? r.received.toLocaleString() : "—", sub: r.received > 0 ? recPct + "% booked" : "not yet", source: "amazon" },
    { label: "Variance", value: r.received <= 0 ? "—" : (variance > 0 ? "+" : "") + variance, sub: variance === 0 && r.received > 0 ? "reconciled" : variance < 0 ? "short" : variance > 0 ? "over" : "pending", tone: vTone === "muted-fg" ? null : vTone },
    { label: "SKUs", value: String(r.skuCount), sub: lines.length === 1 ? "line item" : "line items" },
    { label: "Dest FC", value: r.fc, sub: r.mode || "—", source: "amazon" },
  ];

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="FBA Shipments" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => {}} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} workspaceName="Operations" tabs={[{ key: "fba", label: "FBA inbound" }]} activeTab="fba" />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Breadcrumb */}
            <nav className="vy-breadcrumb" aria-label="Breadcrumb">
              <a href="Vyonix FBA Shipments.html" className="vy-bc-link">Operations</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <a href="Vyonix FBA Shipments.html" className="vy-bc-link">FBA Shipments</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <span className="vy-bc-current" aria-current="page">{r.id}</span>
            </nav>

            {/* Header */}
            <section className="vy-card" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h1 className="vy-title" style={{ margin: 0, ...fbMono }}>{r.id}</h1>
                    <FbSourceTag source="amazon" />
                    <span className={"vy-badge vy-badge--" + LOG_FBA_TONE[r.amazonStatus]}>{r.amazonStatus}</span>
                    <span className="vy-badge vy-badge--muted">{r.fc}</span>
                    {r.unlinked ? <span className="vy-badge vy-badge--warning">Unlinked</span> : r.standalone ? <span className="vy-badge vy-badge--muted">Direct to Amazon</span> : null}
                  </div>
                  <div className="vy-title-meta" style={{ marginTop: 12 }}>
                    <span className="vy-chip"><VyIcon name="truck" size={11} />{r.mode || "—"}</span>
                    <span className="vy-chip"><VyIcon name="route" size={11} />ETA {r.eta}</span>
                    {r.supplier ? <span className="vy-chip"><VyIcon name="factory" size={11} />{r.supplier}</span> : null}
                    {r.orderTitle && !r.unlinked ? <span className="vy-chip"><VyIcon name="cube" size={11} />{r.orderTitle}</span> : null}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {r.unlinked ? (
                    <button type="button" className="vy-btn vy-btn--primary" onClick={() => setLinkOpen(true)}><VyIcon name="link" size={13} /><span>Link</span></button>
                  ) : null}
                  {r.shipmentId ? (
                    <a href={"Vyonix Shipment.html?shipment=" + encodeURIComponent(r.shipmentId)} className="vy-btn vy-btn--outline" style={{ textDecoration: "none" }}><VyIcon name="ship" size={13} /><span>Forwarder leg</span></a>
                  ) : null}
                  {r.orderId ? (
                    <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(r.orderId)} className="vy-btn vy-btn--primary" style={{ textDecoration: "none" }}><VyIcon name="cube" size={13} /><span>Open order</span></a>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Sync strip */}
            {amzConn ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", borderRadius: 10, background: "hsl(var(--info) / 0.06)", border: "1px solid hsl(var(--info) / 0.22)" }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--info) / 0.14)", color: "hsl(var(--info))", flexShrink: 0 }}><VyIcon name="refresh" size={14} /></span>
                <div style={{ flex: 1, minWidth: 220, fontSize: 12.5 }}>
                  <strong style={{ fontWeight: 600 }}>Synced from Seller Central</strong>
                  <span style={{ color: "hsl(var(--muted-fg))" }}>&nbsp;&nbsp;Status &amp; received units per SKU{r.synced ? " · last sync " + r.synced : ""} · expected is your packing allocation</span>
                </div>
                <span className="vy-badge vy-badge--info" style={{ flexShrink: 0 }}>FBA Inbound API</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", borderRadius: 10, background: "hsl(var(--warning) / 0.08)", border: "1px solid hsl(var(--warning) / 0.28)" }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--warning) / 0.16)", color: "hsl(var(--warning))", flexShrink: 0 }}><VyIcon name="alert" size={14} /></span>
                <div style={{ flex: 1, minWidth: 220, fontSize: 12.5 }}>
                  <strong style={{ fontWeight: 600 }}>Amazon not connected</strong>
                  <span style={{ color: "hsl(var(--muted-fg))" }}>&nbsp;&nbsp;Received units aren't syncing — reconnect to resume.</span>
                </div>
                <a href="Vyonix Settings.html?section=integrations" className="vy-btn vy-btn--outline vy-btn--sm" style={{ flexShrink: 0 }}><VyIcon name="link" size={12} /><span>Reconnect</span></a>
              </div>
            )}

            {/* KPI strip */}
            <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              {kpis.map((k) => (
                <div className={"vy-card vy-kpi" + (k.tone ? " vy-kpi--" + k.tone : "")} key={k.label}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="vy-kicker">{k.label}</span>
                    {k.source ? <FbSourceTag source={k.source} /> : null}
                  </div>
                  <div className="vy-kpi-value" style={{ fontSize: 18, color: k.tone ? "hsl(var(--" + k.tone + "))" : undefined }}>{k.value}</div>
                  <div className="vy-kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            <div className="fba-two-col">
              <div className="fba-col-main">
              {/* Contents — the centerpiece */}
              <FbCard icon="boxes" iconTone="success" title={<>Contents <FbSourceTag source="amazon" /></>} sub="Per-SKU receiving reconciliation — this is where a short or over receipt is traced to the exact SKU." pad="16px 18px 6px">
                <div style={{ overflowX: "auto", margin: "0 -18px", borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                    <thead>
                      <tr style={{ background: "hsl(var(--muted-bg) / 0.5)" }}>
                        <th style={fbTh}>SKU</th>
                        <th style={fbTh}>FNSKU</th>
                        <th style={{ ...fbTh, textAlign: "right" }}><span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>Expected <FbSourceTag source="manual" /></span></th>
                        <th style={{ ...fbTh, textAlign: "right" }}><span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>Received <FbSourceTag source="amazon" /></span></th>
                        <th style={{ ...fbTh, textAlign: "right" }}>Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => {
                        const v = l.received > 0 || r.received > 0 ? l.received - l.expected : 0;
                        const started = r.received > 0;
                        const vt = !started ? "hsl(var(--muted-fg))" : v < 0 ? "hsl(var(--danger))" : v > 0 ? "hsl(var(--warning))" : "hsl(var(--success))";
                        return (
                          <tr key={l.sku} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                            <td style={fbTd}>
                              <div style={{ ...fbMono, fontWeight: 700, fontSize: 12.5 }}>{l.sku}</div>
                              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{l.name}</div>
                            </td>
                            <td style={{ ...fbTd, ...fbMono, fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{l.fnsku}</td>
                            <td style={{ ...fbTd, ...fbMono, textAlign: "right", fontWeight: 600 }}>{l.expected}</td>
                            <td style={{ ...fbTd, ...fbMono, textAlign: "right", fontWeight: 700 }}>{started ? l.received : "—"}</td>
                            <td style={{ ...fbTd, ...fbMono, textAlign: "right", fontWeight: 700, color: vt }}>{!started ? "—" : (v > 0 ? "+" : "") + v}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid hsl(var(--border))", background: "hsl(var(--muted-bg) / 0.35)" }}>
                        <td style={{ ...fbTd, fontWeight: 700 }}>Total</td>
                        <td style={fbTd}></td>
                        <td style={{ ...fbTd, ...fbMono, textAlign: "right", fontWeight: 700 }}>{r.expected}</td>
                        <td style={{ ...fbTd, ...fbMono, textAlign: "right", fontWeight: 700 }}>{r.received > 0 ? r.received : "—"}</td>
                        <td style={{ ...fbTd, ...fbMono, textAlign: "right", fontWeight: 700, color: r.received <= 0 ? "hsl(var(--muted-fg))" : variance < 0 ? "hsl(var(--danger))" : variance > 0 ? "hsl(var(--warning))" : "hsl(var(--success))" }}>{r.received <= 0 ? "—" : (variance > 0 ? "+" : "") + variance}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p style={{ fontSize: 11, color: "hsl(var(--muted-fg))", margin: "10px 0 12px" }}>
                  {r.received <= 0 ? "Not yet received — units book against each SKU as Amazon checks the inbound in."
                    : variance === 0 ? "Fully reconciled — every SKU received its expected count."
                    : variance < 0 ? "Short by " + Math.abs(variance) + " units. Check the SKU(s) flagged red — a removal or reconciliation case may be warranted."
                    : "+" + variance + " units over expected — verify the over-receipt against your packing list."}
                </p>
              </FbCard>

              <FbCarrierCard row={r} />
              <FbEventsCard events={events} fc={r.fc} />
              </div>{/* end main column */}

              {/* Right rail */}
              <div className="fba-col-side" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Receiving summary */}
                <FbCard icon="clipboard" iconTone="info" title="Receiving" sub="Amazon leg roll-up.">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 12 }}>
                    <FbStat label="Expected" value={r.expected} source="manual" />
                    <FbStat label="Received" value={r.received > 0 ? r.received : "—"} source="amazon" />
                    <FbStat label="Variance" value={r.received <= 0 ? "—" : (variance > 0 ? "+" : "") + variance} tone={vTone === "muted-fg" ? null : vTone} />
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: "hsl(var(--muted-bg))", overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: recPct + "%", background: variance < 0 ? "hsl(var(--danger))" : "hsl(var(--success))", borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 6 }}>{r.received > 0 ? recPct + "% of expected units booked in" : "Receiving not started"}</div>
                </FbCard>

                <FbAddressCard row={r} />

                {/* Forwarder-leg seam */}
                {r.unlinked ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: "1px solid hsl(var(--warning) / 0.4)", background: "hsl(var(--warning) / 0.08)" }}>
                    <VyIcon name="link" size={15} style={{ color: "hsl(var(--warning))", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>Not linked to a shipment</div>
                      <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Created in Seller Central — attach to an order or keep standalone.</div>
                    </div>
                    <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" style={{ flexShrink: 0 }} onClick={() => setLinkOpen(true)}><VyIcon name="link" size={12} /><span>Link</span></button>
                  </div>
                ) : r.standalone ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--accent) / 0.5)" }}>
                    <VyIcon name="cube" size={15} style={{ color: "hsl(var(--muted-fg))", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>Direct to Amazon</div>
                      <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Standalone inbound — no forwarder leg tracked.</div>
                    </div>
                  </div>
                ) : (
                  <a href={"Vyonix Shipment.html?shipment=" + encodeURIComponent(r.shipmentId)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--accent) / 0.5)", textDecoration: "none", color: "inherit" }}>
                    <VyIcon name="ship" size={15} style={{ color: "hsl(var(--muted-fg))", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>← Forwarder leg (freight to the FC)</div>
                      <div style={{ ...fbMono, fontSize: 12.5, fontWeight: 700 }}>{r.shipmentId}</div>
                    </div>
                    <VyIcon name="arrowRight" size={13} style={{ opacity: 0.5 }} />
                  </a>
                )}

                {/* Identifiers */}
                <FbCard icon="hash" iconTone="muted-fg" title="Amazon identifiers">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                    <FbStat label="FBA shipment ID" value={r.id} />
                    <FbStat label="Amazon ref" value={amzRef} />
                    <FbStat label="Dest FC" value={r.fc} />
                    <FbStat label="ETA" value={r.eta} />
                  </div>
                </FbCard>

                {/* Inbound fees (estimated) — Amazon-side per-unit costs that fold into landed cost */}
                {fees ? (
                <FbCard icon="dollar" iconTone="warning" title={<>Inbound fees <span style={{ fontSize: 11, fontWeight: 500, color: "hsl(var(--muted-fg))" }}>estimated</span> <FbSourceTag source="amazon" /></>} sub="Amazon's per-unit inbound charges — folded into this order's landed cost.">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 12 }}>
                    <FbStat label="Placement service" value={fees.placementWaived ? "$0.00" : "$" + fees.placement.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                    <FbStat label="Prep" value={"$" + fees.prep.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                    <FbStat label="Labeling" value={"$" + fees.label.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                    <FbStat label="Manual processing" value={"$" + fees.manual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 8, background: "hsl(var(--accent) / 0.5)" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>Total inbound fees</span>
                    <span style={{ ...fbMono, fontSize: 15, fontWeight: 700 }}>${fees.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: 11, fontWeight: 500, color: "hsl(var(--muted-fg))" }}>· ${fees.perUnit.toFixed(2)}/unit</span></span>
                  </div>
                  <p style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", margin: "10px 0 0", lineHeight: 1.4 }}>
                    {fees.placementWaived ? "Placement fee waived (optimized plan). " : ""}{fees.amazonPreps ? "Amazon preps & labels this inbound." : "Self-prepped — no Amazon prep/label fee."} Estimate; actuals arrive from Seller Central once the inbound closes.
                  </p>
                </FbCard>
                ) : null}
              </div>
            </div>

            {/* Linked order */}
            {r.orderId ? (
              <FbCard icon="cube" iconTone="primary" title="Order">
                <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(r.orderId)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 15px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)", textDecoration: "none", color: "inherit" }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="cube" size={16} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...fbMono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{r.orderId}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.orderTitle}</div>
                  </div>
                  <VyIcon name="arrowRight" size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
                </a>
              </FbCard>
            ) : null}
          </div>
        </main>
      </div>

      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="FBA Shipments" />
      {linkOpen ? <FbLinkModal row={r} onClose={() => setLinkOpen(false)} onLinked={() => { setLinkOpen(false); setTick((n) => n + 1); window.location.reload(); }} /> : null}
    </div>
  );
}

const fbTh = { textAlign: "left", padding: "10px 18px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" };
const fbTd = { padding: "11px 18px", color: "hsl(var(--foreground))", fontSize: 12.5, whiteSpace: "nowrap" };

const fbRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
fbRoot.render(<FbaInboundPage />);
