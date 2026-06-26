"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  money, num, productionLanded, PROD_SECTIONS, PROD_LINE_TYPES, PROD_BASES,
  ORDER_STATUS_LABEL, type OrderRow, type OrderCostRow,
} from "@/lib/derive";
import { addOrderLine, deleteOrderLine, addOrderCost, deleteOrderCost } from "../actions";
import {
  Package, Activity, ClipboardCheck, FileText, Plus, Trash2, DollarSign,
} from "lucide-react";

type ProdLine = { id: string; sku: string | null; product_name: string | null; family_id: string | null; qty: number; unit_cost: number | null; unit_cny_ref: number | null };
type VariantOpt = { id: string; sku: string; name: string; last_cost_usd: number | null };
type ChargeTypeOpt = { id: string; label: string; owner: string };

const SECTION_TONE: Record<string, string> = { Production: "brand", Shipping: "info", Inspection: "warning" };

export function ProductionSection({ order, lines, costs, variants, chargeTypes }: {
  order: OrderRow; lines: ProdLine[]; costs: OrderCostRow[]; variants: VariantOpt[]; chargeTypes: ChargeTypeOpt[];
}) {
  const roll = useMemo(() => productionLanded(lines, costs), [lines, costs]);
  const landedById = useMemo(() => new Map(roll.withLanded.map((l) => [l.id, l])), [roll]);
  const skuCount = lines.length;
  const goodsMissing = lines.filter((l) => !l.unit_cost).length;
  const statusLabel = ORDER_STATUS_LABEL[order.status] ?? order.status;

  // group production lines by product (family), preserving order
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; lines: ProdLine[] }>();
    for (const l of lines) {
      const key = l.family_id ?? l.product_name ?? l.id;
      if (!map.has(key)) map.set(key, { name: l.product_name ?? l.sku ?? "Product", lines: [] });
      map.get(key)!.lines.push(l);
    }
    return [...map.values()];
  }, [lines]);

  return (
    <div className="space-y-5">
      {/* Header + next action */}
      <Card className="overflow-hidden p-0">
        <div className="grid lg:grid-cols-[1.6fr_1fr]">
          <div className="p-5">
            <h2 className="text-2xl font-bold">Production</h2>
            <p className="mt-1 max-w-[60ch] text-[13px] text-muted-foreground">Factory scope, product lines, charges, readiness, and supplier files.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="info">{statusLabel}</Badge>
              <Badge tone="muted">{skuCount} {skuCount === 1 ? "variant" : "variants"}</Badge>
              <Badge tone="muted">{num(roll.totalUnits)} pcs</Badge>
              {goodsMissing > 0 && <Badge tone="warning">{goodsMissing} missing cost</Badge>}
            </div>
          </div>
          <div className="border-t bg-accent/40 p-5 lg:border-l lg:border-t-0">
            <div className="vy-kicker mb-1.5">Next action</div>
            <div className="text-base font-bold">{goodsMissing > 0 ? "Close readiness gaps" : "Generate the PO"}</div>
            <p className="mb-3 mt-1 text-[12px] text-muted-foreground">{goodsMissing > 0 ? `${goodsMissing} line${goodsMissing === 1 ? "" : "s"} need a unit cost — build the scope, then generate the PO.` : "Scope is priced — ready to generate the purchase order."}</p>
            <button type="button" disabled title="PO sheet — coming soon" className="vy-btn vy-btn--primary inline-flex cursor-not-allowed items-center gap-1.5 opacity-70">
              <FileText className="h-4 w-4" /> Generate PO <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">Soon</span>
            </button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Production scope" value={`${skuCount} ${skuCount === 1 ? "SKU" : "SKUs"}`} sub={`${num(roll.totalUnits)} pcs · ${money(roll.totalGoods)} product cost`} icon={Package} />
        <Kpi label="Readiness" value={goodsMissing > 0 ? `${goodsMissing} missing` : "Ready"} sub={goodsMissing > 0 ? "lines need a cost" : "all lines priced"} icon={ClipboardCheck} tone={goodsMissing > 0 ? "warning" : "success"} />
        <Kpi label="Factory clock" value={statusLabel} sub={order.placed_on ? `Placed ${order.placed_on}` : "Not placed yet"} icon={Activity} />
      </div>

      <div className="vy-kicker text-[11px]">Scope &amp; cost</div>

      {/* Production lines */}
      <ProductionLines order={order} groups={groups} landedById={landedById} totalUnits={roll.totalUnits} totalGoods={roll.totalGoods} variants={variants} />

      {/* Non-product costs */}
      <NonProductCosts order={order} costs={costs} chargeTypes={chargeTypes} />
    </div>
  );
}

