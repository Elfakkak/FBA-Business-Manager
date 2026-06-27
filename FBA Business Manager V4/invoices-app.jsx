// Vyonix Invoices Section — chrome-less body, embedded inside the Order Shell
// Invoices tab. Exposes VyInvoicesBody via window. Does NOT self-mount.
//
// Design follows the Shipping pattern (NOT the dense master-detail mock):
//   header + next-action  →  5-KPI strip  →  action-needed banner  →
//   invoice switcher tabs  →  stacked detail cards (file · totals ·
//   lines/charges · payments). Interactive: Log payment + Upload proof
//   are real modals/pickers that mutate state; KPIs/badges derive live.
//
// Only REAL invoices are shown (payables / received bills) — the mock's
// "expected / reference / included-stub" placeholders are intentionally omitted.

const { useState: useInvState, useEffect: useInvEffect } = React;

// ----------------------------------------------------------------------
// DATA — per-order vendor invoices, derived from the shared payables source
// (PAY_INVOICES) so invoice IDs, totals and balances match the order Home view
// and the portfolio Invoices page. Curated line/payment detail is overlaid for
// invoices we have it for; the rest is derived from total/paid.
// ----------------------------------------------------------------------
function invRound(n) { return Math.round(n * 100) / 100; }

// Curated rich detail, keyed by payables invoice id (kept where we have it).
const INV_DETAIL = {
  "PI-2605-MUTU-001": {
    lines: [
      { label: "Beaded seat cover · Black (4 SKUs)", type: "Product lines", amount: 13500.73 },
      { label: "Agent service fee 5%", type: "Service charge", amount: 670.04 },
      { label: "Cartons export packaging", type: "Service charge", amount: 375.0 },
      { label: "Supplier credit", type: "Discount", amount: -100.0 },
    ],
    payments: [
      { id: "MERC-1104", date: "Nov 04", amount: 2680.14, method: "Mercury", status: "Cleared", proof: true },
      { id: "MERC-1211", date: "Dec 11", amount: 4300.0, method: "Mercury", status: "Cleared", proof: true },
      { id: "MERC-1222", date: "Dec 22", amount: 2000.0, method: "Mercury", status: "Cleared", proof: false },
    ],
  },
};

function invDeriveLines(p) {
  const t = p.total;
  switch (p.vendorType) {
    case "Supplier": {
      const goods = invRound(t * 0.95);
      return [
        { label: p.orderTitle + " — goods", type: "Product lines", amount: goods },
        { label: "Export packaging & handling", type: "Service charge", amount: invRound(t - goods) },
      ];
    }
    case "Agent":
      return [{ label: "Agent service fee", type: "Service charge", amount: t }];
    case "Forwarder": {
      const freight = invRound(t * 0.88);
      return [
        { label: "International freight", type: "Freight", amount: freight },
        { label: "Documentation & telex release", type: "Service charge", amount: invRound(t - freight) },
      ];
    }
    case "Inspection":
      return [{ label: "Pre-shipment inspection (AQL II)", type: "Service", amount: t }];
    default:
      return [{ label: p.orderTitle, type: "Charge", amount: t }];
  }
}

function invDerivePayments(p) {
  const pays = [];
  if (p.paid > 0.005) {
    pays.push({ id: "MERC-" + String(p.id).replace(/[^0-9]/g, "").slice(-4), date: (typeof payDueLabel === "function" ? payDueLabel(p.issued) : p.issued), amount: invRound(p.paid), method: "Mercury", status: "Cleared", proof: true });
  }
  return pays;
}

function invCurrentOrderId() {
  try { return new URLSearchParams(window.location.search).get("order") || "ORD-2026-05-006"; }
  catch (e) { return "ORD-2026-05-006"; }
}

// Seed + working-set persistence now live in payables-data.jsx as the SINGLE
// source shared with the standalone Invoice page. These delegate to it so the
// section and the page read/write the exact same records (payments + proof +
// per-invoice terms). (INV_DETAIL / invDeriveLines / invDerivePayments above are
// retained only as a fallback and are no longer the source of truth.)
function invBuildForOrder() {
  return (typeof payBuildOrderInvoices === "function") ? payBuildOrderInvoices(invCurrentOrderId()) : [];
}

const INV_INVOICES = invBuildForOrder();

// ----------------------------------------------------------------------
// Persistence — per-order working set in localStorage so created invoices,
// edits, logged payments, proof flags and file uploads survive reload.
// Seed (from PAY_INVOICES) is the starting point; once an order is touched its
// snapshot is replayed, plus any newly-seeded invoices not yet in the snapshot.
// ----------------------------------------------------------------------
const INV_STORE_KEY = "vy_invoices_v1";
function invLoadStore() { return (typeof payStoreLoad === "function") ? payStoreLoad() : {}; }
function invSaveOrder(orderId, list) { if (typeof payStoreSaveOrder === "function") payStoreSaveOrder(orderId, list); }
function invInitialInvoices() { return (typeof payOrderInitial === "function") ? payOrderInitial(invCurrentOrderId()) : invBuildForOrder(); }

// ----------------------------------------------------------------------
// Helpers — derived money + formatting
// ----------------------------------------------------------------------
function invFmt(n) {
  const neg = n < 0;
  const s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (neg ? "-$" : "$") + s;
}
function invPaid(inv) {
  return inv.payments.filter((p) => p.status === "Cleared").reduce((n, p) => n + p.amount, 0);
}
function invBalance(inv) {
  return Math.max(0, inv.total - invPaid(inv));
}
function invProofMissing(inv) {
  // cleared payments with no receipt attached
  return inv.payments.filter((p) => p.status === "Cleared" && !p.proof).length;
}
function invStatus(inv) {
  const bal = invBalance(inv);
  const paid = invPaid(inv);
  if (bal <= 0.005) return "Paid";
  if (paid > 0) return "Partial";
  return "Unpaid";
}

// ----------------------------------------------------------------------
// Small presentational helpers (self-contained, no cross-file coupling)
// ----------------------------------------------------------------------
function InvSectionCard({ icon, title, sub, actions, iconTone = "primary", children }) {
  return (
    <section className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: children ? 16 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {icon ? (
            <span style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center",
              background: `hsl(var(--${iconTone}) / 0.12)`, color: `hsl(var(--${iconTone}))`,
            }}>
              <VyIcon name={icon} size={15} />
            </span>
          ) : null}
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
            {sub ? <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>{sub}</p> : null}
          </div>
        </div>
        {actions ? <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function InvField({ label, children, mono, tone }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "12px 16px" }}>
      <div className="vy-kicker" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 16, fontWeight: 700,
        color: tone ? `hsl(var(--${tone}))` : undefined,
        fontFamily: mono ? "var(--font-mono, 'JetBrains Mono', monospace)" : undefined,
      }}>
        {children}
      </div>
    </div>
  );
}

function InvFieldRow({ children }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap",
      border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden",
      background: "hsl(var(--background) / 0.4)",
    }}>
      {React.Children.map(children, (child, i) => (
        <div key={i} style={{ flex: 1, minWidth: 150, borderLeft: i === 0 ? "none" : "1px solid hsl(var(--border))" }}>
          {child}
        </div>
      ))}
    </div>
  );
}

const invTh = {
  textAlign: "left", padding: "10px 14px", fontSize: 10.5, fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", color: "hsl(var(--muted-fg))",
};
const invTd = { padding: "12px 14px", color: "hsl(var(--foreground))" };

const STATUS_TONE = { Paid: "success", Partial: "warning", Unpaid: "danger", Included: "muted" };
const PAYTONE = { Cleared: "success", Scheduled: "warning", Failed: "danger" };

