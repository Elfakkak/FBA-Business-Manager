"use client";

import { Card } from "@/components/ui/primitives";
import { money, payTermSchedule, payTermSummary, PAYTERM_BY_KEY, type PayTermCfg } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { Receipt, Check, DollarSign } from "lucide-react";

// Display-only: the payment term + deposit split are edited in the main invoice Edit
// (one edit for everything), and this card renders the resulting schedule.
export function PaymentTermsCard({ vendor, total, paid, cfg }: {
  vendor: string; total: number; paid: number; cfg: PayTermCfg;
}) {
  const t = PAYTERM_BY_KEY[cfg.type] ?? PAYTERM_BY_KEY.TT;
  const schedule = payTermSchedule(cfg, total, paid);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-grid h-7 w-7 place-items-center rounded-md bg-info/12 text-info"><Receipt className="h-4 w-4" /></span>
          <div><div className="font-semibold">Payment terms</div><p className="text-[11px] text-muted-foreground">How and when you pay {vendor} — and what&apos;s left to pay. Edit via the invoice Edit button.</p></div>
        </div>
        <span className="font-mono text-[12px] text-muted-foreground">{payTermSummary(cfg)}</span>
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-9 place-items-center rounded-md bg-primary/12 text-[11px] font-bold text-primary">{t.label}</span>
          <span className="text-[13px] font-semibold">{t.name}</span>
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
    </Card>
  );
}
