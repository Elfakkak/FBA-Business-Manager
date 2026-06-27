// Vyonix Order Shell — main App. Composes shell + order shell + overlays.

const { useState: useAppState, useEffect: useAppEffect, useRef: useAppRef } = React;

function VyApp() {
  // Persisted theme.
  const [isDark, setIsDark] = useAppState(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem("vy:theme");
      if (stored === "dark") return true;
      if (stored === "light") return false;
    } catch {}
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useAppEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try { localStorage.setItem("vy:theme", isDark ? "dark" : "light"); } catch {}
  }, [isDark]);

  // Active order sub-page. URL hash (#shipping) wins, then saved page, else home.
  const [activePage, setActivePage] = useAppState(() => {
    try {
      const hash = (window.location.hash || "").replace("#", "");
      if (hash && PAGE_DEFS.some((p) => p.key === hash)) return hash;
      const stored = localStorage.getItem("vy:page");
      if (stored && PAGE_DEFS.some((p) => p.key === stored)) return stored;
    } catch {}
    return "home";
  });
  useAppEffect(() => {
    try { localStorage.setItem("vy:page", activePage); } catch {}
  }, [activePage]);

  // Hash-driven navigation: #invoices etc. switch sections live (e.g. the
  // Shipping "Open in Invoices" link), keeping deep-links consistent.
  useAppEffect(() => {
    function onHash() {
      const h = (window.location.hash || "").replace("#", "");
      if (h && PAGE_DEFS.some((p) => p.key === h)) setActivePage(h);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Sidebar collapsed (desktop only).
  const [collapsed, setCollapsed] = useAppState(() => {
    try { return localStorage.getItem("vy:sidebar") === "collapsed"; } catch { return false; }
  });
  useAppEffect(() => {
    try { localStorage.setItem("vy:sidebar", collapsed ? "collapsed" : "expanded"); } catch {}
  }, [collapsed]);

  // Mobile nav open
  const [mobileNavOpen, setMobileNavOpen] = useAppState(false);

  // Per-order "inspection required" flag — when off, the Inspection tab is
  // hidden for this order (some trusted suppliers don't need inspection).
  const orderId = (window.VY_CURRENT_ORDER && window.VY_CURRENT_ORDER.id) || null;
  const [inspectionRequired, setInspectionRequired] = useAppState(() =>
    typeof ordInspectionRequired === "function" ? ordInspectionRequired(orderId) : true
  );
  const visiblePages = PAGE_DEFS.filter((p) => p.key !== "inspection" || inspectionRequired);
  function toggleInspectionRequired() {
    const next = !inspectionRequired;
    setInspectionRequired(next);
    if (typeof ordSetInspectionRequired === "function") ordSetInspectionRequired(orderId, next);
    if (!next && activePage === "inspection") jumpToPage("home");
    if (typeof vyFlashStatus === "function") vyFlashStatus(next ? "Inspection enabled for this order" : "Inspection skipped — not required for this order");
  }

  // Overlay state
  const [drawerOpen, setDrawerOpen] = useAppState(false);
  const [sheetKey, setSheetKey] = useAppState(null);
  const [dialogKey, setDialogKey] = useAppState(null);
  const [moreOpen, setMoreOpen] = useAppState(false);
  const [editOpen, setEditOpen] = useAppState(() => {
    try { return new URLSearchParams(location.search).get("edit") === "1"; } catch (e) { return false; }
  });
  const [moreAnchor, setMoreAnchor] = useAppState(null); // {top,right} from the ⋯ trigger rect
  function openMoreFrom(el) {
    if (el && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      setMoreAnchor({ top: Math.round(r.bottom + 6), right: Math.round(window.innerWidth - r.right) });
    } else {
      setMoreAnchor(null);
    }
    setMoreOpen(true);
  }

  // Tweaks (curated)
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply tweak side-effects:
  useAppEffect(() => {
    document.documentElement.style.setProperty("--max-content", t.contentWidth + "px");
  }, [t.contentWidth]);
  useAppEffect(() => {
    // primary hue tweak — override --primary HSL hue, keep S/L
    if (t.primary === "default") {
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--ring");
    } else {
      document.documentElement.style.setProperty("--primary", t.primary);
      document.documentElement.style.setProperty("--ring", t.primary);
    }
  }, [t.primary]);
  useAppEffect(() => {
    // Density: tighten card padding / row padding via root vars
    document.documentElement.style.setProperty(
      "--content-pad",
      t.density === "compact" ? "16px" : t.density === "comfy" ? "32px" : "24px"
    );
  }, [t.density]);

  // Sync theme tweak <-> isDark
  useAppEffect(() => {
    if (typeof t.dark === "boolean" && t.dark !== isDark) setIsDark(t.dark);
  }, [t.dark]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    setTweak("dark", next);
  }

  function jumpToPage(key) {
    // All sections navigate smoothly in-app (no full-page reload)
    setActivePage(key);
    // Scroll to top on page change
    const scroller = document.querySelector(".vy-content");
    if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
  }

  // If inspection is turned off while we're on that tab (or a stale hash/saved
  // page points at it), fall back to Home so we never render a hidden section.
  useAppEffect(() => {
    if (!inspectionRequired && activePage === "inspection") jumpToPage("home");
  }, [inspectionRequired, activePage]);

  // Render the active page body
  function renderPage() {
    if (activePage === "home") {
      return (
        <VyOrderHome
          key="home"
          onJump={jumpToPage}
          onOpenActivity={() => setDrawerOpen(true)}
          onOpenMore={openMoreFrom}
          onEditOrder={() => setEditOpen(true)}
        />
      );
    }
    if (activePage === "production") {
      // Full Production section, embedded chrome-less inside the shell
      return (
        <div className="vy-page-body" key="production">
          <VyProductionBody />
        </div>
      );
    }
    if (activePage === "shipping") {
      // Full Shipping section, embedded chrome-less inside the shell
      return (
        <div className="vy-page-body" key="shipping">
          <VyShippingBody />
        </div>
      );
    }
    if (activePage === "invoices") {
      // Full Invoices section, embedded chrome-less inside the shell
      return (
        <div className="vy-page-body" key="invoices">
          <VyInvoicesBody />
        </div>
      );
    }
    if (activePage === "inspection") {
      // Full Inspection section, embedded chrome-less inside the shell
      return (
        <div className="vy-page-body" key="inspection">
          <VyInspectionBody />
        </div>
      );
    }
    if (activePage === "closeout") {
      // Full Closeout section, embedded chrome-less inside the shell
      return (
        <div className="vy-page-body" key="closeout">
          <VyCloseoutBody />
        </div>
      );
    }
    return (
      <VyPagePlaceholder
        key={activePage}
        pageKey={activePage}
        onOpenSheet={(k) => setSheetKey(k)}
        onOpenDialog={(k) => setDialogKey(k)}
      />
    );
  }

  return (
    <div className="vy-app">
      <VySidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />

      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="vy-app-main">
        <VyHeader
          onToggleMobileNav={() => setMobileNavOpen((v) => !v)}
          onOpenSearch={() => { /* placeholder search */ }}
          onToggleTheme={toggleTheme}
          isDark={isDark}
          onToggleActivity={() => setDrawerOpen(true)}
        />
        <main className="vy-content">
          <div className="vy-content-inner">
            <div className="vy-order-shell-head">
              <VyBreadcrumb activeKey={activePage} pages={visiblePages} />
              <VyPageSwitcher active={activePage} onChange={jumpToPage} pages={visiblePages} />
            </div>
            {renderPage()}
          </div>
        </main>
      </div>

      {/* Overlays */}
      <VyActivityDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <VySheet sheetKey={sheetKey} onClose={() => setSheetKey(null)} />
      <VyDialog dialogKey={dialogKey} onClose={() => setDialogKey(null)} />

      {/* More menu — anchored directly under the ⋯ trigger button */}
      {moreOpen ? (
        <div className="vy-more-anchor" style={{ position: "fixed", top: (moreAnchor ? moreAnchor.top : 116), right: (moreAnchor ? moreAnchor.right : 40), zIndex: 50 }}>
          <VyMoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} inspectionRequired={inspectionRequired} onToggleInspection={toggleInspectionRequired} onEditOrder={() => { setMoreOpen(false); setEditOpen(true); }} />
        </div>
      ) : null}

      {typeof VyEditOrderDrawer === "function" ? (
        <VyEditOrderDrawer open={editOpen} onClose={() => setEditOpen(false)} />
      ) : null}

      {/* Tweaks panel */}
      <TweaksPanel>
        <TweakSection label="Identity" />
        <TweakColor
          label="Primary"
          value={t.primary}
          options={["default", "210 90% 52%", "162 75% 38%", "275 75% 58%", "346 85% 55%"]}
          onChange={(v) => setTweak("primary", v)}
        />
        <TweakRadio
          label="Theme"
          value={t.dark ? "Dark" : "Light"}
          options={["Light", "Dark"]}
          onChange={(v) => { setTweak("dark", v === "Dark"); }}
        />

        <TweakSection label="Layout" />
        <TweakSlider
          label="Content width"
          value={t.contentWidth}
          min={1100}
          max={1600}
          step={20}
          unit="px"
          onChange={(v) => setTweak("contentWidth", v)}
        />
        <TweakRadio
          label="Density"
          value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)}
        />

        <TweakSection label="Navigation" />
        <TweakToggle
          label="Collapse sidebar"
          value={collapsed}
          onChange={(v) => setCollapsed(v)}
        />
        <TweakSelect
          label="Jump to page"
          value={activePage}
          options={PAGE_DEFS.map((p) => p.key)}
          onChange={(v) => jumpToPage(v)}
        />

        <TweakSection label="Open overlay" />
        <TweakButton onClick={() => setDrawerOpen(true)}>Open Activity drawer</TweakButton>
        <TweakButton onClick={() => setSheetKey("add-product")}>Open Add-product sheet</TweakButton>
        <TweakButton onClick={() => setSheetKey("schedule-inspection")}>Open Schedule-inspection</TweakButton>
        <TweakButton onClick={() => setDialogKey("finalize-closeout")}>Open Finalize-closeout dialog</TweakButton>
      </TweaksPanel>
    </div>
  );
}

// Defaults wrapped in EDITMODE markers so the host can persist tweak changes
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primary": "default",
  "dark": false,
  "contentWidth": 1440,
  "density": "regular"
}/*EDITMODE-END*/;

ReactDOM.createRoot(document.getElementById("vy-root")).render(<VyApp />);
