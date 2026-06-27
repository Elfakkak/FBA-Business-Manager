import { createClient } from "@/lib/supabase/server";
import { Card, PageHead } from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { deriveOrderActivity, type ActEvent, type ActCat } from "@/lib/activity";

const CATS: ActCat[] = ["Pay", "Inv", "Insp", "Ship", "Prod", "Doc"];

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const supabase = await createClient();
  const [{ data: orders }, { data: invoices }, { data: payments }, { data: lines }, { data: inspections }, { data: shipments }] = await Promise.all([
    supabase.from("orders").select("id, title, placed_on, archived"),
    supabase.from("invoices").select("id, vendor, total, issued, created_at, order_id"),
    supabase.from("invoice_payments").select("invoice_id, amount, payment_date, status, method"),
    supabase.from("invoice_lines").select("invoice_id"),
    supabase.from("order_inspections").select("*"),
    supabase.from("shipments").select("id, stage, mode, origin, destination, eta, etd, forwarder, order_id"),
  ]);

  type Pay = { invoice_id: string; amount: number; payment_date: string | null; status: string; method: string | null };
  const payByInv = new Map<string, Pay[]>();
  for (const p of (payments ?? []) as Pay[]) { const a = payByInv.get(p.invoice_id) ?? []; a.push(p); payByInv.set(p.invoice_id, a); }
  const lineCount = new Map<string, number>();
  for (const l of (lines ?? []) as { invoice_id: string }[]) lineCount.set(l.invoice_id, (lineCount.get(l.invoice_id) ?? 0) + 1);

  type Inv = { id: string; vendor: string; total: number; issued: string | null; created_at: string; order_id: string | null };
  const invByOrder = new Map<string, ReturnType<typeof toInv>[]>();
  function toInv(i: Inv) {
    return { id: i.id, vendor: i.vendor, total: i.total, issued: i.issued, created_at: i.created_at, payments: payByInv.get(i.id) ?? [], lines: new Array(lineCount.get(i.id) ?? 0).fill(0) };
  }
  for (const i of (invoices ?? []) as Inv[]) { if (!i.order_id) continue; const a = invByOrder.get(i.order_id) ?? []; a.push(toInv(i)); invByOrder.set(i.order_id, a); }

  const inspByOrder = new Map<string, Record<string, unknown>>();
  for (const insp of (inspections ?? []) as { order_id: string }[]) inspByOrder.set(insp.order_id, insp as unknown as Record<string, unknown>);

  type Ship = { id: string; stage: string; mode: string; origin: string | null; destination: string | null; eta: string | null; etd: string | null; forwarder: string | null; order_id: string | null };
  const shipByOrder = new Map<string, Ship[]>();
  for (const s of (shipments ?? []) as Ship[]) { if (!s.order_id) continue; const a = shipByOrder.get(s.order_id) ?? []; a.push(s); shipByOrder.set(s.order_id, a); }

  const events: ActEvent[] = [];
  const orderOpts: { id: string; title: string }[] = [];
  for (const o of (orders ?? []) as { id: string; title: string; placed_on: string | null; archived: boolean }[]) {
    if (o.archived) continue;
    orderOpts.push({ id: o.id, title: o.title });
    events.push(...deriveOrderActivity(o.id, {
      placedOn: o.placed_on,
      invoices: invByOrder.get(o.id) ?? [],
      inspection: (inspByOrder.get(o.id) ?? null) as never,
      shipments: shipByOrder.get(o.id) ?? [],
    }));
  }
  events.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const initialCat = (cat && (CATS as string[]).includes(cat) ? cat : "All") as "All" | ActCat;

  return (
    <div className="space-y-5">
      <PageHead
        kicker="Operations"
        title="Activity journal"
        sub="Every event across all orders — payments, invoices, inspection, shipping, production and documents — newest first. The per-order drawer shows just that order's slice."
      />
      <Card className="p-5">
        <ActivityFeed events={events} nowMs={Date.now()} variant="page" showOrder initialCat={initialCat} orders={orderOpts} />
      </Card>
    </div>
  );
}
