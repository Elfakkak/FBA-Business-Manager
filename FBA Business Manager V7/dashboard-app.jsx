// dashboard-app.jsx — Command home. Pulls the whole business into one glance:
// cash, net, open orders, what needs attention, the orders pipeline, and the
// money snapshot. All derived from the shared data sources (no new data).

const { useState: useDashState, useEffect: useDashEffect, useMemo: useDashMemo } = React;

function dashFmt(n) { return (n < 0 ? "-$" : "$") + Math.abs(Math.round(Number(n) || 0)).toLocaleString(); }

// Tiny inline SVG sparkline for the Net KPI — shows direction at a glance.
function DashSparkline({ data, tone, width = 72, height = 26 }) {
  const vals = (data || []).map((v) => Number(v) || 0);
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const stroke = tone === "warning" ? "hsl(38 92% 45%)" : "hsl(var(--success, 142 71% 45%))";
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * (width - 2) + 1;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = d + " L" + pts[pts.length - 1][0].toFixed(1) + " " + (height - 1) + " L" + pts[0][0].toFixed(1) + " " + (height - 1) + " Z";
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} style={{ flexShrink: 0, overflow: "visible" }} aria-hidden="true">
      <path d={area} fill={stroke} opacity="0.1" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={stroke} />
    </svg>
  );
}

// Weekly digest — a quick "what's happening" recap strip.
function DashDigest({ netMonth, netLabel, units, inTransit, arrivingSoon, reorderNeeded, openOrders }) {
  const items = [
    { label: "Net" + (netLabel ? " · " + netLabel : ""), value: dashFmt(netMonth), tone: netMonth >= 0 ? "success" : "warning" },
    units != null ? { label: "Units sold", value: units.toLocaleString() } : null,
    { label: "In transit", value: String(inTransit) + (arrivingSoon ? " · " + arrivingSoon + " soon" : "") },
    { label: "Open orders", value: String(openOrders) },
    reorderNeeded ? { label: "To reorder", value: String(reorderNeeded), tone: "warning" } : null,
  ].filter(Boolean);
  return (
    <section className="vy-card" style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", marginRight: 16, display: "inline-flex", alignItems: "center", gap: 7 }}><VyIcon name="activity" size={13} />This week</span>
      {items.map((it, i) => (
        <div key={it.label} style={{ display: "flex", flexDirection: "column", padding: "0 18px", borderLeft: i > 0 ? "1px solid hsl(var(--border))" : "none" }}>
          <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{it.label}</span>
          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: it.tone === "success" ? "hsl(var(--success, 142 71% 45%))" : it.tone === "warning" ? "hsl(38 92% 45%)" : "hsl(var(--foreground))" }}>{it.value}</span>
        </div>
      ))}
    </section>
  );
}

function DashboardPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useDashState(false);
  const [mobileNavOpen, setMobileNavOpen] = useDashState(false);
  const [isDark, setIsDark] = useDashState(false);
  useDashEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  const D = useDashMemo(() => (typeof finDerive === "function" ? finDerive() : null), []);
  const orders = useDashMemo(() => (typeof ordAllOrders === "function" ? ordAllOrders() : []), []);
  const pay = (typeof PAY_INVOICES !== "undefined" && PAY_INVOICES) || [];
  const inbox = (typeof finInboxLoad === "function" ? finInboxLoad() : []);
  const invRows = (typeof INV_ROWS !== "undefined" && INV_ROWS) || [];

  const owedToSuppliers = pay.reduce((n, i) => n + (typeof payBalance === "function" ? payBalance(i) : Math.max(0, i.total - i.paid)), 0);
  const openOrders = orders.filter((o) => !/closed/i.test(o.status));
  const months = D ? D.months : [];
  const lastMonth = months.length ? months[months.length - 1] : null;

  // Shipments currently moving (not yet received at the FC).
  const shipments = useDashMemo(() => (typeof logAllShipments === "function" ? logAllShipments() : []), []);
  const inTransit = shipments.filter((s) => {
    const st = (typeof trkStage === "function" ? trkStage(s) : s.stage) || "";
    return !/received|delivered|closed/i.test(st);
  });
  const arrivingSoon = inTransit.filter((s) => /arriv|customs|port/i.test((typeof trkStage === "function" ? trkStage(s) : s.stage) || "")).length;

  // Net trend across recent months (for the sparkline on the Net KPI).
  const netSeries = months.map((m) => m.net);

  // Amazon performance (units + TACoS) and reorder signal for KPIs/digest.
  const amzT = useDashMemo(() => (typeof amzTotals === "function" ? amzTotals() : null), []);
  const reorderPlan = useDashMemo(() => (typeof amzReorderPlan === "function" ? amzReorderPlan(60) : []), []);
  const reorderNeeded = reorderPlan.filter((p) => p.need > 0).length;

  // ---- KPIs ----
  const kpis = [
    { icon: "money", label: "Cash on hand", value: D ? dashFmt(D.cashOnHand) : "—", sub: D ? D.accounts.map((a) => a.name + " " + dashFmt(a.balance)).join(" · ") : "", tone: "info" },
    { icon: "dollar", label: lastMonth ? "Net · " + lastMonth.label : "Company net", value: D ? dashFmt(lastMonth ? lastMonth.net : D.cumNet) : "—", sub: D ? dashFmt(D.cumNet) + " all-time" : "", tone: (lastMonth ? lastMonth.net : (D ? D.cumNet : 0)) >= 0 ? "success" : "warning", spark: netSeries },
    { icon: "cube", label: "Open orders", value: String(openOrders.length), sub: orders.length + " total" },
    { icon: "ship", label: "In transit", value: String(inTransit.length), sub: arrivingSoon ? arrivingSoon + " arriving soon" : "shipments on the water", tone: inTransit.length ? "info" : undefined, href: "Vyonix Shipments.html" },
    { icon: "receipt", label: "Owed to suppliers", value: dashFmt(owedToSuppliers), sub: "open vendor bills", tone: owedToSuppliers > 0 ? "warning" : "success" },
  ];
  if (amzT) {
    kpis.push({ icon: "cube", label: "Units sold", value: amzT.units.toLocaleString(), sub: "all-time · " + Math.round(amzT.tacos * 100) + "% TACoS", tone: "info", href: "Vyonix Performance.html" });
  }
  if (reorderNeeded) {
    kpis.push({ icon: "boxes", label: "To reorder", value: String(reorderNeeded), sub: "products low on cover", tone: "warning", href: "Vyonix Performance.html" });
  }

  // ---- Needs attention (aggregated, ranked) ----
  const needs = [];
  const overdue = pay.filter((i) => (typeof payAging === "function" ? payAging(i).label : "") === "Overdue");
  if (overdue.length) needs.push({ icon: "alert", tone: "danger", title: overdue.length + (overdue.length === 1 ? " overdue bill" : " overdue bills"), detail: dashFmt(overdue.reduce((a, i) => a + payBalance(i), 0)) + " past due", href: "Vyonix Invoices.html" });
  const dueSoon = pay.filter((i) => (typeof payAging === "function" ? payAging(i).label : "") === "Due soon");
  if (dueSoon.length) needs.push({ icon: "calendar", tone: "warning", title: dueSoon.length + (dueSoon.length === 1 ? " bill due soon" : " bills due soon"), detail: "within 7 days", href: "Vyonix Invoices.html" });
  if (inbox.length) needs.push({ icon: "refresh", tone: "info", title: inbox.length + " transactions to review", detail: "categorize synced Amazon & Mercury", href: "Vyonix Finances.html?tab=review" });
  const lowStock = invRows.filter((r) => (typeof invStats === "function" ? invStats(r).health : "") === "Reorder");
  if (lowStock.length) needs.push({ icon: "boxes", tone: "warning", title: lowStock.length + (lowStock.length === 1 ? " SKU needs reordering" : " SKUs need reordering"), detail: "at or below reorder point", href: "Vyonix Inventory.html" });
  const drafts = orders.filter((o) => /draft/i.test(o.status));
  if (drafts.length) needs.push({ icon: "cube", tone: "muted", title: drafts.length + (drafts.length === 1 ? " draft order" : " draft orders"), detail: "not started yet", href: "Vyonix Orders List.html" });
  if (D && D.settle) needs.push({ icon: "user", tone: "info", title: D.settle.fromName + " owes " + D.settle.toName + " " + dashFmt(D.settle.amount), detail: "partner draws out of balance", href: "Vyonix Finances.html" });

  // ---- Orders pipeline by stage ----
  const pipeline = (window.ORD_PIPELINE || []).map((p) => ({
    ...p,
    count: orders.filter((o) => (typeof ordStatusKeyFromLabel === "function" ? ordStatusKeyFromLabel(o.status) : "") === p.key).length,
  }));

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const myName = useDashMemo(() => {
    try { const t = JSON.parse(localStorage.getItem("vy_team_v1") || "[]"); const me = (t || []).find((m) => m.you); return me && me.name ? me.name.split(" ")[0] : "Simo"; } catch (e) { return "Simo"; }
  }, []);
  const [clockTick, setClockTick] = useDashState(Date.now());
  useDashEffect(() => { const t = setInterval(() => setClockTick(Date.now()), 30000); return () => clearInterval(t); }, []);
  const tzTime = (tz) => { try { return new Date(clockTick).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }); } catch (e) { return "—"; } };

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Dashboard" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => {}} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} workspaceName="Command" tabs={[{ key: "home", label: "Dashboard" }]} activeTab="home" />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Headline status bar — the single most urgent thing right now */}
            {typeof notifAll === "function" ? <DashHeadline /> : null}

            {/* Weekly digest — quick "what's happening" recap */}
            <DashDigest
              netMonth={lastMonth ? lastMonth.net : (D ? D.cumNet : 0)}
              netLabel={lastMonth ? lastMonth.label : ""}
              units={amzT ? amzT.units : null}
              inTransit={inTransit.length}
              arrivingSoon={arrivingSoon}
              reorderNeeded={reorderNeeded}
              openOrders={openOrders.length}
            />

            {/* Greeting */}
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">{today}</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>{greet}, {myName}</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0" }}>Where Vyonix stands today — cash, profit, and what needs you.</p>
              </div>
              <div className="vy-page-head-actions" style={{ marginLeft: "auto" }}>
                <a className="vy-btn vy-btn--ghost" href="Vyonix Finances.html"><VyIcon name="money" size={14} /><span>Finances</span></a>
                <a className="vy-btn vy-btn--primary" href="Vyonix Orders List.html"><VyIcon name="cube" size={14} /><span>Orders</span></a>
              </div>
            </div>

            {/* KPI strip */}
            <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              {kpis.map((k) => {
                const inner = (
                  <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <VyIcon name={k.icon} size={14} style={{ opacity: 0.7 }} />
                    <span className="vy-kicker">{k.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
                    <div className="vy-kpi-value" style={{ fontSize: 19 }}>{k.value}</div>
                    {k.spark && k.spark.length > 1 ? <DashSparkline data={k.spark} tone={k.tone} /> : null}
                  </div>
                  <div className="vy-kpi-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.sub}</div>
                  </>
                );
                const cls = "vy-card vy-kpi" + (k.tone ? " vy-kpi--" + k.tone : "");
                return k.href
                  ? <a className={cls} key={k.label} href={k.href} style={{ textDecoration: "none", color: "inherit" }}>{inner}</a>
                  : <div className={cls} key={k.label}>{inner}</div>;
              })}
            </div>

            {/* Upcoming & alerts — derived reorder / production / shipping */}
            {typeof notifAll === "function" ? <DashAlerts /> : null}

            {/* Two columns: needs attention + money snapshot */}
            <div className="dash-two-col">
              <DashNeedsAttention needs={needs} />
              <DashMoneySnapshot D={D} inboxCount={inbox.length} />
            </div>

            {/* Orders pipeline */}
            <DashPipeline pipeline={pipeline} total={orders.length} />
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Dashboard" />
    </div>
  );
}

