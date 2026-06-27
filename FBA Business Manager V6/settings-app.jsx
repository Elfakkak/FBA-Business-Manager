// Vyonix Settings — two-pane settings shell. Left sub-nav + right content.
// Sections: Integrations (the real one, wired to the sync strips) · Business
// profile (editable, persisted) · Team & roles (invite your partner) ·
// Notifications. Route: /settings. Reads ?section= or #section.

const { useState: useSetState, useEffect: useSetEffect } = React;

const setMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const setInput = { width: "100%", height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

const SET_SECTIONS = [
  { id: "integrations", label: "Integrations", icon: "activity" },
  { id: "business", label: "Business profile", icon: "factory" },
  { id: "brand", label: "Brand", icon: "package" },
  { id: "team", label: "Team & roles", icon: "user" },
  { id: "notifications", label: "Notifications", icon: "bell" },
];

const SET_BUSINESS_KEY = "vy_business_profile_v1";
const SET_TEAM_KEY = "vy_team_v1";
const SET_NOTIF_KEY = "vy_notifications_v1";

function setLoad(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch (e) { return fallback; }
}
function setSave(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

// ----------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------
function SettingsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSetState(false);
  const [mobileNavOpen, setMobileNavOpen] = useSetState(false);
  const [isDark, setIsDark] = useSetState(false);

  const initial = (() => {
    try {
      const p = new URLSearchParams(window.location.search).get("section");
      const h = (window.location.hash || "").replace("#", "");
      const cand = p || h;
      return SET_SECTIONS.some((s) => s.id === cand) ? cand : "integrations";
    } catch (e) { return "integrations"; }
  })();
  const [section, setSection] = useSetState(initial);
  const [toast, setToast] = useSetState(null);

  useSetEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);
  useSetEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  function go(id) { setSection(id); try { history.replaceState(null, "", "?section=" + id); } catch (e) {} }

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Settings" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => {}} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} />
        <main className="vy-content">
          <div className="vy-content-inner">
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Workspace</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>Settings</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0" }}>Connections, business details and the people who can access Vyonix.</p>
              </div>
            </div>

            {/* Two-pane */}
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
              {/* Left sub-nav */}
              <nav className="vy-card" style={{ padding: 8, flex: "0 0 220px", minWidth: 200, position: "sticky", top: 16 }}>
                {SET_SECTIONS.map((s) => {
                  const active = s.id === section;
                  return (
                    <button key={s.id} type="button" onClick={() => go(s.id)} style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                      padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", marginBottom: 2,
                      fontSize: 13, fontWeight: active ? 600 : 500,
                      background: active ? "hsl(var(--primary) / 0.12)" : "transparent",
                      color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                    }}>
                      <VyIcon name={s.icon} size={15} style={{ opacity: active ? 1 : 0.6 }} />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Content */}
              <div style={{ flex: "1 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                {section === "integrations" ? <IntegrationsSection notify={setToast} /> : null}
                {section === "business" ? <BusinessSection notify={setToast} /> : null}
                {section === "brand" ? <BrandSection notify={setToast} /> : null}
                {section === "team" ? <TeamSection notify={setToast} /> : null}
                {section === "notifications" ? <NotificationsSection /> : null}
              </div>
            </div>
          </div>
        </main>
      </div>
      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Settings" />

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
// INTEGRATIONS
// ----------------------------------------------------------------------
function IntegrationsSection({ notify }) {
  const [items, setItems] = useSetState(() => intgList());
  const [peek, setPeek] = useSetState(null); // integration id for quick-view drawer
  const [connecting, setConnecting] = useSetState(null);   // id mid-OAuth
  const [syncing, setSyncing] = useSetState(null);          // id mid-sync
  const [menuFor, setMenuFor] = useSetState(null);
  const [menuPos, setMenuPos] = useSetState(null);
  function openMenu(e, id) {
    if (menuFor === id) { setMenuFor(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    setMenuFor(id);
  }

  function refresh() { setItems(intgList()); }

  function startConnect(id) {
    setConnecting(id);
    setTimeout(() => {
      intgConnect(id);
      setConnecting(null);
      refresh();
      const it = intgGet(id);
      notify((it ? it.name : "Integration") + " connected.");
    }, 1400);
  }
  function disconnect(id) {
    intgDisconnect(id);
    setMenuFor(null);
    refresh();
    const it = intgGet(id);
    notify((it ? it.name : "Integration") + " disconnected.");
  }
  function syncNow(id) {
    setSyncing(id);
    setMenuFor(null);
    setTimeout(() => { intgSyncNow(id); setSyncing(null); refresh(); notify("Synced just now."); }, 1100);
  }

  const connected = items.filter((i) => i.status === "connected").length;
  const errored = items.filter((i) => i.status === "error").length;
  const available = items.filter((i) => i.status === "disconnected").length;

  return (
    <>
      <section className="vy-card" style={{ padding: "18px 20px" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Integrations</h2>
        <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 14px" }}>Connect Vyonix to the tools that feed your data. Amazon drives the sync status shown on Inventory &amp; FBA Shipments.</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <SetSummary tone="success" label="Connected" value={connected} />
          <SetSummary tone="danger" label="Needs attention" value={errored} />
          <SetSummary tone="muted" label="Available" value={available} />
        </div>
      </section>

      {items.map((it) => {
        const isConn = it.status === "connected";
        const isErr = it.status === "error";
        const busyConnect = connecting === it.id;
        const busySync = syncing === it.id;
        const tv = INTG_TONE_VAR[it.tone] || "muted-fg";
        const status = busyConnect ? "syncing" : it.status;
        return (
          <section key={it.id} className="vy-card" style={{ padding: "16px 18px", cursor: "pointer" }} onClick={() => setPeek(it.id)}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <span style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--" + tv + ") / 0.14)", color: "hsl(var(--" + tv + "))" }}>
                <VyIcon name={it.icon} size={20} />
              </span>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}><a href={"Vyonix Integration.html?id=" + encodeURIComponent(it.id)} className="vy-row-title" onClick={(e) => e.stopPropagation()} style={{ color: "inherit", textDecoration: "none" }} title="Open integration details">{it.name}</a></h3>
                  {it.primary ? <span className="vy-badge vy-badge--brand">Primary</span> : null}
                  <span className={"vy-badge vy-badge--" + (busyConnect ? "info" : INTG_STATUS_TONE[it.status])}>
                    {busyConnect ? "Connecting…" : INTG_STATUS_LABEL[it.status]}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "5px 0 0" }}>{it.syncs}</p>
                <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "6px 0 0" }}>
                  {isConn ? (
                    <>Last sync {busySync ? "syncing…" : intgAgo(it.lastSync)}{it.account ? " · " + it.account : ""}</>
                  ) : isErr ? (
                    <span style={{ color: "hsl(var(--danger))" }}>{it.note || "Action needed"}</span>
                  ) : (
                    <>Not connected — {it.blurb}</>
                  )}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, position: "relative" }} onClick={(e) => e.stopPropagation()}>
                {isConn ? (
                  <>
                    <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" disabled={busySync} onClick={() => syncNow(it.id)}>
                      <VyIcon name={busySync ? "activity" : "refresh"} size={13} /><span>{busySync ? "Syncing…" : "Sync now"}</span>
                    </button>
                    <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={(e) => openMenu(e, it.id)}>
                      <span>Manage</span><VyIcon name="chevronDown" size={12} />
                    </button>
                    {menuFor === it.id && menuPos ? ReactDOM.createPortal(
                      <>
                        <div onClick={() => setMenuFor(null)} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
                        <div className="vy-card" style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999, padding: 6, minWidth: 170, boxShadow: "var(--shadow-lg)" }}>
                          <button type="button" onClick={() => syncNow(it.id)} style={setMenuItem}>Sync now</button>
                          <button type="button" onClick={() => startConnect(it.id)} style={setMenuItem}>Reconnect</button>
                          <button type="button" onClick={() => disconnect(it.id)} style={{ ...setMenuItem, color: "hsl(var(--danger))" }}>Disconnect</button>
                        </div>
                      </>,
                      document.body
                    ) : null}
                  </>
                ) : (
                  <button type="button" className={"vy-btn vy-btn--" + (isErr ? "outline" : "primary")} disabled={busyConnect} onClick={() => startConnect(it.id)}>
                    <VyIcon name={busyConnect ? "activity" : "link"} size={14} />
                    <span>{busyConnect ? "Connecting…" : isErr ? "Reconnect" : "Connect"}</span>
                  </button>
                )}
              </div>
            </div>
          </section>
        );
      })}
      {peek ? <IntegrationPeek it={intgGet(peek)} onClose={() => setPeek(null)} /> : null}
    </>
  );
}

