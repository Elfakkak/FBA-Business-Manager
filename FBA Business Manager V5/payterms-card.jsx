// payterms-card.jsx — the "Payment terms" card for the order Invoices section.
// Reads the structured term (payterms-data) and the order's SUPPLIER invoice
// total/paid to render the deposit→balance schedule with live paid/due status.
// Each term type shows a plain-English explanation. Editable inline (persisted
// via payTermSave). Exposes InvPaymentTermsCard. Load after payterms-data.jsx
// and BEFORE invoices-app.jsx.

const { useState: usePtState } = React;
const ptMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };

function ptFmt(n) {
  const neg = n < 0;
  const s = Math.abs(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (neg ? "-$" : "$") + s;
}

function ptOrderId() { try { return new URLSearchParams(location.search).get("order") || "ORD-2026-05-006"; } catch (e) { return "ORD-2026-05-006"; } }
function ptVendorType(invoice) {
  if (invoice.vendorType) return invoice.vendorType;
  const v = invoice.via || "";
  if (/supplier/i.test(v)) return "Supplier";
  if (/freight|forward/i.test(v)) return "Forwarder";
  if (/agent/i.test(v)) return "Agent";
  if (/inspect/i.test(v)) return "Inspection";
  return "Supplier";
}

// Per-INVOICE payment terms: each vendor relationship carries its own term
// (supplier T/T 30/70, freight Net 15, …). Reads/writes the shared invoice
// record via payInvoiceTerms / paySaveInvoiceTerms (payables-data.jsx).
function InvPaymentTermsCard({ invoice, paid, onChanged }) {
  const invObj = { id: invoice.id, orderId: invoice.orderId || ptOrderId(), vendorType: ptVendorType(invoice), total: Number(invoice.total) || 0 };
  const [cfg, setCfg] = usePtState(() => payInvoiceTerms(invObj));
  const [editing, setEditing] = usePtState(false);
  const [draft, setDraft] = usePtState(cfg);
  React.useEffect(() => { setCfg(payInvoiceTerms(invObj)); setEditing(false); }, [invoice.id]);

  const type = PAYTERM_BY_KEY[cfg.type] || PAYTERM_BY_KEY.TT;
  const total = Number(invoice.total) || 0;
  const paidAmt = Number(paid) || 0;
  const hasInvoice = total > 0;
  const schedule = payTermSchedule(cfg, total, paidAmt);

  function startEdit() { setDraft(cfg); setEditing(true); }
  function cancel() { setEditing(false); }
  function save() { const saved = paySaveInvoiceTerms(invObj, draft); setCfg(saved); setEditing(false); if (typeof onChanged === "function") onChanged(saved); }

  const draftType = PAYTERM_BY_KEY[draft.type] || PAYTERM_BY_KEY.TT;

  return (
    <section className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="receipt" size={15} /></span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Payment terms</h3>
            <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>How and when you pay {invoice.vendor} on {invoice.id} — and what's left to pay.</p>
          </div>
        </div>
        {!editing ? (
          <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ flexShrink: 0 }} onClick={startEdit}><VyIcon name="pencil" size={12} /><span>Edit</span></button>
        ) : (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={cancel}>Cancel</button>
            <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" onClick={save}><VyIcon name="check" size={12} /><span>Save</span></button>
          </div>
        )}
      </div>

      {!editing ? (
        <>
          {/* Selected term + plain-English explanation */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, flexWrap: "wrap" }}>
            <span className="vy-badge vy-badge--info" style={{ fontWeight: 700 }}>{type.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{type.name}</span>
            <span style={{ ...ptMono, fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>· {payTermSummary(cfg)}</span>
          </div>
          <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "0 0 16px", lineHeight: 1.5, maxWidth: "70ch" }}>{type.blurb}</p>

          {/* Schedule tied to the supplier invoice */}
          {hasInvoice ? (
            <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 11, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "hsl(var(--background) / 0.5)", borderBottom: "1px solid hsl(var(--border))" }}>
                <span className="vy-kicker">Schedule · on {ptFmt(total)} {invObj.vendorType.toLowerCase()} invoice</span>
                <span style={{ ...ptMono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{ptFmt(paidAmt)} paid</span>
              </div>
              {schedule.map((s, i) => {
                const tone = s.settled ? "success" : s.partial ? "warning" : "muted";
                const toneFg = tone === "success" ? "hsl(var(--success, 142 71% 45%))" : tone === "warning" ? "hsl(38 92% 45%)" : "hsl(var(--muted-fg))";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i > 0 ? "1px solid hsl(var(--border) / 0.6)" : "none" }}>
                    <span style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--" + (tone === "muted" ? "muted" : tone === "success" ? "success, 142 71% 45%" : "warning") + ") / 0.14)", color: toneFg }}>
                      <VyIcon name={s.settled ? "check" : "dollar"} size={13} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label} {s.pct ? <span style={{ color: "hsl(var(--muted-fg))", fontWeight: 500 }}>· {s.pct}%</span> : null}</div>
                      <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{s.when}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ ...ptMono, fontSize: 13.5, fontWeight: 700 }}>{ptFmt(s.amount)}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: toneFg }}>{s.settled ? "Paid" : s.partial ? ptFmt(s.paidAmt) + " paid" : "Due"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "14px", border: "1px dashed hsl(var(--border))", borderRadius: 10, fontSize: 12, color: "hsl(var(--muted-fg))", textAlign: "center" }}>
              Add the supplier invoice to see the {type.label} schedule with amounts.
            </div>
          )}
        </>
      ) : (
        <>
          {/* Term type picker */}
          <div className="vy-kicker" style={{ marginBottom: 8 }}>Term type</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {PAYTERM_TYPES.map((t) => {
              const on = draft.type === t.key;
              return (
                <button key={t.key} type="button" onClick={() => setDraft((d) => ({ ...d, type: t.key }))}
                  style={{ padding: "7px 13px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? "hsl(var(--primary))" : "hsl(var(--border))"), background: on ? "hsl(var(--primary))" : "hsl(var(--background))", color: on ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" }}
                  title={t.name}>
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Explanation of the term being chosen */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 13px", borderRadius: 10, background: "hsl(var(--info) / 0.07)", border: "1px solid hsl(var(--info) / 0.25)", marginBottom: 14 }}>
            <VyIcon name="info" size={14} style={{ color: "hsl(var(--info))", flexShrink: 0, marginTop: 1 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{draftType.name}</div>
              <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0", lineHeight: 1.5 }}>{draftType.blurb}</p>
            </div>
          </div>

          {/* Type-specific config */}
          {draft.type === "TT" ? (
            <div>
              <div className="vy-kicker" style={{ marginBottom: 8 }}>Deposit split</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {PAYTERM_TT_PRESETS.map((p) => {
                  const on = Number(draft.depositPct) === p;
                  const lbl = p === 0 ? "0 / 100" : p === 100 ? "100% upfront" : p + " / " + (100 - p);
                  return (
                    <button key={p} type="button" onClick={() => setDraft((d) => ({ ...d, depositPct: p }))}
                      style={{ padding: "7px 13px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? "hsl(var(--primary))" : "hsl(var(--border))"), background: on ? "hsl(var(--primary))" : "hsl(var(--background))", color: on ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" }}>
                      {lbl}
                    </button>
                  );
                })}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
                  <input type="number" min="0" max="100" value={draft.depositPct} onChange={(e) => setDraft((d) => ({ ...d, depositPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
                    style={{ width: 78, height: 36, padding: "0 10px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", ...ptMono }} />
                  <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>% deposit</span>
                </div>
              </div>
            </div>
          ) : draft.type === "OA" ? (
            <div>
              <div className="vy-kicker" style={{ marginBottom: 8 }}>Credit period</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {[30, 60, 90].map((nd) => {
                  const on = Number(draft.netDays || 30) === nd;
                  return (
                    <button key={nd} type="button" onClick={() => setDraft((d) => ({ ...d, netDays: nd }))}
                      style={{ padding: "7px 13px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? "hsl(var(--primary))" : "hsl(var(--border))"), background: on ? "hsl(var(--primary))" : "hsl(var(--background))", color: on ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" }}>
                      Net {nd}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>No extra settings — the full invoice is due at the milestone above.</div>
          )}
        </>
      )}
    </section>
  );
}

Object.assign(window, { InvPaymentTermsCard });