// ----------------------------------------------------------------------
// INVOICES BODY
// ----------------------------------------------------------------------
function VyInvoicesBody() {
  const [invoices, setInvoices] = useInvState(() => invInitialInvoices());
  const [activeId, setActiveId] = useInvState(INV_INVOICES[0] ? INV_INVOICES[0].id : null);
  const [modal, setModal] = useInvState(null); // null | 'log-payment' | 'new-invoice' | 'edit-invoice' | 'all-payments'
  const [drawerId, setDrawerId] = useInvState(null); // invoice open in the detail drawer
  const [payTarget, setPayTarget] = useInvState(null); // {invId, payIdx} for edit-payment
  const [headerMenu, setHeaderMenu] = useInvState(false);
  const [headerMenuPos, setHeaderMenuPos] = useInvState(null);
  const moreBtnRef = React.useRef(null);
  function toggleHeaderMenu() {
    if (headerMenu) { setHeaderMenu(false); return; }
    const r = moreBtnRef.current.getBoundingClientRect();
    setHeaderMenuPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    setHeaderMenu(true);
  }

  // Persist the working set whenever it changes (created/edited/paid/proof/file).
  useInvEffect(() => { invSaveOrder(invCurrentOrderId(), invoices); }, [invoices]);

  const inv = invoices.find((i) => i.id === activeId) || invoices[0];

  function updateInvoice(id, patch) {
    setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, ...(typeof patch === "function" ? patch(i) : patch) } : i)));
  }

  function handleLogPayment(targetId, p) {
    updateInvoice(targetId, (i) => ({ payments: [...i.payments, p] }));
    setActiveId(targetId); // jump to the invoice the payment was logged against
    setModal(null);
  }

  function handleCreateInvoice(draft) {
    setInvoices((prev) => [...prev, draft]);
    setActiveId(draft.id);
    setDrawerId(draft.id);
    setModal(null);
  }

  function handleEditInvoice(id, patch) {
    updateInvoice(id, patch);
    setModal(null);
  }

  function handleDeleteInvoice(id) {
    if (!window.confirm("Delete invoice " + id + "? This removes it and its payments from this order.")) return;
    setInvoices((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (activeId === id) setActiveId(next[0] ? next[0].id : null);
      return next;
    });
    setDrawerId(null);
    setModal(null);
  }

  function handleUploadProof(payIdx, invId) {
    const target = invId || drawerId || activeId;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.png,.jpg,.jpeg,.webp,.heic,.xls,.xlsx,.csv";
    input.onchange = (e) => {
      if (!e.target.files[0]) return;
      updateInvoice(target, (i) => ({
        payments: i.payments.map((p, idx) => (idx === payIdx ? { ...p, proof: true } : p)),
      }));
    };
    input.click();
  }

  function handleUploadFile(invId) {
    const target = invId || drawerId || activeId;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.png,.jpg,.jpeg,.webp,.heic,.gif,.xls,.xlsx,.csv,.doc,.docx";
    input.onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const ext = (f.name.split(".").pop() || "file").toUpperCase();
      updateInvoice(target, () => ({ file: { name: f.name, label: ext + " · uploaded" } }));
    };
    input.click();
  }

  function handleRemoveFile(invId) {
    updateInvoice(invId || drawerId || activeId, () => ({ file: null }));
  }

  function handleEditPayment(invId, payIdx, patch) {
    updateInvoice(invId, (i) => ({ payments: i.payments.map((p, k) => (k === payIdx ? { ...p, ...patch } : p)) }));
    setPayTarget(null);
    setModal(null);
  }

  function handleDeletePayment(invId, payIdx) {
    if (!window.confirm("Delete this payment? The invoice balance will go back up.")) return;
    updateInvoice(invId, (i) => ({ payments: i.payments.filter((_, k) => k !== payIdx) }));
    setPayTarget(null);
    setModal(null);
  }

  function handleExportCsv() {
    const oid = invCurrentOrderId();
    const esc = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const headers = ["Order", "Invoice", "Vendor", "Type", "Due", "Invoice total", "Paid", "Balance", "Status", "Payment date", "Payment amount", "Method", "Payment status", "Reference", "Receipt"];
    const rows = [headers.join(",")];
    invoices.forEach((i) => {
      const base = [oid, i.id, i.vendor, i.via, i.due, i.total.toFixed(2), invPaid(i).toFixed(2), invBalance(i).toFixed(2), invStatus(i)];
      if (i.payments.length) {
        i.payments.forEach((p) => {
          rows.push([...base, p.date, (p.amount != null ? p.amount.toFixed(2) : ""), p.method, p.status, (p.id && p.id !== "—" ? p.id : ""), p.proof ? "yes" : "no"].map(esc).join(","));
        });
      } else {
        rows.push([...base, "", "", "", "", "", ""].map(esc).join(","));
      }
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = oid + "-invoices.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Derived, live aggregates across all invoices
  const totalInvoiced = invoices.reduce((n, i) => n + i.total, 0);
  const totalPaid = invoices.reduce((n, i) => n + invPaid(i), 0);
  const totalBalance = invoices.reduce((n, i) => n + invBalance(i), 0);
  const proofMissing = invoices.reduce((n, i) => n + invProofMissing(i), 0);
  const partialCount = invoices.filter((i) => invStatus(i) === "Partial").length;
  const unpaidCount = invoices.filter((i) => invStatus(i) === "Unpaid").length;
  const firstDue = invoices.find((i) => invBalance(i) > 0);
  const nextDue = firstDue ? firstDue.due : "—";

  const kpis = [
    { icon: "receipt", label: "Total invoiced", value: invFmt(totalInvoiced), sub: invoices.length + " invoices" },
    { icon: "check", label: "Paid", value: invFmt(totalPaid), sub: (totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0) + "% of total", tone: "success" },
    { icon: "dollar", label: "Balance due", value: invFmt(totalBalance), sub: (unpaidCount + partialCount) + " open", tone: totalBalance > 0 ? "warning" : "success" },
    { icon: "calendar", label: "Next due", value: nextDue, sub: firstDue ? firstDue.id : "Nothing due" },
    { icon: "fileText", label: "Proof missing", value: String(proofMissing), sub: proofMissing ? "Receipts needed" : "All on file", tone: proofMissing ? "warning" : undefined },
  ];

  // Empty state — order has no vendor invoices yet (e.g. a fresh draft order).
  if (!inv) {
    return (
      <>
        <section className="vy-card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, margin: "0 auto 14px", display: "grid", placeItems: "center", background: "hsl(var(--muted-bg))", color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="receipt" size={20} />
          </div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>No invoices yet</h1>
          <p style={{ fontSize: 13, color: "hsl(var(--muted-fg))", margin: "6px auto 16px", maxWidth: "44ch" }}>
            Vendor bills for this order will appear here once a supplier PI, freight, or service invoice is logged.
          </p>
          <button type="button" className="vy-btn vy-btn--primary" onClick={() => setModal("new-invoice")}>
            <VyIcon name="plus" size={14} /><span>New invoice</span>
          </button>
        </section>
        {modal === "new-invoice" ? (
          <InvNewInvoiceModal onClose={() => setModal(null)} onSubmit={handleCreateInvoice} />
        ) : null}
      </>
    );
  }

  // Detail-level derived
  const dPaid = invPaid(inv);
  const dBalance = invBalance(inv);
  const dStatus = invStatus(inv);
  const dProofMissing = invProofMissing(inv);

  return (
    <>
      {/* Header + next action */}
      <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 460px", padding: "20px 22px", minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Invoices</h1>
            <p style={{ fontSize: 13, color: "hsl(var(--muted-fg))", margin: "6px 0 0", maxWidth: "62ch" }}>
              Vendor bills, balances, payments, and proof of payment for this order.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              {partialCount > 0 ? <span className="vy-badge vy-badge--warning">{partialCount} partial</span> : null}
              {unpaidCount > 0 ? <span className="vy-badge vy-badge--danger">{unpaidCount} unpaid</span> : null}
              {proofMissing > 0 ? <span className="vy-badge vy-badge--warning">{proofMissing} proof missing</span> : null}
              {totalBalance <= 0.005 ? <span className="vy-badge vy-badge--success">All settled</span> : null}
            </div>
          </div>
          <div style={{
            flex: "1 1 300px", padding: "20px 22px", minWidth: 260,
            borderLeft: "1px solid hsl(var(--border))", background: "hsl(var(--accent) / 0.5)",
          }}>
            <div className="vy-kicker" style={{ marginBottom: 6 }}>Next action</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {totalBalance > 0 ? "Settle balance due" : proofMissing > 0 ? "Upload missing proof" : "All invoices reconciled"}
            </div>
            <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "4px 0 14px" }}>
              {totalBalance > 0
                ? invFmt(totalBalance) + " open across " + (unpaidCount + partialCount) + " invoice" + (unpaidCount + partialCount === 1 ? "" : "s") + (firstDue ? " · next due " + nextDue : "")
                : proofMissing > 0
                  ? proofMissing + " cleared payment" + (proofMissing === 1 ? "" : "s") + " still need a receipt on file."
                  : "Balances paid and receipts filed. Ready to finalize landed cost."}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" className="vy-btn vy-btn--primary" onClick={() => setModal("log-payment")}>
                <VyIcon name="money" size={14} />
                <span>Log payment</span>
              </button>
              <button type="button" className="vy-btn vy-btn--outline" onClick={() => setModal("all-payments")}>
                <VyIcon name="receipt" size={14} />
                <span>All payments</span>
              </button>
              <div style={{ position: "relative" }}>
                <button ref={moreBtnRef} type="button" className="vy-btn vy-btn--outline" aria-label="More actions" aria-haspopup="true" aria-expanded={headerMenu} onClick={toggleHeaderMenu} style={{ padding: "0 10px" }}>
                  <VyIcon name="more" size={16} />
                </button>
                {headerMenu && headerMenuPos ? ReactDOM.createPortal(
                  <>
                    <div onClick={() => setHeaderMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
                    <div className="vy-card" style={{ position: "fixed", top: headerMenuPos.top, right: headerMenuPos.right, zIndex: 9999, padding: 6, minWidth: 180, boxShadow: "var(--shadow-lg)" }}>
                      <button type="button" onClick={() => { setHeaderMenu(false); handleExportCsv(); }} style={invMenuItem}>
                        <VyIcon name="download" size={14} style={{ opacity: 0.7 }} /><span>Export all (CSV)</span>
                      </button>
                    </div>
                  </>,
                  document.body
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPI strip */}
      <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {kpis.map((k, i) => (
          <div key={i} className={"vy-card vy-kpi" + (k.tone ? ` vy-kpi--${k.tone}` : "")}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <VyIcon name={k.icon} size={14} style={{ opacity: 0.7 }} />
              <span className="vy-kicker">{k.label}</span>
            </div>
            <div className="vy-kpi-value">{k.value}</div>
            <div className="vy-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Action needed banner */}
      {(totalBalance > 0 || proofMissing > 0) ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          padding: "12px 16px", borderRadius: 10,
          background: "hsl(var(--warning) / 0.08)", border: "1px solid hsl(var(--warning) / 0.25)",
        }}>
          <span className="vy-badge vy-badge--warning" style={{ flexShrink: 0 }}>Action needed</span>
          <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
            <strong style={{ fontWeight: 600 }}>
              {totalBalance > 0 ? invFmt(totalBalance) + " balance due before shipment release" : proofMissing + " payment proof missing"}
            </strong>
            <span style={{ color: "hsl(var(--muted-fg))" }}>
              &nbsp;&nbsp;{totalBalance > 0 ? "Log the payment, then upload its receipt as proof." : "Attach receipts to cleared payments to reconcile."}
            </span>
          </div>
          <button type="button" className="vy-btn vy-btn--primary" style={{ flexShrink: 0 }} onClick={() => setModal("log-payment")}>
            <VyIcon name="money" size={14} />
            <span>Log payment</span>
          </button>
        </div>
      ) : null}

      {/* (Payment terms are now shown PER INVOICE: a small reminder chip on each
          card + the full editable terms card inside the invoice drawer/page.) */}

      {/* Invoice cards — all the order's invoices at a glance (≤5, no list needed) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {invoices.map((i) => {
          const st = invStatus(i);
          const paid = invPaid(i);
          const bal = invBalance(i);
          const pct = i.total > 0 ? Math.min(100, Math.round((paid / i.total) * 100)) : 0;
          const proofMiss = invProofMissing(i);
          const termSum = (typeof payTermSummary === "function" && typeof payInvoiceTerms === "function") ? payTermSummary(payInvoiceTerms(i)) : null;
          const mono = "var(--font-mono, 'JetBrains Mono', monospace)";
          return (
            <div
              key={i.id}
              role="button"
              tabIndex={0}
              onClick={() => { setActiveId(i.id); setDrawerId(i.id); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveId(i.id); setDrawerId(i.id); } }}
              style={{
                display: "flex", flexDirection: "column", gap: 12, textAlign: "left", cursor: "pointer",
                padding: "16px 16px 14px", borderRadius: 12, border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))", color: "hsl(var(--foreground))", transition: "box-shadow 160ms ease, transform 120ms ease, border-color 160ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.4)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "hsl(var(--border))"; }}
            >
              {/* top row */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <a href={"Vyonix Invoice.html?invoice=" + encodeURIComponent(i.id)} onClick={(e) => e.stopPropagation()} className="vy-row-title" title="Open full invoice page" style={{ fontSize: 13, fontWeight: 700, fontFamily: mono, color: "inherit", textDecoration: "none" }}>{i.id}</a>
                  <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.vendor} · {i.via}</div>
                  {termSum ? <span title={"Payment terms: " + termSum} style={{ display: "inline-block", marginTop: 7, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "hsl(var(--muted-bg))", color: "hsl(var(--muted-fg))", fontFamily: mono, whiteSpace: "nowrap" }}>{termSum}</span> : null}
                </div>
                <span className={"vy-badge vy-badge--" + STATUS_TONE[st]} style={{ flexShrink: 0 }}>{st}</span>
              </div>

              {/* paid progress */}
              <div>
                <div style={{ height: 6, borderRadius: 999, background: "hsl(var(--muted-bg))", overflow: "hidden" }}>
                  <div style={{ width: pct + "%", height: "100%", borderRadius: 999, background: bal <= 0.005 ? "hsl(var(--success))" : "hsl(var(--primary))", transition: "width 280ms ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "hsl(var(--muted-fg))" }}>
                  <span>{pct}% paid</span>
                  <span>{i.payments.length} payment{i.payments.length === 1 ? "" : "s"}</span>
                </div>
              </div>

              {/* money row */}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div className="vy-kicker" style={{ marginBottom: 2 }}>Total</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: mono }}>{invFmt(i.total)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="vy-kicker" style={{ marginBottom: 2 }}>Paid</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: mono, color: "hsl(var(--success))" }}>{invFmt(paid)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="vy-kicker" style={{ marginBottom: 2 }}>Balance</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: mono, color: bal > 0.005 ? "hsl(var(--warning))" : "hsl(var(--success))" }}>{invFmt(bal)}</div>
                </div>
              </div>

              {/* footer */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 10, borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                <span style={{ fontSize: 11, color: proofMiss > 0 ? "hsl(var(--warning))" : "hsl(var(--muted-fg))", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {proofMiss > 0 ? <><VyIcon name="alert" size={11} />{proofMiss} proof missing</> : <>Due {i.due}</>}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "hsl(var(--primary))", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  Quick view <VyIcon name="arrowRight" size={12} />
                </span>
              </div>
            </div>
          );
        })}

        {/* New invoice card */}
        <button
          type="button"
          onClick={() => setModal("new-invoice")}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
            padding: "16px", borderRadius: 12, border: "1.5px dashed hsl(var(--border))", background: "transparent",
            color: "hsl(var(--muted-fg))", minHeight: 150, transition: "border-color 160ms ease, color 160ms ease, background 160ms ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.5)"; e.currentTarget.style.color = "hsl(var(--primary))"; e.currentTarget.style.background = "hsl(var(--primary) / 0.04)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "hsl(var(--border))"; e.currentTarget.style.color = "hsl(var(--muted-fg))"; e.currentTarget.style.background = "transparent"; }}
        >
          <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "hsl(var(--muted-bg))" }}>
            <VyIcon name="plus" size={16} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>New invoice</span>
          <span style={{ fontSize: 11 }}>Add a vendor bill to this order</span>
        </button>
      </div>

      {/* Invoice detail drawer */}
      {drawerId ? (
        <InvDrawer
          inv={invoices.find((x) => x.id === drawerId) || inv}
          onClose={() => setDrawerId(null)}
          onLog={() => setModal("log-payment")}
          onEdit={() => setModal("edit-invoice")}
          onDelete={handleDeleteInvoice}
          onUploadProof={handleUploadProof}
          onUploadFile={handleUploadFile}
          onRemoveFile={handleRemoveFile}
          onEditPayment={(payIdx) => { setPayTarget({ invId: drawerId, payIdx }); setModal("edit-payment"); }}
        />
      ) : null}

      {/* Modals */}
      {modal === "log-payment" ? (
        <InvLogPaymentModal invoices={invoices} initialId={activeId} onClose={() => setModal(null)} onSubmit={handleLogPayment} />
      ) : null}
      {modal === "new-invoice" ? (
        <InvNewInvoiceModal onClose={() => setModal(null)} onSubmit={handleCreateInvoice} />
      ) : null}
      {modal === "edit-invoice" && (invoices.find((x) => x.id === drawerId) || inv) ? (
        <InvEditInvoiceModal invoice={invoices.find((x) => x.id === drawerId) || inv} onClose={() => setModal(null)} onSubmit={handleEditInvoice} />
      ) : null}
      {modal === "all-payments" ? (
        <InvAllPaymentsDrawer
          invoices={invoices}
          onClose={() => setModal(null)}
          onOpenInvoice={(id) => { setModal(null); setActiveId(id); setDrawerId(id); }}
        />
      ) : null}
      {modal === "edit-payment" && payTarget && invoices.find((x) => x.id === payTarget.invId) ? (
        <InvEditPaymentModal
          invoice={invoices.find((x) => x.id === payTarget.invId)}
          payIdx={payTarget.payIdx}
          onClose={() => { setModal(null); setPayTarget(null); }}
          onSave={handleEditPayment}
          onDelete={handleDeletePayment}
          onAttachReceipt={() => handleUploadProof(payTarget.payIdx, payTarget.invId)}
        />
      ) : null}
    </>
  );
}

