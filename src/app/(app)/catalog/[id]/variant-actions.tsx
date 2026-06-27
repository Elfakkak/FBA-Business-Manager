"use client";

import { useState } from "react";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useFormModal } from "@/lib/use-form-modal";
import { cn } from "@/lib/utils";
import { addVariant, updateVariant, moveVariant } from "../actions";
import { Plus, Pencil, X } from "lucide-react";

const STATUSES = ["Ready", "Reorder", "SKU mislabeled", "Not linked"];

export function AddVariantButton({ familyId, familyName }: { familyId: string; familyName?: string }) {
  const { open, setOpen, error, pending, onSubmit } = useFormModal((form) => addVariant(familyId, form));
  // Flexible defining attributes — a variant can differ by color, pack, size, scent…
  const [attrs, setAttrs] = useState<{ key: string; value: string }[]>([{ key: "Color", value: "" }]);
  const setAttr = (i: number, patch: Partial<{ key: string; value: string }>) => setAttrs((a) => a.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  return (
    <>
      <PrimaryButton onClick={() => { setAttrs([{ key: "Color", value: "" }]); setOpen(true); }} className="inline-flex items-center gap-1.5">
        <Plus className="h-4 w-4" /> Add variant
      </PrimaryButton>
      <Modal open={open} onClose={() => setOpen(false)} title="Add variant"
        subtitle={`New variant of ${familyName ?? "this product"}. Variants can differ by anything — color, pack, size, scent. Add the attributes that define this one.`}>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="attributes" value={JSON.stringify(attrs)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU"><input name="sku" required autoFocus className={inputCls} placeholder="e.g. CAR-BSC-3P-BLK" /></Field>
            <Field label="Unit cost (USD)"><input name="cost" type="number" step="0.01" className={inputCls} placeholder="e.g. 8.40" /></Field>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="vy-kicker">Defining attributes</span>
              <button type="button" onClick={() => setAttrs((a) => [...a, { key: "", value: "" }])} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add attribute</button>
            </div>
            <div className="space-y-2">
              {attrs.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={a.key} onChange={(e) => setAttr(i, { key: e.target.value })} placeholder="Attribute (e.g. Color)" className={cn(inputCls, "flex-1")} />
                  <span className="shrink-0 text-muted-foreground">=</span>
                  <input value={a.value} onChange={(e) => setAttr(i, { value: e.target.value })} placeholder="Value (e.g. Black)" className={cn(inputCls, "flex-1")} />
                  <button type="button" onClick={() => setAttrs((arr) => arr.filter((_, idx) => idx !== i))} className="vy-icon-btn shrink-0" aria-label="Remove attribute"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-muted-foreground">Unit cost is a seed — the actual cost comes from invoices. ASIN/FNSKU auto-fill once the SKU is linked to Amazon.</p>
          </div>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Adding…" : "Add variant"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function EditVariantButton({
  variantId,
  familyId,
  sku,
  cost,
  salePrice,
  status,
  reorderPoint,
  products,
}: {
  variantId: string;
  familyId: string;
  sku: string;
  cost: number | null;
  salePrice: number | null;
  status: string;
  reorderPoint: number | null;
  products: { id: string; parent: string }[];
}) {
  const [fam, setFam] = useState(familyId);
  const [vStatus, setVStatus] = useState<string>(status);
  // move-to-product runs first (if changed), then the field update
  const { open, setOpen, error, pending, onSubmit } = useFormModal(async (form) => {
    const target = String(form.get("family") ?? familyId);
    const newName = String(form.get("new_product") ?? "").trim();
    let effectiveFamily = familyId;
    if (newName || (target && target !== familyId)) {
      const mv = await moveVariant(variantId, newName ? "" : target, newName || undefined);
      if (!mv.ok) return mv;
      effectiveFamily = mv.familyId ?? familyId; // revalidate the destination, not the old family
    }
    return updateVariant(variantId, effectiveFamily, form);
  });

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Edit">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Edit ${sku}`}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Unit cost (USD)"><input name="cost" type="number" step="0.01" className={inputCls} defaultValue={cost ?? ""} /></Field>
            <Field label="Sale price (USD)"><input name="sale_price" type="number" step="0.01" className={inputCls} defaultValue={salePrice ?? ""} /></Field>
            <Field label="Reorder point"><input name="reorder_point" type="number" className={inputCls} defaultValue={reorderPoint ?? ""} /></Field>
          </div>
          <Field label="Status">
            <Select name="status" value={vStatus} onChange={setVStatus} options={STATUSES.map((s) => ({ value: s, label: s }))} />
          </Field>
          <Field label="Belongs to product">
            <Select name="family" value={fam} onChange={setFam}
              options={[...products.map((pr) => ({ value: pr.id, label: pr.parent })), { value: "__new__", label: "＋ New product…" }]} />
          </Field>
          {fam === "__new__" && <Field label="New product name"><input name="new_product" required className={inputCls} placeholder="e.g. 15&quot; Carbon Steering Wheel Cover" /></Field>}
          {fam !== "__new__" && fam !== familyId && <p className="text-[12px] text-muted-foreground">Moving this SKU to another product.</p>}
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
