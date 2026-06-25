"use client";

import { useState, useTransition } from "react";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { saveAmazonSetup } from "./actions";
import type { IntegrationDef } from "@/lib/integrations";
import { Plug } from "lucide-react";

// Amazon SP-API uses an OAuth round-trip instead of a pasted refresh token:
// save the app details, then redirect the browser to Seller Central consent.
export function AmazonConnect({ def, className }: { def: IntegrationDef; className?: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await saveAmazonSetup(form);
      if (!res.ok) { setError(res.error); return; }
      // hand off to the consent flow (full-page navigation, not client routing)
      window.location.href = "/integrations/amazon/connect";
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={className ?? "vy-btn vy-btn--primary inline-flex items-center gap-1.5"}>
        <Plug className="h-4 w-4" /> Connect
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Connect Amazon Seller Central">
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">Enter your SP-API app details, then authorize on Amazon — no refresh token to copy by hand.</p>
        <div className="mb-4 rounded-lg border bg-accent/40 p-3">
          <div className="vy-kicker mb-1.5">Setup</div>
          <ol className="list-decimal space-y-1 pl-4 text-[12px] text-muted-foreground">{def.howto.map((s, i) => <li key={i}>{s}</li>)}</ol>
          {def.docsUrl && <a href={def.docsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[12px] font-medium text-primary hover:underline">SP-API docs →</a>}
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          {def.creds.map((c) => (
            <Field key={c.name} label={c.label}>
              <input name={c.name} type={c.type === "password" ? "password" : "text"} required={c.name !== "marketplace_id" && c.name !== "region"} autoComplete="off" className={inputCls}
                defaultValue={c.name === "marketplace_id" ? "ATVPDKIKX0DER" : c.name === "region" ? "na" : ""} />
            </Field>
          ))}
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save & authorize with Amazon"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
