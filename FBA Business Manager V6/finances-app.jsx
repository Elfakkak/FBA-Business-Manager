// finances-app.jsx — Finance workspace: company net + partner capital accounts.
// Route: Vyonix Finances.html. Reads/derives everything from finances-data.jsx.

const { useState: useFinState, useEffect: useFinEffect, useMemo: useFinMemo } = React;

const finTh = { textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" };
const finTd = { padding: "11px 12px", color: "hsl(var(--foreground))", fontSize: 12.5, whiteSpace: "nowrap" };
const finMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const finInput = { height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", width: "100%", boxSizing: "border-box" };
const finLabel = { fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-fg))", marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" };

const FIN_KIND_META = {
  revenue: { label: "Revenue", tone: "success", sign: +1 },
  expense: { label: "Expense", tone: "warning", sign: -1 },
  draw: { label: "Draw", tone: "info", sign: -1 },
  contribution: { label: "Contribution", tone: "muted", sign: +1 },
};

function finInitials(name) {
  return (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// Hybrid source tag — matches the app-wide ● Amazon / ○ Manual pattern.
function FinSourceTag({ source }) {
  const amazon = source === "amazon";
  const mercury = source === "mercury";
  const payables = source === "payables";
  const label = amazon ? "Amazon" : mercury ? "Mercury" : payables ? "Payables" : "Manual";
  const synced = amazon || mercury || payables;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: synced ? "hsl(var(--info, 217 91% 60%))" : "hsl(var(--muted-fg))" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid currentColor", background: synced ? "currentColor" : "transparent", flex: "none" }} />
      {label}
    </span>
  );
}

// ======================================================================
// SOURCE STRIP — where the numbers come from (Amazon revenue · Mercury cash)
// ======================================================================
function FinSourceStrip({ D, onSyncAmazon, onSyncMercury }) {
  const amazon = (typeof intgGet === "function") ? intgGet("amazon") : null;
  const mercury = (typeof intgGet === "function") ? intgGet("mercury") : null;
  const amzConnected = amazon && amazon.status === "connected";
  const merConnected = mercury && mercury.status === "connected";
  const ago = (ts) => (typeof intgAgo === "function" ? intgAgo(ts) : "—");

  const tile = (icon, accent, title, connected, statusLabel, line, footer) => (
    <div style={{ flex: "1 1 240px", minWidth: 0, border: "1px solid hsl(var(--border))", borderRadius: 12, overflow: "hidden", background: "hsl(var(--card))", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", borderBottom: "1px solid hsl(var(--border))", background: connected ? "hsl(var(--" + accent + ") / 0.06)" : "hsl(var(--muted) / 0.25)" }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", background: connected ? "hsl(var(--" + accent + ") / 0.14)" : "hsl(var(--muted) / 0.6)", color: connected ? "hsl(var(--" + accent + "))" : "hsl(var(--muted-fg))" }}>
          <VyIcon name={icon} size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: connected ? "hsl(var(--success, 142 71% 45%))" : "hsl(var(--muted-fg))", marginTop: 2 }}>{statusLabel}</div>
        </div>
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, flex: 1, justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", lineHeight: 1.45 }}>{line}</div>
        {footer}
      </div>
    </div>
  );

  return (
    <div className="vy-card" style={{ padding: "16px 18px" }}>
      <div className="vy-kicker" style={{ marginBottom: 12 }}>Where these numbers come from</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
        {tile("cube", "warning", "Revenue", amzConnected, amzConnected ? "Amazon · Connected" : "Amazon · Not connected",
          amzConnected ? <><strong style={{ color: "hsl(var(--foreground))" }}>{finFmt(D.amazonRevenue)}</strong> synced from Seller Central · payout {ago(amazon.lastSync)}. Already net of Amazon fees & ads.</> : "Connect Amazon to sync payouts as revenue.",
          amzConnected ? (
            <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" onClick={onSyncAmazon}><VyIcon name="refresh" size={12} /><span>Sync from Amazon</span></button>
          ) : (
            <a className="vy-btn vy-btn--outline vy-btn--sm" href="Vyonix Settings.html?section=integrations"><VyIcon name="link" size={12} /><span>Connect Amazon</span></a>
          ))}
        {tile("dollar", "info", "Cash & payments", merConnected, merConnected ? "Mercury · Connected" : "Mercury · Not connected",
          merConnected ? <>{mercury.account || "Bank account"} · synced {ago(mercury.lastSync)}. Balances & supplier payments reconcile here.</> : "Connect Mercury to reconcile balances & payments.",
          merConnected ? (
            <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" onClick={onSyncMercury}><VyIcon name="refresh" size={12} /><span>Sync from Mercury</span></button>
          ) : (
            <a className="vy-btn vy-btn--outline vy-btn--sm" href="Vyonix Settings.html?section=integrations"><VyIcon name="link" size={12} /><span>Connect Mercury</span></a>
          ))}
        {tile("pencil", "primary", "Draws & cash", true, "Manual · Entered by you",
          <>Partner draws, contributions and cash in/out — logged by hand. Supplier costs fold in from Payables.</>,
          <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))", fontStyle: "italic" }}>No connection needed</span>)}
      </div>
    </div>
  );
}

