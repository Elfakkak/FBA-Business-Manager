"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/primitives";
import { PaymentTermsCard } from "./[id]/payment-terms-card";
import { InvoiceLinesTable } from "./invoice-charges";
import type { InvRow } from "./invoices-table";
import {
  money, BALANCE_EPSILON, INVOICE_STATUS_TONE, PAY_STATUS_TONE,
  invoiceBalance, invoiceStatus, invoiceAging, type PayTermCfg,
} from "@/lib/derive";
import { DollarSign, Pencil, Trash2, ArrowUpRight, FileText, Receipt } from "lucide-react";

const fmtDue = (iso: string | null) => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
function termCfg(i: InvRow): PayTermCfg { return { type: (i.term_type as PayTermCfg["type"]) ?? "TT", depositPct: i.term_deposit_pct, netDays: i.term_net_days }; }

// One shared invoice quick-view drawer — used by the standalone Invoices list
// AND the order-shell Invoices section, so they stay in harmony.
export function InvoiceQuickDrawer({ open, invoice, onClose, onRecord, onEdit, onDelete }: {
  open: boolean; invoice: InvRow | null;
  onClose: () => void; onRecord: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const i = invoice;
  const bal = i ? invoiceBalance(i) : 0;
  const st = i ? invoiceStatus(i) : "Unpaid";
  const a = i ? invoiceAging(i.due, bal, Date.now()) : null;
  const proofMissing = i ? i.payments.filter((p) => p.status === "Cleared" && !p.proof_url).length : 0;
  const lines = i?.lines ?? [];

  return (
    <Drawer
      open={open && !!i}
      onClose={onClose}
      width={560}
      title={<span className="font-mono text-[15px] font-bold">{i?.id}</span>}
      subtitle={i ? `${i.vendor} · ${i.vendor_type}` : undefined}
      footer={i && (
        <div className="flex items-center gap-2">
          <button onClick={onDelete} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1.5 text-danger"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          <div className="ml-auto flex items-center gap-2">
            {bal > BALANCE_EPSILON && <button onClick={onRecord} className="vy-btn vy-btn--primary vy-btn--sm inline-flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Log payment</button>}
            <Link href={`/invoices/${i.id}`} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5"><ArrowUpRight className="h-3.5 w-3.5" /> Full page</Link>
            <button onClick={onClose} className="vy-btn vy-btn--ghost vy-btn--sm">Close</button>
          </div>
        </div>
      )}
    >
      {i && (
        <div className="space-y-5">
          {/* badges + edit */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={INVOICE_STATUS_TONE[st]}>{st}</Badge>
            {a && a.label !== "Settled" && i.due && <Badge tone={a.tone}>{a.label === "Overdue" ? `${Math.abs(a.days)}d overdue` : a.label === "Due soon" ? `due in ${a.days}d` : `due ${fmtDue(i.due)}`}</Badge>}
            {proofMissing > 0 && <Badge tone="warning">{proofMissing} proof missing</Badge>}
            <button onClick={onEdit} className="ml-auto vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</button>
          </div>

          {/* TOTAL / PAID / BALANCE / DUE */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-background/50 p-3 sm:grid-cols-4">
            <div><div className="vy-kicker">Total</div><div className="mt-0.5 font-mono text-[15px] font-bold">{money(i.total)}</div></div>
            <div><div className="vy-kicker">Paid</div><div className="mt-0.5 font-mono text-[15px] font-bold text-success">{money(i.paid)}</div></div>
            <div><div className="vy-kicker">Balance</div><div className={cn("mt-0.5 text-[15px] font-bold", bal > BALANCE_EPSILON ? "font-mono text-warning" : "text-success")}>{bal > BALANCE_EPSILON ? money(bal) : "Settled"}</div></div>
            <div><div className="vy-kicker">Due</div><div className="mt-0.5 font-mono text-[15px] font-semibold">{fmtDue(i.due)}</div></div>
          </div>

          {/* Payment terms (shared card) */}
          <PaymentTermsCard vendor={i.vendor} total={i.total ?? 0} paid={i.paid ?? 0} cfg={termCfg(i)} />

          {/* Invoice file */}
          {i.document_url && (
            <div>
              <div className="vy-kicker mb-1.5">Invoice file</div>
              <div className="flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><FileText className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{i.id}</div><div className="text-[11px] text-muted-foreground">Invoice document</div></div>
                <a href={i.document_url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Open</a>
              </div>
            </div>
          )}

          {/* Lines / charges */}
          <div>
            <div className="vy-kicker mb-1.5">Lines / charges</div>
            {lines.length > 0
              ? <InvoiceLinesTable lines={lines} variant="drawer" />
              : <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[12px] text-muted-foreground">Not itemized yet — open the full page to add charges.</p>}
          </div>

          {/* Payments */}
          <div>
            <div className="vy-kicker mb-1.5">Payments ({i.payments.length})</div>
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
            <Link href={`/orders/${i.order_id}`} className="flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2.5 hover:border-primary/40">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary"><Receipt className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><div className="font-mono text-[11px] text-muted-foreground">{i.order_id}</div><div className="truncate text-[13px] font-semibold">{i.orderTitle}</div></div>
              <ArrowUpRight className="h-4 w-4 shrink-0 opacity-50" />
            </Link>
          )}
        </div>
      )}
    </Drawer>
  );
}
