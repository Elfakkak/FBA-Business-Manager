// product-extras.jsx — Product page add-ons: Dimensions & weight (dual-unit,
// metric primary + imperial below, with a version HISTORY of every size change)
// and Tech pack (versioned PDF uploads). Self-contained (pe* tokens + helpers);
// reads VyIcon (vy-shell). Parent (product-app.jsx) owns persistence and passes
// callbacks. Load AFTER catalog-data.jsx and BEFORE product-app.jsx.

const { useState: usePeState, useEffect: usePeEffect } = React;

const peMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
const peCM_PER_IN = 2.54;
const peKG_PER_LB = 0.45359237;

function peRound(n, d) { const p = Math.pow(10, d == null ? 1 : d); return Math.round((Number(n) || 0) * p) / p; }
function peInFromCm(cm) { return peRound((Number(cm) || 0) / peCM_PER_IN, 1); }
function peCmFromIn(inch) { return peRound((Number(inch) || 0) * peCM_PER_IN, 1); }
function peLbFromKg(kg) { return peRound((Number(kg) || 0) / peKG_PER_LB, 2); }
function peKgFromLb(lb) { return peRound((Number(lb) || 0) * peKG_PER_LB, 2); }
function peToday() { return new Date().toISOString().slice(0, 10); }

// Derive a display model from a family. Source of truth is metric when present
// (dimCm / weightKg); otherwise we back-fill from the legacy imperial fields
// (dims string in inches, weightLbs) so existing products still render.
function peDimModel(family) {
  const f = family || {};
  let cm = f.dimCm && (f.dimCm.l || f.dimCm.w || f.dimCm.h) ? { l: f.dimCm.l, w: f.dimCm.w, h: f.dimCm.h } : null;
  if (!cm && f.dims && /[\d.]/.test(f.dims)) {
    const nums = String(f.dims).match(/[\d.]+/g);
    if (nums && nums.length >= 3) cm = { l: peCmFromIn(nums[0]), w: peCmFromIn(nums[1]), h: peCmFromIn(nums[2]) };
  }
  const kg = (f.weightKg != null && f.weightKg !== "") ? Number(f.weightKg)
    : (f.weightLbs ? peKgFromLb(f.weightLbs) : null);
  return { cm, kg };
}

// The MASTER CARTON (shipping box): its own size + weight + how many units it
// holds. Distinct from the product unit above — drives CBM, freight and how
// many pieces arrive per box.
function peCartonModel(family) {
  const f = family || {};
  const c = f.cartonCm;
  const cm = c && (c.l || c.w || c.h) ? { l: c.l, w: c.w, h: c.h } : null;
  const kg = (f.cartonKg != null && f.cartonKg !== "") ? Number(f.cartonKg) : null;
  const units = (f.unitsPerCarton != null && f.unitsPerCarton !== "") ? Number(f.unitsPerCarton) : null;
  return { cm, kg, units };
}

function peDimCmStr(cm) {
  if (!cm) return "—";
  return [cm.l, cm.w, cm.h].map((n) => peRound(n, 1)).join(" × ") + " cm";
}
function peDimInStr(cm) {
  if (!cm) return null;
  return [cm.l, cm.w, cm.h].map((n) => peInFromCm(n)).join(" × ") + " in";
}

