"use client";

import { useState } from "react";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useFormModal } from "@/lib/use-form-modal";
import { addPackagingItem, receivePackaging } from "./actions";
import { Plus } from "lucide-react";

const KINDS = ["Mailer", "Master carton", "Insert", "Polybag", "Label", "Box", "Other"];

export function AddPackagingButton({ families }: { families: { id: string; parent: string }[] }) {
  const { open, setOpen, error, pending, onSubmit } = useFormModal((form) => addPackagingItem(form));
  const [kind, setKind] = useState("Mailer");
  const [familyId, setFamilyId] = useState("");

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
        <Plus className="h-4 w-4" /> Add packaging
      </PrimaryButton>
      <Modal open={open} onClose={() => setOpen(false)} title="Add packaging">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Name"><input name="name" required autoFocus className={inputCls} placeholder="Poly mailer 10x13" /></Field>
          <Field label="Size"><input name="size" className={inputCls} placeholder="e.g. 10×13 in" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select name="kind" value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: k }))} />
            </Field>
            <Field label="For product">
              <Select name="family_id" value={familyId} onChange={setFamilyId} placeholder="Any product"
                options={[{ value: "", label: "Any product" }, ...families.map((f) => ({ value: f.id, label: f.parent }))]} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Unit cost"><input name="unit_cost" type="number" step="0.01" className={inputCls} placeholder="0.00" /></Field>
            <Field label="Reorder pt"><input name="reorder_point" type="number" className={inputCls} placeholder="500" /></Field>
            <Field label="Opening qty"><input name="opening_qty" type="number" className={inputCls} placeholder="0" /></Field>
          </div>
          <Field label="Source"><input name="source" className={inputCls} placeholder="Uline (optional)" /></Field>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Adding…" : "Add packaging"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function ReceiveButton({ itemId, name, onHand }: { itemId: string; name: string; onHand: number }) {
  const { open, setOpen, error, pending, onSubmit } = useFormModal((form) => receivePackaging(itemId, form));

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent">
        Receive
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Receive — ${name}`}>
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">Current on hand: <span className="font-mono font-semibold text-foreground">{onHand.toLocaleString()}</span></p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity"><input name="qty" type="number" required autoFocus className={inputCls} placeholder="1000" /></Field>
            <Field label="Unit cost"><input name="unit_cost" type="number" step="0.01" className={inputCls} placeholder="0.00" /></Field>
          </div>
          <Field label="Source"><input name="source" className={inputCls} placeholder="Supplier / PO (optional)" /></Field>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Receiving…" : "Receive stock"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
