// Shared UI primitives for the Order section screens.
// Mirrors src/components/ui (shadcn) + src/components/orders shapes,
// using inline styles bound to CSS variables so we honour the repo's
// semantic tokens: --primary, --success, --warning, --danger, --info,
// --muted, --border, --background, --card, --foreground.

// ---------- ICONS (lucide-style, traced by hand) ----------
const ICON_PATHS = {
  chevronLeft:  <polyline points="15 18 9 12 15 6" />,
  chevronRight: <polyline points="9 18 15 12 9 6" />,
  chevronDown:  <polyline points="6 9 12 15 18 9" />,
  chevronsLeft: <g><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></g>,
  pencil:       <g><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></g>,
  moreVert:     <g><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></g>,
  bell:         <g><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a2 2 0 0 0 3.4 0" /></g>,
  factory:      <g><path d="M2 20V8l5 3V8l5 3V8l5 3v9z" /><path d="M2 20h20" /><rect x="6" y="14" width="2" height="3" /><rect x="11" y="14" width="2" height="3" /><rect x="16" y="14" width="2" height="3" /></g>,
  route:        <g><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11A3.5 3.5 0 0 1 6 5h9" /><circle cx="18" cy="5" r="3" /></g>,
  cal:          <g><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></g>,
  hammer:       <g><path d="m15 12-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9" /><path d="m17.64 15 3.18-3.18a4 4 0 0 0-5.66-5.66l-7.5 7.5" /></g>,
  truck:        <g><path d="M1 17h2V5h13v12h2" /><path d="M21 17V11l-3-3h-2v9" /><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></g>,
  clipboard:    <g><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></g>,
  fileText:     <g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></g>,
  receipt:      <g><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="13" x2="14" y2="13" /></g>,
  externalLink: <g><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></g>,
  check:        <polyline points="20 6 9 17 4 12" />,
  imagePlus:    <g><rect x="2" y="3" width="18" height="14" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m2 16 5-5 5 5 4-4 4 4" /><path d="M22 6h-4 M20 4v4" /></g>,
  upload:       <g><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></g>,
  dollar:       <g><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 1 1 0 7H6" /></g>,
  stamp:        <g><path d="M5 21h14" /><path d="M8 17h8a2 2 0 0 0 2-2v-1H6v1a2 2 0 0 0 2 2z" /><path d="M9 14V8a3 3 0 0 1 6 0v6" /></g>,
  search:       <g><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.65" y2="16.65" /></g>,
  plus:         <g><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></g>,
  arrowRight:   <g><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></g>,
  home:         <g><path d="M3 12 12 3l9 9" /><path d="M5 10v10h14V10" /></g>,
  cube:         <g><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" /><polyline points="3.27 7 12 12 20.73 7" /><line x1="12" y1="22" x2="12" y2="12" /></g>,
  users:        <g><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></g>,
  bank:         <g><polyline points="2 9 12 3 22 9" /><line x1="4" y1="11" x2="4" y2="19" /><line x1="8" y1="11" x2="8" y2="19" /><line x1="12" y1="11" x2="12" y2="19" /><line x1="16" y1="11" x2="16" y2="19" /><line x1="20" y1="11" x2="20" y2="19" /><line x1="2" y1="22" x2="22" y2="22" /></g>,
  chart:        <g><line x1="3" y1="20" x2="21" y2="20" /><polyline points="5 17 9 11 13 14 19 6" /></g>,
  ship:         <g><path d="M2 17a3 3 0 0 0 3 2h14a3 3 0 0 0 3-2" /><path d="M4 17 6 9h12l2 8" /><path d="M9 5h6v4H9z" /><line x1="12" y1="9" x2="12" y2="17" /></g>,
  sliders:      <g><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /><circle cx="8" cy="6" r="2" fill="currentColor" /><circle cx="16" cy="12" r="2" fill="currentColor" /><circle cx="9" cy="18" r="2" fill="currentColor" /></g>,
  activity:     <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  settings:     <g><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></g>,
  zap:          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
};

function Icon({ name, size = 14, strokeWidth = 2, className = "", style = {} }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flex: "none", display: "inline-block", ...style }}
    >
      {ICON_PATHS[name] || ICON_PATHS.moreVert}
    </svg>
  );
}