function ProductionLines({ order, groups, landedById, totalUnits, totalGoods, variants }: {
  order: OrderRow; groups: { name: string; lines: ProdLine[] }[];
  landedById: Map<string, { line: number; landedUnit: number }>; totalUnits: number; totalGoods: number; variants: VariantOpt[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const onDelete = (id: string) => start(async () => { await deleteOrderLine(id, order.id); router.refresh(); });

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-primary/12 text-primary"><Package className="h-4 w-4" /></span><div><div className="font-semibold">Production lines</div><p className="text-[11px] text-muted-foreground">Sellable SKUs and variants included in this factory commitment.</p></div></div>
        <button onClick={() => setAdding(true)} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add SKU</button>
      </div>
      {groups.length === 0 ? (
        <div className="border-t px-5 py-10 text-center text-sm text-muted-foreground">No SKUs yet — add the products in this factory commitment.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-y bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Unit ¥ ref</th>
                <th className="px-3 py-2 text-right font-medium">Unit $ invoice</th>
                <th className="px-3 py-2 text-right font-medium">Line $</th>
                <th className="px-3 py-2 text-right font-medium">Est landed / u</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            {groups.map((g, gi) => (
              <tbody key={gi} className="divide-y border-b">
                <tr className="bg-primary/5"><td colSpan={7} className="px-5 py-2 text-[12px] font-semibold">{g.name} <span className="font-normal text-muted-foreground">· {g.lines.length} {g.lines.length === 1 ? "variant" : "variants"}</span></td></tr>
                {g.lines.map((l) => {
                  const d = landedById.get(l.id);
                  return (
                    <tr key={l.id}>
                      <td className="px-5 py-2.5 font-mono text-[12px] font-semibold">{l.sku}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono">{num(l.qty)}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono text-muted-foreground">{l.unit_cny_ref != null ? `¥${Number(l.unit_cny_ref).toFixed(2)}` : "—"}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono">{money(l.unit_cost)}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono font-semibold">{money(d?.line ?? 0)}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono text-info">{d ? `${money(d.landedUnit)} est` : "—"}</td>
                      <td className="px-3 py-2.5 text-right"><button onClick={() => onDelete(l.id)} disabled={pending} className="vy-icon-btn" aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-danger" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-5 py-3">Product subtotal</td>
                <td className="tabular px-3 py-3 text-right font-mono">{num(totalUnits)}</td>
                <td colSpan={2} />
                <td className="tabular px-3 py-3 text-right font-mono">{money(totalGoods)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="px-5 py-3 text-[11px] text-muted-foreground">Line $ = qty × unit $ invoice. Est landed/u spreads non‑product costs over units (duties excluded — estimate).</p>
      {adding && <AddSkuModal orderId={order.id} variants={variants} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function AddSkuModal({ orderId, variants, onClose }: { orderId: string; variants: VariantOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [variantId, setVariantId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => { const r = await addOrderLine(orderId, fd); if (!r.ok) { setErr(r.error); return; } onClose(); router.refresh(); });
  }
  return (
    <Modal open onClose={onClose} title="Add SKU">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Variant"><Select name="variant_id" value={variantId} onChange={setVariantId} placeholder="Pick a SKU…" searchable options={variants.map((v) => ({ value: v.id, label: v.sku, sub: v.name }))} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Quantity"><input name="qty" type="number" required className={inputCls} placeholder="500" /></Field>
          <Field label="Unit ¥ ref"><input name="unit_cny_ref" type="number" step="0.01" className={inputCls} placeholder="56.75" /></Field>
          <Field label="Unit $ invoice"><input name="unit_cost" type="number" step="0.01" className={inputCls} placeholder="(variant cost)" /></Field>
        </div>
        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending}>{pending ? "Adding…" : "Add SKU"}</PrimaryButton></div>
      </form>
    </Modal>
  );
}

function NonProductCosts({ order, costs, chargeTypes }: { order: OrderRow; costs: OrderCostRow[]; chargeTypes: ChargeTypeOpt[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const total = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const onDelete = (id: string) => start(async () => { await deleteOrderCost(id, order.id); router.refresh(); });

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2.5"><span className="inline-grid h-7 w-7 place-items-center rounded-md bg-warning/12 text-warning"><DollarSign className="h-4 w-4" /></span><div><div className="font-semibold">Non-product costs</div><p className="text-[11px] text-muted-foreground">Service fees, packaging, freight, and other charges bundled into production or the agent CI.</p></div></div>
        <button onClick={() => setAdding(true)} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add cost</button>
      </div>
      {costs.length === 0 ? (
        <div className="border-t px-5 py-10 text-center text-sm text-muted-foreground">No non-product costs yet — add agent fees, packaging, freight or inspection.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Section</th>
                <th className="px-3 py-2 font-medium">Line type</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {costs.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-2.5 font-medium">{c.description}</td>
                  <td className="px-3 py-2.5"><Badge tone={(SECTION_TONE[c.section] ?? "muted") as "brand" | "info" | "success" | "muted"}>{c.section}</Badge></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.line_type ?? "—"}</td>
                  <td className="tabular px-3 py-2.5 text-right font-mono text-muted-foreground">{num(c.qty)}</td>
                  <td className="tabular px-3 py-2.5 text-right font-mono font-semibold">{money(c.amount)}</td>
                  <td className="px-3 py-2.5">{c.coverage === "Uncovered" ? <span className="text-[12px] text-muted-foreground">Uncovered</span> : <span className="font-mono text-[11px] text-success">{c.coverage}</span>}</td>
                  <td className="px-3 py-2.5 text-right"><button onClick={() => onDelete(c.id)} disabled={pending} className="vy-icon-btn" aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-danger" /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold"><td className="px-5 py-3" colSpan={4}>Total non-product costs</td><td className="tabular px-3 py-3 text-right font-mono">{money(total)}</td><td colSpan={2} /></tr>
            </tfoot>
          </table>
        </div>
      )}
      {adding && <AddCostModal orderId={order.id} chargeTypes={chargeTypes} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function AddCostModal({ orderId, chargeTypes, onClose }: { orderId: string; chargeTypes: ChargeTypeOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [section, setSection] = useState<string>("Production");
  const [lineType, setLineType] = useState<string>("Agent fee");
  const [basis, setBasis] = useState<string>("value");
  const [chargeTypeId, setChargeTypeId] = useState<string>("");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => { const r = await addOrderCost(orderId, fd); if (!r.ok) { setErr(r.error); return; } onClose(); router.refresh(); });
  }
  return (
    <Modal open onClose={onClose} title="Add non-product cost">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Description"><input name="description" required autoFocus className={inputCls} placeholder="Agent service fee 5%" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Section"><Select name="section" value={section} onChange={setSection} options={PROD_SECTIONS.map((s) => ({ value: s, label: s }))} /></Field>
          <Field label="Line type"><Select name="line_type" value={lineType} onChange={setLineType} options={PROD_LINE_TYPES.map((t) => ({ value: t, label: t }))} /></Field>
          <Field label="Qty"><input name="qty" type="number" step="0.01" defaultValue="1" className={inputCls} /></Field>
          <Field label="Amount (USD)"><input name="amount" type="number" step="0.01" required className={inputCls} placeholder="0.00" /></Field>
          <Field label="Landed basis"><Select name="basis" value={basis} onChange={setBasis} options={PROD_BASES.map((b) => ({ value: b, label: b === "value" ? "By value" : "By units" }))} /></Field>
          <Field label="Charge type (optional)"><Select name="charge_type_id" value={chargeTypeId} onChange={setChargeTypeId} placeholder="— none —" options={[{ value: "", label: "— none —" }, ...chargeTypes.map((c) => ({ value: c.id, label: c.label, sub: c.owner !== "—" ? c.owner : undefined }))]} /></Field>
        </div>
        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending}>{pending ? "Adding…" : "Add cost"}</PrimaryButton></div>
      </form>
    </Modal>
  );
}
