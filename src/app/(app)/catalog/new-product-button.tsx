"use client";

import { useState } from "react";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useFormModal } from "@/lib/use-form-modal";
import { useNewParam } from "@/lib/use-new-param";
import { createProduct } from "./actions";
import { Plus } from "lucide-react";

const ADD_NEW = "__add_new__";

export function NewProductButton({ categories }: { categories: string[] }) {
  const [catChoice, setCatChoice] = useState("");
  const { open, setOpen, error, pending, onSubmit } = useFormModal((form) => {
    // when "add new" is chosen, use the typed value as the category
    if (form.get("category") === ADD_NEW) form.set("category", String(form.get("category_new") ?? ""));
    return createProduct(form);
  }, { onSuccess: () => setCatChoice("") });
  useNewParam(() => setOpen(true));

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
        <Plus className="h-4 w-4" /> New product
      </PrimaryButton>

      <Modal open={open} onClose={() => setOpen(false)} title="New product">
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">
          Name it and pick a category. You&apos;ll add SKUs, costs and supplier next.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name">
              <input name="name" required autoFocus className={inputCls} placeholder="e.g. Beaded seat cover" />
            </Field>
            <Field label="Category">
              <Select name="category" value={catChoice} onChange={setCatChoice} placeholder="Select a category…"
                options={[...categories.map((c) => ({ value: c, label: c })), { value: ADD_NEW, label: "+ Add new category…" }]} />
            </Field>
          </div>

          {catChoice === ADD_NEW && (
            <Field label="New category name">
              <input name="category_new" required className={inputCls} placeholder="e.g. Floor mats" />
            </Field>
          )}

          <div className="flex items-start gap-3 rounded-md border bg-accent/40 px-3 py-2.5 text-sm">
            <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">
              Brand is <span className="font-medium text-foreground">Vyonix</span> (your private label). SKUs, costs,
              dimensions, lead time &amp; supplier are set on the product after. Supplier picker arrives in Phase&nbsp;2.
            </span>
          </div>

          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending} className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> {pending ? "Creating…" : "Create product"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