// ---------- STATUS BADGE (mirrors src/components/ui/status-badge.tsx) ----------
const TONE_VARS = {
  success: ["--success", "--success-bg"],
  warning: ["--warning", "--warning-bg"],
  danger:  ["--danger",  "--danger-bg"],
  info:    ["--info",    "--info-bg"],
  brand:   ["--primary", "--primary-bg"],
  pending: ["--warning", "--warning-bg"],
  stale:   ["--muted-fg", "--muted-bg"],
  muted:   ["--muted-fg", "--muted-bg"],
};

function StatusBadge({ tone = "muted", children, compact = false, icon }) {
  const [fg, bg] = TONE_VARS[tone] || TONE_VARS.muted;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      borderRadius: 6,
      padding: compact ? "1px 6px" : "2px 8px",
      fontSize: compact ? 10 : 11,
      fontWeight: 500,
      lineHeight: 1.4,
      color: `hsl(var(${fg}))`,
      background: `hsl(var(${fg}) / 0.10)`,
      whiteSpace: "nowrap",
    }}>
      {icon && <span style={{ display: "inline-flex" }}>{icon}</span>}
      {children}
    </span>
  );
}

// ---------- CARD (mirrors src/components/ui/card.tsx — option-a-panel) ----------
function Card({ children, style = {}, className = "" }) {
  return (
    <div className={"v-card " + className} style={style}>{children}</div>
  );
}

// ---------- PILL (the rounded-full border + bg-background variant) ----------
function Pill({ children, mono = false, style = {} }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      border: "0.5px solid hsl(var(--border))",
      background: "hsl(var(--background))",
      borderRadius: 999,
      padding: "2px 8px",
      fontSize: 11,
      lineHeight: 1.4,
      color: "hsl(var(--muted-fg))",
      fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit",
      ...style,
    }}>{children}</span>
  );
}

// ---------- BUTTON (mirrors shadcn variants) ----------
function Button({ variant = "default", size = "default", children, icon, disabled, style = {}, ...rest }) {
  const sizes = {
    default: { padding: "6px 12px", fontSize: 13, height: 32 },
    sm:      { padding: "4px 10px", fontSize: 12, height: 28 },
    icon:    { padding: 0, width: 28, height: 28, display: "inline-grid", placeItems: "center" },
  };
  const variants = {
    default: { background: "hsl(var(--primary))", color: "hsl(var(--primary-fg))", border: "0.5px solid hsl(var(--primary))" },
    outline: { background: "hsl(var(--background))", color: "hsl(var(--foreground))", border: "0.5px solid hsl(var(--border))" },
    ghost:   { background: "transparent", color: "hsl(var(--foreground))", border: "0.5px solid transparent" },
    success: { background: "hsl(var(--success))", color: "white", border: "0.5px solid hsl(var(--success))" },
  };
  return (
    <button
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        borderRadius: 8,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
        lineHeight: 1,
        transition: "all 120ms ease",
        ...sizes[size], ...variants[variant], ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  );
}

// ---------- KICKER (10px uppercase tracked label) ----------
function Kicker({ children, style = {} }) {
  return <div style={{
    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: 0.6, color: "hsl(var(--muted-fg))", ...style,
  }}>{children}</div>;
}

