import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/derive";

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
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: Tone;
  source?: "amazon" | "manual";
}) {
  return (
    <div className={cn("vy-card vy-kpi", tone && KPI_TONE_CLASS[tone])}>
      <div className="flex items-center gap-1.5">
        <span className="vy-kicker">{label}</span>
        {source && <SourceTag source={source} />}
      </div>
      <div className="vy-kpi-value">{value}</div>
      {sub && <div className="vy-kpi-sub">{sub}</div>}
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
}: {
  kicker?: string;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="vy-card vy-page-head-card">
      <div className="min-w-0">
        {kicker && <div className="vy-kicker mb-1">{kicker}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
