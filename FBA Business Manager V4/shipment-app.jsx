// shipment-app.jsx — full detail PAGE for one freight shipment.
// Route: Vyonix Shipment.html?shipment=<id>. The list-row title links here;
// the list still opens the quick "resume" drawer. This page is the deep view:
// header, KPI strip, full tracking timeline, editable logistics + cargo, FBA
// inbounds, and the linked order. Reuses logistics-data + tracking-data globals.
// Load AFTER logistics-data.jsx, tracking-data.jsx, integrations-data.jsx.

const { useState: useShState, useEffect: useShEffect } = React;

const shMono = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" };
function shMoney(n) { return n ? "$" + Number(n).toLocaleString() : "—"; }

// Incoterm → who clears customs + pays import duties, and whether YOU need a
// broker. The single most important thing the term decides for an importer.
function shIncoterm(term) {
  const t = (term || "").toUpperCase();
  const map = {
    DDP: { customsBy: "Seller / forwarder", dutiesBy: "Seller / forwarder", needsBroker: false, tone: "success", blurb: "Delivered Duty Paid — the seller/forwarder clears customs and pays all duties & taxes. Nothing more for you at the border; it's baked into the freight price." },
    DAP: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Delivered At Place — the forwarder delivers, but YOU are importer of record: you clear customs and pay duties & taxes on arrival. Line up a customs broker." },
    DDU: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Delivered Duty Unpaid (now DAP) — you pay import duties & taxes and clear customs. Use a broker." },
    CIF: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Cost, Insurance & Freight — seller covers freight to the destination port; you handle import customs, duties and final delivery. Broker needed." },
    CFR: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Cost & Freight — seller pays freight to the port; you handle import customs + duties. Broker needed." },
    FOB: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "warning", blurb: "Free On Board — your responsibility starts at the origin port: ocean freight, import customs and duties are yours. Broker needed." },
    EXW: { customsBy: "You (buyer)", dutiesBy: "You (buyer)", needsBroker: true, tone: "danger", blurb: "Ex Works — you handle everything from the factory door: export + import customs, freight and all duties. Broker needed." },
  };
  return map[t] || { customsBy: "—", dutiesBy: "—", needsBroker: true, tone: "muted", blurb: "Set the incoterm to see who clears customs and pays import duties." };
}
const shInput = { width: "100%", height: 34, padding: "0 10px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 7, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

function ShCard({ title, sub, actions, icon, iconTone = "primary", children, pad = "16px 18px" }) {
  return (
    <section className="vy-card" style={{ padding: pad }}>
      {(title || actions) ? (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: children ? 14 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {icon ? <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--" + iconTone + ") / 0.12)", color: "hsl(var(--" + iconTone + "))" }}><VyIcon name={icon} size={15} /></span> : null}
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

// A label/value cell that turns into an input under edit mode.
function ShField({ label, value, mono, editing, name, form, setForm, suffix, type }) {
  return (
    <div style={{ flex: "1 1 140px", minWidth: 0, padding: "12px 14px" }}>
      <div className="vy-kicker" style={{ marginBottom: 5 }}>{label}</div>
      {editing && name ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type={type || "text"} value={form[name] != null ? form[name] : ""} onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))} style={{ ...shInput, ...(mono ? shMono : {}) }} />
          {suffix ? <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>{suffix}</span> : null}
        </div>
      ) : (
        <div style={{ fontSize: 13.5, fontWeight: 600, ...(mono ? shMono : {}) }}>{value}</div>
      )}
    </div>
  );
}

function ShGrid({ children, cols = 3 }) {
  const arr = React.Children.toArray(children);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(" + cols + ", minmax(0, 1fr))", border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden", background: "hsl(var(--background) / 0.4)" }}>
      {arr.map((child, i) => (
        <div key={i} style={{ borderLeft: i % cols === 0 ? "none" : "1px solid hsl(var(--border))", borderTop: i >= cols ? "1px solid hsl(var(--border))" : "none" }}>{child}</div>
      ))}
    </div>
  );
}

function ShipmentPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useShState(false);
  const [mobileNavOpen, setMobileNavOpen] = useShState(false);
  const [isDark, setIsDark] = useShState(false);
  const [editing, setEditing] = useShState(false);
  const [toast, setToast] = useShState(null);
  const [trkTick, setTrkTick] = useShState(0);
  const [syncing, setSyncing] = useShState(false);

  const params = new URLSearchParams(window.location.search);
  const shipId = params.get("shipment");
  const all = logAllShipments();
  const [s, setS] = useShState(() => all.find((x) => x.id === shipId) || all[0] || null);

  const [form, setForm] = useShState(() => {
    const cur = (all.find((x) => x.id === shipId) || all[0] || {});
    const f = {};
    (window.LOG_EDITABLE || []).forEach((k) => { f[k] = cur[k] != null ? cur[k] : ""; });
    f.broker = cur.broker != null ? cur.broker : "";
    f.dutiesUsd = cur.dutiesUsd != null ? cur.dutiesUsd : "";
    return f;
  });

  useShEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);
  useShEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  if (!s) {
    return (
      <div className="vy-app">
        <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} active="Shipments" />
        <div className="vy-app-main">
          <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} />
          <main className="vy-content"><div className="vy-content-inner">
            <div className="vy-card" style={{ padding: 40, textAlign: "center" }}>
              <p style={{ color: "hsl(var(--muted-fg))" }}>Shipment not found.</p>
              <a href="Vyonix Shipments.html" className="vy-btn vy-btn--primary" style={{ textDecoration: "none", marginTop: 12 }}>Back to Shipments</a>
            </div>
          </div></main>
        </div>
      </div>
    );
  }

  const fstats = logShipFbaStats(s);
  const info = trkInfo(s);
  const events = trkEvents(s);
  const tstatus = trkStatus(s);
  const effStage = trkStage(s);
  const currentIdx = LOG_STAGES.indexOf(effStage);
  const hasTracking = !!info.trackingNo;
  const atEnd = currentIdx >= LOG_STAGES.length - 1;
  const t17Connected = (typeof intg17TrackConnected === "function") ? intg17TrackConnected() : false;

  function refreshTrk() { setTrkTick((n) => n + 1); setS(logAllShipments().find((x) => x.id === s.id) || s); }
  function doSync() { if (!hasTracking) return; setSyncing(true); setTimeout(() => { trkSyncNow(s); setSyncing(false); refreshTrk(); setToast("Synced from 17TRACK"); }, 900); }
  function doAdvance() { if (trkAdvance(s)) { refreshTrk(); setToast("Advanced to next checkpoint"); } }

  function saveEdits() {
    const patch = {};
    (window.LOG_EDITABLE || []).forEach((k) => {
      let v = form[k];
      if (["cbm", "grossKg", "cartons", "packed", "freightUsd"].includes(k)) v = v === "" ? 0 : Number(v) || 0;
      patch[k] = v;
    });
    patch.broker = (form.broker || "").toString().trim();
    patch.dutiesUsd = form.dutiesUsd === "" ? 0 : Number(form.dutiesUsd) || 0;
    logSaveEdit(s.id, patch);
    setS(logAllShipments().find((x) => x.id === s.id) || s);
    setEditing(false);
    setToast("Shipment updated");
  }
  function cancelEdits() {
    const f = {};
    (window.LOG_EDITABLE || []).forEach((k) => { f[k] = s[k] != null ? s[k] : ""; });
    f.broker = s.broker != null ? s.broker : "";
    f.dutiesUsd = s.dutiesUsd != null ? s.dutiesUsd : "";
    setForm(f);
    setEditing(false);
  }

  const kpis = [
    { label: "Stage", value: effStage, sub: "ETA " + s.eta, tone: LOG_STAGE_TONE[effStage] },
    { label: "Packed", value: (Number(s.packed) || 0).toLocaleString(), sub: "units" },
    { label: "Volume", value: (s.cbm || "—") + (s.cbm ? " CBM" : ""), sub: (s.grossKg ? s.grossKg + " kg" : "—") },
    { label: "Cartons", value: s.cartons || "—", sub: "boxes" },
    { label: "Freight", value: shMoney(s.freightUsd), sub: s.incoterm },
    { label: "FBA received", value: fstats.received + " / " + fstats.expected, sub: fstats.inbounds + " inbound" + (fstats.inbounds === 1 ? "" : "s"), tone: fstats.inbounds ? (fstats.received >= fstats.expected && fstats.expected > 0 ? "success" : "info") : null },
  ];

  return (
    <div className="vy-app">
      <VySidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} onNavigate={() => setMobileNavOpen(false)} active="Shipments" />
      <div className="vy-app-main">
        <VyHeader onToggleMobileNav={() => setMobileNavOpen(true)} onOpenSearch={() => {}} onToggleTheme={() => setIsDark(!isDark)} isDark={isDark} onToggleActivity={() => {}} workspaceName="Operations" tabs={[{ key: "ship", label: "Shipment" }]} activeTab="ship" />
        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Breadcrumb */}
            <nav className="vy-breadcrumb" aria-label="Breadcrumb">
              <a href="Vyonix Shipments.html" className="vy-bc-link">Operations</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <a href="Vyonix Shipments.html" className="vy-bc-link">Shipments</a>
              <VyIcon name="chevronRight" size={11} style={{ opacity: 0.5 }} />
              <span className="vy-bc-current" aria-current="page">{s.id}</span>
            </nav>

            {/* Header */}
            <section className="vy-card" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h1 className="vy-title" style={{ margin: 0, ...shMono }}>{s.id}</h1>
                    <span className={"vy-badge vy-badge--" + LOG_STAGE_TONE[effStage]}>{effStage}</span>
                    <span className={"vy-badge vy-badge--" + LOG_CUSTOMS_TONE[s.customs]}>Customs: {s.customs === "—" ? "n/a" : s.customs}</span>
                    {s.isDraft ? <span className="vy-badge vy-badge--brand">New</span> : null}
                  </div>
                  <div className="vy-title-meta" style={{ marginTop: 12 }}>
                    <span className="vy-chip"><VyIcon name="ship" size={11} />{s.mode}</span>
                    <span className="vy-chip"><VyIcon name="mapPin" size={11} />{s.origin} → {s.destination}</span>
                    <span className="vy-chip"><VyIcon name="factory" size={11} />{s.supplier}</span>
                    <span className="vy-chip"><VyIcon name="truck" size={11} />{s.forwarder}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(s.orderId)} className="vy-btn vy-btn--primary" style={{ textDecoration: "none" }}>
                    <VyIcon name="cube" size={13} /><span>Open in order</span>
                  </a>
                  {editing ? (
                    <>
                      <button type="button" className="vy-btn vy-btn--ghost" onClick={cancelEdits}>Cancel</button>
                      <button type="button" className="vy-btn vy-btn--primary" onClick={saveEdits}><VyIcon name="check" size={13} /><span>Save</span></button>
                    </>
                  ) : (
                    <button type="button" className="vy-btn vy-btn--outline" onClick={() => setEditing(true)}><VyIcon name="pencil" size={13} /><span>Edit</span></button>
                  )}
                </div>
              </div>
            </section>

            {/* KPI strip */}
            <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              {kpis.map((k) => (
                <div className={"vy-card vy-kpi" + (k.tone ? " vy-kpi--" + k.tone : "")} key={k.label}>
                  <span className="vy-kicker">{k.label}</span>
                  <div className="vy-kpi-value" style={{ fontSize: 18, color: k.tone ? "hsl(var(--" + k.tone + "))" : undefined }}>{k.value}</div>
                  <div className="vy-kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }} className="sh-two-col">
              {/* Tracking */}
              <ShCard icon="mapPin" iconTone="info" title="Tracking" sub="Forwarder leg — vessel/air until Amazon takes custody at the FC."
                actions={
                  <div style={{ display: "flex", gap: 6 }}>
                    {hasTracking && t17Connected ? <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" disabled={syncing} onClick={doSync}><VyIcon name={syncing ? "activity" : "refresh"} size={12} /><span>{syncing ? "Syncing…" : "Sync"}</span></button> : null}
                    {hasTracking && !atEnd ? <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={doAdvance}><VyIcon name="arrowRight" size={12} /><span>Advance</span></button> : null}
                  </div>
                }
              >
                {hasTracking ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span className={"vy-badge vy-badge--" + tstatus.tone}>{tstatus.label}</span>
                      <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))", ...shMono }}>{info.trackingNo}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{t17Connected ? "17TRACK · " + trkAgo(info.lastSync || Date.now()) : "17TRACK not connected"}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {events.map((e, i) => {
                        const color = e.done ? (e.cur ? "hsl(var(--primary))" : "hsl(var(--success))") : "hsl(var(--border))";
                        return (
                          <div key={e.stage} style={{ display: "flex", gap: 12, minHeight: 34 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                              <span style={{ width: 12, height: 12, borderRadius: 999, background: e.done ? color : "hsl(var(--card))", border: "2px solid " + color, flexShrink: 0, marginTop: 4 }} />
                              {i < events.length - 1 ? <span style={{ width: 2, flex: 1, background: e.done && events[i + 1].done ? "hsl(var(--success))" : "hsl(var(--border))", margin: "2px 0" }} /> : null}
                            </div>
                            <div style={{ paddingBottom: i < events.length - 1 ? 12 : 0, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: e.cur ? 700 : 600, color: e.cur ? "hsl(var(--primary))" : e.done ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{e.label}</div>
                              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{e.done ? <>{e.timeLabel} · {e.location}</> : <span style={{ fontStyle: "italic" }}>{e.location} · pending</span>}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!t17Connected ? <a href="Vyonix Settings.html?section=integrations" className="vy-btn vy-btn--outline vy-btn--sm" style={{ marginTop: 12 }}><VyIcon name="link" size={12} /><span>Connect 17TRACK</span></a> : null}
                  </>
                ) : (
                  <div style={{ padding: "20px", borderRadius: 10, border: "1px dashed hsl(var(--border))", textAlign: "center" }}>
                    <div style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))" }}>No tracking number yet. Add one in the list's quick view once the forwarder books this shipment.</div>
                  </div>
                )}
              </ShCard>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Logistics */}
                <ShCard icon="truck" title="Logistics" iconTone="primary">
                  <ShGrid cols={2}>
                    <ShField label="ETD" value={s.etd} mono editing={editing} name="etd" form={form} setForm={setForm} />
                    <ShField label="ETA" value={s.eta} mono editing={editing} name="eta" form={form} setForm={setForm} />
                    <ShField label="Mode" value={s.mode} editing={editing} name="mode" form={form} setForm={setForm} />
                    <ShField label="Forwarder" value={s.forwarder} editing={editing} name="forwarder" form={form} setForm={setForm} />
                    <ShField label="Incoterm" value={s.incoterm} editing={editing} name="incoterm" form={form} setForm={setForm} />
                    <ShField label="BOL / AWB" value={s.bol} mono editing={editing} name="bol" form={form} setForm={setForm} />
                  </ShGrid>
                </ShCard>

                {/* Cargo */}
                <ShCard icon="boxes" title="Cargo" iconTone="muted-fg">
                  <ShGrid cols={2}>
                    <ShField label="Packed (units)" value={(Number(s.packed) || 0).toLocaleString()} mono editing={editing} name="packed" form={form} setForm={setForm} type="number" />
                    <ShField label="CBM" value={s.cbm || "—"} mono editing={editing} name="cbm" form={form} setForm={setForm} type="number" />
                    <ShField label="Gross (kg)" value={s.grossKg ? s.grossKg + " kg" : "—"} mono editing={editing} name="grossKg" form={form} setForm={setForm} type="number" />
                    <ShField label="Cartons" value={s.cartons || "—"} mono editing={editing} name="cartons" form={form} setForm={setForm} type="number" />
                    <ShField label="Freight (USD)" value={shMoney(s.freightUsd)} mono editing={editing} name="freightUsd" form={form} setForm={setForm} type="number" />
                  </ShGrid>
                </ShCard>
              </div>
            </div>

            {/* Customs & duties — incoterm-aware */}
            {(() => {
              const r = shIncoterm(s.incoterm);
              const tv = r.tone === "muted" ? "muted-fg" : r.tone;
              return (
                <ShCard icon="shield" iconTone={r.tone === "muted" ? "primary" : r.tone} title="Customs & duties" sub="Who clears customs and pays import duties — decided by the incoterm.">
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 11, border: "1px solid hsl(var(--" + tv + ") / 0.3)", background: "hsl(var(--" + tv + ") / 0.06)", marginBottom: 14 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--" + tv + ") / 0.15)", color: "hsl(var(--" + tv + "))" }}><VyIcon name={r.needsBroker ? "alert" : "check"} size={15} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="vy-badge vy-badge--info">{s.incoterm}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "hsl(var(--" + tv + "))" }}>{r.needsBroker ? "You clear & pay import" : "Seller / forwarder handles import"}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 4, lineHeight: 1.45 }}>{r.blurb}</div>
                    </div>
                  </div>
                  <ShGrid cols={2}>
                    <ShField label="Customs cleared by" value={r.customsBy} />
                    <ShField label="Duties & taxes paid by" value={r.dutiesBy} />
                    <ShField label="Customs broker" value={s.broker || (r.needsBroker ? "— (recommended)" : "Not needed")} editing={editing} name="broker" form={form} setForm={setForm} />
                    <ShField label="Duties & taxes (USD)" value={s.dutiesUsd ? shMoney(s.dutiesUsd) : (r.needsBroker ? "—" : "In freight price")} mono editing={editing} name="dutiesUsd" form={form} setForm={setForm} type="number" />
                  </ShGrid>
                </ShCard>
              );
            })()}

            {/* FBA inbounds */}
            <ShCard icon="cube" iconTone="success" title={"FBA inbounds · Amazon leg (" + fstats.inbounds + ")"} sub="Once cargo reaches the FC, Amazon owns the receive — these sync from Seller Central."
              actions={fstats.inbounds ? <a href={"Vyonix FBA Shipments.html?shipment=" + encodeURIComponent(s.id)} className="vy-btn vy-btn--outline vy-btn--sm" style={{ textDecoration: "none" }}><span>View all</span><VyIcon name="arrowRight" size={12} /></a> : null}
            >
              {fstats.inbounds ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {s.fba.map((f) => {
                    const variance = f.received > 0 ? f.received - f.expected : 0;
                    const vTone = f.received <= 0 ? "hsl(var(--muted-fg))" : variance < 0 ? "hsl(var(--danger))" : variance > 0 ? "hsl(var(--warning))" : "hsl(var(--success))";
                    return (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "11px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
                        <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                          <div style={{ ...shMono, fontWeight: 700, fontSize: 12.5 }}>{f.id}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <span className="vy-badge vy-badge--muted">{f.fc}</span>
                            <span className={"vy-badge vy-badge--" + LOG_FBA_TONE[f.amazonStatus]}>{f.amazonStatus}</span>
                            <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{f.skuCount} SKU{f.skuCount === 1 ? "" : "s"}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 18, ...shMono, fontSize: 12.5 }}>
                          <div><div className="vy-kicker">Exp</div><div style={{ fontWeight: 700 }}>{f.expected}</div></div>
                          <div><div className="vy-kicker">Rec</div><div style={{ fontWeight: 700 }}>{f.received > 0 ? f.received : "—"}</div></div>
                          <div><div className="vy-kicker">Var</div><div style={{ fontWeight: 700, color: vTone }}>{f.received <= 0 ? "—" : (variance > 0 ? "+" : "") + variance}</div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", padding: "16px", border: "1px dashed hsl(var(--border))", borderRadius: 10, textAlign: "center" }}>No FBA inbounds linked yet — they appear here once you create the Amazon inbound.</div>
              )}
            </ShCard>

            {/* Linked order */}
            <ShCard icon="cube" iconTone="primary" title="Order">
              <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(s.orderId)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 15px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)", textDecoration: "none", color: "inherit" }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><VyIcon name="cube" size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...shMono, fontSize: 11, color: "hsl(var(--muted-fg))" }}>{s.orderId}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.orderTitle}</div>
                </div>
                <VyIcon name="arrowRight" size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
              </a>
            </ShCard>
          </div>
        </main>
      </div>

      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} active="Shipments" />
      {toast ? (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "hsl(var(--foreground))", color: "hsl(var(--background))", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "var(--shadow-lg)" }}>{toast}</div>
      ) : null}
    </div>
  );
}

const shRoot = ReactDOM.createRoot(document.getElementById("vy-root"));
shRoot.render(<ShipmentPage />);
