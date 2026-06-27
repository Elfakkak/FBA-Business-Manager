"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, KpiStrip, SectionHeader, SectionTitle, EditCell, EditToolbar } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useInlineEditor } from "@/lib/use-inline-editor";
import {
  money, num, productionLanded, costUsd, PROD_SECTIONS, PROD_LINE_TYPES,
  ORDER_STATUS_LABEL, type OrderRow, type OrderCostRow, type CostCheck,
} from "@/lib/derive";
import { addOrderLines, updateOrderLine, deleteOrderLine, addOrderCost, updateOrderCost, deleteOrderCost, saveOrderFile } from "../actions";
import {
  Package, Activity, ClipboardCheck, FileText, Plus, Trash2, DollarSign, ChevronRight, ArrowRight, Check, AlertTriangle, X,
} from "lucide-react";

type ProdLine = { id: string; sku: string | null; product_name: string | null; family_id: string | null; qty: number; unit_cost: number | null; unit_cny_ref: number | null };
export type CatalogVariant = { id: string; sku: string; asin: string | null; name: string; pack: string | null; familyName: string; familyLastOrdered: string | null; last_cost_usd: number | null; last_cost_rmb: number | null; sale_price: number | null; has_image: boolean; fba_stock: number | null; reorder_point: number | null; status: string | null };

// Parse an editable numeric cell → number, or null for blank/non-numeric (never NaN).
const numOrNull = (s: string) => { if (s.trim() === "") return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
type ChargeTypeOpt = { id: string; label: string; owner: string };
type VendorOpt = { name: string; type: string };

const SECTION_TONE: Record<string, string> = { Production: "brand", Shipping: "info", Inspection: "warning" };

type PkgOnHand = { id: string; name: string; kind: string; unitCost: number; onHand: number };
type OrderFile = { slot: string; name: string | null; url: string };

export function ProductionSection({ order, lines, costs, variants, chargeTypes, vendors, companyName, orderFiles, packagingOnHand, costCheck }: {
  order: OrderRow; lines: ProdLine[]; costs: OrderCostRow[]; variants: CatalogVariant[]; chargeTypes: ChargeTypeOpt[]; vendors: VendorOpt[]; companyName: string;
  orderFiles: OrderFile[]; packagingOnHand: PkgOnHand[]; costCheck: CostCheck;
}) {
  const [showPO, setShowPO] = useState(false);
  const roll = useMemo(() => productionLanded(lines, costs), [lines, costs]);
  const landedById = useMemo(() => new Map(roll.withLanded.map((l) => [l.id, l])), [roll]);
  const skuCount = lines.length;
  const goodsMissing = lines.filter((l) => !l.unit_cost).length;
  // readiness = unpriced lines + missing REQUIRED supporting files (WIP/sample photos)
  const haveSlots = new Set(orderFiles.map((f) => f.slot));
  const filesMissing = FILE_SLOTS.filter((s) => s.required && !haveSlots.has(s.slot)).length;
  const readinessGaps = goodsMissing + filesMissing;
  const readinessBits = [goodsMissing > 0 ? `${goodsMissing} unpriced` : null, filesMissing > 0 ? `${filesMissing} file${filesMissing === 1 ? "" : "s"} missing` : null].filter(Boolean).join(" · ");
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
      {/* Header + next action (shared SectionHeader) */}
      <SectionHeader
        title="Production"
        blurb="Factory scope, product lines, charges, readiness, and supplier files."
        badges={<>
          <Badge tone="info">{statusLabel}</Badge>
          <Badge tone="muted">{skuCount} {skuCount === 1 ? "variant" : "variants"}</Badge>
          <Badge tone="muted">{num(roll.totalUnits)} pcs</Badge>
          {goodsMissing > 0 && <Badge tone="warning">{goodsMissing} unpriced</Badge>}
          {filesMissing > 0 && <Badge tone="warning">{filesMissing} file{filesMissing === 1 ? "" : "s"} missing</Badge>}
        </>}
        nextAction={{
          severity: readinessGaps > 0 ? "warning" : undefined,
          headline: readinessGaps > 0 ? "Close readiness gaps" : "Generate the PO",
          detail: readinessGaps > 0
            ? `${readinessBits} — ${goodsMissing > 0 ? "add a last-known reference price (actual comes from the invoice)" : "upload the required files"}, then generate the PO.`
            : "Scope is priced and files are in — ready to generate the purchase order.",
          cta: <button type="button" onClick={() => setShowPO(true)} disabled={lines.length === 0} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5 disabled:opacity-50"><FileText className="h-4 w-4" /> Generate PO</button>,
        }}
      />

      {/* KPIs */}
      <KpiStrip cols={3}>
        <Kpi label="Production scope" value={`${skuCount} ${skuCount === 1 ? "SKU" : "SKUs"}`} sub={`${num(roll.totalUnits)} pcs · ${money(roll.totalGoods)} product cost`} icon={Package} />
        <Kpi label="Readiness" value={readinessGaps > 0 ? `${readinessGaps} missing` : "Ready"} sub={readinessGaps > 0 ? readinessBits : "priced · files in"} icon={ClipboardCheck} tone={readinessGaps > 0 ? "warning" : "success"} />
        <Kpi label="Factory clock" value={statusLabel} sub={order.placed_on ? `Placed ${order.placed_on}` : "Not placed yet"} icon={Activity} />
      </KpiStrip>

      <div className="vy-kicker text-[11px]">Scope &amp; cost</div>

      {/* Production lines */}
      <ProductionLines order={order} groups={groups} landedById={landedById} totalUnits={roll.totalUnits} totalGoods={roll.totalGoods} variants={variants} costCheck={costCheck} />

      {/* Non-product costs */}
      <NonProductCosts order={order} costs={costs} chargeTypes={chargeTypes} vendors={vendors} goodsTotal={roll.totalGoods} />

      {/* Packaging on hand + Purchase order */}
      <PackagingOnHand items={packagingOnHand} />
      <PurchaseOrderCard skuCount={skuCount} totalUnits={roll.totalUnits} totalGoods={roll.totalGoods} onGenerate={() => setShowPO(true)} />

      {/* Supporting files */}
      <div className="vy-kicker text-[11px]">Supporting files</div>
      <ProductionFiles orderId={order.id} files={orderFiles} />

      {showPO && <GeneratePOModal order={order} lines={lines} costs={costs} companyName={companyName} onClose={() => setShowPO(false)} />}
    </div>
  );
}

