import { createClient } from "@/lib/supabase/server";
import { ChargeTypesView, type ChargeType } from "./charge-types-view";

export default async function ChargeTypesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("charge_types").select("id, label, owner, archived").order("owner").order("label");
  return <ChargeTypesView rows={(data ?? []) as ChargeType[]} />;
}
