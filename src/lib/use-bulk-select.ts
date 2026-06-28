"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Shared checkbox multi-select mechanics for list tables (catalog / orders / packaging).
// Owns the selection Set, select-all over the currently-visible ids, and runBulk
// (transition + refresh + clear). Smart-disable (canArchive/…) stays per-surface,
// derived from the caller's own rows + `sel`, since each surface's lifecycle differs.
export function useBulkSelect(visibleIds: string[]) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();

  const has = (id: string) => sel.has(id);
  const toggle = (id: string) => setSel((s) => { const c = new Set(s); if (c.has(id)) c.delete(id); else c.add(id); return c; });
  const clear = () => setSel(new Set());
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => sel.has(id));
  const toggleAll = () => setSel((s) => {
    const c = new Set(s);
    if (allSelected) visibleIds.forEach((id) => c.delete(id));
    else visibleIds.forEach((id) => c.add(id));
    return c;
  });
  const runBulk = (fn: (ids: string[]) => Promise<unknown>) => start(async () => { await fn([...sel]); clear(); router.refresh(); });

  return { sel, ids: [...sel], size: sel.size, has, toggle, clear, allSelected, toggleAll, runBulk, pending };
}
