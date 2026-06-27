// Vyonix Product — single product detail page. Route: /catalog/products/[family]
// Opened from the Products list with ?family=<id>. Calm, single-column stack:
// header · gallery + facts · variants table · details (specs + supplier) ·
// cost history · order history. Hybrid source tags (Amazon / Manual) match the
// Shipping FBA card.

const { useState: useProdState, useEffect: useProdEffect } = React;

function pmoney(n) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ----------------------------------------------------------------------
// FBA economics — derived from the product's real weight / dims / category.
// These mirror Amazon's 2026 fee model closely enough to plan margins; exact
// per-ASIN fees would sync from the SP-API Product Fees endpoint (labelled est).
// ----------------------------------------------------------------------
function fbaDims(dimStr) {
  // "18 × 18 × 4 in" → [18,18,4]
  const nums = String(dimStr || "").match(/[\d.]+/g);
  return nums ? nums.slice(0, 3).map(Number) : [0, 0, 0];
}
function fbaSizeTier(weightLbs, dimStr) {
  const [a, b, c] = fbaDims(dimStr).sort((x, y) => y - x);
  const w = Number(weightLbs) || 0;
  if (w <= 1 && a <= 15 && b <= 12 && c <= 0.75) return "Small standard";
  if (w <= 20 && a <= 18 && b <= 14 && c <= 8) return "Large standard";
  if (a >= 18 && a <= 37 && w <= 50) return "Small bulky";
  if (w <= 50) return "Large bulky";
  return "Extra-large";
}
// approx 2026 non-peak US fulfillment fee by tier + weight
function fbaFulfillmentFee(weightLbs, dimStr) {
  const tier = fbaSizeTier(weightLbs, dimStr);
  const w = Number(weightLbs) || 0;
  let base;
  if (tier === "Small standard") base = 3.30 + Math.max(0, w - 0.25) * 0.2;
  else if (tier === "Large standard") base = 4.98 + Math.max(0, w - 1) * 0.42;
  else if (tier === "Small bulky") base = 7.55 + Math.max(0, w - 3) * 0.30;
  else if (tier === "Large bulky") base = 9.61 + Math.max(0, w - 10) * 0.38;
  else base = 26.0 + w * 0.5;
  return Math.round(base * 1.035 * 100) / 100; // + 3.5% fuel surcharge
}
// category referral % (most 15%, electronics 8%, device accessories 45%)
const FBA_REFERRAL = { "Seat covers": 0.15, "Steering covers": 0.15, "Floor mats": 0.15, "Air fresheners": 0.15, "Electronics": 0.08, "Accessories": 0.15 };
function fbaReferralPct(category) { return FBA_REFERRAL[category] != null ? FBA_REFERRAL[category] : 0.15; }
// monthly storage: cubic feet × $0.78 (Jan–Sep standard)
// cubic feet of one unit
function fbaCuFt(dimStr) {
  const [a, b, c] = fbaDims(dimStr);
  return (a * b * c) / 1728;
}
// monthly storage rate per cu ft: $0.78 off-peak (Jan–Sep), $2.40 Q4 peak (Oct–Dec)
function fbaStorageRate(peak) { return peak ? 2.40 : 0.78; }
// storage cost over `months` at the chosen rate
function fbaStorageMo(dimStr, months, peak) {
  const m = months == null ? 1 : months;
  return Math.round(fbaCuFt(dimStr) * fbaStorageRate(peak) * m * 100) / 100;
}

// Source-of-truth marker — Amazon (synced) vs Manual (entered). Quiet.
function ProdSourceTag({ source }) {
  const amazon = source === "amazon";
  return (
    <span
      title={amazon ? "Synced from Amazon Seller Central" : "Entered manually"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
        color: "hsl(var(--muted-fg))", whiteSpace: "nowrap",
      }}
    >
      <span style={{
        width: 5, height: 5, borderRadius: 999, flexShrink: 0,
        background: amazon ? "hsl(var(--info))" : "transparent",
        boxShadow: amazon ? "none" : "inset 0 0 0 1.5px hsl(var(--muted-fg) / 0.5)",
      }} />
      {amazon ? "Amazon" : "Manual"}
    </span>
  );
}