// ---- Headline status bar (the single most urgent item, color-coded) ----
function DashHeadline() {
  const alerts = (typeof notifAll === "function" ? notifAll() : []);
  const top = alerts[0];
  const tone = !top ? "success" : top.sev;
  const T = {
    danger: { fg: "hsl(0 72% 45%)", bg: "hsl(0 72% 51% / 0.10)", bd: "hsl(0 72% 51% / 0.35)", icon: "alert" },
    warning: { fg: "hsl(32 90% 38%)", bg: "hsl(38 92% 50% / 0.12)", bd: "hsl(38 92% 50% / 0.38)", icon: "alert" },
    info: { fg: "hsl(212 72% 46%)", bg: "hsl(212 72% 55% / 0.10)", bd: "hsl(212 72% 55% / 0.32)", icon: "info" },
    success: { fg: "hsl(150 46% 36%)", bg: "hsl(150 48% 50% / 0.12)", bd: "hsl(150 48% 50% / 0.35)", icon: "check" },
  }[tone];
  const count = alerts.length;
  const body = top
    ? { title: top.title, detail: top.detail, href: top.href, tag: top.type }
    : { title: "All clear", detail: "No urgent reorders, production or shipping alerts right now.", href: null, tag: null };
  const inner = (
    <>
      <span style={{ width: 30, height: 30, borderRadius: 8, flex: "none", display: "grid", placeItems: "center", background: T.bg, color: T.fg }}><VyIcon name={T.icon} size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: T.fg }}>{body.title}</span>
        <span style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", marginLeft: 8 }}>{body.detail}</span>
      </div>
      {top && count > 1 ? <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))", flex: "none" }}>+{count - 1} more</span> : null}
      {body.href ? <VyIcon name="chevronRight" size={16} style={{ color: T.fg, flex: "none" }} /> : null}
    </>
  );
  const style = { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid " + T.bd, background: T.bg, textDecoration: "none", color: "inherit" };
  return body.href
    ? <a href={body.href} style={style}>{inner}</a>
    : <div style={style}>{inner}</div>;
}