// Quick-view side drawer for an integration (row click). Title click opens the full page.
function IntegrationPeek({ it, onClose }) {
  if (!it) return null;
  const tv = (typeof INTG_TONE_VAR !== "undefined" && INTG_TONE_VAR[it.tone]) || "primary";
  const st = (typeof INTG_STATUS_TONE !== "undefined" && INTG_STATUS_TONE[it.status]) || "muted";
  const sl = (typeof INTG_STATUS_LABEL !== "undefined" && INTG_STATUS_LABEL[it.status]) || it.status;
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.4)" }} />
      <div role="dialog" aria-label={it.name} style={{ position: "absolute", top: 0, right: 0, height: "100%", width: "min(400px, 94vw)", background: "hsl(var(--card))", borderLeft: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "18px 20px", borderBottom: "1px solid hsl(var(--border))" }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--" + tv + ") / 0.14)", color: "hsl(var(--" + tv + "))" }}><VyIcon name={it.icon} size={19} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{it.name}</h3>
              <span className={"vy-badge vy-badge--" + st}>{sl}</span>
            </div>
            <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>{it.syncs}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "hsl(var(--muted-fg))", margin: 0, lineHeight: 1.5 }}>{it.blurb}</p>
          {it.account ? <div><div className="vy-kicker" style={{ marginBottom: 4 }}>Account</div><div style={{ fontSize: 12.5, fontFamily: "var(--font-mono, monospace)" }}>{it.account}</div></div> : null}
          <div><div className="vy-kicker" style={{ marginBottom: 4 }}>Last sync</div><div style={{ fontSize: 12.5 }}>{it.status === "connected" ? (typeof intgAgo === "function" ? intgAgo(it.lastSync) : "\u2014") : "Not connected"}</div></div>
          {it.note ? <div style={{ fontSize: 12, color: "hsl(var(--warning))" }}>{it.note}</div> : null}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))" }}>
          <a href={"Vyonix Integration.html?id=" + encodeURIComponent(it.id)} className="vy-btn vy-btn--primary" style={{ textDecoration: "none", flex: 1, justifyContent: "center" }}><span>Open full page</span><VyIcon name="arrowRight" size={14} /></a>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