// ----------------------------------------------------------------------
// INVOICE DETAIL DRAWER — quick look at ONE invoice: totals, file, lines, and
// ALL its payments (with proof + edit). Mirrors the app's list→drawer pattern.
// ----------------------------------------------------------------------
function InvDrawer({ inv, onClose, onLog, onEdit, onDelete, onUploadProof, onUploadFile, onRemoveFile, onEditPayment }) {
  const [shown, setShown] = useInvState(false);
  useInvEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  if (!inv) return null;

  const dPaid = invPaid(inv);
  const dBalance = invBalance(inv);
  const dStatus = invStatus(inv);
  const dProofMissing = invProofMissing(inv);
  const mono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.4)", opacity: shown ? 1 : 0, transition: "opacity 200ms ease" }} />
      <aside style={{
        position: "absolute", top: 0, right: 0, height: "100%", width: "min(480px, 94vw)",
        background: "hsl(var(--card))", borderLeft: "1px solid hsl(var(--border))",
        boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
        transform: shown ? "translateX(0)" : "translateX(100%)", transition: "transform 240ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...mono, fontSize: 16, fontWeight: 700 }}>{inv.id}</div>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{inv.vendor} · {inv.via}</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))", flexShrink: 0 }}>
              <VyIcon name="x" size={18} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
            <span className="vy-badge vy-badge--muted">{inv.kind}</span>
            <span className={"vy-badge vy-badge--" + STATUS_TONE[dStatus]}>{dStatus}</span>
            {dProofMissing > 0 ? <span className="vy-badge vy-badge--warning">{dProofMissing} proof missing</span> : null}
            <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ marginLeft: "auto" }} onClick={onEdit}>
              <VyIcon name="pencil" size={12} /><span>Edit</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Totals */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "12px 14px", borderRadius: 10, background: "hsl(var(--background) / 0.5)", border: "1px solid hsl(var(--border))" }}>
            <div style={{ flex: "1 1 80px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Total</div><div style={{ ...mono, fontSize: 15, fontWeight: 700 }}>{invFmt(inv.total)}</div></div>
            <div style={{ flex: "1 1 80px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Paid</div><div style={{ ...mono, fontSize: 15, fontWeight: 700, color: "hsl(var(--success))" }}>{invFmt(dPaid)}</div></div>
            <div style={{ flex: "1 1 80px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Balance</div><div style={{ ...mono, fontSize: 15, fontWeight: 700, color: dBalance > 0 ? "hsl(var(--warning))" : "hsl(var(--success))" }}>{invFmt(dBalance)}</div></div>
            <div style={{ flex: "1 1 80px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Due</div><div style={{ fontSize: 14, fontWeight: 600 }}>{inv.due}</div></div>
          </div>

          {/* Payment terms — for THIS invoice (its own vendor's term, editable here) */}
          {typeof InvPaymentTermsCard === "function" ? <InvPaymentTermsCard invoice={inv} paid={dPaid} /> : null}

          {/* Invoice file */}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Invoice file</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: inv.file ? "hsl(var(--success) / 0.12)" : "hsl(var(--muted-bg))", color: inv.file ? "hsl(var(--success))" : "hsl(var(--muted-fg))" }}>
                <VyIcon name="fileText" size={14} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{inv.file ? inv.file.name : "No file linked"}</div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{inv.file ? inv.file.label : "Upload the vendor invoice PDF"}</div>
              </div>
              {inv.file
                ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--primary))", textDecoration: "none" }}>Open</a>
                    <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ fontSize: 11 }} onClick={() => onUploadFile(inv.id)}>Replace</button>
                    <button type="button" onClick={() => onRemoveFile(inv.id)} aria-label="Remove file" style={{ background: "transparent", border: "none", cursor: "pointer", color: "hsl(var(--muted-fg))", padding: 2 }}><VyIcon name="x" size={14} /></button>
                  </div>
                )
                : <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={() => onUploadFile(inv.id)}><VyIcon name="upload" size={12} /><span>Upload</span></button>}
            </div>
          </div>

          {/* Lines / charges */}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Lines / charges</div>
            <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <tbody>
                  {(typeof payInvoiceLines === "function" ? payInvoiceLines(inv) : inv.lines).map((l, k) => (
                    <tr key={k} style={{ borderTop: k ? "1px solid hsl(var(--border))" : "none" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>{l.label}<div style={{ fontWeight: 400, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{l.sku ? l.sku + (l.qty ? " · " + l.qty.toLocaleString() + " pcs" : "") : l.type}</div></td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, ...mono, color: l.amount < 0 ? "hsl(var(--success))" : undefined }}>{invFmt(l.amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--muted-bg) / 0.4)" }}>
                    <td style={{ padding: "9px 12px", fontWeight: 700 }}>Total</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, ...mono }}>{invFmt(inv.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments — all of them, for THIS invoice */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="vy-kicker">Payments ({inv.payments.length})</span>
            </div>
            {inv.payments.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {inv.payments.map((p, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
                    <div style={{ minWidth: 48, fontSize: 12, fontWeight: 600, color: "hsl(var(--muted-fg))" }}>{p.date}</div>
                    <div style={{ minWidth: 84, fontSize: 13.5, fontWeight: 700, ...mono }}>{invFmt(p.amount)}</div>
                    <div style={{ fontSize: 12 }}><span style={{ fontWeight: 600 }}>{p.method}</span></div>
                    <span className={"vy-badge vy-badge--" + (PAYTONE[p.status] || "muted")}>{p.status}</span>
                    {p.status === "Cleared" ? (() => { const b = (typeof mercProofBadge === "function") ? mercProofBadge(p) : (p.proof ? { label: "Receipt", tone: "success", title: "" } : null); return b ? <span className={"vy-badge vy-badge--" + b.tone} title={b.title}>{b.label}</span> : <span className="vy-badge vy-badge--warning">Proof?</span>; })() : null}
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                      {p.proof
                        ? <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 11.5, fontWeight: 600, color: "hsl(var(--primary))", textDecoration: "none" }}>Receipt</a>
                        : <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ fontSize: 11 }} onClick={() => onUploadProof(idx, inv.id)}><VyIcon name="upload" size={11} /><span>Receipt</span></button>}
                      <button type="button" onClick={() => onEditPayment(idx)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 600, color: "hsl(var(--muted-fg))", display: "inline-flex", alignItems: "center", gap: 3, padding: 0 }}>
                        <VyIcon name="pencil" size={11} /><span>Edit</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "20px", textAlign: "center", border: "1px dashed hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No payments logged</div>
                <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "4px 0 12px" }}>Log a payment to start tracking this invoice's balance.</p>
                <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" onClick={onLog}><VyIcon name="plus" size={12} /><span>Log payment</span></button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))", alignItems: "center" }}>
          <button type="button" onClick={() => onDelete(inv.id)} aria-label="Delete invoice" title="Delete invoice" style={{ background: "transparent", border: "1px solid hsl(var(--border))", borderRadius: 8, cursor: "pointer", color: "hsl(var(--danger))", padding: "8px 10px", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600 }}>
            <VyIcon name="trash" size={14} /><span>Delete</span>
          </button>
          <button type="button" className="vy-btn vy-btn--primary" onClick={onLog} style={{ flex: 1, justifyContent: "center" }}>
            <VyIcon name="money" size={14} /><span>Log payment</span>
          </button>
          <a href={"Vyonix Invoice.html?invoice=" + encodeURIComponent(inv.id)} className="vy-btn vy-btn--outline" style={{ textDecoration: "none" }} title="Open the full invoice page"><VyIcon name="arrowUpRight" size={14} /><span>Full page</span></a>
          <button type="button" className="vy-btn vy-btn--outline" onClick={onClose}>Close</button>
        </div>
      </aside>
    </div>,
    document.body
  );
}

