// Vyonix Catalog — Products list page. Route: /catalog/products
// Calm, browse-and-filter view: one row per product family, opens the Product
// detail page. Reuses the app chrome (sidebar active=Products, Catalog header).

const { useState: useCatState, useEffect: useCatEffect } = React;

// Striped image placeholder — real product shots drop in on the Product page.
function CatThumb({ size = 52 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: "repeating-linear-gradient(135deg, hsl(var(--muted-bg)) 0 6px, hsl(var(--background) / 0.6) 6px 12px)",
      border: "1px solid hsl(var(--border))", display: "grid", placeItems: "center",
      color: "hsl(var(--muted-fg))",
    }}>
      <VyIcon name="package" size={18} style={{ opacity: 0.55 }} />
    </div>
  );
}

function money(n) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ----------------------------------------------------------------------
// KPI strip (calm, 4 across)
// ----------------------------------------------------------------------
function CatalogKpis({ list }) {
  const data = list || CAT_FAMILIES;
  const families = data.length;
  const skus = data.reduce((n, f) => n + f.variants.length, 0);
  let reorder = 0, gaps = 0;
  data.forEach((f) => {
    const s = catFamilyStats(f);
    if (s.health === "Reorder") reorder++;
    if (s.health === "Data gap") gaps++;
  });
  const items = [
    { icon: "catalog", label: "Products", value: String(families), sub: "families" },
    { icon: "package", label: "Variants", value: String(skus), sub: "active SKUs" },
    { icon: "alert", label: "Reorder", value: String(reorder), sub: reorder === 1 ? "family low" : "families low", tone: reorder ? "warning" : undefined },
    { icon: "info", label: "Data gaps", value: String(gaps), sub: "need attention", tone: gaps ? "danger" : undefined },
  ];
  return (
    <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
      {items.map((it) => (
        <div className={"vy-card vy-kpi" + (it.tone ? " vy-kpi--" + it.tone : "")} key={it.label}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <VyIcon name={it.icon} size={14} style={{ opacity: 0.7 }} />
            <span className="vy-kicker">{it.label}</span>
          </div>
          <div className="vy-kpi-value" style={{ fontSize: 18 }}>{it.value}</div>
          <div className="vy-kpi-sub">{it.sub}</div>
        </div>
      ))}
    </div>
  );
}

const catInputStyle = {
  height: 38, padding: "0 12px", fontSize: 13,
  border: "1px solid hsl(var(--input))", borderRadius: 8,
  background: "hsl(var(--background))", color: "hsl(var(--foreground))",
};

// ----------------------------------------------------------------------
// One family row
// ----------------------------------------------------------------------
// Two click targets per row: the TITLE opens the full Product page; clicking
// anywhere else on the row opens the quick-view peek drawer.
const catTh = { textAlign: "left", padding: "10px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", whiteSpace: "nowrap" };
const catTd = { padding: "12px 16px", fontSize: 12.5, color: "hsl(var(--foreground))", verticalAlign: "middle" };

