// variant-app.jsx — VariantPage: the full per-SKU dossier (route ?sku=&family=).
// The drawer on the Product page is the quick look; THIS is the SKU's own page:
// identity → live FBA position → unit economics → run-over-run order & cost
// history (the thing the family page can't show). Self-mounts on #vy-root.
//
// Loads after catalog-data, inventory-data, variant-data, product-extras.

const { useState: useVarState, useEffect: useVarEffect } = React;

const varMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
function vMoney(n) { return (n < 0 ? "−$" : "$") + Math.abs(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function vNum(n) { return Number(n || 0).toLocaleString(); }

// --- economics (mirrors product-app so the page agrees with the drawer) -------
function vSizeTier(weightLbs, dimStr) {
  const w = Number(weightLbs) || 0;
  const nums = (dimStr || "").match(/[\d.]+/g);
  let a = 0, b = 0, c = 0;
  if (nums && nums.length >= 3) { const s = nums.map(Number).sort((x, y) => y - x); a = s[0]; b = s[1]; c = s[2]; }
  if (w <= 1 && a <= 15 && b <= 12 && c <= 0.75) return "Small standard";
  if (w <= 20 && a <= 18 && b <= 14 && c <= 8) return "Large standard";
  if (a >= 18 && a <= 37 && w <= 50) return "Small bulky";
  if (w <= 50) return "Large bulky";
  return "Extra-large";
}
function vFbaFee(weightLbs, dimStr) {
  const tier = vSizeTier(weightLbs, dimStr);
  const w = Number(weightLbs) || 0;
  let base;
  if (tier === "Small standard") base = 3.30 + Math.max(0, w - 0.25) * 0.2;
  else if (tier === "Large standard") base = 4.98 + Math.max(0, w - 1) * 0.42;
  else if (tier === "Small bulky") base = 7.55 + Math.max(0, w - 3) * 0.30;
  else if (tier === "Large bulky") base = 9.61 + Math.max(0, w - 10) * 0.38;
  else base = 26.0 + w * 0.5;
  return Math.round(base * 1.035 * 100) / 100;
}
const V_REFERRAL = { "Seat covers": 0.15, "Steering covers": 0.15, "Floor mats": 0.15, "Air fresheners": 0.15, "Electronics": 0.08, "Accessories": 0.15 };
function vReferralPct(cat) { return V_REFERRAL[cat] != null ? V_REFERRAL[cat] : 0.15; }
function vStorage(dimStr) {
  const nums = (dimStr || "").match(/[\d.]+/g);
  if (!nums || nums.length < 3) return 0.20;
  const cf = (Number(nums[0]) * Number(nums[1]) * Number(nums[2])) / 1728;
  return Math.round(Math.max(0.05, cf * 0.78) * 100) / 100;
}
function vEco(v, family) {
  const cogs = Number(v.lastCostUsd) || 0;
  const hasPrice = v.salePrice != null && v.salePrice !== "" && Number(v.salePrice) > 0;
  const price = hasPrice ? Number(v.salePrice) : Math.round(cogs * 3 * 100) / 100;
  const referralPct = vReferralPct(family.category);
  const referralFee = Math.round(price * referralPct * 100) / 100;
  const fbaFee = vFbaFee(family.weightLbs, family.dims);
  const storage = vStorage(family.dims);
  const net = Math.round((price - cogs - referralFee - fbaFee - storage) * 100) / 100;
  const marginPct = price > 0 ? Math.round((net / price) * 100) : null;
  return { cogs, price, referralPct, referralFee, fbaFee, storage, net, marginPct, hasPrice };
}

function vMarginTone(m) { return m == null ? "muted" : m <= 0 ? "danger" : m < 20 ? "warning" : "success"; }
function vVariantLabel(v) { const p = (v.name || "").split("·"); return p.length > 1 ? p.slice(1).join("·").trim() : (v.pack || v.name || ""); }

// ---------------------------------------------------------------------------
function VarKpi({ label, value, sub, tone }) {
  return (
    <div className="vy-card vy-kpi">
      <span className="vy-kicker">{label}</span>
      <div style={{ ...varMono, fontSize: 23, fontWeight: 800, color: tone ? "hsl(var(--" + tone + "))" : undefined }}>{value}</div>
      {sub ? <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{sub}</span> : null}
    </div>
  );
}

function VarMoneyRow({ label, value, minus, strong, tone }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid hsl(var(--border) / 0.6)" }}>
      <span style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))" }}>{label}</span>
      <span style={{ ...varMono, fontSize: 13, fontWeight: strong ? 700 : 600, color: strong && tone ? "hsl(var(--" + tone + "))" : undefined }}>{minus ? "−" : ""}{vMoney(value)}</span>
    </div>
  );
}

function VariantPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useVarState(false);
  const [mobileNavOpen, setMobileNavOpen] = useVarState(false);
  const [isDark, setIsDark] = useVarState(false);
  useVarEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  const params = new URLSearchParams(window.location.search);
  const sku = params.get("sku");
  const families = (typeof catLoadFamilies === "function") ? catLoadFamilies() : (typeof CAT_FAMILIES !== "undefined" ? CAT_FAMILIES : []);
  let family = null, variant = null;
  for (const f of families) {
    const hit = (f.variants || []).find((v) => v.sku === sku);
    if (hit) { family = f; variant = hit; break; }
  }
  if (!family) { family = families[0]; variant = family && family.variants[0]; }

  const v = variant || {};
  const eco = vEco(v, family);
  const mtone = vMarginTone(eco.marginPct);
  const linked = v.asin && v.asin !== "Pending sync";
  const inv = (typeof varInventory === "function") ? varInventory(v.sku) : null;
  const hist = (typeof varHistory === "function") ? varHistory(v) : { runs: [], totals: null };
  const T = hist.totals;
  const famTitle = (family.parent || "") + (family.color ? " · " + family.color : "");
  const tierStr = vSizeTier(family.weightLbs, family.dims);

  const daysCover = inv ? inv.stats.daysCover : Infinity;
  const daysCoverStr = !isFinite(daysCover) ? "∞" : Math.round(daysCover) + "d";
  const availTone = inv ? (inv.stats.health === "Reorder" ? "danger" : inv.stats.health === "Low" ? "warning" : undefined) : undefined;

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Products" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => {}} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} workspaceName="Catalog" tabs={CATALOG_TABS} activeTab="products" />
        {typeof VyMobileNav === "function" ? <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Products" /> : null}

        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Breadcrumb */}
            <nav className="vy-breadcrumb" aria-label="Breadcrumb">
              <a href="Vyonix Catalog.html" className="vy-bc-link">Catalog</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <a href="Vyonix Catalog.html" className="vy-bc-link">Products</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <a href={"Vyonix Product.html?family=" + encodeURIComponent(family.id)} className="vy-bc-link">{famTitle}</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <span className="vy-bc-current" aria-current="page">{v.sku}</span>
            </nav>

            <div className="vy-page-body">
              {/* Header card */}
              <section className="vy-card" style={{ padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start", minWidth: 0 }}>
                    <image-slot id={"pvar-" + v.sku} style={{ width: "52px", height: "52px", flexShrink: 0 }} shape="rounded" radius="10" placeholder={v.sku}></image-slot>
                    <div style={{ minWidth: 0 }}>
                      <h1 className="vy-title" style={{ margin: 0, ...varMono, fontSize: 22 }}>{v.sku}</h1>
                      <div style={{ fontSize: 13.5, color: "hsl(var(--muted-fg))", marginTop: 3 }}>{family.parent}{vVariantLabel(v) ? " · " + vVariantLabel(v) : ""}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        {linked
                          ? <span className="vy-badge vy-badge--success"><VyIcon name="check" size={10} style={{ marginRight: 3, verticalAlign: "-1px" }} />Linked to Amazon</span>
                          : <span className="vy-badge vy-badge--warning"><VyIcon name="alert" size={10} style={{ marginRight: 3, verticalAlign: "-1px" }} />Not linked</span>}
                        <span className="vy-badge vy-badge--muted">{v.status}</span>
                        <span className="vy-chip"><VyIcon name="factory" size={11} />{family.supplier}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
                    <a href={"Vyonix Product.html?family=" + encodeURIComponent(family.id)} className="vy-btn vy-btn--outline" style={{ textDecoration: "none" }}><VyIcon name="catalog" size={14} /><span>Product</span></a>
                    <a href={"Vyonix Inventory.html?q=" + encodeURIComponent(v.sku)} className="vy-btn vy-btn--outline" style={{ textDecoration: "none" }}><VyIcon name="boxes" size={14} /><span>Inventory</span></a>
                    <button type="button" className="vy-btn vy-btn--primary" onClick={() => window.vyOpenFbaCalc && window.vyOpenFbaCalc({ salePrice: eco.hasPrice ? eco.price : undefined, unitCost: eco.cogs, dims: family.dims, weightLbs: family.weightLbs, category: family.category, label: v.sku })}><VyIcon name="calculator" size={14} /><span>Model reorder</span></button>
                  </div>
                </div>
              </section>

              {/* KPI strip */}
              <div className="vy-kpi-row">
                <VarKpi label="Net margin / unit" value={eco.marginPct == null ? "—" : vMoney(eco.net)} sub={eco.marginPct == null ? "set a sale price" : eco.marginPct + "% margin"} tone={mtone} />
                <VarKpi label="Available" value={inv ? vNum(inv.stats.available) : "—"} sub={inv ? (vNum(inv.row.onHand) + " on hand · " + vNum(inv.row.inbound) + " inbound") : "not linked"} tone={availTone} />
                <VarKpi label="Days of cover" value={inv ? daysCoverStr : "—"} sub={inv ? (inv.row.velocity + "/day velocity") : "—"} tone={availTone} />
                <VarKpi label="Avg landed / unit" value={T ? vMoney(T.avgLanded) : "—"} sub={T ? (T.runCount + " runs · " + vNum(T.totalUnits) + " units") : "no history"} />
              </div>

              {/* Two columns: position+economics | history */}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.25fr)", gap: 16, alignItems: "start" }}>

                {/* Left column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Live position */}
                  <section className="vy-card" style={{ padding: "18px 20px" }}>
                    <div className="vy-kicker" style={{ marginBottom: 12 }}>Live FBA position</div>
                    {inv ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                        {[["On hand", vNum(inv.row.onHand)], ["Available", vNum(inv.stats.available)], ["Reserved", vNum(inv.row.reserved)], ["Inbound", vNum(inv.row.inbound)], ["Reorder point", vNum(inv.row.reorderPoint)], ["Primary FC", inv.row.fc]].map(([l, val]) => (
                          <div key={l} style={{ flex: "1 1 88px", minWidth: 0 }}>
                            <div className="vy-kicker" style={{ marginBottom: 3 }}>{l}</div>
                            <div style={{ ...varMono, fontSize: 14.5, fontWeight: 700 }}>{val}</div>
                          </div>
                        ))}
                        <div style={{ flexBasis: "100%", height: 0 }} />
                        <span className={"vy-badge vy-badge--" + (INV_HEALTH_TONE ? INV_HEALTH_TONE[inv.stats.health] : "muted")}>{inv.stats.health}</span>
                        <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))", alignSelf: "center" }}>Stock &amp; velocity sync from Amazon{inv.row.unfulfillable ? " · " + inv.row.unfulfillable + " unfulfillable" : ""}</span>
                      </div>
                    ) : (
                      <div style={{ padding: "14px", border: "1px dashed hsl(var(--border))", borderRadius: 10, fontSize: 12.5, color: "hsl(var(--muted-fg))" }}>Not linked to an Amazon inventory record — link it on the product page to see live stock.</div>
                    )}
                  </section>

                  {/* Unit economics */}
                  <section className="vy-card" style={{ padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                      <div className="vy-kicker">Unit economics</div>
                      <span className={"vy-badge vy-badge--" + mtone}>{eco.marginPct == null ? "No price" : eco.marginPct + "% net"}</span>
                    </div>
                    <VarMoneyRow label="Sale price" value={eco.price} />
                    <VarMoneyRow label="COGS (landed unit cost)" value={eco.cogs} minus />
                    <VarMoneyRow label={"Referral fee (" + Math.round(eco.referralPct * 100) + "%)"} value={eco.referralFee} minus />
                    <VarMoneyRow label="FBA fulfilment fee" value={eco.fbaFee} minus />
                    <VarMoneyRow label="Storage / mo" value={eco.storage} minus />
                    <VarMoneyRow label="Net per unit" value={eco.net} strong tone={mtone} />
                    <p style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", margin: "10px 0 0", lineHeight: 1.45 }}>FBA fees are 2026 estimates from {tierStr.toLowerCase()} tier / weight / category. COGS = the SKU's last landed unit cost.</p>
                  </section>
                </div>

                {/* Right column — run history */}
                <section className="vy-card" style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                    <div className="vy-kicker">Order &amp; cost history</div>
                    {T ? <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{T.runCount} runs · avg landed {vMoney(T.avgLanded)}{T.costTrendPct !== 0 ? " · " : ""}{T.costTrendPct !== 0 ? <span style={{ color: T.costTrendPct > 0 ? "hsl(var(--danger))" : "hsl(var(--success))", fontWeight: 600 }}>{T.costTrendPct > 0 ? "▲" : "▼"} {Math.abs(T.costTrendPct)}% cost</span> : null}</span> : null}
                  </div>
                  <p style={{ fontSize: 11, color: "hsl(var(--muted-fg))", margin: "0 0 12px" }}>Every production run that included this SKU — units, what you were billed, landed cost that run, received into FBA, and sell-through.</p>

                  {hist.runs.length ? (
                    <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden" }}>
                      <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "hsl(var(--muted-bg) / 0.6)" }}>
                            <th style={varTh}>Run</th>
                            <th style={{ ...varTh, textAlign: "right" }}>Units</th>
                            <th style={{ ...varTh, textAlign: "right" }}>Billed/u</th>
                            <th style={{ ...varTh, textAlign: "right" }}>Landed/u</th>
                            <th style={{ ...varTh, textAlign: "right" }}>Received</th>
                            <th style={{ ...varTh, textAlign: "right" }}>Sold</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hist.runs.slice().reverse().map((r, i) => (
                            <tr key={i} style={{ borderTop: "1px solid hsl(var(--border))", background: r.current ? "hsl(var(--primary) / 0.04)" : undefined }}>
                              <td style={{ ...varTd }}>
                                <div style={{ fontWeight: 600 }}>{r.date}{r.current ? <span className="vy-badge vy-badge--info" style={{ marginLeft: 6, fontSize: 9 }}>latest</span> : null}</div>
                                <div style={{ ...varMono, fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{r.orderHref ? <a href={r.orderHref} style={{ color: "hsl(var(--primary))", textDecoration: "none" }}>{r.po}</a> : r.po}</div>
                              </td>
                              <td style={{ ...varTd, ...varMono, textAlign: "right" }}>{vNum(r.units)}</td>
                              <td style={{ ...varTd, ...varMono, textAlign: "right" }}>{vMoney(r.unitBilled)}</td>
                              <td style={{ ...varTd, ...varMono, textAlign: "right", fontWeight: 600 }}>{vMoney(r.landedUnit)}</td>
                              <td style={{ ...varTd, ...varMono, textAlign: "right" }}>{vNum(r.received)}{r.short > 0 ? <span className="vy-badge vy-badge--danger" style={{ marginLeft: 5, fontSize: 9 }}>{r.short} short</span> : null}</td>
                              <td style={{ ...varTd, textAlign: "right" }}><span className={"vy-badge vy-badge--" + (r.sellThrough >= 85 ? "success" : r.sellThrough >= 60 ? "warning" : "muted")}>{r.sellThrough}%</span></td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: "2px solid hsl(var(--border))", background: "hsl(var(--muted-bg) / 0.4)" }}>
                            <td style={{ ...varTd, fontWeight: 700 }}>All runs</td>
                            <td style={{ ...varTd, ...varMono, textAlign: "right", fontWeight: 700 }}>{vNum(T.totalUnits)}</td>
                            <td style={{ ...varTd, ...varMono, textAlign: "right", fontWeight: 700 }}>{vMoney(T.avgBilled)}</td>
                            <td style={{ ...varTd, ...varMono, textAlign: "right", fontWeight: 700 }}>{vMoney(T.avgLanded)}</td>
                            <td style={{ ...varTd, ...varMono, textAlign: "right", fontWeight: 700 }}>{vNum(T.totalReceived)}</td>
                            <td style={{ ...varTd, textAlign: "right", fontWeight: 700 }}>{T.avgSell}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: "16px", textAlign: "center", border: "1px dashed hsl(var(--border))", borderRadius: 10, fontSize: 12.5, color: "hsl(var(--muted-fg))" }}>No production runs recorded for this SKU yet.</div>
                  )}

                  {T ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14, paddingTop: 14, borderTop: "1px solid hsl(var(--border))" }}>
                      <div style={{ flex: "1 1 120px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Total spend</div><div style={{ ...varMono, fontSize: 16, fontWeight: 800 }}>{vMoney(T.totalSpend)}</div></div>
                      <div style={{ flex: "1 1 120px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Lifetime units</div><div style={{ ...varMono, fontSize: 16, fontWeight: 800 }}>{vNum(T.totalUnits)}</div></div>
                      <div style={{ flex: "1 1 120px" }}><div className="vy-kicker" style={{ marginBottom: 3 }}>Avg sell-through</div><div style={{ ...varMono, fontSize: 16, fontWeight: 800 }}>{T.avgSell}%</div></div>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const varTh = { padding: "9px 11px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "hsl(var(--muted-fg))" };
const varTd = { padding: "9px 11px", color: "hsl(var(--foreground))" };

const varRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
varRoot.render(<VariantPage />);
