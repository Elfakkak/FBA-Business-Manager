// Vyonix Suppliers — directory of factories you buy from, aggregated from the
// catalog (products/lead time), orders, payables (open balance), logistics
// (origin). Route: /catalog/suppliers. Row click → supplier-360 drawer.

const { useState: useSupState, useEffect: useSupEffect } = React;

const supTh = { textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" };
const supTd = { padding: "12px 12px", color: "hsl(var(--foreground))", fontSize: 12.5, whiteSpace: "nowrap" };
const supMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const supInput = { height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

const ORDER_TONE = { "In production": "info", "Inspection": "warning", "In transit": "info", "At FBA": "success", "Closed": "muted", "Draft": "muted" };

function supInitials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
function SuppliersPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSupState(false);
  const [mobileNavOpen, setMobileNavOpen] = useSupState(false);
  const [isDark, setIsDark] = useSupState(false);
  const [query, setQuery] = useSupState("");
  const [creating, setCreating] = useSupState(false);
  const [drawer, setDrawer] = useSupState(null); // supplier name being quick-viewed

  useSupEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  const filtered = SUP_SUPPLIERS.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [s.name, s.origin, s.route].join(" ").toLowerCase().includes(q);
  });

  const totalSuppliers = SUP_SUPPLIERS.length;
  const totalProducts = SUP_SUPPLIERS.reduce((n, s) => n + s.productCount, 0);
  const openAP = SUP_SUPPLIERS.reduce((n, s) => n + s.openBalance, 0);
  const openOrders = SUP_SUPPLIERS.reduce((n, s) => n + s.openOrders, 0);

  const kpis = [
    { icon: "factory", label: "Suppliers", value: String(totalSuppliers), sub: "active factories" },
    { icon: "package", label: "Products", value: String(totalProducts), sub: "families sourced" },
    { icon: "cube", label: "Open orders", value: String(openOrders), sub: "in flight" },
    { icon: "dollar", label: "Open AP", value: supFmt(openAP), sub: "owed to suppliers", tone: openAP > 0 ? "warning" : "success" },
  ];

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Suppliers" />
      <div className="vy-app-main">
        <VyHeader
          onToggleMobileNav={() => setMobileNavOpen(true)}
          onOpenSearch={() => {}}
          onToggleTheme={() => setIsDark(!isDark)}
          isDark={isDark}
          onToggleActivity={() => {}}
          workspaceName="Partners"
          tabs={PARTNERS_TABS}
          activeTab="suppliers"
        />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Page header */}
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Partners</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>Suppliers</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0" }}>
                  Every factory you buy from — products sourced, orders in flight, lead time and what you owe. Click a supplier for the full picture.
                </p>
              </div>
              <div className="vy-page-head-actions" style={{ marginLeft: "auto" }}>
                <button type="button" className="vy-btn vy-btn--ghost" onClick={() => {}}>
                  <VyIcon name="arrowUpRight" size={14} /><span>Export</span>
                </button>
                <button type="button" className="vy-btn vy-btn--primary" onClick={() => setCreating(true)}>
                  <VyIcon name="plus" size={14} /><span>New supplier</span>
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
              <div style={{ position: "relative", flex: "1 1 300px", minWidth: 0 }}>
                <VyIcon name="search" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-fg))" }} />
                <input type="text" className="vy-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search supplier, origin, agent" style={{ ...supInput, width: "100%", paddingLeft: 34 }} />
              </div>
            </div>

            {/* Suppliers table */}
            <div className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
                <span className="vy-kicker">{filtered.length} {filtered.length === 1 ? "supplier" : "suppliers"}</span>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Open AP = unpaid goods + agent bills on their orders</span>
              </div>
              <div style={{ overflowX: "auto", borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                  <thead>
                    <tr style={{ background: "hsl(var(--muted-bg) / 0.5)" }}>
                      <th style={supTh}>Supplier</th>
                      <th style={supTh}>Origin</th>
                      <th style={{ ...supTh, textAlign: "right" }}>Products</th>
                      <th style={{ ...supTh, textAlign: "right" }}>Orders</th>
                      <th style={{ ...supTh, textAlign: "right" }}>Lead time</th>
                      <th style={{ ...supTh, textAlign: "right" }}>Open AP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.name} className="vy-order-row" onClick={() => setDrawer(s.name)} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)", cursor: "pointer" }}>
                        <td style={supTd}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", fontSize: 11, fontWeight: 700 }}>{supInitials(s.name)}</span>
                            <div>
                              <a href={"Vyonix Supplier.html?supplier=" + encodeURIComponent(s.name)} className="vy-row-title" onClick={(e) => e.stopPropagation()} title="Open supplier page" style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</a>
                              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{s.route}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...supTd, color: "hsl(var(--muted-fg))" }}>{s.origin}</td>
                        <td style={{ ...supTd, textAlign: "right" }}>
                          <div style={{ fontWeight: 600 }}>{s.productCount}</div>
                          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{s.skuCount} SKUs</div>
                        </td>
                        <td style={{ ...supTd, textAlign: "right" }}>
                          <div style={{ fontWeight: 600 }}>{s.orderCount}</div>
                          <div style={{ fontSize: 11, color: s.openOrders ? "hsl(var(--info))" : "hsl(var(--muted-fg))" }}>{s.openOrders} open</div>
                        </td>
                        <td style={{ ...supTd, ...supMono, textAlign: "right", color: "hsl(var(--muted-fg))" }}>{s.leadTimeDays ? s.leadTimeDays + "d" : "—"}</td>
                        <td style={{ ...supTd, ...supMono, textAlign: "right", fontWeight: 700, color: s.openBalance > 0 ? "hsl(var(--warning))" : "hsl(var(--muted-fg))" }}>{s.openBalance > 0 ? supFmt(s.openBalance) : "—"}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} style={{ ...supTd, textAlign: "center", padding: "36px 12px", color: "hsl(var(--muted-fg))" }}>No suppliers match your search.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Suppliers" />

      {creating ? <SupNewModal onClose={() => setCreating(false)} /> : null}
      {drawer ? <SupQuickDrawer name={drawer} onClose={() => setDrawer(null)} /> : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// NEW SUPPLIER MODAL — create a profile record, then open its page
// ----------------------------------------------------------------------
function SupNewModal({ onClose }) {
  const [form, setForm] = useSupState({ name: "", origin: "", contact: "", paymentTerms: "" });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  useSupEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const name = form.name.trim();
  const exists = name && SUP_SUPPLIERS.some((s) => s.name.toLowerCase() === name.toLowerCase());
  const valid = name && !exists;

  function create() {
    supUpsertProfile(name, { origin: form.origin.trim(), contact: form.contact.trim(), paymentTerms: form.paymentTerms.trim(), isNew: true });
    window.location.href = "Vyonix Supplier.html?supplier=" + encodeURIComponent(name);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 480, padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>New supplier</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>Create a supplier record. You can fill in the full profile next.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Supplier name</span>
            <input className="vy-input" style={{ ...supInput, width: "100%" }} value={form.name} onChange={set("name")} placeholder="e.g. Dongguan Leather Co" autoFocus />
            {exists ? <span style={{ fontSize: 10.5, color: "hsl(var(--danger))" }}>A supplier with that name already exists.</span> : null}
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Origin</span>
            <input className="vy-input" style={{ ...supInput, width: "100%" }} value={form.origin} onChange={set("origin")} placeholder="e.g. Dongguan, CN" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Contact</span>
            <input className="vy-input" style={{ ...supInput, width: "100%" }} value={form.contact} onChange={set("contact")} placeholder="e.g. Lily Chen" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Payment terms</span>
            <input className="vy-input" style={{ ...supInput, width: "100%" }} value={form.paymentTerms} onChange={set("paymentTerms")} placeholder="e.g. 30% deposit / 70% before ship" />
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={create}>
            <VyIcon name="plus" size={14} /><span>Create supplier</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// QUICK-VIEW DRAWER — slide-in quick look + inline edit, from the list. The
// full page (Vyonix Supplier.html) stays for deep-links; this is the fast peek.
// ----------------------------------------------------------------------
function SupQuickStat({ label, value, tone }) {
  return (
    <div style={{ flex: "1 1 80px", minWidth: 0 }}>
      <div className="vy-kicker" style={{ marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: tone ? "hsl(var(--" + tone + "))" : undefined }}>{value}</div>
    </div>
  );
}

function SupQuickField({ label, name, value, editing, form, setForm, placeholder, type, full, mono }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <div className="vy-kicker" style={{ marginBottom: 4 }}>{label}</div>
      {editing ? (
        type === "textarea" ? (
          <textarea value={form[name] || ""} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} placeholder={placeholder} style={{ ...supInput, width: "100%", height: 56, padding: "8px 11px", resize: "vertical", fontFamily: "inherit" }} />
        ) : (
          <input type={type || "text"} value={form[name] != null ? form[name] : ""} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} placeholder={placeholder} style={{ ...supInput, width: "100%" }} />
        )
      ) : (
        <div style={{ fontSize: 13, fontWeight: 500, color: value ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))", fontFamily: mono ? "var(--font-mono, monospace)" : undefined }}>{value || "—"}</div>
      )}
    </div>
  );
}

