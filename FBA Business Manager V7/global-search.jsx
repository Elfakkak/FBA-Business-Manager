// ----------------------------------------------------------------------
// GLOBAL SEARCH — ⌘K command palette ("Search anything")
// ----------------------------------------------------------------------
// Self-mounting: this script appends its own root to <body> and renders a
// command-palette overlay. No per-page React wiring is needed — every page
// just loads this script (after its data files + vy-icons) and the header's
// search button triggers it via window.vyOpenSearch() (see vy-shell.jsx).
//
// The index is built LAZILY each time the palette opens, FEATURE-DETECTING
// whichever data sources the current page happens to have loaded:
//   Orders     ← ordAllOrders()                    → Order Shell ?order=
//   Products   ← catLoadFamilies() / CAT_FAMILIES  → Product ?family= (+ SKUs)
//   Invoices   ← PAY_INVOICES                       → Order Shell ?order=#invoices
//   Suppliers  ← SUP_SUPPLIERS / supBuildDirectory  → Supplier ?supplier=
//   Partners   ← PARTNERS                           → Partner ?partner=
//   Shipments  ← logAllShipments() / LOG_SHIPMENTS  → Shipments ?q=
// Anything not present on the page is simply skipped — so it degrades cleanly.
// ----------------------------------------------------------------------

const { useState: useGsState, useEffect: useGsEffect, useRef: useGsRef, useMemo: useGsMemo } = React;

// Category metadata — icon + accent tone + how to build a deep link.
const GS_CATS = {
  command:  { label: "Tools",     icon: "calculator", tone: "brand" },
  order:    { label: "Orders",    icon: "cube",    tone: "primary" },
  product:  { label: "Products",  icon: "package", tone: "info" },
  invoice:  { label: "Invoices",  icon: "receipt", tone: "warning" },
  supplier: { label: "Suppliers", icon: "factory", tone: "info" },
  partner:  { label: "Partners",  icon: "user",    tone: "info" },
  shipment: { label: "Shipments", icon: "truck",   tone: "info" },
};
const GS_CAT_ORDER = ["command", "order", "product", "invoice", "supplier", "partner", "shipment"];

function gsHas(name) { return typeof window[name] !== "undefined" && window[name] != null; }
function gsFn(name) { return typeof window[name] === "function"; }

