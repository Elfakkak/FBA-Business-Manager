"use client";

import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { useFormModal } from "@/lib/use-form-modal";
import { connectIntegration } from "./actions";
import type { IntegrationDef } from "@/lib/integrations";

// Single connect dialog used by the Settings hub, the standalone hub, and the
// integration detail page. Credential fields + per-integration "how to get these".
export function ConnectIntegrationModal({ def, open, onClose }: { def: IntegrationDef; open: boolean; onClose: () => void }) {
  const { error, pending, onSubmit } = useFormModal((form) => connectIntegration(def.id, form), { onSuccess: onClose });

  return (
    <Modal open={open} onClose={onClose} title={`Connect ${def.name}`}>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">Credentials are stored server-side (owner-only). Live sync activates once the {def.name} fetch is wired.</p>
      <div className="mb-4 rounded-lg border bg-accent/40 p-3">
        <div className="vy-kicker mb-1.5">How to get these</div>
        <ol className="list-decimal space-y-1 pl-4 text-[12px] text-muted-foreground">
          {def.howto.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
        {def.docsUrl && <a href={def.docsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[12px] font-medium text-primary hover:underline">Open {def.name} docs →</a>}
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        {def.creds.map((c) => (
          <Field key={c.name} label={c.label}>
            <input name={c.name} type={c.type === "password" ? "password" : "text"} required autoComplete="off" className={inputCls} />
          </Field>
        ))}
        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save & connect"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
