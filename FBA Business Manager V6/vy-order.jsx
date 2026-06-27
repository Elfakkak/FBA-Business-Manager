// Order section shell: breadcrumb, page switcher, page placeholders + Home.
// The order IDENTITY + Home view are now derived from ?order= against the
// shared orders list (orders-data.jsx + draft store). The deep section BODIES
// (Production/Shipping/…) still carry their own sample data for now.

// ----- parse helpers (ORDERS_LIST rows store display strings) -----
function ordNum(s) { const m = (s || "").match(/\$?([\d,]+(?:\.\d+)?)/); return m ? Number(m[1].replace(/,/g, "")) : 0; }
function ordPct(s) { const m = (s || "").match(/(\d+)\s*%/); return m ? Number(m[1]) : 0; }
function ordUnits(meta) { const m = (meta || "").match(/([\d,]+)\s*units/); return m ? Number(m[1].replace(/,/g, "")) : 0; }
function ordAgent(route) { if (!route) return "Direct"; const m = route.match(/via\s+(.+)/i); return m ? m[1].trim() : "Direct"; }
function ordPlaced(meta) { const parts = (meta || "").split("·").map((s) => s.trim()).filter(Boolean); return parts.length ? parts[parts.length - 1] : "—"; }
function ordFba(sub, shipping) {
  const t = sub || "";
  if (/received/i.test(t)) return "Received";
  const m = t.match(/ETA\s*([A-Za-z]+\s*\d+)/i);
  return m ? m[1] : "—";
}
function ordMoney(n) { return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function ordNextSection(nextStep) {
  const s = (nextStep || "").toLowerCase();
  if (/close|landed|reconcile|receiv/.test(s)) return { key: "closeout", label: "Landed cost" };
  if (/pay|deposit|balance|invoice/.test(s) && !/deposit to start/.test(s)) return { key: "invoices", label: "Invoices" };
  if (/inspect|\bqc\b/.test(s)) return { key: "inspection", label: "Inspection" };
  if (/ship|forwarder|book|track|transit|eta/.test(s)) return { key: "shipping", label: "Shipping" };
  if (/receipt|produc|supplier|photo|qc photos|deposit to start/.test(s)) return { key: "production", label: "Production" };
  return { key: "production", label: "Production" };
}

function ordCurrentStage(statusLabel) {
  if (typeof ordStageForStatus === "function") return ordStageForStatus(statusLabel);
  const s = (statusLabel || "").toLowerCase();
  if (/close|at fba|fba/.test(s)) return "closeout";
  if (/transit|ship/.test(s)) return "shipping";
  if (/inspect/.test(s)) return "inspection";
  return "production"; // In production / Draft
}

// Build the order identity from ?order= against the shared list (incl. drafts).
function ordBuildOrder() {
  let id = null;
  try { id = new URLSearchParams(window.location.search).get("order"); } catch {}
  const all = (typeof ordAllOrders === "function") ? ordAllOrders() : (window.ORDERS_LIST || []);
  const row = (id && all.find((o) => o.id === id)) || all.find((o) => o.id === "ORD-2026-05-006") || all[0];
  if (!row) {
    return { id: "ORD-2026-05-006", title: "Q1 restock — Beaded seat covers", agent: "Mutual Trade Union", factory: "Sheng Te Long", units: 1600, status: { label: "In production", tone: "info" }, placedOn: "May 4, 2026", orderTotalUsd: 14445.78, paidUsd: 8980.15, balanceDueUsd: 5465.63, fbaEta: "Jun 24", paidPct: 62, nextStep: "Confirm supplier receipt", row: {} };
  }
  const total = ordNum(row.moneyTotal);
  let titleOverride = null;
  try { const m = JSON.parse(localStorage.getItem("vy_order_titles_v1") || "{}"); titleOverride = m[row.id] || null; } catch {}
  const pct = ordPct(row.moneyPct) || (/(paid in full|fully paid)/i.test(row.moneyDue || "") ? 100 : 0);
  const paid = Math.round(total * pct) / 100;
  return {
    id: row.id,
    title: titleOverride || row.title,
    factory: row.supplier || "—",
    agent: ordAgent(row.route),
    units: ordUnits(row.meta),
    status: { label: row.status, tone: row.statusTone || "muted" },
    placedOn: ordPlaced(row.meta),
    orderTotalUsd: total,
    paidUsd: paid,
    balanceDueUsd: Math.max(0, Math.round((total - paid) * 100) / 100),
    paidPct: pct,
    fbaEta: ordFba(row.shippingSub, row.shipping),
    nextStep: row.nextStep || "Review order",
    row,
  };
}

const ORDER = ordBuildOrder();

// Expose the current order + a shared "illustrative detail" note so the deep
// section bodies (separate Babel scripts) can stay identity-consistent. The
// canonical sample order (ORD-2026-05-006) is fully exact; for any other order
// the operational line-level tables are a representative working example.
const ORD_SAMPLE_ID = "ORD-2026-05-006";
window.VY_CURRENT_ORDER = ORDER;
window.vyIsSampleOrder = function () { return ORDER.id === ORD_SAMPLE_ID; };
window.VyExampleNote = function VyExampleNote({ section }) {
  if (ORDER.id === ORD_SAMPLE_ID) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 9, background: "hsl(var(--info) / 0.08)", border: "1px solid hsl(var(--info) / 0.22)", fontSize: 12, color: "hsl(var(--muted-fg))" }}>
      <VyIcon name="info" size={13} style={{ color: "hsl(var(--info))", flexShrink: 0 }} />
      <span>
        <strong style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>{ORDER.title}</strong> — this {section} reflects <strong style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>this order's</strong> scope (SKUs, units, supplier &amp; costs), derived from the order. Operational line detail (carton counts, tracking, files) is representative.
      </span>
    </div>
  );
};