const setMenuItem = { display: "block", width: "100%", textAlign: "left", padding: "8px 10px", fontSize: 12.5, border: "none", background: "transparent", borderRadius: 7, cursor: "pointer", color: "hsl(var(--foreground))" };

function SetSummary({ tone, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: "hsl(var(--" + (tone === "muted" ? "muted-fg" : tone) + "))" }} />
      <span style={{ fontSize: 13, fontWeight: 700 }}>{value}</span>
      <span style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))" }}>{label}</span>
    </div>
  );
}

// ----------------------------------------------------------------------
// BUSINESS PROFILE
// ----------------------------------------------------------------------
function BusinessSection({ notify }) {
  const seed = {
    company: "Vyonix Commerce LLC", entityType: "LLC", stateOfFormation: "Wyoming",
    ein: "88-1234567", formationDate: "2024-01-15", registeredAgent: "Northwest Registered Agent LLC",
    email: "sam@vyonix.co", phone: "+1 (307) 555-0142", country: "United States",
    address: "30 N Gould St, Ste R", city: "Sheridan", state: "WY", zip: "82801",
    dunsNumber: "", website: "vyonix.co",
  };
  const [saved, setSaved] = useSetState(() => ({ ...seed, ...setLoad(SET_BUSINESS_KEY, {}) }));
  const [editing, setEditing] = useSetState(false);
  const [form, setForm] = useSetState(saved);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  function save() { setSave(SET_BUSINESS_KEY, form); setSaved(form); setEditing(false); notify("Business profile saved."); }
  function cancel() { setForm(saved); setEditing(false); }

  const F = ({ label, name, ph, full, third }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: editing ? 5 : 3, flex: full ? "1 1 100%" : third ? "1 1 calc(33% - 11px)" : "1 1 calc(50% - 8px)", minWidth: 0, ...(editing ? {} : { padding: "9px 12px", border: "1px solid hsl(var(--border))", borderRadius: 9, background: "hsl(var(--background) / 0.4)" }) }}>
      <span className="vy-kicker">{label}</span>
      {editing
        ? <input className="vy-input" style={setInput} value={form[name] || ""} onChange={set(name)} placeholder={ph} />
        : <div style={{ fontSize: 13.5, fontWeight: 600, color: saved[name] ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{saved[name] || "—"}</div>}
    </label>
  );
  const GroupLabel = ({ children }) => <div className="vy-kicker" style={{ flex: "1 1 100%", marginTop: 4, color: "hsl(var(--primary))" }}>{children}</div>;

  return (
    <>
    <section className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Business profile</h2>
          <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>Your LLC's legal details — appear on POs, invoices and exports.</p>
        </div>
        {editing ? (
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="vy-btn vy-btn--ghost" onClick={cancel}>Cancel</button>
            <button type="button" className="vy-btn vy-btn--primary" onClick={save}><VyIcon name="check" size={14} /><span>Save</span></button>
          </div>
        ) : (
          <button type="button" className="vy-btn vy-btn--outline" onClick={() => setEditing(true)}><VyIcon name="pencil" size={13} /><span>Edit</span></button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <GroupLabel>Legal entity</GroupLabel>
        <F label="Legal company name" name="company" ph="e.g. Vyonix Commerce LLC" />
        <F label="Entity type" name="entityType" ph="LLC / Corp / Sole prop" />
        <F label="State of formation" name="stateOfFormation" ph="e.g. Wyoming" third />
        <F label="Formation date" name="formationDate" ph="YYYY-MM-DD" third />
        <F label="EIN" name="ein" ph="88-1234567" third />
        <F label="Registered agent" name="registeredAgent" ph="Agent name" full />
        <F label="DUNS number (optional)" name="dunsNumber" ph="optional" />
        <F label="Website" name="website" ph="vyonix.co" />

        <GroupLabel>Contact</GroupLabel>
        <F label="Email" name="email" ph="you@company.com" />
        <F label="Phone" name="phone" ph="+1 …" />

        <GroupLabel>Principal address</GroupLabel>
        <F label="Street" name="address" ph="Street address" full />
        <F label="City" name="city" ph="City" third />
        <F label="State" name="state" ph="State" third />
        <F label="ZIP" name="zip" ph="ZIP" third />
        <F label="Country" name="country" ph="United States" />
      </div>
      </section>
      <OwnershipCard notify={notify} />
      </>
  );
}

// ----------------------------------------------------------------------
// OWNERSHIP & MEMBERS — owners live in Team & roles (single source of truth);
// shown here because they're part of the LLC's legal identity. Edit in place.
// ----------------------------------------------------------------------
function OwnershipCard({ notify }) {
  const [members, setMembers] = useSetState(() => (typeof teamLoad === "function" ? teamLoad() : []));
  const [editing, setEditing] = useSetState(null);
  const owners = members.filter((m) => m.owner);
  const shareSum = owners.reduce((n, o) => n + (Number(o.share) || 0), 0);

  function saveMember(id, patch) {
    const next = members.map((m) => (m.id === id ? { ...m, ...patch } : m));
    setMembers(next); if (typeof teamSave === "function") teamSave(next);
    setEditing(null); notify && notify("Owner updated");
  }

  return (
    <section className="vy-card" style={{ padding: "18px 20px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Ownership &amp; members</h2>
          <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>Who owns the company and their split. Drives the partner capital accounts in <a href="Vyonix Finances.html" style={{ color: "hsl(var(--primary))", fontWeight: 600 }}>Net &amp; Draws</a>.</p>
        </div>
        <a href="Vyonix Settings.html?section=team" className="vy-btn vy-btn--outline vy-btn--sm"><VyIcon name="user" size={13} /><span>Team &amp; roles</span></a>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {members.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))" }}>No members yet. Invite people in Team &amp; roles.</div>
        ) : members.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: m.owner ? "hsl(var(--primary) / 0.12)" : "hsl(var(--muted) / 0.5)", color: m.owner ? "hsl(var(--primary))" : "hsl(var(--muted-fg))", fontSize: 12, fontWeight: 700 }}>
              {m.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name} {m.you ? <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))", fontWeight: 500 }}>(you)</span> : null}</div>
              <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{m.role} · {m.email}</div>
            </div>
            {m.owner ? (
              <>
                <span className="vy-badge vy-badge--info">{Math.round((Number(m.share) || 0) * 100)}% ownership</span>
                <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={() => setEditing(m)} aria-label="Edit owner" title="Edit ownership"><VyIcon name="pencil" size={13} /></button>
              </>
            ) : (
              <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" onClick={() => { saveMember(m.id, { owner: true, share: 0 }); setEditing({ ...m, owner: true, share: 0 }); }}>
                <VyIcon name="plus" size={12} /><span>Make owner</span>
              </button>
            )}
          </div>
        ))}
      </div>
      {owners.length ? (
        <div style={{ marginTop: 12, fontSize: 11.5, color: Math.abs(shareSum - 1) > 0.001 ? "hsl(38 92% 45%)" : "hsl(var(--muted-fg))" }}>
          Ownership total: {Math.round(shareSum * 100)}% {Math.abs(shareSum - 1) > 0.001 ? "— should equal 100%." : "✓"}
        </div>
      ) : null}
      {editing ? <TeamEditModal member={editing} mode="ownership" onClose={() => setEditing(null)} onSave={saveMember} /> : null}
    </section>
  );
}

