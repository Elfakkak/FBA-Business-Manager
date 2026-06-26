"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead, CardHeader } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/drawer";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { num, money, type InvoiceRow, INVOICE_STATUS_TONE, PAY_STATUS_TONE, BALANCE_EPSILON, invoiceBalance, invoiceStatus, invoiceAging, payTermSummary, PAYTERM_TYPES, type Tone } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createInvoice, updateInvoice, deleteInvoice, recordPayment, deletePayment } from "./actions";
import { DollarSign, AlertCircle, Calendar, Check, Receipt, ArrowUpRight, Plus, Trash2, Package, Paperclip, ShieldCheck } from "lucide-react";

export type Payment = { id: string; amount: number; payment_date: string | null; method: string | null; status: string; proof_kind: string | null; proof_url: string | null };
export type InvRow = InvoiceRow & { orderTitle: string | null; payments: Payment[] };

const VENDOR_TYPES = ["Supplier", "Forwarder", "Agent", "Inspection"];
const STATUS_CHIPS = ["All", "Overdue", "Unpaid", "Partial", "Paid"];
const fmtDue = (iso: string | null) => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

export function InvoicesTable({ rows, orders, vendors }: { rows: InvRow[]; orders: { id: string; title: string }[]; vendors: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [vtype, setVtype] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [peek, setPeek] = useState<InvRow | null>(null);
  const [payFor, setPayFor] = useState<InvRow | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<InvRow | null>(null);

  const now = Date.now();
  const aging = (i: InvRow) => invoiceAging(i.due, invoiceBalance(i), now);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((i) => {
      if (vtype !== "All" && i.vendor_type !== vtype) return false;
      if (status !== "All") {
        if (status === "Overdue") { if (aging(i).label !== "Overdue") return false; }
        else if (invoiceStatus(i) !== status) return false;
      }
      if (n && ![i.id, i.vendor, i.vendor_type, i.order_id, i.orderTitle].filter(Boolean).join(" ").toLowerCase().includes(n)) return false;
      return true;
    });
  }, [rows, q, status, vtype, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const from = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(from, from + pageSize);
  useEffect(() => { setPage(1); }, [q, status, vtype, pageSize]);

  // rollups
  const outstanding = rows.reduce((n, i) => n + invoiceBalance(i), 0);
  const openCount = rows.filter((i) => invoiceBalance(i) > BALANCE_EPSILON).length;
  const overdue = rows.filter((i) => aging(i).label === "Overdue");
  const overdueAmt = overdue.reduce((n, i) => n + invoiceBalance(i), 0);
  const dueSoon = rows.filter((i) => aging(i).label === "Due soon");
  const dueSoonAmt = dueSoon.reduce((n, i) => n + invoiceBalance(i), 0);
  const totalPaid = rows.reduce((n, i) => n + (i.paid ?? 0), 0);
  const totalInvoiced = rows.reduce((n, i) => n + (i.total ?? 0), 0);
  const paidPct = totalInvoiced ? Math.round((totalPaid / totalInvoiced) * 100) : 0;
  const vendorCount = new Set(rows.map((i) => i.vendor)).size;
  const proofMissing = rows.reduce((n, i) => n + i.payments.filter((p) => p.status === "Cleared" && !p.proof_url).length, 0);
  // aging buckets
  const buckets = [
    { label: "Overdue", color: "bg-danger", amt: overdueAmt },
    { label: "Due ≤ 7d", color: "bg-warning", amt: dueSoonAmt },
    { label: "8–30 days", color: "bg-info", amt: rows.filter((i) => { const a = aging(i); return a.label === "Upcoming" && a.days <= 30; }).reduce((n, i) => n + invoiceBalance(i), 0) },
    { label: "30+ days", color: "bg-muted-foreground/40", amt: rows.filter((i) => { const a = aging(i); return a.label === "Upcoming" && a.days > 30; }).reduce((n, i) => n + invoiceBalance(i), 0) },
  ];
  const bucketMax = Math.max(1, ...buckets.map((b) => b.amt));

  return (
    <div className="space-y-6">
      <PageHead kicker="Operations" title="Invoices"
        sub="Every vendor bill across all orders, by due date. Supplier PIs, freight, agent and inspection fees — what you owe, to whom, and when."
        actions={
          <>
            <button className="vy-btn vy-btn--ghost inline-flex items-center gap-1.5"><ArrowUpRight className="h-4 w-4" /> Export</button>
            <button onClick={() => setNewOpen(true)} className="vy-btn vy-btn--outline inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> New invoice</button>
            <button onClick={() => setPayFor(rows.find((i) => invoiceBalance(i) > 0) ?? null)} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> Record payment</button>
          </>
        } />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Kpi label="Outstanding" value={money(outstanding)} sub={`${openCount} open invoices`} icon={DollarSign} tone={outstanding > 0 ? "warning" : "success"} />
        <Kpi label="Overdue" value={money(overdueAmt)} sub={`${overdue.length} ${overdue.length === 1 ? "invoice" : "invoices"}`} icon={AlertCircle} tone={overdue.length ? "danger" : undefined} />
        <Kpi label="Due ≤ 7 days" value={money(dueSoonAmt)} sub={`${dueSoon.length} ${dueSoon.length === 1 ? "invoice" : "invoices"}`} icon={Calendar} tone={dueSoon.length ? "warning" : undefined} />
        <Kpi label="Paid" value={money(totalPaid)} sub={`${paidPct}% of ${money(totalInvoiced)}`} icon={Check} tone="success" />
        <Kpi label="Proof missing" value={num(proofMissing)} sub="cleared, no receipt" icon={ShieldCheck} tone={proofMissing ? "warning" : "success"} />
        <Kpi label="Vendors" value={num(vendorCount)} sub={`${rows.length} invoices`} icon={Receipt} />
      </div>

      {overdue.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm" style={{ background: "hsl(var(--danger) / 0.07)", borderColor: "hsl(var(--danger) / 0.3)" }}>
          <Badge tone="danger">Overdue</Badge>
          <span><span className="font-semibold">{money(overdueAmt)} past due</span> across {overdue.length} {overdue.length === 1 ? "invoice" : "invoices"}<span className="text-muted-foreground"> · Unpaid balances can hold production or cargo release.</span></span>
          <button onClick={() => setStatus("Overdue")} className="vy-btn vy-btn--outline vy-btn--sm ml-auto inline-flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Show overdue</button>
        </div>
      )}

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice, vendor, order" className="min-w-56 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <Select value={vtype} onChange={setVtype} className="w-44" options={[{ value: "All", label: "All types" }, ...VENDOR_TYPES.map((v) => ({ value: v, label: v }))]} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">{STATUS_CHIPS.map((c) => <button key={c} onClick={() => setStatus(c)} className={cn("vy-chip", status === c && "is-active")}>{c}</button>)}</div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <CardHeader title={`${filtered.length} ${filtered.length === 1 ? "invoice" : "invoices"}`} caption="Balance = total − paid" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Invoice</th>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Paid</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">{rows.length === 0 ? "No invoices yet — add one with “New invoice”." : "No invoices match your filters."}</td></tr>
              ) : pageRows.map((i) => {
                const bal = invoiceBalance(i); const st = invoiceStatus(i); const a = aging(i);
                return (
                  <tr key={i.id} className="cursor-pointer hover:bg-accent/40" onClick={() => setPeek(i)}>
                    <td className="px-3 py-2.5"><Link href={`/invoices/${i.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12px] font-bold hover:text-primary" title="Open full invoice">{i.id}</Link><div className="text-[11px] text-muted-foreground">{i.vendor_type}</div></td>
                    <td className="px-3 py-2.5">{i.order_id ? <Link href={`/orders/${i.order_id}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary"><div className="font-mono text-[11px] text-muted-foreground">{i.order_id}</div><div className="max-w-[200px] truncate text-[12px]">{i.orderTitle}</div></Link> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5 font-medium">{i.vendor}</td>
                    <td className="px-3 py-2.5"><div className="font-mono text-[12px]">{fmtDue(i.due)}</div>{a.label !== "Upcoming" && a.label !== "Settled" && <Badge tone={a.tone}>{a.label === "Overdue" ? `${Math.abs(a.days)}d overdue` : `in ${a.days}d`}</Badge>}{a.label === "Settled" && <Badge tone="success">settled</Badge>}</td>
                    <td className="tabular px-3 py-2.5 text-right font-mono">{money(i.total)}</td>
                    <td className="tabular px-3 py-2.5 text-right font-mono text-muted-foreground">{(i.paid ?? 0) > 0 ? money(i.paid) : "—"}</td>
                    <td className="tabular px-3 py-2.5 text-right font-mono font-semibold">{bal > BALANCE_EPSILON ? money(bal) : "—"}</td>
                    <td className="px-3 py-2.5"><Badge tone={INVOICE_STATUS_TONE[st]}>{st}</Badge></td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>{bal > BALANCE_EPSILON && <button onClick={() => setPayFor(i)} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1"><DollarSign className="h-3 w-3" /> Record</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-[12px] text-muted-foreground">
            <div>Showing {from + 1}–{Math.min(from + pageSize, filtered.length)} of {num(filtered.length)} invoices</div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5">Rows <Select value={String(pageSize)} onChange={(v) => setPageSize(Number(v))} className="w-20" options={[25, 50, 100].map((n) => ({ value: String(n), label: String(n) }))} /></label>
              <div className="flex items-center gap-1"><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="vy-btn vy-btn--ghost vy-btn--sm disabled:opacity-40">Prev</button><span className="px-1">{safePage} / {pageCount}</span><button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount} className="vy-btn vy-btn--ghost vy-btn--sm disabled:opacity-40">Next</button></div>
            </div>
          </div>
        )}
      </Card>

      {/* Payables aging */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-primary/12 text-primary"><Calendar className="h-4 w-4" /></span><div><div className="font-semibold">Payables aging</div><p className="text-[11px] text-muted-foreground">Outstanding balance by when it&apos;s due — pay the left bars first.</p></div></div>
        <div className="space-y-2">
          {buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-20 text-[12px] text-muted-foreground">{b.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", b.color)} style={{ width: `${Math.round((b.amt / bucketMax) * 100)}%` }} /></div>
              <span className="tabular w-24 text-right font-mono text-[12px] font-semibold">{money(b.amt)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Drawer */}
      <Drawer open={!!peek} onClose={() => setPeek(null)} title={peek?.id}>
        {peek && <InvoiceDetail i={peek} onRecord={() => setPayFor(peek)} onEdit={() => { setEditing(peek); setPeek(null); }} onDelete={async () => { if (!confirm(`Delete ${peek.id}?`)) return; await deleteInvoice(peek.id); setPeek(null); router.refresh(); }} />}
      </Drawer>

      {payFor && <RecordPaymentModal invoice={payFor} invoices={rows} onClose={() => setPayFor(null)} />}
      {newOpen && <InvoiceModal title="New invoice" orders={orders} vendors={vendors} onClose={() => setNewOpen(false)} onSubmit={(fd) => createInvoice(fd)} />}
      {editing && <InvoiceModal title={`Edit ${editing.id}`} invoice={editing} orders={orders} vendors={vendors} onClose={() => setEditing(null)} onSubmit={(fd) => updateInvoice(editing.id, fd)} />}
    </div>
  );
}

function InvoiceDetail({ i, onRecord, onEdit, onDelete }: { i: InvRow; onRecord: () => void; onEdit: () => void; onDelete: () => void }) {
  const bal = invoiceBalance(i); const st = invoiceStatus(i); const a = invoiceAging(i.due, bal, Date.now());
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[12px] text-muted-foreground">{i.vendor} · {i.vendor_type} · {payTermSummary({ type: (i.term_type as "TT") ?? "TT", depositPct: i.term_deposit_pct, netDays: i.term_net_days })}</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={INVOICE_STATUS_TONE[st]}>{st}</Badge>
          {a.label !== "Settled" && i.due && <Badge tone={a.tone}>{a.label === "Overdue" ? `${Math.abs(a.days)}d overdue` : a.label === "Due soon" ? `due in ${a.days}d` : `due ${fmtDue(i.due)}`}</Badge>}
          <div className="ml-auto flex gap-1.5"><button onClick={onEdit} className="vy-btn vy-btn--outline vy-btn--sm">Edit</button><button onClick={onDelete} className="vy-btn vy-btn--ghost vy-btn--sm text-danger"><Trash2 className="h-3.5 w-3.5" /></button></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border bg-background/50 p-3">
        <div><div className="vy-kicker">Total</div><div className="mt-0.5 font-mono text-base font-bold">{money(i.total)}</div></div>
        <div><div className="vy-kicker">Paid</div><div className="mt-0.5 font-mono text-base font-bold text-success">{money(i.paid)}</div></div>
        <div><div className="vy-kicker">Balance</div><div className="mt-0.5 font-mono text-base font-bold text-warning">{bal > BALANCE_EPSILON ? money(bal) : money(0)}</div></div>
      </div>

      <div><div className="vy-kicker mb-1.5">Details</div><div className="grid grid-cols-2 gap-3"><div><div className="vy-kicker mb-0.5">Issued</div><div className="font-mono text-[13px] font-semibold">{fmtDue(i.issued)}</div></div><div><div className="vy-kicker mb-0.5">Due</div><div className="font-mono text-[13px] font-semibold">{fmtDue(i.due)}</div></div></div></div>

      <div>
        <div className="vy-kicker mb-2">Payments ({i.payments.length})</div>
        {i.payments.length === 0 ? <p className="text-[12px] text-muted-foreground">No payments recorded yet.</p> : (
          <ul className="space-y-1.5">
            {i.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-[12px]">
                <span className="font-mono text-muted-foreground">{fmtDue(p.payment_date)}</span>
                <span className="font-mono font-semibold">{money(p.amount)}</span>
                {p.method && <span className="text-muted-foreground">{p.method}</span>}
                <span className="ml-auto flex items-center gap-1.5">
                  {p.proof_url ? <a href={p.proof_url} target="_blank" rel="noopener noreferrer"><Badge tone="success">Receipt</Badge></a> : p.status === "Cleared" ? <Badge tone="warning">No proof</Badge> : null}
                  <Badge tone={PAY_STATUS_TONE[p.status] ?? "muted"}>{p.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {i.order_id && (
        <div><div className="vy-kicker mb-2">Order</div>
          <Link href={`/orders/${i.order_id}`} className="flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2.5 hover:border-primary/40">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary"><Package className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><div className="font-mono text-[11px] text-muted-foreground">{i.order_id}</div><div className="truncate text-[13px] font-semibold">{i.orderTitle}</div></div>
            <ArrowUpRight className="h-4 w-4 shrink-0 opacity-50" />
          </Link>
        </div>
      )}

      <Link href={`/invoices/${i.id}`} className="vy-btn vy-btn--primary flex w-full items-center justify-center gap-1.5"><Receipt className="h-4 w-4" /> Open full invoice <ArrowUpRight className="h-4 w-4" /></Link>
      {bal > BALANCE_EPSILON && <button onClick={onRecord} className="vy-btn vy-btn--outline flex w-full items-center justify-center gap-1.5"><DollarSign className="h-4 w-4" /> Record payment</button>}
    </div>
  );
}

export function RecordPaymentModal({ invoice, invoices, onClose }: { invoice: InvRow | null; invoices: InvRow[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [invId, setInvId] = useState(invoice?.id ?? "");
  const [payStatus, setPayStatus] = useState("Cleared");
  const [proof, setProof] = useState<File | null>(null);
  const open = invoices.filter((i) => invoiceBalance(i) > BALANCE_EPSILON);
  const target = invoices.find((i) => i.id === invId) ?? null;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!invId) { setErr("Pick an invoice."); return; }
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => {
      if (proof) {
        const supabase = createClient();
        const safe = proof.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `invoices/${invId}/proof/${Date.now()}-${safe}`;
        const { error } = await supabase.storage.from("product-media").upload(path, proof, { upsert: true });
        if (!error) fd.set("proof_url", supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl);
      }
      const r = await recordPayment(invId, fd); if (!r.ok) { setErr(r.error); return; } onClose(); router.refresh();
    });
  }

  return (
    <Modal open onClose={onClose} title="Record payment">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Invoice">
          <Select value={invId} onChange={setInvId} placeholder="Pick an invoice…" searchable
            options={open.map((i) => ({ value: i.id, label: `${i.id} — ${i.vendor}`, sub: `balance ${money(invoiceBalance(i))}` }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (USD)"><input name="amount" type="number" step="0.01" required autoFocus className={inputCls} defaultValue={target ? invoiceBalance(target).toFixed(2) : ""} /></Field>
          <Field label="Date"><input name="payment_date" type="date" className={inputCls} defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
          <Field label="Method"><input name="method" className={inputCls} placeholder="Mercury / Wire / …" /></Field>
          <Field label="Status"><Select name="status" value={payStatus} onChange={setPayStatus} options={["Cleared", "Scheduled", "Pending"].map((s) => ({ value: s, label: s }))} /></Field>
        </div>
        <Field label="Proof of payment (optional)">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-[12px] text-muted-foreground hover:border-primary/40">
            <Paperclip className="h-3.5 w-3.5" /> {proof ? proof.name : "Attach receipt / bank confirmation (image or PDF)"}
            <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
          </label>
        </Field>
        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Record payment"}</PrimaryButton></div>
      </form>
    </Modal>
  );
}

export function InvoiceModal({ title, invoice, orders, vendors, onClose, onSubmit }: {
  title: string; invoice?: InvRow; orders: { id: string; title: string }[]; vendors: string[];
  onClose: () => void; onSubmit: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const i = invoice;
  const [vType, setVType] = useState<string>(i?.vendor_type ?? "Supplier");
  const [orderId, setOrderId] = useState<string>(i?.order_id ?? "");
  const [termType, setTermType] = useState<string>(i?.term_type ?? "TT");
  const [deposit, setDeposit] = useState<number>(i?.term_deposit_pct ?? 30);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => { const r = await onSubmit(fd); if (!r.ok) { setErr(r.error ?? "Failed."); return; } onClose(); router.refresh(); });
  }
  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor"><input name="vendor" list="vendor-list" required defaultValue={i?.vendor ?? ""} className={inputCls} /><datalist id="vendor-list">{vendors.map((v) => <option key={v} value={v} />)}</datalist></Field>
          <Field label="Type"><Select name="vendor_type" value={vType} onChange={setVType} options={VENDOR_TYPES.map((v) => ({ value: v, label: v }))} /></Field>
          <Field label="Order"><Select name="order_id" value={orderId} onChange={setOrderId} placeholder="— none —" options={[{ value: "", label: "— none —" }, ...orders.map((o) => ({ value: o.id, label: o.id, sub: o.title }))]} /></Field>
          <Field label="Total (USD)"><input name="total" type="number" step="0.01" required defaultValue={i?.total ?? ""} className={inputCls} /></Field>
          <Field label="Issued"><input name="issued" type="date" defaultValue={i?.issued ?? ""} className={inputCls} /></Field>
          <Field label="Due"><input name="due" type="date" defaultValue={i?.due ?? ""} className={inputCls} /></Field>
          {!i && <Field label="Already paid (USD)"><input name="paid" type="number" step="0.01" defaultValue="0" className={inputCls} /></Field>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment term"><Select name="term_type" value={termType} onChange={setTermType} options={PAYTERM_TYPES.map((t) => ({ value: t.key, label: `${t.label} — ${t.name}` }))} /></Field>
          {termType === "TT"
            ? <Field label="Deposit %"><input name="term_deposit_pct" type="number" min={0} max={100} value={deposit} onChange={(e) => setDeposit(Number(e.target.value) || 0)} className={inputCls} /></Field>
            : termType === "OA"
            ? <Field label="Net days"><input name="term_net_days" type="number" min={0} defaultValue={i?.term_net_days ?? 30} className={inputCls} /></Field>
            : <span />}
        </div>
        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save invoice"}</PrimaryButton></div>
      </form>
    </Modal>
  );
}