// ---- Upcoming & alerts (derived: reorder · production · shipping) ----
const DASH_ALERT_TONE = {
  danger: { fg: "hsl(0 72% 51%)", bg: "hsl(0 72% 51% / 0.12)" },
  warning: { fg: "hsl(38 92% 45%)", bg: "hsl(38 92% 50% / 0.12)" },
  info: { fg: "hsl(212 72% 50%)", bg: "hsl(212 72% 55% / 0.12)" },
};
function DashAlerts() {
  const alerts = (typeof notifAll === "function" ? notifAll() : []).slice(0, 6);
  if (!alerts.length) return null;
  return (
    <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="vy-kicker">Upcoming &amp; alerts <span className="vy-badge vy-badge--primary" style={{ marginLeft: 4 }}>{alerts.length}</span></div>
        <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>reorder · production · shipping</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {alerts.map((a, i) => {
          const tone = DASH_ALERT_TONE[a.sev] || DASH_ALERT_TONE.info;
          return (
            <a key={a.id} href={a.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: i > 0 ? "1px solid hsl(var(--border) / 0.6)" : "0", textDecoration: "none", color: "inherit" }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, flex: "none", display: "grid", placeItems: "center", background: tone.bg, color: tone.fg }}><VyIcon name={a.icon} size={15} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
                <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{a.detail}</div>
              </div>
              <span className="vy-badge" style={{ background: tone.bg, color: tone.fg, fontSize: 9.5, fontWeight: 700, flex: "none" }}>{a.type}</span>
              <VyIcon name="chevronRight" size={15} style={{ color: "hsl(var(--muted-fg))", flex: "none" }} />
            </a>
          );
        })}
      </div>
    </section>
  );
}

