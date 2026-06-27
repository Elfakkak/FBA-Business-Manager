// reorder-app.jsx — Product performance & reorder planner (Vyonix Reorder.html).
// Joins the Amazon sales feed (units sold + profit per product, via amazon-
// source) with live FBA stock (catalog) to answer: which products win, and how
// many units of each to reorder before they run out. Reads amzProductPerf /
// amzReorderPlan / amzConnected, catFamilyStats, VyIcon.

const { useState: useRoState, useEffect: useRoEffect, useMemo: useRoMemo } = React;
const roMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
function roFmt(n) { const s = n < 0 ? "-" : ""; return s + "$" + Math.abs(Math.round(Number(n) || 0)).toLocaleString(); }

const RO_URGENCY = {
  now:  { tone: "danger",  label: "Reorder now",  bg: "hsl(0 72% 51% / 0.12)", fg: "hsl(0 72% 51%)" },
  soon: { tone: "warning", label: "Reorder soon", bg: "hsl(38 92% 50% / 0.12)", fg: "hsl(38 92% 45%)" },
  ok:   { tone: "success", label: "Healthy",      bg: "hsl(142 71% 45% / 0.12)", fg: "hsl(142 71% 38%)" },
};

function ReorderPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useRoState(false);
  const [mobileNavOpen, setMobileNavOpen] = useRoState(false);
  const [isDark, setIsDark] = useRoState(false);
  const [coverDays, setCoverDays] = useRoState(60);
  useRoEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  const connected = (typeof amzConnected === "function") ? amzConnected() : false;
  const plan = useRoMemo(() => (typeof amzReorderPlan === "function" ? amzReorderPlan(coverDays) : []), [coverDays]);
  const months = (typeof amzMonthsCount === "function") ? amzMonthsCount() : 1;

  const totalUnits = plan.reduce((n, p) => n + p.unitsSold, 0);
  const totalProfit = plan.reduce((n, p) => n + p.netProfit, 0);
  const reorderCount = plan.filter((p) => p.need > 0).length;
  const urgentCount = plan.filter((p) => p.urgency === "now").length;
  const best = plan.slice().sort((a, b) => b.netProfit - a.netProfit)[0];

  const kpis = [
    { icon: "cube", label: "Units sold", value: totalUnits.toLocaleString(), sub: "across " + months + " month" + (months === 1 ? "" : "s") },
    { icon: "dollar", label: "Net profit", value: roFmt(totalProfit), sub: "from product sales", tone: "success" },
    { icon: "boxes", label: "To reorder", value: String(reorderCount), sub: urgentCount ? urgentCount + " urgent" : "all healthy", tone: urgentCount ? "warning" : "success" },
    { icon: "package", label: "Best seller", value: best ? roFmt(best.netProfit) : "—", sub: best ? best.name.slice(0, 22) : "", tone: "info" },
  ];

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Performance" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => {}} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} workspaceName="Catalog" tabs={[{ key: "perf", label: "Performance" }]} activeTab="perf" />
        <main className="vy-content">
          <div className="vy-content-inner">
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Catalog</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>Product performance &amp; reorder</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0", maxWidth: "64ch" }}>Which products sell and earn — and how many units to reorder before they run out. Sales come from Amazon; stock and lead times from your catalog.</p>
              </div>
            </div>

            {/* provenance */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "-4px 2px 0" }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: connected ? "hsl(var(--success, 142 71% 45%))" : "hsl(38 92% 50%)" }} />
              {connected ? "Live units from Amazon Seller Central" : "Sample sales — wires to Amazon SP-API when connected"}
            </div>

            <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              {kpis.map((k) => (
                <div className={"vy-card vy-kpi" + (k.tone ? " vy-kpi--" + k.tone : "")} key={k.label}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><VyIcon name={k.icon} size={14} style={{ opacity: 0.7 }} /><span className="vy-kicker">{k.label}</span></div>
                  <div className="vy-kpi-value" style={{ fontSize: 19 }}>{k.value}</div>
                  <div className="vy-kpi-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* cover-days control */}
            <section className="vy-card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Target days of cover</div>
                <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>Reorder quantities aim to keep this many days of stock (after lead time).</div>
              </div>
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                {[30, 45, 60, 90].map((d) => {
                  const on = coverDays === d;
                  return <button key={d} type="button" onClick={() => setCoverDays(d)} style={{ padding: "7px 13px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? "hsl(var(--primary))" : "hsl(var(--border))"), background: on ? "hsl(var(--primary))" : "hsl(var(--background))", color: on ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" }}>{d}d</button>;
                })}
              </div>
            </section>

            {/* table */}
            <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                      {["Product", "Units sold", "Net profit", "Margin", "/mo", "On hand", "Days left", "Reorder", ""].map((h, i) => (
                        <th key={i} style={{ padding: "11px 12px", textAlign: i === 0 ? "left" : i === 8 ? "center" : "right", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.map((p) => {
                      const u = RO_URGENCY[p.urgency] || RO_URGENCY.ok;
                      const daysLeft = isFinite(p.daysLeft) ? Math.round(p.daysLeft) : "∞";
                      return (
                        <tr key={p.familyId} style={{ borderTop: "1px solid hsl(var(--border) / 0.6)" }}>
                          <td style={{ padding: "12px", fontSize: 13, fontWeight: 600, maxWidth: 230 }}>
                            <a href={"Vyonix Product.html?family=" + encodeURIComponent(p.familyId)} className="vy-row-title" style={{ color: "inherit", textDecoration: "none" }}>{p.name}</a>
                          </td>
                          <td style={{ padding: "12px", textAlign: "right", ...roMono, fontSize: 12.5 }}>{p.unitsSold.toLocaleString()}</td>
                          <td style={{ padding: "12px", textAlign: "right", ...roMono, fontSize: 13, fontWeight: 700, color: "hsl(142 71% 38%)" }}>{roFmt(p.netProfit)}</td>
                          <td style={{ padding: "12px", textAlign: "right", ...roMono, fontSize: 12, color: "hsl(var(--muted-fg))" }}>{Math.round(p.margin * 100)}%</td>
                          <td style={{ padding: "12px", textAlign: "right", ...roMono, fontSize: 12, color: "hsl(var(--muted-fg))" }}>{p.avgUnitsMonth}</td>
                          <td style={{ padding: "12px", textAlign: "right", ...roMono, fontSize: 12.5 }}>{p.onHand.toLocaleString()}{p.inbound ? <span style={{ color: "hsl(var(--muted-fg))", fontSize: 10.5 }}> +{p.inbound}</span> : null}</td>
                          <td style={{ padding: "12px", textAlign: "right", ...roMono, fontSize: 12.5, color: u.fg, fontWeight: 600 }}>{daysLeft}{daysLeft !== "∞" ? "d" : ""}</td>
                          <td style={{ padding: "12px", textAlign: "right", ...roMono, fontSize: 13, fontWeight: 800 }}>{p.need > 0 ? p.need.toLocaleString() : "—"}</td>
                          <td style={{ padding: "12px", textAlign: "center" }}>
                            <span className="vy-badge" style={{ background: u.bg, color: u.fg, fontSize: 9.5, fontWeight: 700 }}>{u.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "11px 16px", fontSize: 11, color: "hsl(var(--muted-fg))", borderTop: "1px solid hsl(var(--border))", lineHeight: 1.5 }}>
                Reorder qty = daily velocity × (lead time + {coverDays}d cover) − (on hand + inbound), rounded up to MOQ. "Days left" is current stock ÷ velocity; <strong style={{ color: "hsl(0 72% 51%)" }}>Reorder now</strong> means stock runs out before a fresh order could arrive.
              </div>
            </section>
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Performance" />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("vy-root")).render(<ReorderPage />);
