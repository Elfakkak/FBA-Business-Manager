import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/derive";

const TONE_CLASS: Record<Tone, string> = {
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  danger: "text-danger bg-danger/10",
  info: "text-info bg-info/10",
  brand: "text-primary bg-primary/12",
  muted: "text-muted-foreground bg-muted",
};

export function Badge({ tone = "muted", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold", TONE_CLASS[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-card shadow-sm", className)}>{children}</div>;
}

const KPI_VALUE_TONE: Partial<Record<Tone, string>> = {
  success: "text-net",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-revenue",
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
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {source && <SourceTag source={source} />}
      </div>
      <div className={cn("tabular mt-1.5 font-mono text-xl font-semibold", tone && KPI_VALUE_TONE[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
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
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {kicker && <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{kicker}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