// ============================================================
// SIDEBAR (compressed app shell context — collapsed icon rail)
// ============================================================
function Sidebar() {
  const items = [
    { icon: "home",     label: "Dashboard" },
    { icon: "cube",     label: "Orders", active: true },
    { icon: "factory",  label: "Suppliers" },
    { icon: "users",    label: "Partners" },
    { icon: "receipt",  label: "Invoices" },
    { icon: "bank",     label: "Cash flow" },
    { icon: "ship",     label: "Shipments" },
    { icon: "chart",    label: "Inventory" },
    { icon: "activity", label: "Integrations" },
    { icon: "settings", label: "Settings" },
  ];
  return (
    <aside style={{
      width: 84, flex: "none",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "16px 10px",
      borderRight: "0.5px solid hsl(var(--border))",
      background: "hsl(var(--card))",
    }}>
      <div style={{
        width: 40, height: 40,
        borderRadius: 12,
        background: "hsl(var(--foreground))",
        color: "hsl(var(--background))",
        display: "grid", placeItems: "center",
        fontSize: 18, fontWeight: 900,
        marginBottom: 14,
      }}>V</div>

      <button style={{
        width: 56, height: 32,
        border: "0.5px solid hsl(var(--border))",
        borderRadius: 8,
        background: "hsl(var(--background))",
        display: "grid", placeItems: "center",
        marginBottom: 14, cursor: "pointer",
      }} aria-label="Quick create">
        <Icon name="plus" size={14} />
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", alignItems: "center" }}>
        {items.map(it => (
          <div key={it.label} title={it.label}
            style={{
              width: 56, height: 44,
              display: "grid", placeItems: "center",
              borderRadius: 8,
              background: it.active ? "hsl(var(--primary) / 0.10)" : "transparent",
              color: it.active ? "hsl(var(--primary))" : "hsl(var(--muted-fg))",
              border: it.active ? "0.5px solid hsl(var(--primary) / 0.25)" : "0.5px solid transparent",
              cursor: "pointer",
            }}>
            <Icon name={it.icon} size={17} />
          </div>
        ))}
      </div>
    </aside>
  );
}

