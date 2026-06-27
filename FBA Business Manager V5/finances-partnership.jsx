// finances-partnership.jsx — the YOU + partner equity views for Finance:
// settle-up banner, per-partner capital accounts, and the draw planner.
// Self-contained: local style tokens (fp*) + helper so it can be edited in
// isolation. Reads finFmt / finFmtSigned (finances-data) and VyIcon (vy-shell).
// Load AFTER finances-data.jsx and BEFORE finances-app.jsx.

const fpMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
function fpInitials(name) {
  return (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ======================================================================
// SETTLE-UP BANNER — the direct answer to "who took more?"
// ======================================================================
function FinSettleBanner({ D }) {
  if (!D.settle) {
    return (
      <div className="vy-card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, borderLeft: "3px solid hsl(var(--success, 142 71% 45%))" }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: "hsl(var(--success, 142 71% 45%) / 0.12)", color: "hsl(var(--success, 142 71% 45%))", display: "grid", placeItems: "center", flex: "none" }}>
          <VyIcon name="check" size={16} />
        </span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Draws are balanced</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 1 }}>Both partners have taken their share of distributions so far. Nothing to settle.</div>
        </div>
      </div>
    );
  }
  const s = D.settle;
  return (
    <div className="vy-card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, borderLeft: "3px solid hsl(var(--primary))", flexWrap: "wrap" }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", display: "grid", placeItems: "center", flex: "none" }}>
        <VyIcon name="alert" size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>
          {s.fromName} has drawn {finFmt(s.amount)} more than their share
        </div>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 1 }}>
          To rebalance to the agreed split, {s.fromName} pays {s.toName} <strong style={{ color: "hsl(var(--foreground))" }}>{finFmt(s.amount)}</strong> — or takes that much less on the next draw.
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, ...fpMono, fontSize: 12.5, fontWeight: 700 }}>
        <span>{s.fromName}</span>
        <VyIcon name="arrowRight" size={14} style={{ color: "hsl(var(--primary))" }} />
        <span>{s.toName}</span>
        <span style={{ marginLeft: 6, padding: "3px 10px", borderRadius: 999, background: "hsl(var(--primary))", color: "hsl(var(--primary-fg))" }}>{finFmt(s.amount)}</span>
      </div>
    </div>
  );
}

// ======================================================================
// CAPITAL ACCOUNTS — per-partner entitled vs drawn vs balance
// ======================================================================
function FinStat({ label, value, tone }) {
  const color = tone === "success" ? "hsl(var(--success, 142 71% 45%))" : tone === "warning" ? "hsl(38 92% 45%)" : tone === "muted" ? "hsl(var(--muted-fg))" : "hsl(var(--foreground))";
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "hsl(var(--muted-fg))", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color, marginTop: 2, ...fpMono }}>{value}</div>
    </div>
  );
}

function FinCapitalAccounts({ D, onEditPartners }) {
  return (
    <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 12px", borderBottom: "1px solid hsl(var(--border))" }}>
        <div>
          <div className="vy-kicker">Capital accounts</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>Each partner's entitled share of net vs what they've actually drawn.</div>
        </div>
        <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={onEditPartners}>
          <VyIcon name="pencil" size={12} /><span>Partners &amp; split</span>
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 0 }}>
        {D.partners.map((p, i) => {
          const canTake = p.balance >= 0;
          return (
            <div key={p.id} style={{ padding: "16px 18px", borderLeft: i > 0 ? "1px solid hsl(var(--border))" : "0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>{p.initials || fpInitials(p.name)}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{Math.round(p.share * 100)}% ownership</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
                <FinStat label="Entitled (share of net)" value={finFmt(p.entitled)} />
                <FinStat label="Drawn to date" value={finFmt(p.drawn)} />
                <FinStat
                  label={canTake ? "Can still take" : "Over-drawn"}
                  value={finFmt(Math.abs(p.balance))}
                  tone={canTake ? "success" : "warning"}
                />
                <FinStat
                  label="Vs fair share"
                  value={finFmtSigned(p.imbalance)}
                  tone={Math.abs(p.imbalance) < 1 ? "muted" : p.imbalance > 0 ? "warning" : "success"}
                />
              </div>
              {/* drawn vs entitled bar */}
              <div style={{ marginTop: 14 }}>
                <div style={{ height: 8, borderRadius: 999, background: "hsl(var(--muted) / 0.5)", overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, width: Math.min(100, p.entitled > 0 ? (p.drawn / p.entitled) * 100 : 0) + "%", background: canTake ? "hsl(var(--primary))" : "hsl(38 92% 50%)", borderRadius: 999 }} />
                </div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 5 }}>
                  Drawn {finFmt(p.drawn)} of {finFmt(p.entitled)} entitled
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ======================================================================
// DRAW PLANNER — what each partner can safely take right now
// ======================================================================
function FinPlanner({ D }) {
  if (!D) return null;
  const reserve = D.taxReserve;
  const distributable = Math.max(0, D.cashOnHand - reserve);
  const rows = D.partners.map((p) => {
    const entitledRemaining = Math.max(0, p.balance);   // entitled − drawn
    const cashShare = p.share * distributable;
    const safe = Math.min(entitledRemaining, cashShare);
    const cappedBy = safe < entitledRemaining - 0.5 ? "cash" : "share";
    return { ...p, safe, entitledRemaining, cappedBy };
  });
  const stat = (label, value, tone) => (
    <div style={{ flex: "1 1 120px", padding: "11px 13px", border: "1px solid hsl(var(--border))", borderRadius: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "hsl(var(--muted-fg))" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 3, ...fpMono, color: tone === "info" ? "hsl(var(--info, 217 91% 55%))" : tone === "warning" ? "hsl(38 92% 45%)" : "hsl(var(--foreground))" }}>{finFmt(value)}</div>
    </div>
  );
  return (
    <section className="vy-card" style={{ padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div className="vy-kicker">Draw planner</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>What each partner can safely take right now, after holding back the tax reserve.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        {stat("Cash on hand", D.cashOnHand)}
        {stat("Set aside for tax", reserve, "warning")}
        {stat("Distributable now", distributable, "info")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {rows.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12, flex: "none" }}>{p.initials || p.name.slice(0, 1)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>
                {p.safe <= 0.5 ? "Already drawn to the limit" : "Capped by " + (p.cappedBy === "cash" ? "available cash" : "their share of net")}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "hsl(var(--muted-fg))", textTransform: "uppercase", letterSpacing: "0.04em" }}>Can safely draw</div>
              <div style={{ fontSize: 16, fontWeight: 800, ...fpMono, color: p.safe > 0.5 ? "hsl(var(--success, 142 71% 45%))" : "hsl(var(--muted-fg))" }}>{finFmt(p.safe)}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 12, lineHeight: 1.5 }}>
        Distributable = cash on hand − tax reserve. Each partner's safe draw is the lesser of their unpaid entitlement and their share of distributable cash — so you never distribute money owed to taxes or the business.
      </div>
    </section>
  );
}

Object.assign(window, { FinSettleBanner, FinStat, FinCapitalAccounts, FinPlanner });