// ----------------------------------------------------------------------
// BRAND REGISTRY
// ----------------------------------------------------------------------
function BrandSection({ notify }) {
  const [saved, setSaved] = useSetState(() => brandLoad());
  const [editing, setEditing] = useSetState(false);
  const [form, setForm] = useSetState(saved);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  function save() { brandSave(form); setSaved(form); setEditing(false); notify("Brand details saved."); }
  function cancel() { setForm(saved); setEditing(false); }

  const F = ({ label, name, ph, full, third }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: editing ? 5 : 3, flex: full ? "1 1 100%" : third ? "1 1 calc(33% - 11px)" : "1 1 calc(50% - 8px)", minWidth: 0, ...(editing ? {} : { padding: "9px 12px", border: "1px solid hsl(var(--border))", borderRadius: 9, background: "hsl(var(--background) / 0.4)" }) }}>
      <span className="vy-kicker">{label}</span>
      {editing
        ? <input className="vy-input" style={setInput} value={form[name] || ""} onChange={set(name)} placeholder={ph} />
        : <div style={{ fontSize: 13.5, fontWeight: 600, color: saved[name] ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{saved[name] || "—"}</div>}
    </label>
  );
  const Toggle = ({ label, name, sub }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 calc(50% - 8px)", minWidth: 0, padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 9 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {sub ? <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{sub}</div> : null}
      </div>
      {editing ? (
        <button type="button" role="switch" aria-checked={!!form[name]} onClick={() => setForm((p) => ({ ...p, [name]: !p[name] }))} style={{ width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0, position: "relative", background: form[name] ? "hsl(var(--success))" : "hsl(var(--muted-bg))" }}>
          <span style={{ position: "absolute", top: 3, left: form[name] ? 21 : 3, width: 18, height: 18, borderRadius: 999, background: "#fff", transition: "left 160ms ease", boxShadow: "0 1px 3px hsl(0 0% 0% / 0.25)" }}></span>
        </button>
      ) : (
        <span className={"vy-badge vy-badge--" + (saved[name] ? "success" : "muted")}>{saved[name] ? "Yes" : "No"}</span>
      )}
    </div>
  );
  const GroupLabel = ({ children }) => <div className="vy-kicker" style={{ flex: "1 1 100%", marginTop: 4, color: "hsl(var(--primary))" }}>{children}</div>;

  return (
    <section className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Brand</h2>
          <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>Your private-label brand registry — the catalog and listings read these details.</p>
        </div>
        {editing ? (
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="vy-btn vy-btn--ghost" onClick={cancel}>Cancel</button>
            <button type="button" className="vy-btn vy-btn--primary" onClick={save}><VyIcon name="check" size={14} /><span>Save</span></button>
          </div>
        ) : (
          <button type="button" className="vy-btn vy-btn--outline" onClick={() => setEditing(true)}><VyIcon name="pencil" size={13} /><span>Edit</span></button>
        )}
      </div>

      {/* Identity row with logo */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
          <image-slot id="vy-brand-logo" style={{ width: "84px", height: "84px" }} shape="rounded" radius="16" placeholder="Logo"></image-slot>
          <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>Drop logo</span>
        </div>
        <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>{saved.name}</div>
            <div style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{saved.tagline}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <span className={"vy-badge vy-badge--" + (saved.registryEnrolled ? "success" : "muted")}>{saved.registryEnrolled ? "Brand Registry ✓" : "Not enrolled"}</span>
              <span className="vy-badge vy-badge--muted">{saved.tmStatus}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: saved.color, border: "1px solid hsl(var(--border))" }}></span>{saved.color}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <GroupLabel>Identity</GroupLabel>
        <F label="Brand name" name="name" ph="e.g. Vyonix" />
        <F label="Brand color (hex)" name="color" ph="#E8602C" third />
        <F label="Established" name="established" ph="2024" third />
        <F label="Tagline" name="tagline" ph="Short brand line" full />

        <GroupLabel>Amazon Brand Registry</GroupLabel>
        <Toggle label="Enrolled in Brand Registry" name="registryEnrolled" sub="Amazon brand protection" />
        <Toggle label="GTIN exemption" name="gtinExempt" sub="Sell without UPC barcodes" />
        <F label="Brand Registry ID" name="registryId" ph="BR-…" />
        <F label="Amazon Store URL" name="storeUrl" ph="amazon.com/yourbrand" />

        <GroupLabel>Trademark</GroupLabel>
        <F label="Trademark number" name="tmNumber" ph="US 97/…" />
        <F label="Status" name="tmStatus" ph="Registered / Pending" />
        <F label="Jurisdiction" name="tmJurisdiction" ph="USPTO" />
        <F label="Owner" name="tmOwner" ph="Legal owner" />

        <GroupLabel>Presence</GroupLabel>
        <F label="Website" name="website" ph="brand.co" />
        <F label="Support email" name="supportEmail" ph="support@brand.co" />
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------
// TEAM & ROLES
// ----------------------------------------------------------------------
function TeamSection({ notify }) {
  const [members, setMembers] = useSetState(() => (typeof teamLoad === "function" ? teamLoad() : []));
  const [modal, setModal] = useSetState(false);
  const [editing, setEditing] = useSetState(null); // member being edited

  function persist(next) { setMembers(next); if (typeof teamSave === "function") teamSave(next); }
  function saveMember(id, patch) { persist(members.map((m) => (m.id === id ? { ...m, ...patch } : m))); setEditing(null); notify("Member updated"); }
  function invite(email, role) {
    const next = [...members, { id: "m" + Date.now(), name: email.split("@")[0], email, role, status: "invited", you: false, owner: false, share: 0, finId: "m" + Date.now() }];
    persist(next); setModal(false); notify("Invite sent to " + email + ".");
  }
  function remove(id) { persist(members.filter((m) => m.id !== id)); }

  const owners = members.filter((m) => m.owner);
  const shareSum = owners.reduce((n, o) => n + (Number(o.share) || 0), 0);

  return (
    <>
      <section className="vy-card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Team &amp; roles</h2>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>Who can access this workspace and what they can do. Company ownership &amp; the partner split live in <a href="Vyonix Settings.html?section=business" style={{ color: "hsl(var(--primary))", fontWeight: 600 }}>Business profile &rarr; Ownership</a> — separate from access.</p>
          </div>
          <button type="button" className="vy-btn vy-btn--primary" onClick={() => setModal(true)}><VyIcon name="plus" size={14} /><span>Invite</span></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {members.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", fontSize: 12, fontWeight: 700 }}>
                {m.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name} {m.you ? <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))", fontWeight: 500 }}>(you)</span> : null}</div>
                <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{m.email}</div>
              </div>
              <span className={"vy-badge vy-badge--" + (m.status === "active" ? "success" : "warning")}>{m.status === "active" ? "Active" : "Invited"}</span>
              <span className="vy-badge vy-badge--muted">{m.role}</span>
              <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={() => setEditing(m)} aria-label="Edit" title="Edit access"><VyIcon name="pencil" size={13} /></button>
              {!m.you ? (
                <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={() => remove(m.id)} aria-label="Remove"><VyIcon name="x" size={13} /></button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      {modal ? <TeamInviteModal onClose={() => setModal(false)} onInvite={invite} /> : null}
      {editing ? <TeamEditModal member={editing} mode="access" onClose={() => setEditing(null)} onSave={saveMember} /> : null}
    </>
  );
}

function TeamInviteModal({ onClose, onInvite }) {
  const [email, setEmail] = useSetState("");
  const [role, setRole] = useSetState("Editor");
  useSetEffect(() => {
    function k(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const valid = /\S+@\S+\.\S+/.test(email);
  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 440, padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Invite teammate</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>They'll get an email invite to join this workspace.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Email</span>
            <input className="vy-input" style={setInput} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@email.com" autoFocus />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Access role</span>
            <select className="vy-input" style={setInput} value={role} onChange={(e) => setRole(e.target.value)}>
              <option>Admin</option><option>Editor</option><option>Operations</option><option>Viewer</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={() => onInvite(email.trim(), role)}>
            <VyIcon name="check" size={14} /><span>Send invite</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// EDIT MEMBER — rename, change email/role, toggle owner + ownership %
// ----------------------------------------------------------------------
function TeamEditModal({ member, mode, onClose, onSave }) {
  const ownerMode = mode === "ownership";
  const [name, setName] = useSetState(member.name || "");
  const [email, setEmail] = useSetState(member.email || "");
  const [role, setRole] = useSetState(member.role || "Operations");
  const [owner, setOwner] = useSetState(!!member.owner);
  const [share, setShare] = useSetState(String(Math.round((Number(member.share) || 0) * 100)));
  useSetEffect(() => {
    function k(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const valid = name.trim().length > 0;
  function save() {
    if (!valid) return;
    if (ownerMode) onSave(member.id, { name: name.trim(), email: email.trim(), owner, share: owner ? (Number(share) || 0) / 100 : 0 });
    else onSave(member.id, { name: name.trim(), email: email.trim(), role });
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 440, padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{ownerMode ? "Edit owner" : "Edit access"}</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0" }}>{ownerMode ? "Their name and ownership stake." : "Their name and what they can access."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Name</span>
            <input className="vy-input" style={setInput} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Email</span>
            <input className="vy-input" style={setInput} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
          </label>
          {!ownerMode ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="vy-kicker">Access role</span>
            <select className="vy-input" style={setInput} value={role} onChange={(e) => setRole(e.target.value)}>
              <option>Owner</option><option>Admin</option><option>Editor</option><option>Operations</option><option>Viewer</option>
            </select>
            <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Controls what they can see and edit — not equity. Ownership lives in Business profile &rarr; Ownership.</span>
          </label>
          ) : null}
          {ownerMode ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: "1px solid hsl(var(--border))", borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Company owner</div>
              <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>Counts toward the partner split in Net &amp; Draws.</div>
            </div>
            <button type="button" role="switch" aria-checked={owner} onClick={() => setOwner(!owner)} style={{ width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0, position: "relative", background: owner ? "hsl(var(--primary))" : "hsl(var(--muted-bg, var(--muted)))", transition: "background 160ms ease" }}>
              <span style={{ position: "absolute", top: 3, left: owner ? 21 : 3, width: 18, height: 18, borderRadius: 999, background: "#fff", transition: "left 160ms ease", boxShadow: "0 1px 3px hsl(0 0% 0% / 0.3)" }} />
            </button>
          </div>
          ) : null}
          {ownerMode && owner ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span className="vy-kicker">Ownership %</span>
              <input type="number" min="0" max="100" className="vy-input" style={{ ...setInput, width: 120 }} value={share} onChange={(e) => setShare(e.target.value)} />
              <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>Make sure all owners' % add up to 100.</span>
            </label>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={save}>
            <VyIcon name="check" size={14} /><span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// NOTIFICATIONS
// ----------------------------------------------------------------------
function NotificationsSection() {
  const defs = [
    { id: "lowstock", label: "Low stock / reorder alerts", sub: "When an SKU drops below its reorder point." },
    { id: "overdue", label: "Overdue invoices", sub: "When a vendor bill passes its due date." },
    { id: "fbavar", label: "FBA receiving variance", sub: "When received units differ from expected." },
    { id: "sync", label: "Sync failures", sub: "When an integration can't reach its API." },
  ];
  const [state, setState] = useSetState(() => ({ lowstock: true, overdue: true, fbavar: true, sync: true, ...setLoad(SET_NOTIF_KEY, {}) }));
  function toggle(id) { const next = { ...state, [id]: !state[id] }; setState(next); setSave(SET_NOTIF_KEY, next); }

  return (
    <section className="vy-card" style={{ padding: "18px 20px" }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Notifications</h2>
      <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 16px" }}>Choose what Vyonix alerts you about.</p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {defs.map((d, i) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderTop: i ? "1px solid hsl(var(--border))" : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{d.label}</div>
              <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{d.sub}</div>
            </div>
            <button type="button" role="switch" aria-checked={state[d.id]} onClick={() => toggle(d.id)} style={{
              width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0, position: "relative",
              background: state[d.id] ? "hsl(var(--primary))" : "hsl(var(--muted-bg))", transition: "background 160ms ease",
            }}>
              <span style={{ position: "absolute", top: 3, left: state[d.id] ? 21 : 3, width: 18, height: 18, borderRadius: 999, background: "#fff", transition: "left 160ms ease", boxShadow: "0 1px 3px hsl(0 0% 0% / 0.25)" }} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

const setRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
setRoot.render(<SettingsPage />);
