import { createClient } from "@/lib/supabase/server";
import { INTG_DEFS } from "@/lib/integrations";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: intg }, { data: brand }, { data: business }, { data: notif }, { data: users }] = await Promise.all([
    supabase.from("integrations").select("id, status, last_sync, note"),
    supabase.from("brand").select("*").eq("id", 1).maybeSingle(),
    supabase.from("business_profile").select("*").eq("id", 1).maybeSingle(),
    supabase.from("notification_prefs").select("prefs").eq("id", 1).maybeSingle(),
    supabase.from("users").select("id, name, email, role, status, is_you, is_owner, share, fin_id").order("is_owner", { ascending: false }),
  ]);

  const intgById = new Map((intg ?? []).map((r) => [r.id, r]));
  const integrations = INTG_DEFS.map((d) => {
    const r = intgById.get(d.id);
    return { def: d, status: r?.status ?? "disconnected", lastSync: r?.last_sync ?? null, note: r?.note ?? null };
  });

  return (
    <SettingsView
      integrations={integrations}
      brand={brand ?? null}
      business={business ?? null}
      prefs={(notif?.prefs ?? {}) as Record<string, boolean>}
      members={(users ?? []) as never[]}
    />
  );
}
