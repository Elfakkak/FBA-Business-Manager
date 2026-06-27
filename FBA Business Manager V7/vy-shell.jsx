// Vyonix app shell: Sidebar + Header.
// Honours src/app/(app)/layout.tsx — left aside + top header + main scroll.

const { useEffect, useState, useRef } = React;

// ----------------------------------------------------------------------
// SIDEBAR — grouped navigation matching src/components/layout/nav-sections
// ----------------------------------------------------------------------
const VY_NAV_GROUPS = [
  {
    title: "Dashboard",
    icon: "dashboard",
    href: "Vyonix Dashboard.html",
  },
  {
    title: "Operations",
    icon: "ops",
    defaultOpen: true,
    active: true,
    items: [
      { label: "Orders",        icon: "cube", active: true, href: "Vyonix Orders List.html" },
      { label: "Invoices",      icon: "receipt", href: "Vyonix Invoices.html" },
      { label: "Shipments",     icon: "ship", href: "Vyonix Shipments.html" },
      { label: "FBA Shipments", icon: "truck", href: "Vyonix FBA Shipments.html" },
      { label: "Activity",      icon: "bell", href: "Vyonix Activity.html" },
    ],
  },
  {
    title: "Catalog",
    icon: "catalog",
    items: [
      { label: "Products",  icon: "package", href: "Vyonix Catalog.html" },
      { label: "Inventory", icon: "boxes", href: "Vyonix Inventory.html" },
      { label: "Performance", icon: "dashboard", href: "Vyonix Performance.html" },
      { label: "Packaging", icon: "boxes", href: "Vyonix Packaging.html" },
      { label: "Service charges", icon: "receipt", href: "Vyonix Charge Types.html" },
      { label: "FBA calculator", icon: "calculator", href: "Vyonix FBA Calculator.html" },
    ],
  },
  {
    title: "Finance",
    icon: "money",
    badgeKey: "fin-review",
    items: [
      { label: "Business", icon: "dashboard", href: "Vyonix Finances.html?tab=business" },
      { label: "P&L", icon: "dollar", href: "Vyonix Finances.html?tab=pnl" },
      { label: "Partnership", icon: "user", href: "Vyonix Finances.html?tab=partnership" },
      { label: "Tax", icon: "shield", href: "Vyonix Finances.html?tab=tax" },
      { label: "Transactions", icon: "fileText", href: "Vyonix Finances.html?tab=ledger" },
    ],
  },
  {
    title: "Partners",
    icon: "factory",
    items: [
      { label: "Suppliers", icon: "factory", href: "Vyonix Suppliers.html" },
      { label: "Trading partners",  icon: "user", href: "Vyonix Partners.html" },
    ],
  },
];

