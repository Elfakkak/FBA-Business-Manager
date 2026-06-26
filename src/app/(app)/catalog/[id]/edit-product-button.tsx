"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { useFormModal } from "@/lib/use-form-modal";
import { updateProduct, deleteProduct } from "../actions";
import { Pencil, Trash2 } from "lucide-react";

export type ProductEdit = {
  id: string;
  parent: string;
  category: string;
  status: string;
  material: string | null;
  supplier: string | null;
  supplier_route: string | null;
  lead_time_days: number | null;
  moq: number | null;
  last_ordered: string | null;
  weight_kg: number | null;
  units_per_carton: number | null;
  dim_cm: { l?: number | null; w?: number | null; h?: number | null } | null;
  carton_cm: { l?: number | null; w?: number | null; h?: number | null } | null;
};

export function EditProductButton({ product, suppliers, categories }: { product: ProductEdit; suppliers: string[]; categories: string[] }) {
  const router = useRouter();
  const { open, setOpen, error, pending, onSubmit } = useFormModal((form) => updateProduct(product.id, form));
  const [delErr, setDelErr] = useState<string | null>(null);
  const [delPending, startDel] = useTransition();
  const d = product.dim_cm ?? {};
  const c = product.carton_cm ?? {};

  function onDelete() {
    if (!confirm(`Delete "${product.parent}"? This can't be undone.`)) return;
    setDelErr(null);
    startDel(async () => {
      const r = await deleteProduct(product.id);
      if (!r.ok) { setDelErr(r.error ?? "Failed."); return; }
      router.push("/catalog");
    });
  }

  return (
    <>
      <GhostButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit details</GhostButton>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit product details">
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Product (parent) identity — variants keep their own Amazon names */}
          <div className="vy-kicker">Product</div>
          <Field label="Product name"><input name="parent" required defaultValue={product.parent} className={inputCls} placeholder="e.g. 18&quot; Semi Truck Steering Wheel Cover" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select name="category" defaultValue={product.category} className={inputCls}>
                {[product.category, ...categories.filter((c) => c !== product.category)].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={product.status} className={inputCls}>
                {["active", "draft", "archived"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
            </Field>
          </div>

          <div className="vy-kicker pt-1">Specs &amp; supplier</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Material"><input name="material" defaultValue={product.material ?? ""} className={inputCls} placeholder="e.g. Microfiber leather" /></Field>
            <Field label="Supplier">
              <select name="supplier" defaultValue={product.supplier ?? ""} className={inputCls}>
                <option value="">— none —</option>
                {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Route">
              <select name="supplier_route" defaultValue={product.supplier_route ?? ""} className={inputCls}>
                <option value="">— none —</option>
                <option value="Direct supplier">Direct supplier</option>
                <option value="via Agent">via Agent</option>
              </select>
            </Field>
            <Field label="Last ordered"><input name="last_ordered" defaultValue={product.last_ordered ?? ""} className={inputCls} placeholder="May 2026" /></Field>
            <Field label="Lead time (days)"><input name="lead_time_days" type="number" defaultValue={product.lead_time_days ?? ""} className={inputCls} /></Field>
            <Field label="MOQ (units)"><input name="moq" type="number" defaultValue={product.moq ?? ""} className={inputCls} /></Field>
          </div>

          <div className="vy-kicker pt-1">Dimensions &amp; weight</div>
          <Field label="Unit size — L × W × H (cm)">
            <div className="grid grid-cols-3 gap-2">
              <input name="dim_l" type="number" step="0.1" defaultValue={d.l ?? ""} className={inputCls} placeholder="L" />
              <input name="dim_w" type="number" step="0.1" defaultValue={d.w ?? ""} className={inputCls} placeholder="W" />
              <input name="dim_h" type="number" step="0.1" defaultValue={d.h ?? ""} className={inputCls} placeholder="H" />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit weight (kg)"><input name="weight_kg" type="number" step="0.01" defaultValue={product.weight_kg ?? ""} className={inputCls} /></Field>
            <Field label="Units per carton"><input name="units_per_carton" type="number" defaultValue={product.units_per_carton ?? ""} className={inputCls} /></Field>
          </div>
          <Field label="Master carton — L × W × H (cm)">
            <div className="grid grid-cols-3 gap-2">
              <input name="carton_l" type="number" step="0.1" defaultValue={c.l ?? ""} className={inputCls} placeholder="L" />
              <input name="carton_w" type="number" step="0.1" defaultValue={c.w ?? ""} className={inputCls} placeholder="W" />
              <input name="carton_h" type="number" step="0.1" defaultValue={c.h ?? ""} className={inputCls} placeholder="H" />
            </div>
          </Field>

          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          {delErr && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{delErr}</p>}
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={onDelete} disabled={delPending} className="vy-btn vy-btn--ghost inline-flex items-center gap-1.5 text-danger">
              <Trash2 className="h-3.5 w-3.5" /> {delPending ? "Deleting…" : "Delete product"}
            </button>
            <div className="flex gap-2">
              <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
              <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</PrimaryButton>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
