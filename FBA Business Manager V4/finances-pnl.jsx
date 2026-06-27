// finances-pnl.jsx — the P&L (profit & loss) view for Finance: a true FBA
// profit statement per month + a year total, plus a recurring-overhead manager.
// Mechanism (Jungle-Scout style): Amazon payout is ALREADY net of Amazon fees &
// ads, so we start there and subtract COGS (supplier/freight, from Payables),
// logged one-off expenses, and recurring overhead → true NET profit + margin.
// Reads finDerive / finPayablesExpenses / finMonthKey (finances-data),
// recur* (recurring-data), VyIcon. Load after recurring-data, before finances-app.

const { useState: usePnlState } = React;
const pnlMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const pnlInput = { width: "100%", height: 38, padding: "0 12px", fontSize: 13.5, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", boxSizing: "border-box" };

function pnlFmt(n) { const s = n < 0 ? "-" : ""; return s + "$" + Math.abs(Math.round(Number(n) || 0)).toLocaleString(); }

// Build the per-month P&L rows from finance data + recurring overhead.
function pnlBuild(D) {
  const payables = (typeof finPayablesExpenses === "function") ? finPayablesExpenses() : [];
  const cogsByMonth = {};
  payables.forEach((e) => { const k = finMonthKey(e.date); cogsByMonth[k] = (cogsByMonth[k] || 0) + (Number(e.amount) || 0); });
  const recurList = (typeof recurLoad === "function") ? recurLoad() : [];

  const cols = D.months.map((m) => {
    const revenue = m.revenue;
    const cogs = cogsByMonth[m.key] || 0;
    const loggedOpex = Math.max(0, m.expense - cogs);          // manual one-off expenses
    const recurring = (typeof recurAddableForMonth === "function") ? recurAddableForMonth(m.key, recurList) : ((typeof recurForMonth === "function") ? recurForMonth(m.key, recurList) : 0);
    const grossProfit = revenue - cogs;
    const net = revenue - cogs - loggedOpex - recurring;
    const amz = (typeof amzForMonth === "function") ? amzForMonth(m.key) : null;
    const units = amz ? amz.units : null;
    return {
      key: m.key, label: m.label,
      revenue, cogs, grossProfit, loggedOpex, recurring, net,
      margin: revenue > 0 ? net / revenue : 0,
      units, netPerUnit: units ? net / units : null, amz,
    };
  });

  // Year total column
  const sum = (f) => cols.reduce((n, c) => n + f(c), 0);
  const year = {
    label: "Year", revenue: sum((c) => c.revenue), cogs: sum((c) => c.cogs),
    grossProfit: sum((c) => c.grossProfit), loggedOpex: sum((c) => c.loggedOpex),
    recurring: sum((c) => c.recurring), net: sum((c) => c.net),
    units: sum((c) => c.units || 0),
  };
  year.margin = year.revenue > 0 ? year.net / year.revenue : 0;
  year.netPerUnit = year.units ? year.net / year.units : null;
  return { cols, year, recurList };
}

function FinPnl({ D, onChanged }) {
  const [tick, setTick] = usePnlState(0);
  const [modal, setModal] = usePnlState(null); // null | 'add' | {edit:item}
  const built = pnlBuild(D);
  const { cols, year } = built;
  const recurList = (typeof recurLoad === "function") ? recurLoad() : [];
  const recurMonthlyTot = (typeof recurMonthlyTotal === "function") ? recurMonthlyTotal(recurList) : 0;
  // Committed-but-unpaid supplier bills: invoiced cost not yet in COGS (COGS
  // counts PAID invoices). This is the gap between actual and estimated COGS.
  const unpaidCogs = (typeof finOpenInvoices === "function")
    ? finOpenInvoices().reduce((n, i) => n + ((typeof payBalance === "function") ? payBalance(i) : Math.max(0, (i.total || 0) - (i.paid || 0))), 0)
    : 0;
  const amzConn = (typeof amzConnected === "function") ? amzConnected() : false;
  const hasUnits = cols.some((c) => c.units != null);

  function refresh() { setTick((n) => n + 1); if (onChanged) onChanged(); }

  // statement rows (label, accessor, style)
  const rows = [
    { k: "revenue", label: "Revenue (Amazon payout)", hint: "Already net of Amazon fees & ads", get: (c) => c.revenue, strong: true },
    { k: "cogs", label: "− COGS (product + freight)", hint: "Supplier/freight/agent/inspection paid, from Payables", get: (c) => -c.cogs, muted: true },
    { k: "gross", label: "= Gross profit", get: (c) => c.grossProfit, rule: true },
    { k: "opex", label: "− Operating (logged)", hint: "One-off expenses you've logged", get: (c) => -c.loggedOpex, muted: true },
    { k: "recur", label: "− Recurring overhead", hint: "Forecast items not yet in the bank; matched ones sit in Operating above", get: (c) => -c.recurring, muted: true },
    { k: "net", label: "= NET PROFIT", get: (c) => c.net, net: true, rule: true },
  ];
  // units + per-unit rows appended only when Amazon data is available
  const amzT = (typeof amzTotals === "function") ? amzTotals() : null;
  const unitRows = hasUnits ? [
    { k: "units", label: "Units sold", get: (c) => (c.units != null ? c.units : 0), unit: true },
    { k: "perunit", label: "Net profit / unit", get: (c) => (c.netPerUnit != null ? c.netPerUnit : 0), perunit: true },
  ] : [];

  return (
    <>
      {/* KPI strip: this-period net + margin + recurring overhead */}
      <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="vy-card vy-kpi vy-kpi--success">
          <span className="vy-kicker">Net profit · year</span>
          <div className="vy-kpi-value" style={{ fontSize: 19, color: year.net >= 0 ? "hsl(var(--success, 142 71% 45%))" : "hsl(38 92% 45%)" }}>{pnlFmt(year.net)}</div>
          <div className="vy-kpi-sub">across {cols.length} month{cols.length === 1 ? "" : "s"}</div>
        </div>
        <div className="vy-card vy-kpi">
          <span className="vy-kicker">Net margin</span>
          <div className="vy-kpi-value" style={{ fontSize: 19 }}>{Math.round(year.margin * 100)}%</div>
          <div className="vy-kpi-sub">net ÷ revenue</div>
        </div>
        <div className="vy-card vy-kpi">
          <span className="vy-kicker">Avg net / month</span>
          <div className="vy-kpi-value" style={{ fontSize: 19 }}>{pnlFmt(cols.length ? year.net / cols.length : 0)}</div>
          <div className="vy-kpi-sub">{pnlFmt(cols.length ? year.net / cols.length / 2 : 0)} per ~14-day payout</div>
        </div>
        <div className="vy-card vy-kpi vy-kpi--warning">
          <span className="vy-kicker">Recurring overhead</span>
          <div className="vy-kpi-value" style={{ fontSize: 19 }}>{pnlFmt(recurMonthlyTot)}<span style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--muted-fg))" }}>/mo</span></div>
          <div className="vy-kpi-sub">{recurList.length} fixed item{recurList.length === 1 ? "" : "s"}</div>
        </div>
        {amzT ? (
          <div className="vy-card vy-kpi">
            <span className="vy-kicker">Ad spend · TACoS</span>
            <div className="vy-kpi-value" style={{ fontSize: 19 }}>{Math.round(amzT.tacos * 100)}%</div>
            <div className="vy-kpi-sub">{pnlFmt(amzT.adSpend)} PPC · already in payout</div>
          </div>
        ) : null}
        {unpaidCogs > 0.5 ? (
          <div className="vy-card vy-kpi">
            <span className="vy-kicker">Committed COGS</span>
            <div className="vy-kpi-value" style={{ fontSize: 19 }}>{pnlFmt(unpaidCogs)}</div>
            <div className="vy-kpi-sub">invoiced, not yet paid → not in COGS</div>
          </div>
        ) : null}
      </div>

      {/* P&L statement table */}
      <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div className="vy-kicker">Profit &amp; loss</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>Each month's true net: Amazon payout minus product cost, freight, expenses and overhead.</div>
          {hasUnits ? <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: amzConn ? "hsl(var(--success, 142 71% 45%))" : "hsl(38 92% 50%)" }} />Units {amzConn ? "live from Amazon" : "sample — wires to Amazon SP-API when connected"}</div> : null}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))" }}>Line</th>
                {cols.map((c) => <th key={c.key} style={{ padding: "10px 12px", textAlign: "right", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" }}>{c.label}</th>)}
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", color: "hsl(var(--foreground))", borderLeft: "1px solid hsl(var(--border))", whiteSpace: "nowrap" }}>Year</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.k} style={{ borderTop: r.rule ? "1px solid hsl(var(--border))" : "1px solid hsl(var(--border) / 0.4)", background: r.net ? "hsl(var(--success, 142 71% 45%) / 0.06)" : "transparent" }}>
                  <td style={{ padding: "10px 14px", fontSize: 12.5, fontWeight: r.strong || r.net ? 700 : 600, color: r.muted ? "hsl(var(--muted-fg))" : "hsl(var(--foreground))" }}>
                    {r.label}
                    {r.hint ? <div style={{ fontSize: 10, fontWeight: 400, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{r.hint}</div> : null}
                  </td>
                  {cols.map((c) => {
                    const v = r.get(c);
                    return <td key={c.key} style={{ padding: "10px 12px", textAlign: "right", ...pnlMono, fontSize: 12.5, fontWeight: r.net ? 800 : 600, color: r.net ? (c.net >= 0 ? "hsl(var(--success, 142 71% 45%))" : "hsl(38 92% 45%)") : r.muted ? "hsl(var(--muted-fg))" : "hsl(var(--foreground))" }}>{pnlFmt(v)}</td>;
                  })}
                  <td style={{ padding: "10px 14px", textAlign: "right", ...pnlMono, fontSize: 12.5, fontWeight: 800, color: r.net ? (year.net >= 0 ? "hsl(var(--success, 142 71% 45%))" : "hsl(38 92% 45%)") : "hsl(var(--foreground))", borderLeft: "1px solid hsl(var(--border))" }}>{pnlFmt(r.get(year))}</td>
                </tr>
              ))}
              {/* margin row */}
              <tr style={{ borderTop: "1px solid hsl(var(--border) / 0.4)" }}>
                <td style={{ padding: "8px 14px", fontSize: 11.5, fontWeight: 600, color: "hsl(var(--muted-fg))" }}>Net margin</td>
                {cols.map((c) => <td key={c.key} style={{ padding: "8px 12px", textAlign: "right", ...pnlMono, fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{Math.round(c.margin * 100)}%</td>)}
                <td style={{ padding: "8px 14px", textAlign: "right", ...pnlMono, fontSize: 11.5, fontWeight: 700, color: "hsl(var(--foreground))", borderLeft: "1px solid hsl(var(--border))" }}>{Math.round(year.margin * 100)}%</td>
              </tr>
              {/* committed (invoiced-but-unpaid) COGS + projected net — Year only */}
              {unpaidCogs > 0.5 ? (
                <>
                  <tr style={{ borderTop: "1px solid hsl(var(--border))" }}>
                    <td style={{ padding: "8px 14px", fontSize: 11.5, fontWeight: 600, color: "hsl(var(--muted-fg))" }}>− Committed COGS<div style={{ fontSize: 10, fontWeight: 400, color: "hsl(var(--muted-fg))", marginTop: 1 }}>invoiced, not yet paid (est.)</div></td>
                    {cols.map((c) => <td key={c.key} style={{ padding: "8px 12px", textAlign: "right", ...pnlMono, fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>—</td>)}
                    <td style={{ padding: "8px 14px", textAlign: "right", ...pnlMono, fontSize: 11.5, fontWeight: 700, color: "hsl(38 92% 45%)", borderLeft: "1px solid hsl(var(--border))" }}>{pnlFmt(-unpaidCogs)}</td>
                  </tr>
                  <tr style={{ borderTop: "1px solid hsl(var(--border) / 0.4)" }}>
                    <td style={{ padding: "8px 14px", fontSize: 11.5, fontWeight: 700, color: "hsl(var(--foreground))" }}>= Projected net<div style={{ fontSize: 10, fontWeight: 400, color: "hsl(var(--muted-fg))", marginTop: 1 }}>after committed costs clear</div></td>
                    {cols.map((c) => <td key={c.key} style={{ padding: "8px 12px", textAlign: "right", ...pnlMono, fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>—</td>)}
                    <td style={{ padding: "8px 14px", textAlign: "right", ...pnlMono, fontSize: 12, fontWeight: 800, color: (year.net - unpaidCogs) >= 0 ? "hsl(var(--success, 142 71% 45%))" : "hsl(38 92% 45%)", borderLeft: "1px solid hsl(var(--border))" }}>{pnlFmt(year.net - unpaidCogs)}</td>
                  </tr>
                </>
              ) : null}
              {/* units + per-unit (from Amazon source) */}
              {unitRows.map((r) => (
                <tr key={r.k} style={{ borderTop: r.k === "units" ? "1px solid hsl(var(--border))" : "1px solid hsl(var(--border) / 0.4)" }}>
                  <td style={{ padding: "8px 14px", fontSize: 11.5, fontWeight: 600, color: "hsl(var(--muted-fg))" }}>{r.label}</td>
                  {cols.map((c) => {
                    const v = r.get(c);
                    return <td key={c.key} style={{ padding: "8px 12px", textAlign: "right", ...pnlMono, fontSize: 11.5, color: "hsl(var(--foreground))" }}>{r.perunit ? pnlFmt(v) : (c.units != null ? Math.round(v).toLocaleString() : "\u2014")}</td>;
                  })}
                  <td style={{ padding: "8px 14px", textAlign: "right", ...pnlMono, fontSize: 11.5, fontWeight: 700, color: "hsl(var(--foreground))", borderLeft: "1px solid hsl(var(--border))" }}>{r.perunit ? pnlFmt(r.get(year)) : Math.round(r.get(year)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recurring overhead manager */}
      <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <div className="vy-kicker">Recurring overhead</div>
            <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>Fixed costs that hit every period — deducted from each month above.</div>
          </div>
          <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" onClick={() => setModal("add")}><VyIcon name="plus" size={13} /><span>Add</span></button>
        </div>
        <div>
          {recurList.length === 0 ? (
            <div style={{ padding: "22px", textAlign: "center", color: "hsl(var(--muted-fg))", fontSize: 13 }}>No recurring overhead yet. Add salary, software, photography…</div>
          ) : recurList.map((it, i) => {
            const mo = recurMonthly(it);
            const lastKey = (D.months.length ? D.months[D.months.length - 1].key : null);
            const actual = (lastKey && typeof recurActualForMonth === "function") ? recurActualForMonth(it, lastKey) : 0;
            const matched = actual > 0.005;
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: i > 0 ? "1px solid hsl(var(--border) / 0.5)" : "none" }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--warning) / 0.12)", color: "hsl(38 92% 45%)" }}><VyIcon name="refresh" size={14} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{it.name}</div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{it.category} · {pnlFmt(it.amount)} {it.cadence}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ ...pnlMono, fontSize: 13.5, fontWeight: 700 }}>{pnlFmt(mo)}<span style={{ fontSize: 10, fontWeight: 500, color: "hsl(var(--muted-fg))" }}>/mo</span></div>
                  <div style={{ fontSize: 10, fontWeight: 600, marginTop: 1, color: matched ? "hsl(142 71% 38%)" : "hsl(var(--muted-fg))" }}>{matched ? "✓ matched " + pnlFmt(actual) : "forecast — no bank match"}</div>
                </div>
                <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ fontSize: 11 }} onClick={() => setModal({ edit: it })}>Edit</button>
              </div>
            );
          })}
        </div>
      </section>

      {modal === "add" ? <RecurModal onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} /> : null}
      {modal && modal.edit ? <RecurModal item={modal.edit} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} /> : null}
    </>
  );
}

function RecurModal({ item, onClose, onSaved }) {
  const editing = !!item;
  const [name, setName] = usePnlState(item ? item.name : "");
  const [category, setCategory] = usePnlState(item ? item.category : "Software");
  const [amount, setAmount] = usePnlState(item ? String(item.amount) : "");
  const [cadence, setCadence] = usePnlState(item ? item.cadence : "monthly");
  const [matchText, setMatchText] = usePnlState(item ? (item.matchText || "") : "");
  const cats = (typeof RECUR_CATEGORIES !== "undefined") ? RECUR_CATEGORIES : ["Other"];
  const valid = name.trim() && Number(amount) > 0;
  function save() {
    if (editing) recurUpdate(item.id, { name: name.trim(), category, amount: Number(amount) || 0, cadence, matchText: matchText.trim() });
    else recurAdd({ name, category, amount, cadence, matchText: matchText.trim() });
    onSaved();
  }
  function del() { recurRemove(item.id); onSaved(); }
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 440, padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 22px 12px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editing ? "Edit overhead" : "Add recurring overhead"}</h3><p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "3px 0 0" }}>Salary, software, photography, branding — any fixed periodic cost.</p></div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "block" }}><div className="vy-kicker" style={{ marginBottom: 6 }}>Name</div><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Virtual assistant" style={pnlInput} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "block" }}><div className="vy-kicker" style={{ marginBottom: 6 }}>Category</div><select value={category} onChange={(e) => setCategory(e.target.value)} style={pnlInput}>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label style={{ display: "block" }}><div className="vy-kicker" style={{ marginBottom: 6 }}>Cadence</div><select value={cadence} onChange={(e) => setCadence(e.target.value)} style={pnlInput}><option value="daily">Daily</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
          </div>
          <label style={{ display: "block" }}><div className="vy-kicker" style={{ marginBottom: 6 }}>Amount (USD, per {cadence === "daily" ? "day" : cadence === "yearly" ? "year" : "month"})</div><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ ...pnlInput, ...pnlMono }} /></label>
          {Number(amount) > 0 ? <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>≈ <strong style={{ color: "hsl(var(--foreground))", ...pnlMono }}>{pnlFmt(recurMonthly({ amount, cadence }))}/mo</strong> deducted from each month's profit.</div> : null}
          <label style={{ display: "block" }}><div className="vy-kicker" style={{ marginBottom: 6 }}>Matches bank text (optional)</div><input type="text" value={matchText} onChange={(e) => setMatchText(e.target.value)} placeholder="e.g. helium, payroll — word in the transaction memo" style={pnlInput} /><div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 4 }}>When a bank expense memo contains this, the P&L uses the <strong>actual</strong> amount and stops adding the forecast — no double-count.</div></label>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 22px 16px", borderTop: "1px solid hsl(var(--border))" }}>
          {editing ? <button type="button" className="vy-btn vy-btn--ghost" style={{ color: "hsl(0 72% 51%)" }} onClick={del}>Delete</button> : <span />}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={save}><VyIcon name="check" size={14} /><span>{editing ? "Save" : "Add"}</span></button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

Object.assign(window, { FinPnl, pnlBuild });
