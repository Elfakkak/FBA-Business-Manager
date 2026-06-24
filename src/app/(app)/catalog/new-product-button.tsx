"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { createProduct } from "./actions";
import { Plus } from "lucide-react";

const ADD_NEW = "__add_new__";

export function NewProductButton({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [catChoice, setCatChoice] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    // when "add new" is chosen, use the typed value as the category
    if (form.get("category") === ADD_NEW) form.set("category", String(form.get("category_new") ?? ""));
    setError(null);
    start(async () => {
      const res = await createProduct(form);
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      setCatChoice("");
      router.refresh();
    });
  }

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
              <select
                name="category"
                className={inputCls}
                value={catChoice}
                onChange={(e) => setCatChoice(e.target.value)}
              >
                <option value="">Select a category…</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value={ADD_NEW}>+ Add new category…</option>
              </select>
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