function PackagingOnHand({ items }: { items: PkgOnHand[] }) {
  // Optional & collapsed by default — packaging is usually bundled in the supplier
  // price; only expand when you supply it separately from your own inventory.
  const [open, setOpen] = useState(false);
  const total = items.reduce((s, i) => s + i.onHand * (i.unitCost ?? 0), 0);
  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 px-5 py-4 text-left">
        <span className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-md bg-info/12 text-info"><Package className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Packaging on hand <span className="text-[11px] font-normal text-muted-foreground">· optional</span></div>
          <p className="text-[11px] text-muted-foreground">{items.length === 0 ? "Only if you supply packaging separately (not bundled in the supplier price)." : `${items.length} item${items.length === 1 ? "" : "s"} · ${money(total)} on hand — orders draw from here.`}</p>
        </div>
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-90")} />
      </button>
      {open && (items.length === 0 ? (
        <div className="border-t px-5 py-8 text-center text-sm text-muted-foreground">No packaging on hand. Add stock on the <Link href="/packaging" className="font-medium text-primary hover:underline">Packaging</Link> page.</div>
      ) : (
        <div className="border-t">
          <div className="flex items-center justify-end border-b px-5 py-2"><Link href="/packaging" className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">Manage <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          <ul className="divide-y">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{i.name}{i.kind ? <span className="font-normal text-muted-foreground"> · {i.kind}</span> : null}</span>
                <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{num(i.onHand)} on hand</span>
                <span className="shrink-0 font-mono text-[13px] font-semibold">{money(i.onHand * (i.unitCost ?? 0))}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-5 py-2.5 text-[13px]"><span className="text-muted-foreground">Total value</span><span className="font-mono font-bold">{money(total)}</span></div>
        </div>
      ))}
    </Card>
  );
}

function PurchaseOrderCard({ skuCount, totalUnits, totalGoods, onGenerate }: { skuCount: number; totalUnits: number; totalGoods: number; onGenerate: () => void }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="px-5 pt-4"><SectionTitle icon={FileText} tone="brand" strong title="Purchase order" sub="Outgoing purchase order sent to supplier. Incoming PIs & invoices are tracked in the Invoices section." /></div>
      <div className="flex flex-wrap items-center gap-3 border-t bg-accent/30 px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><FileText className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">Not generated yet</div>
          <p className="text-[11px] text-muted-foreground">Builds from your scope above — {skuCount} {skuCount === 1 ? "SKU" : "SKUs"} · {num(totalUnits)} pcs · {money(totalGoods)} goods</p>
        </div>
        <button type="button" onClick={onGenerate} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><FileText className="h-4 w-4" /> Generate PO</button>
      </div>
    </Card>
  );
}

const FILE_SLOTS = [
  { slot: "wip_photos", title: "WIP photos", desc: "Work-in-progress photos from the factory floor", required: true },
  { slot: "sample_photos", title: "Sample photos", desc: "Final sample imagery before mass production", required: true },
  { slot: "carton_spec", title: "Carton spec sheet", desc: "Packaging specifications and dimensions" },
  { slot: "packing_list", title: "Packing list template", desc: "Template for shipment packing lists" },
  { slot: "factory_packing_list", title: "Factory master packing list", desc: "Factory's full-order packing doc (whole run, before shipment splits)" },
  { slot: "product_spec", title: "Product spec sheet", desc: "Detailed product specifications" },
  { slot: "factory_audit", title: "Factory audit", desc: "Factory compliance and audit documentation" },
];

