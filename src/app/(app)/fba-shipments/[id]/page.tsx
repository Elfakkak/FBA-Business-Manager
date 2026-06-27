import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge } from "@/components/ui/primitives";
import { CopyValue } from "@/components/ui/copy";
import { num, type Tone, FBA_EVENTS, fbaDoneIdx } from "@/lib/derive";
import { intgAgo } from "@/lib/integrations";
import { cn } from "@/lib/utils";
import { ChevronRight, Package, Truck, Boxes, ClipboardCheck, MapPin, Check, ArrowRight } from "lucide-react";
import { LinkInboundCard } from "./link-inbound";

const STATUS_TONE: Record<string, Tone> = { Working: "muted", Shipped: "info", "In transit": "info", Receiving: "warning", Closed: "success", Problem: "danger" };

export default async function FbaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: inbound } = await supabase.from("fba_inbounds").select("*").eq("id", id).maybeSingle();
  if (!inbound) notFound();

  const [{ data: items }, { data: amazon }, { data: shipmentOpts }, { data: orderOpts }] = await Promise.all([
    supabase.from("fba_inbound_items").select("sku, fnsku, expected, received").eq("inbound_id", id),
    supabase.from("integrations").select("last_sync").eq("id", "amazon").maybeSingle(),
    supabase.from("shipments").select("id, mode, order_id").order("created_at", { ascending: false }),
    supabase.from("orders").select("id, title").order("placed_on", { ascending: false }),
  ]);
  const itemRows = (items ?? []) as { sku: string; fnsku: string | null; expected: number; received: number }[];

  // variant names for the per-SKU rows
  const skus = itemRows.map((i) => i.sku);
  const { data: variants } = skus.length
    ? await supabase.from("product_variants").select("sku, name").in("sku", skus)
    : { data: [] };
  const nameBySku = new Map(((variants ?? []) as { sku: string; name: string }[]).map((v) => [v.sku, v.name]));

  // parent freight shipment + order (the seam)
  const parent = inbound.shipment_id ? (await supabase.from("shipments").select("id, mode, eta, supplier, order_id, order_title").eq("id", inbound.shipment_id).maybeSingle()).data : null;
  const orderId = inbound.order_id ?? parent?.order_id ?? null;
  const orderTitle = parent?.order_title ?? null;
  const mode = inbound.mode ?? parent?.mode ?? null;
  const eta = inbound.eta ?? parent?.eta ?? null;
  const supplier = parent?.supplier ?? null;

  const received = inbound.received, expected = inbound.expected;
  const variance = received - expected;
  const di = fbaDoneIdx(inbound.amazon_status, received);
  const pct = expected > 0 ? Math.min(100, Math.round((received / expected) * 100)) : 0;

  const kpis = [
    { label: "Status", value: inbound.amazon_status, sub: eta ? `ETA ${eta}` : "—", tone: STATUS_TONE[inbound.amazon_status], src: "amazon" },
    { label: "Expected", value: num(expected), sub: "units packed", src: "manual" },
    { label: "Received", value: received > 0 ? num(received) : "—", sub: received > 0 ? "units booked" : "not yet", src: "amazon" },
    { label: "Variance", value: received <= 0 ? "—" : `${variance > 0 ? "+" : ""}${num(variance)}`, sub: received <= 0 ? "pending" : "vs expected", tone: (received <= 0 ? undefined : variance < 0 ? "danger" : variance > 0 ? "warning" : "success") as Tone | undefined },
    { label: "SKUs", value: num(inbound.sku_count), sub: "line items" },
    { label: "Dest FC", value: inbound.fc, sub: mode ?? "Amazon inbound", src: "amazon" },
  ];

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link href="/fba-shipments" className="hover:text-foreground">Operations</Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <Link href="/fba-shipments" className="hover:text-foreground">FBA Shipments</Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <span className="font-medium text-foreground">{inbound.id}</span>
      </nav>

      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-2xl font-bold">{inbound.id}</h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-info" /> Amazon</span>
              <Badge tone={STATUS_TONE[inbound.amazon_status] ?? "muted"}>{inbound.amazon_status}</Badge>
              <Badge tone="muted">{inbound.fc}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {mode && <span className="vy-chip inline-flex items-center gap-1"><Truck className="h-3 w-3" />{mode}</span>}
              {eta && <span className="vy-chip inline-flex items-center gap-1"><MapPin className="h-3 w-3" />ETA {eta}</span>}
              {supplier && <span className="vy-chip inline-flex items-center gap-1"><Package className="h-3 w-3" />{supplier}</span>}
              {orderTitle && <span className="vy-chip inline-flex items-center gap-1"><Boxes className="h-3 w-3" />{orderTitle}</span>}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {inbound.shipment_id && <Link href={`/shipments/${inbound.shipment_id}`} className="vy-btn vy-btn--outline inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Forwarder leg</Link>}
            {orderId && <Link href={`/orders/${orderId}`} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Open order</Link>}
          </div>
        </div>
      </Card>

      {/* Synced banner */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm" style={{ background: "hsl(var(--info) / 0.06)", borderColor: "hsl(var(--info) / 0.22)" }}>
        <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><ClipboardCheck className="h-4 w-4" /></span>
        <span><span className="font-medium">Synced from Seller Central</span><span className="text-muted-foreground"> · Status &amp; received units per SKU · last sync {intgAgo(inbound.synced)} · expected is your packing allocation</span></span>
        <Badge tone="info" className="ml-auto">FBA Inbound API</Badge>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center gap-1.5"><span className="vy-kicker">{k.label}</span>{k.src && <span className={cn("h-1.5 w-1.5 rounded-full", k.src === "amazon" ? "bg-info" : "bg-muted-foreground/40")} />}</div>
            <div className="mt-1 text-lg font-bold" style={k.tone ? { color: `hsl(var(--${k.tone}))` } : undefined}>{k.value}</div>
            <div className="text-[11px] text-muted-foreground">{k.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Contents — per-SKU reconciliation */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2.5 px-5 py-4">
            <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-success/12 text-success"><Package className="h-4 w-4" /></span>
            <div><div className="font-semibold">Contents</div><p className="text-[11px] text-muted-foreground">Per-SKU receiving reconciliation — a short or over receipt is traced to the exact SKU.</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">SKU</th>
                  <th className="px-4 py-2 font-medium">FNSKU</th>
                  <th className="px-4 py-2 text-right font-medium">Expected</th>
                  <th className="px-4 py-2 text-right font-medium">Received</th>
                  <th className="px-4 py-2 text-right font-medium">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {itemRows.map((i) => {
                  const v = i.received - i.expected;
                  return (
                    <tr key={i.sku + (i.fnsku ?? "")}>
                      <td className="px-4 py-2.5"><Link href={`/inventory?q=${encodeURIComponent(i.sku)}`} className="font-mono text-[12px] font-semibold hover:text-primary">{i.sku}</Link>{nameBySku.get(i.sku) && <div className="text-[11px] text-muted-foreground">{nameBySku.get(i.sku)}</div>}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{i.fnsku ?? "—"}</td>
                      <td className="tabular px-4 py-2.5 text-right font-mono">{num(i.expected)}</td>
                      <td className="tabular px-4 py-2.5 text-right font-mono font-semibold">{i.received > 0 ? num(i.received) : "—"}</td>
                      <td className={cn("tabular px-4 py-2.5 text-right font-mono", i.received <= 0 ? "text-muted-foreground" : v < 0 ? "text-danger" : v > 0 ? "text-warning" : "text-success")}>{i.received <= 0 ? "—" : `${v > 0 ? "+" : ""}${v}`}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-4 py-2.5" colSpan={2}>Total</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{num(expected)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{received > 0 ? num(received) : "—"}</td>
                  <td className={cn("tabular px-4 py-2.5 text-right font-mono", received <= 0 ? "text-muted-foreground" : variance < 0 ? "text-danger" : variance > 0 ? "text-warning" : "text-success")}>{received <= 0 ? "—" : `${variance > 0 ? "+" : ""}${variance}`}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="px-5 py-3 text-[11px] text-muted-foreground">{received <= 0 ? "Not yet received — units book against each SKU as Amazon checks the inbound in." : variance === 0 ? "Received the expected units — no discrepancy." : variance < 0 ? `${Math.abs(variance)} units short of the expected count.` : `+${variance} units over the expected count.`}</p>
        </Card>

        <div className="flex flex-col gap-4">
          {/* Receiving roll-up */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><ClipboardCheck className="h-4 w-4" /></span><div><div className="font-semibold">Receiving</div><p className="text-[11px] text-muted-foreground">Amazon leg roll-up.</p></div></div>
            <div className="grid grid-cols-3 gap-2">
              <div><div className="vy-kicker">Expected</div><div className="mt-0.5 font-mono text-base font-bold">{num(expected)}</div></div>
              <div><div className="vy-kicker">Received</div><div className="mt-0.5 font-mono text-base font-bold">{received > 0 ? num(received) : "—"}</div></div>
              <div><div className="vy-kicker">Variance</div><div className={cn("mt-0.5 font-mono text-base font-bold", received <= 0 ? "text-muted-foreground" : variance < 0 ? "text-danger" : variance > 0 ? "text-warning" : "text-success")}>{received <= 0 ? "—" : `${variance > 0 ? "+" : ""}${variance}`}</div></div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></div>
            <p className="mt-2 text-[11px] text-muted-foreground">{received <= 0 ? "Receiving not started" : received >= expected ? "Fully received" : `Receiving in progress — ${pct}%`}</p>
          </Card>

          {/* Forwarder leg */}
          {inbound.shipment_id ? (
            <Link href={`/shipments/${inbound.shipment_id}`} className="flex items-center gap-2.5 rounded-xl border bg-accent/40 px-4 py-3 hover:border-primary/40">
              <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1"><div className="text-[11px] text-muted-foreground">← Forwarder leg (freight to the FC)</div><div className="font-mono text-[12.5px] font-bold">{inbound.shipment_id}</div></div>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-50" />
            </Link>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-dashed bg-background/40 px-4 py-3"><Package className="h-4 w-4 shrink-0 text-muted-foreground" /><div className="text-[12px] text-muted-foreground"><span className="font-semibold text-foreground">Direct to Amazon</span> — no forwarder leg linked.</div></div>
          )}

          {/* Amazon identifiers — the IDs the forwarder / Amazon asks for, one-click copy */}
          <Card className="p-5">
            <div className="vy-kicker mb-3">Amazon identifiers</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
              <div><div className="vy-kicker mb-1">FBA shipment ID</div><CopyValue value={inbound.id} label="FBA shipment ID" className="w-full" /></div>
              <div><div className="vy-kicker mb-1">Reference ID</div><CopyValue value={inbound.reference_id} label="reference ID" className="w-full" /></div>
              <div><div className="vy-kicker mb-0.5">Dest FC</div><div className="font-mono text-[13px] font-semibold">{inbound.fc}</div></div>
              <div><div className="vy-kicker mb-0.5">FBA arrival</div><div className="text-[13px] font-semibold">{inbound.eta_from || inbound.eta_to ? `${inbound.eta_from || "?"} – ${inbound.eta_to || "?"}` : (eta ?? "—")}</div></div>
              <div><div className="vy-kicker mb-0.5">Synced</div><div className="text-[12px] font-semibold">{intgAgo(inbound.synced)}</div></div>
            </div>
          </Card>
        </div>
      </div>

      {/* Link to freight shipment + order */}
      <LinkInboundCard
        inboundId={inbound.id}
        shipmentId={inbound.shipment_id}
        orderId={inbound.order_id}
        shipments={((shipmentOpts ?? []) as { id: string; mode: string; order_id: string | null }[]).map((s) => ({ id: s.id, label: `${s.id} · ${s.mode}`, order_id: s.order_id }))}
        orders={(orderOpts ?? []) as { id: string; title: string }[]}
      />

      {/* Shipment events */}
      {inbound.amazon_status !== "Problem" && (
        <Card className="p-5">
          <div className="mb-3.5 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><MapPin className="h-4 w-4" /></span><div><div className="font-semibold">Shipment events</div><p className="text-[11px] text-muted-foreground">From Seller Central — the Amazon custody leg, starting at the FC handoff.</p></div></div>
          <div className="flex flex-col">
            {FBA_EVENTS.map((e, i) => {
              const done = i <= di; const cur = i === di;
              const color = done ? (cur ? "hsl(var(--info))" : "hsl(var(--success))") : "hsl(var(--border))";
              const nextDone = i < FBA_EVENTS.length - 1 && i + 1 <= di;
              return (
                <div key={e.key} className="flex min-h-[32px] gap-3">
                  <div className="flex flex-col items-center self-stretch">
                    <span className="mt-1 grid h-3 w-3 shrink-0 place-items-center rounded-full" style={{ background: done ? color : "hsl(var(--card))", border: `2px solid ${color}` }}>{done && <Check className="h-[7px] w-[7px] text-white" strokeWidth={4} />}</span>
                    {i < FBA_EVENTS.length - 1 && <span className="my-0.5 w-0.5 flex-1" style={{ background: nextDone ? "hsl(var(--success))" : "hsl(var(--border))" }} />}
                  </div>
                  <div className={cn("min-w-0", i < FBA_EVENTS.length - 1 && "pb-3")}><div className={cn("text-[13px]", cur ? "font-bold text-info" : done ? "font-semibold" : "font-semibold text-muted-foreground")}>{e.label}</div>{!done && <div className="text-[11px] italic text-muted-foreground">pending</div>}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
