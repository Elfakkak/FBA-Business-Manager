"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { money, payTermSchedule, payTermSummary, PAYTERM_TYPES, PAYTERM_BY_KEY, PAYTERM_TT_PRESETS, type PayTermCfg } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { saveInvoiceTerms } from "../actions";
import { Receipt, Pencil, Check, DollarSign } from "lucide-react";

export function PaymentTermsCard({ invoiceId, vendor, total, paid, cfg }: {
  invoiceId: string; vendor: string; total: number; paid: number; cfg: PayTermCfg;
}) {
  const [editing, setEditing] = useState(false);
  const t = PAYTERM_BY_KEY[cfg.type] ?? PAYTERM_BY_KEY.TT;
  const schedule = payTermSchedule(cfg, total, paid);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><Receipt className="h-4 w-4" /></span>
          <div><div className="font-semibold">Payment terms</div><p className="text-[11px] text-muted-foreground">How and when you pay {vendor} — and what&apos;s left to pay.</p></div>
        </div>
        <button onClick={() => setEditing(true)} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5"><Pencil className="h-3 w-3" /> Edit</button>
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-9 place-items-center rounded-md bg-primary/12 text-[11px] font-bold text-primary">{t.label}</span>
          <span className="text-[13px] font-semibold">{t.name}</span>
          <span className="ml-auto font-mono text-[12px] text-muted-foreground">{payTermSummary(cfg)}</span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{t.blurb}</p>

        <div className="mt-3 rounded-lg border bg-background/40">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="vy-kicker">Schedule · on {money(total)} supplier invoice</span>
            <span className="font-mono text-[11px] text-muted-foreground">{money(paid)} paid</span>
          </div>
          <ul className="divide-y">
            {schedule.map((s, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", s.settled ? "bg-success/15 text-success" : s.partial ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>
                  {s.settled ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <DollarSign className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{s.label}{s.pct < 100 ? ` · ${s.pct}%` : ""}</div>
                  <div className="text-[11px] text-muted-foreground">{s.when}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[13px] font-bold">{money(s.amount)}</div>
                  <div className={cn("text-[11px] font-medium", s.settled ? "text-success" : s.partial ? "text-warning" : "text-muted-foreground")}>
                    {s.settled ? "Paid" : s.partial ? `${money(s.paidAmt)} paid` : "Due"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {editing && <EditTermsModal invoiceId={invoiceId} cfg={cfg} onClose={() => setEditing(false)} />}
    </Card>
  );
}

function EditTermsModal({ invoiceId, cfg, onClose }: { invoiceId: string; cfg: PayTermCfg; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<string>(cfg.type);
  const [deposit, setDeposit] = useState<number>(cfg.depositPct ?? 30);
  const [netDays, setNetDays] = useState<number>(cfg.netDays ?? 30);
  const t = PAYTERM_BY_KEY[type] ?? PAYTERM_BY_KEY.TT;

  function save() {
    start(async () => {
      await saveInvoiceTerms(invoiceId, { type, depositPct: type === "TT" ? deposit : null, netDays: type === "OA" ? netDays : null });
      onClose(); router.refresh();
    });
  }

  return (
    <Modal open onClose={onClose} title="Payment terms">
      <div className="space-y-4">
        <Field label="Term type">
          <Select value={type} onChange={setType} options={PAYTERM_TYPES.map((x) => ({ value: x.key, label: `${x.label} — ${x.name}` }))} />
        </Field>
        <p className="rounded-md bg-accent/40 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">{t.blurb}</p>

        {type === "TT" && (
          <Field label="Deposit split">
            <div className="flex flex-wrap items-center gap-1.5">
              {PAYTERM_TT_PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setDeposit(p)} className={cn("vy-chip", deposit === p && "is-active")}>{p === 0 ? "0 (balance only)" : p === 100 ? "100% upfront" : `${p} / ${100 - p}`}</button>
              ))}
              <input type="number" min={0} max={100} value={deposit} onChange={(e) => setDeposit(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className={cn(inputCls, "w-20")} />
              <span className="text-[12px] text-muted-foreground">% deposit</span>
            </div>
          </Field>
        )}
        {type === "OA" && (
          <Field label="Net days after shipment"><input type="number" min={0} value={netDays} onChange={(e) => setNetDays(Number(e.target.value) || 0)} className={inputCls} /></Field>
        )}

        <div className="flex justify-end gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="button" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save terms"}</PrimaryButton></div>
      </div>
    </Modal>
  );
}
