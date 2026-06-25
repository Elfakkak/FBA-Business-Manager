"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, PageHead } from "@/components/ui/primitives";
import { ConnectIntegrationModal } from "./connect-modal";
import { INTG_STATUS_TONE, type IntegrationDef } from "@/lib/integrations";
import { disconnectIntegration } from "./actions";
import { cn } from "@/lib/utils";
import { Check, Plug, ExternalLink } from "lucide-react";

export type IntegrationState = { def: IntegrationDef; status: string; lastSync: string | null; note: string | null };

export function IntegrationsGrid({ states }: { states: IntegrationState[] }) {
  const [connectOf, setConnectOf] = useState<IntegrationDef | null>(null);
  const connectedCount = states.filter((s) => s.status === "connected").length;

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Settings"
        title="Integrations"
        sub="Connect the services that feed the app — Amazon for stock & sales, Mercury for cash, and more. Credentials are stored securely server-side."
      />

      <div className="text-sm text-muted-foreground">{connectedCount} of {states.length} connected</div>

      <div className="grid gap-4 md:grid-cols-2">
        {states.map((s) => (
          <IntegrationCard key={s.def.id} state={s} onConnect={() => setConnectOf(s.def)} />
        ))}
      </div>

      {connectOf && <ConnectIntegrationModal def={connectOf} open onClose={() => setConnectOf(null)} />}
    </div>
  );
}

function IntegrationCard({ state, onConnect }: { state: IntegrationState; onConnect: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { def, status, lastSync, note } = state;
  const connected = status === "connected";

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className={cn("inline-grid h-10 w-10 place-items-center rounded-lg font-bold", connected ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>
            {def.name[0]}
          </span>
          <div>
            <div className="flex items-center gap-2 font-medium">
              <Link href={`/integrations/${def.id}`} className="hover:text-primary">{def.name}</Link>
              {def.primary && <Badge tone="brand">Primary</Badge>}
            </div>
            <Badge tone={INTG_STATUS_TONE[status] ?? "muted"}>{status}</Badge>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{def.blurb}</p>

      <div className="flex flex-wrap gap-1.5">
        {def.streams.map((s) => <span key={s.name} className="vy-chip">{s.name}</span>)}
      </div>
      <Link href={`/integrations/${def.id}`} className="text-[12px] font-medium text-primary hover:underline">View details →</Link>

      {connected && note && <p className="rounded-md bg-success/10 px-3 py-2 text-[12px] text-success">{note}</p>}
      {connected && lastSync && <div className="text-[11px] text-muted-foreground">Connected · {new Date(lastSync).toLocaleString()}</div>}

      <div className="mt-auto flex items-center gap-2 pt-1">
        {connected ? (
          <>
            <button disabled className="vy-btn vy-btn--outline inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Connected</button>
            <button onClick={() => start(async () => { await disconnectIntegration(def.id); router.refresh(); })} disabled={pending}
              className="vy-btn vy-btn--ghost text-danger">Disconnect</button>
          </>
        ) : (
          <button onClick={onConnect} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Plug className="h-4 w-4" /> Connect</button>
        )}
        {def.docsUrl && <a href={def.docsUrl} target="_blank" rel="noopener noreferrer" className="vy-btn vy-btn--ghost inline-flex items-center gap-1.5 text-[12px]">Docs <ExternalLink className="h-3.5 w-3.5" /></a>}
      </div>
    </Card>
  );
}