const PAGE_DEFS = [
  { key: "home",       label: "Home",       icon: "orderHome" },
  { key: "production", label: "Production", icon: "hammer" },
  { key: "inspection", label: "Inspection", icon: "clipboard" },
  { key: "shipping",   label: "Shipping",   icon: "truck" },
  { key: "invoices",   label: "Invoices",   icon: "receipt" },
  { key: "closeout",   label: "Landed cost",   icon: "closeout" },
];

// ----------------------------------------------------------------------
// Breadcrumb
// ----------------------------------------------------------------------
function VyBreadcrumb({ activeKey, pages }) {
  const defs = pages || PAGE_DEFS;
  const current = defs.find((p) => p.key === activeKey) || defs[0];
  return (
    <nav className="vy-breadcrumb" aria-label="Breadcrumb">
      <a href="Vyonix Orders List.html" className="vy-bc-link">
        Orders
      </a>
      <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
      <a href="Vyonix Orders List.html" className="vy-bc-link vy-bc-mono">
        {ORDER.id}
      </a>
      <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
      <span className="vy-bc-current" aria-current="page">{current.label}</span>
    </nav>
  );
}

// ----------------------------------------------------------------------
// Page switcher pills (active = Vyonix orange)
// ----------------------------------------------------------------------
function VyPageSwitcher({ active, onChange, pages }) {
  const defs = pages || PAGE_DEFS;
  return (
    <nav className="vy-pageswitch" aria-label="Order pages">
      {defs.map((p) => (
        <button
          key={p.key}
          type="button"
          className={"vy-page-pill" + (active === p.key ? " is-active" : "")}
          onClick={() => onChange(p.key)}
          aria-current={active === p.key ? "page" : undefined}
        >
          <VyIcon name={p.icon} size={13} />
          <span>{p.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ----------------------------------------------------------------------
// Order header + Next-action panel (same split pattern as the sections)
// ----------------------------------------------------------------------
const NEED_SEVERITY_RANK = { danger: 0, warning: 1, info: 2 };

function VyOrderHeader({ onJump, onOpenActivity, onOpenMore, onEditOrder }) {
  // Order-level next action = the single most urgent need, derived live so it
  // always reconciles with the Needs-attention list below.
  const top = [...NEEDS].sort(
    (a, b) => NEED_SEVERITY_RANK[a.severity] - NEED_SEVERITY_RANK[b.severity]
  )[0];

  // Live status badge — reflects data-driven auto-advances (re-read on mount
  // and when a section milestone moves the order).
  const [, hdrTick] = React.useState(0);
  React.useEffect(() => {
    function onChange(e) {
      if (!e || !e.detail || e.detail.id === ORDER.id) hdrTick((n) => n + 1);
    }
    window.addEventListener("vy-order-status-changed", onChange);
    return () => window.removeEventListener("vy-order-status-changed", onChange);
  }, []);
  const hdrInfo = (typeof ordStatusInfo === "function" && typeof ordStatusKey === "function")
    ? ordStatusInfo(ordStatusKey(ORDER.id, ORDER.status.label))
    : ORDER.status;

  return (
    <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {/* Identity */}
        <div style={{ flex: "1 1 460px", padding: "20px 22px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="vy-mono vy-order-id">{ORDER.id}</span>
              <VyBadge tone={hdrInfo.tone} dot>{hdrInfo.label}</VyBadge>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ fontSize: 11.5 }} onClick={onOpenActivity}>
                <VyIcon name="activity" size={13} /><span>Activity</span>
              </button>
              <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => { if (onEditOrder) onEditOrder(); }}>
                <VyIcon name="pencil" size={12} /><span>Edit</span>
              </button>
              <button type="button" className="vy-btn vy-btn--outline vy-btn--icon vy-btn--sm" aria-label="More actions" data-vy-more-trigger onClick={(e) => onOpenMore && onOpenMore(e.currentTarget)}>
                <VyIcon name="more" size={14} />
              </button>
            </div>
          </div>
          <h1 className="vy-title" style={{ margin: "12px 0 0" }}>{ORDER.title}</h1>
          <p style={{ fontSize: 13, color: "hsl(var(--muted-fg))", margin: "6px 0 0", maxWidth: "60ch" }}>
            Hub for this purchase order. Track every stage at a glance — the work happens inside each owning section.
          </p>
          <div className="vy-title-meta" style={{ marginTop: 14 }}>
            <a href={"Vyonix Partner.html?partner=" + encodeURIComponent(ORDER.agent)} className="vy-chip" style={{ textDecoration: "none", cursor: ORDER.agent && ORDER.agent !== "Direct" ? "pointer" : "default" }} onClick={(e) => { if (!ORDER.agent || ORDER.agent === "Direct") e.preventDefault(); }}><VyIcon name="route" size={11} />Agent · {ORDER.agent}</a>
            <a href={"Vyonix Supplier.html?supplier=" + encodeURIComponent(ORDER.factory)} className="vy-chip" style={{ textDecoration: "none", cursor: "pointer" }}><VyIcon name="factory" size={11} />Factory · {ORDER.factory}</a>
            <span className="vy-chip"><VyIcon name="package" size={11} />{ORDER.units.toLocaleString()} units</span>
            <span className="vy-chip"><VyIcon name="calendar" size={11} />Placed {ORDER.placedOn}</span>
          </div>
        </div>

        {/* Next action */}
        <div style={{
          flex: "1 1 300px", padding: "20px 22px", minWidth: 260,
          borderLeft: "1px solid hsl(var(--border))", background: "hsl(var(--accent) / 0.5)",
        }}>
          <div className="vy-kicker" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span className={"vy-need-dot vy-need-dot--" + top.severity} aria-hidden="true" />
            Next action
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, textWrap: "pretty" }}>{top.headline}</div>
          <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "4px 0 14px" }}>{top.detail}</p>
          <button type="button" className="vy-btn vy-btn--primary" onClick={() => onJump(top.section)}>
            <span>Open {top.sectionLabel}</span>
            <VyIcon name="arrowRight" size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------
// Status badge
// ----------------------------------------------------------------------
function VyBadge({ tone = "muted", children, dot = false }) {
  return (
    <span className={"vy-badge vy-badge--" + tone}>
      {dot ? <span className="vy-badge-dot" /> : null}
      {children}
    </span>
  );
}

// ----------------------------------------------------------------------
// KPI strip (icon-led, 5 across — matches the section bodies)
// ----------------------------------------------------------------------
function VyKpiRow() {
  function money(n) {
    return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const items = [
    { icon: "receipt",  label: "Order total", value: money(ORDER.orderTotalUsd), sub: ORDER.units.toLocaleString() + " units · 1 SKU" },
    { icon: "dollar",   label: "Paid",        value: money(ORDER.paidUsd),       sub: ORDER.paidPct + "% of total", tone: "success", progress: ORDER.paidPct },
    { icon: "alert",    label: "Balance due", value: money(ORDER.balanceDueUsd), sub: "Due before shipment", tone: "warning" },
    { icon: "package",  label: "Units",       value: ORDER.units.toLocaleString(), sub: "Ordered scope" },
    { icon: "truck",    label: "FBA ETA",     value: ORDER.fbaEta,               sub: ORDER.fbaEta === "Received" ? "Inbound received" : "Estimated arrival" },
  ];
  return (
    <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
      {items.map((it) => (
        <div className={"vy-card vy-kpi" + (it.tone ? " vy-kpi--" + it.tone : "")} key={it.label}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <VyIcon name={it.icon} size={14} style={{ opacity: 0.7 }} />
            <span className="vy-kicker">{it.label}</span>
          </div>
          <div className="vy-kpi-value" style={{ fontSize: 18 }}>{it.value}</div>
          <div className="vy-kpi-sub">{it.sub}</div>
          {typeof it.progress === "number" ? (
            <div className="vy-progress" aria-hidden="true">
              <span style={{ width: it.progress + "%" }} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// Order journey — lifecycle strip across the 5 owning sections
// ----------------------------------------------------------------------
function VyOrderJourney({ onJump }) {
  const lineColor = "hsl(var(--border))";
  const doneColor = "hsl(var(--success, 142 71% 45%))";
  // Inspection can be turned off per order. When it's off we DROP it from the
  // journey entirely (stepper + stage picker) — a skipped stage shouldn't show.
  const inspectionOn = (typeof ordInspectionRequired === "function") ? ordInspectionRequired(ORDER.id) : true;
  const journeyRows = SECTION_MAP_ROWS.filter((r) => !(r.key === "inspection" && !inspectionOn));
  const cols = [];
  journeyRows.forEach((row, i) => {
    cols.push("minmax(0, auto)");
    if (i < journeyRows.length - 1) cols.push("1fr");
  });

  // Re-read persisted status on each mount AND whenever a section milestone
  // moves it (the vy-order-status-changed event), so the journey reflects
  // data-driven auto-advances without a full reload.
  const [, forceTick] = React.useState(0);
  React.useEffect(() => {
    function onChange(e) {
      if (!e || !e.detail || e.detail.id === ORDER.id) forceTick((n) => n + 1);
    }
    window.addEventListener("vy-order-status-changed", onChange);
    return () => window.removeEventListener("vy-order-status-changed", onChange);
  }, []);

  // Live status (override-aware), not the value cached at module load.
  const liveKey = (typeof ordStatusKey === "function")
    ? ordStatusKey(ORDER.id, ORDER.status.label)
    : (typeof ordStatusKeyFromLabel === "function" ? ordStatusKeyFromLabel(ORDER.status.label) : "production");
  const liveInfo = (typeof ordStatusInfo === "function") ? ordStatusInfo(liveKey) : ORDER.status;
  const liveLabel = liveInfo.label || ORDER.status.label;
  const liveTone = liveInfo.tone || ORDER.status.tone;

  // Live status controls — advance / step back / reset, persisted per order.
  const curKey = liveKey;
  const pipe = window.ORD_PIPELINE || [];
  const idx = pipe.findIndex((p) => p.key === curKey);
  const nextStage = idx >= 0 ? pipe[idx + 1] : null;
  const atStart = idx <= 0;
  const atEnd = idx >= pipe.length - 1;
  function advance() { ordAdvanceStatus(ORDER.id, liveLabel); location.reload(); }
  function stepBack() { ordStepBackStatus(ORDER.id, liveLabel); location.reload(); }
  function reset() { ordResetStatus(ORDER.id); location.reload(); }
  // Jump straight to any stage (manual override), persisted per order.
  function jumpTo(key) { if (key && key !== curKey && typeof ordSetStatus === "function") { ordSetStatus(ORDER.id, key); location.reload(); } }

  // Per-node completion: sequential backbone (production → inspection → shipping
  // → closeout) drives done/current/upcoming; Invoices is PARALLEL so its ✓ comes
  // from payment being settled, not from sequence position.
  const hasMoney = (ORDER.orderTotalUsd || 0) > 0;
  const settled = hasMoney && ORDER.balanceDueUsd <= 0;
  const isClosed = /closed/i.test(liveLabel);
  const curStage = ordCurrentStage(liveLabel);
  // For the sequential backbone, a skipped inspection shouldn't block progress.
  const seq = journeyRows.map((r) => r.key).filter((k) => k !== "invoices" && !(k === "inspection" && !inspectionOn));
  const curSeqIdx = seq.indexOf(curStage);
  function nodeState(row) {
    if (row.key === "inspection" && !inspectionOn) return "skipped";
    if (row.key === "invoices") return settled ? "done" : "open";
    if (row.key === "closeout") return isClosed ? "done" : (curStage === "closeout" ? "current" : "upcoming");
    const ni = seq.indexOf(row.key);
    if (ni < 0) return "upcoming";
    if (ni < curSeqIdx) return "done";
    if (ni === curSeqIdx) return "current";
    return "upcoming";
  }

  return (
    <section className="vy-card" style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div className="vy-kicker">Order journey</div>
          <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 2 }}>
            Where this order sits across its lifecycle. Click a stage to open it.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <VyBadge tone={liveTone} dot>{liveLabel}</VyBadge>
          <select value={curKey} onChange={(e) => jumpTo(e.target.value)} title="Jump to any stage" aria-label="Set order stage" style={{ height: 30, padding: "0 8px", fontSize: 12, fontWeight: 600, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", cursor: "pointer" }}>
            {pipe.filter((p) => !(p.key === "inspection" && !inspectionOn)).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" className="vy-btn vy-btn--outline vy-btn--sm vy-btn--icon" disabled={atStart} title="Step back a stage" onClick={stepBack}>
              <VyIcon name="chevronLeft" size={13} />
            </button>
            {atEnd ? (
              <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" title="Restart lifecycle" onClick={reset}>
                <VyIcon name="refresh" size={12} /><span>Reset</span>
              </button>
            ) : (
              <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" onClick={advance}>
                <span>Advance to {nextStage ? nextStage.label : "next"}</span>
                <VyIcon name="arrowRight" size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: cols.join(" "), alignItems: "start" }}>
        {journeyRows.map((row, i) => {
          const st = nodeState(row);
          const isCurrent = st === "current";
          const isDone = st === "done";
          const isSkipped = st === "skipped";
          const toneVar = isDone ? "success, 142 71% 45%" : isCurrent ? "primary" : (isSkipped ? "muted-fg" : (row.statusPill.tone === "muted" ? "muted-fg" : row.statusPill.tone));
          const pillTone = isDone ? "success" : isSkipped ? "muted" : row.statusPill.tone;
          const pillText = isSkipped ? "Skipped" : (isDone && row.key !== "invoices" && row.key !== "closeout" ? "Done" : row.statusPill.text);
          const node = (
            <button
              type="button"
              key={row.key}
              onClick={() => { if (!isSkipped) onJump(row.key); }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                background: "transparent", border: "none", cursor: isSkipped ? "default" : "pointer", padding: "0 4px", minWidth: 0,
                opacity: isSkipped ? 0.55 : 1,
              }}
            >
              <span style={{
                position: "relative",
                width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center",
                background: `hsl(var(--${toneVar}) / 0.12)`, color: `hsl(var(--${toneVar}))`,
                border: isSkipped ? "1px dashed hsl(var(--muted-fg) / 0.5)" : "none",
                boxShadow: isCurrent ? "0 0 0 3px hsl(var(--primary) / 0.16)" : "none",
              }}>
                <VyIcon name={row.icon} size={17} />
                {isDone ? (
                  <span style={{ position: "absolute", right: -4, bottom: -4, width: 17, height: 17, borderRadius: 999, background: doneColor, color: "#fff", display: "grid", placeItems: "center", border: "2px solid hsl(var(--card))" }}>
                    <VyIcon name="check" size={9} />
                  </span>
                ) : null}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: "center", whiteSpace: "nowrap", textDecoration: isSkipped ? "line-through" : "none" }}>{row.label}</span>
              <span className={"vy-badge vy-badge--" + pillTone} style={{ fontSize: 9.5, padding: "2px 7px" }}>{pillText}</span>
            </button>
          );
          if (i === journeyRows.length - 1) return node;
          return [
            node,
            <div key={row.key + "-line"} style={{ height: 2, marginTop: 18, background: isDone ? doneColor : lineColor, borderRadius: 2 }} />,
          ];
        })}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------
// Section map — row per owning section, linking to Page
// ----------------------------------------------------------------------
const SECTION_MAP_ROWS = (function ordBuildSectionRows(o) {
  const r = o.row || {};
  const hasMoney = (o.orderTotalUsd || 0) > 0;
  const settled = hasMoney && o.balanceDueUsd <= 0;
  const atEnd = /at fba|closed/i.test(o.status.label || "");
  return [
    {
      key: "production", label: "Production", icon: "hammer",
      statusPill: { text: r.productionSub || r.production || "In production", tone: o.status.tone === "muted" ? "muted" : "info" },
      line: [r.production, r.productionSub].filter(Boolean).join(" · ") || "Factory scope · supplier files",
      rightValue: ordMoney(o.orderTotalUsd), rightSub: "Order total", accentVar: "primary",
    },
    {
      key: "inspection", label: "Inspection", icon: "clipboard",
      statusPill: { text: "Pending", tone: "muted" },
      line: "AQL check · schedule before pre-shipment",
      rightValue: "—", rightSub: "QC gate", accentVar: "success",
    },
    {
      key: "shipping", label: "Shipping", icon: "truck",
      statusPill: { text: r.shipping || "TBD", tone: "info" },
      line: [r.shipping, r.shippingSub].filter(Boolean).join(" · ") || "Awaiting booking",
      rightValue: o.fbaEta || "—", rightSub: "FBA ETA", accentVar: "info",
    },
    {
      key: "invoices", label: "Invoices", icon: "receipt",
      statusPill: { text: !hasMoney ? "No bills yet" : settled ? "Settled" : "Balance due", tone: !hasMoney ? "muted" : settled ? "success" : "warning" },
      line: [r.moneyDue, r.moneyPct].filter(Boolean).join(" · ") || "No open balance",
      rightValue: !hasMoney ? "—" : settled ? "Paid" : ordMoney(o.balanceDueUsd), rightSub: "Balance due", accentVar: "warning",
    },
    {
      key: "closeout", label: "Landed cost", icon: "closeout",
      statusPill: { text: atEnd ? "Ready" : "Open", tone: atEnd ? "success" : "muted" },
      line: "Landed cost + inventory lot lock on receiving",
      rightValue: "—", rightSub: "Locks order", accentVar: "muted",
    },
  ];
})(ORDER);

function VySectionMap({ onJump }) {
  return (
    <section className="vy-section-map">
      <div className="vy-section-head">
        <span className="vy-kicker">Sections</span>
        <span className="vy-section-sub">Work happens inside the owning section. Home is a router.</span>
      </div>
      <div className="vy-section-list">
        {SECTION_MAP_ROWS.map((row) => (
          <button
            type="button"
            className="vy-card vy-section-row"
            key={row.key}
            onClick={() => onJump(row.key)}
          >
            <span className={"vy-section-icon vy-section-icon--" + row.accentVar}>
              <VyIcon name={row.icon} size={18} />
            </span>
            <div className="vy-section-row-main">
              <div className="vy-section-row-title">
                <span className="vy-section-row-label">{row.label}</span>
                <VyBadge tone={row.statusPill.tone}>{row.statusPill.text}</VyBadge>
              </div>
              <div className="vy-section-row-line">{row.line}</div>
            </div>
            <div className="vy-section-row-right">
              <div className="vy-section-row-value">{row.rightValue}</div>
              <div className="vy-section-row-sub">{row.rightSub}</div>
            </div>
            <VyIcon name="chevronRight" size={14} style={{ opacity: 0.5 }} />
          </button>
        ))}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------
// Needs attention block (max 3, read-only, links to owning sections)
// ----------------------------------------------------------------------
const NEEDS = (function ordBuildNeeds(o) {
  const needs = [];
  const ns = ordNextSection(o.nextStep);
  const sevByTone = { danger: "danger", warning: "warning", success: "info", info: "info", muted: "info" };
  needs.push({
    section: ns.key, sectionLabel: ns.label,
    severity: sevByTone[o.status.tone] || "info",
    headline: o.nextStep,
    detail: o.status.label + " · " + o.factory + (o.units ? " · " + o.units.toLocaleString() + " units" : ""),
  });
  if (o.balanceDueUsd > 0 && ns.key !== "invoices") {
    needs.push({
      section: "invoices", sectionLabel: "Invoices", severity: "warning",
      headline: "Balance due before shipment release",
      detail: ordMoney(o.balanceDueUsd) + " outstanding · " + o.paidPct + "% paid",
    });
  }
  return needs;
})(ORDER);

function VyNeedsAttention({ onJump }) {
  return (
    <section className="vy-card vy-needs">
      <div className="vy-needs-head">
        <div>
          <div className="vy-kicker">Needs attention</div>
          <div className="vy-needs-sub">Derived from the owning sections. Read-only — fix it where it lives.</div>
        </div>
        <span className="vy-needs-count">{NEEDS.length}</span>
      </div>
      <div className="vy-needs-list">
        {NEEDS.map((n, i) => (
          <button
            type="button"
            key={i}
            className={"vy-need-row vy-need-row--" + n.severity}
            onClick={() => onJump(n.section)}
          >
            <span className={"vy-need-dot vy-need-dot--" + n.severity} aria-hidden="true" />
            <div className="vy-need-main">
              <div className="vy-need-headline">
                <span>{n.headline}</span>
                <span className="vy-need-section-tag">{n.sectionLabel}</span>
              </div>
              <div className="vy-need-detail">{n.detail}</div>
            </div>
            <VyIcon name="arrowRight" size={13} style={{ opacity: 0.55 }} />
          </button>
        ))}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------
// HOME page
// ----------------------------------------------------------------------
function VyOrderHome({ onJump, onOpenActivity, onOpenMore, onEditOrder }) {
  return (
    <div className="vy-page-body">
      <VyOrderHeader onJump={onJump} onOpenActivity={onOpenActivity} onOpenMore={onOpenMore} onEditOrder={onEditOrder} />
      <VyKpiRow />
      <VyOrderJourney onJump={onJump} />
      <VyNeedsAttention onJump={onJump} />
    </div>
  );
}

// ----------------------------------------------------------------------
// Placeholder page card — same skeleton for every non-home page
// ----------------------------------------------------------------------
const PAGE_PLACEHOLDERS = {
  production: {
    title: "Production",
    subtitle: "Factory scope, product lines, charges, readiness, supplier files.",
    primary: { label: "Add product",    sheet: "add-product" },
    blocks: [
      { kicker: "Factory scope",     label: "1 SKU · 1,600 units",   sub: "Sheng Te Long · CN · Direct via Mutual Trade Union" },
      { kicker: "Readiness",         label: "D14 · WIP photos",       sub: "On schedule · 64% complete · ready Jun 4" },
      { kicker: "Charges",           label: "Goods + service lines",  sub: "$14,125.78 goods · $320 inspection · $0 fees" },
      { kicker: "Supplier files",    label: "PI · Spec · Packaging",  sub: "Carton spec missing · upload before pre-shipment" },
    ],
    tone: "primary",
  },
  shipping: {
    title: "Shipping",
    subtitle: "Physical shipment batches, packing lists, FBA links, freight, receiving.",
    primary: { label: "Add shipment", sheet: "add-shipment" },
    blocks: [
      { kicker: "Batches",       label: "1 planned · 0 in transit",    sub: "FCL 20' · Yantian → Long Beach" },
      { kicker: "Packing lists", label: "0 of 1 received",             sub: "Carton dims + weight required" },
      { kicker: "FBA link",      label: "Unlinked",                    sub: "Connect FBA-INBOUND-94G2X after labels" },
      { kicker: "Receiving",     label: "ETA Jun 24",                  sub: "Forwarder · ECU Worldwide · awaiting booking" },
    ],
    tone: "info",
  },
  inspection: {
    title: "Inspection",
    subtitle: "Schedule QC, collect report and media, decide release.",
    primary: { label: "Schedule inspection", sheet: "schedule-inspection" },
    blocks: [
      { kicker: "Schedule",  label: "May 30, 2026",                   sub: "Inspect Pro · Lin Chen · on-site pre-shipment" },
      { kicker: "Scope",     label: "AQL II / 2.5 / 4.0 · 1,600 pcs", sub: "Lot 01 · stitch + colour + carton check" },
      { kicker: "Report",    label: "Not yet uploaded",                sub: "PDF report + photo evidence" },
      { kicker: "Decision",  label: "Pending",                         sub: "Release / re-work / reject — locked until report in" },
    ],
    tone: "success",
  },
  invoices: {
    title: "Invoices",
    subtitle: "Vendor bills, balances, payments, and proof of payment.",
    primary: { label: "Add invoice", sheet: "add-invoice" },
    blocks: [
      { kicker: "Open invoices",   label: "2 invoices · 1 partial",   sub: "PI-2605-MUTU-001 · PI-2605-INSP-001" },
      { kicker: "Balance",         label: "$5,465.63 due",            sub: "62% paid of $14,445.78 total" },
      { kicker: "Payments",        label: "2 logged · 1 cleared",     sub: "PAY-2605-001 cleared · PAY-2605-002 scheduled" },
      { kicker: "Proof",           label: "1 of 2 receipts attached", sub: "Upload bank confirmation for PAY-2605-001" },
    ],
    tone: "warning",
  },
  closeout: {
    title: "Landed cost",
    subtitle: "Final landed cost, received units, and inventory lot lock.",
    primary: { label: "Finalize landed cost", dialog: "finalize-closeout" },
    blocks: [
      { kicker: "Landed cost",     label: "Pending",                  sub: "Locks once all invoices reconciled + units received" },
      { kicker: "Units received",  label: "0 of 1,600",               sub: "Counted on FBA WHD inbound" },
      { kicker: "Inventory lot",   label: "Not yet locked",           sub: "Will create LOT-2605-001 on finalize" },
      { kicker: "Accountant pack", label: "Not yet generated",        sub: "PDF bundle + landed cost CSV export" },
    ],
    tone: "muted",
  },
};

function VyPagePlaceholder({ pageKey, onOpenSheet, onOpenDialog }) {
  const def = PAGE_PLACEHOLDERS[pageKey];
  if (!def) return null;
  return (
    <div className="vy-page-body">
      <section className="vy-card vy-page-head-card">
        <div className="vy-page-head-main">
          <div className="vy-kicker">Order section</div>
          <h2 className={"vy-page-title vy-page-title--" + def.tone}>{def.title}</h2>
          <p className="vy-page-sub">{def.subtitle}</p>
        </div>
        <div className="vy-page-head-actions">
          {def.primary ? (
            <button
              type="button"
              className="vy-btn vy-btn--primary"
              onClick={() => def.primary.sheet ? onOpenSheet(def.primary.sheet) : onOpenDialog(def.primary.dialog)}
            >
              <VyIcon name="plus" size={13} />
              <span>{def.primary.label}</span>
            </button>
          ) : null}
          <button type="button" className="vy-btn vy-btn--outline">
            <VyIcon name="filter" size={13} />
            <span>Filter</span>
          </button>
          <button type="button" className="vy-btn vy-btn--outline vy-btn--icon" aria-label="More actions">
            <VyIcon name="more" size={14} />
          </button>
        </div>
      </section>

      <div className="vy-placeholder-grid">
        {def.blocks.map((b, i) => (
          <section className="vy-card vy-placeholder-block" key={i}>
            <div className="vy-kicker">{b.kicker}</div>
            <div className="vy-placeholder-label">{b.label}</div>
            <div className="vy-placeholder-sub">{b.sub}</div>
          </section>
        ))}
      </div>

      <section className="vy-card vy-placeholder-table">
        <div className="vy-placeholder-table-head">
          <div>
            <div className="vy-kicker">Detail</div>
            <div className="vy-placeholder-table-title">{def.title} workspace placeholder</div>
          </div>
          <button type="button" className="vy-btn vy-btn--ghost">
            <span>Open full view</span>
            <VyIcon name="arrowRight" size={13} />
          </button>
        </div>
        <div className="vy-placeholder-stripes" aria-hidden="true">
          <div /><div /><div /><div /><div />
        </div>
        <div className="vy-placeholder-note">
          <VyIcon name="info" size={13} />
          <span>Designed in this prompt only as a placeholder. Full UI lands in the next prompt for this section.</span>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, {
  ORDER, PAGE_DEFS, PAGE_PLACEHOLDERS, NEEDS, SECTION_MAP_ROWS,
  VyBreadcrumb, VyPageSwitcher, VyOrderHeader, VyBadge, VyKpiRow, VyOrderJourney,
  VySectionMap, VyNeedsAttention, VyOrderHome, VyPagePlaceholder,
});