// ---- Build the searchable index from whatever data is on the page ----
function gsBuildIndex() {
  const items = [];
  const push = (cat, id, title, subtitle, href, hay, extra) =>
    items.push({ cat, id, title, subtitle, href, ...(extra || {}), hay: (hay || (title + " " + (subtitle || "") + " " + id)).toLowerCase() });

  // Tools / commands — actions, not records.
  push("command", "fba-calculator", "FBA calculator", "Margin, ROI & breakeven before you buy",
    "Vyonix FBA Calculator.html", "fba calculator margin roi profit breakeven sourcing fees referral landed cost should i buy",
    { action: "fba", icon: "calculator" });

  // Orders
  try {
    const orders = gsFn("ordAllOrders") ? window.ordAllOrders() : (gsHas("ORDERS_LIST") ? window.ORDERS_LIST : []);
    orders.forEach((o) => {
      const sub = [o.status, o.supplier, o.meta].filter(Boolean).join(" · ");
      push("order", o.id, o.title || o.id, sub, "Vyonix Order Shell.html?order=" + encodeURIComponent(o.id),
        [o.title, o.id, o.supplier, o.status, o.meta, o.route].filter(Boolean).join(" "));
    });
  } catch (e) {}

  // Products (families + their variant SKUs)
  try {
    const fams = gsFn("catLoadFamilies") ? window.catLoadFamilies() : (gsHas("CAT_FAMILIES") ? window.CAT_FAMILIES : []);
    fams.forEach((f) => {
      const title = f.parent || f.title || f.id;
      const vars = Array.isArray(f.variants) ? f.variants : [];
      const sub = [f.category, vars.length ? vars.length + " variant" + (vars.length === 1 ? "" : "s") : null, f.supplier && f.supplier !== "—" ? f.supplier : null].filter(Boolean).join(" · ");
      const skuHay = vars.map((v) => [v.sku, v.name, v.pack, v.asin, v.fnsku].filter(Boolean).join(" ")).join(" ");
      push("product", f.id, title, sub, "Vyonix Product.html?family=" + encodeURIComponent(f.id),
        [title, f.id, f.category, f.brand, f.supplier, skuHay].filter(Boolean).join(" "));
    });
  } catch (e) {}

  // Invoices
  try {
    const invs = gsHas("PAY_INVOICES") ? window.PAY_INVOICES : [];
    const bal = gsFn("payBalance") ? window.payBalance : (inv) => Math.max(0, (inv.total || 0) - (inv.paid || 0));
    invs.forEach((inv) => {
      const b = bal(inv);
      const money = "$" + (inv.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const sub = [inv.vendor, inv.vendorType, money + (b > 0.01 ? " · balance due" : " · paid"), inv.orderTitle].filter(Boolean).join(" · ");
      push("invoice", inv.id, inv.id, sub,
        "Vyonix Order Shell.html?order=" + encodeURIComponent(inv.orderId || "") + "#invoices",
        [inv.id, inv.vendor, inv.vendorType, inv.orderTitle, inv.orderId].filter(Boolean).join(" "));
    });
  } catch (e) {}

  // Suppliers
  try {
    let sups = [];
    if (gsHas("SUP_SUPPLIERS")) sups = window.SUP_SUPPLIERS;
    else if (gsFn("supBuildDirectory")) sups = window.supBuildDirectory();
    sups.forEach((s) => {
      const name = s.name || s.id;
      const sub = [s.origin, s.products != null ? s.products + " products" : null, s.orders != null ? s.orders + " orders" : null].filter(Boolean).join(" · ");
      push("supplier", name, name, sub, "Vyonix Supplier.html?supplier=" + encodeURIComponent(name),
        [name, s.origin, s.contact].filter(Boolean).join(" "));
    });
  } catch (e) {}

  // Partners
  try {
    let pars = [];
    if (gsHas("PARTNERS")) pars = window.PARTNERS;
    else if (gsFn("parBuildDirectory")) pars = window.parBuildDirectory();
    pars.forEach((p) => {
      const name = p.name || p.id;
      const sub = [p.type, p.specialty].filter(Boolean).join(" · ");
      push("partner", name, name, sub, "Vyonix Partner.html?partner=" + encodeURIComponent(name),
        [name, p.type, p.specialty].filter(Boolean).join(" "));
    });
  } catch (e) {}

  // Shipments
  try {
    let ships = [];
    if (gsFn("logAllShipments")) ships = window.logAllShipments();
    else if (gsHas("LOG_SHIPMENTS")) ships = window.LOG_SHIPMENTS;
    ships.forEach((s) => {
      const sub = [s.mode, s.forwarder, s.orderTitle, s.stage].filter(Boolean).join(" · ");
      push("shipment", s.id, s.id, sub, "Vyonix Shipments.html?q=" + encodeURIComponent(s.id),
        [s.id, s.mode, s.forwarder, s.orderTitle, s.route, s.bol].filter(Boolean).join(" "));
    });
  } catch (e) {}

  return items;
}

// Token-AND substring match + a light relevance score (id/title hits rank first).
function gsScore(item, tokens) {
  const hay = item.hay;
  for (let i = 0; i < tokens.length; i++) if (hay.indexOf(tokens[i]) === -1) return -1;
  let score = 0;
  const t = (item.title || "").toLowerCase();
  const id = (item.id || "").toLowerCase();
  tokens.forEach((tok) => {
    if (id === tok || t === tok) score += 100;
    if (t.startsWith(tok)) score += 40;
    if (id.indexOf(tok) === 0) score += 30;
    if (t.indexOf(tok) !== -1) score += 12;
  });
  return score;
}

function VyGlobalSearchApp() {
  const [open, setOpen] = useGsState(false);
  const [index, setIndex] = useGsState([]);
  const [q, setQ] = useGsState("");
  const [active, setActive] = useGsState(0);
  const inputRef = useGsRef(null);
  const listRef = useGsRef(null);

  // Expose the imperative opener + open/close on event & ⌘K.
  useGsEffect(() => {
    window.vyOpenSearch = () => setOpen(true);
    function onOpenEvt() { setOpen(true); }
    function onKey(e) {
      const k = (e.key || "").toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") { e.preventDefault(); setOpen((v) => !v); }
    }
    window.addEventListener("vy-open-search", onOpenEvt);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("vy-open-search", onOpenEvt);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Build the index fresh on each open (data may have changed); reset query.
  useGsEffect(() => {
    if (open) {
      setIndex(gsBuildIndex());
      setQ("");
      setActive(0);
      const id = setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 30);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Results: grouped by category, capped per group, with empty-query suggestions.
  const { groups, flat } = useGsMemo(() => {
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let pool;
    if (!tokens.length) {
      // Suggestions: a few items from each available category.
      pool = index.map((it) => ({ it, score: 0 }));
    } else {
      pool = [];
      index.forEach((it) => { const sc = gsScore(it, tokens); if (sc >= 0) pool.push({ it, score: sc }); });
      pool.sort((a, b) => b.score - a.score);
    }
    const perCat = tokens.length ? 6 : 3;
    const byCat = {};
    pool.forEach(({ it }) => { (byCat[it.cat] = byCat[it.cat] || []).push(it); });
    const groups = [];
    const flat = [];
    GS_CAT_ORDER.forEach((cat) => {
      const arr = (byCat[cat] || []).slice(0, perCat);
      if (arr.length) {
        groups.push({ cat, items: arr });
        arr.forEach((it) => flat.push(it));
      }
    });
    return { groups, flat };
  }, [q, index]);

  // Clamp active when results change.
  useGsEffect(() => { setActive((a) => Math.min(Math.max(0, a), Math.max(0, flat.length - 1))); }, [flat.length]);

  // Keep the active row visible without scrollIntoView.
  useGsEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector('[data-gs-idx="' + active + '"]');
    if (!el) return;
    const top = el.offsetTop, bottom = top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 8;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 8;
  }, [active, flat.length]);

  function go(item) {
    if (!item) return;
    setOpen(false);
    // Action commands run in-page when their handler is loaded; else fall back to the href.
    if (item.action === "fba" && typeof window.vyOpenFbaCalc === "function") { window.vyOpenFbaCalc(); return; }
    window.location.href = item.href;
  }

  function onKeyDown(e) {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(flat[active]); }
  }

  if (!open) return null;

  let runningIdx = -1;

  return (
    <div className="vgs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="vgs-panel" role="dialog" aria-label="Search">
        <div className="vgs-search">
          <VyIcon name="search" size={17} />
          <input
            ref={inputRef}
            className="vgs-input"
            placeholder="Search orders, products, invoices…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="vgs-kbd">Esc</kbd>
        </div>

        <div className="vgs-results" ref={listRef}>
          {flat.length === 0 ? (
            <div className="vgs-empty">
              <VyIcon name="search" size={22} />
              <div className="vgs-empty-title">{q.trim() ? "No matches" : "Nothing to search yet"}</div>
              <div className="vgs-empty-sub">
                {q.trim() ? "Try an order name, SKU, vendor, or ID." : "Type to search across orders, products and invoices."}
              </div>
            </div>
          ) : (
            groups.map((grp) => {
              const meta = GS_CATS[grp.cat];
              return (
                <div className="vgs-group" key={grp.cat}>
                  <div className="vgs-group-head">{meta.label}</div>
                  {grp.items.map((it) => {
                    runningIdx += 1;
                    const idx = runningIdx;
                    const isActive = idx === active;
                    return (
                      <button
                        type="button"
                        key={it.cat + ":" + it.id}
                        data-gs-idx={idx}
                        className={"vgs-row" + (isActive ? " vgs-row--active" : "")}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(it)}
                      >
                        <span className={"vgs-ic vgs-ic--" + meta.tone}>
                          <VyIcon name={meta.icon} size={15} />
                        </span>
                        <span className="vgs-row-text">
                          <span className="vgs-row-title">{it.title}</span>
                          {it.subtitle ? <span className="vgs-row-sub">{it.subtitle}</span> : null}
                        </span>
                        <span className="vgs-row-id">{it.id !== it.title ? it.id : ""}</span>
                        <span className="vgs-row-go"><VyIcon name="arrowRight" size={14} /></span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="vgs-foot">
          <span className="vgs-foot-hint"><kbd className="vgs-kbd">↑</kbd><kbd className="vgs-kbd">↓</kbd> navigate</span>
          <span className="vgs-foot-hint"><kbd className="vgs-kbd">↵</kbd> open</span>
          <span style={{ flex: 1 }} />
          <span className="vgs-foot-hint">{flat.length} result{flat.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}

// ---- Self-mount ----
(function gsMount() {
  function mount() {
    if (document.getElementById("vy-global-search-root")) return;
    const root = document.createElement("div");
    root.id = "vy-global-search-root";
    document.body.appendChild(root);
    ReactDOM.createRoot(root).render(<VyGlobalSearchApp />);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

Object.assign(window, { VyGlobalSearchApp });
