"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";

// Triggers the full Amazon pull (/api/sync): inventory, inbound, sales/velocity/price,
// ad spend. Same endpoint the nightly cron uses.
export function SyncAllButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg("Pulling everything from Amazon — inventory, inbound, sales & ads. This can take a minute…");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const j = await res.json();
      const r = j.results ?? {};
      const part = (k: string, label: string) => (r[k]?.error ? `${label}: failed` : r[k] ? `${label} ✓` : null);
      setMsg([part("inventory", "Inventory"), part("inbound", "Inbound"), part("sales", "Sales/price"), part("ads", "Ads")].filter(Boolean).join(" · ") || (j.ok ? "Synced ✓" : "Sync failed"));
      router.refresh();
    } catch {
      setMsg("Sync request failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={run} disabled={busy} className={className ?? "vy-btn vy-btn--primary inline-flex items-center gap-1.5"}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {busy ? "Syncing…" : "Sync everything"}
      </button>
      {msg && <span className="max-w-xs text-right text-[11px] text-muted-foreground">{msg}</span>}
    </div>
  );
}
