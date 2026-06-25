"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { updatePartner } from "./actions";
import { Pencil } from "lucide-react";

export type PartnerProfile = {
  name: string; type: string;
  contact: string | null; email: string | null; phone: string | null; address: string | null;
  origin: string | null; payment_terms: string | null; specialty: string | null; notes: string | null;
};

export function EditPartnerButton({ partner }: { partner: PartnerProfile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const v = partner;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await updatePartner(partner.name, form);
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <GhostButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit profile</GhostButton>
      <Modal open={open} onClose={() => setOpen(false)} title={`Edit ${partner.name}`}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select name="type" defaultValue={v.type} className={inputCls}>
                <option>Agent</option><option>Forwarder</option><option>Inspection</option>
              </select>
            </Field>
            <Field label="Specialty"><input name="specialty" defaultValue={v.specialty ?? ""} className={inputCls} /></Field>
            <Field label="Contact"><input name="contact" defaultValue={v.contact ?? ""} className={inputCls} /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={v.email ?? ""} className={inputCls} /></Field>
            <Field label="Phone / WeChat"><input name="phone" defaultValue={v.phone ?? ""} className={inputCls} /></Field>
            <Field label="Origin / hub"><input name="origin" defaultValue={v.origin ?? ""} className={inputCls} /></Field>
          </div>
          <Field label="Address"><input name="address" defaultValue={v.address ?? ""} className={inputCls} /></Field>
          <Field label="Payment terms"><input name="payment_terms" defaultValue={v.payment_terms ?? ""} className={inputCls} /></Field>
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