// ----------------------------------------------------------------------
// Modal shell + form field (self-contained)
// ----------------------------------------------------------------------
function InvModalShell({ title, sub, onClose, children, footer, width = 520 }) {
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: width, maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
            {sub ? <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0", maxWidth: "46ch" }}>{sub}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 24px", overflowY: "auto" }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>{footer}</div>
      </div>
    </div>,
    document.body
  );
}

function InvFormField({ label, children, half }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: half ? "1 1 calc(50% - 7px)" : "1 1 100%", minWidth: 0 }}>
      <span className="vy-kicker">{label}</span>
      {children}
    </label>
  );
}

const invInputStyle = {
  width: "100%", height: 38, padding: "0 12px", fontSize: 13,
  border: "1px solid hsl(var(--input))", borderRadius: 8,
  background: "hsl(var(--background))", color: "hsl(var(--foreground))",
};

const invMenuItem = {
  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
  padding: "8px 10px", fontSize: 13, border: "none", background: "transparent",
  borderRadius: 7, cursor: "pointer", color: "hsl(var(--foreground))",
};

// ----------------------------------------------------------------------
// Log payment modal
// ----------------------------------------------------------------------
function InvLogPaymentModal({ invoices, initialId, onClose, onSubmit }) {
  const today = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  // Default to an invoice that actually has a balance — don't land on a settled one.
  const [invId, setInvId] = useInvState(() => {
    const init = invoices.find((i) => i.id === initialId);
    if (init && invBalance(init) > 0.005) return initialId;
    const firstOpen = invoices.find((i) => invBalance(i) > 0.005);
    return firstOpen ? firstOpen.id : (initialId || (invoices[0] && invoices[0].id));
  });
  const invoice = invoices.find((i) => i.id === invId) || invoices[0];
  const balance = invBalance(invoice);

  const [form, setForm] = useInvState({
    date: today,
    amount: balance > 0 ? balance.toFixed(2) : "",
    method: "Mercury",
    ref: "",
    status: "Cleared",
    proof: false,
    proofKind: null,
    proofName: "",
    proofTxn: null,
  });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  // When the target invoice changes, refresh the suggested amount to its balance
  function pickInvoice(id) {
    setInvId(id);
    const next = invoices.find((i) => i.id === id);
    const bal = next ? invBalance(next) : 0;
    setForm((p) => ({ ...p, amount: bal > 0 ? bal.toFixed(2) : "" }));
  }

  const amt = Number(form.amount) || 0;
  const settled = balance <= 0.005;
  const over = amt > balance + 0.005;
  const valid = amt > 0 && form.date.trim() && !settled && !over;

  function submit() {
    onSubmit(invId, {
      id: form.ref.trim() || "—",
      date: form.date.trim(),
      amount: amt,
      method: form.method,
      status: form.status,
      proof: !!form.proof,
      proofKind: form.proofKind || null,
      proofName: form.proofName || "",
      proofTxn: form.proofTxn || null,
    });
  }

  return (
    <InvModalShell
      title="Log payment"
      sub="Record a payment against an invoice. Balance updates automatically; attach the receipt as proof now, or upload it later."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={submit}>
            <VyIcon name="check" size={14} /><span>Log payment</span>
          </button>
        </>
      }
    >
      {/* Which invoice is this payment part of */}
      <div style={{ marginBottom: 16 }}>
        <InvFormField label="Invoice this payment is for">
          <select className="vy-input" style={invInputStyle} value={invId} onChange={(e) => pickInvoice(e.target.value)}>
            {invoices.map((i) => {
              const bal = invBalance(i);
              return (
                <option key={i.id} value={i.id}>
                  {i.id} · {invStatus(i)} · {bal > 0 ? invFmt(bal) + " due" : "settled"}
                </option>
              );
            })}
          </select>
        </InvFormField>
      </div>

      {/* Balance context strip for the selected invoice */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 14px", borderRadius: 10, background: settled ? "hsl(var(--success, 142 71% 45%) / 0.1)" : "hsl(var(--accent) / 0.6)", border: "1px solid hsl(var(--border))", marginBottom: 18 }}>
        <VyIcon name={settled ? "check" : "dollar"} size={13} style={{ color: settled ? "hsl(var(--success, 142 71% 45%))" : "hsl(var(--primary))" }} />
        <span className="vy-kicker">{invoice.vendor} · {settled ? "fully paid" : "outstanding"}</span>
        <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{invFmt(balance)}</span>
      </div>
      {settled ? (
        <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: -10, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <VyIcon name="info" size={12} /><span>This invoice is settled — pick an invoice with a balance above to log a payment.</span>
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <InvFormField label="Amount (USD)" half>
          <input type="number" step="0.01" className="vy-input" style={{ ...invInputStyle, borderColor: over ? "hsl(var(--warning))" : "hsl(var(--input))" }} value={form.amount} onChange={set("amount")} placeholder="0.00" />
          <span style={{ fontSize: 10.5, color: over ? "hsl(var(--warning))" : "hsl(var(--muted-fg))", marginTop: 1 }}>
            {settled ? "Nothing due on this invoice" : over ? "Exceeds balance — logs an overpayment" : "Balance is " + invFmt(balance)}
          </span>
        </InvFormField>
        <InvFormField label="Date" half>
          <input className="vy-input" style={invInputStyle} value={form.date} onChange={set("date")} placeholder="e.g. Jan 15" />
        </InvFormField>
        <InvFormField label="Method" half>
          <select className="vy-input" style={invInputStyle} value={form.method} onChange={set("method")}>
            <option>Mercury</option><option>Wire</option><option>Wise</option><option>Alipay</option><option>Cash</option><option>Other</option>
          </select>
        </InvFormField>
        <InvFormField label="Status" half>
          <select className="vy-input" style={invInputStyle} value={form.status} onChange={set("status")}>
            <option>Cleared</option><option>Scheduled</option><option>Failed</option>
          </select>
        </InvFormField>
        <InvFormField label="Reference (optional)">
          <input className="vy-input" style={invInputStyle} value={form.ref} onChange={set("ref")} placeholder="e.g. MERC-0115" />
        </InvFormField>
        <InvFormField label="Proof of payment">
          {typeof MercuryProofField === "function"
            ? <MercuryProofField amount={amt} vendor={invoice ? invoice.vendor : ""} value={{ proof: form.proof, proofKind: form.proofKind, proofName: form.proofName, proofTxn: form.proofTxn }} onChange={(patch) => setForm((p) => ({ ...p, ...patch }))} />
            : null}
        </InvFormField>
      </div>
    </InvModalShell>
  );
}

// ----------------------------------------------------------------------
// ALL PAYMENTS DRAWER — every payment across the order, attributed by invoice.
// The order-wide lens that complements the per-invoice drawer.
// ----------------------------------------------------------------------
const INV_MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function invDateSort(label) {
  const m = String(label || "").match(/([A-Za-z]{3})\s*(\d{1,2})/);
  if (!m || INV_MONTHS[m[1]] == null) return -1;
  return INV_MONTHS[m[1]] * 31 + Number(m[2]);
}

function InvAllPaymentsDrawer({ invoices, onClose, onOpenInvoice }) {
  const [shown, setShown] = useInvState(false);
  useInvEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const mono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
  const rows = [];
  invoices.forEach((i) => i.payments.forEach((p) => rows.push({ ...p, invId: i.id, vendor: i.vendor })));
  rows.sort((a, b) => invDateSort(b.date) - invDateSort(a.date));

  const totalPaid = invoices.reduce((n, i) => n + invPaid(i), 0);
  const cleared = rows.filter((r) => r.status === "Cleared");
  const proofMissing = cleared.filter((r) => !r.proof).length;

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.4)", opacity: shown ? 1 : 0, transition: "opacity 200ms ease" }} />
      <aside style={{
        position: "absolute", top: 0, right: 0, height: "100%", width: "min(520px, 96vw)",
        background: "hsl(var(--card))", borderLeft: "1px solid hsl(var(--border))",
        boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
        transform: shown ? "translateX(0)" : "translateX(100%)", transition: "transform 240ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>All payments</div>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{rows.length} payment{rows.length === 1 ? "" : "s"} across {invoices.length} invoice{invoices.length === 1 ? "" : "s"}</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))", flexShrink: 0 }}>
              <VyIcon name="x" size={18} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "hsl(var(--background) / 0.5)", border: "1px solid hsl(var(--border))" }}>
            <div style={{ flex: 1 }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Total paid</div><div style={{ ...mono, fontSize: 15, fontWeight: 700, color: "hsl(var(--success))" }}>{invFmt(totalPaid)}</div></div>
            <div style={{ flex: 1 }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Cleared</div><div style={{ ...mono, fontSize: 15, fontWeight: 700 }}>{cleared.length}</div></div>
            <div style={{ flex: 1 }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Proof missing</div><div style={{ ...mono, fontSize: 15, fontWeight: 700, color: proofMissing ? "hsl(var(--warning))" : "hsl(var(--success))" }}>{proofMissing}</div></div>
          </div>
        </div>

        {/* Body — chronological, attributed by invoice */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
          {rows.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((p, idx) => (
                <button key={idx} type="button" onClick={() => onOpenInvoice(p.invId)} style={{
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", textAlign: "left", cursor: "pointer",
                  padding: "11px 13px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)", color: "hsl(var(--foreground))",
                }}>
                  <div style={{ minWidth: 44, fontSize: 12, fontWeight: 600, color: "hsl(var(--muted-fg))" }}>{p.date}</div>
                  <div style={{ minWidth: 90, fontSize: 14, fontWeight: 700, ...mono }}>{invFmt(p.amount)}</div>
                  <div style={{ fontSize: 12 }}>{p.method}</div>
                  <span className={"vy-badge vy-badge--" + (PAYTONE[p.status] || "muted")}>{p.status}</span>
                  {p.status === "Cleared" ? (() => { const b = (typeof mercProofBadge === "function") ? mercProofBadge(p) : (p.proof ? { label: "Receipt", tone: "success", title: "" } : null); return b ? <span className={"vy-badge vy-badge--" + b.tone} title={b.title}>{b.label}</span> : <span className="vy-badge vy-badge--warning">Proof?</span>; })() : null}
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "hsl(var(--primary))", fontWeight: 600 }}>
                    <span style={{ ...mono }}>{p.invId}</span><VyIcon name="arrowRight" size={12} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "hsl(var(--muted-fg))" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>No payments logged yet</div>
              <p style={{ fontSize: 11.5, margin: "4px 0 0" }}>Payments you log against any invoice will appear here.</p>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--outline" onClick={onClose} style={{ marginLeft: "auto" }}>Close</button>
        </div>
      </aside>
    </div>,
    document.body
  );
}

// ----------------------------------------------------------------------
// New / Edit invoice modals
// ----------------------------------------------------------------------
const INV_TYPE_VIA = { Supplier: "Supplier · Goods", Agent: "Agent · Service", Forwarder: "Freight", Inspection: "Service · Inspection", Other: "Other" };
const INV_TYPE_PREFIX = { Supplier: "PI", Agent: "AGT", Forwarder: "FRT", Inspection: "INSP", Other: "INV" };

// Seed the payment term for a vendor type (mirrors paySeedTerms in payables-data).
function invSeedTermFor(type) {
  if (type === "Supplier") return { type: "TT", depositPct: 30, netDays: 0 };
  if (type === "Forwarder") return { type: "OA", depositPct: 0, netDays: 15 };
  if (type === "Agent") return { type: "TT", depositPct: 0, netDays: 0 };
  if (type === "Inspection") return { type: "OA", depositPct: 0, netDays: 7 };
  return { type: "TT", depositPct: 30, netDays: 0 };
}
const invChipStyle = (on) => ({ padding: "7px 13px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? "hsl(var(--primary))" : "hsl(var(--border))"), background: on ? "hsl(var(--primary))" : "hsl(var(--background))", color: on ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" });

// Existing vendors to pick from (created in Suppliers / Partners). Falls back to
// the vendors that already appear on bills if those directories aren't loaded.
function invVendorOptions() {
  const set = new Set();
  (window.PAY_INVOICES || []).forEach((p) => set.add(p.vendor));
  try { if (typeof supBuildDirectory === "function") supBuildDirectory().forEach((s) => set.add(s.name || s.vendor)); } catch (e) {}
  try { if (typeof parBuildDirectory === "function") parBuildDirectory().forEach((pp) => set.add(pp.name)); } catch (e) {}
  return [...set].filter(Boolean).sort();
}
// A vendor's TYPE is a property of the vendor (set in Suppliers / Partners),
// so the invoice inherits it — we don't ask for it again for known vendors.
function invVendorType(name) {
  if (!name) return null;
  const hit = (window.PAY_INVOICES || []).find((p) => p.vendor === name);
  if (hit) return hit.vendorType;
  try { if (typeof supBuildDirectory === "function" && supBuildDirectory().some((s) => (s.name || s.vendor) === name)) return "Supplier"; } catch (e) {}
  try { if (typeof parBuildDirectory === "function") { const m = parBuildDirectory().find((p) => p.name === name); if (m) return m.type || "Forwarder"; } } catch (e) {}
  return null;
}

function InvNewInvoiceModal({ onClose, onSubmit }) {
  const [form, setForm] = useInvState({ vendor: "", type: "Supplier", total: "", due: "" });
  const [term, setTerm] = useInvState(() => invSeedTermFor("Supplier"));
  const [newVendor, setNewVendor] = useInvState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  function pickType(type) { setForm((p) => ({ ...p, type })); setTerm(invSeedTermFor(type)); }
  const total = Number(form.total) || 0;
  const valid = form.vendor.trim() && total > 0;
  const termTypes = (typeof PAYTERM_TYPES !== "undefined" && PAYTERM_TYPES) ? PAYTERM_TYPES : [];
  const ttPresets = (typeof PAYTERM_TT_PRESETS !== "undefined" && PAYTERM_TT_PRESETS) ? PAYTERM_TT_PRESETS : [30, 50, 0, 100];
  const termInfo = (typeof PAYTERM_BY_KEY !== "undefined" && PAYTERM_BY_KEY[term.type]) ? PAYTERM_BY_KEY[term.type] : null;
  const termSummary = (typeof payTermSummary === "function") ? payTermSummary(term) : "";
  const typeChips = ["Supplier", "Agent", "Forwarder", "Inspection", "Other"];
  const vendorOpts = invVendorOptions();

  function submit() {
    const id = INV_TYPE_PREFIX[form.type] + "-NEW-" + Date.now().toString().slice(-4);
    onSubmit({
      id,
      vendor: form.vendor.trim(),
      via: INV_TYPE_VIA[form.type],
      vendorType: form.type,
      orderId: invCurrentOrderId(),
      kind: "Payable",
      file: null,
      total,
      due: form.due.trim() || "—",
      lines: [{ label: form.vendor.trim() + " — " + form.type.toLowerCase(), type: "Charge", amount: total }],
      payments: [],
      terms: term,
    });
  }

  return (
    <InvModalShell
      title="New invoice"
      sub="Add a vendor bill to this order — set its vendor, amount, due date and payment terms."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={submit}>
            <VyIcon name="check" size={14} /><span>Create invoice</span>
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Vendor — pick one created in Suppliers / Partners, or add a new name */}
        <InvFormField label="Vendor">
          {!newVendor ? (
            <select className="vy-input" style={invInputStyle} value={form.vendor} onChange={(e) => { const v = e.target.value; if (v === "__new__") { setNewVendor(true); setForm((p) => ({ ...p, vendor: "" })); return; } const vt = invVendorType(v) || form.type; setForm((p) => ({ ...p, vendor: v, type: vt })); setTerm(invSeedTermFor(vt)); }}>
              <option value="">Select a vendor…</option>
              {vendorOpts.map((v) => <option key={v} value={v}>{v}</option>)}
              <option value="__new__">+ New vendor…</option>
            </select>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input className="vy-input" style={invInputStyle} value={form.vendor} onChange={set("vendor")} placeholder="New vendor name" autoFocus />
              <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ flexShrink: 0 }} onClick={() => { setNewVendor(false); setForm((p) => ({ ...p, vendor: "" })); }}>Pick existing</button>
            </div>
          )}
        </InvFormField>

        {/* Type — follows the vendor (read-only for known vendors); only choose it
            when adding a brand-new vendor (normally created in Partners). */}
        {newVendor ? (
          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Type <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "hsl(var(--muted-fg))" }}>· new vendors are usually added in Partners</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {typeChips.map((t) => <button key={t} type="button" onClick={() => pickType(t)} style={invChipStyle(form.type === t)}>{t}</button>)}
            </div>
          </div>
        ) : form.vendor ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="vy-kicker">Type</span>
            <span className="vy-badge vy-badge--muted">{form.type}</span>
            <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>· from the vendor record</span>
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <InvFormField label="Total (USD)" half>
            <input type="number" step="0.01" className="vy-input" style={invInputStyle} value={form.total} onChange={set("total")} placeholder="0.00" />
          </InvFormField>
          <InvFormField label="Due (optional)" half>
            <input className="vy-input" style={invInputStyle} value={form.due} onChange={set("due")} placeholder="e.g. May 30" />
          </InvFormField>
        </div>

        {/* Payment terms — segmented + plain-English explanation of the selected term */}
        <div>
          <div className="vy-kicker" style={{ marginBottom: 8 }}>Payment terms</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {termTypes.map((t) => <button key={t.key} type="button" title={t.name} onClick={() => setTerm((tm) => ({ ...tm, type: t.key }))} style={invChipStyle(term.type === t.key)}>{t.label}</button>)}
          </div>
          {termInfo ? (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 11px", borderRadius: 9, background: "hsl(var(--info) / 0.07)", border: "1px solid hsl(var(--info) / 0.22)", marginBottom: (term.type === "TT" || term.type === "OA") ? 10 : 0 }}>
              <VyIcon name="info" size={13} style={{ color: "hsl(var(--info))", flexShrink: 0, marginTop: 1 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{termInfo.name}</div>
                <p style={{ fontSize: 11, color: "hsl(var(--muted-fg))", margin: "2px 0 0", lineHeight: 1.5 }}>{termInfo.blurb}</p>
              </div>
            </div>
          ) : null}
          {term.type === "TT" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {ttPresets.map((p) => { const lbl = p === 0 ? "0 / 100" : p === 100 ? "100% upfront" : p + " / " + (100 - p); return <button key={p} type="button" onClick={() => setTerm((tm) => ({ ...tm, depositPct: p }))} style={invChipStyle(Number(term.depositPct) === p)}>{lbl}</button>; })}
            </div>
          ) : term.type === "OA" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {[15, 30, 60, 90].map((nd) => <button key={nd} type="button" onClick={() => setTerm((tm) => ({ ...tm, netDays: nd }))} style={invChipStyle(Number(term.netDays || 30) === nd)}>Net {nd}</button>)}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 10, background: "hsl(var(--accent) / 0.5)", border: "1px solid hsl(var(--border))", fontSize: 12 }}>
          <VyIcon name="info" size={13} style={{ color: "hsl(var(--primary))", flexShrink: 0 }} />
          <span style={{ color: "hsl(var(--muted-fg))" }}>Creates as <strong style={{ color: "hsl(var(--foreground))" }}>Unpaid</strong> · {INV_TYPE_VIA[form.type]} · <strong style={{ color: "hsl(var(--foreground))" }}>{termSummary}</strong> · balance starts at {total > 0 ? invFmt(total) : "the full total"}.</span>
        </div>
      </div>
    </InvModalShell>
  );
}

