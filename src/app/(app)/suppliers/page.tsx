import { createClient } from "@/lib/supabase/server";
import { supplierRollup, type OrderRow, type InvoiceRow, type Product } from "@/lib/derive";
import { SuppliersList, type SupplierSummary } from "./suppliers-list";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const [{ data: suppliers }, { data: orders }, { data: invoices }, { data: products }, { data: contacts }] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("orders").select("*"),
    supabase.from("invoices").select("*"),
    supabase.from("products").select("*"),
    supabase.from("contacts").select("name").order("name"),
  ]);

  const rows: SupplierSummary[] = (suppliers ?? []).map((s) => {
    const r = supplierRollup(s.name, (orders ?? []) as OrderRow[], (invoices ?? []) as InvoiceRow[], (products ?? []) as Product[]);
    return { name: s.name, origin: s.origin, route: s.route, leadTimeDays: s.lead_time_days, isNew: s.is_new, archived: s.archived, ...r };
  });
  const contactNames = [...new Set(((contacts ?? []) as { name: string }[]).map((c) => c.name))];

  return <SuppliersList suppliers={rows} contactNames={contactNames} />;
}