function ProductionFiles({ orderId, files }: { orderId: string; files: OrderFile[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);
  const bySlot = new Map(files.map((f) => [f.slot, f]));

  async function upload(slot: string, file: File) {
    setBusy(slot); setUpErr(null);
    const supabase = createClient();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `orders/${orderId}/files/${slot}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("product-media").upload(path, file, { upsert: true });
    if (error) { setUpErr(`Upload failed: ${error.message}`); setBusy(null); return; }
    const url = supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl;
    await saveOrderFile(orderId, slot, url, file.name);
    setBusy(null);
    router.refresh();
  }

  return (
    <Card className="p-5">
      <SectionTitle icon={ClipboardCheck} tone="brand" strong title="Production files" sub="WIP photos, specs, and documentation. Separate from PI/PO attachments." />
      {upErr && <div className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">{upErr}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {FILE_SLOTS.map((s) => {
          const f = bySlot.get(s.slot);
          const uploading = busy === s.slot;
          return (
            <div key={s.slot} className={cn("flex items-start gap-3 rounded-xl border p-3.5", f ? "border-success/40 bg-success/5" : s.required ? "border-warning/40 bg-warning/5" : "")}>
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md", f ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{f ? <Check className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><span className="text-[13px] font-semibold">{s.title}</span>{s.required && !f && <Badge tone="warning">Required</Badge>}</div>
                <p className="text-[11px] text-muted-foreground">{s.desc}</p>
                {f ? <a href={f.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-success hover:underline"><Check className="h-3 w-3" /> {f.name ?? "file"}</a> : null}
              </div>
              {f ? (
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[12px] font-medium text-primary hover:underline">View</a>
              ) : (
                <label className="shrink-0 cursor-pointer">
                  <span className="vy-icon-btn">{uploading ? <span className="text-[11px]">…</span> : <Plus className="h-4 w-4" />}</span>
                  <input type="file" hidden disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(s.slot, file); }} />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Generate PO — pick which lines + costs to include, then open a print-ready PO.
function GeneratePOModal({ order, lines, costs, companyName, onClose }: {
  order: OrderRow; lines: ProdLine[]; costs: OrderCostRow[]; companyName: string; onClose: () => void;
}) {
  const [selL, setSelL] = useState<Set<string>>(() => new Set(lines.map((l) => l.id)));
  const [selC, setSelC] = useState<Set<string>>(() => new Set(costs.map((c) => c.id)));
  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => set((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const prodLines = lines.filter((l) => selL.has(l.id)).map((l) => ({ ...l, line: (Number(l.qty) || 0) * (Number(l.unit_cost) || 0) }));
  const prodSub = prodLines.reduce((s, l) => s + l.line, 0);
  const costLines = costs.filter((c) => selC.has(c.id));
  const costSub = costLines.reduce((s, c) => s + costUsd(c), 0);
  const total = prodSub + costSub;

  function generate() {
    const rows = prodLines.map((l) => `<tr><td style="font-family:monospace">${l.sku ?? ""}</td><td>${l.product_name ?? ""}</td><td style="text-align:right">${num(l.qty)}</td><td style="text-align:right">${money(l.unit_cost)}</td><td style="text-align:right">${money(l.line)}</td></tr>`).join("");
    const crows = costLines.map((c) => `<tr><td colspan="4">${c.description}${c.line_type ? ` · ${c.line_type}` : ""}</td><td style="text-align:right">${money(costUsd(c))}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>PO ${order.id}</title>
      <style>body{font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;max-width:760px;margin:32px auto;padding:0 24px}h1{font-size:22px;margin:0}h2{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#888;margin:24px 0 8px}table{width:100%;border-collapse:collapse}th,td{padding:8px 10px;border-bottom:1px solid #eee;text-align:left}th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888}tfoot td{font-weight:700;border-top:2px solid #333;border-bottom:none}.muted{color:#888}.total{font-size:18px;font-weight:700;color:#d2691e}@media print{body{margin:0}}</style></head>
      <body>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div><h1>Purchase Order</h1><div class="muted">${order.id}${order.placed_on ? " · " + order.placed_on : ""}</div></div>
          <div style="text-align:right"><div style="font-weight:700">${companyName}</div></div>
        </div>
        <h2>Addressed to</h2><div>${order.supplier ?? order.agent ?? "Supplier"} · factory</div>
        <h2>Products</h2>
        <table><thead><tr><th>SKU</th><th>Variant</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Line total</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" class="muted">No products selected</td></tr>`}</tbody>
        <tfoot><tr><td colspan="4">Products subtotal</td><td style="text-align:right">${money(prodSub)}</td></tr></tfoot></table>
        ${costLines.length ? `<h2>Non-product costs</h2><table><tbody>${crows}</tbody><tfoot><tr><td colspan="4">Costs subtotal</td><td style="text-align:right">${money(costSub)}</td></tr></tfoot></table>` : ""}
        <h2>Total</h2><div class="total">${money(total)}</div>
        <p class="muted" style="margin-top:32px;font-size:11px">Generated by ${companyName} · ${order.title}</p>
        <script>window.onload=function(){window.print()}</script>
      </body></html>`;
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return;
    w.document.write(html); w.document.close();
  }

  return (
    <Modal open onClose={onClose} title="Generate PO" size="lg">
      <div className="space-y-4">
        <p className="-mt-1 text-[12px] text-muted-foreground">Pick what to include. We&apos;ll build the printable PO with your company info.</p>
        <div className="rounded-lg border bg-accent/40 px-3 py-2 text-[13px]"><span className="font-semibold">Addressed to:</span> {order.supplier ?? order.agent ?? "Supplier"} · factory</div>

        <div>
          <div className="vy-kicker mb-1.5">Products</div>
          <div className="overflow-hidden rounded-lg border">
            {lines.length === 0 ? <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">No product lines.</p> : lines.map((l) => {
              const line = (Number(l.qty) || 0) * (Number(l.unit_cost) || 0);
              return (
                <label key={l.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
                  <input type="checkbox" checked={selL.has(l.id)} onChange={() => toggle(setSelL, l.id)} className="h-4 w-4 accent-primary" />
                  <span className="w-32 shrink-0 font-mono text-[12px] font-semibold">{l.sku}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{l.product_name}</span>
                  <span className="w-12 text-right font-mono text-[12px]">{num(l.qty)}</span>
                  <span className="w-20 text-right font-mono text-[12px] font-semibold">{money(line)}</span>
                </label>
              );
            })}
            <div className="flex items-center justify-between bg-muted/40 px-3 py-2 text-[12px] font-semibold"><span>Subtotal</span><span className="font-mono">{money(prodSub)}</span></div>
          </div>
        </div>

        {costs.length > 0 && (
          <div>
            <div className="vy-kicker mb-1.5">Non-product costs</div>
            <div className="overflow-hidden rounded-lg border">
              {costs.map((c) => (
                <label key={c.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
                  <input type="checkbox" checked={selC.has(c.id)} onChange={() => toggle(setSelC, c.id)} className="h-4 w-4 accent-primary" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{c.description}</span>
                  <span className="font-mono text-[12px] font-semibold">{money(costUsd(c))}</span>
                </label>
              ))}
              <div className="flex items-center justify-between bg-muted/40 px-3 py-2 text-[12px] font-semibold"><span>Subtotal</span><span className="font-mono">{money(costSub)}</span></div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          <div className="text-[13px]"><span className="text-muted-foreground">Total:</span> <span className="font-mono text-base font-bold text-primary">{money(total)}</span></div>
          <div className="ml-auto flex gap-2">
            <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton type="button" onClick={generate} className="inline-flex items-center gap-1.5"><FileText className="h-4 w-4" /> Generate PDF</PrimaryButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ProductionLines({ order, groups, landedById, totalUnits, totalGoods, variants, costCheck }: {
  order: OrderRow; groups: { name: string; lines: ProdLine[] }[];
  landedById: Map<string, { line: number; landedUnit: number }>; totalUnits: number; totalGoods: number; variants: CatalogVariant[]; costCheck: CostCheck;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const allLines = groups.flatMap((g) => g.lines);
  const onDelete = (id: string) => start(async () => { await deleteOrderLine(id, order.id); router.refresh(); });

  // Shared inline-edit controller (same primitive used across the app).
  const ed = useInlineEditor(
    allLines,
    (l) => ({ qty: String(l.qty ?? 0), unit_cost: l.unit_cost == null ? "" : String(l.unit_cost), unit_cny_ref: l.unit_cny_ref == null ? "" : String(l.unit_cny_ref) }),
    (id, f) => updateOrderLine(id, order.id, { qty: Math.max(0, Math.round(Number(f.qty) || 0)), unit_cost: numOrNull(f.unit_cost), unit_cny_ref: numOrNull(f.unit_cny_ref) }),
    () => router.refresh(),
  );
  const liveUnits = ed.on ? allLines.reduce((s, l) => s + (Number(ed.get(l.id, "qty")) || 0), 0) : totalUnits;
  const liveGoods = ed.on ? allLines.reduce((s, l) => s + (Number(ed.get(l.id, "qty")) || 0) * (Number(ed.get(l.id, "unit_cost")) || 0), 0) : totalGoods;

  return (
    <Card className="overflow-hidden p-0">
      <div className="px-5 pt-4"><SectionTitle icon={Package} tone="brand" strong title="Production lines" sub={ed.on ? "Editing — change quantities or unit cost; totals update live." : "Sellable SKUs and variants included in this factory commitment."}
        action={<EditToolbar editor={ed} editable={allLines.length > 0} addLabel="Add SKU" onAdd={() => setAdding(true)} />} /></div>
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
                  const line = ed.on ? (Number(ed.get(l.id, "qty")) || 0) * (Number(ed.get(l.id, "unit_cost")) || 0) : (d?.line ?? 0);
                  return (
                    <tr key={l.id}>
                      <td className="px-5 py-2.5 font-mono text-[12px] font-semibold">{l.sku}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{ed.on ? <div className="ml-auto w-20"><EditCell value={ed.get(l.id, "qty")} onChange={(v) => ed.set(l.id, "qty", v)} mode="numeric" /></div> : <span className="tabular">{num(l.qty)}</span>}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{ed.on ? <div className="ml-auto w-20"><EditCell value={ed.get(l.id, "unit_cny_ref")} onChange={(v) => ed.set(l.id, "unit_cny_ref", v)} placeholder="¥" /></div> : <span className="tabular">{l.unit_cny_ref != null ? `¥${Number(l.unit_cny_ref).toFixed(2)}` : "—"}</span>}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{ed.on ? <div className="ml-auto w-20"><EditCell value={ed.get(l.id, "unit_cost")} onChange={(v) => ed.set(l.id, "unit_cost", v)} placeholder="$" /></div> : (() => { const cc = l.sku ? costCheck.bySku.get(l.sku) : undefined; const diff = cc?.invUnit != null ? cc.invUnit - (Number(l.unit_cost) || 0) : null; return <div><span className="tabular">{money(l.unit_cost)}</span>{cc?.invUnit != null && <div className={cn("text-[10px]", diff != null && Math.abs(diff) > 0.01 ? "text-warning" : "text-success")} title="Invoiced unit price (actual)">inv {money(cc.invUnit)}{diff != null && Math.abs(diff) > 0.01 ? ` (${diff > 0 ? "+" : ""}${money(diff)})` : " ✓"}</div>}</div>; })()}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono font-semibold">{money(line)}</td>
                      <td className="tabular px-3 py-2.5 text-right font-mono text-info">{!ed.on && d ? `${money(d.landedUnit)} est` : "—"}</td>
                      <td className="px-3 py-2.5 text-right">{!ed.on && <button onClick={() => onDelete(l.id)} disabled={pending} className="vy-icon-btn" aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-danger" /></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-5 py-3">Product subtotal</td>
                <td className="tabular px-3 py-3 text-right font-mono">{num(liveUnits)}</td>
                <td colSpan={2} />
                <td className="tabular px-3 py-3 text-right font-mono">{money(liveGoods)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="px-5 py-3 text-[11px] text-muted-foreground">Prices are last‑known references seeded from the catalog (editable) — the <span className="font-medium">actual</span> price is recorded on the invoice. Line $ = qty × unit $ invoice. Est landed/u spreads non‑product costs over units (duties excluded — estimate).</p>
      {adding && <AddSkuModal orderId={order.id} variants={variants} inOrderSkus={new Set(allLines.map((l) => l.sku).filter((s): s is string => !!s))} onClose={() => setAdding(false)} />}
    </Card>
  );
}

const SKU_FILTERS = ["All", "Reorder needed", "Missing cost", "Missing image", "Recently ordered"];
type SkuPick = { qty: number; unit_cost: number | null; unit_cny: number | null };
const skuStatusTone = (s: string | null): "success" | "warning" | "muted" => (!s ? "muted" : /ready/i.test(s) ? "success" : "warning");
const rmb = (v: number | null) => (v == null ? "—" : `¥${Number(v).toFixed(2)}`);
const decOrNull = (s: string) => { const t = s.replace(",", ".").trim(); if (t === "") return null; const n = Number(t); return Number.isFinite(n) ? n : null; };

// One catalog variant row inside an expanded family card — a compact CSS grid.
function SkuRow({ v, on, inOrder, showCny, onToggle }: { v: CatalogVariant; on: boolean; inOrder: boolean; showCny: boolean; onToggle: () => void }) {
  const missingImg = !v.has_image;
  const cols = showCny ? "grid-cols-[24px_36px_140px_minmax(0,1fr)_auto_auto_auto_auto]" : "grid-cols-[24px_36px_140px_minmax(0,1fr)_auto_auto_auto]";
  return (
    <div
      onClick={inOrder ? undefined : onToggle}
      className={cn("grid items-center gap-2.5 px-3 py-2.5 text-[11.5px]", cols,
        inOrder ? "cursor-not-allowed bg-muted/40 opacity-55" : "cursor-pointer hover:bg-accent/40",
        on && !inOrder && "border-l-[3px] border-l-primary bg-primary/10")}
    >
      <input type="checkbox" checked={on || inOrder} disabled={inOrder} onChange={onToggle} onClick={(e) => e.stopPropagation()} className="h-[17px] w-[17px] accent-primary" />
      <span className={cn("grid h-9 w-9 place-items-center rounded-md border", missingImg ? "border-warning/40 bg-warning/10 text-warning" : "border-border bg-accent text-muted-foreground")}>{missingImg ? <AlertTriangle className="h-4 w-4" /> : <Package className="h-4 w-4" />}</span>
      <span className={cn("min-w-0 font-mono leading-tight", on && !inOrder && "text-primary")}>
        <span className="block truncate text-[10.5px] font-bold">{v.sku}</span>
        <span className={cn("block truncate text-[9.5px]", v.asin ? "text-muted-foreground" : "text-warning")}>{v.asin || "Not linked"}</span>
      </span>
      <span className="min-w-0 truncate font-medium">{[v.name, v.pack].filter(Boolean).join(" · ")}</span>
      <span className="text-right text-[10.5px] text-muted-foreground">{v.asin ? `${num(v.fba_stock ?? 0)} FBA` : "no inv."}</span>
      <span className="text-right font-mono font-bold">{v.last_cost_usd != null ? money(v.last_cost_usd) : "—"}</span>
      {showCny && <span className="text-right font-mono text-[10.5px] text-muted-foreground">{rmb(v.last_cost_rmb)}</span>}
      <span className="justify-self-end">{inOrder ? <Badge tone="muted">In order</Badge> : <Badge tone={skuStatusTone(v.status)}>{v.status ?? "—"}</Badge>}</span>
    </div>
  );
}

// A collapsible product-family card with its variant rows (catalog browser).
function SkuFamilyCard({ fam, vs, isOpen, selCount, sel, inOrderSkus, showCny, onToggleOpen, onSelectAll, onToggleVariant }: {
  fam: string; vs: CatalogVariant[]; isOpen: boolean; selCount: number; sel: Map<string, SkuPick>; inOrderSkus: Set<string>; showCny: boolean;
  onToggleOpen: () => void; onSelectAll: () => void; onToggleVariant: (v: CatalogVariant) => void;
}) {
  const hasSel = selCount > 0;
  const allSel = selCount === vs.length && vs.length > 0;
  const lastOrdered = vs[0]?.familyLastOrdered;
  return (
    <div className="space-y-2">
      <div className={cn("flex items-start gap-3 rounded-lg border border-l-[3px] bg-card px-3.5 py-3 shadow-sm", hasSel ? "border-primary/60 border-l-primary" : "border-l-border")}>
        <button type="button" onClick={onToggleOpen} className="min-w-0 flex-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-semibold leading-snug">{fam}</span>{hasSel && <span className="text-[11px] font-medium text-primary">({selCount} of {vs.length} selected)</span>}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{vs.length} {vs.length === 1 ? "variant" : "variants"} · factory{lastOrdered ? ` · last ordered ${lastOrdered}` : ""}</div>
          <span className="mt-1.5 inline-flex"><Badge tone="muted">Imported</Badge></span>
        </button>
        {isOpen && vs.length > 1 && <button type="button" onClick={onSelectAll} className="vy-btn vy-btn--ghost vy-btn--sm shrink-0">{allSel ? "Deselect all" : "Select all"}</button>}
        <button type="button" onClick={onToggleOpen} className="vy-icon-btn shrink-0" aria-label="Toggle"><ChevronRight className={cn("h-4 w-4 transition", isOpen && "rotate-90")} /></button>
      </div>
      {isOpen && <div className="divide-y overflow-hidden rounded-lg border">{vs.map((v) => <SkuRow key={v.id} v={v} on={sel.has(v.id)} inOrder={!!v.sku && inOrderSkus.has(v.sku)} showCny={showCny} onToggle={() => onToggleVariant(v)} />)}</div>}
    </div>
  );
}

// Empty state for the Selected-lines panel — communicates the no-side-effects guarantee.
function EmptySelected() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground"><Package className="h-5 w-5" /></span>
      <div><div className="text-[13px] font-semibold">No SKUs selected</div><p className="mt-0.5 max-w-[28ch] text-[11px] text-muted-foreground">Tick variants on the left — only selected rows become order lines.</p></div>
      <div className="w-full rounded-lg border bg-card p-3 text-left text-[11px]">
        <div className="font-semibold text-foreground">This action creates:</div>
        <div className="mt-1 flex items-center gap-1.5 text-success"><Check className="h-3.5 w-3.5 shrink-0" /> Order line items</div>
        <div className="mt-2.5 font-semibold text-foreground">Does not create:</div>
        {["Invoices", "Shipments", "Catalog products"].map((t) => (
          <div key={t} className="mt-1 flex items-center gap-1.5 text-muted-foreground"><X className="h-3.5 w-3.5 shrink-0" /> {t}</div>
        ))}
      </div>
    </div>
  );
}

// Multi-select catalog browser — split-pane: catalog (68%) + selected lines (32%).
function AddSkuModal({ orderId, variants, inOrderSkus, onClose }: { orderId: string; variants: CatalogVariant[]; inOrderSkus: Set<string>; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [sel, setSel] = useState<Map<string, SkuPick>>(new Map());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showCny, setShowCny] = useState(false); // ¥ reference is optional — hidden unless toggled

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const matchesFilter = (v: CatalogVariant) => {
    if (filter === "Reorder needed") return v.reorder_point != null && (v.fba_stock ?? 0) <= v.reorder_point;
    if (filter === "Missing cost") return v.last_cost_usd == null;
    if (filter === "Missing image") return !v.has_image;
    if (filter === "Recently ordered") return !!v.familyLastOrdered;
    return true;
  };
  const n = q.trim().toLowerCase();
  const filtered = variants.filter((v) => matchesFilter(v) && (!n || `${v.sku} ${v.name} ${v.familyName}`.toLowerCase().includes(n)));
  const groups = useMemo(() => {
    const m = new Map<string, CatalogVariant[]>();
    for (const v of filtered) { if (!m.has(v.familyName)) m.set(v.familyName, []); m.get(v.familyName)!.push(v); }
    return [...m.entries()];
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const mkPick = (v: CatalogVariant): SkuPick => ({ qty: 100, unit_cost: v.last_cost_usd, unit_cny: v.last_cost_rmb });
  const toggle = (v: CatalogVariant) => setSel((m) => { const c = new Map(m); if (c.has(v.id)) c.delete(v.id); else c.set(v.id, mkPick(v)); return c; });
  const setField = (id: string, patch: Partial<SkuPick>) => setSel((m) => { const cur = m.get(id); if (!cur) return m; return new Map(m).set(id, { ...cur, ...patch }); });
  const toggleOpen = (fam: string) => setOpen((s) => { const c = new Set(s); if (c.has(fam)) c.delete(fam); else c.add(fam); return c; });
  const setFamily = (vs: CatalogVariant[], on: boolean) => setSel((m) => { const c = new Map(m); for (const v of vs) { if (v.sku && inOrderSkus.has(v.sku)) continue; if (on) { if (!c.has(v.id)) c.set(v.id, mkPick(v)); } else c.delete(v.id); } return c; });

  const selected = [...sel.entries()].map(([id, p]) => ({ v: byId.get(id), p })).filter((x): x is { v: CatalogVariant; p: SkuPick } => !!x.v);
  const totalUnits = selected.reduce((s, x) => s + x.p.qty, 0);
  const subtotal = selected.reduce((s, x) => s + x.p.qty * (x.p.unit_cost ?? 0), 0);
  const needsReview = selected.some((x) => !x.v.has_image || x.p.unit_cost == null || skuStatusTone(x.v.status) === "warning");
  const canSubmit = selected.length > 0 && selected.every((x) => x.p.qty > 0 && (x.p.unit_cost ?? 0) > 0);

  function submit() {
    setErr(null);
    const lines = selected.filter((x) => x.p.qty > 0).map((x) => ({ variant_id: x.v.id, qty: x.p.qty, unit_cost: x.p.unit_cost, unit_cny_ref: x.p.unit_cny }));
    if (!lines.length) { setErr("Select at least one SKU and set a quantity."); return; }
    start(async () => { const r = await addOrderLines(orderId, lines); if (!r.ok) { setErr(r.error); return; } onClose(); router.refresh(); });
  }

  return (
    <Modal open onClose={onClose} title="Add SKUs" subtitle="Select existing catalog variants for this production order." size="2xl" unpadded
      footer={<div className="flex flex-wrap items-center gap-3">
        <div className="text-[12px] text-muted-foreground">{selected.length} SKUs · {num(totalUnits)} units · <span className="font-mono font-semibold text-foreground">{money(subtotal)}</span> subtotal</div>
        <div className="ml-auto flex gap-2">
          <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="button" onClick={submit} disabled={pending || !canSubmit}>{pending ? "Adding…" : "Add selected lines"}</PrimaryButton>
        </div>
      </div>}
    >
      <div className="flex min-h-0 w-full flex-1">
        {/* LEFT — catalog (68%) */}
        <div className="flex min-h-0 min-w-0 flex-[0_0_68%] flex-col border-r bg-muted/40">
          <div className="shrink-0 space-y-2.5 border-b p-4">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU, title, ASIN, family, supplier" className={inputCls} />
            <div className="flex flex-wrap gap-1.5">{SKU_FILTERS.map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={cn("vy-chip", filter === f && "is-active")}>{f}</button>)}</div>
            <div className="rounded-lg px-3 py-2 text-[11px] text-muted-foreground" style={{ background: "hsl(var(--accent))" }}>Add SKUs creates order lines only. Catalog products, invoices, payments, shipments, and service charges stay in their own sections.</div>
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
            {groups.map(([fam, vs]) => {
              const selCount = vs.filter((v) => sel.has(v.id)).length;
              return (
                <SkuFamilyCard key={fam} fam={fam} vs={vs} isOpen={open.has(fam)} selCount={selCount} sel={sel} inOrderSkus={inOrderSkus} showCny={showCny}
                  onToggleOpen={() => toggleOpen(fam)} onSelectAll={() => setFamily(vs, selCount !== vs.length)} onToggleVariant={toggle} />
              );
            })}
            {filtered.length === 0 && <div className="rounded-lg border px-3 py-8 text-center text-[12px] text-muted-foreground">No variants match. Add new ones in Products.</div>}
          </div>
        </div>

        {/* RIGHT — selected lines (32%), always visible */}
        <div className="flex min-h-0 min-w-0 flex-[0_0_32%] flex-col" style={{ background: "hsl(var(--accent))" }}>
          <div className="shrink-0 border-b px-4 py-3.5">
            <div className="flex items-start justify-between gap-2">
              <div><div className="text-[14px] font-bold">Selected lines</div><p className="text-[11px] text-muted-foreground">Review quantities and pricing before adding</p></div>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground"><input type="checkbox" checked={showCny} onChange={(e) => setShowCny(e.target.checked)} className="h-3.5 w-3.5 accent-primary" /> ¥ ref</label>
            </div>
            {needsReview && <div className="mt-2 rounded-md border px-2.5 py-1.5 text-[11px] text-warning" style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.3)" }}>Needs review: missing images, titles, or costs</div>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {selected.length === 0 ? <EmptySelected /> : (
              <div className="space-y-3">
                {selected.map(({ v, p }) => (
                  <div key={v.id} className="rounded-lg border bg-card p-3.5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-accent text-muted-foreground"><Package className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[12px] font-semibold">{v.sku}</div>
                        <div className="truncate text-[11px] text-muted-foreground" title={[v.familyName, v.name, v.pack].filter(Boolean).join(" · ")}>{[v.familyName, v.name, v.pack].filter(Boolean).join(" · ")}</div>
                        {skuStatusTone(v.status) === "warning" && <div className="mt-0.5 text-[10px] text-warning">{v.status}</div>}
                      </div>
                      <button type="button" onClick={() => toggle(v)} className="vy-icon-btn shrink-0" aria-label="Remove"><Trash2 className="h-3.5 w-3.5 text-danger" /></button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <label className="block"><span className="vy-kicker mb-1 block">Qty</span><input type="number" value={p.qty || ""} onChange={(e) => setField(v.id, { qty: Math.max(0, Math.round(decOrNull(e.target.value) ?? 0)) })} className="w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-[12px] outline-none focus:ring-2 focus:ring-ring" /></label>
                      <label className="block"><span className="vy-kicker mb-1 block">Unit $</span><input type="number" step="0.01" value={p.unit_cost ?? ""} onChange={(e) => setField(v.id, { unit_cost: decOrNull(e.target.value) })} className="w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-[12px] outline-none focus:ring-2 focus:ring-ring" /></label>
                    </div>
                    {showCny && <label className="mt-2.5 block"><span className="vy-kicker mb-1 block">Supplier ¥ <span className="font-normal normal-case text-muted-foreground">(reference)</span></span><input type="number" step="0.01" value={p.unit_cny ?? ""} onChange={(e) => setField(v.id, { unit_cny: decOrNull(e.target.value) })} placeholder="note only" className="w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-[12px] outline-none focus:ring-2 focus:ring-ring" /></label>}
                    <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-[12px]"><span className="text-muted-foreground">Line total</span><span className="font-mono font-bold text-primary">{money(p.qty * (p.unit_cost ?? 0))}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {err && <div className="shrink-0 border-t px-4 py-2 text-[12px] text-danger">{err}</div>}
        </div>
      </div>
    </Modal>
  );
}

function NonProductCosts({ order, costs, chargeTypes, vendors, goodsTotal }: { order: OrderRow; costs: OrderCostRow[]; chargeTypes: ChargeTypeOpt[]; vendors: VendorOpt[]; goodsTotal: number }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const onDelete = (id: string) => start(async () => { await deleteOrderCost(id, order.id); router.refresh(); });

  // Shared inline-edit controller (same primitive as Production lines).
  const ed = useInlineEditor(
    costs,
    (c) => ({ qty: String(c.qty ?? 1), amount: String(c.amount ?? 0) }),
    (id, f) => updateOrderCost(id, order.id, { qty: Number(f.qty) || 0, amount: Number(f.amount) || 0 }),
    () => router.refresh(),
  );
  const costsTotal = ed.on ? costs.reduce((s, c) => s + (Number(ed.get(c.id, "amount")) || 0), 0) : costs.reduce((s, c) => s + costUsd(c), 0);
  const productionTotal = goodsTotal + costsTotal;

  return (
    <Card className="overflow-hidden p-0">
      <div className="px-5 pt-4"><SectionTitle icon={DollarSign} tone="warning" strong title="Non-product costs" sub={ed.on ? "Editing — adjust qty or amount; totals update live." : "Service fees, packaging, freight, and other charges bundled into production or the agent CI."}
        action={<EditToolbar editor={ed} editable={costs.length > 0} addLabel="Add cost" onAdd={() => setAdding(true)} />} /></div>
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
                      {c.amount_cny_ref != null && <span className="font-mono">ref {rmb(c.amount_cny_ref)}</span>}
                      {c.treatment === "period" && <span className="rounded bg-muted px-1.5 py-0.5 font-medium">Period expense</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><Badge tone={(SECTION_TONE[c.section] ?? "muted") as "brand" | "info" | "success" | "muted"}>{c.section}</Badge></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.line_type ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{ed.on ? <div className="ml-auto w-16"><EditCell value={ed.get(c.id, "qty")} onChange={(v) => ed.set(c.id, "qty", v)} mode="numeric" /></div> : <span className="tabular">{num(c.qty)}</span>}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold">{ed.on ? <div className="ml-auto w-24"><EditCell value={ed.get(c.id, "amount")} onChange={(v) => ed.set(c.id, "amount", v)} /></div> : <span className="tabular">{money(c.amount)}</span>}</td>
                  <td className="px-3 py-2.5">{c.coverage === "Uncovered" ? <span className="text-[12px] text-muted-foreground">Uncovered</span> : <span className="font-mono text-[11px] text-success">{c.coverage}</span>}</td>
                  <td className="px-3 py-2.5 text-right">{!ed.on && <button onClick={() => onDelete(c.id)} disabled={pending} className="vy-icon-btn" aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-danger" /></button>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t">
              <tr className="bg-muted/20"><td className="px-5 py-2 text-muted-foreground" colSpan={4}>Product subtotal</td><td className="tabular px-3 py-2 text-right font-mono">{money(goodsTotal)}</td><td colSpan={2} /></tr>
              <tr className="bg-muted/20"><td className="px-5 py-2 text-muted-foreground" colSpan={4}>Non-product costs</td><td className="tabular px-3 py-2 text-right font-mono">{money(costsTotal)}</td><td colSpan={2} /></tr>
              <tr className="bg-muted/40 font-bold"><td className="px-5 py-3" colSpan={4}>Production total</td><td className="tabular px-3 py-3 text-right font-mono">{money(productionTotal)}</td><td colSpan={2} /></tr>
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
  const [vendor, setVendor] = useState<string>("");
  const [treatment, setTreatment] = useState<string>("inventoriable");
  const [basis, setBasis] = useState<string>("units");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [section, setSection] = useState<string>("Production");
  const [lineType, setLineType] = useState<string>("Other");
  const [chargeTypeId, setChargeTypeId] = useState<string>("");
  const [showCny, setShowCny] = useState(false); // ¥ reference is optional — hidden unless toggled

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

        {/* Amount is always USD (the calc currency). ¥ is a reference note only — hidden behind a toggle. */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (USD)"><input name="amount" type="number" step="0.01" required className={inputCls} placeholder="0.00" /></Field>
          {showCny
            ? <Field label="¥ reference (optional)"><input name="amount_cny_ref" type="number" step="0.01" className={inputCls} placeholder="note only" /></Field>
            : <div className="flex items-end pb-0.5"><button type="button" onClick={() => setShowCny(true)} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add ¥ reference</button></div>}
        </div>
        {showCny && <p className="-mt-2 text-[11px] leading-relaxed text-muted-foreground">You pay in <span className="font-medium">USD</span> — that&apos;s what the app calculates. The <span className="font-medium">¥</span> is just to remember the RMB price; it never affects any total.</p>}

        <Field label="Vendor / payee"><Select name="vendor" value={vendor} onChange={setVendor} placeholder="Select vendor…" searchable options={vendors.map((v) => ({ value: v.name, label: v.name, sub: v.type }))} /></Field>

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
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground"><span className="font-medium">Inventoriable</span> = adds to the product&apos;s landed cost (most costs: tooling, packaging, freight). <span className="font-medium">Period expense</span> = a general business cost, kept out of product cost. <span className="text-muted-foreground/80">If unsure, keep Inventoriable.</span></p>
          <input type="hidden" name="treatment" value={treatment} />
        </div>

        <div>
          <Field label="Allocation"><Select name="basis" value={basis} onChange={setBasis} options={[{ value: "units", label: "By qty" }, { value: "value", label: "By value" }]} /></Field>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">How this cost spreads across SKUs for landed cost — <span className="font-medium">By qty</span> (evenly per unit) or <span className="font-medium">By value</span> (weighted by each SKU&apos;s price).</p>
        </div>

        {/* Add details (collapsible) — coverage defaults to "Uncovered" */}
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
                <Field label="Service charge"><Select name="charge_type_id" value={chargeTypeId} onChange={setChargeTypeId} placeholder="— none —" options={[{ value: "", label: "— none —" }, ...chargeTypes.map((c) => ({ value: c.id, label: c.label, sub: c.owner !== "—" ? c.owner : undefined }))]} /></Field>
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
