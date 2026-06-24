"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { createProduct } from "./actions";
import { Plus } from "lucide-react";

const CATEGORIES = ["Steering wheel covers", "Seat covers", "Seat cushions", "Other"];

export function NewProductButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await createProduct(form);
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
        <Plus className="h-4 w-4" /> New product
      </PrimaryButton>

      <Modal open={open} onClose={() => setOpen(false)} title="New product family">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Product name">
            <input name="name" required autoFocus className={inputCls} placeholder="e.g. Heavy-Duty Truck Floor Mats" />
          </Field>
          <Field label="Category">
            <select name="category" className={inputCls} defaultValue="Other">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <p className="text-xs text-muted-foreground">
            Brand defaults to Vyonix. Add variants (SKUs), costs and supplier on the product page after creating.
          </p>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Creating…" : "Create product"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
