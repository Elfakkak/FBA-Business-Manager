"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ActionResult = { ok: boolean; error?: string };

// Shared modal-form plumbing: open state, pending, error, and the submit handler
// (preventDefault → FormData → action → on success close + refresh). Replaces the
// ~identical block repeated across every New/Edit modal in the app.
export function useFormModal(action: (form: FormData) => Promise<ActionResult>, opts?: { onSuccess?: (form: FormData) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await action(form);
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
      setOpen(false);
      opts?.onSuccess?.(form);
      router.refresh();
    });
  }

  return { open, setOpen, error, setError, pending, onSubmit };
}
