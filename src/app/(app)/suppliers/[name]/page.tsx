import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, Kpi, PageHead, Avatar, Chip, SectionTitle } from "@/components/ui/primitives";
import {
  supplierRollup, money, num, ORDER_STATUS_TONE, ORDER_STATUS_LABEL,
  type OrderRow, type InvoiceRow, type Product,
} from "@/lib/derive";
import { EditSupplierButton } from "../edit-supplier-button";
import { ContactsSection, type Contact } from "@/components/contacts/contacts-section";
import { Package, Route, Factory, Ship, CreditCard, Receipt } from "lucide-react";

export default async function SupplierDetail({ params }: { params: Promise<{ name: string }> }) {
  const { name: raw } = await params;
  let name: string;
  try { name = decodeURIComponent(raw); } catch { name = raw; }
  const supabase = await createClient();

  const [{ data: supplier }, { data: orders }, { data: invoices }, { data: products }, { data: contacts }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("name", name).maybeSingle(),
    supabase.from("orders").select("*"),
    supabase.from("invoices").select("*"),
    supabase.from("products").select("*"),
    supabase.from("contacts").select("*").eq("company", name).order("is_primary", { ascending: false }),
  ]);
  if (!supplier) notFound();

  const allOrders = (orders ?? []) as OrderRow[];
  const allInvoices = (invoices ?? []) as InvoiceRow[];
  const r = supplierRollup(name, allOrders, allInvoices, (products ?? []) as Product[]);
  const myOrders = allOrders.filter((o) => o.supplier === name);
  const myProducts = ((products ?? []) as Product[]).filter((p) => p.supplier === name);
  const myOrderIds = new Set(myOrders.map((o) => o.id));
  const myBills = allInvoices.filter((i) => i.order_id && myOrderIds.has(i.order_id) && (i.vendor_type === "Supplier" || i.vendor_type === "Agent"));

  return (
    <div className="space-y-6">
      <div className="text-[12px] text-muted-foreground">
        <Link href="/suppliers" className="hover:text-foreground">Suppliers</Link> › {name}
      </div>

      <PageHead
        kicker="Supplier"
        title={name}
        leading={<Avatar name={name} tone="brand" size={44} />}
        actions={<><EditSupplierButton supplier={supplier} />{supplier.is_new && <Badge tone="brand">New</Badge>}</>}
      />
      <div className="flex flex-wrap gap-2">
        {supplier.route && <Chip icon={Route}>{supplier.route}</Chip>}
        {supplier.origin && <Chip icon={Factory}>{supplier.origin}</Chip>}
        {supplier.incoterm && <Chip icon={Ship}>{supplier.incoterm}</Chip>}
        {supplier.payment_terms && <Chip icon={CreditCard}>{supplier.payment_terms}</Chip>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Products" value={num(r.productCount)} sub="families sourced" />
        <Kpi label="Orders" value={num(r.orderCount)} sub={`${r.openOrders} open`} tone="info" />
        <Kpi label="Open AP" value={r.openBalance > 0 ? money(r.openBalance) : "—"} sub="owed" tone={r.openBalance > 0 ? "warning" : "success"} />
        <Kpi label="Lead time" value={supplier.lead_time_days ? `${supplier.lead_time_days}d` : "—"} sub={supplier.moq ? `MOQ ${supplier.moq}` : "no MOQ set"} source="manual" />
      </div>

      <ContactsSection company={name} contacts={(contacts ?? []) as Contact[]} />

      <Card className="p-5">
        <SectionTitle icon={Package} tone="brand" title="Products" count={myProducts.length} />
        {myProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No catalog products linked to this supplier yet.</p>
        ) : (
          <ul className="divide-y">
            {myProducts.map((p) => (
              <li key={p.id}>
                <Link href={`/catalog/${p.id}`} className="flex items-center gap-2.5 py-2 hover:text-primary">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{p.parent}</span>
                  <span className="text-[12px] text-muted-foreground">{p.category}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

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
          <SectionTitle icon={Receipt} tone="warning" title="Bills on their orders" count={myBills.length} />
          <ul className="divide-y">
            {myBills.map((b) => {
              const bal = Math.max(0, (b.total ?? 0) - (b.paid ?? 0));
              return (
                <li key={b.id} className="flex items-center gap-3 py-2">
                  <span className="font-mono text-[12px] font-semibold">{b.id}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{b.vendor_type} · due {b.due ?? "—"}</span>
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
