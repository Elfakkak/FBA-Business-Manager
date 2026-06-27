// Vyonix Charge types — the SERVICES source-of-truth. Products live in the
// Catalog; service charges (freight, agent fees, inspection, duty…) live here.
// A controlled vocabulary every invoice picks from, so spend rolls up by type
// instead of drowning in free-text. Route: /catalog/charge-types.

const { useState: useChgState, useEffect: useChgEffect } = React;

const chgTh = { textAlign: "left", padding: "11px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" };
const chgTd = { padding: "13px 16px", color: "hsl(var(--foreground))", fontSize: 12.5, whiteSpace: "nowrap" };
const chgMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const chgInput = { width: "100%", height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

// Who bills the charge — drives grouping + the colored owner pill.
const CHG_OWNERS = ["Supplier", "Agent", "Forwarder", "Inspection", "Broker", "—"];
const CHG_OWNER_TONE = { Supplier: "primary", Agent: "info", Forwarder: "warning", Inspection: "success", Broker: "danger", "—": "muted" };
const CHG_OWNER_ICON = { Supplier: "factory", Agent: "user", Forwarder: "ship", Inspection: "clipboard", Broker: "shield", "—": "receipt" };

function chgFmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
function ChargeTypesPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useChgState(false);
  const [mobileNavOpen, setMobileNavOpen] = useChgState(false);
  const [isDark, setIsDark] = useChgState(false);
  const [bump, setBump] = useChgState(0);
  const [modal, setModal] = useChgState(null); // { mode:'add'|'edit', type }
  const [showArchived, setShowArchived] = useChgState(false);
  const [toast, setToast] = useChgState(null);

  useChgEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);
  useChgEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  const types = chgLoadTypes();
  const spendList = chgSpendByType();
  const spendMap = {};
  spendList.forEach((s) => { spendMap[s.id] = s; });

  const active = types.filter((t) => !t.archived);
  const archived = types.filter((t) => t.archived);
  const owners = [...new Set(active.map((t) => t.owner))];
  const trackedSpend = spendList.reduce((n, s) => n + (s.archived ? 0 : s.total), 0);
  const otherSpend = (spendMap["other"] ? spendMap["other"].total : 0);

  const kpis = [
    { icon: "receipt", label: "Service charges", value: String(active.length), sub: "in the vocabulary" },
    { icon: "factory", label: "Billed by", value: String(owners.length), sub: "vendor roles" },
    { icon: "dollar", label: "Tracked spend", value: chgFmt(trackedSpend), sub: "across all invoices" },
    { icon: "alert", label: "Uncategorized", value: chgFmt(otherSpend), sub: "“Other charge”", tone: otherSpend > 0 ? "warning" : "success" },
  ];

  function refresh(msg) { setBump((n) => n + 1); if (msg) setToast(msg); }
  function saveType(fields, id) {
    if (id) { chgUpdateType(id, fields); refresh("Charge type updated."); }
    else { chgAddType(fields); refresh("Charge type added."); }
    setModal(null);
  }
  function toggleArchive(t) {
    chgArchiveType(t.id, !t.archived);
    refresh(t.archived ? t.label + " restored." : t.label + " archived.");
  }

  // group active by owner, in CHG_OWNERS order
  const grouped = CHG_OWNERS.map((o) => ({ owner: o, items: active.filter((t) => t.owner === o) })).filter((g) => g.items.length);

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Service charges" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => { if (window.vyOpenSearch) window.vyOpenSearch(); }} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} workspaceName="Catalog" tabs={CATALOG_TABS} activeTab="charges" />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Page header */}
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Catalog</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>Service charges</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0", maxWidth: "64ch" }}>
                  The source of truth for service charges — the same idea as the product catalog, but for the fees you pay. Invoices pick a type instead of free-typing, so spend rolls up by category.
                </p>
              </div>
              <div className="vy-page-head-actions" style={{ marginLeft: "auto" }}>
                <button type="button" className="vy-btn vy-btn--primary" onClick={() => setModal({ mode: "add", type: { label: "", owner: "Supplier", desc: "" } })}>
                  <VyIcon name="plus" size={14} /><span>New charge type</span>
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

            {/* Library, grouped by who bills it */}
            <div className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", flexWrap: "wrap", gap: 8 }}>
                <span className="vy-kicker">{active.length} active {active.length === 1 ? "type" : "types"} · grouped by who bills it</span>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Spend = every service line tagged to this type, across all orders</span>
              </div>

              <div style={{ overflowX: "auto", borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: "hsl(var(--muted-bg) / 0.5)" }}>
                      <th style={chgTh}>Charge type</th>
                      <th style={chgTh}>Billed by</th>
                      <th style={{ ...chgTh, textAlign: "right" }}>Spend to date</th>
                      <th style={{ ...chgTh, textAlign: "right" }}>Used on</th>
                      <th style={{ ...chgTh, textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map((g) => (
                      <React.Fragment key={g.owner}>
                        <tr>
                          <td colSpan={5} style={{ padding: "10px 16px 6px", borderTop: "1px solid hsl(var(--border) / 0.7)", background: "hsl(var(--muted-bg) / 0.25)" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "hsl(var(--" + (CHG_OWNER_TONE[g.owner] === "muted" ? "muted-fg" : CHG_OWNER_TONE[g.owner]) + "))" }}>
                              <VyIcon name={CHG_OWNER_ICON[g.owner]} size={13} />
                              {g.owner === "—" ? "Unassigned" : g.owner}
                            </span>
                          </td>
                        </tr>
                        {g.items.map((t) => {
                          const sp = spendMap[t.id] || { total: 0, orderCount: 0, count: 0 };
                          return (
                            <tr key={t.id} className="vy-order-row" style={{ borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                              <td style={chgTd}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--" + (CHG_OWNER_TONE[t.owner] === "muted" ? "muted-fg" : CHG_OWNER_TONE[t.owner]) + ") / 0.12)", color: "hsl(var(--" + (CHG_OWNER_TONE[t.owner] === "muted" ? "muted-fg" : CHG_OWNER_TONE[t.owner]) + "))" }}>
                                    <VyIcon name={CHG_OWNER_ICON[t.owner]} size={15} />
                                  </span>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                      <span style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</span>
                                      {t.custom ? <span className="vy-badge vy-badge--muted" style={{ fontSize: 9.5 }}>Custom</span> : null}
                                    </div>
                                    {t.desc ? <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", whiteSpace: "normal", maxWidth: "44ch" }}>{t.desc}</div>
                                      : <div style={{ ...chgMono, fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{t.id}</div>}
                                  </div>
                                </div>
                              </td>
                              <td style={chgTd}>
                                <span className={"vy-badge vy-badge--" + CHG_OWNER_TONE[t.owner]}>{t.owner === "—" ? "Unassigned" : t.owner}</span>
                              </td>
                              <td style={{ ...chgTd, ...chgMono, textAlign: "right", fontWeight: 700, color: sp.total > 0 ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{sp.total > 0 ? chgFmt(sp.total) : "—"}</td>
                              <td style={{ ...chgTd, textAlign: "right", color: "hsl(var(--muted-fg))" }}>
                                {sp.count > 0 ? <span>{sp.count} {sp.count === 1 ? "line" : "lines"}{sp.orderCount ? " · " + sp.orderCount + " " + (sp.orderCount === 1 ? "order" : "orders") : ""}</span> : <span style={{ opacity: 0.6 }}>unused</span>}
                              </td>
                              <td style={{ ...chgTd, textAlign: "right" }}>
                                <div style={{ display: "inline-flex", gap: 4 }}>
                                  <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={() => setModal({ mode: "edit", type: t })} aria-label="Edit" title="Edit"><VyIcon name="pencil" size={13} /></button>
                                  <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={() => toggleArchive(t)} title="Archive (hides from invoice dropdowns)">Archive</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                    {active.length === 0 ? (
                      <tr><td colSpan={5} style={{ ...chgTd, textAlign: "center", padding: "36px 16px", color: "hsl(var(--muted-fg))" }}>No charge types yet — add one to start.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {archived.length ? (
                <div style={{ borderTop: "1px solid hsl(var(--border) / 0.7)", padding: "10px 16px" }}>
                  <button type="button" onClick={() => setShowArchived((v) => !v)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "hsl(var(--muted-fg))", padding: 0 }}>
                    <VyIcon name={showArchived ? "chevronDown" : "chevronRight"} size={13} />
                    {archived.length} archived {archived.length === 1 ? "type" : "types"}
                  </button>
                  {showArchived ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                      {archived.map((t) => {
                        const sp = spendMap[t.id] || { total: 0 };
                        return (
                          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", border: "1px dashed hsl(var(--border))", borderRadius: 9 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: "hsl(var(--muted-fg))" }}>{t.label}</span>
                            <span className="vy-badge vy-badge--muted">{t.owner === "—" ? "Unassigned" : t.owner}</span>
                            {sp.total > 0 ? <span style={{ ...chgMono, fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{chgFmt(sp.total)} historic</span> : null}
                            <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ marginLeft: "auto" }} onClick={() => toggleArchive(t)}>Restore</button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 4px 8px", lineHeight: 1.5 }}>
              Archiving a type keeps its history but removes it from the picker on the <a href="Vyonix Invoices.html" style={{ color: "hsl(var(--primary))", fontWeight: 600 }}>invoice Edit-charges</a> form. Spend figures read every service line across the portfolio.
            </p>
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Service charges" />

      {modal ? <ChgEditModal mode={modal.mode} type={modal.type} onClose={() => setModal(null)} onSave={saveType} /> : null}

      {toast ? (
        <div role="status" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 12, zIndex: 200, padding: "12px 16px", borderRadius: 12, background: "hsl(var(--foreground))", color: "hsl(var(--background))", boxShadow: "0 12px 32px -8px hsl(0 0% 0% / 0.35)" }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", background: "hsl(var(--primary))", color: "#fff" }}><VyIcon name="check" size={14} /></span>
          <div style={{ fontSize: 13 }}>{toast}</div>
        </div>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// ADD / EDIT MODAL
// ----------------------------------------------------------------------
function ChgEditModal({ mode, type, onClose, onSave }) {
  const [label, setLabel] = useChgState(type.label || "");
  const [owner, setOwner] = useChgState(type.owner || "Supplier");
  const [desc, setDesc] = useChgState(type.desc || "");
  useChgEffect(() => {
    function k(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const valid = label.trim().length > 0;
  function save() { if (!valid) return; onSave({ label: label.trim(), owner, desc: desc.trim() }, mode === "edit" ? type.id : null); }

  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 460, padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{mode === "edit" ? "Edit charge type" : "New charge type"}</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>{mode === "edit" ? "Rename it or reassign who bills it." : "Add a reusable service charge to the vocabulary."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Name</span>
            <input className="vy-input" style={chgInput} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. International freight" autoFocus />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Billed by</span>
            <select className="vy-input" style={chgInput} value={owner} onChange={(e) => setOwner(e.target.value)}>
              {CHG_OWNERS.map((o) => <option key={o} value={o}>{o === "—" ? "Unassigned" : o}</option>)}
            </select>
            <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Which vendor role normally issues this charge.</span>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Note <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></span>
            <input className="vy-input" style={chgInput} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="When this applies…" />
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={save}>
            <VyIcon name="check" size={14} /><span>{mode === "edit" ? "Save" : "Add type"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const chgRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
chgRoot.render(<ChargeTypesPage />);
