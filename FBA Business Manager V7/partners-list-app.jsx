// Vyonix Partners — directory of agents, forwarders & inspection agencies.
// Route: /catalog/partners. Row click → partner detail page.

const { useState: useParState, useEffect: useParEffect } = React;

const parTh = { textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" };
const parTd = { padding: "12px 12px", color: "hsl(var(--foreground))", fontSize: 12.5, whiteSpace: "nowrap" };
const parMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const parInput = { height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

function parInitials(name) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// Resolve a partner tone to a REAL css color var (--brand is only a badge class,
// not a usable hsl triplet — map it to --primary). Returns {bg, fg} for avatars.
const PARTNER_TONE_VAR = { info: "info", warning: "warning", brand: "primary", danger: "danger", success: "success" };
function parAvatarColors(type) {
  const v = PARTNER_TONE_VAR[PARTNER_TYPE_TONE[type]];
  if (!v) return { bg: "hsl(var(--muted-bg))", fg: "hsl(var(--muted-fg))" };
  return { bg: "hsl(var(--" + v + ") / 0.14)", fg: "hsl(var(--" + v + "))" };
}
const PARTNER_SUBLABEL = { Agent: "Trading agent", Forwarder: "Freight forwarder", Inspection: "Inspection agency" };

function PartnersPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useParState(false);
  const [mobileNavOpen, setMobileNavOpen] = useParState(false);
  const [isDark, setIsDark] = useParState(false);
  const [query, setQuery] = useParState("");
  const [type, setType] = useParState("All");
  const [creating, setCreating] = useParState(false);
  const [drawer, setDrawer] = useParState(null); // partner name being quick-viewed

  useParEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  const typeChips = ["All", ...PARTNER_TYPES];
  const filtered = PARTNERS.filter((p) => {
    if (type !== "All" && p.type !== type) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (![p.name, p.type, p.origin, p.specialty].join(" ").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPartners = PARTNERS.length;
  const byType = (t) => PARTNERS.filter((p) => p.type === t).length;
  const openAP = PARTNERS.reduce((n, p) => n + p.openBalance, 0);
  const shipmentsHandled = PARTNERS.reduce((n, p) => n + p.shipmentCount, 0);

  const kpis = [
    { icon: "user", label: "Partners", value: String(totalPartners), sub: byType("Agent") + " agents · " + byType("Forwarder") + " forwarders" },
    { icon: "ship", label: "Shipments", value: String(shipmentsHandled), sub: "handled by forwarders" },
    { icon: "clipboard", label: "Inspection", value: String(byType("Inspection")), sub: "QC agencies" },
    { icon: "dollar", label: "Open AP", value: parFmt(openAP), sub: "owed to partners", tone: openAP > 0 ? "warning" : "success" },
  ];

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Trading partners" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => {}} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} workspaceName="Partners" tabs={PARTNERS_TABS} activeTab="partners" />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Page header */}
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Partners</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>Trading partners</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0" }}>
                  The agents, freight forwarders and inspection agencies you work with — who moves and brokers your goods, what they've touched, and what you owe them.
                </p>
              </div>
              <div className="vy-page-head-actions" style={{ marginLeft: "auto" }}>
                <button type="button" className="vy-btn vy-btn--ghost" onClick={() => {}}>
                  <VyIcon name="arrowUpRight" size={14} /><span>Export</span>
                </button>
                <button type="button" className="vy-btn vy-btn--primary" onClick={() => setCreating(true)}>
                  <VyIcon name="plus" size={14} /><span>New partner</span>
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

            {/* Filter bar */}
            <div className="vy-card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ position: "relative", flex: "1 1 300px", minWidth: 0 }}>
                  <VyIcon name="search" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-fg))" }} />
                  <input type="text" className="vy-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search partner, origin, specialty" style={{ ...parInput, width: "100%", paddingLeft: 34 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {typeChips.map((c) => {
                  const active = type === c;
                  return (
                    <button key={c} type="button" className="vy-chip" onClick={() => setType(c)}
                      style={active ? { background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary) / 0.3)" } : {}}>
                      {c}{c !== "All" ? "s" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Partners table */}
            <div className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
                <span className="vy-kicker">{filtered.length} {filtered.length === 1 ? "partner" : "partners"}</span>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Open AP = unpaid service bills (not goods)</span>
              </div>
              <div style={{ overflowX: "auto", borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "34%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "18%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: "hsl(var(--muted-bg) / 0.5)" }}>
                      <th style={parTh}>Partner</th>
                      <th style={parTh}>Type</th>
                      <th style={{ ...parTh, textAlign: "right" }}>Orders</th>
                      <th style={{ ...parTh, textAlign: "right" }}>Shipments</th>
                      <th style={{ ...parTh, textAlign: "right" }}>Open AP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.name} className="vy-order-row" onClick={() => setDrawer(p.name)} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)", cursor: "pointer" }}>
                        <td style={parTd}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: parAvatarColors(p.type).bg, color: parAvatarColors(p.type).fg, fontSize: 11, fontWeight: 700 }}>{parInitials(p.name)}</span>
                            <div>
                              <a href={"Vyonix Partner.html?partner=" + encodeURIComponent(p.name)} className="vy-row-title" onClick={(e) => e.stopPropagation()} title="Open partner page" style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</a>
                              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{p.specialty || p.origin || PARTNER_SUBLABEL[p.type] || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td style={parTd}><span className={"vy-badge vy-badge--" + (PARTNER_TYPE_TONE[p.type] || "muted")}>{p.type}</span></td>
                        <td style={{ ...parTd, ...parMono, textAlign: "right", fontWeight: 600 }}>{p.orderCount || "—"}</td>
                        <td style={{ ...parTd, ...parMono, textAlign: "right", color: p.shipmentCount ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{p.shipmentCount || "—"}</td>
                        <td style={{ ...parTd, ...parMono, textAlign: "right", fontWeight: 700, color: p.openBalance > 0 ? "hsl(var(--warning))" : "hsl(var(--muted-fg))" }}>{p.openBalance > 0 ? parFmt(p.openBalance) : "—"}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 ? (
                      <tr><td colSpan={5} style={{ ...parTd, textAlign: "center", padding: "36px 12px", color: "hsl(var(--muted-fg))" }}>No partners match your filters.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Trading partners" />

      {creating ? <ParNewModal onClose={() => setCreating(false)} /> : null}
      {drawer ? <ParQuickDrawer name={drawer} onClose={() => setDrawer(null)} /> : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// QUICK-VIEW DRAWER — slide-in quick look + inline edit (mirror of Suppliers).
// Full page (Vyonix Partner.html) kept for deep-links.
// ----------------------------------------------------------------------
function ParQuickStat({ label, value, tone }) {
  return (
    <div style={{ flex: "1 1 80px", minWidth: 0 }}>
      <div className="vy-kicker" style={{ marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: tone ? "hsl(var(--" + tone + "))" : undefined }}>{value}</div>
    </div>
  );
}

function ParQuickField({ label, name, value, editing, form, setForm, placeholder, type, full, mono }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <div className="vy-kicker" style={{ marginBottom: 4 }}>{label}</div>
      {editing ? (
        type === "textarea" ? (
          <textarea value={form[name] || ""} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} placeholder={placeholder} style={{ ...parInput, width: "100%", height: 56, padding: "8px 11px", resize: "vertical", fontFamily: "inherit" }} />
        ) : type === "select" ? (
          <select value={form[name] || ""} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} style={{ ...parInput, width: "100%" }}>
            {PARTNER_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        ) : (
          <input type={type || "text"} value={form[name] != null ? form[name] : ""} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} placeholder={placeholder} style={{ ...parInput, width: "100%" }} />
        )
      ) : (
        <div style={{ fontSize: 13, fontWeight: 500, color: value ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))", fontFamily: mono ? "var(--font-mono, monospace)" : undefined }}>{value || "—"}</div>
      )}
    </div>
  );
}

function ParQuickDrawer({ name, onClose }) {
  const [shown, setShown] = useParState(false);
  const [p, setP] = useParState(() => parByName(name));
  const [editing, setEditing] = useParState(false);
  const [toast, setToast] = useParState(false);
  const [form, setForm] = useParState(() => {
    const cur = parByName(name) || {};
    const f = {};
    PARTNER_PROFILE_FIELDS.forEach((k) => { f[k] = cur[k] != null ? cur[k] : ""; });
    return f;
  });

  useParEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    function onKey(e) { if (e.key === "Escape") { if (editing) { setEditing(false); } else { onClose(); } } }
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); };
  }, [onClose, editing]);

  useParEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!p) return null;
  const tone = PARTNER_TYPE_TONE[p.type] || "muted";
  const av = parAvatarColors(p.type);

  function save() {
    const patch = {};
    PARTNER_PROFILE_FIELDS.forEach((k) => { patch[k] = form[k]; });
    parUpsertProfile(name, patch);
    setP(parByName(name));
    setEditing(false);
    setToast(true);
  }
  function cancel() {
    const cur = parByName(name) || {};
    const f = {};
    PARTNER_PROFILE_FIELDS.forEach((k) => { f[k] = cur[k] != null ? cur[k] : ""; });
    setForm(f);
    setEditing(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.4)", opacity: shown ? 1 : 0, transition: "opacity 200ms ease" }} />
      <aside style={{
        position: "absolute", top: 0, right: 0, height: "100%", width: "min(440px, 92vw)",
        background: "hsl(var(--card))", borderLeft: "1px solid hsl(var(--border))",
        boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
        transform: shown ? "translateX(0)" : "translateX(100%)", transition: "transform 240ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: av.bg, color: av.fg, fontSize: 14, fontWeight: 700 }}>{parInitials(p.name)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</span>
                  <span className={"vy-badge vy-badge--" + tone}>{p.type}</span>
                  {p.isNew ? <span className="vy-badge vy-badge--brand" style={{ fontSize: 9, padding: "1px 6px" }}>New</span> : null}
                </div>
                <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{p.specialty || p.origin || PARTNER_SUBLABEL[p.type]}</div>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))", flexShrink: 0 }}>
              <VyIcon name="x" size={18} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "hsl(var(--background) / 0.5)", border: "1px solid hsl(var(--border))" }}>
            <ParQuickStat label="Orders" value={p.orderCount || "—"} />
            <ParQuickStat label="Shipments" value={p.shipmentCount || "—"} />
            <ParQuickStat label="Open AP" value={p.openBalance > 0 ? parFmt(p.openBalance) : "—"} tone={p.openBalance > 0 ? "warning" : undefined} />
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span className="vy-kicker">Profile</span>
              {editing ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={cancel}>Cancel</button>
                  <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" onClick={save}><VyIcon name="check" size={12} /><span>Save</span></button>
                </div>
              ) : (
                <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" onClick={() => setEditing(true)}><VyIcon name="pencil" size={12} /><span>Edit</span></button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px 16px" }}>
              <ParQuickField label="Type" name="type" value={p.type} editing={editing} form={form} setForm={setForm} type="select" />
              <ParQuickField label="Specialty" name="specialty" value={p.specialty} editing={editing} form={form} setForm={setForm} placeholder="Sea LCL · CN → US" />
              <ParQuickField label="Contact" name="contact" value={p.contact} editing={editing} form={form} setForm={setForm} placeholder="e.g. Maria Lopez" />
              <ParQuickField label="Email" name="email" value={p.email} editing={editing} form={form} setForm={setForm} placeholder="ops@…" type="email" mono />
              <ParQuickField label="Phone / WeChat" name="phone" value={p.phone} editing={editing} form={form} setForm={setForm} placeholder="+…" mono />
              <ParQuickField label="Origin / hub" name="origin" value={p.origin} editing={editing} form={form} setForm={setForm} placeholder="e.g. Shenzhen, CN" />
              <ParQuickField label="Payment terms" name="paymentTerms" value={p.paymentTerms} editing={editing} form={form} setForm={setForm} placeholder="e.g. Net 30" />
              <ParQuickField label="Notes" name="notes" value={p.notes} editing={editing} form={form} setForm={setForm} placeholder="Anything worth remembering…" type="textarea" full />
            </div>
          </div>

          {/* Orders peek */}
          {p.orders && p.orders.length ? (
            <div>
              <div className="vy-kicker" style={{ marginBottom: 8 }}>Orders ({p.orderCount})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {p.orders.slice(0, 3).map((o) => (
                  <a key={o.id} href={"Vyonix Order Shell.html?order=" + encodeURIComponent(o.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "1px solid hsl(var(--border))", borderRadius: 9, background: "hsl(var(--background) / 0.4)", textDecoration: "none", color: "inherit" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...parMono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{o.id}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))" }}>
          <a href={"Vyonix Partner.html?partner=" + encodeURIComponent(p.name)} className="vy-btn vy-btn--primary" style={{ textDecoration: "none", flex: 1, justifyContent: "center" }}>
            <span>Open full partner</span><VyIcon name="arrowRight" size={14} />
          </a>
          <button type="button" className="vy-btn vy-btn--outline" onClick={onClose}>Close</button>
        </div>
      </aside>

      {toast ? (
        <div role="status" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 10, zIndex: 10001, padding: "11px 15px", borderRadius: 12, background: "hsl(var(--foreground))", color: "hsl(var(--background))", boxShadow: "0 12px 32px -8px hsl(0 0% 0% / 0.35)" }}>
          <span style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", background: "hsl(var(--primary))", color: "#fff" }}><VyIcon name="check" size={13} /></span>
          <span style={{ fontSize: 13 }}>Profile saved.</span>
        </div>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// NEW PARTNER MODAL
// ----------------------------------------------------------------------
function ParNewModal({ onClose }) {
  const [form, setForm] = useParState({ name: "", type: "Forwarder", specialty: "", contact: "" });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  useParEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const name = form.name.trim();
  const exists = name && PARTNERS.some((p) => p.name.toLowerCase() === name.toLowerCase());
  const valid = name && !exists;

  function create() {
    parUpsertProfile(name, { type: form.type, specialty: form.specialty.trim(), contact: form.contact.trim(), isNew: true });
    window.location.href = "Vyonix Partner.html?partner=" + encodeURIComponent(name);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 480, padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>New partner</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>Add an agent, forwarder or inspection agency. Full profile next.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Partner name</span>
            <input className="vy-input" style={{ ...parInput, width: "100%" }} value={form.name} onChange={set("name")} placeholder="e.g. ECU Worldwide" autoFocus />
            {exists ? <span style={{ fontSize: 10.5, color: "hsl(var(--danger))" }}>A partner with that name already exists.</span> : null}
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Type</span>
            <select className="vy-input" style={{ ...parInput, width: "100%" }} value={form.type} onChange={set("type")}>
              {PARTNER_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Specialty</span>
            <input className="vy-input" style={{ ...parInput, width: "100%" }} value={form.specialty} onChange={set("specialty")} placeholder="e.g. Sea LCL · China → US West" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Contact</span>
            <input className="vy-input" style={{ ...parInput, width: "100%" }} value={form.contact} onChange={set("contact")} placeholder="e.g. Maria Lopez" />
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={create}>
            <VyIcon name="plus" size={14} /><span>Create partner</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const parRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
parRoot.render(<PartnersPage />);
