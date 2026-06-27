// ----------------------------------------------------------------------
// FBA CALCULATOR — forward-looking sourcing tool
// ----------------------------------------------------------------------
// The Product page answers "did this SKU make money?" retrospectively.
// This answers "SHOULD I buy this?" BEFORE a PO: punch in a target sale
// price + a landed-cost buildup + dims/weight/category and get the Amazon
// fee stack, net/unit, margin %, ROI %, and the breakeven sale price.
//
// The fee model is intentionally IDENTICAL to product-app.jsx's so a SKU's
// numbers reconcile whether you view them here or on its Product page. It
// mirrors Amazon's 2026 non-peak US model closely enough to plan margins;
// exact per-ASIN fees would sync from the SP-API Product Fees endpoint.
//
// Exposes:
//   window.FbaCalculator      — the calculator body (React component)
//   window.FbaCalculatorPage  — full standalone page (chrome + body)
//   window.vyOpenFbaCalc(seed)— opens the modal anywhere it's loaded
// Self-mounts a modal root so ⌘K / buttons can call vyOpenFbaCalc().
// ----------------------------------------------------------------------

const { useState: useFcState, useEffect: useFcEffect, useMemo: useFcMemo } = React;

function fcMoney(n) {
  const v = Number(n) || 0;
  return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fcNum(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }

// ---- Fee model (mirrors product-app.jsx exactly) --------------------
function fcSizeTier(weightLbs, dims) {
  const [a, b, c] = [...dims].sort((x, y) => y - x);
  const w = fcNum(weightLbs);
  if (w <= 1 && a <= 15 && b <= 12 && c <= 0.75) return "Small standard";
  if (w <= 20 && a <= 18 && b <= 14 && c <= 8) return "Large standard";
  if (a >= 18 && a <= 37 && w <= 50) return "Small bulky";
  if (w <= 50) return "Large bulky";
  return "Extra-large";
}
function fcFulfillmentFee(weightLbs, dims) {
  const tier = fcSizeTier(weightLbs, dims);
  const w = fcNum(weightLbs);
  let base;
  if (tier === "Small standard") base = 3.30 + Math.max(0, w - 0.25) * 0.2;
  else if (tier === "Large standard") base = 4.98 + Math.max(0, w - 1) * 0.42;
  else if (tier === "Small bulky") base = 7.55 + Math.max(0, w - 3) * 0.30;
  else if (tier === "Large bulky") base = 9.61 + Math.max(0, w - 10) * 0.38;
  else base = 26.0 + w * 0.5;
  return Math.round(base * 1.035 * 100) / 100; // + 3.5% fuel surcharge
}
function fcCuFt(dims) { const [a, b, c] = dims; return (fcNum(a) * fcNum(b) * fcNum(c)) / 1728; }
function fcStorageRate(peak) { return peak ? 2.40 : 0.78; }
function fcStorageMo(dims, months, peak) {
  return Math.round(fcCuFt(dims) * fcStorageRate(peak) * Math.max(1, fcNum(months, 1)) * 100) / 100;
}

// Referral % by category. Automotive catalog categories sit at 15% to match
// product-app's fbaReferralPct (so SKU numbers reconcile); the rest are real
// Amazon 2026 reference rates the user can pick or override.
const FC_REFERRAL = {
  "Steering wheel covers": 0.15, "Seat covers": 0.15, "Seat cushions": 0.15,
  "Floor mats": 0.15, "Air fresheners": 0.15, "Accessories": 0.15,
  "Automotive & Powersports": 0.12, "Electronics": 0.08, "Home & Kitchen": 0.15,
  "Tools & Home Improvement": 0.15, "Sports & Outdoors": 0.15, "Pet Supplies": 0.15,
  "Toys & Games": 0.15, "Beauty & Personal Care": 0.08, "Grocery": 0.08,
  "Clothing & Accessories": 0.17, "Other (15%)": 0.15,
};
const FC_CATEGORIES = Object.keys(FC_REFERRAL);
function fcReferralPct(category) { return FC_REFERRAL[category] != null ? FC_REFERRAL[category] : 0.15; }

// Parse a catalog dims string "18 × 18 × 4 in" → ["18","18","4"]
function fcParseDims(dimStr) {
  const nums = String(dimStr || "").match(/[\d.]+/g);
  return nums ? nums.slice(0, 3) : [];
}

// ---- Verdict ---------------------------------------------------------
function fcVerdict(net, marginPct, roiPct) {
  if (marginPct == null) return { label: "Set a price", tone: "muted" };
  if (net <= 0) return { label: "Loss", tone: "danger" };
  if (marginPct < 15 || (roiPct != null && roiPct < 30)) return { label: "Thin", tone: "warning" };
  if (marginPct < 28) return { label: "Healthy", tone: "info" };
  return { label: "Strong", tone: "success" };
}

// ----------------------------------------------------------------------
// Small input atoms
// ----------------------------------------------------------------------
const fcInputBase = { height: 38, padding: "0 12px", fontSize: 14, fontWeight: 600, border: "1px solid hsl(var(--input))", borderRadius: 9, background: "hsl(var(--background))", color: "hsl(var(--foreground))", width: "100%", fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontVariantNumeric: "tabular-nums" };

function FcField({ label, hint, children, flex }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: flex || "1 1 auto", minWidth: 0 }}>
      <span className="vy-kicker" style={{ display: "flex", alignItems: "center", gap: 6 }}>{label}{hint ? <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "hsl(var(--muted-fg))", fontSize: 10.5 }}>{hint}</span> : null}</span>
      {children}
    </label>
  );
}

