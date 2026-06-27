// finances-tax.jsx — the Tax view for Finance: pass-through set-aside with an
// editable reserve rate, plus a per-partner allocation table (each owner's
// taxable share of profit + suggested set-aside, by ownership %).
// Self-contained: local style tokens (ft*) + helper. Reads finFmt
// (finances-data) and VyIcon (vy-shell). Load AFTER finances-data.jsx and
// BEFORE finances-app.jsx.

const ftMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const ftTh = { textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" };
const ftTd = { padding: "11px 12px", color: "hsl(var(--foreground))", fontSize: 12.5, whiteSpace: "nowrap" };
const ftInput = { height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", width: "100%", boxSizing: "border-box" };
const ftLabel = { fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-fg))", marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" };
function ftInitials(name) {
  return (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function FinTaxPanel({ D, onSetPct }) {
  const pct = D.taxReservePct || 0;
  const net = Math.max(0, D.cumNet);
  const reserve = D.taxReserve;
  const presets = [0.15, 0.20, 0.25, 0.30];
  const rows = D.partners.map((p) => ({
    id: p.id, name: p.name, initials: p.initials, share: p.share,
    taxable: net * p.share,
    setAside: net * p.share * pct,
  }));
  const stat = (label, value, tone) => (
    <div style={{ flex: "1 1 130px", padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "hsl(var(--muted-fg))" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, ...ftMono, color: tone === "warning" ? "hsl(38 92% 45%)" : tone === "info" ? "hsl(var(--info, 217 91% 55%))" : "hsl(var(--foreground))" }}>{value}</div>
    </div>
  );
  return (
    <>
      <section className="vy-card" style={{ padding: "16px 18px" }}>
        <div className="vy-kicker">Tax set-aside</div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2, marginBottom: 14, maxWidth: 640, lineHeight: 1.5 }}>
          You run a pass-through — the business pays no income tax itself, but each partner owes tax on their share of the profit. Hold this much back so a tax bill is never a surprise. Draws don't change it — you're taxed on profit, not on what you took out.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {stat("Taxable profit (net)", finFmt(D.cumNet))}
          {stat("Set aside total", finFmt(reserve), "warning")}
          {stat("Per quarter (≈)", finFmt(reserve / 4), "info")}
        </div>
        <div>
          <label style={ftLabel}>Reserve rate — % of profit to hold for taxes</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {presets.map((v) => {
              const on = Math.abs(pct - v) < 0.001;
              return (
                <button key={v} type="button" onClick={() => onSetPct(v)}
                  style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? "hsl(var(--primary))" : "hsl(var(--border))"), background: on ? "hsl(var(--primary))" : "hsl(var(--background))", color: on ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" }}>
                  {Math.round(v * 100)}%
                </button>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
              <input type="number" min="0" max="60" className="vy-input" style={{ ...ftInput, width: 90 }} value={Math.round(pct * 100)} onChange={(e) => onSetPct((Number(e.target.value) || 0) / 100)} />
              <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>% custom</span>
            </div>
          </div>
        </div>
      </section>

      <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div className="vy-kicker">Each partner's tax</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>Profit is allocated by ownership — so is the tax each of you should set aside.</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                <th style={ftTh}>Partner</th>
                <th style={{ ...ftTh, textAlign: "right" }}>Ownership</th>
                <th style={{ ...ftTh, textAlign: "right" }}>Taxable share of profit</th>
                <th style={{ ...ftTh, textAlign: "right" }}>Set aside ({Math.round(pct * 100)}%)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                  <td style={ftTd}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 7, background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 11, flex: "none" }}>{p.initials || ftInitials(p.name)}</span>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ ...ftTd, ...ftMono, textAlign: "right" }}>{Math.round(p.share * 100)}%</td>
                  <td style={{ ...ftTd, ...ftMono, textAlign: "right" }}>{finFmt(p.taxable)}</td>
                  <td style={{ ...ftTd, ...ftMono, textAlign: "right", fontWeight: 800, color: "hsl(38 92% 45%)" }}>{finFmt(p.setAside)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "11px 18px", fontSize: 11, color: "hsl(var(--muted-fg))", borderTop: "1px solid hsl(var(--border))", lineHeight: 1.5 }}>
          Advisory only — a flat reserve on net profit, not a filed return. Your real rate depends on each partner's total income, state, and deductions. Confirm with your accountant.
        </div>
      </section>
    </>
  );
}

Object.assign(window, { FinTaxPanel });