function CatFamilyRow({ family, onPeek, onOpenProduct, isFav, onToggleFav }) {
  const s = catFamilyStats(family);
  const lowStock = s.stock <= CAT_LOW_STOCK * Math.max(1, Math.round(s.skuCount / 2));
  const costLabel = s.minCost === s.maxCost ? money(s.minCost) : money(s.minCost) + "–" + money(s.maxCost);
  return (
    <tr className="vy-order-row" onClick={() => onPeek(family.id)} style={{ borderTop: "1px solid hsl(var(--border) / 0.7)", cursor: "pointer" }}>
      <td style={{ ...catTd, paddingRight: 0, width: 30 }} onClick={(e) => { e.stopPropagation(); onToggleFav(family.id); }}>
        <button type="button" aria-label={isFav ? "Unfavorite" : "Favorite"} title={isFav ? "Remove from favorites" : "Add to favorites"} onClick={(e) => { e.stopPropagation(); onToggleFav(family.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: isFav ? "hsl(45 90% 48%)" : "hsl(var(--muted-fg) / 0.5)", display: "grid", placeItems: "center" }}>
          <VyIcon name="star" size={15} style={{ fill: isFav ? "currentColor" : "none" }} />
        </button>
      </td>
      <td style={catTd}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <image-slot id={"prod-" + family.id + "-1"} style={{ width: "30px", height: "30px", flexShrink: 0 }} shape="rounded" radius="7" placeholder={family.parent}></image-slot>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="vy-cat-title" onClick={(e) => { e.stopPropagation(); onOpenProduct(family.id); }} title="Open product page" style={{ background: "none", border: "none", padding: 0, margin: 0, font: "inherit", fontSize: 13, fontWeight: 700, color: "inherit", cursor: "pointer", textAlign: "left" }}>
                {family.parent}{family.color ? " · " + family.color : ""}
              </button>
              <span className={"vy-badge vy-badge--" + CAT_HEALTH_TONE[s.health]}>{s.health}</span>
              {family.isNew ? <span className="vy-badge vy-badge--info">New</span> : null}
            </div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 2 }}>
              {family.category} · {s.skuCount} {s.skuCount === 1 ? "variant" : "variants"} · {family.supplier} · last ordered {family.lastOrdered}
            </div>
          </div>
        </div>
      </td>
      <td style={{ ...catTd, textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", color: lowStock ? "hsl(var(--warning))" : undefined }}>{s.stock.toLocaleString()}</div>
        <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>FBA units{s.inbound ? " · " + s.inbound + " inbound" : ""}</div>
      </td>
      <td style={{ ...catTd, textAlign: "right" }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{costLabel}</div>
        <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>last unit cost</div>
      </td>
      <td style={{ ...catTd, width: 20, textAlign: "right", paddingLeft: 0 }}>
        <VyIcon name="chevronRight" size={15} style={{ opacity: 0.45 }} />
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------
// Product peek drawer — quick preview from the catalog list (preview + Open),
// mirrors the Orders peek drawer. Full editing stays on the Product page.
// ----------------------------------------------------------------------
function CatPeekDrawer({ family, onClose, onOpen }) {
  const [shown, setShown] = useCatState(false);
  useCatEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(r); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  if (!family) return null;
  const s = catFamilyStats(family);
  const mono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
  const costLabel = s.minCost === s.maxCost ? money(s.minCost) : money(s.minCost) + "–" + money(s.maxCost);
  const linked = family.variants.filter((v) => v.asin && v.asin !== "Pending sync").length;

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.4)", opacity: shown ? 1 : 0, transition: "opacity 200ms ease" }}></div>
      <aside style={{ position: "absolute", top: 0, right: 0, height: "100%", width: "min(420px, 94vw)", background: "hsl(var(--card))", borderLeft: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", transform: shown ? "translateX(0)" : "translateX(100%)", transition: "transform 240ms cubic-bezier(0.32,0.72,0,1)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid hsl(var(--border))", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <image-slot id={"prod-" + family.id + "-1"} style={{ width: "52px", height: "52px", flexShrink: 0 }} shape="rounded" radius="10" placeholder={family.parent}></image-slot>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{family.parent}{family.color ? " · " + family.color : ""}</div>
            <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{family.category} · {family.supplier}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
              <span className={"vy-badge vy-badge--" + CAT_HEALTH_TONE[s.health]}>{s.health}</span>
              {linked === family.variants.length
                ? <span className="vy-badge vy-badge--success">Linked</span>
                : <span className="vy-badge vy-badge--warning">{linked}/{family.variants.length} linked</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))", flexShrink: 0 }}><VyIcon name="x" size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Quick stats */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <div style={{ flex: "1 1 90px" }}>
              <div className="vy-kicker" style={{ marginBottom: 3 }}>Variants</div>
              <div style={{ ...mono, fontSize: 16, fontWeight: 700 }}>{s.skuCount}</div>
            </div>
            <div style={{ flex: "1 1 90px" }}>
              <div className="vy-kicker" style={{ marginBottom: 3 }}>Unit cost</div>
              <div style={{ ...mono, fontSize: 16, fontWeight: 700 }}>{costLabel}</div>
            </div>
            <div style={{ flex: "1 1 90px" }}>
              <div className="vy-kicker" style={{ marginBottom: 3 }}>Lead time</div>
              <div style={{ ...mono, fontSize: 16, fontWeight: 700 }}>{family.leadTimeDays}d</div>
            </div>
          </div>

          {/* Inventory connection — stock links to the Inventory page */}
          <a href={"Vyonix Inventory.html?q=" + encodeURIComponent(family.parent)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--background) / 0.5)", textDecoration: "none", color: "inherit" }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="boxes" size={15} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...mono, fontSize: 15, fontWeight: 700, color: s.stock <= CAT_LOW_STOCK ? "hsl(var(--warning))" : undefined }}>{s.stock.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 500, fontFamily: "inherit", color: "hsl(var(--muted-fg))" }}>FBA units{s.inbound ? " · " + s.inbound + " inbound" : ""}</span></div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>View in Inventory</div>
            </div>
            <VyIcon name="arrowUpRight" size={14} style={{ opacity: 0.5 }} />
          </a>

          {/* Variant list (preview) */}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>SKUs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {family.variants.map((v) => (
                <div key={v.sku} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", border: "1px solid hsl(var(--border))", borderRadius: 9, background: "hsl(var(--background) / 0.4)" }}>
                  <span style={{ ...mono, fontSize: 11.5, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.sku}</span>
                  <span style={{ ...mono, fontSize: 11.5, color: s.minCost != null && v.fbaStock <= CAT_LOW_STOCK ? "hsl(var(--warning))" : "hsl(var(--muted-fg))" }}>{v.fbaStock} u</span>
                  <span className={"vy-badge vy-badge--" + (CAT_HEALTH_TONE[v.status] || "muted")} style={{ flexShrink: 0 }}>{v.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--primary" onClick={() => onOpen(family.id)} style={{ flex: 1, justifyContent: "center" }}>
            <span>Open product</span><VyIcon name="arrowRight" size={14} />
          </button>
          <button type="button" className="vy-btn vy-btn--outline" onClick={onClose}>Close</button>
        </div>
      </aside>
    </div>,
    document.body
  );
}

// ----------------------------------------------------------------------
// New product modal
// ----------------------------------------------------------------------
function CatModalShell({ title, sub, onClose, children, footer, width = 620 }) {
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: width, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
            {sub ? <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0", maxWidth: "52ch" }}>{sub}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 24px", overflowY: "auto" }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>{footer}</div>
      </div>
    </div>,
    document.body
  );
}

function CatFormField({ label, children, half, note }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: half ? "1 1 calc(50% - 7px)" : "1 1 100%", minWidth: 0 }}>
      <span className="vy-kicker">{label}</span>
      {children}
      {note ? <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{note}</span> : null}
    </label>
  );
}

function CatCategoriesModal({ onClose, families }) {
  const [tick, setTick] = useCatState(0);
  const [adding, setAdding] = useCatState("");
  const [editId, setEditId] = useCatState(null);
  const [editVal, setEditVal] = useCatState("");

  const counts = {};
  families.forEach((f) => { const c = (f.category || "Uncategorized").trim(); counts[c] = (counts[c] || 0) + 1; });
  let extra = [];
  try { extra = JSON.parse(localStorage.getItem("vy_categories_extra_v1") || "[]"); } catch (e) {}
  extra.forEach((c) => { if (!(c in counts)) counts[c] = 0; });
  const cats = Object.keys(counts).sort((a, b) => a.localeCompare(b));
  const saveExtra = (list) => { try { localStorage.setItem("vy_categories_extra_v1", JSON.stringify(list)); } catch (e) {} };

  function addCategory() {
    const name = adding.trim();
    if (!name || cats.some((c) => c.toLowerCase() === name.toLowerCase())) { setAdding(""); return; }
    saveExtra([...extra, name]); setAdding(""); setTick((n) => n + 1);
  }
  function rename(oldName) {
    const name = editVal.trim(); setEditId(null);
    if (!name || name === oldName) return;
    families.forEach((f) => { if ((f.category || "Uncategorized").trim() === oldName && typeof catUpdateFamily === "function") catUpdateFamily(f.id, { category: name }); });
    saveExtra(extra.map((c) => (c === oldName ? name : c)).filter((c, i, a) => a.indexOf(c) === i));
    setTick((n) => n + 1);
  }
  function removeEmpty(name) { if (counts[name] > 0) return; saveExtra(extra.filter((c) => c !== name)); setTick((n) => n + 1); }

  const input = { height: 34, padding: "0 10px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

  return (
    <CatModalShell title="Categories" sub="Your own product taxonomy (separate from Amazon's). Renaming updates every product using it; in-use categories can't be deleted." onClose={onClose} width={460}
      footer={<button type="button" className="vy-btn vy-btn--primary" onClick={onClose}>Done</button>}>
      <div style={{ display: "flex", flexDirection: "column", border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden" }}>
        {cats.map((c, i) => (
          <div key={c} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i > 0 ? "1px solid hsl(var(--border) / 0.6)" : "none" }}>
            {editId === c ? (
              <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") rename(c); if (e.key === "Escape") setEditId(null); }} style={{ ...input, flex: 1 }} />
            ) : (
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{c}</span>
            )}
            <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))", fontFamily: "var(--font-mono, monospace)" }}>{counts[c]}</span>
            {editId === c ? (
              <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" style={{ fontSize: 11 }} onClick={() => rename(c)}>Save</button>
            ) : (
              <>
                <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ fontSize: 11 }} onClick={() => { setEditId(c); setEditVal(c); }}><VyIcon name="pencil" size={12} /></button>
                {counts[c] === 0 ? <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ fontSize: 11, color: "hsl(0 72% 51%)" }} onClick={() => removeEmpty(c)}><VyIcon name="x" size={12} /></button> : null}
              </>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }} placeholder="New category name…" style={{ ...input, flex: 1 }} />
        <button type="button" className="vy-btn vy-btn--outline" disabled={!adding.trim()} style={adding.trim() ? undefined : { opacity: 0.5 }} onClick={addCategory}><VyIcon name="plus" size={13} /><span>Add</span></button>
      </div>
    </CatModalShell>
  );
}

function CatNewProductModal({ onClose, onCreate, categories, suppliers }) {
  const [form, setForm] = useCatState({ parent: "", category: "", newCategory: "", supplier: "", leadTimeDays: 30, moq: 200 });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const valid = form.parent.trim();

  function submit() {
    const family = {
      id: "new-" + Date.now(),
      parent: form.parent.trim(),
      color: null,
      category: (form.category === "__new" ? (form.newCategory || "").trim() : form.category.trim()) || "Uncategorized",
      brand: CAT_BRAND,
      material: "—",
      supplier: (form.supplier === "__new" ? (form.newSupplier || "").trim() : form.supplier.trim()) || "—",
      supplierRoute: "Direct supplier",
      leadTimeDays: Number(form.leadTimeDays) || 30,
      moq: Number(form.moq) || 0,
      lastOrdered: "—",
      dims: "—",
      weightLbs: 0,
      images: [],
      badges: ["New"],
      isNew: true,
      costHistory: [],
      orderHistory: [],
      variants: [],
    };
    onCreate(family);
  }

  return (
    <CatModalShell
      title="New product"
      sub={"Name it, pick a category and the usual supplier. You'll add SKUs and details next."}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={submit}>
            <VyIcon name="plus" size={14} /><span>Create product</span>
          </button>
        </>
      }
    >
      <datalist id="cat-suppliers">{suppliers.filter((s) => s !== "All").map((s) => <option key={s} value={s} />)}</datalist>


      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <CatFormField label="Product name" half>
          <input className="vy-input" style={{ ...catInputStyle, width: "100%" }} value={form.parent} onChange={set("parent")} placeholder="e.g. Beaded seat cover" />
        </CatFormField>
        <CatFormField label="Category" half>
          <select className="vy-input" style={{ ...catInputStyle, width: "100%" }} value={form.category} onChange={set("category")}>
            <option value="">Select a category…</option>
            {categories.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__new">+ Add new category…</option>
          </select>
        </CatFormField>
        {form.category === "__new" ? (
          <CatFormField label="New category name" half>
            <input className="vy-input" style={{ ...catInputStyle, width: "100%" }} value={form.newCategory || ""} onChange={set("newCategory")} placeholder="e.g. Sunshades" autoFocus />
          </CatFormField>
        ) : null}
        <CatFormField label="Primary supplier (optional)" half note="Can vary per order — set the usual source.">
          <select className="vy-input" style={{ ...catInputStyle, width: "100%" }} value={form.supplier} onChange={set("supplier")}>
            <option value="">Select a supplier…</option>
            {suppliers.filter((s) => s !== "All").map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="__new">+ Add new supplier…</option>
          </select>
        </CatFormField>
        {form.supplier === "__new" ? (
          <CatFormField label="New supplier name" half>
            <input className="vy-input" style={{ ...catInputStyle, width: "100%" }} value={form.newSupplier || ""} onChange={set("newSupplier")} placeholder="e.g. Sheng Te Long" autoFocus />
          </CatFormField>
        ) : null}
      </div>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 10, background: "hsl(var(--accent) / 0.5)" }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="package" size={14} /></span>
        <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", lineHeight: 1.45 }}>
          Brand is <strong style={{ color: "hsl(var(--foreground))" }}>{CAT_BRAND}</strong> (your private label). SKUs, costs, dimensions, lead time &amp; MOQ are set on the product after.
        </div>
      </div>
    </CatModalShell>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
function CatalogListPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useCatState(false);
  const [mobileNavOpen, setMobileNavOpen] = useCatState(false);
  const [isDark, setIsDark] = useCatState(false);
  const [query, setQuery] = useCatState("");
  const [category, setCategory] = useCatState("All");
  const [supplier, setSupplier] = useCatState("All");
  const [health, setHealth] = useCatState("All");
  const [families, setFamilies] = useCatState(catLoadFamilies);
  const [showNew, setShowNew] = useCatState(false);
  const [showCats, setShowCats] = useCatState(false);
  const [peekId, setPeekId] = useCatState(null);
  const [favTick, setFavTick] = useCatState(0);
  const [favOnly, setFavOnly] = useCatState(false);
  function toggleFav(id) { catToggleFav(id); setFavTick((t) => t + 1); }

  useCatEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  function openProduct(id) {
    window.location.href = "Vyonix Product.html?family=" + encodeURIComponent(id);
  }
  function handleCreate(family) {
    setFamilies((prev) => {
      const next = [family, ...prev];
      catSaveFamilies(next);
      return next;
    });
    setShowNew(false);
    // Clear filters so the new product is guaranteed visible at the top.
    setQuery(""); setCategory("All"); setSupplier("All"); setHealth("All");
  }

  const categories = ["All", ...[...new Set(families.map((f) => f.category))]];
  const suppliers = ["All", ...[...new Set(families.map((f) => f.supplier))]];

  const filtered = families.filter((f) => {
    if (category !== "All" && f.category !== category) return false;
    if (supplier !== "All" && f.supplier !== supplier) return false;
    if (health !== "All" && catFamilyStats(f).health !== health) return false;
    if (favOnly && !catIsFav(f.id)) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = [f.parent, f.color, f.category, f.supplier, f.brand,
        ...f.variants.flatMap((v) => [v.sku, v.fnsku, v.asin])].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  // Favorites float to the top (stable within each group).
  const favCount = families.filter((f) => catIsFav(f.id)).length;
  filtered.sort((a, b) => (catIsFav(b.id) ? 1 : 0) - (catIsFav(a.id) ? 1 : 0));

  const healthChips = ["All", "Reorder", "Data gap"];

  return (
    <div className="vy-app">
      <VySidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNavigate={() => setMobileNavOpen(false)}
        active="Products"
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
          activeTab="products"
        />

        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Page header */}
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Catalog</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>Products</h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0" }}>
                  Every product family you buy and sell. Open one to see variants, costs, Amazon identity, and order history.
                </p>
              </div>
              <div className="vy-page-head-actions" style={{ marginLeft: "auto" }}>
                <button type="button" className="vy-btn vy-btn--ghost" onClick={() => {}}>
                  <VyIcon name="arrowUpRight" size={14} /><span>Export</span>
                </button>
                <button type="button" className="vy-btn vy-btn--primary" onClick={() => setShowNew(true)}>
                  <VyIcon name="plus" size={14} /><span>New product</span>
                </button>
              </div>
            </div>

            <CatalogKpis list={families} />

            {/* Filter bar */}
            <div className="vy-card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ position: "relative", flex: "1 1 300px", minWidth: 0 }}>
                  <VyIcon name="search" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-fg))" }} />
                  <input
                    type="text"
                    className="vy-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search product, SKU, FNSKU, ASIN, supplier"
                    style={{ ...catInputStyle, width: "100%", paddingLeft: 34 }}
                  />
                </div>
                <select className="vy-input" style={{ ...catInputStyle, width: 150 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
                <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" title="Manage categories" style={{ fontSize: 11.5 }} onClick={() => setShowCats(true)}>
                  <VyIcon name="settings" size={13} /><span>Categories</span>
                </button>
                <select className="vy-input" style={{ ...catInputStyle, width: 170 }} value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                  {suppliers.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {healthChips.map((c) => {
                  const isActive = health === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      className="vy-chip"
                      onClick={() => setHealth(c)}
                      style={isActive ? { background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary) / 0.3)" } : {}}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Family list */}
            {families.length === 0 ? (
              <VyEmptyState
                icon="catalog"
                tone="primary"
                title="No products yet"
                body="Add your first product to build the catalog. Each product holds its variants (SKUs), supplier, costs and Amazon links — and feeds Inventory and orders."
                actions={[{ label: "New product", icon: "plus", onClick: () => setShowNew(true), primary: true }]}
              />
            ) : (
            <div className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", gap: 8, flexWrap: "wrap" }}>
                <span className="vy-kicker">{filtered.length} {filtered.length === 1 ? "product" : "products"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {favCount ? (
                    <button type="button" onClick={() => setFavOnly((v) => !v)} title="Show favorites only" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: "pointer", border: "1px solid " + (favOnly ? "hsl(45 90% 45%)" : "hsl(var(--border))"), background: favOnly ? "hsl(45 90% 50% / 0.12)" : "transparent", color: favOnly ? "hsl(40 80% 35%)" : "hsl(var(--muted-fg))" }}>
                      <VyIcon name="star" size={12} style={{ fill: "currentColor" }} />{favOnly ? "Favorites only" : "Favorites (" + favCount + ")"}
                    </button>
                  ) : null}
                  <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{favCount ? "Starred first" : "Sorted by family"}</span>
                </div>
              </div>
              {filtered.length ? (
                <div style={{ overflowX: "auto", borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                    <thead>
                      <tr style={{ background: "hsl(var(--muted-bg) / 0.5)" }}>
                        <th style={{ ...catTh, paddingRight: 0, width: 30 }}></th>
                        <th style={catTh}>Product</th>
                        <th style={{ ...catTh, textAlign: "right" }}>FBA stock</th>
                        <th style={{ ...catTh, textAlign: "right" }}>Unit cost</th>
                        <th style={{ ...catTh, width: 20 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((f) => <CatFamilyRow key={f.id} family={f} onPeek={setPeekId} onOpenProduct={openProduct} isFav={catIsFav(f.id)} onToggleFav={toggleFav} />)}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ borderTop: "1px solid hsl(var(--border) / 0.7)" }}>
                  <VyEmptyState
                    icon="filter"
                    title="No products match your filters"
                    body="Try a different search, category, supplier, or health filter — or clear them to see the whole catalog."
                    actions={[{ label: "Clear filters", icon: "x", primary: true, onClick: () => { setQuery(""); setCategory("All"); setSupplier("All"); setHealth("All"); } }]}
                  />
                </div>
              )}
            </div>
            )}
          </div>
        </main>
      </div>

      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Products" />

      {showNew ? (
        <CatNewProductModal onClose={() => setShowNew(false)} onCreate={handleCreate} categories={categories} suppliers={suppliers} />
      ) : null}

      {showCats ? (
        <CatCategoriesModal onClose={() => { setShowCats(false); setFamilies(catLoadFamilies()); }} families={families} />
      ) : null}

      {peekId ? (
        <CatPeekDrawer family={families.find((f) => f.id === peekId)} onClose={() => setPeekId(null)} onOpen={openProduct} />
      ) : null}
    </div>
  );
}

const catRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
catRoot.render(<CatalogListPage />);