// ======================================================================
// MAIN PAGE
// ======================================================================
function FinancesPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useFinState(false);
  const [mobileNavOpen, setMobileNavOpen] = useFinState(false);
  const [isDark, setIsDark] = useFinState(false);

  const [config, setConfig] = useFinState(() => finLoadConfig());
  const [entries, setEntries] = useFinState(() => finLoadEntries());
  const [inbox, setInbox] = useFinState(() => finInboxLoad());
  const [rules, setRules] = useFinState(() => finRulesLoad());
  const [modal, setModal] = useFinState(null);      // null | "log" | {edit:entry}
  const [tab, setTab] = useFinState(() => {
    const t = new URLSearchParams(location.search).get("tab");
    return ["pnl", "partnership", "tax", "review", "ledger"].includes(t) ? t : "business";
  });
  const [filterKind, setFilterKind] = useFinState("all");
  const [filterPartner, setFilterPartner] = useFinState("all");
  const [toast, setToast] = useFinState(null);

  useFinEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);
  useFinEffect(() => { finSaveEntries(entries); }, [entries]);
  useFinEffect(() => { finSaveConfig(config); }, [config]);
  useFinEffect(() => { finInboxSave(inbox); }, [inbox]);
  useFinEffect(() => { finRulesSave(rules); }, [rules]);
  useFinEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t); }, [toast]);

  const D = useFinMemo(() => finDerive(entries, config), [entries, config]);
  const openInvoices = useFinMemo(() => finOpenInvoices(), []);

  const FIN_TAB_META = {
    business: { label: "Business", title: "Business", sub: "The whole company: profit, revenue vs costs, and the cash in your accounts." },
    pnl: { label: "P&L", title: "Profit & Loss", sub: "True net profit per month and for the year — Amazon payout minus product cost, freight, expenses and recurring overhead." },
    partnership: { label: "Partnership", title: "Partnership", sub: "You and Youness — each partner's capital account, contributions, draws, and who's taken more than their share." },
    tax: { label: "Tax", title: "Tax", sub: "What to set aside for taxes — allocated to each partner by ownership share." },
    review: { label: "Review", title: "Review transactions", sub: "Synced Amazon & Mercury transactions waiting to be categorized — they don't affect net until confirmed." },
    ledger: { label: "Transactions", title: "Transactions", sub: "Every dollar in and out. Supplier costs fold in automatically from Payables." },
  };
  const tabMeta = FIN_TAB_META[tab] || FIN_TAB_META.business;
  // sidebar sub-page label for the current tab (Finance is a group now)
  const FIN_NAV_LABEL = { business: "Business", pnl: "P&L", partnership: "Partnership", tax: "Tax", ledger: "Transactions", review: "Business" };
  const finNavActive = FIN_NAV_LABEL[tab] || "Business";
  // keep the URL in sync so a refresh / share lands on the same view
  useFinEffect(() => {
    const url = new URL(location.href); url.searchParams.set("tab", tab); history.replaceState(null, "", url);
  }, [tab]);

  function flash(msg) { setToast(msg); }

  function syncAmazon() {
    if (typeof intgSyncNow === "function") intgSyncNow("amazon");
    flash("Amazon Seller Central synced — revenue up to date");
  }
  function syncMercury() {
    if (typeof intgSyncNow === "function") intgSyncNow("mercury");
    flash("Mercury synced — balances & payments up to date");
  }

  function upsertEntry(entry) {
    setEntries((prev) => {
      const i = prev.findIndex((e) => e.id === entry.id);
      if (i >= 0) { const next = prev.slice(); next[i] = entry; return next; }
      return [...prev, entry];
    });
  }
  function deleteEntry(id) {
    if (!window.confirm("Delete this entry?")) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    flash("Entry deleted");
  }

  // ---- review inbox ----
  function txnEntry(txn, a) {
    return {
      id: "e" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      date: txn.date, kind: a.kind, amount: txn.amount,
      partner: (a.kind === "draw" || a.kind === "contribution") ? (a.partner || null) : null,
      account: a.account || txn.account,
      source: a.source || (txn.source === "amazon" ? "amazon" : txn.source === "mercury" ? "mercury" : "manual"),
      note: a.note || txn.desc,
    };
  }
  function confirmTxn(txn, a) {
    if (a.invoiceId && typeof payApplyPayment === "function") {
      payApplyPayment(a.invoiceId, txn.amount);              // mark the bill paid
      setInbox((prev) => prev.filter((t) => t.id !== txn.id));
      setEntries((prev) => [...prev]);                        // force re-derive (fold-in picks it up)
      flash("Applied to " + a.invoiceId + " — bill marked paid");
    } else {
      upsertEntry(txnEntry(txn, a));
      setInbox((prev) => prev.filter((t) => t.id !== txn.id));
      flash("Categorized — posted to Transactions");
    }
  }
  function confirmAllSuggested() {
    const posts = [], pays = [];
    inbox.forEach((txn) => {
      const s = finSuggest(txn, openInvoices, rules);
      if (s && s.confidence === "high" && s.kind) (s.invoiceId ? pays : posts).push({ txn, a: s });
    });
    if (!posts.length && !pays.length) { flash("Nothing confident enough to auto-post"); return; }
    if (typeof payApplyPayment === "function") pays.forEach((p) => payApplyPayment(p.a.invoiceId, p.txn.amount));
    setEntries((prev) => [...prev, ...posts.map((p) => txnEntry(p.txn, p.a))]);
    const ids = new Set([...posts, ...pays].map((p) => p.txn.id));
    setInbox((prev) => prev.filter((t) => !ids.has(t.id)));
    const total = posts.length + pays.length;
    flash("Posted " + total + " transaction" + (total > 1 ? "s" : "") + (pays.length ? " · " + pays.length + " applied to bills" : ""));
  }
  function dismissTxn(id) { setInbox((prev) => prev.filter((t) => t.id !== id)); flash("Transaction dismissed"); }
  function addRule(rule) { setRules((prev) => [...prev, { ...rule, id: "r" + Date.now() }]); flash("Rule saved — similar transactions will auto-categorize"); }

  const partnerName = (id) => { const p = config.partners.find((x) => x.id === id); return p ? p.name : "—"; };
  const accountName = (id) => { const a = config.accounts.find((x) => x.id === id); return a ? a.name : id; };

  const filteredEntries = finAllEntries(entries)
    .filter((e) => filterKind === "all" || e.kind === filterKind)
    .filter((e) => filterPartner === "all" || e.partner === filterPartner || (filterPartner === "company" && !e.partner))
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id > a.id ? 1 : -1));

  const businessKpis = [
    { icon: "dollar", label: "Company net", value: finFmt(D.cumNet), sub: "revenue − costs (all time)", tone: D.cumNet >= 0 ? "success" : "warning" },
    { icon: "cube", label: "Revenue (Seller Central)", value: finFmt(D.totalRevenue), sub: D.amazonRevenue ? finFmt(D.amazonRevenue) + " synced from Amazon" : "top line", tone: "info" },
    { icon: "money", label: "Total costs", value: finFmt(D.totalExpense), sub: "supplier, freight, fees, software" },
    { icon: "boxes", label: "Retained in business", value: finFmt(D.retained), sub: "net not yet distributed" },
    { icon: "money", label: "Cash on hand", value: finFmt(D.cashOnHand), sub: D.accounts.map((a) => a.name + " " + finFmt(a.balance)).join(" · ") },
  ];
  const kpiRow = (list) => (
    <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(176px, 1fr))" }}>
      {list.map((k) => (
        <div className={"vy-card vy-kpi" + (k.tone ? " vy-kpi--" + k.tone : "")} key={k.label}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <VyIcon name={k.icon} size={14} style={{ opacity: 0.7 }} />
            <span className="vy-kicker">{k.label}</span>
          </div>
          <div className="vy-kpi-value" style={{ fontSize: 18 }}>{k.value}</div>
          <div className="vy-kpi-sub" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{k.sub}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active={finNavActive} />
      <div className="vy-app-main">
        <VyHeader
          onToggleMobileNav={() => setMobileNavOpen(true)}
          onOpenSearch={() => {}}
          onToggleTheme={() => setIsDark(!isDark)}
          isDark={isDark}
          onToggleActivity={() => {}}
          workspaceName="Money"
          tabs={[{ key: "net", label: "Finance" }]}
          activeTab="net"
        />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Page header */}
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Finance</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>{tabMeta.title}</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0", minHeight: 40, maxWidth: 620 }}>
                  {tabMeta.sub}
                </p>
              </div>
              <div className="vy-page-head-actions" style={{ marginLeft: "auto" }}>
                <button type="button" className="vy-btn vy-btn--ghost" onClick={() => finExportCsv(entries, config)}>
                  <VyIcon name="arrowUpRight" size={14} /><span>Export</span>
                </button>
                <button type="button" className={"vy-btn " + (tab === "review" ? "vy-btn--primary" : "vy-btn--outline")} onClick={() => setTab(tab === "review" ? "business" : "review")}>
                  <VyIcon name="refresh" size={14} /><span>Review</span>
                  {inbox.length ? <span className={"vy-badge " + (tab === "review" ? "vy-badge--muted" : "vy-badge--primary")} style={{ marginLeft: 2 }}>{inbox.length}</span> : null}
                </button>
                <button type="button" className="vy-btn vy-btn--primary" onClick={() => setModal("log")}>
                  <VyIcon name="plus" size={14} /><span>Log entry</span>
                </button>
              </div>
            </div>

            {/* In-page sub-section tabs (Review lives on the header button, not here) */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { key: "business", label: "Business", icon: "dashboard" },
                { key: "pnl", label: "P&L", icon: "dollar" },
                { key: "partnership", label: "Partnership", icon: "user" },
                { key: "tax", label: "Tax", icon: "shield" },
                { key: "ledger", label: "Transactions", icon: "fileText" },
              ].map((t) => {
                const active = tab === t.key;
                return (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid " + (active ? "hsl(var(--primary))" : "hsl(var(--border))"), background: active ? "hsl(var(--primary))" : "hsl(var(--card))", color: active ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" }}>
                    <VyIcon name={t.icon} size={14} />
                    <span>{t.label}</span>
                    {t.badge ? <span className={"vy-badge " + (active ? "vy-badge--muted" : "vy-badge--primary")} style={{ marginLeft: 2 }}>{t.badge}</span> : null}
                  </button>
                );
              })}
            </div>

            {tab === "pnl" && typeof FinPnl === "function" ? (
              <FinPnl D={D} />
            ) : null}

            {tab === "business" ? (
              <>
                {/* Source / connection provenance */}
                <FinSourceStrip D={D} onSyncAmazon={syncAmazon} onSyncMercury={syncMercury} />
                {kpiRow(businessKpis)}
                {/* Two-column: Net by month + Cash accounts */}
                <div className="fin-two-col">
                  <FinNetByMonth D={D} />
                  <FinCashAccounts D={D} />
                </div>
              </>
            ) : null}

            {tab === "partnership" ? (
              <>
                {/* Settle-up banner — the headline answer */}
                <FinSettleBanner D={D} />
                {/* Capital accounts */}
                <FinCapitalAccounts D={D} onEditPartners={() => setModal("partners")} />
                {/* Draw planner — what each can safely take */}
                <FinPlanner D={D} />
              </>
            ) : null}

            {tab === "tax" ? (
              <FinTaxPanel D={D} onSetPct={(p) => setConfig((c) => ({ ...c, taxReservePct: Math.max(0, Math.min(0.6, p)) }))} />
            ) : null}

            {tab === "review" ? (
              <FinReviewInbox
                inbox={inbox}
                rules={rules}
                openInvoices={openInvoices}
                partners={config.partners}
                accounts={config.accounts}
                onConfirm={confirmTxn}
                onConfirmAll={confirmAllSuggested}
                onDismiss={dismissTxn}
                onAddRule={addRule}
              />
            ) : null}

            {tab === "ledger" ? (
              <>
                <FinLedger
                  entries={filteredEntries}
                  totalCount={finAllEntries(entries).length}
                  partnerName={partnerName}
                  accountName={accountName}
                  filterKind={filterKind}
                  setFilterKind={setFilterKind}
                  filterPartner={filterPartner}
                  setFilterPartner={setFilterPartner}
                  partners={config.partners}
                  onEdit={(e) => setModal({ edit: e })}
                  onDelete={deleteEntry}
                  onAdd={() => setModal("log")}
                />

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={() => { if (window.confirm("Reset all finance data to the sample seed?")) { finResetSeed(); setConfig(finLoadConfig()); setEntries(finLoadEntries()); setInbox(finInboxLoad()); setRules(finRulesLoad()); flash("Reset to sample data"); } }}>
                    <VyIcon name="refresh" size={12} /><span>Reset to sample data</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>

      {modal === "log" ? (
        <FinEntryModal config={config} onClose={() => setModal(null)} onSubmit={(e) => { upsertEntry(e); setModal(null); flash("Entry logged"); }} />
      ) : null}
      {modal && modal.edit ? (
        <FinEntryModal config={config} entry={modal.edit} onClose={() => setModal(null)} onSubmit={(e) => { upsertEntry(e); setModal(null); flash("Entry updated"); }} />
      ) : null}
      {modal === "partners" ? (
        <FinPartnersModal config={config} onClose={() => setModal(null)} onSubmit={(payload) => {
          if (typeof teamUpdateOwner === "function") {
            payload.partners.forEach((p) => teamUpdateOwner(p.id, { name: p.name, share: p.share }));
          }
          finSaveConfig({ ...config, taxReservePct: payload.taxReservePct });
          setConfig(finLoadConfig());
          setModal(null); flash("Partners updated");
        }} />
      ) : null}

      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active={finNavActive} />
      {toast ? (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "hsl(var(--foreground))", color: "hsl(var(--background))", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "var(--shadow-lg)" }}>{toast}</div>
      ) : null}
    </div>
  );
}

