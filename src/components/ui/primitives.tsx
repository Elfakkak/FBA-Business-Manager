import Link from "next/link";
import { cn, initials } from "@/lib/utils";
import { money, type Tone } from "@/lib/derive";
import type { InlineEditor } from "@/lib/use-inline-editor";
import { Pencil, Plus } from "lucide-react";

const TONE_FG: Record<Tone, string> = {
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
  info: "bg-info/12 text-info",
  brand: "bg-primary/12 text-primary",
  muted: "bg-muted text-muted-foreground",
};

export function Avatar({ name, tone = "brand", size = 32 }: { name: string; tone?: Tone; size?: number }) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-lg font-semibold", TONE_FG[tone])}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(name)}
    </span>
  );
}

export function SectionTitle({ icon: Icon, tone = "muted", title, count, sub, action, strong, className }: { icon: React.ElementType; tone?: Tone; title: React.ReactNode; count?: number; sub?: React.ReactNode; action?: React.ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-2", className)}>
      <div className="flex items-center gap-2.5">
        <span className={cn("inline-grid h-7 w-7 shrink-0 place-items-center rounded-md", TONE_FG[tone])}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className={strong ? "font-semibold" : "font-medium"}>{title}{count != null && <span className="text-muted-foreground"> ({count})</span>}</div>
          {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

// Shared date · source-link · amount history list (Product cost + Landed cost
// histories on the product page). `code2`/`href2` render an optional secondary
// muted link (e.g. the order behind an invoice). Latest row is tinted.
export function CostHistoryList({ items, highlight = "primary" }: {
  items: { date: string | null; href?: string | null; code?: string | null; subtitle?: string | null; href2?: string | null; code2?: string | null; amount: number }[];
  highlight?: "primary" | "info";
}) {
  return (
    <ul className="divide-y">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-2.5 py-2 text-sm">
          <span className="w-[88px] shrink-0 text-[12px] text-muted-foreground">{it.date ?? "—"}</span>
          {it.href ? <Link href={it.href} className="font-mono text-[12px] font-medium hover:text-primary" title={it.subtitle ?? undefined}>{it.code}</Link> : <span className="text-[12px] text-muted-foreground">{it.code ?? "—"}</span>}
          {it.code2 && (it.href2 ? <Link href={it.href2} className="hidden truncate font-mono text-[11px] text-muted-foreground hover:text-primary md:inline">{it.code2}</Link> : <span className="hidden text-[11px] text-muted-foreground md:inline">{it.code2}</span>)}
          <span className={cn("tabular ml-auto shrink-0 font-mono font-semibold", i === items.length - 1 && (highlight === "info" ? "text-info" : "text-primary"))}>{money(it.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

// Standard padded card header for edge-to-edge cards (tables). One source of truth
// for header spacing so the title/action never hug the card edges.
export function CardHeader({
  icon: Icon, tone = "muted", title, count, caption, action,
}: {
  icon?: React.ElementType; tone?: Tone; title: React.ReactNode; count?: number; caption?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
      <div className="flex items-center gap-2.5">
        {Icon && <span className={cn("inline-grid h-7 w-7 place-items-center rounded-md", TONE_FG[tone])}><Icon className="h-4 w-4" /></span>}
        <span className="text-sm font-medium">{title}{count != null && <span className="text-muted-foreground"> ({count})</span>}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{caption}{action}</div>
    </div>
  );
}

// Card with a padded header + edge-to-edge body (for tables). Use everywhere a
// full-width table needs a header — guarantees consistent spacing.
export function TableCard({
  icon, tone, title, count, caption, action, children,
}: {
  icon?: React.ElementType; tone?: Tone; title: React.ReactNode; count?: number; caption?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader icon={icon} tone={tone} title={title} count={count} caption={caption} action={action} />
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}

const BADGE_CLASS: Record<Tone, string> = {
  success: "vy-badge--success",
  warning: "vy-badge--warning",
  danger: "vy-badge--danger",
  info: "vy-badge--info",
  brand: "vy-badge--brand",
  muted: "vy-badge--muted",
};

export function Badge({ tone = "muted", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("vy-badge", BADGE_CLASS[tone], className)}>{children}</span>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("vy-card", className)}>{children}</div>;
}

const KPI_TONE_CLASS: Partial<Record<Tone, string>> = {
  success: "vy-kpi--success",
  warning: "vy-kpi--warning",
  danger: "vy-kpi--danger",
  info: "vy-kpi--info",
};

export function Kpi({
  label,
  value,
  sub,
  tone,
  source,
  icon: Icon,
  progress,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: Tone;
  source?: "amazon" | "manual";
  icon?: React.ElementType;
  progress?: number; // 0-100, renders a thin bar under the value
}) {
  return (
    <div className={cn("vy-card vy-kpi", tone && KPI_TONE_CLASS[tone])}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="vy-kicker">{label}</span>
        {source && <SourceTag source={source} />}
      </div>
      <div className="vy-kpi-value">{value}</div>
      {progress != null && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {sub && <div className="vy-kpi-sub">{sub}</div>}
    </div>
  );
}

const DOT_BG: Record<Tone, string> = {
  success: "bg-success", warning: "bg-warning", danger: "bg-danger",
  info: "bg-info", brand: "bg-primary", muted: "bg-muted-foreground",
};

// Responsive KPI strip wrapper — one source of truth for the grid so spacing &
// breakpoints stay identical app-wide. 5-up collapses 5→2; 3-up collapses 3→1.
export function KpiStrip({ cols = 5, children }: { cols?: 3 | 5; children: React.ReactNode }) {
  return <div className={cn("grid gap-3", cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-5")}>{children}</div>;
}

// Two-column section header (identity + optional "Next action" panel). Shared by
// the order Overview, the Invoices section, and Production — fix once, propagates.
export type NextAction = { kicker?: string; severity?: Tone; headline: React.ReactNode; detail?: React.ReactNode; cta?: React.ReactNode };
export function SectionHeader({ title, blurb, badges, topBadges, actions, nextAction }: {
  title: React.ReactNode; blurb?: React.ReactNode; badges?: React.ReactNode;
  topBadges?: React.ReactNode; actions?: React.ReactNode; nextAction?: NextAction | null;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid lg:grid-cols-[1.6fr_1fr]">
        <div className="p-5">
          {(topBadges || actions) && (
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">{topBadges}</div>
              {actions && <div className="flex shrink-0 gap-1.5">{actions}</div>}
            </div>
          )}
          <h1 className="text-2xl font-bold">{title}</h1>
          {blurb && <p className="mt-1.5 max-w-[60ch] text-[13px] text-muted-foreground">{blurb}</p>}
          {badges && <div className="mt-3 flex flex-wrap gap-1.5">{badges}</div>}
        </div>
        {nextAction && (
          <div className="border-t bg-accent/40 p-5 lg:border-l lg:border-t-0">
            <div className="vy-kicker mb-1.5 flex items-center gap-1.5">
              {nextAction.severity && <span className={cn("h-1.5 w-1.5 rounded-full", DOT_BG[nextAction.severity])} />}
              {nextAction.kicker ?? "Next action"}
            </div>
            <div className="text-base font-bold">{nextAction.headline}</div>
            {nextAction.detail && <p className="mb-3 mt-1 text-[12px] text-muted-foreground">{nextAction.detail}</p>}
            {nextAction.cta}
          </div>
        )}
      </div>
    </Card>
  );
}

// Shared inline-edit number/text cell — pairs with useInlineEditor. One styling
// source so every editable cell in the app looks and behaves the same.
export function EditCell({ value, onChange, placeholder, align = "right", mode = "decimal" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; align?: "left" | "right"; mode?: "numeric" | "decimal" | "text";
}) {
  return <input inputMode={mode === "text" ? undefined : mode} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className={cn("w-full rounded-md border bg-background px-2 py-1 font-mono text-[12px] outline-none focus:ring-2 focus:ring-ring", align === "right" && "text-right")} />;
}

// Shared Edit / Done·Cancel (+ optional Add) toolbar driven by an InlineEditor.
export function EditToolbar({ editor, editable = true, addLabel, onAdd }: { editor: InlineEditor; editable?: boolean; addLabel?: string; onAdd?: () => void }) {
  if (editor.on) return (
    <div className="flex shrink-0 items-center gap-1.5">
      {editor.error && <span className="mr-1 max-w-[220px] truncate text-[11px] text-danger" title={editor.error}>{editor.error}</span>}
      <button type="button" onClick={editor.cancel} className="vy-btn vy-btn--ghost vy-btn--sm">Cancel</button>
      <button type="button" onClick={editor.save} disabled={editor.saving} className="vy-btn vy-btn--primary vy-btn--sm">{editor.saving ? "Saving…" : "Done"}</button>
    </div>
  );
  return (
    <div className="flex shrink-0 gap-1.5">
      {editable && <button type="button" onClick={editor.begin} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</button>}
      {onAdd && <button type="button" onClick={onAdd} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> {addLabel ?? "Add"}</button>}
    </div>
  );
}

export function SourceTag({ source }: { source: "amazon" | "manual" }) {
  const amazon = source === "amazon";
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", amazon ? "bg-info" : "border border-muted-foreground/60")} />
      {amazon ? "Amazon" : "Manual"}
    </span>
  );
}

export function PageHead({
  kicker,
  title,
  sub,
  actions,
  leading,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <div className="vy-card vy-page-head-card">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          {kicker && <div className="vy-kicker mb-1">{kicker}</div>}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {sub && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// chip pill with optional icon (matches prototype vy-chip)
export function Chip({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="vy-chip">
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}
