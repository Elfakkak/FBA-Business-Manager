"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  money, num, productionLanded, costUsd, PROD_SECTIONS, PROD_LINE_TYPES,
  ORDER_STATUS_LABEL, type OrderRow, type OrderCostRow,
} from "@/lib/derive";
import { addOrderLines, deleteOrderLine, addOrderCost, deleteOrderCost } from "../actions";
import {
  Package, Activity, ClipboardCheck, FileText, Plus, Trash2, DollarSign,
} from "lucide-react";

type ProdLine = { id: string; sku: string | null; product_name: string | null; family_id: string | null; qty: number; unit_cost: number | null; unit_cny_ref: number | null };
export type CatalogVariant = { id: string; sku: string; name: string; pack: string | null; familyName: string; last_cost_usd: number | null; last_cost_rmb: number | null; has_image: boolean; fba_stock: number | null; reorder_point: number | null; status: string | null };
type ChargeTypeOpt = { id: string; label: string; owner: string };
type VendorOpt = { name: string; type: string };

const SECTION_TONE: Record<string, string> = { Production: "brand", Shipping: "info", Inspection: "warning" };
const fmtAmt = (amount: number | null, currency: string) => `${currency === "CNY" ? "¥" : "$"}${(Number(amount) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ProductionSection({ order, lines, costs, variants, chargeTypes, vendors }: {
  order: OrderRow; lines: ProdLine[]; costs: OrderCostRow[]; variants: CatalogVariant[]; chargeTypes: ChargeTypeOpt[]; vendors: VendorOpt[];
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
      <NonProductCosts order={order} costs={costs} chargeTypes={chargeTypes} vendors={vendors} />
    </div>
  );
}

function ProductionLines({ order, groups, landedById, totalUnits, totalGoods, variants }: {
  order: OrderRow; groups: { name: string; lines: ProdLine[] }[];
  landedById: Map<string, { line: number; landedUnit: number }>; totalUnits: number; totalGoods: number; variants: CatalogVariant[];
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

const SKU_FILTERS = ["All", "Reorder needed", "Missing cost", "Missing image"];

// Multi-select catalog browser — tick variants, set quantities, batch-add as lines.
function AddSkuModal({ orderId, variants, onClose }: { orderId: string; variants: CatalogVariant[]; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [sel, setSel] = useState<Map<string, number>>(new Map()); // variantId -> qty

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const matchesFilter = (v: CatalogVariant) => {
    if (filter === "Reorder needed") return v.reorder_point != null && (v.fba_stock ?? 0) <= v.reorder_point;
    if (filter === "Missing cost") return v.last_cost_usd == null;
    if (filter === "Missing image") return !v.has_image;
    return true;
  };
  const n = q.trim().toLowerCase();
  const filtered = variants.filter((v) => matchesFilter(v) && (!n || `${v.sku} ${v.name} ${v.familyName}`.toLowerCase().includes(n)));
  const groups = useMemo(() => {
    const m = new Map<string, CatalogVariant[]>();
    for (const v of filtered) { if (!m.has(v.familyName)) m.set(v.familyName, []); m.get(v.familyName)!.push(v); }
    return [...m.entries()];
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setSel((m) => { const c = new Map(m); if (c.has(id)) c.delete(id); else c.set(id, 0); return c; });
  const setQty = (id: string, qty: number) => setSel((m) => new Map(m).set(id, Math.max(0, Math.round(qty) || 0)));

  const selected = [...sel.entries()].map(([id, qty]) => ({ v: byId.get(id), qty })).filter((x): x is { v: CatalogVariant; qty: number } => !!x.v);
  const totalUnits = selected.reduce((s, x) => s + x.qty, 0);
  const subtotal = selected.reduce((s, x) => s + x.qty * (x.v.last_cost_usd ?? 0), 0);

  function submit() {
    setErr(null);
    const lines = selected.filter((x) => x.qty > 0).map((x) => ({ variant_id: x.v.id, qty: x.qty, unit_cost: x.v.last_cost_usd, unit_cny_ref: x.v.last_cost_rmb }));
    if (!lines.length) { setErr("Select at least one SKU and set a quantity."); return; }
    start(async () => { const r = await addOrderLines(orderId, lines); if (!r.ok) { setErr(r.error); return; } onClose(); router.refresh(); });
  }

  return (
    <Modal open onClose={onClose} title="Add SKUs" size="xl">
      <div className="space-y-3">
        <p className="-mt-1 text-[12px] text-muted-foreground">Select existing catalog variants for this production order. Only ticked rows become order lines.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU, title, family…" className={inputCls} />
        <div className="flex flex-wrap gap-1.5">{SKU_FILTERS.map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={cn("vy-chip", filter === f && "is-active")}>{f}</button>)}</div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* catalog list */}
          <div className="max-h-[46vh] overflow-y-auto rounded-lg border">
            {groups.map(([fam, vs]) => (
              <div key={fam}>
                <div className="sticky top-0 z-10 border-b bg-muted/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">{fam} · {vs.length}</div>
                {vs.map((v) => (
                  <label key={v.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-accent/40">
                    <input type="checkbox" checked={sel.has(v.id)} onChange={() => toggle(v.id)} className="h-4 w-4 accent-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[12px] font-semibold">{v.sku}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{[v.name, v.pack].filter(Boolean).join(" · ")}{!v.has_image && " · no image"}</div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[12px] text-muted-foreground">{v.last_cost_usd != null ? money(v.last_cost_usd) : "no cost"}</div>
                  </label>
                ))}
              </div>
            ))}
            {filtered.length === 0 && <div className="px-3 py-8 text-center text-[12px] text-muted-foreground">No variants match. <span className="text-muted-foreground">Add new ones in Products.</span></div>}
          </div>

          {/* selected lines */}
          <div className="rounded-lg border bg-accent/30 p-3">
            <div className="vy-kicker mb-1.5">Selected lines</div>
            {selected.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-muted-foreground">No SKUs selected. Tick variants on the left and set a quantity.</p>
            ) : (
              <ul className="space-y-1.5">
                {selected.map(({ v, qty }) => (
                  <li key={v.id} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5">
                    <div className="min-w-0 flex-1"><div className="truncate font-mono text-[11px] font-semibold">{v.sku}</div><div className="text-[10px] text-muted-foreground">{v.last_cost_usd != null ? `${money(v.last_cost_usd)} / u` : "no cost"}</div></div>
                    <input type="number" value={qty || ""} onChange={(e) => setQty(v.id, Number(e.target.value))} placeholder="qty" className="w-16 rounded-md border bg-background px-2 py-1 text-right font-mono text-[12px] outline-none focus:ring-2 focus:ring-ring" />
                    <button type="button" onClick={() => toggle(v.id)} className="vy-icon-btn" aria-label="Remove"><Trash2 className="h-3.5 w-3.5 text-danger" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          <div className="text-[12px] text-muted-foreground">{selected.length} SKUs · {num(totalUnits)} units · <span className="font-mono font-semibold text-foreground">{money(subtotal)}</span> subtotal</div>
          <div className="ml-auto flex gap-2">
            <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton type="button" onClick={submit} disabled={pending}>{pending ? "Adding…" : "Add selected lines"}</PrimaryButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function NonProductCosts({ order, costs, chargeTypes, vendors }: { order: OrderRow; costs: OrderCostRow[]; chargeTypes: ChargeTypeOpt[]; vendors: VendorOpt[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const total = costs.reduce((s, c) => s + costUsd(c), 0); // normalized to USD
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
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{c.description}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {c.vendor && <span>{c.vendor}</span>}
                      {c.treatment === "period" && <span className="rounded bg-muted px-1.5 py-0.5 font-medium">Period expense</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><Badge tone={(SECTION_TONE[c.section] ?? "muted") as "brand" | "info" | "success" | "muted"}>{c.section}</Badge></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.line_type ?? "—"}</td>
                  <td className="tabular px-3 py-2.5 text-right font-mono text-muted-foreground">{num(c.qty)}</td>
                  <td className="tabular px-3 py-2.5 text-right font-mono font-semibold">{fmtAmt(c.amount, c.currency)}</td>
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
      {adding && <AddCostModal orderId={order.id} chargeTypes={chargeTypes} vendors={vendors} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function AddCostModal({ orderId, chargeTypes, vendors, onClose }: { orderId: string; chargeTypes: ChargeTypeOpt[]; vendors: VendorOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [currency, setCurrency] = useState<string>("CNY");
  const [vendor, setVendor] = useState<string>("");
  const [coverage, setCoverage] = useState<string>("Uncovered");
  const [treatment, setTreatment] = useState<string>("inventoriable");
  const [basis, setBasis] = useState<string>("units");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [section, setSection] = useState<string>("Production");
  const [lineType, setLineType] = useState<string>("Other");
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
        <p className="-mt-1 text-[12px] text-muted-foreground">Tooling, samples, packaging, setup — anything that isn&apos;t a product line.</p>

        <Field label="Description"><input name="description" required autoFocus className={inputCls} placeholder={`e.g. "Tooling for 18\\" mold revision"`} /></Field>

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Amount"><input name="amount" type="number" step="0.01" required className={inputCls} placeholder="0.00" /></Field>
          <Field label="Currency"><Select name="currency" value={currency} onChange={setCurrency} options={[{ value: "CNY", label: "CNY" }, { value: "USD", label: "USD" }]} /></Field>
        </div>

        <Field label="Vendor / payee"><Select name="vendor" value={vendor} onChange={setVendor} placeholder="Select vendor…" searchable options={vendors.map((v) => ({ value: v.name, label: v.name, sub: v.type }))} /></Field>

        <Field label="Invoice coverage"><Select name="coverage" value={coverage} onChange={setCoverage} options={[{ value: "Uncovered", label: "Uncovered for now" }]} /></Field>

        <div>
          <div className="vy-kicker mb-2">Cost treatment</div>
          <div className="grid grid-cols-2 gap-2">
            {[{ k: "inventoriable", t: "Inventoriable" }, { k: "period", t: "Period expense" }].map((o) => (
              <button key={o.k} type="button" onClick={() => setTreatment(o.k)} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[13px] font-medium", treatment === o.k ? "border-primary bg-primary/5 text-foreground" : "text-muted-foreground hover:border-primary/40")}>
                <span className={cn("grid h-4 w-4 place-items-center rounded-full border-2", treatment === o.k ? "border-primary" : "border-muted-foreground/40")}>{treatment === o.k && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}</span>
                {o.t}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Inventoriable rolls into landed cost. Period expense stays out of COGS.</p>
          <input type="hidden" name="treatment" value={treatment} />
        </div>

        <Field label="Allocation"><Select name="basis" value={basis} onChange={setBasis} options={[{ value: "units", label: "By qty" }, { value: "value", label: "By value" }]} /></Field>

        {/* Add details (collapsible) */}
        <div className="rounded-lg border">
          <button type="button" onClick={() => setDetailsOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
            <span className="text-[13px] font-medium">Add details</span>
            <span className="text-[11px] text-muted-foreground">type · section · qty · notes</span>
          </button>
          {detailsOpen && (
            <div className="space-y-3 border-t p-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Line type"><Select name="line_type" value={lineType} onChange={setLineType} options={PROD_LINE_TYPES.map((t) => ({ value: t, label: t }))} /></Field>
                <Field label="Section"><Select name="section" value={section} onChange={setSection} options={PROD_SECTIONS.map((s) => ({ value: s, label: s }))} /></Field>
                <Field label="Qty"><input name="qty" type="number" step="0.01" defaultValue="1" className={inputCls} /></Field>
                <Field label="Charge type"><Select name="charge_type_id" value={chargeTypeId} onChange={setChargeTypeId} placeholder="— none —" options={[{ value: "", label: "— none —" }, ...chargeTypes.map((c) => ({ value: c.id, label: c.label, sub: c.owner !== "—" ? c.owner : undefined }))]} /></Field>
              </div>
              <Field label="Notes"><input name="notes" className={inputCls} placeholder="Additional notes…" /></Field>
            </div>
          )}
        </div>

        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending}>{pending ? "Adding…" : "Add cost"}</PrimaryButton></div>
      </form>
    </Modal>
  );
}
