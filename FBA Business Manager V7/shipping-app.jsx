// Vyonix Shipping Section — chrome-less body, embedded inside the Order Shell
// Shipping tab. Exposes VyShippingBody via window. Does NOT self-mount.
//
// Design: header + next-action, 5-KPI strip, action-needed banner, shipment
// switcher tabs, per-shipment stepper, packing list (carton truth), FBA
// inbound links, freight & customs, and file slots.

const { useState: useShipState } = React;

// ----------------------------------------------------------------------
// DATA
// ----------------------------------------------------------------------
const SHIP_STAGES = ["Draft", "Booked", "Picked up", "In transit", "Customs", "Delivered", "At FBA"];

// Per-order scope (null = sample or standalone page → curated literals below).
const SHIP_SCOPE = (window.VY_ORDER_SCOPE && !window.VY_ORDER_SCOPE.isSample) ? window.VY_ORDER_SCOPE : null;

function shipBuildScopeShipment(scope) {
  // Group SKUs by destination FC for the FBA inbounds.
  const byFc = {};
  scope.skus.forEach((s) => { (byFc[s.fc] = byFc[s.fc] || []).push(s); });
  const stageMap = { draft: "Draft", production: "Draft", inspection: "Booked", transit: "In transit", fba: "At FBA", closed: "At FBA" };
  const stage = stageMap[scope.stageKey] || "Draft";
  const tail = (scope.id || "").replace(/[^0-9]/g, "").slice(-3) || "001";
  const fba = scope.shipped ? Object.keys(byFc).map((fc, i) => {
    const expected = byFc[fc].reduce((a, s) => a + s.qty, 0);
    const received = scope.received ? expected : 0;
    return {
      id: "FBA-" + tail + "-" + (i + 1), fc: fc,
      status: scope.received ? "Closed" : "Receiving",
      tone: scope.received ? "success" : "info",
      expected: expected, received: received, variance: 0,
      synced: scope.received ? "synced" : "just now",
    };
  }) : [];
  const packing = scope.shipped ? {
    cbm: (scope.units / 600).toFixed(2),
    gross: Math.round(scope.units * 0.55) + " kg",
    net: Math.round(scope.units * 0.5) + " kg",
    lines: scope.skus.map((s) => ({ sku: s.sku, product: s.short, cartons: Math.ceil(s.qty / 25), perCtn: 25, packed: s.qty, fc: s.fc })),
    totalCartons: scope.skus.reduce((a, s) => a + Math.ceil(s.qty / 25), 0),
    totalPacked: scope.units,
  } : null;
  return [{
    id: 1, label: "Shipment 1",
    mode: scope.shipMode || "Sea LCL",
    pcs: scope.units,
    etaShort: scope.received ? "Received" : "—",
    route: (scope.supplier ? scope.supplier.split(" ")[0] : "Origin") + " → Los Angeles → FBA",
    stage: stage,
    etd: scope.shipped ? "Booked" : "—",
    eta: scope.received ? "Received" : "—",
    tracking: scope.shipped ? "TRK-" + tail : "—",
    packing: packing,
    fba: fba,
    freight: { forwarder: "Forwarder pending", estimate: "$" + Math.round(scope.units * 0.55).toLocaleString() + ".00" },
    files: [
      { key: "bol", label: "BOL / AWB", description: "Bill of lading / air waybill from the carrier", file: null },
      { key: "customs", label: "Customs docs", description: "Import clearance paperwork", file: null },
      { key: "packing", label: "Packing PDF", description: "Carton-level packing list for this shipment", file: null },
    ],
  }];
}

const SHIP_SHIPMENTS = SHIP_SCOPE ? shipBuildScopeShipment(SHIP_SCOPE) : [
  {
    id: 1,
    label: "Shipment 1",
    mode: "Sea LCL",
    pcs: 900,
    etaShort: "Jun 24",
    route: "Ningbo → Los Angeles → FBA",
    stage: "In transit",
    etd: "Jun 12",
    eta: "Jun 24",
    tracking: "PSL-NGB-240612",
    packing: {
      cbm: "1.64",
      gross: "824 kg",
      net: "752 kg",
      lines: [
        { sku: "SEMI-BSC-1P-BLK", product: "Semi 1-pack black", cartons: 10, perCtn: 25, packed: 250, fc: "ONT8" },
        { sku: "SEMI-BSC-2P-BLK", product: "Semi 2-pack black", cartons: 8, perCtn: 25, packed: 200, fc: "ONT8" },
        { sku: "CAR-BSC-1P-BLK", product: "Car 1-pack black", cartons: 10, perCtn: 25, packed: 250, fc: "LGB8" },
        { sku: "CAR-BSC-2P-BLK", product: "Car 2-pack black", cartons: 4, perCtn: 50, packed: 200, fc: "LGB8" },
      ],
      totalCartons: 32,
      totalPacked: 900,
    },
    fba: [
      { id: "FBA17-WQ4-6B2", fc: "ONT8", status: "Receiving", tone: "success", expected: 450, received: 0, variance: 0, synced: "18 min ago" },
      { id: "FBA17-LG8-2N4", fc: "LGB8", status: "Working", tone: "info", expected: 450, received: 0, variance: 0, synced: "18 min ago" },
    ],
    freight: { forwarder: "Pacific Star · DDP", estimate: "$842.00" },
    files: [
      { key: "bol", label: "BOL / AWB", description: "Bill of lading / air waybill from the carrier", file: null },
      { key: "customs", label: "Customs docs", description: "Import clearance paperwork", file: { name: "customs-docs.pdf", date: "Jun 10" } },
      { key: "packing", label: "Packing PDF", description: "Carton-level packing list for this shipment", file: { name: "packing-list.pdf", date: "Jun 08" } },
    ],
  },
  {
    id: 2,
    label: "Shipment 2",
    mode: "Air",
    pcs: 700,
    etaShort: "Jul 03",
    route: "Shenzhen → Los Angeles → FBA",
    stage: "Draft",
    etd: "Jun 28",
    eta: "Jul 03",
    tracking: "—",
    packing: null,
    fba: [],
    freight: { forwarder: "DHL · DAP", estimate: "$1,180.00" },
    files: [
      { key: "bol", label: "BOL / AWB", description: "Bill of lading / air waybill from the carrier", file: null },
      { key: "customs", label: "Customs docs", description: "Import clearance paperwork", file: null },
      { key: "packing", label: "Packing PDF", description: "Carton-level packing list for this shipment", file: null },
    ],
  },
];

// Order scope — the SKU quantities committed in Production (source of truth
// for "have we shipped everything?"). Matches Production / Closeout.
const SHIP_ORDER_SKUS = SHIP_SCOPE ? SHIP_SCOPE.skus.map((s) => ({ sku: s.sku, product: s.short, ordered: s.qty })) : [
  { sku: "SEMI-BSC-1P-BLK", product: "Semi 1-pack black", ordered: 450 },
  { sku: "SEMI-BSC-2P-BLK", product: "Semi 2-pack black", ordered: 350 },
  { sku: "CAR-BSC-1P-BLK", product: "Car 1-pack black", ordered: 450 },
  { sku: "CAR-BSC-2P-BLK", product: "Car 2-pack black", ordered: 350 },
];

// ----------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------
function ShipSectionCard({ icon, title, sub, actions, accent, children, iconTone = "primary" }) {
  return (
    <section className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: children ? 16 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {icon ? (
            <span style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              display: "grid", placeItems: "center",
              background: `hsl(var(--${iconTone}) / 0.12)`, color: `hsl(var(--${iconTone}))`,
            }}>
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
      {children}
    </section>
  );
}

function ShipField({ label, children, mono }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "12px 16px" }}>
      <div className="vy-kicker" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, fontFamily: mono ? "var(--font-mono, 'JetBrains Mono', monospace)" : undefined }}>
        {children}
      </div>
    </div>
  );
}

