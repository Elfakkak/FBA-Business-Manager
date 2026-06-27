"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead, CardHeader } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { num, money, type InvoiceRow, type InvoiceLineRow, INVOICE_STATUS_TONE, BALANCE_EPSILON, invoiceBalance, invoiceStatus, invoiceAging, PAYTERM_TYPES, PAYTERM_BY_KEY } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { InvoiceQuickDrawer } from "./invoice-quick-drawer";
import { createInvoice, updateInvoice, deleteInvoice, recordPayment } from "./actions";
import { DollarSign, AlertCircle, Calendar, Check, Receipt, ArrowUpRight, Plus, ShieldCheck, Link2, Upload } from "lucide-react";

export type Payment = { id: string; amount: number; payment_date: string | null; method: string | null; status: string; proof_kind: string | null; proof_url: string | null };
export type InvRow = InvoiceRow & { orderTitle: string | null; payments: Payment[]; lines: InvoiceLineRow[] };
// a selectable vendor + its type, derived from the supplier/partner record
export type VendorOpt = { name: string; type: string };

const VENDOR_TYPES = ["Supplier", "Forwarder", "Agent", "Inspection"];
const STATUS_CHIPS = ["All", "Overdue", "Unpaid", "Partial", "Paid"];
const fmtDue = (iso: string | null) => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

