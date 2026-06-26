"use client";

import { useState } from "react";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { useFormModal } from "@/lib/use-form-modal";
import { addVariant, updateVariant, moveVariant } from "../actions";
import { Plus, Pencil } from "lucide-react";

const STATUSES = ["Ready", "Reorder", "SKU mislabeled", "Not linked"];

export function AddVariantButton({ familyId }: { familyId: string }) {
  const { open, setOpen, error, pending, onSubmit } = useFormModal((form) => addVariant(familyId, form));

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
        <Plus className="h-4 w-4" /> Add variant
      </PrimaryButton>
      <Modal open={open} onClose={() => setOpen(false)} title="Add variant">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU"><input name="sku" required autoFocus className={inputCls} placeholder="BLK-SKU-1P" /></Field>
            <Field label="Pack"><input name="pack" className={inputCls} defaultValue="1-Pack" /></Field>
          </div>
          <Field label="Variant name"><input name="name" required className={inputCls} placeholder="Black 1-Pack" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit cost (USD)"><input name="cost" type="number" step="0.01" className={inputCls} placeholder="0.00" /></Field>
            <Field label="ASIN"><input name="asin" className={inputCls} placeholder="B0…" /></Field>
          </div>
          <Field label="FNSKU"><input name="fnsku" className={inputCls} placeholder="X0… (optional)" /></Field>
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
            <select name="status" className={inputCls} defaultValue={status}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Belongs to product">
            <select name="family" value={fam} onChange={(e) => setFam(e.target.value)} className={inputCls}>
              {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.parent}</option>)}
              <option value="__new__">＋ New product…</option>
            </select>
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