function SupQuickDrawer({ name, onClose }) {
  const [shown, setShown] = useSupState(false);
  const [s, setS] = useSupState(() => supByName(name));
  const [editing, setEditing] = useSupState(false);
  const [toast, setToast] = useSupState(false);
  const [form, setForm] = useSupState(() => {
    const cur = supByName(name) || {};
    const f = {};
    SUP_PROFILE_FIELDS.forEach((k) => { f[k] = cur[k] != null ? cur[k] : ""; });
    return f;
  });

  useSupEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    function onKey(e) { if (e.key === "Escape") { if (editing) { setEditing(false); } else { onClose(); } } }
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); };
  }, [onClose, editing]);

  useSupEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!s) return null;

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
              <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", fontSize: 14, fontWeight: 700 }}>{supInitials(s.name)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{s.name}</span>
                  {s.isNew ? <span className="vy-badge vy-badge--brand" style={{ fontSize: 9, padding: "1px 6px" }}>New</span> : null}
                </div>
                <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{s.route} · {s.origin}</div>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))", flexShrink: 0 }}>
              <VyIcon name="x" size={18} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "hsl(var(--background) / 0.5)", border: "1px solid hsl(var(--border))" }}>
            <SupQuickStat label="Products" value={s.productCount + " · " + s.skuCount + " SKU"} />
            <SupQuickStat label="Orders" value={s.orderCount + (s.openOrders ? " · " + s.openOrders + " open" : "")} />
            <SupQuickStat label="Open AP" value={s.openBalance > 0 ? supFmt(s.openBalance) : "—"} tone={s.openBalance > 0 ? "warning" : undefined} />
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Profile (quick edit) */}
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
              <SupQuickField label="Contact" name="contact" value={s.contact} editing={editing} form={form} setForm={setForm} placeholder="e.g. Lily Chen" />
              <SupQuickField label="Email" name="email" value={s.email} editing={editing} form={form} setForm={setForm} placeholder="sales@…" type="email" mono />
              <SupQuickField label="Phone / WeChat" name="phone" value={s.phone} editing={editing} form={form} setForm={setForm} placeholder="+86 …" mono />
              <SupQuickField label="Lead time (days)" name="leadTimeDays" value={s.leadTimeDays ? s.leadTimeDays + " days" : ""} editing={editing} form={form} setForm={setForm} placeholder="e.g. 30" type="number" mono />
              <SupQuickField label="MOQ" name="moq" value={s.moq ? s.moq.toLocaleString() : ""} editing={editing} form={form} setForm={setForm} placeholder="e.g. 500" type="number" mono />
              <SupQuickField label="Payment terms" name="paymentTerms" value={s.paymentTerms} editing={editing} form={form} setForm={setForm} placeholder="30% / 70%" />
              <SupQuickField label="Notes" name="notes" value={s.notes} editing={editing} form={form} setForm={setForm} placeholder="Anything worth remembering…" type="textarea" full />
            </div>
          </div>

          {/* Orders peek */}
          {s.orders && s.orders.length ? (
            <div>
              <div className="vy-kicker" style={{ marginBottom: 8 }}>Orders ({s.orderCount})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {s.orders.slice(0, 3).map((o) => (
                  <a key={o.id} href={"Vyonix Order Shell.html?order=" + encodeURIComponent(o.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "1px solid hsl(var(--border))", borderRadius: 9, background: "hsl(var(--background) / 0.4)", textDecoration: "none", color: "inherit" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...supMono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{o.id}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</div>
                    </div>
                    <span className={"vy-badge vy-badge--" + (ORDER_TONE[o.status] || "muted")}>{o.status}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer — quick look → full page */}
        <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))" }}>
          <a href={"Vyonix Supplier.html?supplier=" + encodeURIComponent(s.name)} className="vy-btn vy-btn--primary" style={{ textDecoration: "none", flex: 1, justifyContent: "center" }}>
            <span>Open full supplier</span><VyIcon name="arrowRight" size={14} />
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

const supRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
supRoot.render(<SuppliersPage />);
