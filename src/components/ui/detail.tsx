import { Card } from "@/components/ui/primitives";
import type { Tone } from "@/lib/derive";

// Small stat card used across detail pages (shipment / FBA / invoice KPI strips).
export function StatCard({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: Tone }) {
  return (
    <Card className="p-4">
      <div className="vy-kicker">{label}</div>
      <div className="mt-1 text-lg font-bold" style={tone ? { color: `hsl(var(--${tone}))` } : undefined}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

// Label/value cell inside the bordered grids on detail pages.
export function GridField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-3">
      <div className="vy-kicker mb-1">{label}</div>
      <div className="text-[13px] font-semibold">{value}</div>
    </div>
  );
}
