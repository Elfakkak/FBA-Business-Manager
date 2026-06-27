// Vyonix Invoices — portfolio accounts-payable across ALL orders.
// Route: /operations/invoices
// Header → KPIs → overdue banner → filter → table (with due-date aging) →
// aging buckets. Each invoice links back to its order; the per-order Invoices
// section (VyInvoicesBody) remains the detail view.

const { useState: usePayState, useEffect: usePayEffect } = React;

const payTh = { textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" };
const payTd = { padding: "12px 12px", color: "hsl(var(--foreground))", fontSize: 12.5, whiteSpace: "nowrap" };
const payMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const payInput = { height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
function InvoicesPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = usePayState(false);
  const [mobileNavOpen, setMobileNavOpen] = usePayState(false);
  const [isDark, setIsDark] = usePayState(false);
  const [query, setQuery] = usePayState("");
  const [vtype, setVtype] = usePayState("All");
  const [status, setStatus] = usePayState("All");
  const [orderF, setOrderF] = usePayState("All");
  const [invoices, setInvoices] = usePayState(() => PAY_INVOICES.map((i) => ({ ...i })));
  const [payTarget, setPayTarget] = usePayState(null); // invoice id to record against, or "" for picker
  const [drawerId, setDrawerId] = usePayState(null); // invoice open in the detail drawer
  const [toast, setToast] = usePayState(null);

  usePayEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);
  usePayEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function recordPayment(invId, amount, method, ref) {
    const inv = invoices.find((i) => i.id === invId);
    if (inv && typeof payLogPayment === "function") {
      const today = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
      payLogPayment(inv, { id: (ref && ref.trim()) || ("PAY-" + Date.now().toString().slice(-5)), date: today, amount: Math.round(amount * 100) / 100, method: method || "Mercury", status: "Cleared", proof: false });
    }
    // bump so canonical (store-backed) paid/balance re-read
    setInvoices((prev) => prev.map((i) => (i.id === invId ? { ...i } : i)));
    setPayTarget(null);
    setToast({ id: invId, amount, vendor: inv ? inv.vendor : "" });
  }

  const vtypes = ["All", ...PAY_VENDOR_TYPES];
  const statusChips = ["All", "Overdue", "Unpaid", "Partial", "Paid"];

  const filtered = invoices.filter((inv) => {
    if (vtype !== "All" && inv.vendorType !== vtype) return false;
    if (orderF !== "All" && inv.orderId !== orderF) return false;
    if (status !== "All") {
      if (status === "Overdue") { if (payAging(inv).label !== "Overdue") return false; }
      else if (payStatus(inv) !== status) return false;
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = [inv.id, inv.vendor, inv.vendorType, inv.orderId, inv.orderTitle].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  // Orders present in the payables, for the order filter.
  const orderOptions = [...new Map(invoices.map((i) => [i.orderId, i.orderTitle])).entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  // KPIs across ALL invoices
  const totalInvoiced = invoices.reduce((n, i) => n + i.total, 0);
  const totalPaid = invoices.reduce((n, i) => n + ((typeof payEffectivePaid === "function") ? payEffectivePaid(i) : i.paid), 0);
  const outstanding = invoices.reduce((n, i) => n + payBalance(i), 0);
  const openCount = invoices.filter((i) => payBalance(i) > 0.005).length;
  const overdue = invoices.filter((i) => payAging(i).label === "Overdue");
  const overdueAmt = overdue.reduce((n, i) => n + payBalance(i), 0);
  const dueSoon = invoices.filter((i) => payAging(i).label === "Due soon");
  const dueSoonAmt = dueSoon.reduce((n, i) => n + payBalance(i), 0);
  const vendorCount = new Set(invoices.map((i) => i.vendor)).size;
  const paidPct = totalInvoiced ? Math.round((totalPaid / totalInvoiced) * 100) : 0;
  // Proof coverage across all bills — cleared payments with no receipt attached.
  const proofMissing = invoices.reduce((n, i) => n + (typeof payProofMissing === "function" ? payProofMissing(i) : 0), 0);
  const proofMissInvCount = invoices.filter((i) => (typeof payProofMissing === "function" ? payProofMissing(i) : 0) > 0).length;

  const kpis = [
    { icon: "dollar", label: "Outstanding", value: payFmt(outstanding), sub: openCount + " open invoices", tone: outstanding > 0 ? "warning" : "success" },
    { icon: "alert", label: "Overdue", value: payFmt(overdueAmt), sub: overdue.length + (overdue.length === 1 ? " invoice" : " invoices"), tone: overdue.length ? "danger" : undefined },
    { icon: "calendar", label: "Due ≤ 7 days", value: payFmt(dueSoonAmt), sub: dueSoon.length + (dueSoon.length === 1 ? " invoice" : " invoices"), tone: dueSoon.length ? "warning" : undefined },
    { icon: "check", label: "Paid", value: payFmt(totalPaid), sub: paidPct + "% of " + payFmt(totalInvoiced) },
    { icon: "shield", label: "Proof missing", value: String(proofMissing), sub: proofMissing ? proofMissInvCount + (proofMissInvCount === 1 ? " invoice" : " invoices") : "all receipts attached", tone: proofMissing ? "warning" : "success" },
    { icon: "receipt", label: "Vendors", value: String(vendorCount), sub: invoices.length + " invoices" },
  ];

  // Aging buckets (outstanding balance by time band)
  const buckets = [
    { key: "Overdue", tone: "danger", test: (a) => a.label === "Overdue" },
    { key: "Due ≤ 7d", tone: "warning", test: (a) => a.label === "Due soon" },
    { key: "8–30 days", tone: "info", test: (a) => a.days > 7 && a.days <= 30 },
    { key: "30+ days", tone: "muted", test: (a) => a.days > 30 },
  ].map((b) => {
    const amt = invoices.filter((i) => payBalance(i) > 0.005 && b.test(payAging(i))).reduce((n, i) => n + payBalance(i), 0);
    return { ...b, amt };
  });
  const bucketMax = Math.max(1, ...buckets.map((b) => b.amt));

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Invoices" />
      <div className="vy-app-main">
        <VyHeader
          onToggleMobileNav={() => setMobileNavOpen(true)}
          onOpenSearch={() => {}}
          onToggleTheme={() => setIsDark(!isDark)}
          isDark={isDark}
          onToggleActivity={() => {}}
          workspaceName="Operations"
          tabs={OPERATIONS_TABS}
          activeTab="invoices"
        />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Page header */}
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Operations</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>Invoices</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0" }}>
                  Every vendor bill across all orders, by due date. Supplier PIs, freight, agent and inspection fees — what you owe, to whom, and when.
                </p>
              </div>
              <div className="vy-page-head-actions" style={{ marginLeft: "auto" }}>
                <button type="button" className="vy-btn vy-btn--ghost" onClick={() => {}}>
                  <VyIcon name="arrowUpRight" size={14} /><span>Export</span>
                </button>
                <button type="button" className="vy-btn vy-btn--primary" onClick={() => setPayTarget("")}>
                  <VyIcon name="dollar" size={14} /><span>Record payment</span>
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
                  </div>
                  <div className="vy-kpi-value" style={{ fontSize: 18 }}>{k.value}</div>
                  <div className="vy-kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Overdue banner */}
            {overdue.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderRadius: 10, background: "hsl(var(--danger) / 0.07)", border: "1px solid hsl(var(--danger) / 0.25)" }}>
                <span className="vy-badge vy-badge--danger" style={{ flexShrink: 0 }}>Overdue</span>
                <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
                  <strong style={{ fontWeight: 600 }}>{payFmt(overdueAmt)} past due across {overdue.length} {overdue.length === 1 ? "invoice" : "invoices"}</strong>
                  <span style={{ color: "hsl(var(--muted-fg))" }}>&nbsp;&nbsp;Unpaid balances can hold production or cargo release.</span>
                </div>
                <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ flexShrink: 0, fontSize: 12 }} onClick={() => setStatus("Overdue")}>
                  <VyIcon name="alert" size={12} /><span>Show overdue</span>
                </button>
              </div>
            ) : null}

            {/* Filter bar */}
            <div className="vy-card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ position: "relative", flex: "1 1 300px", minWidth: 0 }}>
                  <VyIcon name="search" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-fg))" }} />
                  <input type="text" className="vy-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoice, vendor, order" style={{ ...payInput, width: "100%", paddingLeft: 34 }} />
                </div>
                <select className="vy-input" style={{ ...payInput, width: 150 }} value={vtype} onChange={(e) => setVtype(e.target.value)}>
                  {vtypes.map((v) => <option key={v}>{v}</option>)}
                </select>
                <select className="vy-input" style={{ ...payInput, width: 220, maxWidth: "100%" }} value={orderF} onChange={(e) => setOrderF(e.target.value)}>
                  <option value="All">All orders</option>
                  {orderOptions.map(([oid, title]) => <option key={oid} value={oid}>{oid}{title ? " · " + title : ""}</option>)}
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
              </div>
            </div>

            {/* Invoices table */}
            <div className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
                <span className="vy-kicker">{filtered.length} {filtered.length === 1 ? "invoice" : "invoices"}</span>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Balance = total − paid</span>
              </div>
              <div style={{ overflowX: "auto", borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
                  <thead>
                    <tr style={{ background: "hsl(var(--muted-bg) / 0.5)" }}>
                      <th style={payTh}>Invoice</th>
                      <th style={payTh}>Order</th>
                      <th style={payTh}>Vendor</th>
                      <th style={payTh}>Due</th>
                      <th style={{ ...payTh, textAlign: "right" }}>Total</th>
                      <th style={{ ...payTh, textAlign: "right" }}>Paid</th>
                      <th style={{ ...payTh, textAlign: "right" }}>Balance</th>
                      <th style={payTh}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv) => {
                      const bal = payBalance(inv);
                      const st = payStatus(inv);
                      const aging = payAging(inv);
                      const peff = (typeof payEffectivePaid === "function") ? payEffectivePaid(inv) : inv.paid;
                      return (
                        <tr key={inv.id} className="vy-order-row" onClick={() => setDrawerId(inv.id)} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)", cursor: "pointer" }}>
                          <td style={payTd}>
                            <a href={"Vyonix Invoice.html?invoice=" + encodeURIComponent(inv.id)} onClick={(e) => e.stopPropagation()} className="vy-row-title" title="Open invoice page" style={{ ...payMono, fontWeight: 700, fontSize: 12, color: "inherit", textDecoration: "none" }}>{inv.id}</a>
                            <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{inv.vendorType}</div>
                          </td>
                          <td style={payTd}>
                            <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(inv.orderId)} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none", color: "inherit" }}>
                              <div style={{ ...payMono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{inv.orderId}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{inv.orderTitle}</div>
                            </a>
                          </td>
                          <td style={{ ...payTd, fontWeight: 500 }}>{inv.vendor}</td>
                          <td style={payTd}>
                            <div style={{ ...payMono, fontSize: 12 }}>{payDueLabel(inv.due)}</div>
                            <div style={{ marginTop: 3 }}>
                              <span className={"vy-badge vy-badge--" + aging.tone}>
                                {aging.label === "Overdue" ? Math.abs(aging.days) + "d overdue"
                                  : aging.label === "Due soon" ? "in " + aging.days + "d"
                                  : aging.label === "Settled" ? "settled"
                                  : "in " + aging.days + "d"}
                              </span>
                            </div>
                          </td>
                          <td style={{ ...payTd, ...payMono, textAlign: "right" }}>{payFmt(inv.total)}</td>
                          <td style={{ ...payTd, ...payMono, textAlign: "right", color: "hsl(var(--muted-fg))" }}>{peff > 0 ? payFmt(peff) : "—"}</td>
                          <td style={{ ...payTd, ...payMono, textAlign: "right", fontWeight: 700, color: bal > 0 ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{bal > 0 ? payFmt(bal) : "—"}</td>
                          <td style={payTd}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className={"vy-badge vy-badge--" + PAY_STATUS_TONE[st]}>{st}</span>
                              {bal > 0.005 ? (
                                <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11 }} onClick={(e) => { e.stopPropagation(); setPayTarget(inv.id); }}>
                                  <VyIcon name="dollar" size={11} /><span>Record</span>
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 ? (
                      <tr><td colSpan={8} style={{ ...payTd, textAlign: "center", padding: "36px 12px", color: "hsl(var(--muted-fg))" }}>No invoices match your filters.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Aging buckets */}
            <section className="vy-card" style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                  <VyIcon name="calendar" size={15} />
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Payables aging</h3>
                  <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>Outstanding balance by when it's due — pay the left bars first.</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {buckets.map((b) => {
                  const pct = Math.round((b.amt / bucketMax) * 100);
                  return (
                    <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 88, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{b.key}</span>
                      <div style={{ flex: 1, height: 10, borderRadius: 999, background: "hsl(var(--muted-bg))", overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: pct + "%", background: "hsl(var(--" + b.tone + "))", borderRadius: 999 }} />
                      </div>
                      <span style={{ width: 96, textAlign: "right", fontSize: 12.5, fontWeight: 700, ...payMono }}>{payFmt(b.amt)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Invoices" />

      {payTarget !== null ? (
        <PayRecordModal invoices={invoices} initialId={payTarget} onClose={() => setPayTarget(null)} onSubmit={recordPayment} />
      ) : null}

      {drawerId ? (
        <PayInvDrawer
          inv={invoices.find((i) => i.id === drawerId)}
          onClose={() => setDrawerId(null)}
          onRecord={() => { setDrawerId(null); setPayTarget(drawerId); }}
        />
      ) : null}

      {toast ? (
        <div role="status" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 12, zIndex: 200, padding: "12px 16px", borderRadius: 12, maxWidth: 480, background: "hsl(var(--foreground))", color: "hsl(var(--background))", boxShadow: "0 12px 32px -8px hsl(0 0% 0% / 0.35)" }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", background: "hsl(var(--primary))", color: "#fff", flexShrink: 0 }}>
            <VyIcon name="check" size={14} />
          </span>
          <div style={{ fontSize: 13, lineHeight: 1.35 }}>
            <strong style={{ fontWeight: 600 }}>Payment recorded.</strong>
            <span style={{ opacity: 0.8 }}>&nbsp;{payFmt(toast.amount)} · {toast.id}</span>
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
// RECORD PAYMENT MODAL — pick an open invoice, log an amount against it
// ----------------------------------------------------------------------
function PayRecordModal({ invoices, initialId, onClose, onSubmit }) {
  const open = invoices.filter((i) => payBalance(i) > 0.005);
  const firstId = initialId || (open[0] ? open[0].id : (invoices[0] ? invoices[0].id : ""));
  const [invId, setInvId] = usePayState(firstId);
  const inv = invoices.find((i) => i.id === invId) || invoices[0];
  const balance = inv ? payBalance(inv) : 0;
  const [amount, setAmount] = usePayState(balance > 0 ? balance.toFixed(2) : "");
  const [method, setMethod] = usePayState("Mercury");
  const [ref, setRef] = usePayState("");

  usePayEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pick(id) {
    setInvId(id);
    const next = invoices.find((i) => i.id === id);
    const bal = next ? payBalance(next) : 0;
    setAmount(bal > 0 ? bal.toFixed(2) : "");
  }

  const amt = Number(amount) || 0;
  const over = amt > balance + 0.005;
  const valid = amt > 0 && inv;

  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Record payment</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>Log a payment against an open invoice. Balance and aging update live.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="x" size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Invoice</span>
            <select className="vy-input" style={{ ...payInput, width: "100%" }} value={invId} onChange={(e) => pick(e.target.value)}>
              {invoices.map((i) => {
                const b = payBalance(i);
                return <option key={i.id} value={i.id}>{i.id} · {i.vendor} · {b > 0.005 ? payFmt(b) + " due" : "settled"}</option>;
              })}
            </select>
          </label>

          {/* Balance context strip */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 14px", borderRadius: 10, background: "hsl(var(--accent) / 0.6)", border: "1px solid hsl(var(--border))" }}>
            <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>Total <strong style={{ color: "hsl(var(--foreground))", fontWeight: 700 }}>{payFmt(inv ? inv.total : 0)}</strong></span>
            <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>Paid <strong style={{ color: "hsl(var(--foreground))", fontWeight: 700 }}>{payFmt(inv ? ((typeof payEffectivePaid === "function") ? payEffectivePaid(inv) : inv.paid) : 0)}</strong></span>
            <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>Balance <strong style={{ color: balance > 0 ? "hsl(var(--warning))" : "hsl(var(--success))", fontWeight: 700 }}>{payFmt(balance)}</strong></span>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 calc(50% - 7px)" }}>
              <span className="vy-kicker">Amount (USD)</span>
              <input type="number" className="vy-input" style={{ ...payInput, width: "100%", borderColor: over ? "hsl(var(--warning))" : undefined }} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              {over ? <span style={{ fontSize: 10.5, color: "hsl(var(--warning))" }}>Exceeds the {payFmt(balance)} balance — capped on save.</span> : null}
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 calc(50% - 7px)" }}>
              <span className="vy-kicker">Method</span>
              <select className="vy-input" style={{ ...payInput, width: "100%" }} value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Mercury</option><option>Wire</option><option>Wise</option><option>Alipay</option><option>Cash</option><option>Other</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 100%" }}>
              <span className="vy-kicker">Reference (optional)</span>
              <input className="vy-input" style={{ ...payInput, width: "100%" }} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. MERC-0531" />
            </label>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={() => onSubmit(invId, Math.min(amt, balance), method, ref)}>
            <VyIcon name="check" size={14} /><span>Record payment</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// INVOICE DETAIL DRAWER — quick look at one portfolio invoice (read view):
// totals, order link, aging, payments-so-far; Record payment + Open order.
// ----------------------------------------------------------------------
function PayInvDrawer({ inv, onClose, onRecord }) {
  const [shown, setShown] = usePayState(false);
  usePayEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(r); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  if (!inv) return null;
  const bal = payBalance(inv);
  const st = payStatus(inv);
  const aging = payAging(inv);
  const mono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.4)", opacity: shown ? 1 : 0, transition: "opacity 200ms ease" }}></div>
      <aside style={{ position: "absolute", top: 0, right: 0, height: "100%", width: "min(440px, 94vw)", background: "hsl(var(--card))", borderLeft: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", transform: shown ? "translateX(0)" : "translateX(100%)", transition: "transform 240ms cubic-bezier(0.32,0.72,0,1)" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...mono, fontSize: 16, fontWeight: 700 }}>{inv.id}</div>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{inv.vendor} · {inv.vendorType}</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))", flexShrink: 0 }}><VyIcon name="x" size={18} /></button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            <span className={"vy-badge vy-badge--" + PAY_STATUS_TONE[st]}>{st}</span>
            <span className={"vy-badge vy-badge--" + aging.tone}>{aging.label === "Overdue" ? Math.abs(aging.days) + "d overdue" : aging.label === "Settled" ? "settled" : "due in " + aging.days + "d"}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "12px 14px", borderRadius: 10, background: "hsl(var(--background) / 0.5)", border: "1px solid hsl(var(--border))" }}>
            <div style={{ flex: "1 1 80px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Total</div><div style={{ ...mono, fontSize: 15, fontWeight: 700 }}>{payFmt(inv.total)}</div></div>
            <div style={{ flex: "1 1 80px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Paid</div><div style={{ ...mono, fontSize: 15, fontWeight: 700, color: "hsl(var(--success))" }}>{(() => { const pe = (typeof payEffectivePaid === "function") ? payEffectivePaid(inv) : inv.paid; return pe > 0 ? payFmt(pe) : "—"; })()}</div></div>
            <div style={{ flex: "1 1 80px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Balance</div><div style={{ ...mono, fontSize: 15, fontWeight: 700, color: bal > 0 ? "hsl(var(--warning))" : "hsl(var(--success))" }}>{bal > 0 ? payFmt(bal) : "Settled"}</div></div>
            <div style={{ flex: "1 1 80px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Due</div><div style={{ fontSize: 14, fontWeight: 600 }}>{payDueLabel(inv.due)}</div></div>
          </div>

          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Details</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <div style={{ flex: "1 1 120px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Issued</div><div style={{ ...mono, fontSize: 13, fontWeight: 600 }}>{payDueLabel(inv.issued)}</div></div>
              <div style={{ flex: "1 1 120px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Due</div><div style={{ ...mono, fontSize: 13, fontWeight: 600 }}>{payDueLabel(inv.due)}</div></div>
            </div>
          </div>

          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Lines / charges</div>
            <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <tbody>
                  {(typeof payInvoiceLines === "function" ? payInvoiceLines(inv) : payLines(inv)).map((l, k) => (
                    <tr key={k} style={{ borderTop: k ? "1px solid hsl(var(--border))" : "none" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>{l.label}<div style={{ fontWeight: 400, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{l.sku ? l.sku + (l.qty ? " · " + l.qty.toLocaleString() + " pcs" : "") : l.type}</div></td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, ...mono, color: l.amount < 0 ? "hsl(var(--success))" : undefined }}>{payFmt(l.amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--muted-bg) / 0.4)" }}>
                    <td style={{ padding: "9px 12px", fontWeight: 700 }}>Total</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, ...mono }}>{payFmt(inv.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            {(() => {
              const pays = (typeof payInvoicePayments === "function") ? payInvoicePayments(inv) : payPayments(inv);
              return (
                <>
                  <div className="vy-kicker" style={{ marginBottom: 8 }}>Payments ({pays.length})</div>
                  {pays.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {pays.map((p, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
                          <div style={{ minWidth: 48, fontSize: 12, fontWeight: 600, color: "hsl(var(--muted-fg))" }}>{p.date}</div>
                          <div style={{ minWidth: 84, fontSize: 13.5, fontWeight: 700, ...mono }}>{payFmt(p.amount)}</div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{p.method}</div>
                          <span className="vy-badge vy-badge--success">{p.status}</span>
                          {p.proof ? <span className="vy-badge vy-badge--success">Receipt</span> : <span className="vy-badge vy-badge--warning">Proof?</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: "16px", textAlign: "center", border: "1px dashed hsl(var(--border))", borderRadius: 10, fontSize: 12, color: "hsl(var(--muted-fg))" }}>No payments yet — record one to start.</div>
                  )}
                </>
              );
            })()}
          </div>

          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Order</div>
            <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(inv.orderId) + "#invoices"} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)", textDecoration: "none", color: "inherit" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="cube" size={15} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...mono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{inv.orderId}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{inv.orderTitle}</div>
              </div>
              <VyIcon name="arrowUpRight" size={14} style={{ opacity: 0.5 }} />
            </a>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))" }}>
          <a href={"Vyonix Invoice.html?invoice=" + encodeURIComponent(inv.id)} className="vy-btn vy-btn--primary" style={{ textDecoration: "none", width: "100%", justifyContent: "center" }}>
            <VyIcon name="receipt" size={14} /><span>Open full invoice</span><VyIcon name="arrowRight" size={14} />
          </a>
          <div style={{ display: "flex", gap: 10 }}>
            {bal > 0.005 ? (
              <button type="button" className="vy-btn vy-btn--outline" onClick={onRecord} style={{ flex: 1, justifyContent: "center" }}>
                <VyIcon name="dollar" size={14} /><span>Record payment</span>
              </button>
            ) : null}
            <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose} style={bal > 0.005 ? undefined : { flex: 1, justifyContent: "center" }}>Close</button>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}

const payRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
payRoot.render(<InvoicesPage />);
