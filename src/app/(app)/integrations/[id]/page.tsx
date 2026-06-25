import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, PageHead, SectionTitle } from "@/components/ui/primitives";
import { INTG_DEFS, INTG_STATUS_TONE, INTG_STATUS_LABEL, intgAgo } from "@/lib/integrations";
import { IntegrationDetailActions } from "./detail-actions";
import { RefreshCw } from "lucide-react";

export default async function IntegrationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const def = INTG_DEFS.find((d) => d.id === id);
  if (!def) notFound();
  const supabase = await createClient();
  const { data: row } = await supabase.from("integrations").select("status, last_sync, note").eq("id", id).maybeSingle();
  const status = row?.status ?? "disconnected";
  const connected = status === "connected";

  return (
    <div className="space-y-6">
      <div className="text-[12px] text-muted-foreground">
        <Link href="/integrations" className="hover:text-foreground">Integrations</Link> › {def.name}
      </div>

      <PageHead
        kicker="Integration"
        title={def.name}
        actions={
          <>
            <Badge tone={INTG_STATUS_TONE[status] ?? "muted"}>{INTG_STATUS_LABEL[status] ?? status}</Badge>
            <IntegrationDetailActions def={def} connected={connected} />
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        {def.primary && <Badge tone="brand">Primary</Badge>}
        {def.account && <span className="vy-chip font-mono">{def.account}</span>}
        {connected && <span>Last sync {intgAgo(row?.last_sync ?? null)}</span>}
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">{def.blurb}</p>
      {row?.note && <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">{row.note}</p>}

      <Card className="p-0">
        <div className="border-b px-5 py-3">
          <div className="font-medium">What it syncs</div>
          <p className="text-[12px] text-muted-foreground">Each data stream this connection pulls — and where it flows in Vyonix.</p>
        </div>
        <ul className="divide-y">
          {def.streams.map((s) => (
            <li key={s.name} className="flex items-center gap-3 px-5 py-3">
              <span className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md bg-info/12 text-info"><RefreshCw className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{s.name}</span>
                  <Badge tone="muted">{s.feeds}</Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">{s.detail}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{s.api}</div>
              </div>
              <Badge tone={connected ? "success" : "muted"}>{connected ? "Live" : "Idle"}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        When live, each stream above reads its real endpoint; the in-app destinations (P&amp;L, Inventory, Shipments, Finance)
        already consume this shape, so no rework is needed. Credentials are stored server-side, owner-only.
      </p>
    </div>
  );
}
