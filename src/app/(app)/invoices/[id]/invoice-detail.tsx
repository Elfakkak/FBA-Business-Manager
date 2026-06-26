"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { num, money, INVOICE_STATUS_TONE, invoiceBalance, invoiceStatus, invoiceAging, type Tone } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { RecordPaymentModal, InvoiceModal, type InvRow } from "../invoices-table";
import { updateInvoice, deletePayment, saveInvoiceDocument } from "../actions";
import {
  ChevronRight, Factory, Calendar, Package, DollarSign, Receipt, ListChecks, FileText,
  ArrowUpRight, ArrowRight, Pencil, Trash2, ImagePlus, Loader2, ExternalLink, CalendarClock,
} from "lucide-react";

const PAY_STATUS_TONE: Record<string, Tone> = { Cleared: "success", Scheduled: "info", Pending: "warning" };
const fmtDate = (iso: string | null) => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

export function InvoiceDetailPage({ row: i, orders, vendors }: { row: InvRow; orders: { id: string; title: string }[]; vendors: string[] }) {
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [, start] = useTransition();

  const bal = invoiceBalance(i);
  const st = invoiceStatus(i);
  const a = invoiceAging(i.due, bal, Date.now());
  const paidPct = (i.total ?? 0) > 0 ? Math.round(((i.paid ?? 0) / (i.total ?? 1)) * 100) : 0;

  // running balance-after per payment (chronological)
  let run = 0;
  const paymentsAsc = [...i.payments].sort((a, b) => (a.payment_date ?? "").localeCompare(b.payment_date ?? ""));
  const withBalance = paymentsAsc.map((p) => { run += p.amount; return { ...p, balanceAfter: Math.max(0, (i.total ?? 0) - run) }; }).reverse();

  const dueBadge = a.label === "Overdue" ? `${Math.abs(a.days)}d overdue` : a.label === "Due soon" ? `due in ${a.days}d` : a.label === "Settled" ? "settled" : i.due ? `due ${fmtDate(i.due)}` : null;

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link href="/invoices" className="hover:text-foreground">Operations</Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <Link href="/invoices" className="hover:text-foreground">Invoices</Link>
        <ChevronRight className="h-3 w-3 opacity-50" />
        <span className="font-medium text-foreground">{i.id}</span>
      </nav>

      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-2xl font-bold">{i.id}</h1>
              <Badge tone={INVOICE_STATUS_TONE[st]}>{st}</Badge>
              {dueBadge && <Badge tone={a.tone}>{dueBadge}</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="vy-chip inline-flex items-center gap-1"><Factory className="h-3 w-3" />{i.vendor}</span>
              <span className="vy-chip inline-flex items-center gap-1"><ListChecks className="h-3 w-3" />{i.vendor_type}</span>
              {i.issued && <span className="vy-chip inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Issued {fmtDate(i.issued)}</span>}
              {i.orderTitle && <span className="vy-chip inline-flex items-center gap-1"><Package className="h-3 w-3" />{i.orderTitle}</span>}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {bal > 0.005 && <button onClick={() => setPayOpen(true)} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Record payment</button>}
            <button onClick={() => setEditOpen(true)} className="vy-btn vy-btn--outline inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</button>
            {i.order_id && <Link href={`/orders/${i.order_id}`} className="vy-btn vy-btn--ghost inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Open order</Link>}
          </div>
        </div>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total" value={money(i.total)} sub="invoice amount" />
        <StatCard label="Paid" value={money(i.paid)} sub={`${paidPct}% of total`} tone="success" />
        <StatCard label="Balance" value={bal > 0.005 ? money(bal) : money(0)} sub="outstanding" tone={bal > 0.005 ? "warning" : "success"} />
        <StatCard label="Due" value={fmtDate(i.due)} sub={dueBadge ?? "—"} />
        <StatCard label="Status" value={st} sub={i.terms ?? "—"} tone={INVOICE_STATUS_TONE[st]} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* Charges */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-2.5 px-5 py-4"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><Receipt className="h-4 w-4" /></span><div><div className="font-semibold">Charges</div><p className="text-[11px] text-muted-foreground">What this bill is composed of.</p></div></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] text-sm">
                <thead><tr className="border-y bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="px-5 py-2 font-medium">Description</th><th className="px-3 py-2 font-medium">Type</th><th className="px-5 py-2 text-right font-medium">Amount</th></tr></thead>
                <tbody className="divide-y">
                  <tr><td className="px-5 py-3 font-medium">{i.vendor} — invoice</td><td className="px-3 py-3 text-muted-foreground">{i.vendor_type}</td><td className="px-5 py-3 text-right font-mono">{money(i.total)}</td></tr>
                </tbody>
                <tfoot><tr className="border-t bg-muted/30 font-semibold"><td className="px-5 py-3" colSpan={2}>Total</td><td className="px-5 py-3 text-right font-mono">{money(i.total)}</td></tr></tfoot>
              </table>
            </div>
            <p className="px-5 py-3 text-[11px] text-muted-foreground">Line-item breakdown isn&apos;t tracked per charge — the invoice total is the source of truth.</p>
          </Card>

          {/* Payments */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between px-5 py-4"><div className="flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-success/12 text-success"><DollarSign className="h-4 w-4" /></span><div><div className="font-semibold">Payments ({i.payments.length})</div><p className="text-[11px] text-muted-foreground">Every payment recorded against this bill, with the balance after each.</p></div></div>{bal > 0.005 && <button onClick={() => setPayOpen(true)} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5"><DollarSign className="h-3 w-3" /> Record</button>}</div>
            {i.payments.length === 0 ? <p className="px-5 pb-4 text-[12px] text-muted-foreground">No payments recorded yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead><tr className="border-y bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="px-5 py-2 font-medium">Date</th><th className="px-3 py-2 text-right font-medium">Amount</th><th className="px-3 py-2 font-medium">Method</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 text-right font-medium">Balance after</th><th className="px-3 py-2" /></tr></thead>
                  <tbody className="divide-y">
                    {withBalance.map((p) => (
                      <tr key={p.id}>
                        <td className="px-5 py-2.5 font-mono text-[12px]">{fmtDate(p.payment_date)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold">{money(p.amount)}</td>
                        <td className="px-3 py-2.5">{p.method ?? "—"}</td>
                        <td className="px-3 py-2.5"><Badge tone={PAY_STATUS_TONE[p.status] ?? "muted"}>{p.status}</Badge></td>
                        <td className="px-3 py-2.5 text-right font-mono text-warning">{money(p.balanceAfter)}</td>
                        <td className="px-3 py-2.5 text-right"><button onClick={() => start(async () => { await deletePayment(p.id, i.id); router.refresh(); })} className="vy-icon-btn" aria-label="Delete payment"><Trash2 className="h-3.5 w-3.5 text-danger" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Invoice document */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-muted text-muted-foreground"><FileText className="h-4 w-4" /></span><div><div className="font-semibold">Invoice document</div><p className="text-[11px] text-muted-foreground">Drop the vendor&apos;s PDF or scan here — it stays attached to this invoice.</p></div></div>
            <InvoiceDocument id={i.id} url={i.document_url} vendor={i.vendor} />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {/* Payment progress */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-primary/12 text-primary"><CalendarClock className="h-4 w-4" /></span><div><div className="font-semibold">Payment progress</div><p className="text-[11px] text-muted-foreground">{i.terms ?? "Paid vs outstanding"}</p></div></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, paidPct)}%` }} /></div>
            <div className="mt-2 flex justify-between text-[12px]"><span className="font-mono font-semibold text-success">{money(i.paid)} paid</span><span className="font-mono text-muted-foreground">{money(bal)} left</span></div>
          </Card>

          {/* Dates & terms */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><Calendar className="h-4 w-4" /></span><div className="font-semibold">Dates &amp; terms</div></div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="vy-kicker mb-0.5">Issued</div><div className="font-mono text-[13px] font-semibold">{fmtDate(i.issued)}</div></div>
              <div><div className="vy-kicker mb-0.5">Due</div><div className="font-mono text-[13px] font-semibold">{fmtDate(i.due)}</div></div>
              <div className="col-span-2"><div className="vy-kicker mb-0.5">Terms</div><div className="text-[13px] font-semibold">{i.terms ?? "—"}</div></div>
            </div>
          </Card>

          {/* Vendor */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-primary/12 text-primary"><Factory className="h-4 w-4" /></span><div className="font-semibold">Vendor</div></div>
            <Link href={i.vendor_type === "Supplier" ? "/suppliers" : "/partners"} className="flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2.5 hover:border-primary/40">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary"><Factory className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{i.vendor}</div><div className="text-[11px] text-muted-foreground">{i.vendor_type}</div></div>
              <ArrowUpRight className="h-4 w-4 shrink-0 opacity-50" />
            </Link>
          </Card>

          {/* Order */}
          {i.order_id && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-primary/12 text-primary"><Package className="h-4 w-4" /></span><div className="font-semibold">Order</div></div>
              <Link href={`/orders/${i.order_id}`} className="flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2.5 hover:border-primary/40">
                <div className="min-w-0 flex-1"><div className="font-mono text-[11px] text-muted-foreground">{i.order_id}</div><div className="truncate text-[13px] font-semibold">{i.orderTitle}</div></div>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-50" />
              </Link>
            </Card>
          )}
        </div>
      </div>

      {payOpen && <RecordPaymentModal invoice={i} invoices={[i]} onClose={() => setPayOpen(false)} />}
      {editOpen && <InvoiceModal title={`Edit ${i.id}`} invoice={i} orders={orders} vendors={vendors} onClose={() => setEditOpen(false)} onSubmit={(fd) => updateInvoice(i.id, fd)} />}
    </div>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: Tone }) {
  return (
    <Card className="p-4">
      <div className="vy-kicker">{label}</div>
      <div className="mt-1 text-lg font-bold" style={tone ? { color: `hsl(var(--${tone}))` } : undefined}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function InvoiceDocument({ id, url, vendor }: { id: string; url: string | null; vendor: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();
  const isImg = !!url && !/\.pdf($|\?)/i.test(url);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `invoices/${id}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("product-media").upload(path, file, { upsert: true });
    if (!error) {
      const u = supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl;
      const res = await saveInvoiceDocument(id, u);
      if (!res.ok) await supabase.storage.from("product-media").remove([path]);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => !busy && fileRef.current?.click()} className="grid w-full place-items-center gap-2 rounded-xl border border-dashed py-10 text-muted-foreground transition hover:border-primary/40">
        {url && isImg ? <Image src={url} alt="" width={120} height={120} className="max-h-40 w-auto rounded-md object-contain" /> : busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
        <div className="text-[12.5px]">{busy ? "Uploading…" : url ? "Document attached" : `Drop the ${vendor} invoice (PDF/JPG)`}</div>
        {!url && !busy && <div className="text-[11px]">or <span className="font-medium text-primary underline">browse files</span></div>}
      </button>
      {url && <div className="mt-2 flex gap-3 text-[12px]"><a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">View <ExternalLink className="h-3.5 w-3.5" /></a><button onClick={() => !busy && fileRef.current?.click()} className="font-medium text-primary hover:underline">Replace</button></div>}
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={onPick} />
    </>
  );
}