function ProdCard({ icon, title, sub, actions, iconTone = "primary", children, pad = "18px 20px" }) {
  const tv = iconTone === "muted" ? "muted-fg" : iconTone;
  return (
    <section className="vy-card" style={{ padding: pad }}>
      {(title || actions) ? (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: children ? 16 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {icon ? (
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: `hsl(var(--${tv}) / 0.12)`, color: `hsl(var(--${tv}))` }}>
                <VyIcon name={icon} size={15} />
              </span>
            ) : null}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
              {sub ? <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>{sub}</p> : null}
            </div>
          </div>
          {actions ? <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function ProdField({ label, value, mono, source, tone, editing, editValue, onChange, suffix, kind = "number", options, placeholder }) {
  const base = { height: 32, padding: "0 10px", fontSize: 13, fontWeight: 600, border: "1px solid hsl(var(--input))", borderRadius: 7, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span className="vy-kicker">{label}</span>
        {source ? <ProdSourceTag source={source} /> : null}
      </div>
      {editing && onChange ? (
        kind === "select" ? (
          <select value={editValue} onChange={(e) => onChange(e.target.value)} style={{ ...base, width: "100%", maxWidth: 200 }}>
            {(options || []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : kind === "text" ? (
          <input
            type="text" value={editValue} placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...base, width: "100%", maxWidth: 230, fontFamily: mono ? "var(--font-mono, 'JetBrains Mono', monospace)" : undefined }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number" min="0" value={editValue}
              onChange={(e) => onChange(e.target.value)}
              style={{ ...base, width: 90, fontWeight: 700, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
            />
            {suffix ? <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>{suffix}</span> : null}
          </div>
        )
      ) : (
        <div style={{ fontSize: 14.5, fontWeight: 700, color: tone ? `hsl(var(--${tone}))` : undefined, fontFamily: mono ? "var(--font-mono, 'JetBrains Mono', monospace)" : undefined, wordBreak: "break-word" }}>
          {value}
        </div>
      )}
    </div>
  );
}

function ProdFieldGrid({ children, cols = 3 }) {
  const arr = React.Children.toArray(children);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden", background: "hsl(var(--background) / 0.4)" }}>
      {arr.map((child, i) => (
        <div key={i} style={{ borderLeft: i % cols === 0 ? "none" : "1px solid hsl(var(--border))", borderTop: i >= cols ? "1px solid hsl(var(--border))" : "none" }}>
          {child}
        </div>
      ))}
    </div>
  );
}

const prodTh = { textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))" };
const prodTd = { padding: "12px 14px", color: "hsl(var(--foreground))", fontSize: 12.5 };
const prodCellInput = { height: 30, width: 80, textAlign: "right", padding: "0 8px", fontSize: 12.5, border: "1px solid hsl(var(--input))", borderRadius: 7, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

const STATUS_TONE = { Ready: "success", Reorder: "warning", "Missing image": "danger", "Missing title": "danger", "Missing cost": "danger" };
const ORDER_STATUS_TONE = { "In production": "info", "At FBA": "success", "In transit": "info", Closed: "muted", Draft: "muted" };

// A variant's display label — joins its defining attributes (color/pack/size/
// …) if present, else falls back to the seed name + pack.
function variantLabel(v) {
  if (v.attrs && v.attrs.length) return v.attrs.map((a) => a.value).join(" · ");
  return [v.name, v.pack].filter(Boolean).join(" · ");
}

// ----------------------------------------------------------------------
// Add variant modal (self-contained shell)
// ----------------------------------------------------------------------
function ProdModalShell({ title, sub, onClose, children, footer, width = 520 }) {
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: width, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
            {sub ? <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0", maxWidth: "46ch" }}>{sub}</p> : null}
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

const prodFieldInput = { width: "100%", height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

function ProdAddVariantModal({ family, existingSkus, onClose, onAdd }) {
  const [sku, setSku] = useProdState("");
  const [cost, setCost] = useProdState("");
  const [attrs, setAttrs] = useProdState([{ label: "Color", value: "" }]);
  const setAttr = (i, k, val) => setAttrs((prev) => prev.map((a, idx) => (idx === i ? { ...a, [k]: val } : a)));
  const addAttr = () => setAttrs((prev) => [...prev, { label: "", value: "" }]);
  const removeAttr = (i) => setAttrs((prev) => prev.filter((_, idx) => idx !== i));

  const skuTaken = existingSkus.includes(sku.trim().toUpperCase());
  const filledAttrs = attrs.filter((a) => a.value.trim());
  const valid = sku.trim() && !skuTaken && filledAttrs.length > 0;
  // The product's existing attribute vocabulary (label -> values it already
  // uses), so you pick from it instead of retyping and fragmenting the taxonomy.
  const attrTaxonomy = (() => {
    const map = {};
    const add = (label, val) => { if (!label || val == null || val === "") return; const k = String(label).trim(); (map[k] = map[k] || new Set()).add(String(val).trim()); };
    (family.variants || []).forEach((v) => {
      (v.attrs || []).forEach((a) => add(a.label, a.value));
      if (v.pack) add("Pack", v.pack);
      if (v.name) add("Type", v.name);
    });
    const out = {}; Object.keys(map).forEach((k) => { out[k] = [...map[k]]; });
    return out;
  })();
  const labelSuggestions = [...new Set([...Object.keys(attrTaxonomy), "Color", "Pack", "Size", "Style", "Scent", "Material", "Length", "Fit"])];
  const valuesForLabel = (label) => attrTaxonomy[(label || "").trim()] || attrTaxonomy[Object.keys(attrTaxonomy).find((k) => k.toLowerCase() === (label || "").trim().toLowerCase())] || [];

  function submit() {
    const c = Number(cost) || 0;
    const clean = filledAttrs.map((a) => ({ label: a.label.trim() || "Option", value: a.value.trim() }));
    const packAttr = clean.find((a) => /pack/i.test(a.label));
    onAdd({
      sku: sku.trim().toUpperCase(),
      attrs: clean,
      name: clean.map((a) => a.value).join(" · "),
      pack: packAttr ? packAttr.value : "",
      fnsku: "Pending sync",
      asin: "Pending sync",
      fbaStock: 0,
      inbound: 0,
      lastCostUsd: c,
      lastCostRmb: Math.round(c * 7.1 * 100) / 100,
      status: c > 0 ? "Ready" : "Missing cost",
      image: false,
    });
  }

  return (
    <ProdModalShell
      title="Add variant"
      sub={"New variant of " + family.parent + ". Variants can differ by anything — color, pack, size, scent. Add the attributes that define this one."}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={submit}>
            <VyIcon name="plus" size={14} /><span>Add variant</span>
          </button>
        </>
      }
    >
      <datalist id="prod-attr-labels">{labelSuggestions.map((l) => <option key={l} value={l} />)}</datalist>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 calc(60% - 7px)", minWidth: 0 }}>
          <span className="vy-kicker">SKU</span>
          <input className="vy-input" style={{ ...prodFieldInput, fontFamily: "var(--font-mono, monospace)" }} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. CAR-BSC-3P-BLK" />
          {skuTaken ? <span style={{ fontSize: 10.5, color: "hsl(var(--danger))" }}>That SKU is already in this product.</span> : null}
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 calc(40% - 7px)", minWidth: 0 }}>
          <span className="vy-kicker">Unit cost (USD)</span>
          <input type="number" step="0.01" className="vy-input" style={prodFieldInput} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 8.40" />
        </label>
      </div>

      <div style={{ marginTop: 18, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="vy-kicker">Defining attributes</span>
        <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11.5 }} onClick={addAttr}>
          <VyIcon name="plus" size={12} /><span>Add attribute</span>
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {attrs.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <datalist id={"prod-attr-vals-" + i}>{valuesForLabel(a.label).map((val) => <option key={val} value={val} />)}</datalist>
            <input className="vy-input" list="prod-attr-labels" style={{ ...prodFieldInput, flex: "1 1 130px", minWidth: 0 }} value={a.label} onChange={(e) => setAttr(i, "label", e.target.value)} placeholder="Attribute (e.g. Color)" />
            <span style={{ color: "hsl(var(--muted-fg))", flexShrink: 0 }}>=</span>
            <input className="vy-input" list={"prod-attr-vals-" + i} style={{ ...prodFieldInput, flex: "1 1 150px", minWidth: 0 }} value={a.value} onChange={(e) => setAttr(i, "value", e.target.value)} placeholder={valuesForLabel(a.label).length ? "Pick or type…" : "Value (e.g. Black)"} />
            <button type="button" aria-label="Remove attribute" onClick={() => removeAttr(i)} disabled={attrs.length === 1} style={{ background: "transparent", border: "1px solid hsl(var(--border))", borderRadius: 8, width: 34, height: 38, display: "grid", placeItems: "center", cursor: attrs.length === 1 ? "not-allowed" : "pointer", color: "hsl(var(--muted-fg))", opacity: attrs.length === 1 ? 0.4 : 1, flexShrink: 0 }}>
              <VyIcon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
      {filledAttrs.length ? (
        <div style={{ marginTop: 12, fontSize: 12, color: "hsl(var(--muted-fg))" }}>
          Variant label: <strong style={{ color: "hsl(var(--foreground))" }}>{filledAttrs.map((a) => a.value.trim()).join(" · ")}</strong>
        </div>
      ) : null}
    </ProdModalShell>
  );
}

// ----------------------------------------------------------------------
// VARIANT DETAIL DRAWER — everything for one SKU: identity, link status,
// physical, Amazon economics, COGS + editable sale price → net margin.
// ----------------------------------------------------------------------
function ProdVariantDrawer({ variant: v, family, eco, sizeTier, referralPct, fbaFee, storage, editing, onEditPrice, onLink, onUnlink, onDelete, onPrep, onClose }) {
  const [shown, setShown] = useProdState(false);
  const [linkOpen, setLinkOpen] = useProdState(false);
  const [linkAsin, setLinkAsin] = useProdState("");
  const [linkFnsku, setLinkFnsku] = useProdState("");
  const [confirmDel, setConfirmDel] = useProdState(false);
  useProdEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(r); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  if (!v) return null;
  const mono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
  const linked = v.asin && v.asin !== "Pending sync";
  const mtone = eco.marginPct == null ? "muted" : eco.net <= 0 ? "danger" : eco.marginPct < 20 ? "warning" : "success";
  const Stat = ({ label, value, src, tone }) => (
    <div style={{ flex: "1 1 110px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}><span className="vy-kicker">{label}</span>{src ? <ProdSourceTag source={src} /> : null}</div>
      <div style={{ ...mono, fontSize: 14.5, fontWeight: 700, color: tone ? "hsl(var(--" + tone + "))" : undefined }}>{value}</div>
    </div>
  );
  const Money = ({ label, value, minus, strong }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: "1px solid hsl(var(--border) / 0.6)" }}>
      <span style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))" }}>{label}</span>
      <span style={{ ...mono, fontSize: 13, fontWeight: strong ? 700 : 600, color: strong ? "hsl(var(--" + mtone + "))" : undefined }}>{minus ? "−" : ""}{pmoney(value)}</span>
    </div>
  );

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.4)", opacity: shown ? 1 : 0, transition: "opacity 200ms ease" }}></div>
      <aside style={{ position: "absolute", top: 0, right: 0, height: "100%", width: "min(460px, 94vw)", background: "hsl(var(--card))", borderLeft: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", transform: shown ? "translateX(0)" : "translateX(100%)", transition: "transform 240ms cubic-bezier(0.32,0.72,0,1)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid hsl(var(--border))", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <image-slot id={"pvar-" + v.sku} style={{ width: "44px", height: "44px", flexShrink: 0 }} shape="rounded" radius="9" placeholder={v.sku}></image-slot>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...mono, fontSize: 14, fontWeight: 700 }}>{v.sku}</div>
            <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{variantLabel(v)}</div>
            <div style={{ marginTop: 6 }}>
              {linked
                ? <span className="vy-badge vy-badge--success"><VyIcon name="check" size={10} style={{ marginRight: 3, verticalAlign: "-1px" }} />Linked to Amazon</span>
                : <span className="vy-badge vy-badge--warning"><VyIcon name="alert" size={10} style={{ marginRight: 3, verticalAlign: "-1px" }} />Not linked</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))", flexShrink: 0 }}><VyIcon name="x" size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Net margin headline */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "hsl(var(--" + mtone + ") / 0.08)", border: "1px solid hsl(var(--" + mtone + ") / 0.25)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span className="vy-kicker">Net margin / unit</span>
              <span className={"vy-badge vy-badge--" + mtone}>{eco.marginPct == null ? "No price" : eco.marginPct + "%"}</span>
            </div>
            <div style={{ ...mono, fontSize: 26, fontWeight: 800, color: "hsl(var(--" + mtone + "))", marginTop: 4 }}>{eco.marginPct == null ? "Set a sale price" : pmoney(eco.net)}</div>
          </div>

          {/* Identity */}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Identity</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <Stat label="FNSKU" value={linked ? v.fnsku : "—"} src="amazon" />
              <Stat label="ASIN" value={linked ? v.asin : "Pending sync"} src="amazon" />
              <Stat label="Status" value={v.status} />
              <div style={{ flex: 1, minWidth: 0, padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><span className="vy-kicker">Prep</span></div>
                {editing && onPrep ? (
                  <select value={v.prep || "Labeled"} onChange={(e) => onPrep(e.target.value)} style={{ height: 30, fontSize: 12.5, border: "1px solid hsl(var(--input))", borderRadius: 7, background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}>
                    <option>Labeled</option><option>Stickerless</option><option>Commingled</option>
                  </select>
                ) : (
                  <span className={"vy-badge vy-badge--" + (v.prep === "Stickerless" ? "warning" : "muted")}>{v.prep || "Labeled"}</span>
                )}
              </div>
            </div>
            {!linked ? (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, border: "1px solid hsl(var(--warning) / 0.35)", background: "hsl(var(--warning) / 0.07)" }}>
                {!linkOpen ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 160, fontSize: 12, lineHeight: 1.4 }}>
                      <strong style={{ fontWeight: 600 }}>Not linked to inventory yet.</strong>
                      <span style={{ color: "hsl(var(--muted-fg))" }}> Connect this SKU to its Amazon inventory record to sync stock &amp; fees.</span>
                    </div>
                    <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" style={{ flexShrink: 0 }} onClick={() => { setLinkAsin(""); setLinkFnsku(""); setLinkOpen(true); }}>
                      <VyIcon name="boxes" size={12} /><span>Link to inventory</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="vy-kicker">Link to your Amazon inventory</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <label style={{ flex: "1 1 130px", display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>ASIN</span>
                        <input value={linkAsin} onChange={(e) => setLinkAsin(e.target.value)} placeholder="e.g. B0C1SEMI01" style={{ ...prodFieldInput, height: 34, fontFamily: "var(--font-mono, monospace)" }} autoFocus />
                      </label>
                      <label style={{ flex: "1 1 130px", display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>FNSKU (optional)</span>
                        <input value={linkFnsku} onChange={(e) => setLinkFnsku(e.target.value)} placeholder="e.g. X001ABC123" style={{ ...prodFieldInput, height: 34, fontFamily: "var(--font-mono, monospace)" }} />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={() => setLinkOpen(false)}>Cancel</button>
                      <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" disabled={!linkAsin.trim()} style={linkAsin.trim() ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={() => { onLink(linkAsin.trim(), linkFnsku.trim() || ("FN" + linkAsin.trim().slice(-8))); setLinkOpen(false); }}>
                        <VyIcon name="check" size={12} /><span>Link</span>
                      </button>
                    </div>
                    <p style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", margin: 0 }}>Inventory data comes from Amazon — enter the ASIN to match this SKU to its record.</p>
                  </div>
                )}
              </div>
            ) : null}
            {linked ? (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 13px", borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--muted) / 0.3)" }}>
                <div style={{ flex: 1, minWidth: 160, fontSize: 11.5, color: "hsl(var(--muted-fg))", lineHeight: 1.4 }}>
                  Linked to <strong style={{ color: "hsl(var(--foreground))" }}>{v.asin}</strong>. Stock &amp; fees sync from this Amazon record.
                </div>
                <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ flexShrink: 0, color: "hsl(var(--danger, 0 72% 51%))" }} onClick={() => { if (window.confirm("Unlink " + v.sku + " from its Amazon inventory record? FBA stock & fees stop syncing until you re-link.")) onUnlink && onUnlink(); }}>
                  <VyIcon name="link" size={12} /><span>Unlink</span>
                </button>
              </div>
            ) : null}
          </div>

          {/* Physical */}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Physical &amp; FBA class</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <Stat label="Size tier" value={sizeTier} src="amazon" />
              <Stat label="Dimensions" value={(() => { const m = peDimModel(family); return <span>{peDimCmStr(m.cm)}<span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "hsl(var(--muted-fg))" }}>{peDimInStr(m.cm) || ""}</span></span>; })()} src="amazon" />
              <Stat label="Weight" value={(() => { const m = peDimModel(family); return <span>{m.kg != null ? peRound(m.kg, 2) + " kg" : "\u2014"}<span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "hsl(var(--muted-fg))" }}>{m.kg != null ? peLbFromKg(m.kg) + " lb" : ""}</span></span>; })()} src="amazon" />
            </div>
          </div>

          {/* Economics breakdown */}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 4 }}>Unit economics</div>
            <Money label="Sale price" value={eco.price} />
            <Money label={"COGS (your cost)"} value={eco.cogs} minus />
            <Money label={"Referral fee (" + Math.round(referralPct * 100) + "%)"} value={eco.referralFee} minus />
            <Money label="FBA fulfilment fee" value={fbaFee} minus />
            <Money label="Storage" value={storage} minus />
            <Money label="Net per unit" value={eco.net} strong />
            {editing ? (
              <div style={{ marginTop: 12 }}>
                <div className="vy-kicker" style={{ marginBottom: 5 }}>Sale price (your input)</div>
                <input type="number" step="0.01" value={v.salePrice != null ? v.salePrice : eco.price} onChange={(e) => onEditPrice(e.target.value === "" ? "" : Number(e.target.value))} style={{ ...prodFieldInput, maxWidth: 160 }} />
              </div>
            ) : null}
            <p style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", margin: "10px 0 0", lineHeight: 1.45 }}>
              FBA fees are 2026 estimates from weight/size/category; sync a Seller Central key for exact per-ASIN fees. {editing ? "" : "Click Edit to set the sale price."}
            </p>
            <button
              type="button"
              className="vy-btn vy-btn--outline vy-btn--sm"
              style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
              onClick={() => window.vyOpenFbaCalc && window.vyOpenFbaCalc({ salePrice: (v.salePrice != null && v.salePrice !== "") ? v.salePrice : undefined, unitCost: eco.cogs, dims: family.dims, weightLbs: family.weightLbs, category: family.category, label: v.sku })}
            >
              <VyIcon name="calculator" size={13} /><span>Model a reorder in the FBA calculator</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        {confirmDel ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--danger, 0 72% 51%) / 0.06)", flexWrap: "wrap" }}>
            <VyIcon name="alert" size={15} style={{ color: "hsl(var(--danger, 0 72% 51%))", flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 180, fontSize: 12.5, lineHeight: 1.4 }}>Delete <strong>{v.sku}</strong>? Removes it from the product, Inventory &amp; the Add-SKUs picker. This can't be undone.</span>
            <button type="button" className="vy-btn vy-btn--ghost" onClick={() => setConfirmDel(false)}>Cancel</button>
            <button type="button" className="vy-btn" style={{ background: "hsl(var(--danger, 0 72% 51%))", color: "#fff" }} onClick={() => onDelete && onDelete(v.sku)}>
              <VyIcon name="trash" size={14} /><span>Delete variant</span>
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))", alignItems: "center" }}>
            <button type="button" onClick={() => setConfirmDel(true)} title="Delete variant" style={{ background: "transparent", border: "none", cursor: "pointer", color: "hsl(var(--muted-fg))", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 2px" }}>
              <VyIcon name="trash" size={13} /><span>Delete</span>
            </button>
            <div style={{ flex: 1 }} />
            <a href={"Vyonix Inventory.html?q=" + encodeURIComponent(v.sku)} className="vy-btn vy-btn--outline" style={{ textDecoration: "none" }}>
              <VyIcon name="boxes" size={14} /><span>View in Inventory</span>
            </a>
            <button type="button" className="vy-btn vy-btn--primary" onClick={onClose}>Close</button>
          </div>
        )}
      </aside>
    </div>,
    document.body
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
function ProductPage() {
  const params = new URLSearchParams(window.location.search);
  const allFamilies = catLoadFamilies();
  const familyId = params.get("family") || allFamilies[0].id;
  const family = allFamilies.find((f) => f.id === familyId) || allFamilies[0];

  const [sidebarCollapsed, setSidebarCollapsed] = useProdState(false);
  const [mobileNavOpen, setMobileNavOpen] = useProdState(false);
  const [isDark, setIsDark] = useProdState(false);
  const [variants, setVariants] = useProdState(family.variants.map((v) => ({ ...v })));
  const [fam, setFam] = useProdState(() => family); // dynamic family-level fields (dims, weight, history, tech packs)
  const [editing, setEditing] = useProdState(false);
  const [moq, setMoq] = useProdState(family.moq);
  const [leadTime, setLeadTime] = useProdState(family.leadTimeDays);
  function persistMoq(v) { const n = v === "" ? "" : Math.max(0, Number(v) || 0); setMoq(n); if (typeof catUpdateFamily === "function") catUpdateFamily(family.id, { moq: Number(n) || 0 }); }
  function persistLead(v) { const n = v === "" ? "" : Math.max(0, Number(v) || 0); setLeadTime(n); if (typeof catUpdateFamily === "function") catUpdateFamily(family.id, { leadTimeDays: Number(n) || 0 }); }
  // Patch any family-level identity/supplier field and persist immediately.
  function setFamField(key, val) { setFam((prev) => { if (typeof catUpdateFamily === "function") catUpdateFamily(prev.id, { [key]: val }); return { ...prev, [key]: val }; }); }
  // Category vocabulary across the catalog, plus common FBA categories.
  const categoryOptions = [...new Set(allFamilies.map((f) => f.category).concat(["Seat covers", "Steering covers", "Floor mats", "Air fresheners", "Electronics", "Accessories", "Uncategorized"]).filter(Boolean))];
  const [addOpen, setAddOpen] = useProdState(false);
  const [drawerSku, setDrawerSku] = useProdState(null);
  const [stoMonths, setStoMonths] = useProdState(1);
  // Q4 peak (Oct–Dec) drives higher storage; auto-detected from today, overridable for planning.
  const [stoPeak, setStoPeak] = useProdState(() => { const m = new Date().getMonth(); return m >= 9 && m <= 11; });

  // FBA economics shared across the table, drawer, and parent aggregates
  const ecoReferral = fbaReferralPct(fam.category);
  const ecoFbaFee = fbaFulfillmentFee(fam.weightLbs, fam.dims);
  const ecoStorage = fbaStorageMo(fam.dims, stoMonths, stoPeak);
  const ecoSizeTier = fbaSizeTier(fam.weightLbs, fam.dims);
  function ecoForVariant(v) {
    const cogs = Number(v.lastCostUsd) || 0;
    const hasPrice = v.salePrice != null && v.salePrice !== "" && Number(v.salePrice) > 0;
    const price = hasPrice ? Number(v.salePrice) : Math.round(cogs * 3 * 100) / 100;
    const referralFee = price * ecoReferral;
    const fees = ecoFbaFee + ecoStorage;
    const net = price - cogs - referralFee - fees;
    // margin is undefined without a real price; flag it rather than show a misleading 0%
    const marginPct = price > 0 ? Math.round((net / price) * 100) : null;
    return { cogs, price, referralFee, fees, net, marginPct, hasPrice };
  }

  useProdEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  function persist(next) {
    catUpdateFamilyVariants(family.id, next);
  }
  function deleteVariant(sku) {
    setVariants((prev) => { const next = prev.filter((v) => v.sku !== sku); persist(next); return next; });
    setDrawerSku(null);
  }

  function setVariant(sku, key, val) {
    setVariants((prev) => {
      const next = prev.map((v) => (v.sku === sku ? { ...v, [key]: val } : v));
      persist(next);
      return next;
    });
  }

  function handleAddVariant(nv) {
    setVariants((prev) => {
      const next = [...prev, nv];
      persist(next);
      return next;
    });
    setAddOpen(false);
  }

  // Log a new size/weight: the prior values drop into history (seeded once so
  // the original isn't lost), and the imperial fields are re-derived so the FBA
  // fee math keeps working off inches/pounds.
  function logNewSize({ dimCm, weightKg, cartonCm, cartonKg, unitsPerCarton, note }) {
    setFam((prev) => {
      const model = peDimModel(prev);
      const prevCarton = peCartonModel(prev);
      const hist = (prev.dimHistory || []).slice();
      if (hist.length === 0 && (model.cm || model.kg != null)) {
        hist.push({ date: "\u2014", dimCm: model.cm, weightKg: model.kg, cartonCm: prevCarton.cm, cartonKg: prevCarton.kg, unitsPerCarton: prevCarton.units, note: "Earlier" });
      }
      hist.push({ date: peToday(), dimCm, weightKg, cartonCm, cartonKg, unitsPerCarton, note });
      const dimsStr = dimCm ? [peInFromCm(dimCm.l), peInFromCm(dimCm.w), peInFromCm(dimCm.h)].join(" \u00d7 ") + " in" : prev.dims;
      const lbs = weightKg != null ? peLbFromKg(weightKg) : prev.weightLbs;
      const patch = { dimCm, weightKg, dims: dimsStr, weightLbs: lbs, cartonCm, cartonKg, unitsPerCarton, dimHistory: hist };
      catUpdateFamily(prev.id, patch);
      return { ...prev, ...patch };
    });
  }

  // Add a tech-pack version. Keep the file bytes in session state for viewing;
  // persist them only when small enough for localStorage (guarded).
  function addTechPack(p) {
    setFam((prev) => {
      const entry = { version: p.version, fileName: p.fileName, size: p.size, date: p.date, note: p.note, dataUrl: p.dataUrl || p.sessionUrl || null };
      const packsState = [...(prev.techPacks || []), entry];
      const persistPacks = packsState.map((x) => ({ version: x.version, fileName: x.fileName, size: x.size, date: x.date, note: x.note, dataUrl: (x.dataUrl && x.dataUrl.length < 2000000) ? x.dataUrl : null }));
      catUpdateFamily(prev.id, { techPacks: persistPacks });
      return { ...prev, techPacks: packsState };
    });
  }

  // derived
  const stock = variants.reduce((n, v) => n + v.fbaStock, 0);
  const inbound = variants.reduce((n, v) => n + (v.inbound || 0), 0);
  const costs = variants.map((v) => Number(v.lastCostUsd) || 0);
  const minCost = costs.length ? Math.min(...costs) : 0, maxCost = costs.length ? Math.max(...costs) : 0;
  const costLabel = costs.length === 0 ? "—" : minCost === maxCost ? pmoney(minCost) : pmoney(minCost) + "–" + pmoney(maxCost);
  const stats = catFamilyStats({ ...family, variants });
  const lowStock = stock <= CAT_LOW_STOCK * Math.max(1, Math.round(variants.length / 2));

  const title = (fam.parent || family.parent) + (fam.color ? " · " + fam.color : "");
  const costHistory = family.costHistory || [];
  const orderHistory = family.orderHistory || [];
  const maxHist = Math.max(1, ...costHistory.map((h) => h.usd));

  const facts = [
    { label: "FBA stock", value: stock.toLocaleString(), sub: "units", source: "amazon", tone: lowStock ? "warning" : undefined },
    { label: "Inbound", value: inbound.toLocaleString(), sub: "to FBA", source: "amazon" },
    { label: "Variants", value: String(variants.length), sub: "SKUs" },
    { label: "Last cost", value: costLabel, sub: "per unit", source: "manual" },
    { label: "Lead time", value: (Number(leadTime) || 0) + " days", sub: "production", source: "manual" },
    { label: "MOQ", value: (Number(moq) || 0).toLocaleString() + " units", sub: "min order", source: "manual" },
  ];

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
            {/* Breadcrumb */}
            <nav className="vy-breadcrumb" aria-label="Breadcrumb">
              <a href="Vyonix Catalog.html" className="vy-bc-link">Catalog</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <a href="Vyonix Catalog.html" className="vy-bc-link">Products</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <span className="vy-bc-current" aria-current="page">{title}</span>
            </nav>

            {/* Header */}
            <section className="vy-card" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h1 className="vy-title" style={{ margin: 0 }}>{title}</h1>
                    <span className={"vy-badge vy-badge--" + CAT_HEALTH_TONE[stats.health]}>{stats.health}</span>
                    {(() => {
                      const linked = variants.filter((v) => v.asin && v.asin !== "Pending sync").length;
                      const nl = variants.length - linked;
                      return nl === 0
                        ? <span className="vy-badge vy-badge--success" title="All variants linked to Seller Central"><VyIcon name="check" size={10} style={{ marginRight: 3, verticalAlign: "-1px" }} />Linked to Amazon</span>
                        : <span className="vy-badge vy-badge--warning" title={nl + " variant(s) not yet linked to a Seller Central listing"}><VyIcon name="alert" size={10} style={{ marginRight: 3, verticalAlign: "-1px" }} />{linked}/{variants.length} linked</span>;
                    })()}
                  </div>
                  <div className="vy-title-meta" style={{ marginTop: 12 }}>
                    <span className="vy-chip"><VyIcon name="catalog" size={11} />{fam.category}</span>
                    <span className="vy-chip"><VyIcon name="package" size={11} />{fam.brand}</span>
                    <span className="vy-chip"><VyIcon name="factory" size={11} />{fam.supplier}</span>
                    <span className="vy-chip"><VyIcon name="cube" size={11} />{variants.length} variants</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button type="button" className="vy-btn vy-btn--primary" onClick={() => { window.location.href = "Vyonix Orders List.html"; }}>
                    <VyIcon name="plus" size={13} /><span>Reorder</span>
                  </button>
                  <button type="button" className="vy-btn vy-btn--outline vy-btn--icon" aria-label="More actions">
                    <VyIcon name="more" size={14} />
                  </button>
                </div>
              </div>
            </section>

            {/* Master economics — family averages */}
            {(() => {
              const ecos = variants.map((v) => ecoForVariant(v));
              const priced = ecos.filter((e) => e.marginPct != null);
              const avg = (arr) => arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;
              const avgMargin = priced.length ? Math.round(avg(priced.map((e) => e.marginPct))) : null;
              const avgCogs = avg(ecos.map((e) => e.cogs));
              const totalStock = variants.reduce((s, v) => s + (Number(v.fbaStock) || 0), 0);
              const mtone = avgMargin == null ? "muted" : avgMargin <= 0 ? "danger" : avgMargin < 20 ? "warning" : "success";
              const cards = [
                { label: "Avg net margin", value: avgMargin == null ? "—" : avgMargin + "%", tone: avgMargin == null ? null : mtone, sub: priced.length < variants.length ? priced.length + "/" + variants.length + " priced" : ecoSizeTier },
                { label: "Avg FBA fee / unit", value: pmoney(ecoFbaFee), sub: Math.round(ecoReferral * 100) + "% referral" },
                { label: "Avg COGS", value: pmoney(avgCogs), sub: "from last orders" },
                { label: "FBA stock", value: totalStock.toLocaleString(), sub: variants.length + " SKUs" },
              ];
              return (
                <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                  {cards.map((c) => (
                    <div className={"vy-card vy-kpi" + (c.tone ? " vy-kpi--" + c.tone : "")} key={c.label}>
                      <span className="vy-kicker">{c.label}</span>
                      <div className="vy-kpi-value" style={{ fontSize: 19, color: c.tone ? "hsl(var(--" + c.tone + "))" : undefined }}>{c.value}</div>
                      <div className="vy-kpi-sub">{c.sub}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Storage assumption — auto-set from today, overridable for planning */}
            {(() => {
              const isQ4now = (() => { const m = new Date().getMonth(); return m >= 9 && m <= 11; })();
              return (
                <div className="vy-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "hsl(var(--muted-fg))" }}>
                    <VyIcon name="boxes" size={14} style={{ opacity: 0.7 }} />
                    Storage assumption
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12 }}>Hold</span>
                    <input type="number" min="1" max="12" value={stoMonths} onChange={(e) => setStoMonths(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} style={{ width: 52, height: 30, padding: "0 8px", fontSize: 12.5, border: "1px solid hsl(var(--input))", borderRadius: 7, background: "hsl(var(--background))", color: "hsl(var(--foreground))" }} />
                    <span style={{ fontSize: 12 }}>mo</span>
                  </div>
                  <button type="button" onClick={() => setStoPeak(!stoPeak)} title="Q4 (Oct–Dec) storage costs ~3× more" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer", border: "1px solid " + (stoPeak ? "hsl(var(--warning))" : "hsl(var(--border))"), background: stoPeak ? "hsl(var(--warning) / 0.14)" : "transparent", color: stoPeak ? "hsl(var(--warning))" : "hsl(var(--muted-fg))" }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: stoPeak ? "hsl(var(--warning))" : "hsl(var(--muted-fg) / 0.4)" }}></span>
                    Q4 peak rate
                  </button>
                  <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginLeft: "auto" }}>
                    {stoPeak === isQ4now ? "Auto for " + new Date().toLocaleString(undefined, { month: "long" }) : "Manual override"} · {pmoney(fbaStorageRate(stoPeak))}/ft³/mo · {pmoney(ecoStorage)}/unit
                  </span>
                </div>
              );
            })()}
            <ProdCard icon="package" title="Images" sub="Drag your own product shots onto a slot — they persist." iconTone="muted">
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <image-slot id={"prod-" + family.id + "-1"} style={{ width: "220px", height: "160px" }} shape="rounded" radius="12" placeholder={family.images[0] || "Drop product image"}></image-slot>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <image-slot id={"prod-" + family.id + "-2"} style={{ width: "105px", height: "75px" }} shape="rounded" radius="10" placeholder={family.images[1] || "Detail"}></image-slot>
                    <image-slot id={"prod-" + family.id + "-3"} style={{ width: "105px", height: "75px" }} shape="rounded" radius="10" placeholder={family.images[2] || "Packaging"}></image-slot>
                  </div>
                </div>
                <div style={{ flex: "1 1 280px", minWidth: 240, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 0, alignContent: "start", border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden", background: "hsl(var(--background) / 0.4)" }}>
                  {facts.map((f, i) => (
                    <div key={f.label} style={{ padding: "12px 14px", borderLeft: i % 2 === 0 ? "none" : "1px solid hsl(var(--border))", borderTop: i >= 2 ? "1px solid hsl(var(--border))" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span className="vy-kicker">{f.label}</span>
                        {f.source ? <ProdSourceTag source={f.source} /> : null}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", color: f.tone ? `hsl(var(--${f.tone}))` : undefined }}>{f.value}</div>
                      <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{f.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </ProdCard>

            {/* Variants */}
            <ProdCard
              icon="cube"
              title="Variants"
              sub="FNSKU, ASIN & FBA stock sync from Amazon · click a variant for its full economics · Edit to set cost, price & images"
              actions={
                <>
                  <button type="button" className="vy-btn vy-btn--sm vy-btn--primary" style={{ fontSize: 11.5 }} onClick={() => setAddOpen(true)}>
                    <VyIcon name="plus" size={12} /><span>Add variant</span>
                  </button>
                  <button type="button" className={"vy-btn vy-btn--sm " + (editing ? "vy-btn--primary" : "vy-btn--outline")} style={{ fontSize: 11.5 }} onClick={() => setEditing(!editing)}>
                    <VyIcon name={editing ? "check" : "pencil"} size={12} /><span>{editing ? "Done" : "Edit"}</span>
                  </button>
                </>
              }
            >
              <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: "hsl(var(--muted-bg) / 0.6)" }}>
                      <th style={{ ...prodTh, width: 44 }}></th>
                      <th style={prodTh}>SKU</th>
                      <th style={prodTh}>Variant</th>
                      <th style={prodTh}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>FNSKU <ProdSourceTag source="amazon" /></span></th>
                      <th style={{ ...prodTh, textAlign: "right" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>FBA <ProdSourceTag source="amazon" /></span></th>
                      <th style={{ ...prodTh, textAlign: "right" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>Cost $ <ProdSourceTag source="manual" /></span></th>
                      <th style={{ ...prodTh, textAlign: "right" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>Price $ <ProdSourceTag source="manual" /></span></th>
                      <th style={prodTh}>Status</th>
                      <th style={{ ...prodTh, textAlign: "right" }}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.sku} className="vy-order-row" onClick={() => setDrawerSku(v.sku)} style={{ borderTop: "1px solid hsl(var(--border))", cursor: "pointer" }}>
                        <td style={{ ...prodTd, padding: "8px 10px" }}>
                          <image-slot id={"pvar-" + v.sku} style={{ width: "32px", height: "32px" }} shape="rounded" radius="7" placeholder={v.sku}></image-slot>
                        </td>
                        <td style={{ ...prodTd, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontWeight: 600 }}>{v.sku}</td>
                        <td style={prodTd}>{variantLabel(v)}</td>
                        <td style={{ ...prodTd }}>
                          {(v.asin && v.asin !== "Pending sync") ? (
                            <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", color: "hsl(var(--muted-fg))" }}>{v.fnsku}</span>
                          ) : (
                            <span className="vy-badge vy-badge--warning" title="No Seller Central listing linked yet">Not linked</span>
                          )}
                        </td>
                        <td style={{ ...prodTd, textAlign: "right", fontWeight: 600 }}>
                          <a href={"Vyonix Inventory.html?q=" + encodeURIComponent(v.sku)} onClick={(e) => e.stopPropagation()} title="View in Inventory" style={{ textDecoration: "none", color: v.fbaStock <= CAT_LOW_STOCK ? "hsl(var(--warning))" : "hsl(var(--primary))", display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                            {v.fbaStock}<VyIcon name="arrowUpRight" size={11} style={{ opacity: 0.6 }} />
                          </a>
                        </td>
                        <td style={{ ...prodTd, textAlign: "right" }} onClick={(e) => editing && e.stopPropagation()}>
                          {editing ? (
                            <input type="number" step="0.01" value={v.lastCostUsd} onChange={(e) => setVariant(v.sku, "lastCostUsd", e.target.value === "" ? "" : Number(e.target.value))} style={prodCellInput} />
                          ) : (
                            <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontWeight: 600 }}>{pmoney(Number(v.lastCostUsd) || 0)}</span>
                          )}
                        </td>
                        <td style={{ ...prodTd, textAlign: "right" }} onClick={(e) => editing && e.stopPropagation()}>
                          {editing ? (
                            <input type="number" step="0.01" value={v.salePrice != null ? v.salePrice : ""} placeholder={String(ecoForVariant(v).price)} onChange={(e) => setVariant(v.sku, "salePrice", e.target.value === "" ? "" : Number(e.target.value))} style={prodCellInput} />
                          ) : (
                            <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontWeight: 600, color: (v.salePrice != null && v.salePrice !== "") ? undefined : "hsl(var(--muted-fg))" }}>{(v.salePrice != null && v.salePrice !== "") ? pmoney(Number(v.salePrice)) : "\u2014"}</span>
                          )}
                        </td>
                        <td style={prodTd}><span className={"vy-badge vy-badge--" + (STATUS_TONE[v.status] || "muted")}>{v.status}</span></td>
                        {(() => {
                          const e = ecoForVariant(v);
                          if (e.marginPct == null) {
                            return (
                              <td style={{ ...prodTd, textAlign: "right" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                                  <span className="vy-badge vy-badge--muted" title="Set a sale price to see margin">No price</span>
                                  <VyIcon name="chevronRight" size={13} style={{ color: "hsl(var(--muted-fg))" }} />
                                </span>
                              </td>
                            );
                          }
                          const tone = e.net <= 0 ? "danger" : e.marginPct < 20 ? "warning" : "success";
                          return (
                            <td style={{ ...prodTd, textAlign: "right" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                                <span className={"vy-badge vy-badge--" + tone}>{e.marginPct}%</span>
                                <VyIcon name="chevronRight" size={13} style={{ color: "hsl(var(--muted-fg))" }} />
                              </span>
                            </td>
                          );
                        })()}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ProdCard>

            <ProdCard
              icon="clipboard"
              title="Details"
              iconTone="info"
              sub={editing ? "Type to edit — every field saves automatically as you go." : "Click Edit details to fill in identity, supplier & specs."}
              actions={
                <button type="button" className={"vy-btn vy-btn--sm " + (editing ? "vy-btn--primary" : "vy-btn--outline")} style={{ fontSize: 11.5 }} onClick={() => setEditing(!editing)}>
                  <VyIcon name={editing ? "check" : "pencil"} size={12} /><span>{editing ? "Done editing" : "Edit details"}</span>
                </button>
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                <div>
                  <div className="vy-kicker" style={{ marginBottom: 8 }}>Specs &amp; identity</div>
                  <ProdFieldGrid cols={2}>
                    <ProdField label="Product name" value={fam.parent} kind="text" placeholder="e.g. Universal seat cover" editing={editing} editValue={fam.parent || ""} onChange={(val) => setFamField("parent", val)} source="manual" />
                    <ProdField label="Color / line" value={fam.color || "—"} kind="text" placeholder="e.g. Black" editing={editing} editValue={fam.color || ""} onChange={(val) => setFamField("color", val)} source="manual" />
                    <ProdField label="Category" value={fam.category} kind="select" options={categoryOptions} editing={editing} editValue={fam.category || ""} onChange={(val) => setFamField("category", val)} source="manual" />
                    <ProdField label="Amazon category" value={fam.amazonCategory || fam.category} kind="text" placeholder="e.g. Automotive" editing={editing} editValue={fam.amazonCategory || ""} onChange={(val) => setFamField("amazonCategory", val)} source="amazon" />
                    <ProdField label="Brand" value={fam.brand} kind="text" placeholder="e.g. Vyonix" editing={editing} editValue={fam.brand || ""} onChange={(val) => setFamField("brand", val)} source="amazon" />
                    <ProdField label="Material" value={fam.material} kind="text" placeholder="e.g. Neoprene" editing={editing} editValue={fam.material || ""} onChange={(val) => setFamField("material", val)} source="manual" />
                    <ProdField label="MOQ" value={(Number(moq) || 0).toLocaleString() + " units"} editing={editing} editValue={moq} onChange={persistMoq} suffix="units" source="manual" mono />
                  </ProdFieldGrid>
                  <p style={{ fontSize: 11, color: "hsl(var(--muted-fg))", margin: "8px 2px 0" }}>Size &amp; weight live in their own card below — with full change history.</p>
                </div>
                <div>
                  <div className="vy-kicker" style={{ marginBottom: 8 }}>Supplier</div>
                  <ProdFieldGrid cols={2}>
                    <ProdField label="Factory" value={fam.supplier} kind="text" placeholder="e.g. Ningbo Auto Co." editing={editing} editValue={fam.supplier || ""} onChange={(val) => setFamField("supplier", val)} source="manual" />
                    <ProdField label="Route" value={fam.supplierRoute} kind="text" placeholder="e.g. Direct supplier" editing={editing} editValue={fam.supplierRoute || ""} onChange={(val) => setFamField("supplierRoute", val)} source="manual" />
                    <ProdField label="Lead time" value={(Number(leadTime) || 0) + " days"} editing={editing} editValue={leadTime} onChange={persistLead} suffix="days" source="manual" mono />
                    <ProdField label="Last ordered" value={fam.lastOrdered} kind="text" placeholder="e.g. May 2026" editing={editing} editValue={fam.lastOrdered || ""} onChange={(val) => setFamField("lastOrdered", val)} source="manual" />
                  </ProdFieldGrid>
                </div>
              </div>
            </ProdCard>

            {/* Dimensions & weight (dual-unit + history) and Tech pack */}
            <ProdDimsCard family={fam} editing={editing} onLogNewSize={logNewSize} />
            <ProdTechPackCard family={fam} onAddVersion={addTechPack} />

            {/* Cost history */}
            <ProdCard icon="dollar" title="Cost history" sub="Last unit cost paid, per order" iconTone="muted">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {costHistory.length === 0 ? (
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", padding: "6px 0" }}>No cost history yet — it builds as you place orders for this product.</div>
                ) : costHistory.map((h, i) => {
                  const pct = Math.round((h.usd / maxHist) * 100);
                  const last = i === costHistory.length - 1;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 64, fontSize: 11.5, color: "hsl(var(--muted-fg))", flexShrink: 0 }}>{h.date}</span>
                      <div style={{ flex: 1, height: 8, borderRadius: 999, background: "hsl(var(--muted-bg))", overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: pct + "%", background: last ? "hsl(var(--primary))" : "hsl(var(--muted-fg) / 0.35)", borderRadius: 999 }} />
                      </div>
                      <span style={{ width: 56, textAlign: "right", fontSize: 12.5, fontWeight: 700, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{pmoney(h.usd)}</span>
                    </div>
                  );
                })}
              </div>
            </ProdCard>

            {/* Order history */}
            <ProdCard icon="cube" title="Order history" sub="Purchase orders that included this product">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {orderHistory.length === 0 ? (
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", padding: "6px 0" }}>Not ordered yet — orders that include this product will appear here.</div>
                ) : orderHistory.map((o) => (
                  <a
                    key={o.orderId}
                    href={"Vyonix Order Shell.html?order=" + encodeURIComponent(o.orderId)}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)", textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span className="vy-mono" style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{o.orderId}</span>
                        <span className={"vy-badge vy-badge--" + (ORDER_STATUS_TONE[o.status] || "muted")}>{o.status}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{o.title}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{o.qty.toLocaleString()}</div>
                      <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{o.date}</div>
                    </div>
                    <VyIcon name="arrowRight" size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                  </a>
                ))}
              </div>
            </ProdCard>
          </div>
        </main>
      </div>

      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Products" />

      {addOpen ? (
        <ProdAddVariantModal family={family} existingSkus={variants.map((v) => v.sku)} onClose={() => setAddOpen(false)} onAdd={handleAddVariant} />
      ) : null}

      {drawerSku ? (
        <ProdVariantDrawer
          variant={variants.find((v) => v.sku === drawerSku)}
          family={fam}
          eco={ecoForVariant(variants.find((v) => v.sku === drawerSku) || {})}
          sizeTier={ecoSizeTier} referralPct={ecoReferral} fbaFee={ecoFbaFee} storage={ecoStorage}
          editing={editing}
          onEditPrice={(val) => setVariant(drawerSku, "salePrice", val)}
          onLink={(asin, fnsku) => { setVariant(drawerSku, "asin", asin); setVariant(drawerSku, "fnsku", fnsku); }}
          onUnlink={() => { setVariant(drawerSku, "asin", "Pending sync"); setVariant(drawerSku, "fnsku", "Pending sync"); }}
          onPrep={(val) => setVariant(drawerSku, "prep", val)}
          onDelete={deleteVariant}
          onClose={() => setDrawerSku(null)}
        />
      ) : null}
    </div>
  );
}

const prodRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
prodRoot.render(<ProductPage />);
