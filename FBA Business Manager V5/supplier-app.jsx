// Vyonix Supplier — detail page for one supplier. Route: /catalog/suppliers/[name]
// Reads ?supplier=. Editable profile (persisted via supUpsertProfile) merged
// with derived rollups (products / orders / open AP from the other datasets).

const { useState: useSupDState, useEffect: useSupDEffect } = React;

const supDMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const supDInput = { width: "100%", height: 36, padding: "0 11px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };
const SUPD_ORDER_TONE = { "In production": "info", "Inspection": "warning", "In transit": "info", "At FBA": "success", "Closed": "muted", "Draft": "muted" };

function supDInitials(name) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// One profile field — label + value (read) or input (edit).
function SupDField({ label, name, value, editing, form, setForm, placeholder, type, full, mono }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <div className="vy-kicker" style={{ marginBottom: 5 }}>{label}</div>
      {editing ? (
        type === "textarea" ? (
          <textarea value={form[name] || ""} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} placeholder={placeholder} style={{ ...supDInput, height: 64, padding: "8px 11px", resize: "vertical", fontFamily: "inherit" }} />
        ) : (
          <input type={type || "text"} value={form[name] != null ? form[name] : ""} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} placeholder={placeholder} style={supDInput} />
        )
      ) : (
        <div style={{ fontSize: 13.5, fontWeight: 500, color: value ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))", fontFamily: mono ? "var(--font-mono, monospace)" : undefined }}>
          {value || "—"}
        </div>
      )}
    </div>
  );
}

function SupplierPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSupDState(false);
  const [mobileNavOpen, setMobileNavOpen] = useSupDState(false);
  const [isDark, setIsDark] = useSupDState(false);
  const [editing, setEditing] = useSupDState(false);
  const [toast, setToast] = useSupDState(false);

  const params = new URLSearchParams(window.location.search);
  const name = params.get("supplier") || (window.SUP_SUPPLIERS[0] && window.SUP_SUPPLIERS[0].name) || "";

  const [s, setS] = useSupDState(() => supByName(name));
  const [form, setForm] = useSupDState(() => {
    const cur = supByName(name) || {};
    const f = {};
    SUP_PROFILE_FIELDS.forEach((k) => { f[k] = cur[k] != null ? cur[k] : ""; });
    return f;
  });

  useSupDEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);
  useSupDEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!s) {
    return (
      <div className="vy-app">
        <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} active="Suppliers" />
        <div className="vy-app-main">
          <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} workspaceName="Partners" tabs={PARTNERS_TABS} activeTab="suppliers" />
          <main className="vy-content"><div className="vy-content-inner">
            <div className="vy-card" style={{ padding: 40, textAlign: "center" }}>
              <p style={{ color: "hsl(var(--muted-fg))" }}>Supplier not found.</p>
              <a href="Vyonix Suppliers.html" className="vy-btn vy-btn--primary" style={{ textDecoration: "none", marginTop: 12 }}>Back to Suppliers</a>
            </div>
          </div></main>
        </div>
      </div>
    );
  }

  function save() {
    const patch = {};
    SUP_PROFILE_FIELDS.forEach((k) => { patch[k] = form[k]; });
    supUpsertProfile(name, patch);
    setS(supByName(name));
    setEditing(false);
    setToast(true);
  }
  function cancel() {
    const cur = supByName(name) || {};
    const f = {};
    SUP_PROFILE_FIELDS.forEach((k) => { f[k] = cur[k] != null ? cur[k] : ""; });
    setForm(f);
    setEditing(false);
  }

  const kpis = [
    { icon: "package", label: "Products", value: s.productCount + " · " + s.skuCount + " SKU", sub: "families sourced" },
    { icon: "cube", label: "Orders", value: String(s.orderCount), sub: s.openOrders + " open" },
    { icon: "dollar", label: "Open AP", value: s.openBalance > 0 ? supFmt(s.openBalance) : "—", sub: "owed", tone: s.openBalance > 0 ? "warning" : "success" },
    { icon: "truck", label: "Lead time", value: s.leadTimeDays ? s.leadTimeDays + "d" : "—", sub: s.moq ? "MOQ " + s.moq.toLocaleString() : "no MOQ set" },
  ];

  const card = { padding: "18px 20px" };
  const sectionTitle = { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 };

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Suppliers" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => {}} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} workspaceName="Partners" tabs={PARTNERS_TABS} activeTab="suppliers" />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Breadcrumb */}
            <nav className="vy-breadcrumb" aria-label="Breadcrumb" style={{ marginBottom: 4 }}>
              <a href="Vyonix Suppliers.html" className="vy-bc-link">Suppliers</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <span className="vy-bc-current" aria-current="page">{s.name}</span>
            </nav>

            {/* Header */}
            <div className="vy-card" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <span style={{ width: 48, height: 48, borderRadius: 13, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", fontSize: 17, fontWeight: 700 }}>{supDInitials(s.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{s.name}</h1>
                      {s.isNew ? <span className="vy-badge vy-badge--brand">New</span> : null}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      <span className="vy-chip"><VyIcon name="route" size={11} />{s.route}</span>
                      <span className="vy-chip"><VyIcon name="factory" size={11} />{s.origin}</span>
                      {s.incoterm ? <span className="vy-chip"><VyIcon name="ship" size={11} />{s.incoterm}</span> : null}
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

            {/* Profile card (editable) */}
            <section className="vy-card" style={card}>
              <div style={sectionTitle}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="user" size={15} /></span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Profile</h3>
                  <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>{editing ? "Editing — these fields are yours, saved on this device." : "Contact, terms and sourcing details."}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px 20px" }}>
                <SupDField label="Contact" name="contact" value={s.contact} editing={editing} form={form} setForm={setForm} placeholder="e.g. Lily Chen" />
                <SupDField label="Email" name="email" value={s.email} editing={editing} form={form} setForm={setForm} placeholder="sales@…" type="email" mono />
                <SupDField label="Phone / WeChat" name="phone" value={s.phone} editing={editing} form={form} setForm={setForm} placeholder="+86 …" mono />
                <SupDField label="Origin" name="origin" value={s.origin} editing={editing} form={form} setForm={setForm} placeholder="e.g. Ningbo, CN" />
                <SupDField label="Address" name="address" value={s.address} editing={editing} form={form} setForm={setForm} placeholder="Factory address" full />
                <SupDField label="Payment terms" name="paymentTerms" value={s.paymentTerms} editing={editing} form={form} setForm={setForm} placeholder="e.g. 30% deposit / 70% before ship" />
                <SupDField label="Default incoterm" name="incoterm" value={s.incoterm} editing={editing} form={form} setForm={setForm} placeholder="e.g. FOB Ningbo" />
                <SupDField label="Lead time (days)" name="leadTimeDays" value={s.leadTimeDays ? s.leadTimeDays + " days" : ""} editing={editing} form={form} setForm={setForm} placeholder="e.g. 30" type="number" mono />
                <SupDField label="MOQ (units)" name="moq" value={s.moq ? s.moq.toLocaleString() : ""} editing={editing} form={form} setForm={setForm} placeholder="e.g. 500" type="number" mono />
                <SupDField label="Notes" name="notes" value={s.notes} editing={editing} form={form} setForm={setForm} placeholder="Anything worth remembering about this supplier…" type="textarea" full />
              </div>
            </section>

            {/* Contacts — people at this factory */}
            {typeof VyContactsSection === "function" ? <VyContactsSection company={s.name} /> : null}

            {/* Products */}
            <section className="vy-card" style={card}>
              <div style={sectionTitle}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--info) / 0.12)", color: "hsl(var(--info))" }}><VyIcon name="package" size={15} /></span>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Products ({s.productCount})</h3>
              </div>
              {s.products.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {s.products.map((f) => (
                    <a key={f.id} href={"Vyonix Product.html?family=" + encodeURIComponent(f.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)", textDecoration: "none", color: "inherit" }}>
                      <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--muted-bg))", color: "hsl(var(--muted-fg))" }}><VyIcon name="package" size={14} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{f.parent}{f.color ? " · " + f.color : ""}</div>
                        <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{f.category} · {f.variants ? f.variants.length : 0} SKUs</div>
                      </div>
                      <VyIcon name="arrowRight" size={13} style={{ opacity: 0.5 }} />
                    </a>
                  ))}
                </div>
              ) : <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: 0 }}>No catalog products linked to this supplier yet.</p>}
            </section>

            {/* Orders */}
            <section className="vy-card" style={card}>
              <div style={sectionTitle}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="cube" size={15} /></span>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Orders ({s.orderCount})</h3>
              </div>
              {s.orders.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {s.orders.map((o) => (
                    <a key={o.id} href={"Vyonix Order Shell.html?order=" + encodeURIComponent(o.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)", textDecoration: "none", color: "inherit" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...supDMono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{o.id}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{o.title}</div>
                      </div>
                      <span className={"vy-badge vy-badge--" + (SUPD_ORDER_TONE[o.status] || "muted")}>{o.status}</span>
                      <VyIcon name="arrowRight" size={13} style={{ opacity: 0.5 }} />
                    </a>
                  ))}
                </div>
              ) : <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: 0 }}>No orders with this supplier yet.</p>}
            </section>

            {/* Bills */}
            {s.invoices.length ? (
              <section className="vy-card" style={card}>
                <div style={sectionTitle}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--warning) / 0.12)", color: "hsl(var(--warning))" }}><VyIcon name="receipt" size={15} /></span>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>Bills on their orders ({s.invoices.length})</h3>
                  <a href="Vyonix Invoices.html" style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "hsl(var(--primary))", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>Payables <VyIcon name="arrowRight" size={11} /></a>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {s.invoices.map((inv) => {
                    const bal = Math.max(0, inv.total - inv.paid);
                    return (
                      <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...supDMono, fontSize: 12.5, fontWeight: 700 }}>{inv.id}</div>
                          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{inv.vendorType} · due {typeof payDueLabel === "function" ? payDueLabel(inv.due) : inv.due}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ ...supDMono, fontSize: 13, fontWeight: 700, color: bal > 0 ? "hsl(var(--warning))" : "hsl(var(--success))" }}>{bal > 0 ? supFmt(bal) : "Settled"}</div>
                          <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>of {supFmt(inv.total)}</div>
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
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Suppliers" />

      {toast ? (
        <div role="status" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 12, zIndex: 200, padding: "12px 16px", borderRadius: 12, background: "hsl(var(--foreground))", color: "hsl(var(--background))", boxShadow: "0 12px 32px -8px hsl(0 0% 0% / 0.35)" }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", background: "hsl(var(--primary))", color: "#fff" }}><VyIcon name="check" size={14} /></span>
          <div style={{ fontSize: 13 }}><strong style={{ fontWeight: 600 }}>Profile saved.</strong></div>
        </div>
      ) : null}
    </div>
  );
}

const supDRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
supDRoot.render(<SupplierPage />);
