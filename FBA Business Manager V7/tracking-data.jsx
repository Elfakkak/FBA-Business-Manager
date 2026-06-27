// Shipment tracking — a 17TRACK-shaped milestone model layered on top of the
// physical shipments in logistics-data. Prototype-honest: events are simulated /
// manually advanced, but the SHAPE matches a 17TRACK tracking response (main
// status + sub status + checkpoint{time, location, description}) so a real
// 17TRACK API key drops straight in later — same timeline, just auto-fed.
//
// 17TRACK main package statuses we map to (e_code): InfoReceived(10),
// InTransit(20), Delivered(40). Freight legs (pickup, departure, customs,
// arrival, FBA handover) ride as sub-statuses + checkpoints under those mains.
//
// Load AFTER: logistics-data.

// Ordered freight milestones. `stage` aligns with LOG_STAGES so the existing
// shipment.stage drives "how far along". `main`/`code` are the 17TRACK mapping.
const TRK_MILESTONES = [
  { stage: "Booked",     main: "InfoReceived", code: 10, label: "Booking confirmed",        where: "origin",  icon: "clipboard" },
  { stage: "Picked up",  main: "InTransit",    code: 20, label: "Picked up at origin",      where: "origin",  icon: "truck" },
  { stage: "In transit", main: "InTransit",    code: 20, label: "Departed — on the water",  where: "transit", icon: "ship" },
  { stage: "Customs",    main: "InTransit",    code: 20, label: "Customs clearance",        where: "dest",    icon: "shield" },
  { stage: "Delivered",  main: "Delivered",    code: 40, label: "Arrived at destination",   where: "dest",    icon: "mapPin" },
  { stage: "At FBA",     main: "Delivered",    code: 40, label: "Delivered to Amazon FC",   where: "dest",    icon: "cube" },
];

const TRK_MAIN_TONE = { NotFound: "muted", InfoReceived: "info", InTransit: "info", Delivered: "success", Exception: "danger" };
const TRK_MAIN_LABEL = { NotFound: "Not found", InfoReceived: "Info received", InTransit: "In transit", Delivered: "Delivered", Exception: "Exception" };

// Seed tracking identifiers for the booked shipments (Draft/unbooked have none).
const TRK_SEED = {
  "SHP-2605-001": { trackingNo: "6156743593", bookingRef: "FSHY2604037121", carrier: "Pacific Star LCL", scac: "PSLU" },
  "SHP-2605-003": { trackingNo: "MEDUFR240608", bookingRef: "FLX-NGB-9087", carrier: "Maersk (via Flexport)", scac: "MAEU" },
  "SHP-2605-007": { trackingNo: "DSVO-7781-YT", bookingRef: "DSV-YTN-4420", carrier: "DSV Ocean", scac: "DSVO" },
  "SHP-2604-021": { trackingNo: "JD0099887766", bookingRef: "DHL-SZX-1188", carrier: "DHL Express", scac: "DHLE" },
  "SHP-2604-014": { trackingNo: "JD0044553322", bookingRef: "DSV-SZX-3310", carrier: "DSV Air", scac: "DSVA" },
};

// Carriers we can hand to 17TRACK — name + carrier code (SCAC / 17TRACK code).
// Ocean lines, integrators, and the common CN forwarders. "Other" keeps a
// free-text carrier when it's not in the list.
const TRK_CARRIERS = [
  { name: "Maersk", scac: "MAEU" },
  { name: "MSC", scac: "MSCU" },
  { name: "CMA CGM", scac: "CMDU" },
  { name: "COSCO", scac: "COSU" },
  { name: "Hapag-Lloyd", scac: "HLCU" },
  { name: "ONE (Ocean Network Express)", scac: "ONEY" },
  { name: "Evergreen", scac: "EGLV" },
  { name: "OOCL", scac: "OOLU" },
  { name: "Flexport", scac: "FLXT" },
  { name: "DSV Ocean", scac: "DSVO" },
  { name: "DSV Air", scac: "DSVA" },
  { name: "Pacific Star LCL", scac: "PSLU" },
  { name: "DHL Express", scac: "DHLE" },
  { name: "FedEx", scac: "FDXE" },
  { name: "UPS", scac: "UPSN" },
];

