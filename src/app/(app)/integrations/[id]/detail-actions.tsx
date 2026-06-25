"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { connectIntegration, syncIntegration, disconnectIntegration } from "../actions";
import type { IntegrationDef } from "@/lib/integrations";
import { RefreshCw, Plug } from "lucide-react";

export function IntegrationDetailActions({ def, connected }: { def: IntegrationDef; connected: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { const r = await fn(); if (!r.ok) setError(r.error ?? "Failed"); router.refresh(); });

  function onConnect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await connectIntegration(def.id, form);
      if (!r.ok) { setError(r.error); return; }
      setOpen(false); router.refresh();
    });
  }

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

  return (
    <>
      <button onClick={() => setOpen(true)} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Plug className="h-4 w-4" /> Connect</button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Connect ${def.name}`}>
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">Credentials are stored server-side (owner-only). Live sync activates once the {def.name} fetch is wired.</p>
        <form onSubmit={onConnect} className="space-y-4">
          {def.creds.map((f) => (
            <Field key={f.name} label={f.label}>
              <input name={f.name} type={f.type === "password" ? "password" : "text"} required autoComplete="off" className={inputCls} />
            </Field>
          ))}
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save & connect"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
