// Vyonix Inventory — live FBA stock across all SKUs. Route: /catalog/inventory
// The concrete Catalog↔Amazon connection: each row is a catalog SKU joined to
// its live Amazon inventory (on-hand/reserved/inbound/velocity), plus a manual
// reorder point you set. Calm header → KPIs → sync strip → filter → table → FC.

const { useState: useInvState, useEffect: useInvEffect } = React;

// Source-of-truth marker (Amazon synced vs Manual entered). Quiet.
function InvSourceTag({ source }) {
  const amazon = source === "amazon";
  return (
    <span
      title={amazon ? "Synced from Amazon Seller Central" : "Entered manually"}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, flexShrink: 0, background: amazon ? "hsl(var(--info))" : "transparent", boxShadow: amazon ? "none" : "inset 0 0 0 1.5px hsl(var(--muted-fg) / 0.5)" }} />
      {amazon ? "Amazon" : "Manual"}
    </span>
  );
}

const invTh = { textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" };
const invTd = { padding: "11px 12px", color: "hsl(var(--foreground))", fontSize: 12.5, whiteSpace: "nowrap" };
const invMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const invInput = { height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };
const invCellInput = { height: 30, width: 64, textAlign: "right", padding: "0 8px", fontSize: 12.5, border: "1px solid hsl(var(--input))", borderRadius: 7, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

function ThAmazon({ children, align }) {
  return <th style={{ ...invTh, textAlign: align || "left" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: align === "right" ? "flex-end" : "flex-start" }}>{children}</span></th>;
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
function InventoryPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useInvState(false);
  const [mobileNavOpen, setMobileNavOpen] = useInvState(false);
  const [isDark, setIsDark] = useInvState(false);
  const [rows, setRows] = useInvState(INV_ROWS.map((r) => ({ ...r })));
  const [query, setQuery] = useInvState(() => { try { return new URLSearchParams(location.search).get("q") || ""; } catch (e) { return ""; } });
  const [category, setCategory] = useInvState("All");
  const [supplier, setSupplier] = useInvState("All");
  const [viewMode, setViewMode] = useInvState("family"); // family | sku
  const [expanded, setExpanded] = useInvState({});
  const [health, setHealth] = useInvState("All");
  const [fcFilter, setFcFilter] = useInvState("All");
  const [editing, setEditing] = useInvState(false);
  const [favTick, setFavTick] = useInvState(0);
  function toggleFav(id) { if (typeof catToggleFav === "function") catToggleFav(id); setFavTick((t) => t + 1); }

  useInvEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  function setRow(sku, key, val) {
    setRows((prev) => prev.map((r) => (r.sku === sku ? { ...r, [key]: val } : r)));
  }

  const categories = ["All", ...[...new Set(INV_ROWS.map((r) => r.category))]];
  const suppliers = ["All", ...[...new Set(INV_ROWS.map((r) => r.supplier))]];
  const healthChips = ["All", "Reorder", "Low", "Healthy"];

  const baseFiltered = rows.filter((r) => {
    if (category !== "All" && r.category !== category) return false;
    if (supplier !== "All" && r.supplier !== supplier) return false;
    if (health !== "All" && invStats(r).health !== health) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = [r.parent, r.color, r.sku, r.fnsku, r.asin, r.supplier, r.category].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  // FC filter sits on top — clicking a bar in the FC chart filters the table to
  // that center. The chart itself reads baseFiltered so every FC stays visible.
  const filtered = fcFilter === "All" ? baseFiltered : baseFiltered.filter((r) => r.fc === fcFilter);

  // Group filtered SKUs by family for the "By family" view (rollup header + rows).
  const displayRows = (() => {
    if (viewMode === "sku") return filtered;
    const order = [], map = {};
    filtered.forEach((r) => { if (!map[r.familyId]) { map[r.familyId] = []; order.push(r.familyId); } map[r.familyId].push(r); });
    const out = [];
    order.forEach((fid) => {
      const rs = map[fid];
      const open = expanded[fid] !== false;
      out.push({ __group: true, familyId: fid, family: rs[0].parent, count: rs.length, open,
        stock: rs.reduce((n, x) => n + x.onHand, 0), inbound: rs.reduce((n, x) => n + x.inbound, 0),
        needs: rs.filter((x) => invStats(x).health === "Reorder").length });
      if (open) rs.forEach((r) => out.push(r));
    });
    return out;
  })();

  // KPIs (across ALL rows, not filtered)
  const onHand = rows.reduce((n, r) => n + r.onHand, 0);
  const available = rows.reduce((n, r) => n + invStats(r).available, 0);
  const inbound = rows.reduce((n, r) => n + r.inbound, 0);
  const unfulfillable = rows.reduce((n, r) => n + r.unfulfillable, 0);
  const reorderNow = rows.filter((r) => invStats(r).health === "Reorder").length;

  const kpis = [
    { icon: "boxes", label: "On hand", value: onHand.toLocaleString(), sub: "FBA units", source: "amazon" },
    { icon: "package", label: "Available", value: available.toLocaleString(), sub: "sellable now" },
    { icon: "truck", label: "Inbound", value: inbound.toLocaleString(), sub: "to FBA", source: "amazon" },
    { icon: "alert", label: "Reorder now", value: String(reorderNow), sub: reorderNow === 1 ? "SKU" : "SKUs", tone: reorderNow ? "danger" : undefined },
    { icon: "info", label: "Unfulfillable", value: unfulfillable.toLocaleString(), sub: "stranded units", tone: unfulfillable ? "warning" : undefined, source: "amazon" },
  ];

  // FC distribution (reads baseFiltered, so it ignores the FC filter itself)
  const fcTotals = {};
  const fcCounts = {};
  INV_FCS.forEach((fc) => { fcTotals[fc] = 0; fcCounts[fc] = 0; });
  baseFiltered.forEach((r) => { fcTotals[r.fc] = (fcTotals[r.fc] || 0) + r.onHand; fcCounts[r.fc] = (fcCounts[r.fc] || 0) + 1; });
  const fcMax = Math.max(1, ...Object.values(fcTotals));

  function reorder(r) {
    const s = invStats(r);
    // Suggested order qty: cover lead time + ~45 days of sales, net of what's
    // already available + inbound. Rounded up to the nearest 25, floor 50.
    const target = Math.ceil(r.velocity * (r.leadTimeDays + 45));
    const have = s.available + r.inbound;
    const qty = Math.max(50, Math.ceil(Math.max(0, target - have) / 25) * 25);
    const params = new URLSearchParams({
      reorder: "1",
      sku: r.sku,
      name: r.parent + (r.color ? " · " + r.color : "") + (r.pack ? " · " + r.pack : ""),
      supplier: r.supplier || "",
      qty: String(qty),
      cost: r.lastCostUsd != null ? String(r.lastCostUsd) : "",
    });
    window.location.href = "Vyonix Orders List.html?" + params.toString();
  }

  return (
    <div className="vy-app">
      <VySidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNavigate={() => setMobileNavOpen(false)}
        active="Inventory"
      />

      <div className="vy-app-main">
        <VyHeader
          onToggleMobileNav={() => setMobileNavOpen(true)}
          onOpenSearch={() => {}}
          onToggleTheme={() => setIsDark(!isDark)}
          isDark={isDark}
          onToggleActivity={() => {}}
          workspaceName="Catalog"
          tabs={CATALOG_TABS}
          activeTab="inventory"
        />

        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Page header */}
            <div className="vy-card" style={{ padding: "20px 22px" }}>
              <div className="vy-kicker">Catalog</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 6 }}>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: 0, fontWeight: 600, flex: "1 1 auto", minWidth: 0 }}>Inventory</h1>
                <div className="vy-page-head-actions" style={{ flexShrink: 0 }}>
                  <button type="button" className="vy-btn vy-btn--ghost" onClick={() => {}}>
                    <VyIcon name="arrowUpRight" size={14} /><span>Export</span>
                  </button>
                  <button type="button" className="vy-btn vy-btn--primary" onClick={() => {}}>
                    <VyIcon name="refresh" size={14} /><span>Sync from Amazon</span>
                  </button>
                </div>
              </div>
              <p className="vy-page-sub" style={{ margin: "4px 0 0" }}>
                Live FBA stock per SKU, joined to your catalog. On-hand, reserved and inbound sync from Amazon; reorder points are yours.
              </p>
            </div>

            {/* KPI strip */}
            <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))" }}>
              {kpis.map((k) => (
                <div className={"vy-card vy-kpi" + (k.tone ? " vy-kpi--" + k.tone : "")} key={k.label}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <VyIcon name={k.icon} size={14} style={{ opacity: 0.7 }} />
                    <span className="vy-kicker">{k.label}</span>
                    {k.source ? <InvSourceTag source={k.source} /> : null}
                  </div>
                  <div className="vy-kpi-value" style={{ fontSize: 18 }}>{k.value}</div>
                  <div className="vy-kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Sync status strip — the Amazon heartbeat (reads Settings → Integrations) */}
            {(function () {
              const amzConn = typeof intgAmazonConnected === "function" ? intgAmazonConnected() : true;
              const amz = typeof intgAmazon === "function" ? intgAmazon() : null;
              const last = amz && amz.lastSync && typeof intgAgo === "function" ? intgAgo(amz.lastSync) : INV_LAST_SYNC;
              if (amzConn) {
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", borderRadius: 10, background: "hsl(var(--info) / 0.06)", border: "1px solid hsl(var(--info) / 0.22)" }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--info) / 0.14)", color: "hsl(var(--info))", flexShrink: 0 }}>
                      <VyIcon name="refresh" size={14} />
                    </span>
                    <div style={{ flex: 1, minWidth: 220, fontSize: 12.5 }}>
                      <strong style={{ fontWeight: 600 }}>Synced from Seller Central</strong>
                      <span style={{ color: "hsl(var(--muted-fg))" }}>&nbsp;&nbsp;On-hand, reserved, inbound &amp; velocity · last sync {last}</span>
                    </div>
                    <span className="vy-badge vy-badge--info" style={{ flexShrink: 0 }}>FBA Inventory API</span>
                  </div>
                );
              }
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", borderRadius: 10, background: "hsl(var(--warning) / 0.08)", border: "1px solid hsl(var(--warning) / 0.28)" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--warning) / 0.16)", color: "hsl(var(--warning))", flexShrink: 0 }}>
                    <VyIcon name="alert" size={14} />
                  </span>
                  <div style={{ flex: 1, minWidth: 220, fontSize: 12.5 }}>
                    <strong style={{ fontWeight: 600 }}>Amazon not connected</strong>
                    <span style={{ color: "hsl(var(--muted-fg))" }}>&nbsp;&nbsp;Stock numbers below may be stale — reconnect to resume FBA sync.</span>
                  </div>
                  <a href="Vyonix Settings.html?section=integrations" className="vy-btn vy-btn--outline vy-btn--sm" style={{ flexShrink: 0 }}>
                    <VyIcon name="link" size={12} /><span>Reconnect</span>
                  </a>
                </div>
              );
            })()}

            {/* Filter bar */}
            <div className="vy-card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ position: "relative", flex: "1 1 300px", minWidth: 0 }}>
                  <VyIcon name="search" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-fg))" }} />
                  <input type="text" className="vy-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search SKU, FNSKU, ASIN, product, supplier" style={{ ...invInput, width: "100%", paddingLeft: 34 }} />
                </div>
                <select className="vy-input" style={{ ...invInput, width: 150 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select className="vy-input" style={{ ...invInput, width: 170 }} value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                  {suppliers.map((s) => <option key={s}>{s}</option>)}
                </select>
                <div style={{ display: "inline-flex", border: "1px solid hsl(var(--border))", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                  {[["family", "By family"], ["sku", "All SKUs"]].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setViewMode(k)} style={{ padding: "0 12px", height: 38, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: viewMode === k ? "hsl(var(--primary))" : "transparent", color: viewMode === k ? "hsl(var(--primary-fg))" : "hsl(var(--foreground))" }}>{l}</button>
                  ))}
                </div>
                <button type="button" className={"vy-btn vy-btn--sm " + (editing ? "vy-btn--primary" : "vy-btn--outline")} style={{ fontSize: 12 }} onClick={() => setEditing(!editing)}>
                  <VyIcon name={editing ? "check" : "pencil"} size={13} /><span>{editing ? "Done" : "Edit reorder pts"}</span>
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {healthChips.map((c) => {
                  const isActive = health === c;
                  return (
                    <button key={c} type="button" className="vy-chip" onClick={() => setHealth(c)}
                      style={isActive ? { background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary) / 0.3)" } : {}}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inventory table */}
            <div className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="vy-kicker">{filtered.length} {filtered.length === 1 ? "SKU" : "SKUs"}</span>
                  {fcFilter !== "All" ? (
                    <button type="button" onClick={() => setFcFilter("All")} className="vy-chip" style={{ background: "hsl(var(--info) / 0.12)", color: "hsl(var(--info))", borderColor: "hsl(var(--info) / 0.3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                      FC: {fcFilter} <VyIcon name="x" size={11} />
                    </button>
                  ) : null}
                </div>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Available = on-hand − reserved − unfulfillable</span>
              </div>
              <div style={{ overflowX: "auto", borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
                  <thead>
                    <tr style={{ background: "hsl(var(--muted-bg) / 0.5)" }}>
                      <th style={invTh}>Product / SKU</th>
                      <ThAmazon>FNSKU <InvSourceTag source="amazon" /></ThAmazon>
                      <ThAmazon align="right">On hand <InvSourceTag source="amazon" /></ThAmazon>
                      <th style={{ ...invTh, textAlign: "right" }}>Reserved</th>
                      <th style={{ ...invTh, textAlign: "right" }}>Avail</th>
                      <th style={{ ...invTh, textAlign: "right" }}>Inbound</th>
                      <th style={{ ...invTh, textAlign: "right" }}>Days cover</th>
                      <ThAmazon align="right">Reorder pt <InvSourceTag source="manual" /></ThAmazon>
                      <th style={invTh}>Status</th>
                      <th style={invTh}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((r) => {
                      if (r.__group) { const g = r; return (
                        <tr key={"g-" + g.familyId} onClick={() => setExpanded((p) => ({ ...p, [g.familyId]: g.open ? false : true }))} style={{ borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--muted-bg) / 0.4)", cursor: "pointer" }}>
                          <td colSpan={10} style={{ ...invTd, padding: "9px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <VyIcon name={g.open ? "chevronDown" : "chevronRight"} size={13} style={{ color: "hsl(var(--muted-fg))" }} />
                              <strong style={{ fontSize: 12.5 }}>{g.family}</strong>
                              <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{g.count} SKUs</span>
                              <div style={{ flex: 1 }} />
                              <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>On hand <strong style={{ color: "hsl(var(--foreground))" }}>{g.stock}</strong></span>
                              <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Inbound <strong style={{ color: "hsl(var(--foreground))" }}>{g.inbound}</strong></span>
                              {g.needs ? <span className="vy-badge vy-badge--danger">{g.needs} reorder</span> : <span className="vy-badge vy-badge--success">Healthy</span>}
                            </div>
                          </td>
                        </tr>
                      ); }
                      const s = invStats(r);
                      const cover = s.daysCover === Infinity ? "∞" : Math.round(s.daysCover) + "d";
                      const coverTone = s.daysCover < INV_SAFETY_DAYS ? "hsl(var(--warning))" : undefined;
                      return (
                        <tr key={r.sku} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                          <td style={invTd}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button type="button" onClick={() => toggleFav(r.familyId)} aria-label={catIsFav(r.familyId) ? "Unfavorite" : "Favorite"} title={catIsFav(r.familyId) ? "Remove from favorites" : "Add to favorites"} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, color: catIsFav(r.familyId) ? "hsl(45 90% 48%)" : "hsl(var(--muted-fg) / 0.45)", display: "grid", placeItems: "center" }}>
                                <VyIcon name="star" size={15} style={{ fill: catIsFav(r.familyId) ? "currentColor" : "none" }} />
                              </button>
                              <image-slot id={"pvar-" + r.sku} style={{ width: "30px", height: "30px", flexShrink: 0 }} shape="rounded" radius="7" placeholder={r.sku}></image-slot>
                              <a href={"Vyonix Variant.html?sku=" + encodeURIComponent(r.sku)} style={{ textDecoration: "none", color: "inherit" }}>
                                <div style={{ ...invMono, fontWeight: 700, fontSize: 12 }}>{r.sku}</div>
                                <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{r.parent}{r.color ? " · " + r.color : ""} · {r.fc}</div>
                              </a>
                            </div>
                          </td>
                          <td style={{ ...invTd, ...invMono, color: "hsl(var(--muted-fg))" }}>{r.fnsku}</td>
                          <td style={{ ...invTd, ...invMono, textAlign: "right", fontWeight: 700 }}>{r.onHand}</td>
                          <td style={{ ...invTd, ...invMono, textAlign: "right", color: "hsl(var(--muted-fg))" }}>{r.reserved}</td>
                          <td style={{ ...invTd, ...invMono, textAlign: "right", fontWeight: 700 }}>{s.available}</td>
                          <td style={{ ...invTd, ...invMono, textAlign: "right", color: r.inbound ? "hsl(var(--info))" : "hsl(var(--muted-fg))" }}>{r.inbound || "—"}</td>
                          <td style={{ ...invTd, ...invMono, textAlign: "right", color: coverTone }}>{cover}</td>
                          <td style={{ ...invTd, textAlign: "right" }}>
                            {editing ? (
                              <input type="number" value={r.reorderPoint} onChange={(e) => setRow(r.sku, "reorderPoint", e.target.value === "" ? "" : Number(e.target.value))} style={invCellInput} />
                            ) : (
                              <span style={{ ...invMono, color: "hsl(var(--muted-fg))" }}>{r.reorderPoint}</span>
                            )}
                          </td>
                          <td style={invTd}><span className={"vy-badge vy-badge--" + INV_HEALTH_TONE[s.health]}>{s.health}</span></td>
                          <td style={invTd}>
                            {s.health !== "Healthy" ? (
                              <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11 }} onClick={() => reorder(r)}>
                                <VyIcon name="plus" size={11} /><span>Reorder</span>
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 ? (
                      <tr><td colSpan={10} style={{ ...invTd, textAlign: "center", padding: "36px 12px", color: "hsl(var(--muted-fg))" }}>No SKUs match your filters.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FC distribution */}
            <section className="vy-card" style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--info) / 0.12)", color: "hsl(var(--info))", flexShrink: 0 }}>
                  <VyIcon name="truck" size={15} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>By fulfillment center <InvSourceTag source="amazon" /></h3>
                  <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>Click a center to filter the table to its SKUs · on-hand units across Amazon FCs</p>
                </div>
                {fcFilter !== "All" ? (
                  <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ flexShrink: 0, fontSize: 12 }} onClick={() => setFcFilter("All")}>
                    <VyIcon name="x" size={12} /><span>Clear filter</span>
                  </button>
                ) : null}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {INV_FCS.map((fc) => {
                  const val = fcTotals[fc] || 0;
                  const pct = Math.round((val / fcMax) * 100);
                  const active = fcFilter === fc;
                  const dim = fcFilter !== "All" && !active;
                  return (
                    <button
                      key={fc} type="button"
                      onClick={() => setFcFilter(active ? "All" : fc)}
                      title={active ? "Showing only " + fc + " — click to clear" : "Filter the table to " + fc}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: active ? "hsl(var(--info) / 0.08)" : "transparent", border: "1px solid " + (active ? "hsl(var(--info) / 0.3)" : "transparent"), borderRadius: 8, padding: "6px 8px", cursor: "pointer", opacity: dim ? 0.45 : 1, transition: "opacity 120ms ease, background 120ms ease", textAlign: "left", font: "inherit", color: "inherit" }}
                    >
                      <span style={{ width: 52, fontSize: 12, fontWeight: 600, ...invMono, flexShrink: 0, color: active ? "hsl(var(--info))" : undefined }}>{fc}</span>
                      <div style={{ flex: 1, height: 10, borderRadius: 999, background: "hsl(var(--muted-bg))", overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: pct + "%", background: "hsl(var(--info))", borderRadius: 999 }} />
                      </div>
                      <span style={{ width: 48, textAlign: "right", fontSize: 10.5, color: "hsl(var(--muted-fg))", flexShrink: 0 }}>{fcCounts[fc] || 0} SKU</span>
                      <span style={{ width: 56, textAlign: "right", fontSize: 12.5, fontWeight: 700, ...invMono, flexShrink: 0 }}>{val.toLocaleString()}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      </div>

      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Inventory" />
    </div>
  );
}

const invRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
invRoot.render(<InventoryPage />);
