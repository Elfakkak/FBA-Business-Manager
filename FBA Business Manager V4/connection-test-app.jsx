// Connection Test dashboard — renders runConnectionTests() results in the app
// shell. Re-run button re-evaluates live (reads current localStorage drafts too).

const { useState: useCtaState } = React;

const CT_TONE = {
  pass: { fg: "success", label: "PASS", dot: "hsl(var(--success))" },
  warn: { fg: "warning", label: "WARN", dot: "hsl(var(--warning))" },
  fail: { fg: "danger", label: "FAIL", dot: "hsl(var(--danger))" },
};
const CT_MATRIX_TONE = {
  linked: { bg: "hsl(var(--success) / 0.14)", fg: "hsl(var(--success))", label: "Linked" },
  partial: { bg: "hsl(var(--warning) / 0.14)", fg: "hsl(var(--warning))", label: "Partial" },
  sample: { bg: "hsl(var(--muted-bg))", fg: "hsl(var(--muted-fg))", label: "Sample" },
  na: { bg: "transparent", fg: "hsl(var(--muted-fg) / 0.5)", label: "—" },
};

function CtCheckRow({ check }) {
  const [open, setOpen] = useCtaState(false);
  const tone = CT_TONE[check.status];
  const hasDetail = check.extra && check.extra.length;
  return (
    <div style={{ borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
      <div
        onClick={() => hasDetail && setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 4px", cursor: hasDetail ? "pointer" : "default" }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: tone.dot, flexShrink: 0 }}></span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{check.name}</span>
        <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))", textAlign: "right", maxWidth: "46ch" }}>{check.detail}</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em", color: "hsl(var(--" + tone.fg + "))", width: 40, textAlign: "right" }}>{tone.label}</span>
        {hasDetail ? <VyIcon name={open ? "chevronDown" : "chevronRight"} size={13} style={{ color: "hsl(var(--muted-fg))" }} /> : <span style={{ width: 13 }}></span>}
      </div>
      {open && hasDetail ? (
        <div style={{ padding: "0 4px 12px 32px", display: "flex", flexDirection: "column", gap: 4 }}>
          {check.extra.map((d, i) => (
            <div key={i} style={{ fontSize: 11.5, fontFamily: "var(--font-mono, monospace)", color: "hsl(var(--muted-fg))", padding: "5px 10px", background: "hsl(var(--background) / 0.5)", border: "1px solid hsl(var(--border))", borderRadius: 6 }}>{d}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ConnectionTestApp() {
  const [sidebarCollapsed, setSidebarCollapsed] = useCtaState(false);
  const [mobileNavOpen, setMobileNavOpen] = useCtaState(false);
  const [isDark, setIsDark] = useCtaState(false);
  const [result, setResult] = useCtaState(() => window.runConnectionTests());
  const [ranAt, setRanAt] = useCtaState(() => new Date());

  React.useEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  function rerun() {
    setResult(window.runConnectionTests());
    setRanAt(new Date());
  }

  const { summary, groups, matrix } = result;
  const allGood = summary.fail === 0;
  const headTone = summary.fail ? "danger" : summary.warn ? "warning" : "success";
  const sources = ["Orders", "Payables", "Logistics", "Catalog"];

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Settings" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => {}} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Header */}
            <div className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 460px", padding: "20px 22px", minWidth: 0 }}>
                  <div className="vy-kicker">Diagnostics</div>
                  <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>Connection test</h1>
                  <p className="vy-page-sub" style={{ margin: "4px 0 0", maxWidth: "60ch" }}>
                    Checks that every dataset is wired together — referential integrity, money &amp; units reconciliation, and which order sections read the shared source of truth. Read-only; run any time.
                  </p>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 10 }}>Last run {ranAt.toLocaleTimeString()}</div>
                </div>
                <div style={{ flex: "1 1 280px", padding: "20px 22px", minWidth: 240, borderLeft: "1px solid hsl(var(--border))", background: "hsl(var(--" + headTone + ") / 0.07)" }}>
                  <div className="vy-kicker" style={{ marginBottom: 6 }}>Result</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(var(--" + headTone + "))" }}>
                    {allGood ? (summary.warn ? "Passed with warnings" : "All connected") : summary.fail + " failed"}
                  </div>
                  <div style={{ display: "flex", gap: 14, margin: "10px 0 14px" }}>
                    <span style={{ fontSize: 12 }}><strong style={{ color: "hsl(var(--success))" }}>{summary.pass}</strong> pass</span>
                    <span style={{ fontSize: 12 }}><strong style={{ color: "hsl(var(--warning))" }}>{summary.warn}</strong> warn</span>
                    <span style={{ fontSize: 12 }}><strong style={{ color: "hsl(var(--danger))" }}>{summary.fail}</strong> fail</span>
                  </div>
                  <button type="button" className="vy-btn vy-btn--primary" onClick={rerun}>
                    <VyIcon name="refresh" size={14} /><span>Run again</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Connection matrix */}
            <div className="vy-card" style={{ padding: "18px 20px" }}>
              <div className="vy-kicker" style={{ marginBottom: 4 }}>Section ↔ source of truth</div>
              <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "0 0 14px" }}>Which order-shell section reads each shared database. <strong style={{ color: "hsl(var(--success))" }}>Linked</strong> = verified live · <strong style={{ color: "hsl(var(--warning))" }}>Partial</strong> = some fields · <strong style={{ color: "hsl(var(--muted-fg))" }}>Sample</strong> = local data.</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-fg))" }}>Section</th>
                      {sources.map((s) => (
                        <th key={s} style={{ textAlign: "center", padding: "8px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-fg))" }}>{s}</th>
                      ))}
                      <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-fg))" }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row) => (
                      <tr key={row.section} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                        <td style={{ padding: "10px", fontSize: 13, fontWeight: 600 }}>{row.section}</td>
                        {sources.map((s) => {
                          const t = CT_MATRIX_TONE[row[s]] || CT_MATRIX_TONE.na;
                          return (
                            <td key={s} style={{ padding: "10px", textAlign: "center" }}>
                              <span style={{ display: "inline-block", minWidth: 58, padding: "3px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: t.bg, color: t.fg }}>{t.label}</span>
                            </td>
                          );
                        })}
                        <td style={{ padding: "10px", fontSize: 11.5, color: "hsl(var(--muted-fg))", maxWidth: 260 }}>{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Check groups */}
            {groups.map((g) => {
              const gf = g.checks.filter((c) => c.status === "fail").length;
              const gw = g.checks.filter((c) => c.status === "warn").length;
              const gtone = gf ? "danger" : gw ? "warning" : "success";
              return (
                <div key={g.name} className="vy-card" style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{g.name}</h3>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: "hsl(var(--" + gtone + "))" }}></span>
                    <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginLeft: "auto" }}>{g.checks.length} checks · click a row for details</span>
                  </div>
                  <div>
                    {g.checks.map((c, i) => <CtCheckRow key={i} check={c} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Settings" />
    </div>
  );
}

const ctRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
ctRoot.render(<ConnectionTestApp />);
