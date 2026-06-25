"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncIntegration, disconnectIntegration } from "../actions";
import { ConnectIntegrationModal } from "../connect-modal";
import { AmazonConnect } from "../amazon-connect";
import type { IntegrationDef } from "@/lib/integrations";
import { RefreshCw, Plug } from "lucide-react";

export function IntegrationDetailActions({ def, connected }: { def: IntegrationDef; connected: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { const r = await fn(); if (!r.ok) setError(r.error ?? "Failed"); router.refresh(); });

  if (connected) {
    return (
      <>
        <button onClick={() => run(() => syncIntegration(def.id))} disabled={pending} className="vy-btn vy-btn--outline inline-flex items-center gap-1.5">
          <RefreshCw className="h-4 w-4" /> Sync now
        </button>
        <button onClick={() => run(() => disconnectIntegration(def.id))} disabled={pending} className="vy-btn vy-btn--ghost text-danger">Disconnect</button>
      </>
    );
  }

  if (def.id === "amazon") return <AmazonConnect def={def} />;

  return (
    <>
      <button onClick={() => setOpen(true)} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Plug className="h-4 w-4" /> Connect</button>
      <ConnectIntegrationModal def={def} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