// ---- date helpers (etd/eta are "Jun 12" style; assume 2026) ----
const TRK_MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function trkParseLabel(label, year) {
  if (!label || label === "—") return null;
  const m = label.match(/([A-Za-z]{3})\s*(\d{1,2})/);
  if (!m) return null;
  const mo = TRK_MONTHS[m[1].slice(0, 3)];
  if (mo == null) return null;
  return new Date(year || 2026, mo, Number(m[2]), 9, 0, 0);
}
function trkFmt(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function trkAgo(ts) {
  if (!ts) return "never";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const mi = Math.floor(s / 60); if (mi < 60) return mi + " min ago";
  const h = Math.floor(mi / 60); if (h < 24) return h + " h ago";
  return Math.floor(h / 24) + " d ago";
}

// ---- persistence (manual advances, pasted updates, sync stamps) ----
const TRK_STORE_KEY = "vy_tracking_v1";
function trkLoad() {
  try { const r = localStorage.getItem(TRK_STORE_KEY); const o = r ? JSON.parse(r) : {}; return o && typeof o === "object" ? o : {}; }
  catch (e) { return {}; }
}
function trkSave(o) { try { localStorage.setItem(TRK_STORE_KEY, JSON.stringify(o)); } catch (e) {} }
function trkPatch(id, patch) {
  const all = trkLoad();
  all[id] = { ...(all[id] || {}), ...patch };
  trkSave(all);
  return all[id];
}

// Merge seed + persisted identifiers for a shipment.
function trkInfo(s) {
  const ov = trkLoad()[s.id] || {};
  const seed = TRK_SEED[s.id] || {};
  return {
    trackingNo: ov.trackingNo || seed.trackingNo || "",
    bookingRef: ov.bookingRef || seed.bookingRef || "",
    carrier: ov.carrier || seed.carrier || s.forwarder || "",
    scac: ov.scac || seed.scac || "",
    lastSync: ov.lastSync || null,
    etaOverride: ov.eta || null,
  };
}

// Effective stage = persisted advance override (if further along) else shipment.stage.
function trkStage(s) {
  const ov = trkLoad()[s.id] || {};
  const base = LOG_STAGES.indexOf(s.stage);
  const adv = ov.stage ? LOG_STAGES.indexOf(ov.stage) : -1;
  return LOG_STAGES[Math.max(base, adv)] || s.stage;
}

// Build the 17TRACK-shaped event list for a shipment. Done milestones get a
// synthesized checkpoint (time + location + description); future ones are pending.
function trkEvents(s) {
  const info = trkInfo(s);
  const stage = trkStage(s);
  const doneIdx = TRK_MILESTONES.findIndex((m) => m.stage === stage);
  const etd = trkParseLabel(s.etd) || new Date(2026, 5, 1, 9, 0);
  const eta = trkParseLabel(info.etaOverride) || trkParseLabel(s.eta) || new Date(etd.getTime() + 18 * 864e5);
  const span = Math.max(1, eta.getTime() - etd.getTime());
  // fraction of the etd→eta window each milestone lands at
  const frac = [0, 0.06, 0.18, 0.74, 1.0, 1.12];
  const loc = (where) => where === "origin" ? s.origin : where === "dest" ? s.destination : "On the water";

  return TRK_MILESTONES.map((m, i) => {
    const done = doneIdx >= 0 && i <= doneIdx;
    const cur = i === doneIdx;
    const ts = done ? etd.getTime() + span * frac[i] : null;
    return {
      ...m, done, cur,
      ts,
      timeLabel: done ? trkFmt(ts) : null,
      location: loc(m.where),
      mainLabel: TRK_MAIN_LABEL[m.main],
    };
  });
}

// Current 17TRACK main status for a shipment (for badges/columns).
function trkStatus(s) {
  const info = trkInfo(s);
  if (!info.trackingNo) return { main: "NotFound", label: "No tracking", tone: "muted" };
  const stage = trkStage(s);
  const m = TRK_MILESTONES.find((x) => x.stage === stage);
  const main = m ? m.main : "InfoReceived";
  return { main, label: TRK_MAIN_LABEL[main], tone: TRK_MAIN_TONE[main], stageLabel: m ? m.label : stage };
}

// Advance to the next milestone (manual). Returns new stage or null if at end.
function trkAdvance(s) {
  const stage = trkStage(s);
  const idx = LOG_STAGES.indexOf(stage);
  const next = LOG_STAGES[idx + 1];
  if (!next) return null;
  trkPatch(s.id, { stage: next, lastSync: Date.now() });
  return next;
}
function trkSyncNow(s) { return trkPatch(s.id, { lastSync: Date.now() }); }

// ----------------------------------------------------------------------
// FORWARDER-EMAIL PARSER — pulls booking ref / tracking no / cargo no / ETA out
// of a pasted message (handles the bilingual CN/EN overseas-booking format).
// ----------------------------------------------------------------------
function trkParseForwarderMessage(text) {
  const out = { bookingRef: "", trackingNo: "", cargoNo: "", reservationNo: "", eta: "", etaDate: null };
  if (!text) return out;

  // booking / order ref in brackets: [FSHY2604037122]
  let m = text.match(/[\[【]\s*([A-Z]{2,}[A-Z0-9\-]{4,})\s*[\]】]/i);
  if (m) out.bookingRef = m[1];

  // shipment / 货物编号 number — a 8-14 digit run, prefer one after Shipment/货物编号
  m = text.match(/(?:Shipment|货物编号|貨物編號)\D{0,8}(\d{8,16})/i);
  if (m) out.trackingNo = m[1];
  // a second long number → cargo / container
  const nums = [...text.matchAll(/\b(\d{8,16})\b/g)].map((x) => x[1]);
  if (!out.trackingNo && nums[0]) out.trackingNo = nums[0];
  const other = nums.find((n) => n !== out.trackingNo);
  if (other) out.cargoNo = other;

  // reservation number: "reservation number is ISA:…"  /  预约号[:为]…
  // stop before "Shipment"/a long digit run so it doesn't swallow the tracking no.
  m = text.match(/reservation number is\s+(.+?)(?=\s+Shipment|\s+\d{8,}|[,.;\n])/i)
    || text.match(/预约[号編编]\s*[:：为]?\s*(.+?)(?=\s*Shipment|\s*\d{8,}|[,，。;\n])/);
  if (m) out.reservationNo = m[1].trim();

  // ETA: explicit date 2026-05-23, or after "estimated delivery"/"预计交货"
  m = text.match(/(?:estimated delivery|预计交货|預計交貨)[^\d]{0,12}(\d{4}-\d{1,2}-\d{1,2})/i)
    || text.match(/(\d{4}-\d{1,2}-\d{1,2})/);
  if (m) {
    out.eta = m[1];
    const p = m[1].split("-").map(Number);
    out.etaDate = new Date(p[0], p[1] - 1, p[2]);
  }
  return out;
}

// Apply a parsed message to a shipment's tracking record.
function trkApplyParsed(s, parsed) {
  const patch = { lastSync: Date.now() };
  if (parsed.trackingNo) patch.trackingNo = parsed.trackingNo;
  if (parsed.bookingRef) patch.bookingRef = parsed.bookingRef;
  if (parsed.etaDate) {
    patch.eta = parsed.etaDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return trkPatch(s.id, patch);
}

// Apply manually-entered / corrected fields (the editable form path). Each
// field is optional; carrier name maps to its SCAC via TRK_CARRIERS when known.
function trkApplyManual(s, fields) {
  const patch = { lastSync: Date.now() };
  if (fields.trackingNo != null) patch.trackingNo = String(fields.trackingNo).trim();
  if (fields.bookingRef != null) patch.bookingRef = String(fields.bookingRef).trim();
  if (fields.carrier != null) {
    patch.carrier = String(fields.carrier).trim();
    const hit = TRK_CARRIERS.find((c) => c.name === patch.carrier);
    patch.scac = hit ? hit.scac : (fields.scac != null ? String(fields.scac).trim() : "");
  } else if (fields.scac != null) {
    patch.scac = String(fields.scac).trim();
  }
  if (fields.eta) {
    const d = trkParseLabel(fields.eta);
    patch.eta = d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : String(fields.eta).trim();
  }
  return trkPatch(s.id, patch);
}

Object.assign(window, {
  TRK_MILESTONES, TRK_MAIN_TONE, TRK_MAIN_LABEL, TRK_SEED,
  trkFmt, trkAgo, trkLoad, trkPatch, trkInfo, trkStage, trkEvents, trkStatus, trkParseLabel,
  trkAdvance, trkSyncNow, trkParseForwarderMessage, trkApplyParsed, trkApplyManual,
  TRK_CARRIERS,
});
