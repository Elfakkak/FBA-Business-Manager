// activity-app.jsx — full ACTIVITY JOURNAL across every order. The activity
// drawer (vy-overlays.jsx) is the per-order quick glance; this is the complete,
// searchable, filterable log. Route: /activity. Reached from the drawer's
// "See full journal →" and the header activity button.

const { useState: useActState, useEffect: useActEffect } = React;

const actMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };

// Category vocabulary — drives the filter chips + each row's colored icon.
const ACT_CATS = [
  { key: "All",  label: "All" },
  { key: "Pay",  label: "Payments" },
  { key: "Inv",  label: "Invoices" },
  { key: "Insp", label: "Inspection" },
  { key: "Ship", label: "Shipping" },
  { key: "Prod", label: "Production" },
  { key: "Doc",  label: "Docs" },
];
const ACT_CAT_TONE = { Pay: "success", Inv: "info", Insp: "warning", Ship: "info", Prod: "primary", Doc: "muted" };
const ACT_CAT_ICON = { Pay: "dollar", Inv: "receipt", Insp: "clipboard", Ship: "ship", Prod: "factory", Doc: "package" };

// Portfolio-wide journal (seeded). Newest first. Each item carries the order it
// belongs to + a deep link to the relevant section.
const ACT_FEED = [
  { day: "Today", items: [
    { cat: "Pay",  title: "PAY-2605-002 scheduled for Jun 5", detail: "Balance payment to Sheng Te Long queued in Mercury", order: "ORD-2026-05-006", href: "Vyonix Order Shell.html?order=ORD-2026-05-006#invoices", actor: "Simo", time: "2h ago", tone: "info" },
    { cat: "Insp", title: "Inspection booked with Lin Chen", detail: "AQL 2.5 · on-site May 28 · Ningbo", order: "ORD-2026-05-006", href: "Vyonix Order Shell.html?order=ORD-2026-05-006#inspection", actor: "Youness", time: "5h ago", tone: "info" },
    { cat: "Ship", title: "Shipment 2 flagged — packing list missing", detail: "FBA inbound can't be created until carton truth is set", order: "ORD-2026-05-006", href: "Vyonix Order Shell.html?order=ORD-2026-05-006#shipping", actor: "System", time: "7h ago", tone: "danger" },
  ]},
  { day: "Yesterday", items: [
    { cat: "Doc",  title: "D14 production photos uploaded", detail: "12 images · WIP line + stitching close-ups", order: "ORD-2026-05-006", href: "Vyonix Order Shell.html?order=ORD-2026-05-006#production", actor: "Lin Chen", time: "1d ago", tone: "success" },
    { cat: "Inv",  title: "PI-2605-MUTU-001 logged at $14,125", detail: "Supplier proforma added · 4 SKUs itemized", order: "ORD-2026-05-006", href: "Vyonix Invoice.html?invoice=PI-2605-MUTU-001", actor: "Simo", time: "1d ago", tone: "info" },
    { cat: "Prod", title: "Readiness gap closed — tech pack v3", detail: "Beaded seat cover spec updated", order: "ORD-2026-05-003", href: "Vyonix Order Shell.html?order=ORD-2026-05-003#production", actor: "Simo", time: "1d ago", tone: "primary" },
  ]},
  { day: "May 24", items: [
    { cat: "Ship", title: "Container booked — Ningbo → LGB", detail: "Sea LCL · ETD Jun 2 · Pacific Star", order: "ORD-2026-05-002", href: "Vyonix Order Shell.html?order=ORD-2026-05-002#shipping", actor: "Mutual Trade Union", time: "3d ago", tone: "info" },
    { cat: "Pay",  title: "PAY-2605-001 cleared · $8,980.15", detail: "30% deposit confirmed by Mercury", order: "ORD-2026-05-006", href: "Vyonix Order Shell.html?order=ORD-2026-05-006#invoices", actor: "System", time: "3d ago", tone: "success" },
  ]},
  { day: "May 22", items: [
    { cat: "Insp", title: "Inspection passed — 0 critical, 2 minor", detail: "Carbon steering covers · report attached", order: "ORD-2026-05-001", href: "Vyonix Order Shell.html?order=ORD-2026-05-001#inspection", actor: "QIMA", time: "5d ago", tone: "success" },
    { cat: "Inv",  title: "Freight invoice FRT-2605 added · $2,022", detail: "Forwarder bill linked to landed cost", order: "ORD-2026-05-002", href: "Vyonix Order Shell.html?order=ORD-2026-05-002#invoices", actor: "Simo", time: "5d ago", tone: "info" },
    { cat: "Prod", title: "Production clock D1 anchored", detail: "30-day window started", order: "ORD-2026-05-006", href: "Vyonix Order Shell.html?order=ORD-2026-05-006#production", actor: "System", time: "5d ago", tone: "info" },
  ]},
  { day: "May 18", items: [
    { cat: "Doc",  title: "Commercial invoice + packing list filed", detail: "Customs docs for ORD-2026-05-001", order: "ORD-2026-05-001", href: "Vyonix Order Shell.html?order=ORD-2026-05-001#shipping", actor: "Youness", time: "9d ago", tone: "success" },
    { cat: "Pay",  title: "Agent fee paid · $640", detail: "Mutual Trade Union service fee", order: "ORD-2026-05-002", href: "Vyonix Order Shell.html?order=ORD-2026-05-002#invoices", actor: "Simo", time: "9d ago", tone: "success" },
  ]},
];

