// Vyonix Partner — detail page for one agent / forwarder / inspection agency.
// Route: /catalog/partners/[name]. Reads ?partner=. Editable persisted profile
// merged with derived rollups (orders touched, shipments handled, open bills).

const { useState: useParDState, useEffect: useParDEffect } = React;

const parDMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const parDInput = { width: "100%", height: 36, padding: "0 11px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };
const PARD_ORDER_TONE = { "In production": "info", "Inspection": "warning", "In transit": "info", "At FBA": "success", "Closed": "muted", "Draft": "muted" };

function parDInitials(name) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function ParDField({ label, name, value, editing, form, setForm, placeholder, type, full, mono }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <div className="vy-kicker" style={{ marginBottom: 5 }}>{label}</div>
      {editing ? (
        type === "textarea" ? (
          <textarea value={form[name] || ""} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} placeholder={placeholder} style={{ ...parDInput, height: 64, padding: "8px 11px", resize: "vertical", fontFamily: "inherit" }} />
        ) : type === "select" ? (
          <select value={form[name] || ""} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} style={parDInput}>
            {PARTNER_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        ) : (
          <input type={type || "text"} value={form[name] != null ? form[name] : ""} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} placeholder={placeholder} style={parDInput} />
        )
      ) : (
        <div style={{ fontSize: 13.5, fontWeight: 500, color: value ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))", fontFamily: mono ? "var(--font-mono, monospace)" : undefined }}>{value || "—"}</div>
      )}
    </div>
  );
}

function PartnerPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useParDState(false);
  const [mobileNavOpen, setMobileNavOpen] = useParDState(false);
  const [isDark, setIsDark] = useParDState(false);
  const [editing, setEditing] = useParDState(false);
  const [toast, setToast] = useParDState(false);

  const params = new URLSearchParams(window.location.search);
  const name = params.get("partner") || (window.PARTNERS[0] && window.PARTNERS[0].name) || "";

  const [p, setP] = useParDState(() => parByName(name));
  const [form, setForm] = useParDState(() => {
    const cur = parByName(name) || {};
    const f = {};
    PARTNER_PROFILE_FIELDS.forEach((k) => { f[k] = cur[k] != null ? cur[k] : ""; });
    return f;
  });

  useParDEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);
  useParDEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!p) {
    return (
      <div className="vy-app">
        <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} active="Trading partners" />
        <div className="vy-app-main">
          <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} workspaceName="Partners" tabs={PARTNERS_TABS} activeTab="partners" />
          <main className="vy-content"><div className="vy-content-inner">
            <div className="vy-card" style={{ padding: 40, textAlign: "center" }}>
              <p style={{ color: "hsl(var(--muted-fg))" }}>Partner not found.</p>
              <a href="Vyonix Partners.html" className="vy-btn vy-btn--primary" style={{ textDecoration: "none", marginTop: 12 }}>Back to Partners</a>
            </div>
          </div></main>
        </div>
      </div>
    );
  }

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

  const isFwd = p.type === "Forwarder";
  const kpis = [
    { icon: "cube", label: "Orders", value: String(p.orderCount), sub: "touched" },
    { icon: "ship", label: "Shipments", value: String(p.shipmentCount), sub: isFwd ? "handled" : "—" },
    { icon: "receipt", label: "Bills", value: String(p.invoiceCount), sub: "service invoices" },
    { icon: "dollar", label: "Open AP", value: p.openBalance > 0 ? parFmt(p.openBalance) : "—", sub: "owed", tone: p.openBalance > 0 ? "warning" : "success" },
  ];

  const card = { padding: "18px 20px" };
  const sectionTitle = { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 };
  const tone = PARTNER_TYPE_TONE[p.type] || "muted";
  const toneVar = ({ info: "info", warning: "warning", brand: "primary", danger: "danger", success: "success" })[tone] || "muted-fg";

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Trading partners" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => {}} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} workspaceName="Partners" tabs={PARTNERS_TABS} activeTab="partners" />
        <main className="vy-content">
          <div className="vy-content-inner">
            <nav className="vy-breadcrumb" aria-label="Breadcrumb" style={{ marginBottom: 4 }}>
              <a href="Vyonix Partners.html" className="vy-bc-link">Partners</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <span className="vy-bc-current" aria-current="page">{p.name}</span>
            </nav>

            {/* Header */}
            <div className="vy-card" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <span style={{ width: 48, height: 48, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--" + toneVar + ") / 0.14)", color: "hsl(var(--" + toneVar + "))", fontSize: 17, fontWeight: 700 }}>{parDInitials(p.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{p.name}</h1>
                      <span className={"vy-badge vy-badge--" + tone}>{p.type}</span>
                      {p.isNew ? <span className="vy-badge vy-badge--brand">New</span> : null}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      {p.specialty ? <span className="vy-chip"><VyIcon name="route" size={11} />{p.specialty}</span> : null}
                      {p.origin ? <span className="vy-chip"><VyIcon name="factory" size={11} />{p.origin}</span> : null}
                      {p.contact ? <span className="vy-chip"><VyIcon name="user" size={11} />{p.contact}</span> : null}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {editing ? (
                    <>
                      <button type="button" className="vy-btn vy-btn--ghost" onClick={cancel}>Cancel</button>
                      <button type="button" className="vy-btn vy-btn--primary" onClick={save}><VyIcon name="check" size={14} /><span>Save</span></button>
                    </>
                  ) : (
                    <button type="button" className="vy-btn vy-btn--outline" onClick={() => setEditing(true)}><VyIcon name="pencil" size={13} /><span>Edit profile</span></button>
                  )}
                </div>
              </div>
            </div>

            {/* KPIs */}
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

            {/* Profile */}
            <section className="vy-card" style={card}>
              <div style={sectionTitle}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--" + toneVar + ") / 0.12)", color: "hsl(var(--" + toneVar + "))" }}><VyIcon name="user" size={15} /></span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Profile</h3>
                  <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>{editing ? "Editing — saved on this device." : "Contact, terms and specialty."}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px 20px" }}>
                <ParDField label="Type" name="type" value={p.type} editing={editing} form={form} setForm={setForm} type="select" />
                <ParDField label="Specialty" name="specialty" value={p.specialty} editing={editing} form={form} setForm={setForm} placeholder="e.g. Sea LCL · China → US West" />
                <ParDField label="Contact" name="contact" value={p.contact} editing={editing} form={form} setForm={setForm} placeholder="e.g. Maria Lopez" />
                <ParDField label="Email" name="email" value={p.email} editing={editing} form={form} setForm={setForm} placeholder="ops@…" type="email" mono />
                <ParDField label="Phone / WeChat" name="phone" value={p.phone} editing={editing} form={form} setForm={setForm} placeholder="+…" mono />
                <ParDField label="Origin / hub" name="origin" value={p.origin} editing={editing} form={form} setForm={setForm} placeholder="e.g. Shenzhen, CN" />
                <ParDField label="Address" name="address" value={p.address} editing={editing} form={form} setForm={setForm} placeholder="Office address" full />
                <ParDField label="Payment terms" name="paymentTerms" value={p.paymentTerms} editing={editing} form={form} setForm={setForm} placeholder="e.g. Net 30" />
                <ParDField label="Notes" name="notes" value={p.notes} editing={editing} form={form} setForm={setForm} placeholder="Anything worth remembering…" type="textarea" full />
              </div>
            </section>

            {/* Contacts — people at this company */}
            {typeof VyContactsSection === "function" ? <VyContactsSection company={p.name} /> : null}

            {/* Shipments (forwarders) */}
            {p.shipments.length ? (
              <section className="vy-card" style={card}>
                <div style={sectionTitle}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--info) / 0.12)", color: "hsl(var(--info))" }}><VyIcon name="ship" size={15} /></span>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>Shipments ({p.shipmentCount})
                    <a href="Vyonix Shipments.html" style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "hsl(var(--primary))", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>All shipments <VyIcon name="arrowRight" size={11} /></a>
                  </h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.shipments.map((sh) => (
                    <div key={sh.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...parDMono, fontSize: 12.5, fontWeight: 700 }}>{sh.id}</div>
                        <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{sh.mode} · {sh.origin} → {sh.destination} · ETA {sh.eta}</div>
                      </div>
                      <span className={"vy-badge vy-badge--" + (window.LOG_STAGE_TONE ? LOG_STAGE_TONE[sh.stage] : "muted")}>{sh.stage}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Orders */}
            <section className="vy-card" style={card}>
              <div style={sectionTitle}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="cube" size={15} /></span>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Orders ({p.orderCount})</h3>
              </div>
              {p.orders.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.orders.map((o) => (
                    <a key={o.id} href={"Vyonix Order Shell.html?order=" + encodeURIComponent(o.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)", textDecoration: "none", color: "inherit" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...parDMono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{o.id}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{o.title}</div>
                      </div>
                      <span className={"vy-badge vy-badge--" + (PARD_ORDER_TONE[o.status] || "muted")}>{o.status}</span>
                      <VyIcon name="arrowRight" size={13} style={{ opacity: 0.5 }} />
                    </a>
                  ))}
                </div>
              ) : <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: 0 }}>No orders touched yet.</p>}
            </section>

            {/* Bills */}
            {p.invoices.length ? (
              <section className="vy-card" style={card}>
                <div style={sectionTitle}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--warning) / 0.12)", color: "hsl(var(--warning))" }}><VyIcon name="receipt" size={15} /></span>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>Bills ({p.invoiceCount})
                    <a href="Vyonix Invoices.html" style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "hsl(var(--primary))", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>Payables <VyIcon name="arrowRight" size={11} /></a>
                  </h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.invoices.map((inv) => {
                    const bal = Math.max(0, inv.total - inv.paid);
                    return (
                      <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...parDMono, fontSize: 12.5, fontWeight: 700 }}>{inv.id}</div>
                          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>due {typeof payDueLabel === "function" ? payDueLabel(inv.due) : inv.due}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ ...parDMono, fontSize: 13, fontWeight: 700, color: bal > 0 ? "hsl(var(--warning))" : "hsl(var(--success))" }}>{bal > 0 ? parFmt(bal) : "Settled"}</div>
                          <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>of {parFmt(inv.total)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Partners" />

      {toast ? (
        <div role="status" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 12, zIndex: 200, padding: "12px 16px", borderRadius: 12, background: "hsl(var(--foreground))", color: "hsl(var(--background))", boxShadow: "0 12px 32px -8px hsl(0 0% 0% / 0.35)" }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", background: "hsl(var(--primary))", color: "#fff" }}><VyIcon name="check" size={14} /></span>
          <div style={{ fontSize: 13 }}><strong style={{ fontWeight: 600 }}>Profile saved.</strong></div>
        </div>
      ) : null}
    </div>
  );
}

const parDRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
parDRoot.render(<PartnerPage />);
