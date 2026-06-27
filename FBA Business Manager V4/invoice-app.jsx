// invoice-app.jsx — full detail PAGE for one vendor invoice (accounts-payable).
// Route: Vyonix Invoice.html?invoice=<id>. The Invoices-list row title + the
// drawer's "Open invoice" button link here; the list keeps its quick drawer.
// This is the deep view the drawer can't be: a payment SCHEDULE (deposit/
// balance installments with due dates + progress), a running-balance payments
// LEDGER, the vendor seam, the order seam, and a DOCUMENT drop-zone for the
// real invoice scan. Reads payables-data.jsx; persists the same applied store.
// Load AFTER payables-data.jsx + image-slot.js.

const { useState: useInvState, useEffect: useInvEffect } = React;
const invMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };

function InvCard({ title, sub, actions, icon, iconTone = "primary", children, pad = "16px 18px" }) {
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

// Vendor type → which directory page owns it (supplier vs trading partner).
function invVendorHref(inv) {
  if (inv.vendorType === "Supplier") return "Vyonix Supplier.html?supplier=" + encodeURIComponent(inv.vendor);
  return "Vyonix Partner.html?partner=" + encodeURIComponent(inv.vendor);
}
const INV_VENDOR_ICON = { Supplier: "factory", Forwarder: "ship", Agent: "package", Inspection: "clipboard" };

function InvoicePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useInvState(false);
  const [mobileNavOpen, setMobileNavOpen] = useInvState(false);
  const [isDark, setIsDark] = useInvState(false);
  const [payOpen, setPayOpen] = useInvState(false);
  const [editOpen, setEditOpen] = useInvState(false);
  const [chargesOpen, setChargesOpen] = useInvState(false);
  const [, force] = useInvState(0);

  useInvEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  const params = new URLSearchParams(window.location.search);
  const invId = params.get("invoice");
  let inv = PAY_INVOICES.find((x) => x.id === invId) || null;
  // Fallback: invoices created in an order's Invoices section live only in the
  // shared working set, not the PAY_INVOICES seed — resolve them too.
  if (!inv && typeof payStoreLoad === "function") {
    const store = payStoreLoad();
    for (const oid in store) {
      const rec = (store[oid] || []).find((r) => r.id === invId);
      if (rec) { inv = { issued: "", orderTitle: "", paid: 0, ...rec, orderId: rec.orderId || oid }; break; }
    }
  }

  // Overlay any edited identity fields (vendor/type/total) from the shared store.
  const stored0 = (inv && typeof payStoredInvoice === "function") ? payStoredInvoice(inv) : null;
  if (inv && stored0) inv = { ...inv, vendor: stored0.vendor != null ? stored0.vendor : inv.vendor, vendorType: stored0.vendorType != null ? stored0.vendorType : inv.vendorType, via: stored0.via != null ? stored0.via : inv.via, total: stored0.total != null ? stored0.total : inv.total };

  if (!inv) {
    return (
      <div className="vy-app">
        <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} active="Invoices" />
        <div className="vy-app-main">
          <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} />
          <main className="vy-content"><div className="vy-content-inner">
            <div className="vy-card" style={{ padding: 40, textAlign: "center" }}>
              <p style={{ color: "hsl(var(--muted-fg))" }}>Invoice not found.</p>
              <a href="Vyonix Invoices.html" className="vy-btn vy-btn--primary" style={{ textDecoration: "none", marginTop: 12 }}>Back to Invoices</a>
            </div>
          </div></main>
        </div>
        <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Invoices" />
      </div>
    );
  }

  const bal = payBalance(inv);
  const paidEff = payEffectivePaid(inv);
  const st = payStatus(inv);
  const aging = payAging(inv);
  const termsCfg = payInvoiceTerms(inv);
  const termsLabel = payTermSummary(termsCfg);
  const schedule = payTermSchedule(termsCfg, inv.total, paidEff);
  const lines = (typeof payInvoiceLines === "function") ? payInvoiceLines(inv) : payLines(inv);
  const reconcile = (typeof payGoodsReconcile === "function") ? payGoodsReconcile(inv) : null;
  const ledger = payLedger(inv);
  const paidPct = inv.total ? Math.round((paidEff / inv.total) * 100) : 0;

  function recordPayment(record) {
    payLogPayment(inv, record);
    setPayOpen(false);
    force((n) => n + 1);
  }
  function saveEdit(patch) {
    paySaveInvoiceFields(inv, patch);
    setEditOpen(false);
    force((n) => n + 1);
  }

  const agingText = aging.label === "Overdue" ? Math.abs(aging.days) + "d overdue"
    : aging.label === "Settled" ? "settled"
    : aging.label === "Due soon" ? "due in " + aging.days + "d" : "due in " + aging.days + "d";

  const kpis = [
    { label: "Total", value: payFmt(inv.total), sub: lines.length + (lines.length === 1 ? " charge" : " charges") },
    { label: "Paid", value: paidEff > 0 ? payFmt(paidEff) : "—", sub: paidPct + "% of total", tone: paidEff > 0 ? "success" : null },
    { label: "Balance", value: bal > 0.005 ? payFmt(bal) : "Settled", sub: bal > 0.005 ? "outstanding" : "fully paid", tone: bal > 0.005 ? "warning" : "success" },
    { label: "Due", value: payDueLabel(inv.due), sub: agingText, tone: aging.tone === "muted" ? null : aging.tone },
    { label: "Status", value: st, sub: termsLabel, tone: PAY_STATUS_TONE[st] },
  ];

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Invoices" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} workspaceName="Operations" tabs={[{ key: "inv", label: "Invoice" }]} activeTab="inv" />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Breadcrumb */}
            <nav className="vy-breadcrumb" aria-label="Breadcrumb">
              <a href="Vyonix Invoices.html" className="vy-bc-link">Operations</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <a href="Vyonix Invoices.html" className="vy-bc-link">Invoices</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <span className="vy-bc-current" aria-current="page">{inv.id}</span>
            </nav>

            {/* Header */}
            <section className="vy-card" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h1 className="vy-title" style={{ margin: 0, ...invMono }}>{inv.id}</h1>
                    <span className={"vy-badge vy-badge--" + PAY_STATUS_TONE[st]}>{st}</span>
                    <span className={"vy-badge vy-badge--" + aging.tone}>{agingText}</span>
                  </div>
                  <div className="vy-title-meta" style={{ marginTop: 12 }}>
                    <span className="vy-chip"><VyIcon name={INV_VENDOR_ICON[inv.vendorType] || "factory"} size={11} />{inv.vendor}</span>
                    <span className="vy-chip"><VyIcon name="receipt" size={11} />{inv.vendorType}</span>
                    <span className="vy-chip"><VyIcon name="calendar" size={11} />Issued {payDueLabel(inv.issued)}</span>
                    <span className="vy-chip"><VyIcon name="cube" size={11} />{inv.orderTitle}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {bal > 0.005 ? (
                    <button type="button" className="vy-btn vy-btn--primary" onClick={() => setPayOpen(true)}><VyIcon name="dollar" size={13} /><span>Record payment</span></button>
                  ) : null}
                  <button type="button" className="vy-btn vy-btn--outline" onClick={() => setEditOpen(true)}><VyIcon name="pencil" size={13} /><span>Edit</span></button>
                  <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(inv.orderId) + "#invoices"} className="vy-btn vy-btn--outline" style={{ textDecoration: "none" }}><VyIcon name="cube" size={13} /><span>Open order</span></a>
                </div>
              </div>
            </section>

            {/* KPI strip */}
            <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              {kpis.map((k) => (
                <div className={"vy-card vy-kpi" + (k.tone ? " vy-kpi--" + k.tone : "")} key={k.label}>
                  <span className="vy-kicker">{k.label}</span>
                  <div className="vy-kpi-value" style={{ fontSize: 18, ...invMono, color: k.tone ? "hsl(var(--" + k.tone + "))" : undefined }}>{k.value}</div>
                  <div className="vy-kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            <div className="inv-two-col">
              {/* Left column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Charges */}
                <InvCard icon="receipt" iconTone="info" title="Charges" sub={inv.vendorType === "Supplier" ? "Goods (per SKU) + service charges on this bill." : "What this bill is composed of."} pad="16px 18px 6px"
                  actions={inv.vendorType === "Supplier" ? <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => setChargesOpen(true)}><VyIcon name="pencil" size={12} /><span>Edit charges</span></button> : null}>
                  {reconcile ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", margin: "0 0 12px", borderRadius: 9, border: "1px solid hsl(var(--" + (reconcile.status === "match" ? "success" : "warning") + ") / 0.3)", background: "hsl(var(--" + (reconcile.status === "match" ? "success" : "warning") + ") / 0.07)" }}>
                      <VyIcon name={reconcile.status === "match" ? "check" : "alert"} size={15} style={{ color: "hsl(var(--" + (reconcile.status === "match" ? "success" : "warning") + "))", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                        <span style={{ fontWeight: 700 }}>{reconcile.status === "match" ? "Billed goods match the order" : reconcile.status === "over" ? "Billed over the order" : "Billed under the order"}</span>
                        <span style={{ color: "hsl(var(--muted-fg))" }}> · billed {payFmt(reconcile.billed)} vs ordered {payFmt(reconcile.ordered)} in Production{reconcile.status !== "match" ? " · " + (reconcile.diff > 0 ? "+" : "") + payFmt(reconcile.diff) : ""}</span>
                      </div>
                      <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(inv.orderId) + "#production"} style={{ fontSize: 11.5, fontWeight: 600, color: "hsl(var(--primary))", textDecoration: "none", flexShrink: 0 }}>Production →</a>
                    </div>
                  ) : null}
                  <div style={{ overflowX: "auto", margin: "0 -18px", borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                      <thead>
                        <tr style={{ background: "hsl(var(--muted-bg) / 0.5)" }}>
                          <th style={invTh}>Description</th>
                          <th style={invTh}>Type</th>
                          {reconcile ? <th style={{ ...invTh, textAlign: "right" }} title="From Production — what you ordered">Ordered</th> : null}
                          <th style={{ ...invTh, textAlign: "right" }} title="From this invoice — what the supplier billed">{reconcile ? "Billed" : "Amount"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l, k) => {
                          const g = (reconcile && l.sku) ? reconcile.perSku.find((s) => s.sku === l.sku) : null;
                          const d = g ? Math.round((g.billed - g.ordered) * 100) / 100 : 0;
                          return (
                          <tr key={k} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                            <td style={{ ...invTd, fontWeight: 600, whiteSpace: "normal" }}>
                              <div>{l.label}</div>
                              {l.sku ? <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}><span style={{ ...invMono, fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "hsl(var(--muted-bg))", color: "hsl(var(--muted-fg))" }}>{l.sku}</span>{l.qty ? <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{l.qty.toLocaleString()} units</span> : null}</div> : null}
                            </td>
                            <td style={{ ...invTd, color: "hsl(var(--muted-fg))" }}>{l.type}</td>
                            {reconcile ? <td style={{ ...invTd, ...invMono, textAlign: "right", color: "hsl(var(--muted-fg))" }}>{g ? payFmt(g.ordered) : "—"}</td> : null}
                            <td style={{ ...invTd, ...invMono, textAlign: "right", fontWeight: 700 }}>
                              {payFmt(l.amount)}
                              {g && Math.abs(d) >= 0.01 ? <div style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--" + (d > 0 ? "warning" : "success") + "))" }}>{d > 0 ? "+" : ""}{payFmt(d)}</div> : null}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: "2px solid hsl(var(--border))", background: "hsl(var(--muted-bg) / 0.35)" }}>
                          <td style={{ ...invTd, fontWeight: 700 }}>Total</td>
                          <td style={invTd}></td>
                          {reconcile ? <td style={{ ...invTd, ...invMono, textAlign: "right", color: "hsl(var(--muted-fg))" }}>{payFmt(reconcile.ordered)}</td> : null}
                          <td style={{ ...invTd, ...invMono, textAlign: "right", fontWeight: 700 }}>{payFmt(inv.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {/* Source-of-truth caption so every number's origin is unmistakable */}
                  <p style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", margin: "10px 2px 4px", lineHeight: 1.5 }}>
                    {reconcile
                      ? <span><strong style={{ fontWeight: 600 }}>Goods:</strong> SKU &amp; quantity from <strong style={{ fontWeight: 600 }}>Production</strong> · <strong style={{ fontWeight: 600 }}>Ordered</strong> from Production, <strong style={{ fontWeight: 600 }}>Billed</strong> from this invoice. <strong style={{ fontWeight: 600 }}>Services:</strong> this invoice.</span>
                      : <span>Charges sourced from this invoice.</span>}
                  </p>
                </InvCard>
                <InvCard icon="dollar" iconTone="success" title={"Payments (" + ledger.length + ")"} sub="Every payment recorded against this bill, with the balance after each."
                  actions={bal > 0.005 ? <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => setPayOpen(true)}><VyIcon name="dollar" size={12} /><span>Record</span></button> : null}
                  pad="16px 18px 6px">
                  {ledger.length ? (
                    <div style={{ overflowX: "auto", margin: "0 -18px", borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460 }}>
                        <thead>
                          <tr style={{ background: "hsl(var(--muted-bg) / 0.5)" }}>
                            <th style={invTh}>Date</th>
                            <th style={{ ...invTh, textAlign: "right" }}>Amount</th>
                            <th style={invTh}>Method</th>
                            <th style={invTh}>Proof</th>
                            <th style={{ ...invTh, textAlign: "right" }}>Balance after</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledger.map((p, idx) => (
                            <tr key={idx} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                              <td style={{ ...invTd, color: "hsl(var(--muted-fg))" }}>{p.date}</td>
                              <td style={{ ...invTd, ...invMono, textAlign: "right", fontWeight: 700 }}>{payFmt(p.amount)}</td>
                              <td style={invTd}><span style={{ fontWeight: 600 }}>{p.method}</span> <span className="vy-badge vy-badge--success" style={{ marginLeft: 4 }}>{p.status}</span></td>
                              <td style={invTd}><InvProofCell p={p} amount={p.amount} vendor={inv.vendor} onChange={(patch) => { payUpdatePayment(inv, idx, patch); force((n) => n + 1); }} /></td>
                              <td style={{ ...invTd, ...invMono, textAlign: "right", fontWeight: 600, color: p.balanceAfter > 0.005 ? "hsl(var(--warning))" : "hsl(var(--success))" }}>{p.balanceAfter > 0.005 ? payFmt(p.balanceAfter) : "Settled"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: "22px 0 26px", textAlign: "center", borderTop: "1px solid hsl(var(--border) / 0.7)", fontSize: 12.5, color: "hsl(var(--muted-fg))" }}>
                      No payments yet — record one to start the ledger.
                    </div>
                  )}
                </InvCard>

                {/* Document */}
                <InvCard icon="fileText" iconTone="muted-fg" title="Invoice document" sub="Drop the vendor's PDF or scan here — it stays attached to this invoice.">
                  <image-slot id={"invoice-doc-" + inv.id} style={{ display: "block", width: "100%", height: 300 }} shape="rounded" radius="12" fit="contain" placeholder={"Drop the " + inv.vendor + " invoice (PDF/JPG)"}></image-slot>
                </InvCard>
              </div>

              {/* Right rail */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Payment progress + schedule */}
                {/* Payment terms + schedule for THIS invoice — editable here (Edit), shared with the order's Invoices section */}
                {typeof InvPaymentTermsCard === "function"
                  ? <InvPaymentTermsCard invoice={inv} paid={paidEff} onChanged={() => force((n) => n + 1)} />
                  : null}

                {/* Dates */}
                <InvCard icon="calendar" iconTone="info" title="Dates & terms">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                    <div style={{ flex: "1 1 110px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Issued</div><div style={{ ...invMono, fontSize: 13.5, fontWeight: 600 }}>{payDueLabel(inv.issued)}</div></div>
                    <div style={{ flex: "1 1 110px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Due</div><div style={{ ...invMono, fontSize: 13.5, fontWeight: 600, color: aging.label === "Overdue" ? "hsl(var(--danger))" : undefined }}>{payDueLabel(inv.due)}</div></div>
                    <div style={{ flex: "1 1 110px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Terms</div><div style={{ fontSize: 13, fontWeight: 600 }}>{termsLabel}</div></div>
                  </div>
                </InvCard>

                {/* Vendor */}
                <InvCard icon="factory" iconTone="primary" title="Vendor">
                  <a href={invVendorHref(inv)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)", textDecoration: "none", color: "inherit" }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name={INV_VENDOR_ICON[inv.vendorType] || "factory"} size={16} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{inv.vendor}</div>
                      <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{inv.vendorType}</div>
                    </div>
                    <VyIcon name="arrowUpRight" size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                  </a>
                </InvCard>

                {/* Order */}
                <InvCard icon="cube" iconTone="primary" title="Order">
                  <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(inv.orderId) + "#invoices"} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)", textDecoration: "none", color: "inherit" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...invMono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{inv.orderId}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.orderTitle}</div>
                    </div>
                    <VyIcon name="arrowRight" size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                  </a>
                </InvCard>
              </div>
            </div>
          </div>
        </main>
      </div>

      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Invoices" />
      {payOpen ? <InvPayModal inv={inv} balance={bal} onClose={() => setPayOpen(false)} onSubmit={recordPayment} /> : null}
      {editOpen ? <InvEditModal inv={inv} onClose={() => setEditOpen(false)} onSubmit={saveEdit} /> : null}
      {chargesOpen ? <InvChargesModal inv={inv} onClose={() => setChargesOpen(false)} onSaved={() => { setChargesOpen(false); force((n) => n + 1); }} /> : null}
    </div>
  );
}

// Record-payment modal (page-local). Captures amount, method, and the PROOF of
// payment (wire receipt / bank confirmation) — proof attaches to the payment,
// not the invoice, so each installment carries its own receipt. Writes a real
// payment record into the shared store via payLogPayment.
function InvPayModal({ inv, balance, onClose, onSubmit }) {
  const [amount, setAmount] = useInvState(balance > 0 ? balance.toFixed(2) : "");
  const [method, setMethod] = useInvState("Mercury");
  const [ref, setRef] = useInvState("");
  const [proofVal, setProofVal] = useInvState({ proof: false, proofKind: null, proofName: "", proofTxn: null });
  useInvEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const amt = Math.max(0, Number(amount) || 0);
  const over = amt > balance + 0.005;
  const input = { height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", width: "100%" };

  function submit() {
    const today = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
    onSubmit({
      id: (method || "PAY").slice(0, 4).toUpperCase() + "-" + String(Date.now()).slice(-4),
      date: today,
      amount: Math.min(amt, balance),
      method,
      reference: ref.trim(),
      status: "Cleared",
      proof: !!proofVal.proof,
      proofKind: proofVal.proofKind || null,
      proofName: proofVal.proofName || "",
      proofTxn: proofVal.proofTxn || null,
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 10000, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 460, padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Record payment</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}><span style={{ ...invMono, fontWeight: 600 }}>{inv.id}</span> · {payFmt(balance)} balance</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "18px 24px", display: "flex", flexWrap: "wrap", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 calc(50% - 7px)" }}>
            <span className="vy-kicker">Amount (USD)</span>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...input, borderColor: over ? "hsl(var(--warning))" : "hsl(var(--input))" }} />
            {over ? <span style={{ fontSize: 10.5, color: "hsl(var(--warning))" }}>Exceeds balance — capped on save.</span> : null}
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 calc(50% - 7px)" }}>
            <span className="vy-kicker">Method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)} style={input}>
              <option>Mercury</option><option>Wire</option><option>Wise</option><option>Alipay</option><option>Cash</option><option>Other</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 100%" }}>
            <span className="vy-kicker">Reference (optional)</span>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. MERC-0531" style={input} />
          </label>
          {/* Proof of payment — link a Mercury transaction (verified) or attach a receipt */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 100%" }}>
            <span className="vy-kicker">Proof of payment</span>
            {typeof MercuryProofField === "function"
              ? <MercuryProofField amount={amt} vendor={inv.vendor} value={proofVal} onChange={(patch) => setProofVal((p) => ({ ...p, ...patch }))} />
              : null}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={amt <= 0.005} onClick={submit}><VyIcon name="dollar" size={14} /><span>Save payment</span></button>
        </div>
      </div>
    </div>
  );
}

// Vendor options + type lookup for the page edit modal (from the AP dataset).
function invPageVendors() { return [...new Set((window.PAY_INVOICES || []).map((p) => p.vendor))].filter(Boolean).sort(); }
function invPageVendorType(name) { const h = (window.PAY_INVOICES || []).find((p) => p.vendor === name); return h ? h.vendorType : null; }
const invPageChip = (on) => ({ padding: "7px 13px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? "hsl(var(--primary))" : "hsl(var(--border))"), background: on ? "hsl(var(--primary))" : "hsl(var(--background))", color: on ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" });

// Edit-invoice modal (page-local) — vendor / type / total. Persists to the
// shared store so the order's Invoices section reflects the same edit. Vendor is
// a dropdown; type follows the vendor (read-only for known vendors).
function InvEditModal({ inv, onClose, onSubmit }) {
  const types = ["Supplier", "Agent", "Forwarder", "Inspection", "Other"];
  const viaBy = { Supplier: "Supplier · Goods", Agent: "Agent · Service", Forwarder: "Freight", Inspection: "Service · Inspection", Other: "Other" };
  const [form, setForm] = useInvState({ vendor: inv.vendor || "", type: inv.vendorType || "Supplier", total: String(inv.total != null ? inv.total : "") });
  const [newVendor, setNewVendor] = useInvState(false);
  useInvEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const total = Number(form.total) || 0;
  const valid = form.vendor.trim() && total > 0;
  const input = { height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", width: "100%" };
  const vendorOpts = [...new Set([inv.vendor, ...invPageVendors()])].filter(Boolean).sort();
  function submit() { onSubmit({ vendor: form.vendor.trim(), vendorType: form.type, via: viaBy[form.type], total }); }
  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 10000, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 460, padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Edit invoice</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}><span style={{ ...invMono, fontWeight: 600 }}>{inv.id}</span> · vendor, type follows it &amp; total. Due date &amp; terms edit below.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Vendor</span>
            {!newVendor ? (
              <select value={form.vendor} onChange={(e) => { const v = e.target.value; if (v === "__new__") { setNewVendor(true); setForm((p) => ({ ...p, vendor: "" })); return; } const vt = invPageVendorType(v) || form.type; setForm((p) => ({ ...p, vendor: v, type: vt })); }} style={input}>
                {vendorOpts.map((v) => <option key={v} value={v}>{v}</option>)}
                <option value="__new__">+ New vendor…</option>
              </select>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={form.vendor} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} placeholder="New vendor name" style={input} autoFocus />
                <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ flexShrink: 0 }} onClick={() => { setNewVendor(false); setForm((p) => ({ ...p, vendor: inv.vendor })); }}>Pick existing</button>
              </div>
            )}
          </label>
          {newVendor ? (
            <div>
              <div className="vy-kicker" style={{ marginBottom: 8 }}>Type</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {types.map((t) => <button key={t} type="button" onClick={() => setForm((p) => ({ ...p, type: t }))} style={invPageChip(form.type === t)}>{t}</button>)}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="vy-kicker">Type</span>
              <span className="vy-badge vy-badge--muted">{form.type}</span>
              <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>· from the vendor record</span>
            </div>
          )}
          <label style={{ display: "flex", flexDirection: "column", gap: 5, maxWidth: 200 }}>
            <span className="vy-kicker">Total (USD)</span>
            <input type="number" step="0.01" value={form.total} onChange={(e) => setForm((p) => ({ ...p, total: e.target.value }))} style={input} />
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={submit}><VyIcon name="check" size={14} /><span>Save changes</span></button>
        </div>
      </div>
    </div>
  );
}

// Proof cell for the payments ledger — attach a missing receipt or replace an
// existing one, per payment, anytime (not just at record). Writes via payUpdatePayment.
// Small modal to (re)choose a payment's proof — switch between a linked Mercury
// transaction and an uploaded receipt, change which transaction, or clear it.
function InvProofEditModal({ p, amount, vendor, onClose, onSave }) {
  const [val, setVal] = useInvState({ proof: !!p.proof, proofKind: p.proofKind || null, proofName: p.proofName || "", proofTxn: p.proofTxn || null });
  useInvEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 10001, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 440, padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Proof of payment</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>{payFmt(amount)} · {p.date} — link a Mercury transaction or attach a receipt.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "18px 24px" }}>
          {typeof MercuryProofField === "function"
            ? <MercuryProofField amount={amount} vendor={vendor} value={val} onChange={(patch) => setVal((v) => ({ ...v, ...patch }))} />
            : null}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" onClick={() => onSave(val)}><VyIcon name="check" size={14} /><span>Save proof</span></button>
        </div>
      </div>
    </div>
  );
}

