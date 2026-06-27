// integration-app.jsx — detail page for ONE integration (Settings → click a
// connection). Route: Vyonix Integration.html?id=amazon. Shows connection
// status, the distinct DATA STREAMS it syncs (each mapped to its SP-API/source
// endpoint + where it flows in the app), and a sync log. Reads integrations-data.

const { useState: useIgState, useEffect: useIgEffect } = React;
const igMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };

// Per-integration data streams (what it pulls) + where each feeds in the app.
const IG_STREAMS = {
  amazon: [
    { name: "Sales & units", api: "Sales & Traffic report", feeds: "P&L · Performance", detail: "Units sold + gross sales per SKU/day" },
    { name: "Fees & settlements", api: "Finances API · listFinancialEvents", feeds: "Finance · P&L", detail: "Referral, FBA, ads, refunds, payouts" },
    { name: "FBA inventory", api: "FBA Inventory API", feeds: "Inventory · Reorder", detail: "On-hand, reserved, inbound, velocity" },
    { name: "Orders", api: "Orders API", feeds: "Orders", detail: "Customer orders + fulfillment status" },
  ],
  mercury: [
    { name: "Balances", api: "Mercury API · accounts", feeds: "Finance · Dashboard", detail: "Cleared balance per account" },
    { name: "Transactions", api: "Mercury API · transactions", feeds: "Finance · Review", detail: "Money in/out for categorization" },
    { name: "FX rates", api: "Mercury API · rates", feeds: "Finance", detail: "USD↔RMB reference rate" },
  ],
  track17: [
    { name: "Tracking events", api: "17TRACK API · register/track", feeds: "Shipments", detail: "Container/parcel milestones + status" },
  ],
  forwarder: [
    { name: "Shipment milestones", api: "EDI 315 / 214", feeds: "Shipments", detail: "Booked, departed, arrived, customs" },
  ],
  quickbooks: [
    { name: "Bills & COGS", api: "QBO API · bills", feeds: "Finance", detail: "Supplier bills + landed cost" },
    { name: "Partner draws", api: "QBO API · journal", feeds: "Finance · Partnership", detail: "Owner distributions" },
  ],
  fx: [
    { name: "USD↔RMB rate", api: "Wise API · rates", feeds: "Finance · P&L", detail: "Live rate for supplier costs" },
  ],
  amazonads: [
    { name: "Ad spend", api: "Amazon Ads API · reports", feeds: "P&L · Performance", detail: "Sponsored Products/Brands daily spend per campaign/SKU" },
    { name: "ACoS / TACoS", api: "Amazon Ads API · reports", feeds: "P&L · Performance", detail: "Ad cost of sales — total & per product" },
    { name: "Campaign performance", api: "Amazon Ads API · campaigns", feeds: "Performance", detail: "Impressions, clicks, conversions, spend" },
  ],
  sheets: [
    { name: "Scheduled export", api: "Google Sheets API", feeds: "(outbound)", detail: "Orders, invoices, inventory pushed out" },
  ],
};

function IntegrationPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useIgState(false);
  const [mobileNavOpen, setMobileNavOpen] = useIgState(false);
  const [isDark, setIsDark] = useIgState(false);
  const [tick, setTick] = useIgState(0);
  const [toast, setToast] = useIgState(null);
  useIgEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);
  useIgEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  const id = new URLSearchParams(location.search).get("id") || "amazon";
  const intg = (typeof intgGet === "function") ? intgGet(id) : null;
  const streams = IG_STREAMS[id] || [];
  const ago = (ts) => (typeof intgAgo === "function" ? intgAgo(ts) : "—");
  const connected = intg && intg.status === "connected";

  function connect() { if (typeof intgConnect === "function") intgConnect(id); setTick((n) => n + 1); setToast("Connected"); }
  function disconnect() { if (typeof intgDisconnect === "function") intgDisconnect(id); setTick((n) => n + 1); setToast("Disconnected"); }
  function syncNow() { if (typeof intgSyncNow === "function") intgSyncNow(id); setTick((n) => n + 1); setToast("Synced"); }

  if (!intg) {
    return (
      <div className="vy-app">
        <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} active="Settings" />
        <div className="vy-app-main">
          <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} workspaceName="Settings" tabs={[{ key: "s", label: "Integration" }]} activeTab="s" />
          <main className="vy-content"><div className="vy-content-inner">
            <div className="vy-card" style={{ padding: 40, textAlign: "center" }}>
              <p style={{ color: "hsl(var(--muted-fg))" }}>Integration not found.</p>
              <a href="Vyonix Settings.html?section=integrations" className="vy-btn vy-btn--primary" style={{ textDecoration: "none", marginTop: 12 }}>Back to Integrations</a>
            </div>
          </div></main>
        </div>
      </div>
    );
  }

  const toneVar = (typeof INTG_TONE_VAR !== "undefined" && INTG_TONE_VAR[intg.tone]) || "primary";
  const statusTone = (typeof INTG_STATUS_TONE !== "undefined" && INTG_STATUS_TONE[intg.status]) || "muted";
  const statusLabel = (typeof INTG_STATUS_LABEL !== "undefined" && INTG_STATUS_LABEL[intg.status]) || intg.status;

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Settings" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => {}} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} workspaceName="Settings" tabs={[{ key: "s", label: "Integration" }]} activeTab="s" />
        <main className="vy-content">
          <div className="vy-content-inner">
            <nav className="vy-breadcrumb" aria-label="Breadcrumb" style={{ marginBottom: 4 }}>
              <a href="Vyonix Settings.html?section=integrations" className="vy-bc-link">Integrations</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <span className="vy-bc-current" aria-current="page">{intg.name}</span>
            </nav>

            {/* Header */}
            <section className="vy-card" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <span style={{ width: 48, height: 48, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--" + toneVar + ") / 0.14)", color: "hsl(var(--" + toneVar + "))" }}><VyIcon name={intg.icon} size={22} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{intg.name}</h1>
                      <span className={"vy-badge vy-badge--" + statusTone}>{statusLabel}</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "6px 0 0", maxWidth: "60ch" }}>{intg.blurb}</p>
                    {intg.account ? <div style={{ ...igMono, fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 6 }}>{intg.account}</div> : null}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {connected ? (
                    <>
                      <button type="button" className="vy-btn vy-btn--outline" onClick={syncNow}><VyIcon name="refresh" size={13} /><span>Sync now</span></button>
                      <button type="button" className="vy-btn vy-btn--ghost" onClick={disconnect}>Disconnect</button>
                    </>
                  ) : (
                    <button type="button" className="vy-btn vy-btn--primary" onClick={connect}><VyIcon name="link" size={13} /><span>Connect</span></button>
                  )}
                </div>
              </div>
              {connected ? <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 12 }}>Last sync {ago(intg.lastSync)}</div> : null}
              {intg.note ? <div style={{ fontSize: 12, color: "hsl(var(--warning))", marginTop: 8 }}>{intg.note}</div> : null}
            </section>

            {/* Data streams */}
            <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid hsl(var(--border))" }}>
                <div className="vy-kicker">What it syncs</div>
                <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>Each data stream this connection pulls — and where it flows in Vyonix.</div>
              </div>
              <div>
                {streams.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "hsl(var(--muted-fg))", fontSize: 13 }}>No data streams documented.</div>
                ) : streams.map((s, i) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 18px", borderTop: i > 0 ? "1px solid hsl(var(--border) / 0.6)" : "none" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--" + toneVar + ") / 0.12)", color: "hsl(var(--" + toneVar + "))", marginTop: 1 }}><VyIcon name="refresh" size={14} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</span>
                        <span className="vy-badge vy-badge--muted" style={{ fontSize: 9 }}>{s.feeds}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{s.detail}</div>
                      <div style={{ ...igMono, fontSize: 10.5, color: "hsl(var(--muted-fg))", marginTop: 3 }}>{s.api}</div>
                    </div>
                    <span className={"vy-badge vy-badge--" + (connected ? "success" : "muted")} style={{ fontSize: 9, flexShrink: 0 }}>{connected ? "Live" : "Idle"}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Honesty note */}
            <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", padding: "0 4px", lineHeight: 1.5 }}>
              Prototype: connection state is simulated. When live, each stream above reads its real endpoint; the in-app destinations (P&L, Inventory, Shipments, Finance) already consume this shape, so no rework is needed.
            </div>
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Settings" />
      {toast ? <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "hsl(var(--foreground))", color: "hsl(var(--background))", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999 }}>{toast}</div> : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("vy-root")).render(<IntegrationPage />);