function InvEditInvoiceModal({ invoice, onClose, onSubmit }) {
  const startType = invoice.vendorType || Object.keys(INV_TYPE_VIA).find((k) => INV_TYPE_VIA[k] === invoice.via) || "Other";
  const [form, setForm] = useInvState({ vendor: invoice.vendor, type: startType, total: String(invoice.total), due: invoice.due });
  const [newVendor, setNewVendor] = useInvState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const total = Number(form.total) || 0;
  const paid = invPaid(invoice);
  const valid = form.vendor.trim() && total > 0;
  const belowPaid = total < paid - 0.005;
  const typeChips = ["Supplier", "Agent", "Forwarder", "Inspection", "Other"];
  // Ensure the current vendor is in the option list even if not in the directory.
  const vendorOpts = [...new Set([invoice.vendor, ...invVendorOptions()])].filter(Boolean).sort();

  function submit() {
    onSubmit(invoice.id, {
      vendor: form.vendor.trim(),
      via: INV_TYPE_VIA[form.type],
      vendorType: form.type,
      total,
      due: form.due.trim() || "—",
    });
  }

  return (
    <InvModalShell
      title={"Edit " + invoice.id}
      sub="Update the bill's vendor, total or due date. Type follows the vendor. Payments stay as logged."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={submit}>
            <VyIcon name="check" size={14} /><span>Save changes</span>
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Vendor — pick one created in Suppliers / Partners, or add a new name */}
        <InvFormField label="Vendor">
          {!newVendor ? (
            <select className="vy-input" style={invInputStyle} value={form.vendor} onChange={(e) => { const v = e.target.value; if (v === "__new__") { setNewVendor(true); setForm((p) => ({ ...p, vendor: "" })); return; } const vt = invVendorType(v) || form.type; setForm((p) => ({ ...p, vendor: v, type: vt })); }}>
              {vendorOpts.map((v) => <option key={v} value={v}>{v}</option>)}
              <option value="__new__">+ New vendor…</option>
            </select>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input className="vy-input" style={invInputStyle} value={form.vendor} onChange={set("vendor")} placeholder="New vendor name" autoFocus />
              <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ flexShrink: 0 }} onClick={() => { setNewVendor(false); setForm((p) => ({ ...p, vendor: invoice.vendor })); }}>Pick existing</button>
            </div>
          )}
        </InvFormField>

        {/* Type — follows the vendor (read-only); editable only for a new vendor */}
        {newVendor ? (
          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Type</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {typeChips.map((t) => <button key={t} type="button" onClick={() => setForm((p) => ({ ...p, type: t }))} style={invChipStyle(form.type === t)}>{t}</button>)}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="vy-kicker">Type</span>
            <span className="vy-badge vy-badge--muted">{form.type}</span>
            <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>· from the vendor record</span>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <InvFormField label="Total (USD)" half>
            <input type="number" step="0.01" className="vy-input" style={{ ...invInputStyle, borderColor: belowPaid ? "hsl(var(--warning))" : "hsl(var(--input))" }} value={form.total} onChange={set("total")} />
            {belowPaid ? <span style={{ fontSize: 10.5, color: "hsl(var(--warning))", marginTop: 1 }}>Below the {invFmt(paid)} already paid — would show as overpaid.</span> : null}
          </InvFormField>
          <InvFormField label="Due" half>
            <input className="vy-input" style={invInputStyle} value={form.due} onChange={set("due")} />
          </InvFormField>
        </div>
      </div>
    </InvModalShell>
  );
}