// Edit-charges modal — itemize GOODS per SKU (billed amount editable; SKU/qty/
// ordered sourced from Production) and edit/add SERVICE lines. Persists to the
// shared store via paySaveInvoiceCharges so both views show the itemized bill.
function InvChargesModal({ inv, onClose, onSaved }) {
  const allLines = (typeof payInvoiceLines === "function" ? payInvoiceLines(inv) : (inv.lines || []));
  let seedGoods = (typeof paySupplierGoods === "function" ? paySupplierGoods(inv) : null) || [];
  // When there's no per-SKU breakdown (supplier invoice with no Production scope),
  // seed from the rendered "Product lines" rows so the aggregate goods line shows
  // as one editable row that already sums correctly — not an empty placeholder.
  if (seedGoods.length === 0 && inv.vendorType === "Supplier") {
    seedGoods = allLines.filter((l) => l.type === "Product lines").map((l) => ({ sku: l.sku || "", name: l.label, qty: l.qty || 0, ordered: l.amount, billed: l.amount }));
  }
  const CHARGE_TYPES = (typeof payChargeTypes === "function") ? payChargeTypes() : ((typeof PAY_CHARGE_TYPES !== "undefined") ? PAY_CHARGE_TYPES : []);
  const seedServices = allLines.filter((l) => !l.sku && l.type !== "Product lines").map((l) => {
    const ct = l.chargeType || (typeof payChargeTypeForLabel === "function" ? payChargeTypeForLabel(l.label, l.type) : "other");
    return { chargeType: ct, label: l.label, type: l.type || "Service charge", amount: String(l.amount) };
  });
  const skuOptions = (typeof payOrderSkuOptions === "function") ? payOrderSkuOptions(inv) : [];

  const [goods, setGoods] = useInvState(() => seedGoods.map((g) => ({ sku: g.sku, name: g.name, qty: g.qty, ordered: g.ordered || 0, billed: String(g.billed != null ? g.billed : (g.ordered || "")) })));
  const [services, setServices] = useInvState(seedServices);
  useInvEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const goodsTotal = goods.reduce((n, g) => n + (Number(g.billed) || 0), 0);
  const svcTotal = services.reduce((n, s) => n + (Number(s.amount) || 0), 0);
  const sum = Math.round((goodsTotal + svcTotal) * 100) / 100;
  const target = Number(inv.total) || 0;
  const off = Math.round((sum - target) * 100) / 100;

  const input = { height: 34, padding: "0 10px", fontSize: 12.5, border: "1px solid hsl(var(--input))", borderRadius: 7, background: "hsl(var(--background))", color: "hsl(var(--foreground))", width: "100%" };
  const addable = skuOptions.filter((o) => !goods.some((g) => g.sku === o.sku));
  // Every catalog SKU (the product source of truth) — so a bill with no
  // Production scope still references a real product instead of free text.
  const catalogOptions = (() => {
    try {
      const fams = (typeof catLoadFamilies === "function") ? catLoadFamilies() : ((typeof CAT_FAMILIES !== "undefined") ? CAT_FAMILIES : []);
      const out = [];
      (fams || []).forEach((f) => (f.variants || []).forEach((v) => out.push({ sku: v.sku, name: v.name || ((f.parent || f.title || "") + " \u00b7 " + v.sku), unitUsd: v.lastCostUsd || 0, unitRmb: v.lastCostRmb || 0 })));
      return out;
    } catch (e) { return []; }
  })();
  const addableCatalog = catalogOptions.filter((o) => !goods.some((g) => g.sku === o.sku) && !addable.some((a) => a.sku === o.sku));

  function setGoodsBilled(i, v) { setGoods((gs) => gs.map((g, k) => k === i ? { ...g, billed: v } : g)); }
  function removeGood(i) { setGoods((gs) => gs.filter((_, k) => k !== i)); }
  function addGood(opt) { if (!opt) return; setGoods((gs) => [...gs, { sku: opt.sku, name: opt.name, qty: opt.qty || 0, ordered: opt.ordered || 0, billed: String(opt.ordered || "") }]); }
  function addCatalogGood(opt) { if (!opt) return; setGoods((gs) => [...gs, { sku: opt.sku, name: opt.name, qty: 0, ordered: 0, billed: "", unitUsd: opt.unitUsd || 0, unitRmb: opt.unitRmb || 0 }]); }
  function addManualGood() { setGoods((gs) => [...gs, { sku: "", name: "New product", qty: 0, ordered: 0, billed: "" }]); }
  function setGoodField(i, key, v) { setGoods((gs) => gs.map((g, k) => k === i ? { ...g, [key]: v } : g)); }
  function setSvc(i, key, v) { setServices((ss) => ss.map((s, k) => k === i ? { ...s, [key]: v } : s)); }
  // Picking a charge type derives the label from the catalog; "other" keeps an
  // editable custom label.
  function setSvcType(i, ctId) {
    setServices((ss) => ss.map((s, k) => {
      if (k !== i) return s;
      const t = (typeof payChargeType === "function") ? payChargeType(ctId) : null;
      const label = ctId === "other" ? (s.chargeType === "other" ? s.label : "") : (t ? t.label : s.label);
      return { ...s, chargeType: ctId, label };
    }));
  }
  function removeSvc(i) { setServices((ss) => ss.filter((_, k) => k !== i)); }
  function addSvc() { setServices((ss) => [...ss, { chargeType: "", label: "", type: "Service charge", amount: "" }]); }

  function save() {
    const svc = services.map((s) => {
      const ct = (typeof payChargeType === "function") ? payChargeType(s.chargeType) : null;
      const label = (s.chargeType && s.chargeType !== "other" && ct) ? ct.label : (s.label || (ct ? ct.label : "Charge"));
      return { chargeType: s.chargeType || "other", label, type: s.type, amount: Number(s.amount) || 0 };
    });
    paySaveInvoiceCharges(inv, goods.map((g) => ({ sku: g.sku, name: g.name, qty: Number(g.qty) || 0, ordered: Number(g.ordered) || 0, billed: Number(g.billed) || 0 })), svc);
    onSaved();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 10000, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 620, maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Edit charges</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0", maxWidth: "52ch" }}>Itemize goods per SKU (billed amount) and edit service charges. SKU, quantity &amp; ordered come from Production; you enter what was billed.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>

        <div style={{ padding: "16px 24px", overflowY: "auto", background: "hsl(var(--muted-bg) / 0.4)" }}>
          {/* GOODS */}
          <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, padding: "12px 14px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="vy-kicker">Goods — per SKU</span>
            <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{payFmt(goodsTotal)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 10 }}>
            {goods.length === 0 ? <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "2px 0 6px" }}>No SKU lines yet — add from Production or Catalog below.</p> : null}
            {goods.length ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", paddingBottom: 6, borderBottom: "1px solid hsl(var(--border) / 0.7)" }}>
                <span className="vy-kicker" style={{ flex: 1, minWidth: 0 }}>Product</span>
                <span className="vy-kicker" style={{ width: 64, flexShrink: 0, textAlign: "right" }}>Qty</span>
                <span className="vy-kicker" style={{ width: 116, flexShrink: 0, textAlign: "right" }}>Billed</span>
                <span style={{ width: 22, flexShrink: 0 }} />
              </div>
            ) : null}
            {goods.map((g, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingTop: 8, paddingBottom: 8, borderTop: i ? "1px solid hsl(var(--border) / 0.5)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  {g.sku
                    ? <div style={{ fontSize: 12.5, fontWeight: 600, height: 34, lineHeight: "34px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                    : <input value={g.name} onChange={(e) => setGoodField(i, "name", e.target.value)} placeholder="Product name" style={{ ...input }} />}
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {g.sku
                      ? <span style={{ ...invMono, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "hsl(var(--muted-bg))", color: "hsl(var(--muted-fg))" }}>{g.sku}</span>
                      : <input value={g.sku} onChange={(e) => setGoodField(i, "sku", e.target.value)} placeholder="SKU" style={{ ...input, height: 26, width: 130, fontSize: 10.5 }} />}
                    <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{g.ordered ? "ordered " + payFmt(g.ordered) : (g.unitRmb || g.unitUsd ? "catalog ref \u00a5" + g.unitRmb + " \u00b7 $" + g.unitUsd : "no Production match")}</span>
                  </div>
                </div>
                {g.ordered > 0
                  ? <div style={{ ...invMono, width: 64, flexShrink: 0, fontSize: 12.5, fontWeight: 600, height: 34, lineHeight: "34px", textAlign: "right", color: "hsl(var(--muted-fg))" }} title="Quantity from Production (locked)">{(g.qty || 0).toLocaleString()}</div>
                  : <input type="number" min="0" value={g.qty || ""} onChange={(e) => setGoodField(i, "qty", Number(e.target.value) || 0)} placeholder="0" title="No Production source — enter the billed quantity" style={{ ...input, width: 64, flexShrink: 0, textAlign: "right" }} />}
                <input type="number" step="0.01" value={g.billed} onChange={(e) => setGoodsBilled(i, e.target.value)} placeholder="0.00" style={{ ...input, width: 116, flexShrink: 0, textAlign: "right" }} />
                <button type="button" onClick={() => removeGood(i)} aria-label="Remove" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, marginTop: 5, color: "hsl(var(--muted-fg))", flexShrink: 0 }}><VyIcon name="trash" size={14} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {addable.length ? (
              <select onChange={(e) => { const o = addable.find((x) => x.sku === e.target.value); addGood(o); e.target.value = ""; }} defaultValue="" style={{ ...input, width: "auto", flex: "1 1 200px", color: "hsl(var(--primary))", fontWeight: 600 }}>
                <option value="">+ Add SKU from Production…</option>
                {addable.map((o) => <option key={o.sku} value={o.sku}>{o.sku} · {o.name}</option>)}
              </select>
            ) : null}
            {addableCatalog.length ? (
              <select onChange={(e) => { const o = addableCatalog.find((x) => x.sku === e.target.value); addCatalogGood(o); e.target.value = ""; }} defaultValue="" style={{ ...input, width: "auto", flex: "1 1 200px", color: "hsl(var(--primary))", fontWeight: 600 }}>
                <option value="">+ Add product from Catalog…</option>
                {addableCatalog.map((o) => <option key={o.sku} value={o.sku}>{o.sku} · {o.name}</option>)}
              </select>
            ) : null}
            <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={addManualGood}><VyIcon name="plus" size={12} /><span>Manual line</span></button>
          </div>
          </div>

          {/* SERVICES */}
          <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, padding: "12px 14px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="vy-kicker">Service charges</span>
            <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{payFmt(svcTotal)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {services.map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={s.chargeType || ""} onChange={(e) => setSvcType(i, e.target.value)} style={{ ...input, flex: 1, fontWeight: s.chargeType ? 600 : 400, color: s.chargeType ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>
                    <option value="">Select charge type…</option>
                    {CHARGE_TYPES.map((c) => <option key={c.id} value={c.id}>{c.label}{c.owner && c.owner !== "—" ? " · " + c.owner : ""}</option>)}
                  </select>
                  <input type="number" step="0.01" value={s.amount} onChange={(e) => setSvc(i, "amount", e.target.value)} placeholder="0.00" style={{ ...input, width: 110, textAlign: "right" }} />
                  <button type="button" onClick={() => removeSvc(i)} aria-label="Remove" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))", flexShrink: 0 }}><VyIcon name="trash" size={14} /></button>
                </div>
                {s.chargeType === "other" ? (
                  <input value={s.label} onChange={(e) => setSvc(i, "label", e.target.value)} placeholder="Describe this charge" style={{ ...input, height: 30, fontSize: 12 }} />
                ) : null}
              </div>
            ))}
          </div>
          <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={addSvc} style={{ marginBottom: 4 }}><VyIcon name="plus" size={12} /><span>Add charge</span></button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
            <span style={{ fontWeight: 700 }}>Itemized {payFmt(sum)}</span>
            <span style={{ color: "hsl(var(--muted-fg))" }}> vs invoice total {payFmt(target)}</span>
            {Math.abs(off) >= 0.01 ? <span style={{ color: "hsl(var(--warning))", fontWeight: 600 }}> · {off > 0 ? "+" : ""}{payFmt(off)} off</span> : <span style={{ color: "hsl(var(--success))", fontWeight: 600 }}> · matches</span>}
          </div>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" onClick={save}><VyIcon name="check" size={14} /><span>Save charges</span></button>
        </div>
      </div>
    </div>
  );
}

