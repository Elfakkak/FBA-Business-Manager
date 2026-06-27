"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DollarSign, Receipt, ClipboardCheck, Truck, Hammer, Package, Check, AlertTriangle } from "lucide-react";
import { ACT_LABEL_LONG, ACT_DEFAULT_TONE, relTime, groupByDay, type ActEvent, type ActCat } from "@/lib/activity";

const ICON: Record<ActCat, React.ElementType> = { Pay: DollarSign, Inv: Receipt, Insp: ClipboardCheck, Ship: Truck, Prod: Hammer, Doc: Package };
const CATS: ActCat[] = ["Pay", "Inv", "Insp", "Ship", "Prod", "Doc"];

// One shared feed — the order Activity drawer (variant="drawer") and the portfolio
// Activity journal (variant="page") render from the same component.
export function ActivityFeed({ events, nowMs, variant = "drawer", showOrder = false, initialCat = "All" }: {
  events: ActEvent[]; nowMs: number; variant?: "drawer" | "page"; showOrder?: boolean; initialCat?: "All" | ActCat;
}) {
  const [filter, setFilter] = useState<"All" | ActCat>(initialCat);
  const counts = useMemo(() => { const c = {} as Record<ActCat, number>; for (const cat of CATS) c[cat] = events.filter((e) => e.cat === cat).length; return c; }, [events]);
  const present = CATS.filter((c) => counts[c] > 0);
  const filtered = filter === "All" ? events : events.filter((e) => e.cat === filter);
  const groups = groupByDay(filtered, nowMs);
  const long = variant === "page";

  return (
    <div className="space-y-4">
      {/* filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <Chip active={filter === "All"} onClick={() => setFilter("All")} label="All" count={events.length} />
        {present.map((c) => <Chip key={c} active={filter === c} onClick={() => setFilter(c)} label={long ? ACT_LABEL_LONG[c] : c} count={counts[c]} />)}
      </div>

      <div className="space-y-5">
        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">No activity yet.</div>
        ) : groups.map((g) => (
          <div key={g.day}>
            <div className="mb-2 flex items-center justify-between">
              <span className="vy-kicker">{g.day}</span>
              {long && <span className="text-[10.5px] text-muted-foreground">{g.items.length} event{g.items.length === 1 ? "" : "s"}</span>}
            </div>
            <div className="space-y-1.5">
              {g.items.map((e) => <Row key={e.id} e={e} nowMs={nowMs} long={long} showOrder={showOrder} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button type="button" onClick={onClick} className={cn("vy-chip inline-flex items-center gap-1.5", active && "is-active")}>
      {label}{count > 0 && <span className={cn("text-[10px]", active ? "opacity-80" : "text-muted-foreground")}>{count}</span>}
    </button>
  );
}

function Row({ e, nowMs, long, showOrder }: { e: ActEvent; nowMs: number; long: boolean; showOrder: boolean }) {
  const tone = e.tone || ACT_DEFAULT_TONE[e.cat];
  const Ico = e.icon === "check" ? Check : e.icon === "alert" ? AlertTriangle : ICON[e.cat];
  return (
    <div className="flex gap-3 rounded-lg border bg-background/40 px-3 py-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md" style={{ background: `hsl(var(--${tone}) / 0.12)`, color: `hsl(var(--${tone}))` }}><Ico className="h-3.5 w-3.5" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold leading-snug">{e.title}</div>
        {long && e.detail && <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{e.detail}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="rounded bg-muted px-1 py-px font-mono uppercase tracking-wide">{e.cat}</span>
          {showOrder && <Link href={`/orders/${e.orderId}`} className="font-mono hover:text-primary">{e.orderId}</Link>}
          {e.actor && <span>· {e.actor}</span>}
          <span>· {relTime(e.at, nowMs)}</span>
        </div>
      </div>
    </div>
  );
}
