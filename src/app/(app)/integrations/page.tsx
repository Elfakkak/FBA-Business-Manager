import { createClient } from "@/lib/supabase/server";
import { INTG_DEFS } from "@/lib/integrations";
import { IntegrationsGrid, type IntegrationState } from "./integrations-cards";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("integrations").select("id, status, last_sync, note");
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));

  const states: IntegrationState[] = INTG_DEFS.map((d) => {
    const r = byId.get(d.id);
    return {
      def: d,
      status: r?.status ?? "disconnected",
      lastSync: r?.last_sync ?? null,
      note: r?.note ?? null,
    };
  });

  return <IntegrationsGrid states={states} />;
}