function InvProofCell({ p, amount, vendor, onChange }) {
  const [editing, setEditing] = useInvState(false);
  const badge = (typeof mercProofBadge === "function") ? mercProofBadge(p) : (p.proof ? { label: "Receipt", tone: "success", title: p.proofName || "" } : null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {badge
        ? <span className={"vy-badge vy-badge--" + badge.tone} title={badge.title}>{badge.label}</span>
        : <span className="vy-badge vy-badge--warning">Missing</span>}
      <button type="button" onClick={() => setEditing(true)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 600, color: "hsl(var(--primary))", display: "inline-flex", alignItems: "center", gap: 3 }} title="Change proof (Mercury transaction or receipt)">
        <VyIcon name={p.proof ? "pencil" : "plus"} size={11} />
        <span>{p.proof ? "Change" : "Add"}</span>
      </button>
      {editing ? <InvProofEditModal p={p} amount={amount} vendor={vendor} onClose={() => setEditing(false)} onSave={(patch) => { onChange(patch); setEditing(false); }} /> : null}
    </div>
  );
}

const invTh = { textAlign: "left", padding: "10px 18px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" };
const invTd = { padding: "11px 18px", color: "hsl(var(--foreground))", fontSize: 12.5, whiteSpace: "nowrap" };

const invRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
invRoot.render(<InvoicePage />);
