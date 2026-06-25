import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, Kpi, PageHead, Avatar, Chip, SectionTitle } from "@/components/ui/primitives";
import {
  partnerRollup, partnerMatchesOrder, money, num, PARTNER_TYPE_TONE, ORDER_STATUS_TONE, ORDER_STATUS_LABEL,
  type OrderRow, type InvoiceRow,
} from "@/lib/derive";
import { EditPartnerButton } from "../edit-partner-button";
import { ContactsSection, type Contact } from "@/components/contacts/contacts-section";
import { Route, Factory, User, CreditCard, Receipt } from "lucide-react";

export default async function PartnerDetail({ params }: { params: Promise<{ name: string }> }) {
  const { name: raw } = await params;
  let name: string;
  try { name = decodeURIComponent(raw); } catch { name = raw; }
  const supabase = await createClient();

  const [{ data: partner }, { data: orders }, { data: invoices }, { data: contacts }] = await Promise.all([
    supabase.from("partners").select("*").eq("name", name).maybeSingle(),
    supabase.from("orders").select("*"),
    supabase.from("invoices").select("*"),
    supabase.from("contacts").select("*").eq("company", name).order("is_primary", { ascending: false }),
  ]);
  if (!partner) notFound();

  const allOrders = (orders ?? []) as OrderRow[];
  const allInvoices = (invoices ?? []) as InvoiceRow[];
  const r = partnerRollup(name, partner.type, allOrders, allInvoices);
  const myBills = allInvoices.filter((i) => i.vendor === name && i.vendor_type === partner.type);
  const billOrderIds = new Set(myBills.map((i) => i.order_id).filter(Boolean) as string[]);
  const myOrders = allOrders.filter((o) => billOrderIds.has(o.id) || partnerMatchesOrder(o, name));

  return (
    <div className="space-y-6">
      <div className="text-[12px] text-muted-foreground">
        <Link href="/partners" className="hover:text-foreground">Partners</Link> › {name}
      </div>

      <PageHead
        kicker="Partner"
        title={name}
        leading={<Avatar name={name} tone={PARTNER_TYPE_TONE[partner.type] ?? "muted"} size={44} />}
        actions={<><EditPartnerButton partner={partner} /><Badge tone={PARTNER_TYPE_TONE[partner.type] ?? "muted"}>{partner.type}</Badge>{partner.is_new && <Badge tone="brand">New</Badge>}</>}
      />
      <div className="flex flex-wrap gap-2">
        {partner.specialty && <Chip icon={Route}>{partner.specialty}</Chip>}
        {partner.origin && <Chip icon={Factory}>{partner.origin}</Chip>}
        {partner.contact && <Chip icon={User}>{partner.contact}</Chip>}
        {partner.payment_terms && <Chip icon={CreditCard}>{partner.payment_terms}</Chip>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Orders" value={num(r.orderCount)} sub="touched" tone="info" />
        <Kpi label="Bills" value={num(r.invoiceCount)} sub="service invoices" />
        <Kpi label="Open AP" value={r.openBalance > 0 ? money(r.openBalance) : "—"} sub="owed" tone={r.openBalance > 0 ? "warning" : "success"} />
        <Kpi label="Type" value={partner.type} sub="partner role" />
      </div>

      <ContactsSection company={name} contacts={(contacts ?? []) as Contact[]} />

      <Card className="p-5">
        <SectionTitle icon={Factory} tone="info" title="Orders" count={myOrders.length} />
        {myOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <ul className="divide-y">
            {myOrders.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-2">
                <span className="font-mono text-[12px] font-semibold">{o.id}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{o.title}</span>
                <Badge tone={ORDER_STATUS_TONE[o.status] ?? "muted"}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {myBills.length > 0 && (
        <Card className="p-5">
          <SectionTitle icon={Receipt} tone="warning" title="Bills" count={myBills.length} />
          <ul className="divide-y">
            {myBills.map((b) => {
              const bal = Math.max(0, (b.total ?? 0) - (b.paid ?? 0));
              return (
                <li key={b.id} className="flex items-center gap-3 py-2">
                  <span className="font-mono text-[12px] font-semibold">{b.id}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">due {b.due ?? "—"}</span>
                  {bal > 0 ? <span className="font-mono text-sm font-semibold text-warning">{money(bal)}</span> : <Badge tone="success">Settled</Badge>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
