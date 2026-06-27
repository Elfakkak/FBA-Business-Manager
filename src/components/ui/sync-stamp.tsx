import { RefreshCw } from "lucide-react";
import { intgAgo } from "@/lib/integrations";

// Subtle "synced <ago>" indicator for any section fed by an external sync (Amazon
// SP-API / Ads). One shared component so the cadence reads the same everywhere.
export function SyncStamp({ ts, source = "Amazon", className }: { ts: string | null; source?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground ${className ?? ""}`} title={ts ? `Last sync from ${source}` : `Not yet synced from ${source}`}>
      <RefreshCw className="h-3 w-3" /> synced {intgAgo(ts)}
    </span>
  );
}