// A reusable dual-unit value: metric big, imperial small below. Used in the
// Details grid and the variant drawer for both dimensions and weight.
function PeDualValue({ metric, imperial, mono = true, big = 14.5 }) {
  return (
    <div style={{ lineHeight: 1.25 }}>
      <div style={{ fontSize: big, fontWeight: 700, ...(mono ? peMono : {}) }}>{metric}</div>
      {imperial ? <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", ...(mono ? peMono : {}) }}>{imperial}</div> : null}
    </div>
  );
}

// ----------------------------------------------------------------------
// AMAZON SIZE COMPLIANCE — is the box within Amazon's standard-size limit?
// Red reminder when it crosses into oversize or past the absolute maximum.
// Also shows the AWD carton ceiling as a reminder.
// ----------------------------------------------------------------------
function peSizeCheck(model) {
  if (!model) return null;
  const cm = model.cm;
  const lb = model.kg != null ? peLbFromKg(model.kg) : null;
  if (!cm && lb == null) return null;
  const STD = { long: 18, med: 14, short: 8, wt: 20 };   // US large-standard ceiling
  const AWD = { side: 25, wt: 50 };                       // AWD carton ceiling
  const MAX = { long: 108, girth: 165, wt: 150 };         // absolute FBA maximum
  let inDims = cm ? [cm.l, cm.w, cm.h].map(peInFromCm).sort((a, b) => b - a) : null;
  let level = "standard", tone = "success", label = "Within Amazon standard size", detail = "Inside the standard-size limit \u2014 lowest FBA fees.";
  if (inDims) {
    const [a, b, c] = inDims;
    const girth = a + 2 * (b + c);
    const overMax = a > MAX.long || girth > MAX.girth || (lb != null && lb > MAX.wt);
    const overStd = a > STD.long || b > STD.med || c > STD.short || (lb != null && lb > STD.wt);
    if (overMax) { level = "over-max"; tone = "danger"; label = "Exceeds Amazon maximum"; detail = "Over Amazon's absolute limit (108 in longest side \u00b7 165 in length+girth \u00b7 150 lb) \u2014 it won't be accepted."; }
    else if (overStd) { level = "oversize"; tone = "danger"; label = "Over standard \u2014 oversize"; detail = "Past the standard-size limit, so it ships at much higher oversize fees."; }
  } else if (lb != null) {
    if (lb > MAX.wt) { level = "over-max"; tone = "danger"; label = "Exceeds Amazon maximum weight"; detail = "Over the 150 lb limit \u2014 add dimensions for a full check."; }
    else if (lb > STD.wt) { level = "oversize"; tone = "danger"; label = "Over standard weight"; detail = "Weight is past the 20 lb standard limit \u2014 add dimensions for a full check."; }
    else { detail = "Within the 20 lb standard weight. Add dimensions for a full size check."; }
  }
  const stdOk = inDims ? (inDims[0] <= STD.long && inDims[1] <= STD.med && inDims[2] <= STD.short && (lb == null || lb <= STD.wt)) : (lb == null || lb <= STD.wt);
  const awdOk = inDims ? (inDims[0] <= AWD.side && (lb == null || lb <= AWD.wt)) : (lb == null || lb <= AWD.wt);
  return { level, tone, label, detail, stdOk, awdOk };
}

function PeLimitChip({ ok, label, spec, border }) {
  return (
    <div style={{ flex: "1 1 180px", minWidth: 0, padding: "9px 13px", borderLeft: border ? "1px solid hsl(var(--border) / 0.5)" : "none", display: "flex", alignItems: "center", gap: 8 }}>
      <VyIcon name={ok ? "check" : "x"} size={13} style={{ color: ok ? "hsl(var(--success, 142 71% 45%))" : "hsl(var(--danger, 0 72% 51%))", flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "hsl(var(--muted-fg))" }}>{label}</div>
        <div style={{ fontSize: 11.5, ...peMono, fontWeight: 600, color: ok ? "hsl(var(--muted-fg))" : "hsl(var(--danger, 0 72% 51%))" }}>{spec}</div>
      </div>
    </div>
  );
}

function PeSizeCompliance({ check }) {
  if (!check) return null;
  const c = check;
  const icon = c.level === "standard" ? "check" : "alert";
  return (
    <div style={{ marginTop: 12, borderRadius: 11, border: "1px solid hsl(var(--" + c.tone + ") / 0.3)", background: "hsl(var(--" + c.tone + ") / 0.06)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px" }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--" + c.tone + ") / 0.15)", color: "hsl(var(--" + c.tone + "))" }}><VyIcon name={icon} size={14} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "hsl(var(--" + c.tone + "))" }}>{c.label}</div>
          <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 1, lineHeight: 1.4 }}>{c.detail}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", borderTop: "1px solid hsl(var(--" + c.tone + ") / 0.2)" }}>
        <PeLimitChip ok={c.stdOk} label="Amazon standard max" spec="18 × 14 × 8 in · 20 lb" />
        <PeLimitChip ok={c.awdOk} label="AWD carton max" spec="≤ 25 in side · ≤ 50 lb" border />
      </div>
    </div>
  );
}