// ---- Needs attention ----
const DASH_TONE = {
  danger: { fg: "hsl(0 72% 51%)", bg: "hsl(0 72% 51% / 0.12)" },
  warning: { fg: "hsl(38 92% 45%)", bg: "hsl(38 92% 50% / 0.12)" },
  info: { fg: "hsl(217 91% 55%)", bg: "hsl(217 91% 55% / 0.12)" },
  muted: { fg: "hsl(var(--muted-fg))", bg: "hsl(var(--muted) / 0.55)" },
};
function DashNeedsAttention({ needs }) {
  return (
    <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: needs.length ? "1px solid hsl(var(--border))" : "0" }}>
        <div className="vy-kicker">Needs attention {needs.length ? <span className="vy-badge vy-badge--primary" style={{ marginLeft: 4 }}>{needs.length}</span> : null}</div>
      </div>
      {needs.length === 0 ? (
        <div style={{ padding: "28px 18px", textAlign: "center", color: "hsl(var(--muted-fg))" }}>
          <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 10, background: "hsl(var(--success, 142 71% 45%) / 0.12)", color: "hsl(var(--success, 142 71% 45%))", margin: "0 auto 10px" }}><VyIcon name="check" size={18} /></span>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "hsl(var(--foreground))" }}>All clear</div>
          <div style={{ fontSize: 12, marginTop: 2 }}>No overdue bills, low stock, or pending reviews.</div>
        </div>
      ) : (
        <div>
          {needs.map((n, i) => (
            <a key={i} href={n.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderTop: i > 0 ? "1px solid hsl(var(--border) / 0.6)" : "0", textDecoration: "none", color: "inherit" }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, flex: "none", display: "grid", placeItems: "center", background: (DASH_TONE[n.tone] || DASH_TONE.muted).bg, color: (DASH_TONE[n.tone] || DASH_TONE.muted).fg }}><VyIcon name={n.icon} size={15} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{n.title}</div>
                <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{n.detail}</div>
              </div>
              <VyIcon name="chevronRight" size={15} style={{ color: "hsl(var(--muted-fg))", flex: "none" }} />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- Money snapshot ----
function DashMoneySnapshot({ D, inboxCount }) {
  if (!D) return <section className="vy-card" style={{ padding: 18 }}><div className="vy-kicker">Money</div></section>;
  return (
    <section className="vy-card" style={{ padding: "14px 18px" }}>
      <div className="vy-kicker" style={{ marginBottom: 12 }}>Money snapshot</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {D.accounts.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <VyIcon name={a.kind === "cash" ? "dollar" : "money"} size={14} style={{ opacity: 0.7 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{dashFmt(a.balance)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <DashMini label="Net (all-time)" value={dashFmt(D.cumNet)} tone="success" />
        <DashMini label="Retained" value={dashFmt(D.retained)} />
        <DashMini label="Tax reserve" value={dashFmt(D.taxReserve)} />
        <DashMini label="To review" value={String(inboxCount)} tone={inboxCount ? "info" : undefined} />
      </div>
      {D.settle ? (
        <a href="Vyonix Finances.html" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "hsl(var(--primary) / 0.08)", textDecoration: "none", color: "inherit" }}>
          <VyIcon name="user" size={14} style={{ color: "hsl(var(--primary))" }} />
          <span style={{ fontSize: 12, flex: 1 }}><strong>{D.settle.fromName}</strong> owes <strong>{D.settle.toName}</strong> {dashFmt(D.settle.amount)}</span>
          <VyIcon name="chevronRight" size={14} style={{ color: "hsl(var(--muted-fg))" }} />
        </a>
      ) : (
        <a href="Vyonix Finances.html" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "hsl(var(--success, 142 71% 45%) / 0.08)", textDecoration: "none", color: "inherit" }}>
          <VyIcon name="check" size={14} style={{ color: "hsl(var(--success, 142 71% 45%))" }} />
          <span style={{ fontSize: 12, flex: 1 }}>Partner draws are balanced</span>
          <VyIcon name="chevronRight" size={14} style={{ color: "hsl(var(--muted-fg))" }} />
        </a>
      )}
    </section>
  );
}
function DashMini({ label, value, tone }) {
  const color = tone === "success" ? "hsl(var(--success, 142 71% 45%))" : tone === "info" ? "hsl(var(--info, 217 91% 60%))" : "hsl(var(--foreground))";
  return (
    <div style={{ padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "hsl(var(--muted-fg))", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color, marginTop: 2, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{value}</div>
    </div>
  );
}

// ---- Orders pipeline ----
function DashPipeline({ pipeline, total }) {
  const toneBg = (t) => t === "success" ? "hsl(var(--success, 142 71% 45%))" : t === "warning" ? "hsl(38 92% 50%)" : t === "info" ? "hsl(var(--info, 217 91% 60%))" : "hsl(var(--muted-fg))";
  return (
    <section className="vy-card" style={{ padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="vy-kicker">Orders pipeline</div>
        <a href="Vyonix Orders List.html" style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--primary))", textDecoration: "none" }}>All {total} orders →</a>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        {pipeline.map((p) => (
          <a key={p.key} href="Vyonix Orders List.html" style={{ padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: toneBg(p.tone) }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "hsl(var(--muted-fg))" }}>{p.label}</span>
            </span>
            <span style={{ fontSize: 22, fontWeight: 800 }}>{p.count}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("vy-root")).render(<DashboardPage />);