function ShipFieldRow({ children }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap",
      border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden",
      background: "hsl(var(--background) / 0.4)",
    }}>
      {React.Children.map(children, (child, i) => (
        <div style={{ flex: 1, minWidth: 160, borderLeft: i === 0 ? "none" : "1px solid hsl(var(--border))" }}>
          {child}
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// Stepper
// ----------------------------------------------------------------------
function ShipStepper({ stage }) {
  const currentIdx = SHIP_STAGES.indexOf(stage);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${SHIP_STAGES.length}, 1fr)`, gap: 10 }}>
      {SHIP_STAGES.map((s, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        const barColor = done ? "hsl(var(--success))" : current ? "hsl(var(--primary))" : "hsl(var(--border))";
        return (
          <div key={s}>
            <div style={{ height: 5, borderRadius: 999, background: barColor }} />
            <div style={{
              marginTop: 8, fontSize: 11.5,
              fontWeight: current ? 700 : 500,
              color: current ? "hsl(var(--primary))" : done ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))",
            }}>
              {s}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------
// Tracking detail — checkpoint timeline (17TRACK-shaped) for ONE shipment in
// the order. Derived from the shipment's stage + ETD/ETA + route, so it stays
// consistent with the portfolio Shipments page without sharing its store.
// ----------------------------------------------------------------------
const SHIP_TRK_MILESTONES = [
  { stage: "Booked",     label: "Booking confirmed",         where: "origin" },
  { stage: "Picked up",  label: "Picked up at origin",       where: "origin" },
  { stage: "In transit", label: "Departed — on the water",   where: "transit" },
  { stage: "Customs",    label: "Customs clearance",         where: "dest" },
  { stage: "Delivered",  label: "Arrived at destination",    where: "dest" },
  { stage: "At FBA",     label: "Delivered to Amazon FC",    where: "dest" },
];
const SHIP_TRK_MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function shipParseDate(label) {
  if (!label || label === "—") return null;
  const m = label.match(/([A-Za-z]{3})\s*(\d{1,2})/);
  if (!m || SHIP_TRK_MONTHS[m[1].slice(0, 3)] == null) return null;
  return new Date(2026, SHIP_TRK_MONTHS[m[1].slice(0, 3)], Number(m[2]), 9, 0);
}
function shipFmtTs(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function shipRouteEnds(route) {
  const parts = (route || "").split("→").map((x) => x.trim()).filter(Boolean);
  return { origin: parts[0] || "Origin", dest: (parts.find((p) => /FBA/i.test(p)) ? parts[parts.length - 2] : parts[parts.length - 1]) || "Destination" };
}

function ShipTrackingTimeline({ shipment }) {
  const { origin, dest } = shipRouteEnds(shipment.route);
  const doneIdx = SHIP_TRK_MILESTONES.findIndex((m) => m.stage === shipment.stage);
  const etd = shipParseDate(shipment.etd) || new Date(2026, 5, 1, 9, 0);
  const eta = shipParseDate(shipment.eta) || new Date(etd.getTime() + 18 * 864e5);
  const span = Math.max(1, eta.getTime() - etd.getTime());
  const frac = [0, 0.06, 0.18, 0.74, 1.0, 1.12];
  const loc = (w) => w === "origin" ? origin : w === "dest" ? dest : "On the water";
  const hasTracking = shipment.tracking && shipment.tracking !== "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {SHIP_TRK_MILESTONES.map((m, i) => {
        const done = doneIdx >= 0 && i <= doneIdx;
        const cur = i === doneIdx;
        const color = done ? (cur ? "hsl(var(--primary))" : "hsl(var(--success))") : "hsl(var(--border))";
        const ts = done && hasTracking ? etd.getTime() + span * frac[i] : null;
        return (
          <div key={m.stage} style={{ display: "flex", gap: 12, minHeight: 30 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
              <span style={{ width: 12, height: 12, borderRadius: 999, background: done ? color : "hsl(var(--card))", border: "2px solid " + color, flexShrink: 0, marginTop: 4 }} />
              {i < SHIP_TRK_MILESTONES.length - 1 ? <span style={{ width: 2, flex: 1, background: done && doneIdx > i ? "hsl(var(--success))" : "hsl(var(--border))", margin: "2px 0" }} /> : null}
            </div>
            <div style={{ paddingBottom: i < SHIP_TRK_MILESTONES.length - 1 ? 10 : 0, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: cur ? 700 : 600, color: cur ? "hsl(var(--primary))" : done ? "hsl(var(--foreground))" : "hsl(var(--muted-fg))" }}>{m.label}</div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>
                {ts ? <>{shipFmtTs(ts)} · {loc(m.where)}</> : <span style={{ fontStyle: "italic" }}>{loc(m.where)} · pending</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------
// File slot
// ----------------------------------------------------------------------
function ShipFileSlot({ slot, onUpload }) {
  const filled = !!slot.file;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10,
      background: "hsl(var(--background) / 0.4)",
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center",
        background: filled ? "hsl(var(--success) / 0.12)" : "hsl(var(--muted-bg))",
        color: filled ? "hsl(var(--success))" : "hsl(var(--muted-fg))",
      }}>
        <VyIcon name="fileText" size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{slot.label}</div>
        <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 2, lineHeight: 1.35 }}>{slot.description || (filled ? "" : "No file linked")}</div>
        {filled ? (
          <div style={{ fontSize: 11, color: "hsl(var(--success))", marginTop: 3, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <VyIcon name="check" size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />{slot.file.name} · {slot.file.date}
          </div>
        ) : null}
      </div>
      <span className={"vy-badge " + (filled ? "vy-badge--success" : "vy-badge--muted")}>
        {filled ? "Filled" : "Empty"}
      </span>
      <button
        type="button"
        className="vy-btn vy-btn--ghost vy-btn--sm"
        style={{ fontSize: 11.5 }}
        onClick={() => onUpload(slot)}
      >
        <VyIcon name={filled ? "externalLink" : "upload"} size={12} />
        <span>{filled ? "Open" : "Upload"}</span>
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------
// SHIPPING BODY
// ----------------------------------------------------------------------
function VyShippingBody() {
  const [shipments, setShipments] = useShipState(SHIP_SHIPMENTS);
  const [activeId, setActiveId] = useShipState(SHIP_SHIPMENTS[0].id);
  const [modal, setModal] = useShipState(null); // null | 'add-shipment' | 'create-packing' | 'link-fba'
  const [receiveTarget, setReceiveTarget] = useShipState(null); // FBA entry being reconciled
  const [trackOpen, setTrackOpen] = useShipState(true); // tracking detail expanded
  const [pasteOpen, setPasteOpen] = useShipState(false); // paste-update modal
  const [headerMenu, setHeaderMenu] = useShipState(false); // ⋯ overflow in header
  const [headerMenuPos, setHeaderMenuPos] = useShipState(null);
  const moreBtnRef = React.useRef(null);
  function toggleHeaderMenu() {
    if (headerMenu) { setHeaderMenu(false); return; }
    const r = moreBtnRef.current.getBoundingClientRect();
    setHeaderMenuPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    setHeaderMenu(true);
  }

  const shipment = shipments.find((s) => s.id === activeId) || shipments[0];
  const shipFiles = shipment.files;

  function updateShipment(id, patch) {
    setShipments((prev) => prev.map((s) => (s.id === id ? { ...s, ...(typeof patch === "function" ? patch(s) : patch) } : s)));
  }

  function handleUpload(slot) {
    if (slot.file) { return; } // open existing — no-op in prototype
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.png,.jpg,.jpeg,.xlsx,.csv";
    input.onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const today = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
      updateShipment(activeId, (s) => ({
        files: s.files.map((x) => (x.key === slot.key ? { ...x, file: { name: f.name, date: today } } : x)),
      }));
    };
    input.click();
  }

  function handleAddShipment(data) {
    const nextId = Math.max(...shipments.map((s) => s.id)) + 1;
    const newShip = {
      id: nextId,
      label: "Shipment " + nextId,
      mode: data.mode,
      pcs: Number(data.pcs) || 0,
      etaShort: data.eta || "TBD",
      route: data.route || "—",
      stage: "Draft",
      etd: data.etd || "—",
      eta: data.eta || "—",
      tracking: data.tracking || "—",
      packing: null,
      fba: [],
      freight: { forwarder: data.forwarder || "—", estimate: data.estimate ? "$" + Number(data.estimate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—" },
      files: [
        { key: "bol", label: "BOL / AWB", description: "Bill of lading / air waybill from the carrier", file: null },
        { key: "customs", label: "Customs docs", description: "Import clearance paperwork", file: null },
        { key: "packing", label: "Packing PDF", description: "Carton-level packing list for this shipment", file: null },
      ],
    };
    setShipments((prev) => [...prev, newShip]);
    setActiveId(nextId);
    setModal(null);
  }

  function handleCreatePacking(packing) {
    updateShipment(activeId, (s) => ({
      packing,
      stage: s.stage === "Draft" ? "Booked" : s.stage,
      files: s.files.map((x) => (x.key === "packing" && !x.file ? { ...x, file: { name: "packing-list.pdf", date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }) } } : x)),
    }));
    setModal(null);
  }

  function handleLinkFba(entry) {
    updateShipment(activeId, (s) => ({ fba: [...s.fba, entry] }));
    setModal(null);
  }

  function handleUpdateReceived(fbaId, received) {
    updateShipment(activeId, (s) => ({
      fba: s.fba.map((f) => {
        if (f.id !== fbaId) return f;
        const variance = received - f.expected;
        const status = received <= 0 ? "Working" : received >= f.expected ? "Closed" : "Receiving";
        const tone = received <= 0 ? "muted" : variance < 0 ? "danger" : variance > 0 ? "warning" : "success";
        return { ...f, received, variance, status, tone, synced: "just now" };
      }),
    }));
    setModal(null);
  }

  function handleApplyTracking(fields) {
    const patch = {};
    const tn = (fields.trackingNo || "").trim();
    const br = (fields.bookingRef || "").trim();
    if (tn) patch.tracking = tn;
    else if (br) patch.tracking = br;
    if (fields.carrier && fields.carrier.trim()) patch.forwarder = fields.carrier.trim();
    if (fields.eta && fields.eta.trim()) {
      const d = (window.trkParseLabel ? window.trkParseLabel(fields.eta) : null);
      patch.eta = d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : fields.eta.trim();
      patch.etaShort = patch.eta;
    }
    updateShipment(activeId, patch);
    setPasteOpen(false);
  }

  // Derived, live-updating stats
  const totalPcs = shipments.reduce((n, s) => n + s.pcs, 0);
  const packedTotal = shipments.reduce((n, s) => n + (s.packing ? s.packing.totalPacked : 0), 0);
  const packedShipments = shipments.filter((s) => s.packing).length;
  const fbaTotal = shipments.reduce((n, s) => n + s.fba.length, 0);
  const filesFilled = shipments.reduce((n, s) => n + s.files.filter((f) => f.file).length, 0);
  const filesTotal = shipments.reduce((n, s) => n + s.files.length, 0);
  const inTransit = shipments.filter((s) => s.stage === "In transit").length;
  const modes = [...new Set(shipments.map((s) => s.mode))].join(" · ");
  const forwarders = [...new Set(shipments.map((s) => s.freight.forwarder.split(" ·")[0]))];
  const firstMissingPacking = shipments.find((s) => !s.packing);

  // #2 — Order coverage: packed-per-SKU across ALL shipments vs ordered
  const packedBySku = {};
  shipments.forEach((s) => {
    if (!s.packing) return;
    s.packing.lines.forEach((l) => { packedBySku[l.sku] = (packedBySku[l.sku] || 0) + l.packed; });
  });
  const coverage = SHIP_ORDER_SKUS.map((o) => {
    const packed = packedBySku[o.sku] || 0;
    return { ...o, packed, toShip: Math.max(0, o.ordered - packed) };
  });
  const orderedTotal = coverage.reduce((n, c) => n + c.ordered, 0);
  const coveredTotal = coverage.reduce((n, c) => n + Math.min(c.packed, c.ordered), 0);
  const toShipTotal = orderedTotal - coveredTotal;
  const coveragePct = orderedTotal ? Math.round((coveredTotal / orderedTotal) * 100) : 0;

  // Batch-over-time view: how the order is split across shipments, by status.
  const shipMovingPcs = shipments.filter((s) => s.stage !== "Draft").reduce((n, s) => n + s.pcs, 0);
  const shipDraftPcs = shipments.filter((s) => s.stage === "Draft").reduce((n, s) => n + s.pcs, 0);
  const shipUnshippedPcs = Math.max(0, orderedTotal - shipMovingPcs - shipDraftPcs);
  const shipPctOf = (n) => orderedTotal ? (n / orderedTotal) * 100 : 0;
  const shipStageMoving = (st) => st !== "Draft";

  // #1 — Received reconciliation rollup across ALL FBA inbounds
  const fbaAll = shipments.flatMap((s) => s.fba);
  const expectedTotal = fbaAll.reduce((n, f) => n + f.expected, 0);
  const receivedTotal = fbaAll.reduce((n, f) => n + f.received, 0);
  const varianceTotal = receivedTotal - fbaAll.filter((f) => f.received > 0).reduce((n, f) => n + f.expected, 0);
  const shortageCount = fbaAll.filter((f) => f.received > 0 && f.variance < 0).length;

  // Data-driven status: once EVERY linked FBA inbound is fully received, the
  // order auto-advances to "At FBA" (forward-only; manual controls override).
  // Rising-edge only, so an order that loads already-received doesn't re-fire.
  const allFbaReceived = fbaAll.length > 0 && fbaAll.every((f) => f.received >= f.expected);
  const shipAdvRef = React.useRef(allFbaReceived);
  React.useEffect(() => {
    if (allFbaReceived && !shipAdvRef.current && typeof ordAdvanceToAtLeast === "function") {
      const o = window.VY_CURRENT_ORDER;
      if (o && o.id) {
        ordAdvanceToAtLeast(o.id, o.status && o.status.label, "fba", "All FBA inbounds received");
      }
    }
    shipAdvRef.current = allFbaReceived;
  }, [allFbaReceived]);

  const freightTotal = shipments.reduce((n, s) => n + (parseFloat(String(s.freight.estimate).replace(/[^0-9.]/g, "")) || 0), 0);
  const kpis = [
    { icon: "truck", label: "Shipments", value: shipments.length + " active", sub: modes },
    { icon: "ship", label: "Freight (est.)", value: "$" + freightTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), sub: forwarders.join(" · ") },
    { icon: "fileText", label: "Files", value: filesFilled + " of " + filesTotal, sub: (filesTotal - filesFilled) + " missing", tone: filesTotal - filesFilled > 0 ? "warning" : undefined },
  ];

  return (
    <>
      {window.VyExampleNote ? <window.VyExampleNote section="shipping" /> : null}
      {/* Header + next action */}
      <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 460px", padding: "20px 22px", minWidth: 0 }}>
            <h1 className="vy-page-title" style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Shipping</h1>
            <p className="vy-page-sub" style={{ margin: "6px 0 0", maxWidth: "62ch" }}>
              Physical shipment data, packing lists, FBA inbound links, freight context, and shipment files.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <span className="vy-badge vy-badge--info">{shipments.length} shipments</span>
              <span className="vy-badge vy-badge--muted">{totalPcs.toLocaleString()} pcs</span>
              {inTransit > 0 ? <span className="vy-badge vy-badge--success">{inTransit} in transit</span> : null}
              {firstMissingPacking ? <span className="vy-badge vy-badge--warning">Packing missing</span> : <span className="vy-badge vy-badge--success">All packed</span>}
            </div>
          </div>
          <div style={{
            flex: "1 1 300px", padding: "20px 22px", minWidth: 260,
            borderLeft: "1px solid hsl(var(--border))",
            background: "hsl(var(--accent) / 0.5)",
          }}>
            <div className="vy-kicker" style={{ marginBottom: 6 }}>Next action</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {firstMissingPacking ? "Create packing list" : "Link FBA inbounds"}
            </div>
            <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "4px 0 14px" }}>
              {firstMissingPacking
                ? firstMissingPacking.label + " needs carton truth before FBA inbound links can be created."
                : "Packing lists complete — link Amazon FBA inbound shipments, then track received units."}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" className="vy-btn vy-btn--primary" onClick={() => setModal("add-shipment")}>
                <VyIcon name="plus" size={14} />
                <span>Add shipment</span>
              </button>
              <div style={{ position: "relative" }}>
                <button ref={moreBtnRef} type="button" className="vy-btn vy-btn--outline" aria-label="More actions" aria-haspopup="true" aria-expanded={headerMenu} onClick={toggleHeaderMenu} style={{ padding: "0 10px" }}>
                  <VyIcon name="more" size={16} />
                </button>
                {headerMenu && headerMenuPos ? ReactDOM.createPortal(
                  <>
                    <div onClick={() => setHeaderMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
                    <div className="vy-card" style={{ position: "fixed", top: headerMenuPos.top, right: headerMenuPos.right, zIndex: 9999, padding: 6, minWidth: 180, boxShadow: "var(--shadow-lg)" }}>
                      <button type="button" onClick={() => { setHeaderMenu(false); alert("Export all shipments"); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "8px 10px", fontSize: 13, border: "none", background: "transparent", borderRadius: 7, cursor: "pointer", color: "hsl(var(--foreground))" }}>
                        <VyIcon name="download" size={14} style={{ opacity: 0.7 }} /><span>Export all</span>
                      </button>
                    </div>
                  </>,
                  document.body
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPI strip */}
      <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {kpis.map((k, i) => (
          <div key={i} className={"vy-card vy-kpi" + (k.tone ? ` vy-kpi--${k.tone}` : "")}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <VyIcon name={k.icon} size={14} style={{ opacity: 0.7 }} />
              <span className="vy-kicker">{k.label}</span>
            </div>
            <div className="vy-kpi-value">{k.value}</div>
            <div className="vy-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Action needed banner */}
      {firstMissingPacking ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          padding: "12px 16px", borderRadius: 10,
          background: "hsl(var(--warning) / 0.08)", border: "1px solid hsl(var(--warning) / 0.25)",
        }}>
          <span className="vy-badge vy-badge--warning" style={{ flexShrink: 0 }}>Action needed</span>
          <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
            <strong style={{ fontWeight: 600 }}>{firstMissingPacking.label} needs packing list before FBA link</strong>
            <span style={{ color: "hsl(var(--muted-fg))" }}>&nbsp;&nbsp;Create carton truth first, then link FBA inbound shipments.</span>
          </div>
          <button
            type="button"
            className="vy-btn vy-btn--primary"
            style={{ flexShrink: 0 }}
            onClick={() => { setActiveId(firstMissingPacking.id); setModal("create-packing"); }}
          >
            <VyIcon name="plus" size={14} />
            <span>Create packing</span>
          </button>
        </div>
      ) : null}

      {/* Order coverage — cross-shipment reconciliation vs the order's SKU scope */}
      <ShipSectionCard
        icon="boxes"
        title="Order coverage"
        sub="Every ordered unit must be packed into a shipment"
        iconTone={toShipTotal > 0 ? "warning" : "success"}
        actions={
          <span className={"vy-badge " + (toShipTotal > 0 ? "vy-badge--warning" : "vy-badge--success")}>
            {toShipTotal > 0 ? toShipTotal + " units to ship" : "All units shipped"}
          </span>
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>
            Packed <strong style={{ color: "hsl(var(--foreground))", fontWeight: 700 }}>{coveredTotal.toLocaleString()}</strong> of {orderedTotal.toLocaleString()} ordered units
          </span>
          <div style={{ flex: 1, minWidth: 140, height: 6, borderRadius: 999, background: "hsl(var(--muted-bg))", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: coveragePct + "%", background: toShipTotal > 0 ? "hsl(var(--primary))" : "hsl(var(--success))", borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{coveragePct}%</span>
        </div>

        {/* Per-shipment tracking board — each batch tracked separately:
            tracking · quantity · shipping cost · FBA received (the seller's view) */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <span className="vy-kicker">Track each shipment · {shipments.length} {shipments.length === 1 ? "batch" : "batches"}</span>
            <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>
              {shipMovingPcs.toLocaleString()} shipped · {shipDraftPcs.toLocaleString()} planned · {shipUnshippedPcs.toLocaleString()} at factory
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shipments.map((s) => {
              const exp = s.fba.reduce((n, f) => n + (f.expected || 0), 0);
              const rec = s.fba.reduce((n, f) => n + (f.received || 0), 0);
              const short = s.fba.reduce((n, f) => n + (f.received > 0 && f.received < f.expected ? f.expected - f.received : 0), 0);
              const active = s.id === activeId;
              const moving = shipStageMoving(s.stage);
              return (
                <button key={s.id} type="button" onClick={() => setActiveId(s.id)}
                  style={{ display: "grid", gridTemplateColumns: "minmax(120px,1.3fr) minmax(120px,1.4fr) 70px 90px minmax(110px,1fr)", gap: 12, alignItems: "center", textAlign: "left", width: "100%", cursor: "pointer",
                    padding: "11px 13px", borderRadius: 10, border: "1px solid " + (active ? "hsl(var(--primary) / 0.5)" : "hsl(var(--border))"), background: active ? "hsl(var(--primary) / 0.06)" : "hsl(var(--background) / 0.4)" }}>
                  {/* identity + stage */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: moving ? "hsl(var(--success))" : "hsl(var(--warning))" }} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{s.mode} · ETA {s.etaShort}</div>
                  </div>
                  {/* tracking */}
                  <div style={{ minWidth: 0 }}>
                    <div className="vy-kicker" style={{ marginBottom: 1 }}>Tracking</div>
                    {s.tracking && s.tracking !== "—" ? (
                      <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.tracking}</div>
                    ) : <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>not booked</span>}
                    <span className={"vy-badge vy-badge--" + (moving ? "info" : "muted")} style={{ marginTop: 2 }}>{s.stage}</span>
                  </div>
                  {/* quantity */}
                  <div style={{ textAlign: "right" }}>
                    <div className="vy-kicker" style={{ marginBottom: 1 }}>Units</div>
                    <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13, fontWeight: 700 }}>{s.pcs.toLocaleString()}</div>
                  </div>
                  {/* shipping cost */}
                  <div style={{ textAlign: "right" }}>
                    <div className="vy-kicker" style={{ marginBottom: 1 }}>Freight</div>
                    <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12.5, fontWeight: 600 }}>{s.freight.estimate}</div>
                  </div>
                  {/* FBA received */}
                  <div style={{ textAlign: "right" }}>
                    <div className="vy-kicker" style={{ marginBottom: 1 }}>FBA received</div>
                    {exp > 0 ? (
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{rec}/{exp}</span>
                        {short > 0 ? <span className="vy-badge vy-badge--danger" style={{ marginLeft: 5 }}>{short} short</span>
                          : rec >= exp && exp > 0 ? <span className="vy-badge vy-badge--success" style={{ marginLeft: 5 }}>✓</span>
                          : <span className="vy-badge vy-badge--muted" style={{ marginLeft: 5 }}>awaiting</span>}
                      </div>
                    ) : <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>no inbounds</span>}
                  </div>
                </button>
              );
            })}
            {shipUnshippedPcs > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 10, border: "1px dashed hsl(var(--warning) / 0.4)", background: "hsl(var(--warning) / 0.05)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: "hsl(var(--warning))" }} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Still at factory</span>
                <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>not yet on a shipment</span>
                <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12.5, fontWeight: 700, marginLeft: "auto", color: "hsl(var(--warning))" }}>{shipUnshippedPcs.toLocaleString()} units</span>
                <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ flexShrink: 0 }} onClick={() => setModal("add-shipment")}>
                  <VyIcon name="plus" size={11} /><span>Ship these</span>
                </button>
                <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12.5, fontWeight: 700, width: 70, textAlign: "right", flexShrink: 0, color: "hsl(var(--warning))" }}>{shipUnshippedPcs.toLocaleString()}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "hsl(var(--muted-bg) / 0.6)" }}>
                <th style={shipTh}>SKU</th>
                <th style={{ ...shipTh, textAlign: "right" }}>Ordered</th>
                <th style={{ ...shipTh, textAlign: "right" }}>Packed</th>
                <th style={{ ...shipTh, textAlign: "right" }}>To ship</th>
                <th style={{ ...shipTh, textAlign: "right" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((c) => (
                <tr key={c.sku} style={{ borderTop: "1px solid hsl(var(--border))" }}>
                  <td style={{ ...shipTd, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{c.sku}</td>
                  <td style={{ ...shipTd, textAlign: "right" }}>{c.ordered}</td>
                  <td style={{ ...shipTd, textAlign: "right", fontWeight: 600 }}>{c.packed}</td>
                  <td style={{ ...shipTd, textAlign: "right", fontWeight: 600, color: c.toShip > 0 ? "hsl(var(--warning))" : "hsl(var(--muted-fg))" }}>{c.toShip}</td>
                  <td style={{ ...shipTd, textAlign: "right" }}>
                    <span className={"vy-badge " + (c.toShip > 0 ? "vy-badge--warning" : "vy-badge--success")}>{c.toShip > 0 ? "Partial" : "Packed"}</span>
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--muted-bg) / 0.4)" }}>
                <td style={{ ...shipTd, fontWeight: 700 }}>Total</td>
                <td style={{ ...shipTd, textAlign: "right", fontWeight: 700 }}>{orderedTotal}</td>
                <td style={{ ...shipTd, textAlign: "right", fontWeight: 700 }}>{coveredTotal}</td>
                <td style={{ ...shipTd, textAlign: "right", fontWeight: 700, color: toShipTotal > 0 ? "hsl(var(--warning))" : "hsl(var(--muted-fg))" }}>{toShipTotal}</td>
                <td style={shipTd}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </ShipSectionCard>

      {/* Shipment switcher — sticky so you always know which split you're in.
         Only shown with 2+ batches; a single batch needs no selector (the batch
         card below already names it), so we skip the redundant bar + its gap. */}
      {shipments.length > 1 ? (
      <div style={{ position: "sticky", top: -1, zIndex: 30, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 6px 14px -10px hsl(0 0% 0% / 0.18)", padding: "12px 16px", borderRadius: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="vy-kicker">Shipments</span>
          <span className="vy-badge vy-badge--muted" style={{ fontSize: 10 }}>{shipments.length} {shipments.length === 1 ? "batch" : "batches"}</span>
          <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>Each batch carries its own packing list, FBA inbounds, freight &amp; files.</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        {shipments.map((s) => {
          const active = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                border: "1px solid " + (active ? "hsl(var(--primary) / 0.5)" : "hsl(var(--border))"),
                background: active ? "hsl(var(--primary) / 0.08)" : "hsl(var(--card))",
                boxShadow: active ? "0 0 0 1px hsl(var(--primary) / 0.25)" : "none",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}>
                {s.label}
              </span>
              <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>
                {s.mode} · {s.pcs} pcs · {s.etaShort}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className="vy-btn vy-btn--outline"
          style={{ borderStyle: "dashed", height: "auto" }}
          onClick={() => setModal("add-shipment")}
        >
          <VyIcon name="plus" size={14} />
          <span>Add</span>
        </button>
        </div>
      </div>
      ) : null}

      {/* Shipment card — the active batch's full detail */}
      <ShipSectionCard
        icon="route"
        title={shipment.label + " of " + shipments.length}
        sub={shipment.route}
        actions={shipments.length === 1 ? (
          <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ borderStyle: "dashed" }} onClick={() => setModal("add-shipment")}>
            <VyIcon name="plus" size={12} /><span>Add shipment</span>
          </button>
        ) : null}
      >
        <ShipFieldRow>
          <ShipField label="ETD">{shipment.etd}</ShipField>
          <ShipField label="ETA">{shipment.eta}</ShipField>
          <ShipField label="Tracking" mono>{shipment.tracking}</ShipField>
        </ShipFieldRow>

        {/* Tracking detail — checkpoint timeline */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: trackOpen ? 14 : 0 }}>
            <button type="button" onClick={() => setTrackOpen(!trackOpen)} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0, color: "hsl(var(--foreground))" }}>
              <VyIcon name={trackOpen ? "chevronDown" : "chevronRight"} size={14} style={{ opacity: 0.6 }} />
              <span className="vy-kicker">Tracking detail · Forwarder leg</span>
            </button>
            {shipment.tracking && shipment.tracking !== "—" ? (
              <span className="vy-badge vy-badge--info" style={{ fontSize: 10 }}>{shipment.stage === "Draft" ? "Booked" : shipment.stage}</span>
            ) : (
              <span className="vy-badge vy-badge--muted" style={{ fontSize: 10 }}>No tracking</span>
            )}
            <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ marginLeft: "auto" }} onClick={() => setPasteOpen(true)}>
              <VyIcon name="clipboard" size={12} /><span>Paste update</span>
            </button>
          </div>
          {trackOpen ? (
            <>
              <ShipTrackingTimeline shipment={shipment} />
              <p style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", margin: "12px 0 0", lineHeight: 1.4 }}>
                <strong style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>Forwarder leg only</strong> (via 17TRACK). Once delivered to the FC, Amazon takes over — checked-in · received · closed events appear in the FBA section below, synced from Seller Central. Paste the forwarder's booking email to fill the tracking number &amp; ETA.
              </p>
            </>
          ) : null}
        </div>
      </ShipSectionCard>

      {/* Packing list */}
      <ShipSectionCard
        icon="clipboard"
        title="Packing list"
        sub="Carton truth for this shipment only"
        actions={shipment.packing ? (
          <>
            <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => setModal("create-packing")}>
              <VyIcon name="pencil" size={12} /><span>Edit</span>
            </button>
            <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => alert("Export packing list PDF")}>
              <VyIcon name="download" size={12} /><span>Export PDF</span>
            </button>
          </>
        ) : null}
      >
        {shipment.packing ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <ShipFieldRow>
                <ShipField label="CBM">{shipment.packing.cbm}</ShipField>
                <ShipField label="Gross">{shipment.packing.gross}</ShipField>
                <ShipField label="Net">{shipment.packing.net}</ShipField>
              </ShipFieldRow>
            </div>
            <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "hsl(var(--muted-bg) / 0.6)" }}>
                    <th style={shipTh}>SKU</th>
                    <th style={shipTh}>Product</th>
                    <th style={{ ...shipTh, textAlign: "right" }}>Cartons</th>
                    <th style={{ ...shipTh, textAlign: "right" }}>Units/ctn</th>
                    <th style={{ ...shipTh, textAlign: "right" }}>Packed</th>
                    <th style={shipTh}>FC</th>
                  </tr>
                </thead>
                <tbody>
                  {shipment.packing.lines.map((l, i) => (
                    <tr key={l.sku} style={{ borderTop: "1px solid hsl(var(--border))" }}>
                      <td style={{ ...shipTd, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{l.sku}</td>
                      <td style={shipTd}>{l.product}</td>
                      <td style={{ ...shipTd, textAlign: "right" }}>{l.cartons}</td>
                      <td style={{ ...shipTd, textAlign: "right" }}>{l.perCtn}</td>
                      <td style={{ ...shipTd, textAlign: "right", fontWeight: 600 }}>{l.packed}</td>
                      <td style={shipTd}><span className="vy-badge vy-badge--muted">{l.fc}</span></td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--muted-bg) / 0.4)" }}>
                    <td style={{ ...shipTd, fontWeight: 700 }} colSpan={4}>Total</td>
                    <td style={{ ...shipTd, textAlign: "right", fontWeight: 700 }} colSpan={2}>
                      {shipment.packing.totalCartons} cartons · {shipment.packing.totalPacked} packed
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <ShipEmptyState
            icon="clipboard"
            title="No packing list yet"
            body="Add carton dimensions, weights, and per-SKU counts to create the carton truth for this shipment."
            cta="Create packing list"
            onClick={() => setModal("create-packing")}
          />
        )}
      </ShipSectionCard>

      {/* FBA inbound shipments */}
      <ShipSectionCard
        icon="link"
        title="FBA inbound shipments"
        sub="Status & received units sync from Seller Central · expected is your packing allocation"
        actions={shipment.packing ? (
          <>
            <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => setModal("link-fba")}>
              <VyIcon name="link" size={12} /><span>Link FBA</span>
            </button>
            <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => alert("Syncing FBA inbound status…")}>
              <VyIcon name="refresh" size={12} /><span>Sync</span>
            </button>
          </>
        ) : null}
      >
        {shipment.fba.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(() => {
              const packedTotal = shipment.packing ? shipment.packing.totalPacked : 0;
              const allocated = shipment.fba.reduce((n, f) => n + f.expected, 0);
              const pct = packedTotal ? Math.min(100, Math.round((allocated / packedTotal) * 100)) : 0;
              const full = allocated >= packedTotal && packedTotal > 0;
              const recv = shipment.fba.reduce((n, f) => n + f.received, 0);
              const expAll = shipment.fba.reduce((n, f) => n + f.expected, 0);
              const recvPct = expAll ? Math.min(100, Math.round((recv / expAll) * 100)) : 0;
              const shortHere = shipment.fba.filter((f) => f.received > 0 && f.variance < 0).length;
              return (
                <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "8px 12px", borderRadius: 8, background: "hsl(var(--background) / 0.5)", border: "1px solid hsl(var(--border))", marginBottom: 2 }}>
                  <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>
                    Allocated <strong style={{ color: "hsl(var(--foreground))", fontWeight: 700 }}>{allocated}</strong> of {packedTotal} packed units
                  </span>
                  <div style={{ flex: 1, minWidth: 120, height: 5, borderRadius: 999, background: "hsl(var(--muted-bg))", overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: pct + "%", background: full ? "hsl(var(--success))" : "hsl(var(--primary))", borderRadius: 999 }} />
                  </div>
                  <span className={"vy-badge " + (full ? "vy-badge--success" : "vy-badge--warning")}>
                    {full ? "Fully allocated" : (packedTotal - allocated) + " unallocated"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "8px 12px", borderRadius: 8, background: "hsl(var(--background) / 0.5)", border: "1px solid hsl(var(--border))", marginBottom: 2 }}>
                  <span style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))" }}>
                    Received <strong style={{ color: "hsl(var(--foreground))", fontWeight: 700 }}>{recv}</strong> of {expAll} expected units
                  </span>
                  <div style={{ flex: 1, minWidth: 120, height: 5, borderRadius: 999, background: "hsl(var(--muted-bg))", overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: recvPct + "%", background: shortHere > 0 ? "hsl(var(--danger))" : recvPct === 100 ? "hsl(var(--success))" : "hsl(var(--primary))", borderRadius: 999 }} />
                  </div>
                  <span className={"vy-badge " + (shortHere > 0 ? "vy-badge--danger" : recv === 0 ? "vy-badge--muted" : recvPct === 100 ? "vy-badge--success" : "vy-badge--warning")}>
                    {shortHere > 0 ? shortHere + " short" : recv === 0 ? "Awaiting receipt" : recvPct === 100 ? "Reconciled" : "Receiving"}
                  </span>
                </div>
                </>
              );
            })()}
            {shipment.fba.map((f) => (
              <div key={f.id} style={{
                display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                padding: "11px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10,
                background: "hsl(var(--background) / 0.4)",
              }}>
                <div style={{ minWidth: 130 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{f.id}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 11, color: "hsl(var(--muted-fg))" }}>
                    <span>{f.fc} ·</span>
                    <span className={"vy-badge vy-badge--" + f.tone}>{f.status}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 22, flex: 1, justifyContent: "center", minWidth: 200 }}>
                  <ShipStat label="Expected" value={f.expected} source="manual" />
                  <ShipStat label="Received" value={f.received} source="amazon" tone={f.received > 0 ? (f.received >= f.expected ? "success" : "warning") : undefined} />
                  <ShipStat label="Variance" value={f.variance} sign tone={f.received <= 0 ? undefined : f.variance < 0 ? "danger" : f.variance > 0 ? "warning" : "success"} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "hsl(var(--muted-fg))" }}>
                    <VyIcon name="refresh" size={11} style={{ opacity: 0.7 }} />synced {f.synced}
                  </span>
                  <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => { setReceiveTarget(f); setModal("receive"); }}>
                    <VyIcon name="check" size={12} /><span>Update received</span>
                  </button>
                  <a href={"Vyonix FBA Shipments.html?order=" + encodeURIComponent((window.ORDER && window.ORDER.id) || "") + "&q=" + encodeURIComponent(f.id)} style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--primary))", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Open <VyIcon name="externalLink" size={11} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ShipEmptyState
            icon="link"
            title="No FBA inbounds linked"
            body={shipment.packing
              ? "Link Amazon FBA inbound shipments to track expected vs. received units against this packing list."
              : "Create the packing list first, then link Amazon FBA inbound shipments to track expected vs. received units."}
            cta="Link FBA"
            disabled={!shipment.packing}
            onClick={() => setModal("link-fba")}
          />
        )}
      </ShipSectionCard>

      {/* Freight & customs */}
      <ShipSectionCard icon="ship" title="Freight & customs" sub="Invoices live in Invoices tab" iconTone="info">
        <ShipFieldRow>
          <ShipField label="Forwarder">{shipment.freight.forwarder}</ShipField>
          <ShipField label="Freight estimate">{shipment.freight.estimate}</ShipField>
          {(() => {
            const oid = (window.ORDER && window.ORDER.id) || null;
            const bill = (window.PAY_INVOICES || []).find((i) => i.orderId === oid && i.vendorType === "Forwarder");
            const fmt = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return (
              <div style={{ flex: 1, minWidth: 0, padding: "12px 16px" }}>
                <div className="vy-kicker" style={{ marginBottom: 4 }}>Freight invoice</div>
                {bill ? (() => {
                  const bal = Math.max(0, bill.total - bill.paid);
                  const st = bal <= 0.005 ? "Paid" : bill.paid > 0 ? "Partial" : "Unpaid";
                  const tone = st === "Paid" ? "success" : st === "Partial" ? "warning" : "danger";
                  return (
                    <a href="#invoices" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13, fontWeight: 700 }}>{bill.id}</span>
                        <span className={"vy-badge vy-badge--" + tone}>{st}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>{fmt(bill.total)}{bal > 0.005 ? " · " + fmt(bal) + " due" : ""}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--info))", display: "inline-flex", alignItems: "center", gap: 3 }}>Open <VyIcon name="arrowRight" size={12} /></span>
                      </div>
                    </a>
                  );
                })() : (
                  <a href="#invoices" style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--info))", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    No freight bill yet — add in Invoices <VyIcon name="arrowRight" size={12} />
                  </a>
                )}
              </div>
            );
          })()}
        </ShipFieldRow>
      </ShipSectionCard>

      {/* Files */}
      <ShipSectionCard icon="fileText" title="Files" iconTone="muted">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {shipFiles.map((slot) => (
            <ShipFileSlot key={slot.key} slot={slot} onUpload={handleUpload} />
          ))}
        </div>
      </ShipSectionCard>

      {/* Modals */}
      {modal === "add-shipment" ? (
        <ShipAddShipmentModal onClose={() => setModal(null)} onSubmit={handleAddShipment} />
      ) : null}
      {modal === "create-packing" ? (
        <ShipCreatePackingModal shipment={shipment} onClose={() => setModal(null)} onSubmit={handleCreatePacking} />
      ) : null}
      {modal === "link-fba" ? (
        <ShipLinkFbaModal shipment={shipment} onClose={() => setModal(null)} onSubmit={handleLinkFba} />
      ) : null}
      {modal === "receive" && receiveTarget ? (
        <ShipReceiveModal entry={receiveTarget} onClose={() => { setModal(null); setReceiveTarget(null); }} onSubmit={(r) => handleUpdateReceived(receiveTarget.id, r)} />
      ) : null}
      {pasteOpen ? (
        <ShipPasteModal shipment={shipment} onClose={() => setPasteOpen(false)} onApply={handleApplyTracking} />
      ) : null}
    </>
  );
}

function ShipStat({ label, value, tone, sign, source }) {
  const display = sign && typeof value === "number" && value > 0 ? "+" + value : value;
  return (
    <div style={{ minWidth: 78 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span className="vy-kicker">{label}</span>
        {source ? <ShipSourceTag source={source} /> : null}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: tone ? `hsl(var(--${tone}))` : undefined }}>{display}</div>
    </div>
  );
}

// Source-of-truth marker for the hybrid model: "Amazon" = synced from Seller
// Central (SP-API), "Manual" = entered by you. Deliberately quiet.
function ShipSourceTag({ source }) {
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

function ShipEmptyState({ icon, title, body, cta, onClick, disabled }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
      padding: "28px 20px", border: "1px dashed hsl(var(--border))", borderRadius: 12,
      background: "hsl(var(--background) / 0.4)",
    }}>
      <span style={{
        width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center",
        background: "hsl(var(--muted-bg))", color: "hsl(var(--muted-fg))", marginBottom: 12,
      }}>
        <VyIcon name={icon} size={18} />
      </span>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "4px 0 16px", maxWidth: "44ch" }}>{body}</p>
      <button
        type="button"
        className={"vy-btn " + (disabled ? "vy-btn--outline" : "vy-btn--primary")}
        onClick={onClick}
        disabled={disabled}
        style={disabled ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
      >
        <VyIcon name="plus" size={14} />
        <span>{cta}</span>
      </button>
    </div>
  );
}

const shipTh = {
  textAlign: "left", padding: "10px 14px", fontSize: 10.5, fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", color: "hsl(var(--muted-fg))",
};
const shipTd = { padding: "11px 14px", color: "hsl(var(--foreground))" };

// ----------------------------------------------------------------------
// Modal shell + form field
// ----------------------------------------------------------------------
function ShipModalShell({ title, sub, onClose, children, footer, width = 520 }) {
  return ReactDOM.createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }}
      onClick={onClose}
    >
      <div
        className="vy-card"
        style={{ width: "100%", maxWidth: width, maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0, boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
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
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          {footer}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ShipFormField({ label, children, half }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: half ? "1 1 calc(50% - 7px)" : "1 1 100%", minWidth: 0 }}>
      <span className="vy-kicker">{label}</span>
      {children}
    </label>
  );
}

const shipInputStyle = {
  width: "100%", height: 38, padding: "0 12px", fontSize: 13,
  border: "1px solid hsl(var(--input))", borderRadius: 8,
  background: "hsl(var(--background))", color: "hsl(var(--foreground))",
};

// ----------------------------------------------------------------------
// Paste forwarder update — parse a booking/tracking email into THIS shipment
// (reuses the shared parser from tracking-data.jsx)
// ----------------------------------------------------------------------
function ShipPasteModal({ shipment, onClose, onApply }) {
  const [text, setText] = useShipState("");
  const [form, setForm] = useShipState(() => ({
    trackingNo: (shipment.tracking && shipment.tracking !== "—") ? shipment.tracking : "",
    bookingRef: "",
    carrier: (shipment.forwarder && shipment.forwarder !== "—") ? String(shipment.forwarder).split(" · ")[0] : "",
    eta: (shipment.eta && shipment.eta !== "—") ? shipment.eta : "",
  }));
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const parse = window.trkParseForwarderMessage || (() => ({}));
  const parsed = text.trim() ? parse(text) : null;
  const carriers = window.TRK_CARRIERS || [];
  const carrierInList = !form.carrier || carriers.some((c) => c.name === form.carrier);

  useShipEffect(() => {
    if (!parsed) return;
    setForm((p) => ({
      trackingNo: parsed.trackingNo || p.trackingNo,
      bookingRef: parsed.bookingRef || p.bookingRef,
      carrier: p.carrier,
      eta: parsed.eta || p.eta,
    }));
  }, [parsed && parsed.trackingNo, parsed && parsed.bookingRef, parsed && parsed.eta]);

  const canApply = !!(form.trackingNo.trim() || form.bookingRef.trim());
  const fieldWrap = { display: "flex", flexDirection: "column", gap: 5 };
  const fieldLabel = { fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-fg))", textTransform: "uppercase", letterSpacing: "0.04em" };
  const fieldInput = { width: "100%", padding: "9px 11px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontFamily: "inherit", boxSizing: "border-box" };
  const mono = { fontFamily: "var(--font-mono, monospace)" };

  return (
    <ShipModalShell
      title="Add tracking"
      sub="Paste the forwarder's message to auto-fill, or type the details in directly. Everything below is editable before you save."
      onClose={onClose}
      width={540}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!canApply} style={canApply ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={() => onApply({ trackingNo: form.trackingNo, bookingRef: form.bookingRef, carrier: form.carrier, eta: form.eta })}>
            <VyIcon name="check" size={14} /><span>Save tracking</span>
          </button>
        </>
      }
    >
      <div style={fieldWrap}>
        <span style={fieldLabel}>Paste forwarder message <span style={{ textTransform: "none", fontWeight: 400 }}>· optional (CN or EN)</span></span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the forwarder's booking / tracking email here — Vyonix pulls out the number, ref and ETA…"
          style={{ ...fieldInput, height: 92, lineHeight: 1.5, resize: "vertical" }} />
        {parsed && (parsed.trackingNo || parsed.bookingRef || parsed.eta) ? (
          <span style={{ fontSize: 11.5, color: "hsl(var(--success))", display: "flex", alignItems: "center", gap: 5 }}><VyIcon name="check" size={12} />Pulled details into the fields below — review and edit.</span>
        ) : text.trim() ? (
          <span style={{ fontSize: 11.5, color: "hsl(var(--warning))" }}>Couldn't find a number — type it in below.</span>
        ) : null}
      </div>

      <div style={{ height: 1, background: "hsl(var(--border))", margin: "18px 0" }}></div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ ...fieldWrap, gridColumn: "1 / -1" }}>
          <span style={fieldLabel}>Tracking no.</span>
          <input value={form.trackingNo} onChange={set("trackingNo")} placeholder="e.g. 6156743593" style={{ ...fieldInput, ...mono, fontWeight: 700 }} />
        </div>
        <div style={fieldWrap}>
          <span style={fieldLabel}>Booking ref</span>
          <input value={form.bookingRef} onChange={set("bookingRef")} placeholder="optional" style={{ ...fieldInput, ...mono }} />
        </div>
        <div style={fieldWrap}>
          <span style={fieldLabel}>ETA</span>
          <input value={form.eta} onChange={set("eta")} placeholder="e.g. Jun 24" style={fieldInput} />
        </div>
        <div style={{ ...fieldWrap, gridColumn: "1 / -1" }}>
          <span style={fieldLabel}>Carrier <span style={{ textTransform: "none", fontWeight: 400 }}>· for 17TRACK</span></span>
          <select value={carrierInList ? form.carrier : "__other"} onChange={(e) => { if (e.target.value !== "__other") set("carrier")(e); }} style={fieldInput}>
            <option value="">Select carrier…</option>
            {carriers.map((c) => <option key={c.scac} value={c.name}>{c.name}</option>)}
            <option value="__other">Other…</option>
          </select>
          {!carrierInList ? (
            <input value={form.carrier} onChange={set("carrier")} placeholder="Carrier name" style={{ ...fieldInput, marginTop: 6 }} />
          ) : null}
        </div>
      </div>
    </ShipModalShell>
  );
}

// ----------------------------------------------------------------------
// Add shipment modal
// ----------------------------------------------------------------------
function ShipAddShipmentModal({ onClose, onSubmit }) {
  const [form, setForm] = useShipState({ mode: "Sea LCL", route: "", pcs: "", etd: "", eta: "", tracking: "", forwarder: "", forwarderNew: "", estimate: "" });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const valid = form.route.trim() && form.pcs;

  // Known forwarders from the user's own data (payable bills + logistics) so the
  // field is a real pick, not free text — consistent with supplier/agent pickers.
  const knownForwarders = (() => {
    const set = new Set();
    (window.PAY_INVOICES || []).filter((i) => i.vendorType === "Forwarder").forEach((i) => set.add(i.vendor));
    (window.LOG_SHIPMENTS || []).forEach((s) => { if (s.forwarder) set.add(String(s.forwarder).split(" · ")[0]); });
    return [...set].filter(Boolean).sort();
  })();

  function submit() {
    const forwarder = form.forwarder === "__new" ? (form.forwarderNew || "").trim() : form.forwarder;
    onSubmit({ ...form, forwarder });
  }

  return (
    <ShipModalShell
      title="Add shipment"
      sub="Create a new physical shipment batch for this order. Packing list and FBA links come next."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={submit}>
            <VyIcon name="plus" size={14} /><span>Add shipment</span>
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <ShipFormField label="Mode" half>
          <select className="vy-input" style={shipInputStyle} value={form.mode} onChange={set("mode")}>
            <option>Sea LCL</option><option>Sea FCL</option><option>Air</option><option>Express</option><option>Rail</option>
          </select>
        </ShipFormField>
        <ShipFormField label="Units (pcs)" half>
          <input type="number" className="vy-input" style={shipInputStyle} value={form.pcs} onChange={set("pcs")} placeholder="e.g. 700" />
        </ShipFormField>
        <ShipFormField label="Route">
          <input className="vy-input" style={shipInputStyle} value={form.route} onChange={set("route")} placeholder="e.g. Shenzhen → Los Angeles → FBA" />
        </ShipFormField>
        <ShipFormField label="ETD" half>
          <input className="vy-input" style={shipInputStyle} value={form.etd} onChange={set("etd")} placeholder="e.g. Jun 28" />
        </ShipFormField>
        <ShipFormField label="ETA" half>
          <input className="vy-input" style={shipInputStyle} value={form.eta} onChange={set("eta")} placeholder="e.g. Jul 03" />
        </ShipFormField>
        <ShipFormField label="Forwarder" half>
          <select className="vy-input" style={shipInputStyle} value={form.forwarder} onChange={set("forwarder")}>
            <option value="">Select a forwarder…</option>
            {knownForwarders.map((f) => <option key={f} value={f}>{f}</option>)}
            <option value="__new">+ Add new forwarder…</option>
          </select>
        </ShipFormField>
        {form.forwarder === "__new" ? (
          <ShipFormField label="New forwarder" half>
            <input className="vy-input" style={shipInputStyle} value={form.forwarderNew} onChange={set("forwarderNew")} placeholder="e.g. Pacific Star · DAP" autoFocus />
          </ShipFormField>
        ) : null}
        <ShipFormField label="Freight estimate (USD)" half>
          <input type="number" className="vy-input" style={shipInputStyle} value={form.estimate} onChange={set("estimate")} placeholder="e.g. 1180" />
        </ShipFormField>
        <ShipFormField label="Tracking (optional)">
          <input className="vy-input" style={shipInputStyle} value={form.tracking} onChange={set("tracking")} placeholder="Carrier reference" />
        </ShipFormField>
      </div>
    </ShipModalShell>
  );
}

// ----------------------------------------------------------------------
// Create packing list modal
// ----------------------------------------------------------------------
const SHIP_PACKING_TEMPLATE = [
  { sku: "SEMI-BSC-1P-BLK", product: "Semi 1-pack black", fc: "ONT8", cartons: 10, perCtn: 25 },
  { sku: "SEMI-BSC-2P-BLK", product: "Semi 2-pack black", fc: "ONT8", cartons: 8, perCtn: 25 },
  { sku: "CAR-BSC-1P-BLK", product: "Car 1-pack black", fc: "LGB8", cartons: 10, perCtn: 25 },
  { sku: "CAR-BSC-2P-BLK", product: "Car 2-pack black", fc: "LGB8", cartons: 4, perCtn: 50 },
];

function ShipCreatePackingModal({ shipment, onClose, onSubmit }) {
  const init = shipment.packing
    ? { cbm: shipment.packing.cbm, gross: parseInt(shipment.packing.gross) || "", net: parseInt(shipment.packing.net) || "", lines: shipment.packing.lines.map((l) => ({ ...l })) }
    : { cbm: "", gross: "", net: "", lines: SHIP_PACKING_TEMPLATE.map((l) => ({ ...l })) };
  const [form, setForm] = useShipState(init);

  function setLine(i, key, val) {
    setForm((p) => ({ ...p, lines: p.lines.map((l, idx) => (idx === i ? { ...l, [key]: val === "" ? "" : Number(val) } : l)) }));
  }
  const lines = form.lines.map((l) => ({ ...l, packed: (Number(l.cartons) || 0) * (Number(l.perCtn) || 0) }));
  const totalCartons = lines.reduce((n, l) => n + (Number(l.cartons) || 0), 0);
  const totalPacked = lines.reduce((n, l) => n + l.packed, 0);
  const valid = form.cbm && form.gross && form.net && totalPacked > 0;

  function submit() {
    onSubmit({
      cbm: String(form.cbm),
      gross: form.gross + " kg",
      net: form.net + " kg",
      lines: lines.map(({ sku, product, cartons, perCtn, packed, fc }) => ({ sku, product, cartons: Number(cartons) || 0, perCtn: Number(perCtn) || 0, packed, fc })),
      totalCartons,
      totalPacked,
    });
  }

  return (
    <ShipModalShell
      title={(shipment.packing ? "Edit" : "Create") + " packing list"}
      sub={"Carton truth for " + shipment.label + ". Packed units are computed from cartons × units per carton."}
      onClose={onClose}
      width={680}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={submit}>
            <VyIcon name="check" size={14} /><span>Save packing list</span>
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
        <ShipFormField label="CBM" half>
          <input type="number" step="0.01" className="vy-input" style={shipInputStyle} value={form.cbm} onChange={(e) => setForm((p) => ({ ...p, cbm: e.target.value }))} placeholder="e.g. 1.64" />
        </ShipFormField>
        <ShipFormField label="Gross (kg)" half>
          <input type="number" className="vy-input" style={shipInputStyle} value={form.gross} onChange={(e) => setForm((p) => ({ ...p, gross: e.target.value }))} placeholder="e.g. 824" />
        </ShipFormField>
        <ShipFormField label="Net (kg)" half>
          <input type="number" className="vy-input" style={shipInputStyle} value={form.net} onChange={(e) => setForm((p) => ({ ...p, net: e.target.value }))} placeholder="e.g. 752" />
        </ShipFormField>
      </div>
      <div className="vy-kicker" style={{ marginBottom: 8 }}>Cartons per SKU</div>
      <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "hsl(var(--muted-bg) / 0.6)" }}>
              <th style={shipTh}>SKU</th>
              <th style={{ ...shipTh, textAlign: "right", width: 90 }}>Cartons</th>
              <th style={{ ...shipTh, textAlign: "right", width: 90 }}>Units/ctn</th>
              <th style={{ ...shipTh, textAlign: "right", width: 80 }}>Packed</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.sku} style={{ borderTop: "1px solid hsl(var(--border))" }}>
                <td style={{ ...shipTd, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{l.sku}</td>
                <td style={{ ...shipTd, textAlign: "right" }}>
                  <input type="number" value={l.cartons} onChange={(e) => setLine(i, "cartons", e.target.value)} style={{ ...shipInputStyle, height: 30, width: 70, textAlign: "right", padding: "0 8px" }} />
                </td>
                <td style={{ ...shipTd, textAlign: "right" }}>
                  <input type="number" value={l.perCtn} onChange={(e) => setLine(i, "perCtn", e.target.value)} style={{ ...shipInputStyle, height: 30, width: 70, textAlign: "right", padding: "0 8px" }} />
                </td>
                <td style={{ ...shipTd, textAlign: "right", fontWeight: 600 }}>{l.packed}</td>
              </tr>
            ))}
            <tr style={{ borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--muted-bg) / 0.4)" }}>
              <td style={{ ...shipTd, fontWeight: 700 }}>Total</td>
              <td style={{ ...shipTd, textAlign: "right", fontWeight: 700 }}>{totalCartons}</td>
              <td style={shipTd}></td>
              <td style={{ ...shipTd, textAlign: "right", fontWeight: 700 }}>{totalPacked}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ShipModalShell>
  );
}

// ----------------------------------------------------------------------
// Link FBA modal — destination FCs + expected units derive from the
// shipment's packing list (the source of truth). You can only allocate
// units that are actually packed for each FC, and never more than remain.
// ----------------------------------------------------------------------
function ShipLinkFbaModal({ shipment, onClose, onSubmit }) {
  // Per-FC packed totals from the packing list (source of truth)
  const packedByFc = {};
  (shipment.packing ? shipment.packing.lines : []).forEach((l) => {
    packedByFc[l.fc] = (packedByFc[l.fc] || 0) + l.packed;
  });
  // Already-linked expected units per FC
  const linkedByFc = {};
  shipment.fba.forEach((f) => { linkedByFc[f.fc] = (linkedByFc[f.fc] || 0) + f.expected; });

  const fcOptions = Object.keys(packedByFc).map((fc) => ({
    fc,
    packed: packedByFc[fc],
    remaining: Math.max(0, packedByFc[fc] - (linkedByFc[fc] || 0)),
  }));
  const firstOpen = fcOptions.find((o) => o.remaining > 0) || fcOptions[0];

  const [form, setForm] = useShipState({
    id: "",
    fc: firstOpen ? firstOpen.fc : "",
    expected: firstOpen ? String(firstOpen.remaining) : "",
    status: "Working",
  });

  const selected = fcOptions.find((o) => o.fc === form.fc) || { packed: 0, remaining: 0 };
  const expectedNum = Number(form.expected) || 0;
  const overAllocated = expectedNum > selected.remaining;
  const valid = form.id.trim() && expectedNum > 0 && !overAllocated;
  const toneFor = (s) => (s === "Receiving" ? "success" : s === "Working" ? "info" : "muted");

  function pickFc(fc) {
    const opt = fcOptions.find((o) => o.fc === fc);
    setForm((p) => ({ ...p, fc, expected: opt ? String(opt.remaining) : "" }));
  }

  const totalRemaining = fcOptions.reduce((n, o) => n + o.remaining, 0);

  function submit() {
    onSubmit({
      id: form.id.trim(),
      fc: form.fc,
      status: form.status,
      tone: toneFor(form.status),
      expected: expectedNum,
      received: 0,
      variance: 0,
      synced: "just now",
    });
  }

  return (
    <ShipModalShell
      title="Link FBA inbound"
      sub={"Allocate packed units from " + shipment.label + " to an Amazon FBA inbound. Quantities come from the packing list."}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={submit}>
            <VyIcon name="link" size={14} /><span>Link inbound</span>
          </button>
        </>
      }
    >
      {/* Source-of-truth context strip */}
      <div style={{ padding: "12px 14px", borderRadius: 10, background: "hsl(var(--accent) / 0.6)", border: "1px solid hsl(var(--border))", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <VyIcon name="clipboard" size={13} style={{ color: "hsl(var(--primary))" }} />
          <span className="vy-kicker">From packing list</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "hsl(var(--muted-fg))" }}>{totalRemaining} units unallocated</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {fcOptions.map((o) => (
            <div key={o.fc} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, padding: "3px 8px", borderRadius: 6, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
              <span style={{ fontWeight: 700, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>{o.fc}</span>
              <span style={{ color: "hsl(var(--muted-fg))" }}>{o.remaining} of {o.packed} left</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <ShipFormField label="FBA shipment ID">
          <input className="vy-input" style={shipInputStyle} value={form.id} onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))} placeholder="e.g. FBA17-AB1-2C3" />
        </ShipFormField>
        <ShipFormField label="Destination FC" half>
          <select className="vy-input" style={shipInputStyle} value={form.fc} onChange={(e) => pickFc(e.target.value)}>
            {fcOptions.map((o) => (
              <option key={o.fc} value={o.fc}>{o.fc} · {o.remaining} left</option>
            ))}
          </select>
        </ShipFormField>
        <ShipFormField label="Expected units" half>
          <input type="number" className="vy-input" style={{ ...shipInputStyle, borderColor: overAllocated ? "hsl(var(--danger))" : "hsl(var(--input))" }} value={form.expected} onChange={(e) => setForm((p) => ({ ...p, expected: e.target.value }))} />
          <span style={{ fontSize: 10.5, color: overAllocated ? "hsl(var(--danger))" : "hsl(var(--muted-fg))", marginTop: 1 }}>
            {overAllocated ? `Only ${selected.remaining} packed for ${form.fc}` : `Max ${selected.remaining} from packing list`}
          </span>
        </ShipFormField>
        <ShipFormField label="Status">
          <select className="vy-input" style={shipInputStyle} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option>Working</option><option>Receiving</option><option>Closed</option>
          </select>
        </ShipFormField>
      </div>
    </ShipModalShell>
  );
}

// ----------------------------------------------------------------------
// Update received modal — reconcile an FBA inbound. Received vs expected
// drives variance: shortage (danger), exact (success), overage (warning).
// ----------------------------------------------------------------------
function ShipReceiveModal({ entry, onClose, onSubmit }) {
  const [received, setReceived] = useShipState(String(entry.received || entry.expected));
  const recvNum = Number(received) || 0;
  const variance = recvNum - entry.expected;
  const tone = recvNum <= 0 ? "muted" : variance < 0 ? "danger" : variance > 0 ? "warning" : "success";
  const verdict = recvNum <= 0 ? "Not received yet" : variance < 0 ? Math.abs(variance) + " units short" : variance > 0 ? variance + " units over" : "Reconciled — exact match";

  return (
    <ShipModalShell
      title="Update received"
      sub={"Reconcile " + entry.id + " (" + entry.fc + "). Variance is computed against the " + entry.expected + " expected units."}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" onClick={() => onSubmit(recvNum)}>
            <VyIcon name="check" size={14} /><span>Save received</span>
          </button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 90, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
          <div className="vy-kicker" style={{ marginBottom: 4 }}>Expected</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{entry.expected}</div>
        </div>
        <div style={{ flex: 1, minWidth: 90, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
          <div className="vy-kicker" style={{ marginBottom: 4 }}>Received</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{recvNum}</div>
        </div>
        <div style={{ flex: 1, minWidth: 90, padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
          <div className="vy-kicker" style={{ marginBottom: 4 }}>Variance</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: `hsl(var(--${tone === "muted" ? "muted-fg" : tone}))` }}>{variance > 0 ? "+" + variance : variance}</div>
        </div>
      </div>
      <ShipFormField label="Received units">
        <input type="number" min="0" className="vy-input" style={shipInputStyle} value={received} onChange={(e) => setReceived(e.target.value)} autoFocus />
      </ShipFormField>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "10px 14px", borderRadius: 9, background: `hsl(var(--${tone === "muted" ? "muted-fg" : tone}) / 0.08)`, border: `1px solid hsl(var(--${tone === "muted" ? "muted-fg" : tone}) / 0.25)` }}>
        <VyIcon name={variance < 0 && recvNum > 0 ? "alert" : "check"} size={14} style={{ color: `hsl(var(--${tone === "muted" ? "muted-fg" : tone}))`, flexShrink: 0 }} />
        <span style={{ fontSize: 12.5 }}>{verdict}{variance < 0 && recvNum > 0 ? " — investigate shrinkage or carrier loss." : ""}</span>
      </div>
    </ShipModalShell>
  );
}

Object.assign(window, { VyShippingBody, SHIP_SHIPMENTS, SHIP_STAGES, SHIP_ORDER_SKUS });