// number field with a left $ or right unit affix
function FcNum({ value, onChange, prefix, suffix, step = "0.01", min = "0", placeholder, autoFocus }) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {prefix ? <span style={{ position: "absolute", left: 12, fontSize: 13, color: "hsl(var(--muted-fg))", pointerEvents: "none", fontWeight: 600 }}>{prefix}</span> : null}
      <input
        type="number" step={step} min={min} value={value} placeholder={placeholder} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...fcInputBase, paddingLeft: prefix ? 24 : 12, paddingRight: suffix ? 38 : 12, textAlign: "right" }}
      />
      {suffix ? <span style={{ position: "absolute", right: 12, fontSize: 12, color: "hsl(var(--muted-fg))", pointerEvents: "none" }}>{suffix}</span> : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN CALCULATOR BODY
// ----------------------------------------------------------------------
function FbaCalculator({ compact, prefill }) {
  const seed = prefill || {};
  const [salePrice, setSalePrice] = useFcState(seed.salePrice != null ? String(seed.salePrice) : "");
  const [costMode, setCostMode] = useFcState(seed.landed != null ? "single" : "buildup");
  const [unitCost, setUnitCost] = useFcState(seed.unitCost != null ? String(seed.unitCost) : "");
  const [freightUnit, setFreightUnit] = useFcState(seed.freightUnit != null ? String(seed.freightUnit) : "");
  const [dutyPct, setDutyPct] = useFcState(seed.dutyPct != null ? String(seed.dutyPct) : "0");
  const [landedSingle, setLandedSingle] = useFcState(seed.landed != null ? String(seed.landed) : "");
  const seedDims = seed.dims ? fcParseDims(seed.dims) : [];
  const [dimL, setDimL] = useFcState(seedDims[0] || "");
  const [dimW, setDimW] = useFcState(seedDims[1] || "");
  const [dimH, setDimH] = useFcState(seedDims[2] || "");
  const [weight, setWeight] = useFcState(seed.weightLbs != null ? String(seed.weightLbs) : "");
  // Dims/weight input unit. Suppliers spec in metric (cm/kg); Amazon's fee model
  // is imperial (in/lb). We let you enter either and convert under the hood.
  const [unitSys, setUnitSys] = useFcState("imperial"); // 'imperial' (in/lb) | 'metric' (cm/kg)
  const [category, setCategory] = useFcState(FC_REFERRAL[seed.category] != null ? seed.category : "Other (15%)");
  const [referralPct, setReferralPct] = useFcState(String(Math.round(fcReferralPct(seed.category) * 1000) / 10));
  const [months, setMonths] = useFcState("2");
  const [peak, setPeak] = useFcState(() => { const m = new Date().getMonth(); return m >= 9 && m <= 11; });
  const [units, setUnits] = useFcState(seed.units != null ? String(seed.units) : "500");
  const [skuLabel] = useFcState(seed.label || "");

  // when the category changes, refresh the referral % to its preset
  function pickCategory(cat) { setCategory(cat); setReferralPct(String(Math.round(fcReferralPct(cat) * 1000) / 10)); }

  const m = useFcMemo(() => {
    const price = fcNum(salePrice);
    const landed = costMode === "single"
      ? fcNum(landedSingle)
      : fcNum(unitCost) + fcNum(freightUnit) + fcNum(unitCost) * (fcNum(dutyPct) / 100);
    // Convert to imperial (in/lb) for the Amazon fee model when entered in metric.
    const toIn = unitSys === "metric" ? (1 / 2.54) : 1;
    const toLb = unitSys === "metric" ? 2.2046226 : 1;
    const dims = [fcNum(dimL) * toIn, fcNum(dimW) * toIn, fcNum(dimH) * toIn];
    const wLb = fcNum(weight) * toLb;
    const ref = fcNum(referralPct) / 100;
    const tier = fcSizeTier(wLb, dims);
    const fbaFee = fcFulfillmentFee(wLb, dims);
    const storage = fcStorageMo(dims, months, peak);
    const referralFee = price * ref;
    const net = price - landed - referralFee - fbaFee - storage;
    const marginPct = price > 0 ? Math.round((net / price) * 1000) / 10 : null;
    const roiPct = landed > 0 ? Math.round((net / landed) * 1000) / 10 : null;
    const denom = 1 - ref;
    const breakeven = denom > 0 ? (landed + fbaFee + storage) / denom : null;
    const u = Math.max(0, Math.round(fcNum(units)));
    return {
      price, landed, dims, ref, tier, fbaFee, storage, referralFee, net, marginPct, roiPct, breakeven, u,
      hasDims: dims.some((x) => x > 0), weightLb: wLb, metric: unitSys === "metric",
      totalProfit: net * u, totalRevenue: price * u, totalLanded: landed * u,
      verdict: fcVerdict(net, marginPct, roiPct),
    };
  }, [salePrice, costMode, unitCost, freightUnit, dutyPct, landedSingle, dimL, dimW, dimH, weight, unitSys, referralPct, months, peak, units]);

  const vt = m.verdict.tone;
  const fams = (typeof catLoadFamilies === "function") ? catLoadFamilies() : (typeof CAT_FAMILIES !== "undefined" ? CAT_FAMILIES : []);

  function loadVariant(famId, sku) {
    const fam = fams.find((f) => f.id === famId);
    if (!fam) return;
    const v = (fam.variants || []).find((x) => x.sku === sku);
    if (!v) return;
    setCostMode("buildup");
    setUnitCost(v.lastCostUsd != null ? String(v.lastCostUsd) : "");
    setFreightUnit(""); setDutyPct("0");
    if (v.salePrice != null) setSalePrice(String(v.salePrice));
    const d = fcParseDims(fam.dims);
    setDimL(d[0] || ""); setDimW(d[1] || ""); setDimH(d[2] || "");
    setWeight(fam.weightLbs != null ? String(fam.weightLbs) : "");
    setUnitSys("imperial");
    pickCategory(FC_REFERRAL[fam.category] != null ? fam.category : "Other (15%)");
  }

  // ---- result row ----
  const Row = ({ label, value, minus, strong, tone, sub }) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: strong ? "12px 0 2px" : "8px 0", borderTop: strong ? "1.5px solid hsl(var(--border))" : "1px solid hsl(var(--border) / 0.5)" }}>
      <span style={{ fontSize: strong ? 14 : 12.5, fontWeight: strong ? 700 : 500, color: strong ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{label}{sub ? <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", marginLeft: 6, fontWeight: 500 }}>{sub}</span> : null}</span>
      <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontVariantNumeric: "tabular-nums", fontSize: strong ? 18 : 13.5, fontWeight: strong ? 800 : 600, color: tone ? "hsl(var(--" + tone + "))" : (strong ? "hsl(var(--" + vt + "))" : "hsl(var(--foreground))"), whiteSpace: "nowrap" }}>{minus && value > 0 ? "−" : ""}{fcMoney(value)}</span>
    </div>
  );

  const segBtn = (on) => ({ flex: 1, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "none", borderRadius: 7, background: on ? "hsl(var(--card))" : "transparent", color: on ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))", boxShadow: on ? "var(--shadow-sm)" : "none", transition: "all 120ms ease" });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16, alignItems: "start" }}>
      {/* ---------------- INPUTS ---------------- */}
      <div className="vy-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 15 }}>
        {fams.length ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="vy-kicker" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><VyIcon name="package" size={13} />Prefill from catalog</span>
            <select
              value=""
              onChange={(e) => { const [f, s] = e.target.value.split("\u241F"); if (f) loadVariant(f, s); }}
              style={{ flex: "1 1 200px", minWidth: 0, height: 34, padding: "0 10px", fontSize: 12.5, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
            >
              <option value="">Pick a variant…</option>
              {fams.map((f) => (
                <optgroup key={f.id} label={f.parent}>
                  {(f.variants || []).map((v) => <option key={v.sku} value={f.id + "\u241F" + v.sku}>{v.sku} · {(v.attrs && v.attrs.length ? v.attrs.map((a) => a.value).join(" ") : v.name) || v.sku}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        ) : null}

        {/* Sale price */}
        <FcField label="Target sale price" hint="what it lists for">
          <FcNum value={salePrice} onChange={setSalePrice} prefix="$" placeholder="49.99" autoFocus={!compact} />
        </FcField>

        {/* Landed cost */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span className="vy-kicker">Landed cost / unit</span>
            <div style={{ display: "flex", gap: 2, padding: 3, background: "hsl(var(--muted-bg))", borderRadius: 9 }}>
              <button type="button" style={segBtn(costMode === "buildup")} onClick={() => setCostMode("buildup")}>Build it up</button>
              <button type="button" style={segBtn(costMode === "single")} onClick={() => setCostMode("single")}>Single figure</button>
            </div>
          </div>
          {costMode === "buildup" ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <FcField label="Unit cost" flex="1 1 110px"><FcNum value={unitCost} onChange={setUnitCost} prefix="$" placeholder="3.07" /></FcField>
              <FcField label="Freight / unit" flex="1 1 110px"><FcNum value={freightUnit} onChange={setFreightUnit} prefix="$" placeholder="0.85" /></FcField>
              <FcField label="Duty" flex="1 1 90px"><FcNum value={dutyPct} onChange={setDutyPct} suffix="%" step="0.1" placeholder="0" /></FcField>
            </div>
          ) : (
            <FcField label="All-in landed cost"><FcNum value={landedSingle} onChange={setLandedSingle} prefix="$" placeholder="4.20" /></FcField>
          )}
          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", display: "flex", justifyContent: "space-between" }}>
            <span>Lands in your FBA warehouse cost</span>
            <strong style={{ fontFamily: "var(--font-mono, monospace)", color: "hsl(var(--foreground))" }}>{fcMoney(m.landed)}</strong>
          </div>
        </div>

        {/* Category + referral */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <FcField label="Category" flex="1 1 200px">
            <select value={category} onChange={(e) => pickCategory(e.target.value)} style={{ ...fcInputBase, fontFamily: "inherit", fontWeight: 600, textAlign: "left", paddingRight: 8 }}>
              {FC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FcField>
          <FcField label="Referral" hint="editable" flex="0 1 110px"><FcNum value={referralPct} onChange={setReferralPct} suffix="%" step="0.5" /></FcField>
        </div>

        {/* Physical */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span className="vy-kicker">Dimensions &amp; weight <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "hsl(var(--muted-fg))", fontSize: 10.5 }}>— sets the FBA size tier</span></span>
            <div style={{ display: "flex", gap: 2, padding: 3, background: "hsl(var(--muted-bg))", borderRadius: 9 }}>
              <button type="button" style={segBtn(unitSys === "metric")} onClick={() => setUnitSys("metric")} title="Supplier spec (centimeters / kilograms)">cm / kg</button>
              <button type="button" style={segBtn(unitSys === "imperial")} onClick={() => setUnitSys("imperial")} title="Amazon (inches / pounds)">in / lb</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <FcField label="Length" flex="1 1 80px"><FcNum value={dimL} onChange={setDimL} suffix={unitSys === "metric" ? "cm" : "in"} step="0.1" /></FcField>
            <FcField label="Width" flex="1 1 80px"><FcNum value={dimW} onChange={setDimW} suffix={unitSys === "metric" ? "cm" : "in"} step="0.1" /></FcField>
            <FcField label="Height" flex="1 1 80px"><FcNum value={dimH} onChange={setDimH} suffix={unitSys === "metric" ? "cm" : "in"} step="0.1" /></FcField>
            <FcField label="Weight" flex="1 1 90px"><FcNum value={weight} onChange={setWeight} suffix={unitSys === "metric" ? "kg" : "lb"} step={unitSys === "metric" ? "0.02" : "0.05"} /></FcField>
          </div>
          {m.metric && m.hasDims ? (
            <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", display: "flex", alignItems: "center", gap: 6 }}>
              <VyIcon name="arrowRight" size={11} style={{ opacity: 0.6 }} />
              <span>Amazon sees <strong style={{ color: "hsl(var(--foreground))", fontFamily: "var(--font-mono, monospace)" }}>{m.dims.map((x) => Math.round(x * 100) / 100).join(" × ")} in</strong>{m.weightLb > 0 ? <> · <strong style={{ color: "hsl(var(--foreground))", fontFamily: "var(--font-mono, monospace)" }}>{Math.round(m.weightLb * 100) / 100} lb</strong></> : null}</span>
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className={"vy-badge vy-badge--" + (m.hasDims ? "info" : "muted")}><VyIcon name="boxes" size={11} style={{ marginRight: 4, verticalAlign: "-1px" }} />{m.hasDims ? m.tier : "Enter dims for size tier"}</span>
            {m.hasDims ? <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{fcMoney(m.fbaFee)} fulfillment / unit</span> : null}
          </div>
        </div>

        {/* Storage assumption */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingTop: 4 }}>
          <span className="vy-kicker">Storage</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>Hold</span>
            <input type="number" min="1" max="12" value={months} onChange={(e) => setMonths(e.target.value)} style={{ width: 52, height: 32, padding: "0 8px", fontSize: 12.5, textAlign: "right", border: "1px solid hsl(var(--input))", borderRadius: 7, background: "hsl(var(--background))", color: "hsl(var(--foreground))" }} />
            <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>mo</span>
          </div>
          <button type="button" onClick={() => setPeak(!peak)} title="Q4 (Oct–Dec) storage costs ~3× more" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer", border: "1px solid " + (peak ? "hsl(var(--warning))" : "hsl(var(--border))"), background: peak ? "hsl(var(--warning) / 0.14)" : "transparent", color: peak ? "hsl(var(--warning))" : "hsl(var(--muted-fg))" }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: peak ? "hsl(var(--warning))" : "hsl(var(--muted-fg) / 0.4)" }}></span>Q4 peak rate
          </button>
          <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginLeft: "auto" }}>{fcMoney(m.storage)}/unit</span>
        </div>
      </div>

      {/* ---------------- RESULTS ---------------- */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 4 }}>
        {/* Headline */}
        <div className="vy-card" style={{ padding: "20px 22px", background: "hsl(var(--" + vt + ") / 0.07)", border: "1px solid hsl(var(--" + vt + ") / 0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span className="vy-kicker">Net profit / unit{skuLabel ? " · " + skuLabel : ""}</span>
            <span className={"vy-badge vy-badge--" + vt}>{m.verdict.label}</span>
          </div>
          <div style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: 40, fontWeight: 800, lineHeight: 1.05, color: "hsl(var(--" + vt + "))", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
            {m.marginPct == null ? "—" : fcMoney(m.net)}
          </div>
          <div style={{ display: "flex", gap: 22, marginTop: 14, flexWrap: "wrap" }}>
            {[
              { k: "Margin", v: m.marginPct == null ? "—" : m.marginPct + "%" },
              { k: "ROI", v: m.roiPct == null ? "—" : m.roiPct + "%" },
              { k: "Breakeven price", v: m.breakeven == null ? "—" : fcMoney(m.breakeven) },
            ].map((x) => (
              <div key={x.k}>
                <div className="vy-kicker">{x.k}</div>
                <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 18, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-unit waterfall */}
        <div className="vy-card" style={{ padding: "14px 20px 16px" }}>
          <div className="vy-kicker" style={{ marginBottom: 4 }}>Per-unit economics</div>
          <Row label="Sale price" value={m.price} tone="foreground" />
          <Row label="Landed cost" value={m.landed} minus tone="foreground" />
          <Row label={"Referral fee"} sub={Math.round(m.ref * 1000) / 10 + "%"} value={m.referralFee} minus tone="foreground" />
          <Row label="FBA fulfillment" sub={m.hasDims ? m.tier : undefined} value={m.fbaFee} minus tone="foreground" />
          <Row label="Storage" sub={months + " mo" + (peak ? " · Q4" : "")} value={m.storage} minus tone="foreground" />
          <Row label="Net per unit" value={m.net} strong />
        </div>

        {/* Order projection */}
        <div className="vy-card" style={{ padding: "14px 20px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <div className="vy-kicker">If you order</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="number" min="0" step="50" value={units} onChange={(e) => setUnits(e.target.value)} style={{ width: 90, height: 32, padding: "0 10px", fontSize: 13, fontWeight: 700, textAlign: "right", border: "1px solid hsl(var(--input))", borderRadius: 7, background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontFamily: "var(--font-mono, monospace)" }} />
              <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>units</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { k: "Cash in goods", v: fcMoney(m.totalLanded), tone: "foreground" },
              { k: "Revenue", v: fcMoney(m.totalRevenue), tone: "foreground" },
              { k: "Projected profit", v: fcMoney(m.totalProfit), tone: vt },
            ].map((x) => (
              <div key={x.k} style={{ padding: "10px 12px", borderRadius: 10, background: "hsl(var(--muted-bg) / 0.5)", border: "1px solid hsl(var(--border) / 0.6)" }}>
                <div className="vy-kicker">{x.k}</div>
                <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 15.5, fontWeight: 800, marginTop: 3, color: "hsl(var(--" + x.tone + "))", fontVariantNumeric: "tabular-nums" }}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", margin: "0 2px", lineHeight: 1.5 }}>
          FBA fees are 2026 non-peak US estimates from weight / size / category — the same model the Product page uses, so a SKU reconciles either way. Sync a Seller Central key for exact per-ASIN fees.
        </p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// STANDALONE PAGE (chrome + breadcrumb + calculator)
// ----------------------------------------------------------------------
function FbaCalculatorPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useFcState(false);
  const [mobileNavOpen, setMobileNavOpen] = useFcState(false);
  const [isDark, setIsDark] = useFcState(false);
  useFcEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  const params = new URLSearchParams(window.location.search);
  let prefill = null;
  const fams = (typeof catLoadFamilies === "function") ? catLoadFamilies() : (typeof CAT_FAMILIES !== "undefined" ? CAT_FAMILIES : []);
  const skuParam = params.get("sku");
  if (skuParam) {
    for (const f of fams) {
      const v = (f.variants || []).find((x) => x.sku === skuParam);
      if (v) { prefill = { salePrice: v.salePrice, unitCost: v.lastCostUsd, dims: f.dims, weightLbs: f.weightLbs, category: f.category, label: v.sku }; break; }
    }
  }

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="FBA calculator" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => { if (window.vyOpenSearch) window.vyOpenSearch(); }} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} workspaceName="Catalog" tabs={CATALOG_TABS} activeTab="" />
        <main className="vy-content">
          <div className="vy-content-inner">
            <nav className="vy-breadcrumb" aria-label="Breadcrumb">
              <a href="Vyonix Catalog.html" className="vy-bc-link">Catalog</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <span className="vy-bc-current" aria-current="page">FBA calculator</span>
            </nav>

            <section className="vy-card" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 13, minWidth: 0 }}>
                  <span style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="calculator" size={21} /></span>
                  <div style={{ minWidth: 0 }}>
                    <h1 className="vy-title" style={{ margin: 0 }}>FBA calculator</h1>
                    <p style={{ fontSize: 13, color: "hsl(var(--muted-fg))", margin: "6px 0 0", maxWidth: "62ch", lineHeight: 1.5 }}>
                      Sanity-check a product <strong style={{ color: "hsl(var(--foreground))", fontWeight: 600 }}>before you buy it.</strong> Target price + landed cost + dims → the Amazon fee stack, net margin, ROI and breakeven. Prefill from a catalog SKU or run the numbers on something new.
                    </p>
                  </div>
                </div>
                <span className="vy-badge vy-badge--brand" style={{ flexShrink: 0 }}><VyIcon name="boxes" size={11} style={{ marginRight: 4, verticalAlign: "-1px" }} />2026 fee model</span>
              </div>
            </section>

            <FbaCalculator prefill={prefill} />
          </div>
        </main>
      </div>
      {mobileNavOpen ? <VyMobileNav active="FBA calculator" onClose={() => setMobileNavOpen(false)} /> : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL — ⌘K / button launch anywhere this script is loaded
// ----------------------------------------------------------------------
function FbaCalcModalApp() {
  const [open, setOpen] = useFcState(false);
  const [seed, setSeed] = useFcState(null);
  const [openCount, setOpenCount] = useFcState(0);
  useFcEffect(() => {
    window.vyOpenFbaCalc = (s) => { setSeed(s || null); setOpenCount((n) => n + 1); setOpen(true); };
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!open) return null;
  const sku = seed && seed.label;
  const headTitle = sku ? "Reorder check" : "FBA calculator";
  const headSub = sku ? (sku + " · margin, ROI & breakeven before you commit") : "Should you buy it? — margin, ROI & breakeven before a PO";
  return ReactDOM.createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 9997, background: "hsl(0 0% 0% / 0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px 16px", overflowY: "auto" }}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 940, padding: 0, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="calculator" size={16} /></span>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{headTitle}</h3>
              <p style={{ margin: "1px 0 0", fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{headSub}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <a href="Vyonix FBA Calculator.html" className="vy-btn vy-btn--outline vy-btn--sm" style={{ textDecoration: "none" }}><VyIcon name="externalLink" size={13} /><span>Full page</span></a>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="vy-btn vy-btn--ghost vy-btn--icon"><VyIcon name="x" size={17} /></button>
          </div>
        </div>
        <div style={{ padding: "18px 20px", maxHeight: "78vh", overflowY: "auto" }}>
          <FbaCalculator key={openCount} compact prefill={seed} />
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---- Self-mount the modal root (so vyOpenFbaCalc works on any page) ----
(function fcMount() {
  function mount() {
    if (document.getElementById("vy-fba-calc-root")) return;
    const root = document.createElement("div");
    root.id = "vy-fba-calc-root";
    document.body.appendChild(root);
    ReactDOM.createRoot(root).render(<FbaCalcModalApp />);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

Object.assign(window, { FbaCalculator, FbaCalculatorPage, FbaCalcModalApp, fcReferralPct, fcSizeTier, fcFulfillmentFee });
