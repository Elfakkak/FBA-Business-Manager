import { money } from "@/lib/derive";

// One order-activity event, derived from real records (no events table).
export type ActCat = "Pay" | "Inv" | "Insp" | "Ship" | "Prod" | "Doc";
export type ActEvent = {
  id: string;
  cat: ActCat;
  title: string;
  detail?: string;
  at: string;            // ISO timestamp
  orderId: string;
  actor?: string;
  tone?: string;         // override (success/danger/…); default derived from cat
  icon?: "check" | "alert"; // override; default derived from cat
};

export const ACT_LABEL_LONG: Record<ActCat, string> = { Pay: "Payments", Inv: "Invoices", Insp: "Inspection", Ship: "Shipping", Prod: "Production", Doc: "Docs" };
export const ACT_DEFAULT_TONE: Record<ActCat, string> = { Pay: "info", Inv: "info", Insp: "info", Ship: "info", Prod: "muted", Doc: "success" };

const at = (d: string | null | undefined, time = "09:00:00") => {
  if (!d) return null;
  return d.length <= 10 ? `${d}T${time}` : d;
};
const fmtShort = (d: string | null | undefined) => (d ? new Date(d.length <= 10 ? `${d}T00:00:00` : d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

// ---- relative time + day grouping (computed against a passed `nowMs` so SSR/CSR agree) ----
export function relTime(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.round((nowMs - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7); if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function dayLabel(iso: string, nowMs: number): string {
  const d = new Date(iso); const now = new Date(nowMs);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Group sorted (desc) events by day label, preserving order.
export function groupByDay(events: ActEvent[], nowMs: number): { day: string; items: ActEvent[] }[] {
  const out: { day: string; items: ActEvent[] }[] = [];
  for (const e of events) {
    const day = dayLabel(e.at, nowMs);
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(e);
    else out.push({ day, items: [e] });
  }
  return out;
}

// ---- derive an order's activity from its real records ----
type Inv = { id: string; vendor: string; total: number; issued: string | null; created_at: string; payments: { amount: number; payment_date: string | null; status: string; method: string | null }[]; lines?: unknown[] };
type Insp = { inspector: string | null; partner_name: string | null; aql: string | null; created_at: string; completed_date: string | null; result: string; defects_critical: number | null; defects_minor: number | null } | null;
type Ship = { id: string; stage: string; mode: string; origin: string | null; destination: string | null; eta: string | null; etd?: string | null; created_at?: string | null };

export function deriveOrderActivity(orderId: string, data: { placedOn: string | null; invoices: Inv[]; inspection: Insp; shipments: Ship[]; actor?: string }): ActEvent[] {
  const ev: ActEvent[] = [];
  const push = (cat: ActCat, title: string, when: string | null, opts: Partial<ActEvent> = {}) => {
    if (!when) return;
    ev.push({ id: `${orderId}-${cat}-${ev.length}`, cat, title, at: when, orderId, actor: data.actor, ...opts });
  };

  if (data.placedOn) push("Prod", `Order ${orderId} placed`, at(data.placedOn, "08:00:00"), { detail: "Purchase order created" });

  for (const inv of data.invoices) {
    push("Inv", `${inv.id} logged at ${money(inv.total)}`, at(inv.issued, "09:00:00") ?? inv.created_at, {
      detail: `${inv.vendor}${inv.lines && inv.lines.length ? ` · ${inv.lines.length} line${inv.lines.length > 1 ? "s" : ""}` : ""}`,
    });
    for (const p of inv.payments) {
      if (p.status === "Cleared") {
        push("Pay", `Payment cleared · ${money(p.amount)}`, at(p.payment_date, "12:00:00") ?? inv.created_at, { detail: `${inv.id}${p.method ? ` · ${p.method}` : ""}`, tone: "success", icon: "check" });
      } else {
        push("Pay", `Payment ${p.status.toLowerCase()}${p.payment_date ? ` for ${fmtShort(p.payment_date)}` : ""} · ${money(p.amount)}`, at(p.payment_date, "12:00:00") ?? inv.created_at, { detail: inv.id });
      }
    }
  }

  if (data.inspection) {
    const i = data.inspection;
    push("Insp", `Inspection booked${i.inspector ? ` with ${i.inspector}` : ""}`, i.created_at, { detail: i.partner_name || i.aql || undefined });
    if (i.completed_date && i.result && i.result !== "pending") {
      push("Insp", `Inspection ${i.result}`, at(i.completed_date, "12:00:00"), {
        detail: `${i.defects_critical ?? 0} critical · ${i.defects_minor ?? 0} minor`,
        tone: i.result === "pass" ? "success" : i.result === "fail" ? "danger" : undefined,
        icon: i.result === "fail" ? "alert" : i.result === "pass" ? "check" : undefined,
      });
    }
  }

  for (const s of data.shipments) {
    const route = s.origin && s.destination ? `${s.origin} → ${s.destination}` : null;
    const when = at(s.etd, "10:00:00") ?? s.created_at ?? null;
    push("Ship", `Shipment ${s.id} — ${s.stage}`, when, { detail: [s.mode, route, s.eta ? `ETA ${fmtShort(s.eta)}` : null].filter(Boolean).join(" · ") || undefined });
  }

  return ev.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}
