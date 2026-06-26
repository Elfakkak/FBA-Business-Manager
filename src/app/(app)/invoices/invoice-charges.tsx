"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  money, num, BALANCE_EPSILON,
  type InvoiceLineRow, INVOICE_LINE_KIND_LABEL, sortInvoiceLines, invoiceLinesRollup,
} from "@/lib/derive";
import { saveInvoiceLines, type InvoiceLineInput } from "./actions";
import { AlertTriangle, ArrowRight, Plus, Trash2, Check } from "lucide-react";

// charge_types catalog row + order_lines (Production) row, passed in by the page.
export type OrderLineLite = { id: string; sku: string | null; product_name: string | null; qty: number; unit_cost: number | null };
export type ChargeTypeLite = { id: string; label: string; owner: string };

// "-$100.00" instead of money()'s "$-100.00" for negative (discount) amounts.
function signedMoney(n: number) { return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const isDiscountType = (id: string | null) => id === "discount";

// ---------------------------------------------------------------------------
// Billed-over-the-order banner — goods billed vs ordered (Production) variance.
// ---------------------------------------------------------------------------
export function BilledOverBanner({ lines, orderId }: { lines: InvoiceLineRow[]; orderId?: string | null }) {
  const roll = invoiceLinesRollup(lines);
  if (!roll.hasOrdered || Math.abs(roll.variance) <= BALANCE_EPSILON) return null;
  const over = roll.variance > 0;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2.5 text-[13px]"
      style={{ background: `hsl(var(--${over ? "warning" : "success"}) / 0.08)`, borderColor: `hsl(var(--${over ? "warning" : "success"}) / 0.3)` }}>
      <AlertTriangle className={cn("h-4 w-4 shrink-0", over ? "text-warning" : "text-success")} />
      <span>
        <span className="font-semibold">{over ? "Billed over the order" : "Billed under the order"}</span>
        <span className="text-muted-foreground"> · billed {money(roll.orderedGoodsBilled)} vs ordered {money(roll.goodsOrdered)}{orderId ? " in Production" : ""} · </span>
        <span className={cn("font-semibold", over ? "text-warning" : "text-success")}>{signedMoney(roll.variance)}</span>
      </span>
      {orderId && (
        <Link href={`/orders/${orderId}?tab=production`} className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline">
          Production <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InvoiceLinesTable — the shared Charges / Lines breakdown.
//   variant="page"   → full table (DESCRIPTION · TYPE · ORDERED · BILLED + total)
//   variant="drawer" → compact list (description + amount), for quick-view drawers
// ---------------------------------------------------------------------------
export function InvoiceLinesTable({ lines, variant = "page" }: {
  lines: InvoiceLineRow[]; variant?: "page" | "drawer";
}) {
  const sorted = sortInvoiceLines(lines);
  const roll = invoiceLinesRollup(lines);

  if (variant === "drawer") {
    return (
      <ul className="overflow-hidden rounded-lg border">
        {sorted.map((l) => {
          const disc = l.kind === "discount";
          const sub = l.kind === "goods"
            ? [l.sku, l.qty != null ? `${num(l.qty)} pcs` : null].filter(Boolean).join(" · ")
            : INVOICE_LINE_KIND_LABEL[l.kind] ?? l.kind;
          return (
            <li key={l.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{l.description}</div>
                {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
              </div>
              <div className={cn("shrink-0 font-mono text-[13px] font-semibold", disc && "text-success")}>{signedMoney(Number(l.billed) || 0)}</div>
            </li>
          );
        })}
        <li className="flex items-center justify-between bg-muted/40 px-3 py-2.5">
          <span className="text-[13px] font-semibold">Total</span>
          <span className="font-mono text-[13px] font-bold">{money(roll.itemized)}</span>
        </li>
      </ul>
    );
  }

  // page variant — full itemized table
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-y bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-2 font-medium">Description</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 text-right font-medium">Ordered</th>
            <th className="px-5 py-2 text-right font-medium">Billed</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((l) => {
            const billed = Number(l.billed) || 0;
            const ordered = l.ordered_amount == null ? null : Number(l.ordered_amount);
            const variance = ordered != null ? billed - ordered : 0;
            const disc = l.kind === "discount";
            return (
              <tr key={l.id}>
                <td className="px-5 py-3">
                  <div className="font-medium">{l.description}</div>
                  {l.kind === "goods" && (l.sku || l.qty != null) && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {l.sku && <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{l.sku}</span>}
                      {l.qty != null && <span>{num(l.qty)} units</span>}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-muted-foreground">{INVOICE_LINE_KIND_LABEL[l.kind] ?? l.kind}</td>
                <td className="tabular px-3 py-3 text-right font-mono text-muted-foreground">{ordered != null ? money(ordered) : "—"}</td>
                <td className="tabular px-5 py-3 text-right">
                  <div className={cn("font-mono font-semibold", disc && "text-success")}>{signedMoney(billed)}</div>
                  {ordered != null && Math.abs(variance) > BALANCE_EPSILON && (
                    <div className={cn("font-mono text-[11px]", variance > 0 ? "text-warning" : "text-success")}>{signedMoney(variance)}</div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/30 font-semibold">
            <td className="px-5 py-3" colSpan={2}>Total</td>
            <td className="tabular px-3 py-3 text-right font-mono">{roll.hasOrdered ? money(roll.goodsOrdered) : "—"}</td>
            <td className="tabular px-5 py-3 text-right font-mono">{money(roll.itemized)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditChargesModal — itemize goods (per SKU) + service charges, with a live
// "Itemized vs invoice total" check. Mirrors the V2 prototype.
// ---------------------------------------------------------------------------
type EditLine = {
  key: string;
  kind: "goods" | "service" | "discount";
  order_line_id: string | null;
  sku: string | null;
  description: string;
  qty: number | null;
  ordered_amount: number | null;
  charge_type_id: string | null;
  owner: string | null;
  billed: string; // raw input
};

let _k = 0;
const nextKey = () => `el-${++_k}`;
const parseAmt = (s: string) => { const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) ? n : 0; };

// Which charge owners are most relevant per invoice vendor type — used to surface
// the likely charges first (all still shown). Supplier bills bundle agent fees;
// forwarder bills often carry broker/customs lines.
const RELEVANT_OWNERS: Record<string, string[]> = {
  Supplier: ["Supplier", "Agent"],
  Agent: ["Agent", "Supplier"],
  Forwarder: ["Forwarder", "Broker"],
  Inspection: ["Inspection"],
};

export function EditChargesModal({ invoiceId, invoiceTotal, vendorType, lines, orderLines, chargeTypes, onClose }: {
  invoiceId: string; invoiceTotal: number; vendorType?: string;
  lines: InvoiceLineRow[]; orderLines: OrderLineLite[]; chargeTypes: ChargeTypeLite[]; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<EditLine[]>(() => sortInvoiceLines(lines).map((l) => ({
    key: nextKey(), kind: l.kind as EditLine["kind"], order_line_id: l.order_line_id, sku: l.sku,
    description: l.description, qty: l.qty == null ? null : Number(l.qty),
    ordered_amount: l.ordered_amount == null ? null : Number(l.ordered_amount),
    charge_type_id: l.charge_type_id, owner: l.owner, billed: String(Number(l.billed) || 0),
  })));

  const goods = rows.filter((r) => r.kind === "goods");
  const charges = rows.filter((r) => r.kind !== "goods");
  const goodsTotal = goods.reduce((s, r) => s + parseAmt(r.billed), 0);
  const chargesTotal = charges.reduce((s, r) => s + parseAmt(r.billed), 0);
  const itemized = goodsTotal + chargesTotal;
  const diff = itemized - invoiceTotal;
  const matches = Math.abs(diff) <= BALANCE_EPSILON;

  const usedOrderLineIds = new Set(goods.map((g) => g.order_line_id).filter(Boolean));
  const addable = orderLines.filter((o) => !usedOrderLineIds.has(o.id));

  const set = (key: string, patch: Partial<EditLine>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  function addProduct(orderLineId: string) {
    const o = orderLines.find((x) => x.id === orderLineId); if (!o) return;
    const ordered = (o.qty ?? 0) * (o.unit_cost ?? 0);
    setRows((rs) => [...rs, {
      key: nextKey(), kind: "goods", order_line_id: o.id, sku: o.sku, description: o.product_name ?? o.sku ?? "Product",
      qty: o.qty, ordered_amount: ordered, charge_type_id: null, owner: null, billed: ordered.toFixed(2),
    }]);
  }
  function addManual() {
    setRows((rs) => [...rs, { key: nextKey(), kind: "goods", order_line_id: null, sku: null, description: "", qty: null, ordered_amount: null, charge_type_id: null, owner: null, billed: "0" }]);
  }
  function addCharge() {
    const ct = chargeTypes.find((c) => c.id !== "discount") ?? chargeTypes[0];
    setRows((rs) => [...rs, {
      key: nextKey(), kind: ct && isDiscountType(ct.id) ? "discount" : "service",
      order_line_id: null, sku: null, description: ct?.label ?? "Charge", qty: null, ordered_amount: null,
      charge_type_id: ct?.id ?? null, owner: ct?.owner ?? null, billed: "0",
    }]);
  }
  function setChargeType(key: string, id: string) {
    const ct = chargeTypes.find((c) => c.id === id);
    set(key, { charge_type_id: id, owner: ct?.owner ?? null, description: ct?.label ?? "Charge", kind: isDiscountType(id) ? "discount" : "service" });
  }

  function save() {
    setErr(null);
    const payload: InvoiceLineInput[] = rows.map((r) => ({
      kind: r.kind, order_line_id: r.order_line_id, sku: r.sku, description: r.description.trim(),
      qty: r.qty, ordered_amount: r.ordered_amount, charge_type_id: r.charge_type_id, owner: r.owner, billed: parseAmt(r.billed),
    }));
    start(async () => {
      const res = await saveInvoiceLines(invoiceId, payload);
      if (!res.ok) { setErr(res.error); return; }
      onClose(); router.refresh();
    });
  }

  // Sort the charge catalog so owners relevant to this invoice's vendor come first.
  const relevant = RELEVANT_OWNERS[vendorType ?? ""] ?? [];
  const ownerRank = (owner: string) => { const i = relevant.indexOf(owner); return i === -1 ? relevant.length + 1 : i; };
  const chargeOpts = [...chargeTypes]
    .sort((a, b) => ownerRank(a.owner) - ownerRank(b.owner) || a.label.localeCompare(b.label))
    .map((c) => ({ value: c.id, label: c.label, sub: c.owner !== "—" ? c.owner : undefined }));

  return (
    <Modal open onClose={onClose} title="Edit charges">
      <div className="space-y-4">
        <p className="-mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Itemize goods per SKU (billed amount) and edit service charges. SKU, quantity &amp; ordered come from Production; you enter what was billed.
        </p>

        {/* GOODS */}
        <div className="rounded-xl border p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="vy-kicker">Goods — per SKU</span>
            <span className="font-mono text-[12px] font-semibold">{money(goodsTotal)}</span>
          </div>
          <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-2 px-1 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Product</span><span className="text-right">Qty</span><span className="text-right">Billed</span><span />
          </div>
          <ul className="space-y-1.5">
            {goods.map((r) => (
              <li key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border bg-background/40 px-3 py-2 sm:grid-cols-[1fr_3.5rem_7rem_auto]">
                <div className="min-w-0">
                  {r.order_line_id ? (
                    <>
                      <div className="truncate text-[13px] font-semibold">{r.description}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        {r.sku && <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{r.sku}</span>}
                        {r.ordered_amount != null && <span>ordered {money(r.ordered_amount)}</span>}
                      </div>
                    </>
                  ) : (
                    <input value={r.description} onChange={(e) => set(r.key, { description: e.target.value })} placeholder="Manual line description"
                      className="w-full rounded-md border bg-background px-2 py-1 text-[13px] outline-none focus:ring-2 focus:ring-ring" />
                  )}
                </div>
                <div className="hidden text-right font-mono text-[12px] text-muted-foreground sm:block">{r.qty != null ? num(r.qty) : "—"}</div>
                <input inputMode="decimal" value={r.billed} onChange={(e) => set(r.key, { billed: e.target.value })}
                  className="w-full rounded-md border bg-background px-2 py-1 text-right font-mono text-[13px] outline-none focus:ring-2 focus:ring-ring" />
                <button onClick={() => remove(r.key)} className="vy-icon-btn justify-self-end" aria-label="Remove line"><Trash2 className="h-3.5 w-3.5 text-danger" /></button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="min-w-[16rem] flex-1">
              <Select value="" onChange={addProduct} placeholder="+ Add product from Production…" searchable
                options={addable.map((o) => ({ value: o.id, label: o.product_name ?? o.sku ?? "Product", sub: o.sku ?? undefined }))} />
            </div>
            <button onClick={addManual} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Manual line</button>
          </div>
        </div>

        {/* SERVICE CHARGES */}
        <div className="rounded-xl border p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="vy-kicker">Service charges</span>
            <span className="font-mono text-[12px] font-semibold">{money(chargesTotal)}</span>
          </div>
          <ul className="space-y-1.5">
            {charges.map((r) => (
              <li key={r.key} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
                <Select value={r.charge_type_id ?? ""} onChange={(v) => setChargeType(r.key, v)} options={chargeOpts} searchable />
                <input inputMode="decimal" value={r.billed} onChange={(e) => set(r.key, { billed: e.target.value })}
                  className="w-full rounded-md border bg-background px-2 py-2 text-right font-mono text-[13px] outline-none focus:ring-2 focus:ring-ring" />
                <button onClick={() => remove(r.key)} className="vy-icon-btn" aria-label="Remove charge"><Trash2 className="h-3.5 w-3.5 text-danger" /></button>
              </li>
            ))}
          </ul>
          <button onClick={addCharge} className="mt-2 vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add charge</button>
        </div>

        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}

        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          <div className="text-[13px]">
            <span className="text-muted-foreground">Itemized </span>
            <span className="font-mono font-semibold">{money(itemized)}</span>
            <span className="text-muted-foreground"> vs invoice total </span>
            <span className="font-mono font-semibold">{money(invoiceTotal)}</span>
            <span className={cn("ml-1.5 font-medium", matches ? "text-success" : "text-warning")}>
              {matches ? "· matches" : `· off by ${signedMoney(diff)}`}
            </span>
          </div>
          <div className="ml-auto flex gap-2">
            <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton type="button" onClick={save} disabled={pending} className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4" /> {pending ? "Saving…" : "Save charges"}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