// ============================================================
// BREADCRUMB (used by Inspection + Payments)
// ============================================================
function Breadcrumb({ trail }) {
  return (
    <nav aria-label="Breadcrumb" style={{
      display: "flex", alignItems: "center", gap: 4,
      fontSize: 12, color: "hsl(var(--muted-fg))",
    }}>
      {trail.map((t, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Icon name="chevronRight" size={12} />}
          <span style={{
            fontFamily: t.mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit",
            color: t.current ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            {t.back && <Icon name="chevronLeft" size={12} />}
            {t.label}
          </span>
        </React.Fragment>
      ))}
    </nav>
  );
}

// ============================================================
// ORDER FULL SPINE — Home page header
// Mirrors src/components/orders/order-full-spine.tsx
// POST-CUT: notification bell badge is gone (icon hidden entirely).
// ============================================================
function OrderFullSpine({ order, milestones, kpis, showBellBadge = false }) {
  const milestoneTone = {
    done:       { bg: "hsl(var(--success) / 0.10)", fg: "hsl(var(--success))",   bd: "hsl(var(--success) / 0.30)", dashed: false },
    in_flight:  { bg: "hsl(var(--warning) / 0.10)", fg: "hsl(var(--warning))",   bd: "hsl(var(--warning) / 0.40)", dashed: false },
    estimated:  { bg: "hsl(var(--muted-bg))",       fg: "hsl(var(--muted-fg))",  bd: "hsl(var(--border))",         dashed: false },
    blocked:    { bg: "hsl(var(--muted-bg))",       fg: "hsl(var(--muted-fg))",  bd: "hsl(var(--border))",         dashed: true },
  };

  return (
    <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Title row */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{
              margin: 0, fontSize: 20, fontWeight: 500,
              letterSpacing: -0.2, color: "hsl(var(--foreground))",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}>{order.formatted}</h1>
            <StatusBadge tone={order.statusTone}>{order.statusLabel}</StatusBadge>
            {/* POST-CUT: bell badge intentionally NOT rendered. The icon can stay
                elsewhere; per brief, no count badge ever appears in the spine. */}
            {showBellBadge && order.notificationCount > 0 ? (
              <Pill>
                <Icon name="bell" size={11} />{order.notificationCount}
              </Pill>
            ) : null}
          </div>

          <p style={{ margin: 0, fontSize: 12, color: "hsl(var(--muted-fg))" }}>
            {order.supplier.name} · Direct from{" "}
            <span style={{ color: "hsl(var(--foreground))" }}>{order.supplier.name}</span>
            {order.placedAt ? ` · placed ${order.placedAt}` : ""}
            {order.totalUnits ? ` · ${order.totalUnits.toLocaleString()} pcs` : ""}
            {order.totalSkus ? ` · ${order.totalSkus} SKU` : ""}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
            <Pill><Icon name="factory" size={11} />{order.supplier.name} · {order.supplier.country}</Pill>
            <Pill><Icon name="route" size={11} />Direct supplier</Pill>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <Button variant="outline" size="sm" icon="pencil">Edit</Button>
          <Button variant="outline" size="icon" aria-label="Order actions">
            <Icon name="moreVert" size={14} />
          </Button>
        </div>
      </div>

      {/* Milestone strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {Object.entries(milestones).map(([k, m]) => {
          const t = milestoneTone[m.state];
          return (
            <div key={k} style={{
              borderRadius: 6,
              border: `0.5px ${t.dashed ? "dashed" : "solid"} ${t.bd}`,
              background: t.bg,
              color: t.fg,
              padding: "8px 12px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {m.label}
              </div>
              <div style={{ fontSize: 11, marginTop: 2 }}>
                {m.state === "done"      ? `✓ ${m.date}` :
                 m.state === "in_flight" ? `In flight · ${m.date}` :
                 m.state === "blocked"   ? "Awaiting deposit" : `est ${m.date}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* KPI row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        borderTop: "0.5px solid hsl(var(--border))", paddingTop: 12,
      }}>
        <SpineKpi label="Order total" value={`$${kpis.orderTotalUsd.toLocaleString(undefined, {minimumFractionDigits:2})}`} />
        <SpineKpi label="Paid"
          value={`$${kpis.paidUsd.toLocaleString(undefined, {minimumFractionDigits:2})}`}
          sublabel={`${Math.round(kpis.paidPct * 100)}%`} accent="success" />
        <SpineKpi label="Next due"
          value={`$${kpis.nextDueAmountUsd.toLocaleString(undefined, {minimumFractionDigits:2})}`}
          sublabel={kpis.nextDueDate} accent="warning" />
        <SpineKpi label="FBA arrival" value={kpis.fbaArrivalEta} />
      </div>
    </Card>
  );
}

function SpineKpi({ label, value, sublabel, accent }) {
  const color = accent === "success" ? "hsl(var(--success))" :
                accent === "warning" ? "hsl(var(--warning))" :
                "hsl(var(--foreground))";
  return (
    <div>
      <Kicker>{label}</Kicker>
      <div style={{
        fontSize: 14, fontWeight: 600, marginTop: 2,
        color, fontVariantNumeric: "tabular-nums",
      }}>{value}</div>
      {sublabel ? <div style={{ fontSize: 10, color: "hsl(var(--muted-fg))" }}>{sublabel}</div> : null}
    </div>
  );
}

// ============================================================
// ORDER SUB-SPINE — Inspection + Payments page header (slimmer)
// Mirrors src/components/orders/order-sub-spine.tsx
// ============================================================
function OrderSubSpine({ order, kpis }) {
  // For the sub-spine we recompute D1/D14/D25/D30 with simple states.
  const milestones = [
    { label: "D1 · Materials ordered", date: "May 6, 2026",  state: "done" },
    { label: "D14 · WIP photos",       date: "May 19, 2026", state: "due"  },
    { label: "D25 · Pre-shipment",     date: "May 30, 2026", state: "future" },
    { label: "D30 · Ready to ship",    date: "Jun 4, 2026",  state: "future" },
  ];
  const tone = {
    future:   { bg: "hsl(var(--background))", fg: "hsl(var(--foreground))", bd: "hsl(var(--border))",          dashed: false },
    due:      { bg: "hsl(var(--warning) / 0.10)", fg: "hsl(var(--warning))", bd: "hsl(var(--warning))",        dashed: false },
    overdue:  { bg: "hsl(var(--danger) / 0.10)",  fg: "hsl(var(--danger))",  bd: "hsl(var(--danger))",         dashed: false },
    "pending-anchor": { bg: "hsl(var(--muted-bg))", fg: "hsl(var(--muted-fg))", bd: "hsl(var(--border))",      dashed: true },
    done:     { bg: "hsl(var(--success) / 0.10)", fg: "hsl(var(--success))", bd: "hsl(var(--success) / 0.30)", dashed: false },
  };
  const remaining = kpis.orderTotalUsd - kpis.paidUsd;
  return (
    <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12, color: "hsl(var(--muted-fg))",
          }}>{order.formatted}</div>
          <h1 style={{
            margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.2,
            color: "hsl(var(--foreground))",
          }}>
            Direct from <span>{order.supplier.name}</span>
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
            <Pill><Icon name="factory" size={11} />{order.supplier.name}</Pill>
            <Pill><Icon name="cal" size={11} />{order.orderDate}</Pill>
          </div>
        </div>
        <StatusBadge tone={order.statusTone}>{order.statusLabel}</StatusBadge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {milestones.map(m => {
          const t = tone[m.state];
          return (
            <div key={m.label} style={{
              borderRadius: 6,
              border: `0.5px ${t.dashed ? "dashed" : "solid"} ${t.bd}`,
              background: t.bg, color: t.fg,
              padding: "8px 12px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{m.label}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>{m.date}</div>
            </div>
          );
        })}
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
        borderTop: "0.5px solid hsl(var(--border))", paddingTop: 12,
      }}>
        <SpineKpi label="Order total" value={`$${kpis.orderTotalUsd.toLocaleString(undefined, {minimumFractionDigits:2})}`} />
        <SpineKpi label="Paid"       value={`$${kpis.paidUsd.toLocaleString(undefined, {minimumFractionDigits:2})}`} />
        <SpineKpi label="Remaining"  value={`$${remaining.toLocaleString(undefined, {minimumFractionDigits:2})}`} />
      </div>
    </Card>
  );
}

// ============================================================
// SECTION SWITCHER (extended pill row) — DO NOT TOUCH per brief.
// Mirrors src/components/orders/section-switcher.tsx
// ============================================================
function SectionSwitcher({ active }) {
  const left  = [["production","Production"], ["shipping","Shipping"], ["inspection","Inspection"]];
  const right = [["documents","Documents"],   ["payments","Payments"]];

  const pillCls = (key) => {
    const isActive = key === active;
    return {
      borderRadius: 6, padding: "4px 12px", fontSize: 13,
      border: "0.5px solid transparent",
      ...(isActive ? {
        background: "hsl(var(--background))",
        border: "0.5px solid hsl(var(--border))",
        color: "hsl(var(--foreground))", fontWeight: 500,
        boxShadow: "0 1px 2px hsl(var(--foreground) / 0.05)",
      } : {
        background: "transparent", color: "hsl(var(--muted-fg))", fontWeight: 400,
        cursor: "pointer",
      }),
    };
  };

  return (
    <nav aria-label="Order section switcher" style={{
      display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 4,
      borderRadius: 8, border: "0.5px solid hsl(var(--border))",
      background: "hsl(var(--card))",
      padding: 4,
    }}>
      {left.map(([k, l]) => <span key={k} style={pillCls(k)} aria-current={k === active ? "page" : undefined}>{l}</span>)}
      <span aria-hidden="true" style={{ margin: "0 4px", height: 20, width: "0.5px", background: "hsl(var(--border))" }} />
      {right.map(([k, l]) => <span key={k} style={pillCls(k)} aria-current={k === active ? "page" : undefined}>{l}</span>)}
    </nav>
  );
}

// ============================================================
// SECTION SUMMARY CARD (used on Home for Production/Shipping/Inspection)
// Mirrors src/components/orders/section-summary-card.tsx
// ============================================================
function SectionSummaryCard({ routeKey, label, summary }) {
  const iconByKey = { production: "hammer", shipping: "truck", inspection: "clipboard" };
  const tintByKey = {
    production: { bg: "hsl(var(--primary) / 0.10)", fg: "hsl(var(--primary))" },
    shipping:   { bg: "hsl(var(--info) / 0.10)",    fg: "hsl(var(--info))" },
    inspection: { bg: "hsl(var(--success) / 0.10)", fg: "hsl(var(--success))" },
  };
  const tint = tintByKey[routeKey];

  return (
    <Card style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{
        width: 38, height: 38, flex: "none",
        borderRadius: 8,
        background: tint.bg, color: tint.fg,
        display: "grid", placeItems: "center",
      }}>
        <Icon name={iconByKey[routeKey]} size={20} />
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
          <StatusBadge tone={summary.statusPill.tone} compact>{summary.statusPill.text}</StatusBadge>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "hsl(var(--muted-fg))" }}>{summary.contextLine}</p>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {summary.headlineNumberUsd > 0 ? `$${summary.headlineNumberUsd.toLocaleString(undefined, {minimumFractionDigits:2})}` : "—"}
        </div>
        <div style={{ fontSize: 10, color: "hsl(var(--muted-fg))" }}>{summary.sublabel}</div>
      </div>
      <Icon name="chevronRight" size={16} style={{ color: "hsl(var(--muted-fg))" }} />
    </Card>
  );
}

// ============================================================
// CENTRALIZED SHORTCUT CARD (Documents + Payments shortcuts on Home)
// ============================================================
function CentralizedShortcut({ icon, label, line, rightValue, rightSublabel }) {
  return (
    <Card style={{ padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{
        width: 36, height: 36, flex: "none",
        borderRadius: 6,
        background: "hsl(var(--muted-bg))", color: "hsl(var(--foreground))",
        display: "grid", placeItems: "center",
      }}>
        <Icon name={icon} size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>{line}</div>
      </div>
      {rightValue ? (
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{rightValue}</div>
          {rightSublabel ? <div style={{ fontSize: 10, color: "hsl(var(--muted-fg))" }}>{rightSublabel}</div> : null}
        </div>
      ) : null}
    </Card>
  );
}

// ============================================================
// ACTIVITY DRAWER (right-hand sticky column) — KEEP UNCHANGED
// Compact static rendering of activity feed.
// ============================================================
function ActivityDrawer({ scope = "all", feed, count = 6 }) {
  const filterChips = ["All", "Pay", "Inv", "Insp", "Doc", "Notes"];
  const scopeLabel = ({
    all: "Activity",
    production: "Production activity",
    shipping: "Shipping activity",
    inspection: "Inspection activity",
  })[scope];

  return (
    <aside style={{
      width: 280, flex: "none",
      alignSelf: "flex-start",
      display: "flex", flexDirection: "column",
      borderRadius: 8,
      border: "0.5px solid hsl(var(--border))",
      background: "hsl(var(--card))",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", borderBottom: "0.5px solid hsl(var(--border))",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
          <Icon name="activity" size={13} style={{ color: "hsl(var(--primary))" }} />
          {scopeLabel} · {count}
        </div>
        <Icon name="chevronRight" size={13} style={{ color: "hsl(var(--muted-fg))" }} />
      </div>

      <div style={{
        display: "flex", flexWrap: "wrap", gap: 4,
        padding: "8px 12px", borderBottom: "0.5px solid hsl(var(--border))",
      }}>
        {filterChips.map((c, i) => (
          <span key={c} style={{
            borderRadius: 999,
            border: i === 0 ? "0.5px solid hsl(var(--primary))" : "0.5px solid hsl(var(--border))",
            background: i === 0 ? "hsl(var(--primary))" : "hsl(var(--background))",
            color: i === 0 ? "hsl(var(--primary-fg))" : "hsl(var(--muted-fg))",
            padding: "1px 8px",
            fontSize: 10, fontWeight: 500,
          }}>{c}</span>
        ))}
      </div>

      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        {feed.map(group => (
          <div key={group.day} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Kicker>{group.day}</Kicker>
            {group.items.map((it, i) => (
              <a key={i} href="#" onClick={e => e.preventDefault()} style={{
                position: "relative",
                display: "block",
                borderRadius: 6,
                border: "0.5px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                padding: 8,
                textDecoration: "none", color: "inherit",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{
                    width: 18, height: 18, flex: "none",
                    background: "hsl(var(--muted-bg))",
                    borderRadius: 4, display: "grid", placeItems: "center",
                    color: "hsl(var(--muted-fg))", marginTop: 2,
                  }}>
                    <Icon name={it.icon} size={11} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</div>
                    <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "hsl(var(--muted-fg))" }}>
                      <span style={{
                        background: "hsl(var(--muted-bg))",
                        padding: "1px 4px", borderRadius: 3,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        textTransform: "uppercase",
                      }}>{it.src}</span>
                      <span>·</span><span>{it.time}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 12px", borderTop: "0.5px solid hsl(var(--border))" }}>
        <a href="#" onClick={e => e.preventDefault()} style={{
          fontSize: 11, fontWeight: 500, color: "hsl(var(--info))", textDecoration: "none",
        }}>See full journal →</a>
      </div>
    </aside>
  );
}

// ============================================================
// PI HEADER ROW (inside the per-PI grouping block, payments page)
// Mirrors PisBlock card header
// ============================================================
function PiHeader({ inv }) {
  return (
    <div style={{
      borderBottom: "0.5px solid hsl(var(--border))",
      padding: 12,
      display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
      transition: "background 120ms ease",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontSize: 13 }}>
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600 }}>
            {inv.invoiceRef}
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center",
            background: "hsl(var(--primary) / 0.10)", color: "hsl(var(--primary))",
            padding: "1px 6px", borderRadius: 4,
            fontSize: 10, fontWeight: 500,
          }}>{inv.vendorTypeLabel}</span>
          <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>{inv.vendorName}</span>
        </div>
        <div style={{ marginTop: 2, fontSize: 11, color: "hsl(var(--muted-fg))" }}>
          Issued {inv.invoiceDate} · Due {inv.dueDate} · Covers {inv.coversOrderLineIds.length} product + {inv.coversChargeIds.length} service line
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {inv.currency} {inv.amount.toLocaleString(undefined, {minimumFractionDigits:2})}
          </div>
          <div style={{ fontSize: 10, color: "hsl(var(--muted-fg))" }}>{inv.pctPaid}% paid</div>
        </div>
        <StatusBadge tone={inv.statusTone} compact>{inv.status}</StatusBadge>
        <Icon name="arrowRight" size={12} style={{ color: "hsl(var(--muted-fg))" }} />
      </div>
    </div>
  );
}

// ============================================================
// TRANSIT CADENCE INDICATOR — DO NOT TOUCH per brief.
// 4-stage payment transit tracker (or 2-stage for supplier variant).
// Includes 24-business-hour prompt cadence indicators.
// Mirrors src/components/orders/transit-cadence-indicator.tsx
// ============================================================
function TransitCadenceIndicator({ payment }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 8 }}>
        {payment.cadence.stages.map(stage => {
          const isFilled = stage.state === "filled";
          const isPending = stage.state === "pending";
          const showCountdown = isPending && stage.countdown;
          const showCta = isPending && !stage.countdown;
          return (
            <div key={stage.key} style={{
              display: "flex", alignItems: "flex-start", gap: 6,
              borderRadius: 6, border: "0.5px solid hsl(var(--border))",
              padding: "6px 8px",
              minWidth: 0,
            }}>
              <span style={{
                width: 12, height: 12, marginTop: 2,
                borderRadius: 999,
                display: "inline-grid", placeItems: "center",
                border: isFilled ? "0.5px solid hsl(var(--success))" :
                        (showCta ? "0.5px solid hsl(var(--warning))" :
                                   "0.5px solid hsl(var(--muted-fg) / 0.4)"),
                background: isFilled ? "hsl(var(--success))" :
                            (showCta ? "hsl(var(--warning) / 0.10)" :
                                       "hsl(var(--background))"),
                color: "white",
              }}>
                {isFilled ? <Icon name="check" size={8} /> : null}
              </span>
              <div style={{ minWidth: 0, fontSize: 10, lineHeight: 1.3 }}>
                <div style={{
                  fontWeight: 500,
                  color: isFilled || isPending ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))",
                }}>{stage.label}</div>
                {isFilled && stage.ts ? (
                  <div style={{ color: "hsl(var(--muted-fg))" }}>{stage.ts}</div>
                ) : showCountdown ? (
                  <div style={{ color: "hsl(var(--muted-fg))" }}>{stage.countdown}</div>
                ) : showCta ? (
                  <span style={{
                    color: "hsl(var(--warning))", fontWeight: 500,
                    cursor: "pointer", textDecoration: "underline",
                    textDecorationStyle: "dotted", textUnderlineOffset: 3,
                  }}>Confirm now?</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {payment.cadence.productionAnchored ? (
        <div style={{ fontSize: 10, color: "hsl(var(--success))" }}>
          Production clock D1 anchored on {payment.cadence.productionAnchored}
        </div>
      ) : null}
    </div>
  );
}

// Expose to other scripts
Object.assign(window, {
  Icon, StatusBadge, Card, Pill, Button, Kicker,
  Sidebar, Breadcrumb,
  OrderFullSpine, OrderSubSpine, SectionSwitcher,
  SectionSummaryCard, CentralizedShortcut,
  ActivityDrawer, PiHeader, TransitCadenceIndicator,
});
