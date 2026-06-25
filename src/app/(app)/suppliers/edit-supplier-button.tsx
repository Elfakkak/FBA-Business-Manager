"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { updateSupplier } from "./actions";
import { Pencil } from "lucide-react";

export type SupplierProfile = {
  name: string;
  contact: string | null; email: string | null; phone: string | null; address: string | null;
  origin: string | null; payment_terms: string | null; incoterm: string | null; route: string | null;
  lead_time_days: number | null; moq: number | null; notes: string | null;
};

export function EditSupplierButton({ supplier }: { supplier: SupplierProfile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await updateSupplier(supplier.name, form);
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  const v = supplier;
  return (
    <>
      <GhostButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit profile</GhostButton>
      <Modal open={open} onClose={() => setOpen(false)} title={`Edit ${supplier.name}`}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact"><input name="contact" defaultValue={v.contact ?? ""} className={inputCls} /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={v.email ?? ""} className={inputCls} /></Field>
            <Field label="Phone / WeChat"><input name="phone" defaultValue={v.phone ?? ""} className={inputCls} /></Field>
            <Field label="Origin"><input name="origin" defaultValue={v.origin ?? ""} className={inputCls} /></Field>
          </div>
          <Field label="Address"><input name="address" defaultValue={v.address ?? ""} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment terms"><input name="payment_terms" defaultValue={v.payment_terms ?? ""} className={inputCls} /></Field>
            <Field label="Default incoterm"><input name="incoterm" defaultValue={v.incoterm ?? ""} className={inputCls} placeholder="FOB / DDP" /></Field>
            <Field label="Lead time (days)"><input name="lead_time_days" type="number" defaultValue={v.lead_time_days ?? ""} className={inputCls} /></Field>
            <Field label="MOQ (units)"><input name="moq" type="number" defaultValue={v.moq ?? ""} className={inputCls} /></Field>
          </div>
          <Field label="Route"><input name="route" defaultValue={v.route ?? ""} className={inputCls} placeholder="Direct supplier / via Agent" /></Field>
          <Field label="Notes"><textarea name="notes" defaultValue={v.notes ?? ""} className={inputCls} rows={2} /></Field>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