export function InvoicesTable({ rows, orders, vendors }: { rows: InvRow[]; orders: { id: string; title: string }[]; vendors: VendorOpt[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [vtype, setVtype] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [peek, setPeek] = useState<InvRow | null>(null);
  const [payFor, setPayFor] = useState<InvRow | null>(null); // locked to a specific invoice
  const [payPicker, setPayPicker] = useState(false);          // list-level: pick which invoice
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
            <button onClick={() => setPayPicker(true)} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> Record payment</button>
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

      {/* Shared quick-view drawer (same component as the order-shell Invoices section) */}
      <InvoiceQuickDrawer
        open={!!peek}
        invoice={peek}
        onClose={() => setPeek(null)}
        onRecord={() => peek && setPayFor(peek)}
        onEdit={() => { if (peek) { setEditing(peek); setPeek(null); } }}
        onDelete={async () => { if (!peek || !confirm(`Delete ${peek.id}?`)) return; await deleteInvoice(peek.id); setPeek(null); router.refresh(); }}
      />

      {payFor && <RecordPaymentModal invoice={payFor} invoices={rows} onClose={() => setPayFor(null)} />}
      {payPicker && <RecordPaymentModal invoice={null} invoices={rows} onClose={() => setPayPicker(false)} />}
      {newOpen && <InvoiceModal title="New invoice" orders={orders} vendors={vendors} onClose={() => setNewOpen(false)} onSubmit={(fd) => createInvoice(fd)} />}
      {editing && <InvoiceModal title={`Edit ${editing.id}`} invoice={editing} orders={orders} vendors={vendors} onClose={() => setEditing(null)} onSubmit={(fd) => updateInvoice(editing.id, fd)} />}
    </div>
  );
}

const PAY_METHODS = ["Mercury", "Wise", "Wire", "PayPal", "Cash", "Other"];

export function RecordPaymentModal({ invoice, invoices, onClose }: { invoice: InvRow | null; invoices: InvRow[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  // Fixed-invoice mode when launched from a specific invoice; picker mode from the list.
  const fixed = !!invoice;
  const [invId, setInvId] = useState(invoice?.id ?? "");
  const [method, setMethod] = useState("Mercury");
  const [proof, setProof] = useState<File | null>(null);
  const open = invoices.filter((i) => invoiceBalance(i) > BALANCE_EPSILON);
  const target = invoices.find((i) => i.id === invId) ?? invoice ?? null;
  const balance = target ? invoiceBalance(target) : 0;

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
        {/* invoice context — subtitle when fixed, picker when launched from the list */}
        {fixed
          ? <p className="-mt-1 text-[12px] text-muted-foreground"><span className="font-mono">{target?.id}</span> · {money(balance)} balance</p>
          : <Field label="Invoice">
              <Select value={invId} onChange={setInvId} placeholder="Pick an invoice…" searchable
                options={open.map((i) => ({ value: i.id, label: `${i.id} — ${i.vendor}`, sub: `balance ${money(invoiceBalance(i))}` }))} />
            </Field>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (USD)"><input name="amount" type="number" step="0.01" required autoFocus className={inputCls} defaultValue={balance > BALANCE_EPSILON ? balance.toFixed(2) : ""} /></Field>
          <Field label="Method"><Select name="method" value={method} onChange={setMethod} options={PAY_METHODS.map((m) => ({ value: m, label: m }))} /></Field>
        </div>

        <Field label="Reference (optional)"><input name="reference" className={inputCls} placeholder="e.g. MERC-0531" /></Field>

        <div>
          <div className="vy-kicker mb-1.5">Proof of payment</div>
          <div className="grid grid-cols-2 gap-2">
            {/* Mercury link — Phase-2 integration, not yet connected */}
            <button type="button" disabled title="Mercury integration coming soon"
              className="relative flex cursor-not-allowed items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-[13px] font-medium text-muted-foreground opacity-70">
              <Link2 className="h-4 w-4" /> Link Mercury transaction
              <span className="absolute -right-1.5 -top-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Soon</span>
            </button>
            <label className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-[13px] font-medium hover:border-primary/40", proof ? "border-primary/50 text-foreground" : "text-muted-foreground")}>
              <Upload className="h-4 w-4" /> {proof ? "Receipt attached" : "Attach receipt"}
              <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{proof ? proof.name : "A linked Mercury transaction is verified proof. Use a receipt for payments made outside Mercury."}</p>
        </div>

        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending} className="inline-flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> {pending ? "Saving…" : "Save payment"}</PrimaryButton></div>
      </form>
    </Modal>
  );
}

export function InvoiceModal({ title, invoice, orders, vendors, lockedOrderId, onClose, onSubmit }: {
  title: string; invoice?: InvRow; orders: { id: string; title: string }[]; vendors: VendorOpt[]; lockedOrderId?: string;
  onClose: () => void; onSubmit: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const i = invoice;
  const vendorType = useMemo(() => new Map(vendors.map((v) => [v.name, v.type])), [vendors]);
  const [vendor, setVendor] = useState<string>(i?.vendor ?? "");
  // Type is DERIVED from the chosen vendor's record (supplier/partner), not picked.
  const vType = vendorType.get(vendor) ?? i?.vendor_type ?? "Supplier";
  const [orderId, setOrderId] = useState<string>(i?.order_id ?? lockedOrderId ?? "");
  const lockedOrderTitle = lockedOrderId ? (orders.find((o) => o.id === lockedOrderId)?.title ?? null) : null;
  // include the invoice's current vendor even if it's not in the suppliers/partners list
  const vendorOpts = [...new Set([...(i?.vendor ? [i.vendor] : []), ...vendors.map((v) => v.name)])].map((v) => ({ value: v, label: v }));
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
          <Field label="Vendor"><Select name="vendor" value={vendor} onChange={setVendor} placeholder="Pick a vendor…" searchable options={vendorOpts} /></Field>
          <Field label="Type">
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">{vType}</span>
              <span className="text-[11px] text-muted-foreground">· from the vendor record</span>
            </div>
            <input type="hidden" name="vendor_type" value={vType} />
          </Field>
          {lockedOrderId
            ? <Field label="Order">
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-mono font-medium">{lockedOrderId}</span>
                  {lockedOrderTitle && <span className="truncate text-[11px] text-muted-foreground">· {lockedOrderTitle}</span>}
                </div>
                <input type="hidden" name="order_id" value={lockedOrderId} />
              </Field>
            : <Field label="Order"><Select name="order_id" value={orderId} onChange={setOrderId} placeholder="— none —" options={[{ value: "", label: "— none —" }, ...orders.map((o) => ({ value: o.id, label: o.id, sub: o.title }))]} /></Field>}
          <Field label="Total (USD)"><input name="total" type="number" step="0.01" required defaultValue={i?.total ?? ""} className={inputCls} /></Field>
          <Field label="Issued"><input name="issued" type="date" defaultValue={i?.issued ?? ""} className={inputCls} /></Field>
          <Field label="Due (optional)">
            <input name="due" type="date" defaultValue={i?.due ?? ""} className={inputCls} />
            <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">Most supplier terms pay on a milestone (deposit / before ship / on documents) — see the schedule. Set a date only for O/A net‑days or a hard deadline.</p>
          </Field>
          {!i && <Field label="Already paid (USD)"><input name="paid" type="number" step="0.01" defaultValue="0" className={inputCls} /></Field>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment term"><Select name="term_type" value={termType} onChange={setTermType} options={PAYTERM_TYPES.map((t) => ({ value: t.key, label: `${t.label} — ${t.name}` }))} /></Field>
          {PAYTERM_BY_KEY[termType]?.hasDeposit
            ? <Field label="Deposit %"><input name="term_deposit_pct" type="number" min={0} max={100} value={deposit} onChange={(e) => setDeposit(Number(e.target.value) || 0)} className={inputCls} /><p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">e.g. 30 = pay 30% deposit to start, 70% balance later. 0 = pay in full at the trigger.</p></Field>
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
