// notifications-data.jsx — derived ALERTS for the business. Nothing is hand-
// maintained: every alert is computed from existing data so it's always live.
//   • Reorder      — products low on cover (amazon-source reorder plan)
//   • Production    — orders whose factory run is finishing soon
//   • Shipping      — shipments approaching port / Amazon FC by ETA
// Each alert: { id, type, sev, icon, title, detail, href, days }  (days = days
// until it matters; negative = overdue). Sorted soonest-first. Load after
// amazon-source / logistics-data / orders-data.

// Tolerant date → days-from-today. Accepts ISO ("2026-06-30") or "Jun 24".
function notifDaysUntil(str) {
  if (!str) return null;
  let d = null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) d = new Date(str + "T00:00:00");
  else {
    const t = Date.parse(str + " 2026");
    if (!isNaN(t)) d = new Date(t);
  }
  if (!d || isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function notifAll() {
  const out = [];

  // 1) Reorder alerts — products at/under their cover target.
  if (typeof amzReorderPlan === "function") {
    try {
      amzReorderPlan(60).forEach((p) => {
        if (p.urgency === "ok" || p.need <= 0) return;
        const dleft = isFinite(p.daysLeft) ? Math.round(p.daysLeft) : null;
        out.push({
          id: "reorder-" + p.familyId,
          type: "Reorder", sev: p.urgency === "now" ? "danger" : "warning", icon: "boxes",
          title: "Reorder " + p.name,
          detail: p.need.toLocaleString() + " units · " + (dleft != null ? dleft + " days of stock left" : "low stock"),
          href: "Vyonix Performance.html",
          days: dleft,
        });
      });
    } catch (e) {}
  }

  // 2) Shipping alerts — open shipments by ETA (to port / Amazon FC).
  if (typeof logAllShipments === "function") {
    try {
      logAllShipments().forEach((s) => {
        const stage = (typeof trkStage === "function" ? trkStage(s) : s.stage) || "";
        if (/received|delivered|closed/i.test(stage)) return;
        const days = notifDaysUntil(s.eta);
        const atAmazon = /fba|amazon|fc|receiv/i.test(stage);
        out.push({
          id: "ship-" + s.id,
          type: "Shipping", sev: days != null && days <= 5 ? "warning" : "info", icon: "ship",
          title: s.id + " → " + (atAmazon ? "Amazon FC" : s.destination),
          detail: stage + " · ETA " + (s.eta || "TBD") + (days != null ? " (" + (days < 0 ? Math.abs(days) + "d late" : days + "d") + ")" : ""),
          href: "Vyonix Shipment.html?shipment=" + encodeURIComponent(s.id),
          days: days != null ? days : 999,
        });
      });
    } catch (e) {}
  }

  // 3) Production alerts — orders whose run is finishing (Day X of Y).
  if (typeof ordAllOrders === "function") {
    try {
      ordAllOrders().forEach((o) => {
        const m = (o.production || "").match(/day\s+(\d+)\s+of\s+(\d+)/i);
        if (!m) return;
        const done = Number(m[1]), total = Number(m[2]);
        const left = Math.max(0, total - done);
        if (left > 14) return; // only surface when finishing within ~2 weeks
        out.push({
          id: "prod-" + o.id,
          type: "Production", sev: left <= 3 ? "warning" : "info", icon: "hammer",
          title: o.title || o.id,
          detail: left === 0 ? "Production complete — ready to ship" : "Production finishes in " + left + " day" + (left === 1 ? "" : "s"),
          href: "Vyonix Order Shell.html?order=" + encodeURIComponent(o.id),
          days: left,
        });
      });
    } catch (e) {}
  }

  out.sort((a, b) => (a.days == null ? 999 : a.days) - (b.days == null ? 999 : b.days));
  return out;
}

function notifCount() { return notifAll().length; }
function notifUrgentCount() { return notifAll().filter((a) => a.sev === "danger").length; }

Object.assign(window, { notifDaysUntil, notifAll, notifCount, notifUrgentCount });