// ----------------------------------------------------------------------
// LIVE EVENT MODEL — Payments + Invoices stream from the payables store
// (payable-data.jsx) so the journal updates when a bill is logged or a
// payment recorded anywhere. The other categories (Inspection/Shipping/
// Production/Docs) have no live store yet, so they stay seeded. Everything is
// normalized to a real timestamp, then merged + sorted + day-grouped.
// ----------------------------------------------------------------------
const ACT_MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function actTodayTs() { return (typeof PAY_TODAY !== "undefined" ? PAY_TODAY : new Date("2026-05-31T00:00:00")).getTime(); }
function actMoney(n) { return "$" + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
// Parse an ISO date ("2026-05-05") or a loose "Mon DD" label into a timestamp.
function actParseTs(s, anchorYear) {
  if (!s) return null;
  let m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = String(s).match(/([A-Za-z]{3,})\s+(\d{1,2})/);
  if (m) {
    const mo = ACT_MONTHS[m[1].slice(0, 3)];
    if (mo == null) return null;
    const y = anchorYear || new Date(actTodayTs()).getFullYear();
    return new Date(y, mo, +m[2]).getTime();
  }
  return null;
}
function actRelTime(ts) {
  const d = Math.round((actTodayTs() - ts) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 7) return d + "d ago";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function actDayLabel(ts) {
  const a = new Date(actTodayTs()); a.setHours(0, 0, 0, 0);
  const b = new Date(ts); b.setHours(0, 0, 0, 0);
  const d = Math.round((a.getTime() - b.getTime()) / 86400000);
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function actDayTsFromLabel(label) {
  const today = actTodayTs();
  if (label === "Today") return today;
  if (label === "Yesterday") return today - 86400000;
  const ts = actParseTs(label, new Date(today).getFullYear());
  return ts != null ? ts : today;
}
// Seeded events for categories with no live store yet (drop Pay/Inv — those are live).
function actSeedEvents() {
  const out = [];
  ACT_FEED.forEach((g) => {
    const dayTs = actDayTsFromLabel(g.day);
    g.items.forEach((it, idx) => {
      if (it.cat === "Pay" || it.cat === "Inv") return;
      out.push({ ...it, ts: dayTs + 12 * 3600000 - idx * 60000 });
    });
  });
  return out;
}
// Resolve a payment's timestamp from its loose "Mon DD" label. A CLEARED payment
// can't be in the future and shouldn't predate its invoice, so we pick the
// candidate year that lands in [issued-3d, today]; SCHEDULED payments may be future.
function actPaymentTs(p, issuedTs) {
  const today = actTodayTs();
  const cleared = p.status === "Cleared";
  const baseYear = issuedTs != null ? new Date(issuedTs).getFullYear() : new Date(today).getFullYear();
  const cands = [baseYear, baseYear - 1, baseYear + 1, baseYear - 2].map((y) => actParseTs(p.date, y)).filter((t) => t != null);
  if (!cands.length) return issuedTs != null ? issuedTs : today;
  if (cleared) {
    const lo = (issuedTs != null ? issuedTs : -Infinity) - 3 * 86400000;
    const ok = cands.filter((t) => t <= today + 86400000 && t >= lo).sort((a, b) => b - a);
    if (ok.length) return ok[0];
    // Label can't be reconciled with the invoice (inconsistent seed) — anchor it
    // just after issuance rather than dumping it on "today".
    return issuedTs != null ? Math.min(today, issuedTs + 86400000) : today;
  }
  const ge = cands.filter((t) => issuedTs == null || t >= issuedTs - 3 * 86400000).sort((a, b) => a - b);
  return ge.length ? ge[0] : cands.sort((a, b) => a - b)[0];
}
// Live Payments + Invoices, derived from PAY_INVOICES + the payments store.
function actLiveEvents() {
  const out = [];
  if (typeof PAY_INVOICES === "undefined") return out;
  PAY_INVOICES.forEach((inv) => {
    const issuedTs = actParseTs(inv.issued);
    // Invoice logged
    if (issuedTs != null) {
      out.push({
        cat: "Inv", ts: issuedTs,
        title: inv.id + " logged" + (inv.total ? " · " + actMoney(inv.total) : ""),
        detail: (inv.vendor || "Vendor") + (inv.vendorType ? " · " + inv.vendorType + " bill" : " bill"),
        order: inv.orderId, href: "Vyonix Invoice.html?invoice=" + encodeURIComponent(inv.id),
        actor: "Simo", tone: "info", key: "inv:" + inv.id,
      });
    }
    // Payments
    const pays = (typeof payInvoicePayments === "function") ? payInvoicePayments(inv) : [];
    pays.forEach((p, idx) => {
      const ts = actPaymentTs(p, issuedTs);
      const cleared = p.status === "Cleared";
      const label = (p.id ? p.id : inv.id);
      out.push({
        cat: "Pay", ts,
        title: label + " " + (cleared ? "cleared" : (p.status || "scheduled").toLowerCase()) + (p.amount ? " · " + actMoney(p.amount) : ""),
        detail: (p.method ? p.method + " · " : "") + "to " + (inv.vendor || "vendor") + (p.proof ? "" : " · proof pending"),
        order: inv.orderId, href: "Vyonix Invoice.html?invoice=" + encodeURIComponent(inv.id),
        actor: cleared ? "System" : "Simo", tone: cleared ? "success" : "info", key: "pay:" + inv.id + ":" + idx,
      });
    });
  });
  return out;
}
// Full flat journal, newest first.
function actBuildEvents() {
  return [...actLiveEvents(), ...actSeedEvents()]
    .map((e) => ({ ...e, time: e.time || actRelTime(e.ts) }))
    .sort((a, b) => b.ts - a.ts);
}
// Initials for the actor avatar.
function actInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ActivityPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useActState(false);
  const [mobileNavOpen, setMobileNavOpen] = useActState(false);
  const [isDark, setIsDark] = useActState(false);
  const [filter, setFilter] = useActState(() => { try { return new URLSearchParams(location.search).get("cat") || "All"; } catch (e) { return "All"; } });
  const [query, setQuery] = useActState("");
  const [orderFilter, setOrderFilter] = useActState(() => { try { return new URLSearchParams(location.search).get("order") || "All"; } catch (e) { return "All"; } });
  useActEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  // Recompute when a payment/bill is logged elsewhere (storage), a status moves,
  // or the tab regains focus — keeps the journal live without a reload.
  const [tick, setTick] = useActState(0);
  useActEffect(() => {
    function bump() { setTick((n) => n + 1); }
    window.addEventListener("storage", bump);
    window.addEventListener("vy-order-status-changed", bump);
    window.addEventListener("focus", bump);
    return () => { window.removeEventListener("storage", bump); window.removeEventListener("vy-order-status-changed", bump); window.removeEventListener("focus", bump); };
  }, []);

  const allEvents = React.useMemo(() => actBuildEvents(), [tick]);
  // Every order that appears in the journal, for the order filter.
  const orderIds = [...new Set(allEvents.map((e) => e.order))].sort();

  const q = query.trim().toLowerCase();
  const shown = allEvents.filter((it) =>
    (filter === "All" || it.cat === filter) &&
    (orderFilter === "All" || it.order === orderFilter) &&
    (!q || [it.title, it.detail, it.order, it.actor].join(" ").toLowerCase().includes(q))
  );
  // Bucket the (already newest-first) events into day groups.
  const groups = [];
  shown.forEach((it) => {
    const day = actDayLabel(it.ts);
    let g = groups[groups.length - 1];
    if (!g || g.day !== day) { g = { day, items: [] }; groups.push(g); }
    g.items.push(it);
  });
  const totalShown = shown.length;
  const counts = {};
  allEvents.forEach((it) => { counts[it.cat] = (counts[it.cat] || 0) + 1; });
  const totalAll = allEvents.length;

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Activity" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => { if (window.vyOpenSearch) window.vyOpenSearch(); }} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Page header */}
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Operations</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>Activity journal</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0", maxWidth: "64ch" }}>
                  Every event across all orders — payments, invoices, inspection, shipping, production and documents — newest first. The per-order drawer shows just that order's slice.
                </p>
              </div>
              <div className="vy-page-head-actions" style={{ marginLeft: "auto" }}>
                <button type="button" className="vy-btn vy-btn--ghost" onClick={() => {}}>
                  <VyIcon name="arrowUpRight" size={14} /><span>Export</span>
                </button>
              </div>
            </div>

            {/* Filter + search bar */}
            <div className="vy-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ACT_CATS.map((c) => {
                  const n = c.key === "All" ? totalAll : (counts[c.key] || 0);
                  const on = filter === c.key;
                  return (
                    <button key={c.key} type="button" onClick={() => setFilter(c.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid " + (on ? "hsl(var(--primary))" : "hsl(var(--border))"), background: on ? "hsl(var(--primary))" : "transparent", color: on ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" }}>
                      {c.label}<span style={{ ...actMono, fontSize: 10.5, opacity: 0.7 }}>{n}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ flex: 1 }} />
              <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} title="Filter by order" style={{ height: 34, padding: "0 10px", fontSize: 12.5, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontWeight: orderFilter === "All" ? 400 : 600, ...(orderFilter !== "All" ? actMono : {}) }}>
                <option value="All">All orders</option>
                {orderIds.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <div className="vy-input-wrap" style={{ flex: "0 1 220px", minWidth: 150 }}>
                <span className="vy-input-affix"><VyIcon name="search" size={13} /></span>
                <input className="vy-input vy-input--prefixed" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search activity…" />
              </div>
            </div>

            {/* Feed — one framed card per day */}
            {groups.length ? groups.map((group) => (
              <div key={group.day} className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", background: "hsl(var(--muted-bg) / 0.45)", borderBottom: "1px solid hsl(var(--border) / 0.7)" }}>
                  <span className="vy-kicker">{group.day}</span>
                  <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{group.items.length} {group.items.length === 1 ? "event" : "events"}</span>
                </div>
                  {group.items.map((it, i) => {
                    const tone = ACT_CAT_TONE[it.cat] || "info";
                    const tv = tone === "muted" ? "muted-fg" : tone;
                    return (
                      <a key={it.key || (group.day + i)} href={it.href} style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "12px 18px", textDecoration: "none", color: "inherit", borderTop: i ? "1px solid hsl(var(--border) / 0.6)" : "none" }} className="vy-order-row">
                        <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", marginTop: 1, background: "hsl(var(--" + tv + ") / 0.12)", color: "hsl(var(--" + tv + "))" }}>
                          <VyIcon name={ACT_CAT_ICON[it.cat] || "info"} size={14} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{it.title}</div>
                          {it.detail ? <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 2, lineHeight: 1.4 }}>{it.detail}</div> : null}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
                            <span className={"vy-badge vy-badge--" + tone} style={{ fontSize: 9.5 }}>{ACT_CATS.find((c) => c.key === it.cat)?.label || it.cat}</span>
                            <span style={{ ...actMono, fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{it.order}</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <span title={it.actor} style={{ width: 16, height: 16, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 8, fontWeight: 700, letterSpacing: "0.02em", background: it.actor === "System" ? "hsl(var(--muted-bg))" : "hsl(var(--primary) / 0.14)", color: it.actor === "System" ? "hsl(var(--muted-fg))" : "hsl(var(--primary))" }}>{it.actor === "System" ? "·" : actInitials(it.actor)}</span>
                              <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{it.actor}</span>
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))", whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}>{it.time}</span>
                      </a>
                    );
                  })}
              </div>
            )) : (
              <div className="vy-card" style={{ padding: "44px 16px", textAlign: "center", color: "hsl(var(--muted-fg))" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No matching activity</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Try a different category, order, or clear the search.</div>
              </div>
            )}

            <p style={{ fontSize: 11, color: "hsl(var(--muted-fg))", margin: "2px 4px 8px" }}>
              Showing {totalShown} of {totalAll} events. Payments &amp; invoices stream live from the payables ledger; inspection, shipping, production &amp; docs are sample history. Each row links to where the event happened.
            </p>
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Activity" />
    </div>
  );
}

const actRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
actRoot.render(<ActivityPage />);