function InvEditPaymentModal({ invoice, payIdx, onClose, onSave, onDelete, onAttachReceipt }) {
  const p = invoice.payments[payIdx] || {};
  const [form, setForm] = useInvState({
    amount: String(p.amount != null ? p.amount : ""),
    date: p.date || "",
    method: p.method || "Mercury",
    status: p.status || "Cleared",
    ref: p.id && p.id !== "—" ? p.id : "",
  });
  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));
  const amt = Number(form.amount) || 0;
  const valid = amt > 0 && form.date.trim();

  function save() {
    onSave(invoice.id, payIdx, {
      amount: amt,
      date: form.date.trim(),
      method: form.method,
      status: form.status,
      id: form.ref.trim() || "—",
    });
  }

  return (
    <InvModalShell
      title="Edit payment"
      sub={"Against " + invoice.id + " · " + invoice.vendor}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" style={{ color: "hsl(var(--danger))", marginRight: "auto" }} onClick={() => onDelete(invoice.id, payIdx)}>
            <VyIcon name="trash" size={13} /><span>Delete</span>
          </button>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={save}>
            <VyIcon name="check" size={14} /><span>Save</span>
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <InvFormField label="Amount (USD)" half>
          <input type="number" step="0.01" className="vy-input" style={invInputStyle} value={form.amount} onChange={set("amount")} />
        </InvFormField>
        <InvFormField label="Date" half>
          <input className="vy-input" style={invInputStyle} value={form.date} onChange={set("date")} placeholder="e.g. Jan 15" />
        </InvFormField>
        <InvFormField label="Method" half>
          <select className="vy-input" style={invInputStyle} value={form.method} onChange={set("method")}>
            <option>Mercury</option><option>Wire</option><option>Wise</option><option>Alipay</option><option>Cash</option><option>Other</option>
          </select>
        </InvFormField>
        <InvFormField label="Status" half>
          <select className="vy-input" style={invInputStyle} value={form.status} onChange={set("status")}>
            <option>Cleared</option><option>Scheduled</option><option>Failed</option>
          </select>
        </InvFormField>
        <InvFormField label="Reference (optional)">
          <input className="vy-input" style={invInputStyle} value={form.ref} onChange={set("ref")} placeholder="e.g. MERC-0115" />
        </InvFormField>
      </div>

      {/* Receipt */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, padding: "11px 13px", borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--background) / 0.4)" }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: p.proof ? "hsl(var(--success) / 0.12)" : "hsl(var(--muted-bg))", color: p.proof ? "hsl(var(--success))" : "hsl(var(--muted-fg))" }}>
          <VyIcon name="fileText" size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.proofKind === "mercury" ? "Mercury transaction linked" : p.proof ? "Receipt on file" : "No receipt attached"}</div>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{p.proofKind === "mercury" && p.proofTxn ? p.proofTxn.counterparty + " · " + p.proofTxn.id : "PDF, image, or spreadsheet"}</div>
        </div>
        <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={onAttachReceipt}>
          <VyIcon name="upload" size={12} /><span>{p.proof ? "Replace" : "Attach"}</span>
        </button>
      </div>
    </InvModalShell>
  );
}

Object.assign(window, { VyInvoicesBody, INV_INVOICES });