// ======================================================================
// REVIEW INBOX — categorize synced Mercury / Amazon transactions
// ======================================================================
function finRuleToken(desc) {
  const tail = (desc || "").match(/···\s*(\w+)/);
  if (tail) return "···" + tail[1];
  const paren = (desc || "").match(/\(([^)]+)\)/);
  if (paren) return paren[1];
  const word = (desc || "").replace(/^[^a-z]*/i, "").split(/\s+/)[0];
  return word || desc;
}

function FinReviewInbox({ inbox, rules, openInvoices, partners, accounts, onConfirm, onConfirmAll, onDismiss, onAddRule }) {
  const count = inbox.length;
  const suggestedCount = inbox.filter((t) => { const s = finSuggest(t, openInvoices, rules); return s && s.confidence === "high"; }).length;

  return (
    <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: count ? "1px solid hsl(var(--border))" : "0", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: count ? "hsl(var(--primary) / 0.12)" : "hsl(var(--success, 142 71% 45%) / 0.12)", color: count ? "hsl(var(--primary))" : "hsl(var(--success, 142 71% 45%))", display: "grid", placeItems: "center", flex: "none" }}>
            <VyIcon name={count ? "refresh" : "check"} size={16} />
          </span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Review synced transactions {count ? <span className="vy-badge vy-badge--primary" style={{ marginLeft: 4 }}>{count}</span> : null}</div>
            <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 1 }}>
              {count ? "Imported from Amazon & Mercury — assign each, then it posts to Transactions. They don't affect net until confirmed." : "All caught up — every synced transaction is categorized."}
            </div>
          </div>
        </div>
        {count && suggestedCount ? (
          <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" onClick={onConfirmAll}>
            <VyIcon name="check" size={13} /><span>Confirm {suggestedCount} suggested</span>
          </button>
        ) : null}
      </div>
      {count ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {inbox.map((txn) => (
            <FinInboxRow key={txn.id} txn={txn} suggestion={finSuggest(txn, openInvoices, rules)} partners={partners} accounts={accounts} onConfirm={onConfirm} onDismiss={onDismiss} onAddRule={onAddRule} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FinInboxRow({ txn, suggestion, partners, accounts, onConfirm, onDismiss, onAddRule }) {
  const inFlow = txn.direction === "in";
  const [kind, setKind] = useFinState(suggestion ? suggestion.kind : (inFlow ? "revenue" : "expense"));
  const [partner, setPartner] = useFinState(suggestion && suggestion.partner ? suggestion.partner : (partners[0] ? partners[0].id : "me"));
  const [account, setAccount] = useFinState(txn.account);
  const needsPartner = kind === "draw" || kind === "contribution";
  const ruleToken = finRuleToken(txn.desc);
  const fromRule = suggestion && /^Rule:/.test(suggestion.reason || "");
  const canMakeRule = !inFlow && needsPartner && !fromRule;

  function confirm() {
    onConfirm(txn, { kind, partner, account, source: suggestion ? suggestion.source : undefined, note: txn.desc, invoiceId: suggestion ? suggestion.invoiceId : null });
  }

  return (
    <div style={{ padding: "13px 18px", borderTop: "1px solid hsl(var(--border) / 0.6)", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      {/* left: identity */}
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FinSourceTag source={txn.source} />
          <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))", ...finMono }}>{txn.date}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{txn.desc}</div>
        {suggestion ? (
          <div style={{ fontSize: 11, color: suggestion.confidence === "high" ? "hsl(var(--success, 142 71% 45%))" : "hsl(var(--muted-fg))", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
            <VyIcon name={suggestion.confidence === "high" ? "check" : "info"} size={11} />
            <span>{suggestion.reason}</span>
            {suggestion.orderId ? <a href={"Vyonix Order Shell.html?order=" + suggestion.orderId + "#invoices"} style={{ color: "hsl(var(--primary))", fontWeight: 600 }}>open</a> : null}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "hsl(38 92% 45%)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
            <VyIcon name="alert" size={11} /><span>Needs review — pick a category</span>
          </div>
        )}
      </div>

      {/* amount */}
      <div style={{ ...finMono, fontSize: 14, fontWeight: 800, color: inFlow ? "hsl(var(--success, 142 71% 45%))" : "hsl(var(--foreground))", flex: "none", minWidth: 84, textAlign: "right" }}>
        {(inFlow ? "+" : "−") + "$" + txn.amount.toLocaleString()}
      </div>

      {/* assignment controls */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", flex: "none" }}>
        <select className="vy-input" style={{ height: 34, fontSize: 12, padding: "0 8px", width: "auto" }} value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.keys(FIN_KIND_META).map((k) => <option key={k} value={k}>{FIN_KIND_META[k].label}</option>)}
        </select>
        {needsPartner ? (
          <select className="vy-input" style={{ height: 34, fontSize: 12, padding: "0 8px", width: "auto" }} value={partner} onChange={(e) => setPartner(e.target.value)}>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : null}
        <select className="vy-input" style={{ height: 34, fontSize: 12, padding: "0 8px", width: "auto" }} value={account} onChange={(e) => setAccount(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" onClick={confirm}><VyIcon name="check" size={13} /><span>Confirm</span></button>
        <button type="button" className="vy-icon-btn" style={{ width: 30, height: 30 }} title="Dismiss" onClick={() => onDismiss(txn.id)}><VyIcon name="x" size={14} /></button>
      </div>

      {canMakeRule ? (
        <div style={{ flex: "1 1 100%", fontSize: 11, color: "hsl(var(--muted-fg))" }}>
          <button type="button" onClick={() => onAddRule({ match: ruleToken, kind, partner, label: "“" + ruleToken + "” → " + FIN_KIND_META[kind].label + " · " + (partners.find((p) => p.id === partner) || {}).name })}
            style={{ background: "none", border: "none", color: "hsl(var(--primary))", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 11 }}>
            + Always categorize “{ruleToken}” like this
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ======================================================================
// Partnership views (FinSettleBanner · FinCapitalAccounts · FinStat ·
// FinPlanner) live in finances-partnership.jsx. The Tax view (FinTaxPanel)
// lives in finances-tax.jsx. Both load before this file and expose their
// components on window. Edit those files to change those sections.
// ======================================================================

// ======================================================================
// NET BY MONTH — grouped column chart (revenue vs expense) + net line
// ======================================================================
function FinNetByMonth({ D }) {
  const months = D.months;
  const maxRev = Math.max(1, ...months.map((m) => Math.max(m.revenue, m.expense)));
  const CH = 132; // chart plot height in px
  const totRev = months.reduce((n, m) => n + m.revenue, 0);
  const totExp = months.reduce((n, m) => n + m.expense, 0);
  const totNet = totRev - totExp;
  return (
    <section className="vy-card" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <div className="vy-kicker">Net by month</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>Revenue vs expenses, and the net profit each month.</div>
        </div>
        <div style={{ display: "flex", gap: 14, flexShrink: 0, paddingTop: 2 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "hsl(var(--muted-fg))" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "hsl(var(--c-revenue))" }} />Revenue</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "hsl(var(--muted-fg))" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "hsl(var(--c-expense))" }} />Expense</span>
        </div>
      </div>

      {/* plot */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: CH + 44, paddingTop: 22 }}>
        {months.map((m) => {
          const revH = Math.max(2, (m.revenue / maxRev) * CH);
          const expH = Math.max(2, (m.expense / maxRev) * CH);
          const pos = m.net >= 0;
          return (
            <div key={m.key} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
              {/* net label */}
              <div style={{ ...finMono, fontSize: 11.5, fontWeight: 800, color: pos ? "hsl(var(--success, 142 71% 45%))" : "hsl(38 92% 45%)", marginBottom: 6, whiteSpace: "nowrap" }}>{finFmtSigned(m.net)}</div>
              {/* bars */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4, height: CH }}>
                <div title={"Revenue " + finFmt(m.revenue)} style={{ width: 16, height: revH, borderRadius: "4px 4px 0 0", background: "linear-gradient(hsl(var(--c-revenue)), hsl(var(--c-revenue) / 0.78))" }} />
                <div title={"Expense " + finFmt(m.expense)} style={{ width: 16, height: expH, borderRadius: "4px 4px 0 0", background: "linear-gradient(hsl(var(--c-expense)), hsl(var(--c-expense) / 0.82))" }} />
              </div>
              {/* baseline + label */}
              <div style={{ width: "100%", height: 1, background: "hsl(var(--border))", margin: "0 0 6px" }} />
              <div style={{ fontSize: 11, fontWeight: 600 }}>{m.label}</div>
            </div>
          );
        })}
      </div>

      {/* footer totals */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid hsl(var(--border))" }}>
        <FinNbmStat label="Revenue" value={finFmt(totRev)} />
        <FinNbmStat label="Expenses" value={finFmt(totExp)} tone="warning" />
        <FinNbmStat label="Net profit" value={finFmtSigned(totNet)} tone={totNet >= 0 ? "success" : "warning"} alignEnd />
      </div>
    </section>
  );
}
function FinNbmStat({ label, value, tone, alignEnd }) {
  const color = tone === "success" ? "hsl(var(--success, 142 71% 45%))" : tone === "warning" ? "hsl(38 92% 45%)" : "hsl(var(--foreground))";
  return (
    <div style={{ textAlign: alignEnd ? "right" : "left" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "hsl(var(--muted-fg))" }}>{label}</div>
      <div style={{ ...finMono, fontSize: 15, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ======================================================================
// CASH ACCOUNTS — Mercury / Cash balances + flow
// ======================================================================
function FinCashAccounts({ D }) {
  const merc = (typeof intgGet === "function") ? intgGet("mercury") : null;
  const ago = (ts) => (typeof intgAgo === "function" ? intgAgo(ts) : "—");
  return (
    <section className="vy-card" style={{ padding: "14px 18px" }}>
      <div className="vy-kicker">Cash accounts</div>
      <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2, marginBottom: 14 }}>Where the money actually sits. Every entry records the account it moved through.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {D.accounts.map((a) => {
          const linked = a.id === "mercury" && merc && merc.status === "connected";
          return (
          <div key={a.id} style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: "hsl(var(--accent))", color: "hsl(var(--foreground))", display: "grid", placeItems: "center", flex: "none" }}>
                  <VyIcon name={a.kind === "cash" ? "dollar" : "money"} size={15} />
                </span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{a.name}</span>
                    {linked ? <span className="vy-badge vy-badge--success" style={{ fontSize: 9 }}>Synced</span> : null}
                  </div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{linked ? (merc.account || "Bank") + " · " + ago(merc.lastSync) : (a.kind === "cash" ? "Physical cash" : "Bank account")}</div>
                </div>
              </div>
              <div style={{ ...finMono, fontSize: 17, fontWeight: 800 }}>{finFmt(a.balance)}</div>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "hsl(var(--muted-fg))" }}>
              <span>Opening <strong style={{ color: "hsl(var(--foreground))", ...finMono }}>{finFmt(a.opening)}</strong></span>
              <span style={{ color: "hsl(var(--success, 142 71% 45%))" }}>In +{finFmt(a.inflow)}</span>
              <span style={{ color: "hsl(38 92% 45%)" }}>Out −{finFmt(a.outflow)}</span>
            </div>
          </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px 0", borderTop: "1px dashed hsl(var(--border))", marginTop: 2 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>Total cash on hand</span>
          <span style={{ ...finMono, fontSize: 14, fontWeight: 800 }}>{finFmt(D.cashOnHand)}</span>
        </div>
      </div>
    </section>
  );
}

// ======================================================================
// LEDGER — every entry, filterable, edit/delete
// ======================================================================
function FinLedger({ entries, totalCount, partnerName, accountName, filterKind, setFilterKind, filterPartner, setFilterPartner, partners, onEdit, onDelete, onAdd }) {
  return (
    <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 12px", borderBottom: "1px solid hsl(var(--border))", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="vy-kicker">Transactions</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{entries.length} of {totalCount} entries — supplier costs fold in from Payables (linked rows open the order).</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select className="vy-input" style={{ height: 34, fontSize: 12.5, padding: "0 10px", width: "auto" }} value={filterKind} onChange={(e) => setFilterKind(e.target.value)}>
            <option value="all">All types</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expense</option>
            <option value="draw">Draw</option>
            <option value="contribution">Contribution</option>
          </select>
          <select className="vy-input" style={{ height: 34, fontSize: 12.5, padding: "0 10px", width: "auto" }} value={filterPartner} onChange={(e) => setFilterPartner(e.target.value)}>
            <option value="all">Everyone</option>
            <option value="company">Company</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" onClick={onAdd}>
            <VyIcon name="plus" size={13} /><span>Log entry</span>
          </button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
              <th style={finTh}>Date</th>
              <th style={finTh}>Type</th>
              <th style={finTh}>Who</th>
              <th style={finTh}>Account</th>
              <th style={finTh}>Note</th>
              <th style={{ ...finTh, textAlign: "right" }}>Amount</th>
              <th style={{ ...finTh, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td style={{ ...finTd, padding: "28px 12px", textAlign: "center", color: "hsl(var(--muted-fg))" }} colSpan={7}>No entries match these filters.</td></tr>
            ) : entries.map((e) => {
              const meta = FIN_KIND_META[e.kind] || FIN_KIND_META.expense;
              const signed = (meta.sign > 0 ? "+" : "−") + "$" + Math.abs(Number(e.amount) || 0).toLocaleString();
              return (
                <tr key={e.id} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                  <td style={{ ...finTd, ...finMono }}>{e.date}</td>
                  <td style={finTd}><span className={"vy-badge vy-badge--" + meta.tone}>{meta.label}</span></td>
                  <td style={finTd}>{e.partner ? partnerName(e.partner) : <span style={{ color: "hsl(var(--muted-fg))" }}>Company</span>}</td>
                  <td style={finTd}>
                    <div>{accountName(e.account)}</div>
                    <div style={{ marginTop: 3 }}><FinSourceTag source={e.source} /></div>
                  </td>
                  <td style={{ ...finTd, whiteSpace: "normal", maxWidth: 280, color: "hsl(var(--muted-fg))" }}>{e.note || "—"}</td>
                  <td style={{ ...finTd, ...finMono, textAlign: "right", fontWeight: 700, color: meta.sign > 0 ? "hsl(var(--success, 142 71% 45%))" : "hsl(var(--foreground))" }}>{signed}</td>
                  <td style={{ ...finTd, textAlign: "right" }}>
                    {e.locked ? (
                      <a href={e.orderId ? "Vyonix Order Shell.html?order=" + e.orderId + "#invoices" : "#"} title="Manage in the order's Invoices" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "hsl(var(--primary))", textDecoration: "none" }}>
                        <VyIcon name="externalLink" size={12} /><span>Order</span>
                      </a>
                    ) : (
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <button type="button" className="vy-icon-btn" style={{ width: 28, height: 28 }} title="Edit" onClick={() => onEdit(e)}><VyIcon name="pencil" size={13} /></button>
                        <button type="button" className="vy-icon-btn" style={{ width: 28, height: 28 }} title="Delete" onClick={() => onDelete(e.id)}><VyIcon name="trash" size={13} /></button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ======================================================================
// LOG / EDIT ENTRY MODAL
// ======================================================================
function FinEntryModal({ config, entry, onClose, onSubmit }) {
  const isEdit = !!entry;
  const [shown, setShown] = useFinState(false);
  const [kind, setKind] = useFinState(entry ? entry.kind : "revenue");
  const [date, setDate] = useFinState(entry ? entry.date : new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useFinState(entry ? String(entry.amount) : "");
  const [partner, setPartner] = useFinState(entry ? (entry.partner || config.partners[0].id) : config.partners[0].id);
  const [account, setAccount] = useFinState(entry ? entry.account : config.accounts[0].id);
  const [note, setNote] = useFinState(entry ? entry.note : "");

  useFinEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }, []);
  const needsPartner = kind === "draw" || kind === "contribution";

  function submit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { window.alert("Enter an amount greater than 0."); return; }
    onSubmit({
      id: entry ? entry.id : "e" + Date.now().toString(36),
      date, kind, amount: amt,
      partner: needsPartner ? partner : null,
      account, note: note.trim(),
      source: entry ? (entry.source || "manual") : "manual",
    });
  }

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.45)", opacity: shown ? 1 : 0, transition: "opacity 160ms ease" }} />
      <div className="vy-card" style={{ position: "relative", width: "min(460px, 100%)", padding: 0, maxHeight: "90vh", overflowY: "auto", transform: shown ? "translateY(0)" : "translateY(8px)", opacity: shown ? 1 : 0, transition: "all 180ms ease" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{isEdit ? "Edit entry" : "Log entry"}</h3>
          <button type="button" className="vy-icon-btn" onClick={onClose} aria-label="Close"><VyIcon name="x" size={16} /></button>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Type segmented */}
          <div>
            <label style={finLabel}>Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {Object.keys(FIN_KIND_META).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  style={{ padding: "8px 4px", fontSize: 11.5, fontWeight: 600, borderRadius: 8, cursor: "pointer", border: "1px solid " + (kind === k ? "hsl(var(--primary))" : "hsl(var(--border))"), background: kind === k ? "hsl(var(--primary))" : "hsl(var(--background))", color: kind === k ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" }}>
                  {FIN_KIND_META[k].label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 6 }}>
              {kind === "revenue" ? "Money in (e.g. Amazon payout). Increases net." :
               kind === "expense" ? "Business cost (COGS, ads, fees). Reduces net." :
               kind === "draw" ? "A partner takes money out. A distribution — does NOT reduce net." :
               "A partner puts money in. Reduces their drawn balance."}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={finLabel}>Date</label>
              <input type="date" className="vy-input" style={finInput} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label style={finLabel}>Amount (USD)</label>
              <input type="number" min="0" step="0.01" className="vy-input" style={finInput} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: needsPartner ? "1fr 1fr" : "1fr", gap: 12 }}>
            {needsPartner ? (
              <div>
                <label style={finLabel}>Partner</label>
                <select className="vy-input" style={finInput} value={partner} onChange={(e) => setPartner(e.target.value)}>
                  {config.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            ) : null}
            <div>
              <label style={finLabel}>Account</label>
              <select className="vy-input" style={finInput} value={account} onChange={(e) => setAccount(e.target.value)}>
                {config.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={finLabel}>Note</label>
            <input type="text" className="vy-input" style={finInput} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Amazon payout — May settlement" />
          </div>
        </div>
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid hsl(var(--border))", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" onClick={submit}>{isEdit ? "Save changes" : "Log entry"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ======================================================================
// PARTNERS & SPLIT MODAL
// ======================================================================
function FinPartnersModal({ config, onClose, onSubmit }) {
  const [shown, setShown] = useFinState(false);
  const [partners, setPartners] = useFinState(() => config.partners.map((p) => ({ ...p })));
  const [taxPct, setTaxPct] = useFinState(String(Math.round((config.taxReservePct || 0) * 100)));
  useFinEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }, []);

  const totalShare = partners.reduce((n, p) => n + (Number(p.share) || 0), 0);

  function setField(i, key, val) {
    setPartners((prev) => { const next = prev.map((p) => ({ ...p })); next[i][key] = val; return next; });
  }
  function submit() {
    const cleaned = partners.map((p) => ({ ...p, share: Number(p.share) || 0, initials: p.initials || finInitials(p.name) }));
    const sum = cleaned.reduce((n, p) => n + p.share, 0);
    if (Math.abs(sum - 1) > 0.001) { window.alert("Ownership shares must add up to 100% (currently " + Math.round(sum * 100) + "%)."); return; }
    onSubmit({ partners: cleaned.map((p) => ({ id: p.id, name: p.name, share: p.share })), taxReservePct: (Number(taxPct) || 0) / 100 });
  }

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.45)", opacity: shown ? 1 : 0, transition: "opacity 160ms ease" }} />
      <div className="vy-card" style={{ position: "relative", width: "min(460px, 100%)", padding: 0, transform: shown ? "translateY(0)" : "translateY(8px)", opacity: shown ? 1 : 0, transition: "all 180ms ease" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid hsl(var(--border))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Partners &amp; split</h3>
          <button type="button" className="vy-icon-btn" onClick={onClose} aria-label="Close"><VyIcon name="x" size={16} /></button>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {partners.map((p, i) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: 10, alignItems: "end" }}>
              <div>
                <label style={finLabel}>Partner {i + 1} name</label>
                <input type="text" className="vy-input" style={finInput} value={p.name} onChange={(e) => setField(i, "name", e.target.value)} />
              </div>
              <div>
                <label style={finLabel}>Share %</label>
                <input type="number" min="0" max="100" className="vy-input" style={finInput} value={Math.round((Number(p.share) || 0) * 100)} onChange={(e) => setField(i, "share", (Number(e.target.value) || 0) / 100)} />
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: Math.abs(totalShare - 1) > 0.001 ? "hsl(38 92% 45%)" : "hsl(var(--muted-fg))" }}>
            Total ownership: {Math.round(totalShare * 100)}% {Math.abs(totalShare - 1) > 0.001 ? "— must equal 100%" : "✓"}
          </div>
          <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", background: "hsl(var(--muted) / 0.4)", borderRadius: 8, padding: "9px 11px", lineHeight: 1.5 }}>
            Owners come from <a href="Vyonix Settings.html?section=team" style={{ color: "hsl(var(--primary))", fontWeight: 600 }}>Settings → Team &amp; roles</a> — the single source of truth for people. To add or remove an owner, invite them there. Here you set their <strong style={{ color: "hsl(var(--foreground))" }}>ownership %</strong> (saved back to their team record).
          </div>
          <div>
            <label style={finLabel}>Tax reserve (advisory)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min="0" max="60" className="vy-input" style={{ ...finInput, width: 96 }} value={taxPct} onChange={(e) => setTaxPct(e.target.value)} />
              <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>% of net to set aside for taxes</span>
            </div>
          </div>
        </div>
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid hsl(var(--border))", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" onClick={submit}>Save</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---- CSV export ----
function finExportCsv(entries, config) {
  const pn = (id) => { const p = config.partners.find((x) => x.id === id); return p ? p.name : ""; };
  const an = (id) => { const a = config.accounts.find((x) => x.id === id); return a ? a.name : id; };
  const rows = [["Date", "Type", "Partner", "Account", "Amount", "Note"]];
  entries.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")).forEach((e) => {
    rows.push([e.date, e.kind, e.partner ? pn(e.partner) : "Company", an(e.account), e.amount, (e.note || "").replace(/"/g, '""')]);
  });
  const csv = rows.map((r) => r.map((c) => /[",\n]/.test(String(c)) ? '"' + c + '"' : c).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "vyonix-finances.csv"; a.click();
  URL.revokeObjectURL(url);
}

ReactDOM.createRoot(document.getElementById("vy-root")).render(<FinancesPage />);
