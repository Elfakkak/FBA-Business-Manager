import { createClient } from "@/lib/supabase/server";
import { partnerRollup, type OrderRow, type InvoiceRow } from "@/lib/derive";
import { PartnersList, type PartnerSummary } from "./partners-list";

export default async function PartnersPage() {
  const supabase = await createClient();
  const [{ data: partners }, { data: orders }, { data: invoices }] = await Promise.all([
    supabase.from("partners").select("*").order("name"),
    supabase.from("orders").select("*"),
    supabase.from("invoices").select("*"),
  ]);

  const rows: PartnerSummary[] = (partners ?? []).map((p) => {
    const r = partnerRollup(p.name, p.type, (orders ?? []) as OrderRow[], (invoices ?? []) as InvoiceRow[]);
    return { name: p.name, type: p.type, origin: p.origin, specialty: p.specialty, isNew: p.is_new, ...r };
  });

  return <PartnersList partners={rows} />;
}