// One spec column (Product unit OR Master carton): size + weight, dual-unit.
function PeSpecBlock({ title, icon, cm, kg, extra }) {
  return (
    <div style={{ flex: "1 1 240px", minWidth: 0, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <VyIcon name={icon} size={13} style={{ color: "hsl(var(--info))" }} />
        <span style={{ fontSize: 11.5, fontWeight: 700 }}>{title}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 14px" }}>
        <div>
          <div className="vy-kicker" style={{ marginBottom: 4 }}>Size</div>
          <PeDualValue metric={peDimCmStr(cm)} imperial={peDimInStr(cm)} big={13.5} />
        </div>
        <div>
          <div className="vy-kicker" style={{ marginBottom: 4 }}>Weight</div>
          <PeDualValue metric={kg != null ? peRound(kg, 2) + " kg" : "\u2014"} imperial={kg != null ? peLbFromKg(kg) + " lb" : null} big={13.5} />
        </div>
        {extra ? <div style={{ gridColumn: "1 / -1" }}>{extra}</div> : null}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// DIMENSIONS & WEIGHT — current values (metric primary) + change history.
// "Log new size" snapshots the current values into history with a date+note.
// ----------------------------------------------------------------------
function ProdDimsCard({ family, editing, onLogNewSize }) {
  const [open, setOpen] = usePeState(false);
  const model = peDimModel(family);
  const carton = peCartonModel(family);
  const history = (family.dimHistory || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <section className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--info) / 0.12)", color: "hsl(var(--info))" }}><VyIcon name="cube" size={15} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="vy-kicker" style={{ marginBottom: 5 }}>Dimensions &amp; weight</div>
            <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>Metric is the master; inches &amp; pounds shown below. Every change is kept in history.</p>
          </div>
        </div>
        <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ flexShrink: 0, fontSize: 11.5 }} onClick={() => setOpen(true)}>
          <VyIcon name="plus" size={12} /><span>Log new size</span>
        </button>
      </div>

      {/* Current values — Product unit vs Master carton, plus pieces per box */}
      <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden", background: "hsl(var(--background) / 0.4)" }}>
        <PeSpecBlock title="Product — each unit" icon="package" cm={model.cm} kg={model.kg} />
        <div style={{ width: 1, alignSelf: "stretch", background: "hsl(var(--border))" }} />
        <PeSpecBlock
          title="Master carton — box"
          icon="boxes"
          cm={carton.cm}
          kg={carton.kg}
          extra={
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4, borderTop: "1px dashed hsl(var(--border))", marginTop: 2 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="boxes" size={12} /></span>
              <span className="vy-kicker">Pieces per box</span>
              <span style={{ marginLeft: "auto", ...peMono, fontSize: 16, fontWeight: 800, color: carton.units ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{carton.units != null ? carton.units : "\u2014"}</span>
            </div>
          }
        />
      </div>

      {/* Amazon size compliance — red reminder if over the standard / maximum */}
      <PeSizeCompliance check={peSizeCheck(model)} />

      {/* History */}
      <div style={{ marginTop: 16 }}>
        <div className="vy-kicker" style={{ marginBottom: 10 }}>Size &amp; weight history</div>
        {history.length === 0 ? (
          <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>No changes logged yet. When you optimize the size or weight, use <strong style={{ color: "hsl(var(--foreground))" }}>Log new size</strong> — the old values are saved here with the date.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {history.map((h, i) => {
              const cm = h.dimCm || null;
              const ccm = h.cartonCm && (h.cartonCm.l || h.cartonCm.w || h.cartonCm.h) ? h.cartonCm : null;
              const hasBox = ccm || h.cartonKg != null || h.unitsPerCarton != null;
              const current = i === 0;
              return (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid hsl(var(--border) / 0.6)" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 2 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: current ? "hsl(var(--primary))" : "hsl(var(--muted-fg) / 0.4)" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ ...peMono, fontSize: 11, color: "hsl(var(--muted-fg))", fontWeight: 600 }}>Product</span>
                      <span style={{ ...peMono, fontSize: 12.5, fontWeight: 700 }}>{peDimCmStr(cm)}</span>
                      <span style={{ ...peMono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>· {h.weightKg != null ? peRound(h.weightKg, 2) + " kg" : "—"}</span>
                      {current ? <span className="vy-badge vy-badge--success" style={{ fontSize: 9 }}>Current</span> : null}
                    </div>
                    <div style={{ ...peMono, fontSize: 10.5, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{peDimInStr(cm) || "—"}{h.weightKg != null ? " · " + peLbFromKg(h.weightKg) + " lb" : ""}</div>
                    {hasBox ? (
                      <div style={{ ...peMono, fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 4, display: "flex", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600 }}>Box</span>
                        <span>{peDimCmStr(ccm)}</span>
                        {h.cartonKg != null ? <span>· {peRound(h.cartonKg, 2)} kg</span> : null}
                        {h.unitsPerCarton != null ? <span>· {h.unitsPerCarton} pcs/box</span> : null}
                      </div>
                    ) : null}
                    {h.note ? <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 3 }}>{h.note}</div> : null}
                  </div>
                  <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))", flexShrink: 0, ...peMono }}>{h.date}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {open ? <ProdDimsModal family={family} model={model} carton={carton} onClose={() => setOpen(false)} onSubmit={(payload) => { onLogNewSize(payload); setOpen(false); }} /> : null}
    </section>
  );
}

function ProdDimsModal({ family, model, carton, onClose, onSubmit }) {
  const [l, setL] = usePeState(model.cm ? String(model.cm.l) : "");
  const [w, setW] = usePeState(model.cm ? String(model.cm.w) : "");
  const [h, setH] = usePeState(model.cm ? String(model.cm.h) : "");
  const [kg, setKg] = usePeState(model.kg != null ? String(model.kg) : "");
  const [cl, setCl] = usePeState(carton && carton.cm ? String(carton.cm.l) : "");
  const [cw, setCw] = usePeState(carton && carton.cm ? String(carton.cm.w) : "");
  const [ch, setCh] = usePeState(carton && carton.cm ? String(carton.cm.h) : "");
  const [ckg, setCkg] = usePeState(carton && carton.kg != null ? String(carton.kg) : "");
  const [units, setUnits] = usePeState(carton && carton.units != null ? String(carton.units) : "");
  const [note, setNote] = usePeState("");
  const valid = (l || w || h || kg || cl || cw || ch || ckg || units);

  const input = { width: "100%", height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", ...peMono };

  function submit() {
    onSubmit({
      dimCm: { l: Number(l) || 0, w: Number(w) || 0, h: Number(h) || 0 },
      weightKg: kg === "" ? null : (Number(kg) || 0),
      cartonCm: { l: Number(cl) || 0, w: Number(cw) || 0, h: Number(ch) || 0 },
      cartonKg: ckg === "" ? null : (Number(ckg) || 0),
      unitsPerCarton: units === "" ? null : (Number(units) || 0),
      note: note.trim(),
    });
  }

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 22px 12px", borderBottom: "1px solid hsl(var(--border))", position: "sticky", top: 0, background: "hsl(var(--card))", zIndex: 1 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Log new size</h3>
            <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "3px 0 0", maxWidth: "42ch" }}>Centimeters &amp; kilograms (inches/pounds auto-shown). Current values move into history.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* PRODUCT unit */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><VyIcon name="package" size={13} style={{ color: "hsl(var(--info))" }} /><span style={{ fontSize: 12.5, fontWeight: 700 }}>Product — each unit</span></div>
            <div className="vy-kicker" style={{ marginBottom: 6 }}>Dimensions (cm) — L × W × H</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min="0" step="0.1" value={l} onChange={(e) => setL(e.target.value)} placeholder="L" style={input} />
              <span style={{ color: "hsl(var(--muted-fg))" }}>×</span>
              <input type="number" min="0" step="0.1" value={w} onChange={(e) => setW(e.target.value)} placeholder="W" style={input} />
              <span style={{ color: "hsl(var(--muted-fg))" }}>×</span>
              <input type="number" min="0" step="0.1" value={h} onChange={(e) => setH(e.target.value)} placeholder="H" style={input} />
            </div>
            {(l || w || h) ? <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 5, ...peMono }}>= {[l, w, h].map((x) => peInFromCm(x)).join(" × ")} in</div> : null}
            <div className="vy-kicker" style={{ margin: "10px 0 6px" }}>Weight (kg)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="number" min="0" step="0.01" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="0.00" style={{ ...input, maxWidth: 140 }} />
              {kg ? <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", ...peMono }}>= {peLbFromKg(kg)} lb</span> : null}
            </div>
          </div>

          {/* MASTER CARTON */}
          <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><VyIcon name="boxes" size={13} style={{ color: "hsl(var(--info))" }} /><span style={{ fontSize: 12.5, fontWeight: 700 }}>Master carton — box</span></div>
            <div className="vy-kicker" style={{ marginBottom: 6 }}>Box dimensions (cm) — L × W × H</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min="0" step="0.1" value={cl} onChange={(e) => setCl(e.target.value)} placeholder="L" style={input} />
              <span style={{ color: "hsl(var(--muted-fg))" }}>×</span>
              <input type="number" min="0" step="0.1" value={cw} onChange={(e) => setCw(e.target.value)} placeholder="W" style={input} />
              <span style={{ color: "hsl(var(--muted-fg))" }}>×</span>
              <input type="number" min="0" step="0.1" value={ch} onChange={(e) => setCh(e.target.value)} placeholder="H" style={input} />
            </div>
            {(cl || cw || ch) ? <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 5, ...peMono }}>= {[cl, cw, ch].map((x) => peInFromCm(x)).join(" × ")} in</div> : null}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div className="vy-kicker" style={{ margin: "10px 0 6px" }}>Box weight (kg)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="number" min="0" step="0.01" value={ckg} onChange={(e) => setCkg(e.target.value)} placeholder="0.00" style={{ ...input, maxWidth: 120 }} />
                  {ckg ? <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", ...peMono }}>= {peLbFromKg(ckg)} lb</span> : null}
                </div>
              </div>
              <div>
                <div className="vy-kicker" style={{ margin: "10px 0 6px" }}>Pieces per box</div>
                <input type="number" min="0" step="1" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="e.g. 24" style={{ ...input, maxWidth: 120 }} />
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 14 }}>
            <div className="vy-kicker" style={{ marginBottom: 6 }}>Note (optional)</div>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Optimized carton — thinner packaging" style={{ ...input, fontFamily: "inherit" }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 22px 16px", borderTop: "1px solid hsl(var(--border))", position: "sticky", bottom: 0, background: "hsl(var(--card))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={submit}>
            <VyIcon name="check" size={14} /><span>Save size</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ----------------------------------------------------------------------
// TECH PACK — versioned PDF uploads. Latest is highlighted; older versions
// kept in a list. Files are stored as data URLs (prototype) with a size guard.
// ----------------------------------------------------------------------
function peFmtSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return peRound(bytes / 1024, 0) + " KB";
  return peRound(bytes / (1024 * 1024), 1) + " MB";
}

function ProdTechPackCard({ family, onAddVersion }) {
  const [open, setOpen] = usePeState(false);
  const packs = (family.techPacks || []).slice().sort((a, b) => (b.version || 0) - (a.version || 0));
  const latest = packs[0] || null;

  return (
    <section className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="fileText" size={15} /></span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Tech pack</h3>
            <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>The product spec (PDF) the factory builds to. Every upload is a new version — history is kept.</p>
          </div>
        </div>
        <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" style={{ flexShrink: 0, fontSize: 11.5 }} onClick={() => setOpen(true)}>
          <VyIcon name="arrowUpRight" size={12} /><span>Upload new version</span>
        </button>
      </div>

      {!latest ? (
        <div style={{ border: "1px dashed hsl(var(--border))", borderRadius: 12, padding: "26px 20px", textAlign: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, margin: "0 auto 10px", display: "grid", placeItems: "center", background: "hsl(var(--muted) / 0.5)", color: "hsl(var(--muted-fg))" }}><VyIcon name="fileText" size={19} /></div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>No tech pack uploaded yet</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "4px 0 14px" }}>Upload the product spec PDF. Re-upload anytime to add a new version.</div>
          <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" onClick={() => setOpen(true)}><VyIcon name="arrowUpRight" size={13} /><span>Upload tech pack</span></button>
        </div>
      ) : (
        <>
          {/* Latest version highlighted */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 11, border: "1px solid hsl(var(--primary) / 0.3)", background: "hsl(var(--primary) / 0.05)" }}>
            <span style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.14)", color: "hsl(var(--primary))" }}><VyIcon name="fileText" size={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>v{latest.version}</span>
                <span className="vy-badge vy-badge--primary" style={{ fontSize: 9 }}>Latest</span>
              </div>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{latest.fileName}{latest.size ? " · " + peFmtSize(latest.size) : ""} · {latest.date}</div>
              {latest.note ? <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{latest.note}</div> : null}
            </div>
            <PeTechPackOpen pack={latest} />
          </div>

          {/* Older versions */}
          {packs.length > 1 ? (
            <div style={{ marginTop: 14 }}>
              <div className="vy-kicker" style={{ marginBottom: 8 }}>Previous versions</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {packs.slice(1).map((p, i) => (
                  <div key={p.version} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid hsl(var(--border) / 0.6)" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--muted) / 0.5)", color: "hsl(var(--muted-fg))" }}><VyIcon name="fileText" size={14} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>v{p.version} <span style={{ fontWeight: 400, color: "hsl(var(--muted-fg))" }}>· {p.fileName}</span></div>
                      <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{p.date}{p.size ? " · " + peFmtSize(p.size) : ""}{p.note ? " · " + p.note : ""}</div>
                    </div>
                    <PeTechPackOpen pack={p} small />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {open ? <ProdTechPackModal nextVersion={(latest ? latest.version : 0) + 1} onClose={() => setOpen(false)} onSubmit={(payload) => { onAddVersion(payload); setOpen(false); }} /> : null}
    </section>
  );
}

// View / download a stored pack, or a disabled hint if the file wasn't kept.
function PeTechPackOpen({ pack, small }) {
  if (pack.dataUrl) {
    return (
      <a href={pack.dataUrl} target="_blank" rel="noopener" download={pack.fileName} className={"vy-btn vy-btn--outline" + (small ? " vy-btn--sm" : "")} style={{ textDecoration: "none", flexShrink: 0, fontSize: small ? 11.5 : undefined }}>
        <VyIcon name="arrowUpRight" size={small ? 12 : 14} /><span>{small ? "Open" : "View PDF"}</span>
      </a>
    );
  }
  return (
    <span title="File too large to store in the prototype — re-upload to view" style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", flexShrink: 0, textAlign: "right", maxWidth: 92, lineHeight: 1.25 }}>
      Record only — re-upload to view
    </span>
  );
}

function ProdTechPackModal({ nextVersion, onClose, onSubmit }) {
  const [file, setFile] = usePeState(null);
  const [dataUrl, setDataUrl] = usePeState(null);
  const [reading, setReading] = usePeState(false);
  const [note, setNote] = usePeState("");
  const inputRef = React.useRef(null);

  function pick(f) {
    if (!f) return;
    setFile(f);
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => { setDataUrl(reader.result); setReading(false); };
    reader.onerror = () => { setDataUrl(null); setReading(false); };
    reader.readAsDataURL(f);
  }

  function submit() {
    if (!file) return;
    // Guard localStorage: only persist the file body if it's reasonably small
    // (~1.5MB of base64). Larger ones keep the version record but not the bytes.
    const keep = dataUrl && dataUrl.length < 2_000_000;
    onSubmit({
      version: nextVersion,
      fileName: file.name,
      size: file.size,
      date: peToday(),
      note: note.trim(),
      dataUrl: keep ? dataUrl : null,
      sessionUrl: !keep && dataUrl ? dataUrl : null, // available this session only
    });
  }

  const input = { width: "100%", height: 38, padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };
  const big = file && file.size > 1.5 * 1024 * 1024;

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 460, padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 22px 12px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Upload tech pack · v{nextVersion}</h3>
            <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "3px 0 0", maxWidth: "42ch" }}>Pick the PDF spec. It's saved as version {nextVersion}; older versions stay in history.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={(e) => pick(e.target.files && e.target.files[0])} />
          {!file ? (
            <button type="button" onClick={() => inputRef.current && inputRef.current.click()} style={{ border: "1px dashed hsl(var(--border))", borderRadius: 12, padding: "26px 20px", textAlign: "center", background: "hsl(var(--background) / 0.4)", cursor: "pointer", color: "inherit" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, margin: "0 auto 10px", display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="arrowUpRight" size={19} /></div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Choose a PDF</div>
              <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 3 }}>Click to browse</div>
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="fileText" size={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{peFmtSize(file.size)}{reading ? " · reading…" : ""}</div>
              </div>
              <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={() => inputRef.current && inputRef.current.click()}>Change</button>
            </div>
          )}
          {big ? <div style={{ fontSize: 11, color: "hsl(var(--warning))", lineHeight: 1.45 }}>Heads up: this file is large, so the prototype keeps the version record (name, date, note) but not the file bytes after reload. The real app stores the file.</div> : null}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 6 }}>What changed (optional)</div>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Updated stitching spec + new colorway" style={input} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 22px 16px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!file || reading} style={(!file || reading) ? { opacity: 0.5, cursor: "not-allowed" } : undefined} onClick={submit}>
            <VyIcon name="check" size={14} /><span>Save v{nextVersion}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

Object.assign(window, {
  peDimModel, peDimCmStr, peDimInStr, peInFromCm, peLbFromKg, peKgFromLb, peToday, peRound,
  peSizeCheck, PeSizeCompliance,
  PeDualValue, ProdDimsCard, ProdTechPackCard,
});