function VySidebar({ collapsed, onToggleCollapsed, mobile = false, onNavigate, active }) {
  // open/close per-group state, restored on mount.
  // `active` (optional) = label of the current nav item; overrides the static
  // active flags so other entry points (e.g. Catalog) light up correctly.
  const initial = {};
  for (const g of VY_NAV_GROUPS) {
    initial[g.title] = active ? (g.items || []).some((i) => i.label === active) : !!g.defaultOpen;
  }
  const [open, setOpen] = useState(initial);
  const [quickOpen, setQuickOpen] = useState(false);

  // Quick-create shortcuts (work from any page — navigate to the create flow).
  const QUICK_CREATE = [
    { label: "New order", icon: "cube", href: "Vyonix Orders List.html?new=1" },
    { label: "New shipment", icon: "ship", href: "Vyonix Shipments.html?new=1" },
    { label: "Add product", icon: "package", href: "Vyonix Catalog.html?new=1" },
    { label: "Log finance entry", icon: "dollar", href: "Vyonix Finances.html?new=1" },
  ];

  // Live count badges read straight from localStorage so they work on any page
  // (e.g. the Finance review inbox count) without that page's data loaded.
  function navBadge(key) {
    if (key === "fin-review") {
      try { const a = JSON.parse(localStorage.getItem("vy_finances_inbox_v2") || "[]"); return Array.isArray(a) && a.length ? a.length : 0; } catch (e) { return 0; }
    }
    return 0;
  }

  function toggleGroup(t) {
    setOpen((p) => ({ ...p, [t]: !p[t] }));
  }

  return (
    <nav
      className={"vy-sidebar" + (collapsed ? " vy-sidebar--collapsed" : "") + (mobile ? " vy-sidebar--mobile" : "")}
      aria-label="Primary"
    >
      <div className="vy-sidebar-head">
        <a className="vy-brand" href="#" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate(); }}>
          <span className="vy-brand-mark">V</span>
          {!collapsed && (
            <span className="vy-brand-text">
              <span className="vy-brand-name">{(typeof brandName==="function"?brandName():"Vyonix")}</span>
              <span className="vy-brand-sub">FBA Business Manager</span>
            </span>
          )}
        </a>
        {!mobile && (
          <button
            type="button"
            className="vy-collapse-btn"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <VyIcon name={collapsed ? "chevronsRight" : "chevronsLeft"} size={13} />
          </button>
        )}
      </div>

      {!collapsed && (
        <div style={{ position: "relative" }}>
          <button type="button" className="vy-quick-create" onClick={() => setQuickOpen((v) => !v)}>
            <VyIcon name="plus" size={14} />
            <span>Quick create</span>
            <kbd>⌘N</kbd>
          </button>
          {quickOpen ? (
            <>
              <div onClick={() => setQuickOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div role="menu" style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 41, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, boxShadow: "var(--shadow-lg)", overflow: "hidden", padding: 4 }}>
                {QUICK_CREATE.map((q) => (
                  <a key={q.label} href={q.href} role="menuitem" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 7, textDecoration: "none", color: "hsl(var(--foreground))", fontSize: 13, fontWeight: 500 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--accent) / 0.6)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <VyIcon name={q.icon} size={14} style={{ color: "hsl(var(--primary))" }} />
                    <span>{q.label}</span>
                  </a>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}
      {collapsed && (
        <button type="button" className="vy-quick-create vy-quick-create--icon" aria-label="Quick create" onClick={() => { window.location.href = "Vyonix Orders List.html?new=1"; }}>
          <VyIcon name="plus" size={16} />
        </button>
      )}

      <div className="vy-sidebar-scroll">
        {!collapsed && (
          <div className="vy-sidebar-label">
            <span>Sections</span>
          </div>
        )}

        {VY_NAV_GROUPS.map((group) => {
          const isOpen = open[group.title];
          const isActive = active ? (group.href ? active === group.title : group.items.some((i) => i.label === active)) : group.active;
          // Leaf group: a group that is itself a single link (no children).
          if (group.href) {
            if (collapsed) {
              return (
                <div key={group.title} className="vy-grp-rail" title={group.title}>
                  <a href={group.href} className={"vy-grp-rail-btn" + (isActive ? " is-active" : "")} aria-label={group.title}>
                    <VyIcon name={group.icon} size={16} />
                  </a>
                </div>
              );
            }
            return (
              <div key={group.title} className="vy-grp">
                <a href={group.href} className={"vy-grp-head" + (isActive ? " is-active" : "")} style={{ textDecoration: "none" }}>
                  <VyIcon name={group.icon} size={15} />
                  <span className="vy-grp-title">{group.title}</span>
                  {group.badgeKey && navBadge(group.badgeKey) ? <span className="vy-badge vy-badge--primary" style={{ marginLeft: "auto", fontSize: 9.5 }}>{navBadge(group.badgeKey)}</span> : null}
                </a>
              </div>
            );
          }
          if (collapsed) {
            return (
              <div key={group.title} className="vy-grp-rail" title={group.title}>
                <button
                  type="button"
                  className={"vy-grp-rail-btn" + (isActive ? " is-active" : "")}
                  aria-label={group.title}
                >
                  <VyIcon name={group.icon} size={16} />
                </button>
              </div>
            );
          }
          return (
            <div key={group.title} className="vy-grp">
              <button
                type="button"
                className={"vy-grp-head" + (isActive ? " is-active" : "") + (isOpen ? " is-open" : "")}
                onClick={() => toggleGroup(group.title)}
                aria-expanded={isOpen}
              >
                <VyIcon name={group.icon} size={15} />
                <span className="vy-grp-title">{group.title}</span>
                <VyIcon name={isOpen ? "chevronDown" : "chevronRight"} size={12} style={{ opacity: 0.6 }} />
              </button>
              {isOpen && (
                <div className="vy-grp-items">
                  {group.items.map((it) => {
                    const itActive = active ? it.label === active : it.active;
                    const href = it.href || "#";
                    return (
                    <a
                      key={it.label}
                      href={href}
                      onClick={(e) => {
                        if (!it.href) {
                          e.preventDefault();
                          onNavigate && onNavigate();
                        }
                      }}
                      className={"vy-nav-row" + (itActive ? " is-active" : "") + (it.soon ? " is-soon" : "")}
                      aria-disabled={it.soon ? "true" : undefined}
                    >
                      <VyIcon name={it.icon} size={13} />
                      <span className="vy-nav-row-label">{it.label}</span>
                      {it.badgeKey && navBadge(it.badgeKey) ? <span className="vy-badge vy-badge--primary" style={{ marginLeft: "auto", fontSize: 9.5 }}>{navBadge(it.badgeKey)}</span> : null}
                      {it.soon ? <span className="vy-soon-badge">Soon</span> : null}
                    </a>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="vy-sidebar-foot">
        <a
          href="Vyonix Settings.html"
          className={"vy-nav-row vy-foot-row" + (active === "Settings" ? " is-active" : "")}
          aria-label="Settings"
          title="Settings"
        >
          <VyIcon name="settings" size={collapsed ? 16 : 14} />
          {!collapsed ? <span className="vy-nav-row-label">Settings</span> : null}
        </a>
      </div>
    </nav>
  );
}
// HEADER — workspace section nav + search + bell + theme + avatar
// ----------------------------------------------------------------------
const WORKSPACES = [
  { key: "command",   label: "Command" },
  { key: "amazon",    label: "Amazon" },
  { key: "operations", label: "Operations" },
  { key: "money",     label: "Money" },
  { key: "marketing", label: "Marketing" },
];
const OPERATIONS_TABS = [
  { key: "quote",    label: "Quote Requests" },
  { key: "orders",   label: "Orders", href: "Vyonix Orders List.html" },
  { key: "invoices", label: "Invoices", href: "Vyonix Invoices.html" },
  { key: "shipments", label: "Shipments", href: "Vyonix Shipments.html" },
  { key: "fba",      label: "FBA Shipments", href: "Vyonix FBA Shipments.html" },
];
const CATALOG_TABS = [
  { key: "products",  label: "Products" },
  { key: "inventory", label: "Inventory" },
  { key: "charges",   label: "Service charges", href: "Vyonix Charge Types.html" },
  { key: "fba",       label: "FBA calculator" },
];
const PARTNERS_TABS = [
  { key: "suppliers", label: "Suppliers", href: "Vyonix Suppliers.html" },
  { key: "partners",  label: "Trading partners", href: "Vyonix Partners.html" },
];

function VyHeaderClocks() {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setTick(Date.now()), 30000); return () => clearInterval(i); }, []);
  const f = (tz) => { try { return new Date(tick).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  const zones = [["MAR", "Africa/Casablanca"], ["LA", "America/Los_Angeles"], ["CN", "Asia/Shanghai"]];
  return (
    <div className="vy-header-clocks" style={{ display: "flex", gap: 12, alignItems: "center", marginRight: 6 }}>
      {zones.map(([l, tz]) => (
        <span key={tz} style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", color: "hsl(var(--muted-fg))" }}>{l}</span>
          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", color: "hsl(var(--foreground))" }}>{f(tz)}</span>
        </span>
      ))}
    </div>
  );
}

function VyHeader({ onToggleMobileNav, onOpenSearch, onToggleTheme, isDark, onToggleActivity, workspaceName = "Operations", tabs = OPERATIONS_TABS, activeTab = "orders" }) {
  // Prefer the global command palette (global-search.jsx self-mounts and sets
  // window.vyOpenSearch); fall back to the page-supplied handler if absent.
  const openSearch = () => { if (typeof window.vyOpenSearch === "function") window.vyOpenSearch(); else if (onOpenSearch) onOpenSearch(); };
  return (
    <header className="vy-header">
      <button
        type="button"
        className="vy-hamburger"
        onClick={onToggleMobileNav}
        aria-label="Open navigation"
      >
        <VyIcon name="menu" size={18} />
      </button>

      <div className="vy-header-brand-mini">
        <span className="vy-brand-mark vy-brand-mark--sm">V</span>
        <div>
          <div className="vy-brand-name">{(typeof brandName==="function"?brandName():"Vyonix")}</div>
          <div className="vy-brand-sub">FBA Business Manager</div>
        </div>
      </div>

      <button type="button" className="vy-search" onClick={openSearch} aria-label="Open search">
        <VyIcon name="search" size={14} />
        <span className="vy-search-text">Search anything…</span>
        <kbd>⌘ K</kbd>
      </button>
      <button type="button" className="vy-icon-btn vy-search-icon" onClick={openSearch} aria-label="Open search">
        <VyIcon name="search" size={16} />
      </button>

      <div style={{ flex: 1, minWidth: 0 }} />

      <VyHeaderClocks />

      <button type="button" className="vy-icon-btn" onClick={onToggleActivity} aria-label="Open activity feed">
        <VyIcon name="bell" size={16} />
        <span className="vy-bell-dot" aria-hidden="true" />
      </button>

      <button type="button" className="vy-icon-btn" onClick={onToggleTheme} aria-label="Toggle theme">
        <VyIcon name={isDark ? "sun" : "moon"} size={16} />
      </button>

      <VyAvatarMenu />
    </header>
  );
}

function VyAvatarMenu() {
  const [open, setOpen] = React.useState(false);
  const me = (() => {
    try { const t = JSON.parse(localStorage.getItem("vy_team_v1") || "[]"); const m = (t || []).find((x) => x.you); if (m && m.name) return { name: m.name, email: m.email || "", initials: m.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() }; } catch (e) {}
    return { name: "Simo", email: "simo@vyonix.co", initials: "SI" };
  })();
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="vy-avatar" aria-label="Account menu" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>{me.initials}</button>
      {open ? (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
          <div className="vy-card" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 51, padding: 6, minWidth: 200, boxShadow: "var(--shadow-lg)" }}>
            <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid hsl(var(--border))", marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{me.name}</div>
              <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{me.email}</div>
            </div>
            <a href="Vyonix Settings.html" style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", fontSize: 13, borderRadius: 7, textDecoration: "none", color: "hsl(var(--foreground))" }}>
              <VyIcon name="settings" size={14} style={{ opacity: 0.7 }} /><span>Settings</span>
            </a>
            <a href="Vyonix Settings.html?section=integrations" style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", fontSize: 13, borderRadius: 7, textDecoration: "none", color: "hsl(var(--foreground))" }}>
              <VyIcon name="activity" size={14} style={{ opacity: 0.7 }} /><span>Integrations</span>
            </a>
            <a href="Vyonix Settings.html?section=team" style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", fontSize: 13, borderRadius: 7, textDecoration: "none", color: "hsl(var(--foreground))" }}>
              <VyIcon name="user" size={14} style={{ opacity: 0.7 }} /><span>Team &amp; roles</span>
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// MOBILE NAV — sheet wrapping VySidebar
// ----------------------------------------------------------------------
function VyMobileNav({ open, onClose, active }) {
  // Lock scroll while sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className={"vy-mobile-nav" + (open ? " is-open" : "")} aria-hidden={!open}>
      <div className="vy-mobile-nav-scrim" onClick={onClose} />
      <div className="vy-mobile-nav-panel" role="dialog" aria-label="Navigation">
        <div className="vy-mobile-nav-head">
          <span className="vy-brand">
            <span className="vy-brand-mark">V</span>
            <span className="vy-brand-text">
              <span className="vy-brand-name">{(typeof brandName==="function"?brandName():"Vyonix")}</span>
              <span className="vy-brand-sub">FBA Business Manager</span>
            </span>
          </span>
          <button type="button" className="vy-icon-btn" onClick={onClose} aria-label="Close navigation">
            <VyIcon name="x" size={16} />
          </button>
        </div>
        <VySidebar collapsed={false} mobile onNavigate={onClose} active={active} />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// EMPTY STATE — shared first-run / no-results block (used by list pages)
// ----------------------------------------------------------------------
// icon  : VyIcon name
// title : headline
// body   : supporting line
// actions: array of { label, icon?, onClick, primary?, href? }
// tone  : icon-chip accent var (default "muted-fg")
function VyEmptyState({ icon = "search", title, body, actions = [], tone = "muted-fg" }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
      gap: 12, padding: "56px 24px", border: "1px dashed hsl(var(--border))",
      borderRadius: 14, background: "hsl(var(--background) / 0.4)",
    }}>
      <span style={{
        width: 52, height: 52, borderRadius: 14, display: "grid", placeItems: "center",
        background: "hsl(var(--" + tone + ") / 0.12)", color: "hsl(var(--" + tone + "))",
      }}>
        <VyIcon name={icon} size={24} />
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxWidth: "46ch" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        {body ? <p style={{ fontSize: 13, color: "hsl(var(--muted-fg))", margin: 0, lineHeight: 1.5 }}>{body}</p> : null}
      </div>
      {actions.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 2 }}>
          {actions.map((a, i) => {
            const cls = "vy-btn " + (a.primary ? "vy-btn--primary" : "vy-btn--outline");
            const inner = <>{a.icon ? <VyIcon name={a.icon} size={14} /> : null}<span>{a.label}</span></>;
            return a.href
              ? <a key={i} className={cls} href={a.href}>{inner}</a>
              : <button key={i} type="button" className={cls} onClick={a.onClick}>{inner}</button>;
          })}
        </div>
      ) : null}
    </div>
  );
}

Object.assign(window, { VySidebar, VyHeader, VyMobileNav, VyEmptyState, VY_NAV_GROUPS, WORKSPACES, OPERATIONS_TABS, CATALOG_TABS, PARTNERS_TABS });
