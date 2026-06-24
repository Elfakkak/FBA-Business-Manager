"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { createCategory, renameCategory, deleteCategory } from "./category-actions";
import { Tags, Pencil, Trash2, Plus, Check, X } from "lucide-react";

export type CategoryRow = { id: string; name: string; count: number };

export function CategoryManagerButton({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
      after?.();
      router.refresh();
    });
  };

  return (
    <>
      <GhostButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
        <Tags className="h-4 w-4" /> Categories
      </GhostButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Manage categories">
        {/* add */}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData();
            form.set("name", newName);
            run(() => createCategory(form), () => setNewName(""));
          }}
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category name" className={inputCls} />
          <PrimaryButton type="submit" disabled={pending || !newName.trim()} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Plus className="h-4 w-4" /> Add
          </PrimaryButton>
        </form>

        {error && <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <ul className="mt-4 divide-y rounded-lg border">
          {categories.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">No categories yet.</li>
          )}
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2.5">
              {editing === c.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    run(() => renameCategory(c.id, c.name, form), () => setEditing(null));
                  }}
                >
                  <input name="name" defaultValue={c.name} autoFocus className={inputCls} />
                  <button type="submit" className="vy-icon-btn" aria-label="Save"><Check className="h-4 w-4 text-success" /></button>
                  <button type="button" className="vy-icon-btn" aria-label="Cancel" onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.count} {c.count === 1 ? "product" : "products"}</span>
                  <button className="vy-icon-btn" aria-label="Rename" onClick={() => setEditing(c.id)}><Pencil className="h-3.5 w-3.5" /></button>
                  <button
                    className="vy-icon-btn"
                    aria-label="Delete"
                    onClick={() => {
                      const msg = c.count > 0
                        ? `Delete "${c.name}"? ${c.count} product(s) will become uncategorized.`
                        : `Delete "${c.name}"?`;
                      if (confirm(msg)) run(() => deleteCategory(c.id, c.name));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end">
          <GhostButton onClick={() => setOpen(false)}>Done</GhostButton>
        </div>
      </Modal>
    </>
  );
}
