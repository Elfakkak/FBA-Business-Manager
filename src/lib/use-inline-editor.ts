"use client";

import { useState, useTransition } from "react";

// Shared inline-edit controller for any list/table row. One source of truth for
// the Edit → change cells → Done/Cancel flow so every editable table in the app
// behaves identically (Production lines, non-product costs, and beyond).
//
//   const ed = useInlineEditor(rows, r => ({ qty: String(r.qty) }),
//     (id, f) => updateRow(id, { qty: Number(f.qty) }), () => router.refresh());
//   ed.on ? <EditCell value={ed.get(id,"qty")} onChange={v => ed.set(id,"qty",v)} /> : <span>{qty}</span>
//
// `seed` maps a row to its editable string fields; `commit` persists ONE row
// (called only for rows whose values actually changed); `onDone` runs after save.
export type InlineEditor = {
  on: boolean;
  begin: () => void;
  cancel: () => void;
  saving: boolean;
  error: string | null;
  get: (id: string, field: string) => string;
  set: (id: string, field: string, value: string) => void;
  save: () => void;
};

export function useInlineEditor<R extends { id: string }>(
  rows: R[],
  seed: (row: R) => Record<string, string>,
  commit: (id: string, fields: Record<string, string>) => Promise<unknown>,
  onDone?: () => void,
): InlineEditor {
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Map<string, Record<string, string>>>(new Map());
  const [base, setBase] = useState<Map<string, Record<string, string>>>(new Map());
  const [saving, start] = useTransition();

  function begin() {
    const e = new Map<string, Record<string, string>>();
    const b = new Map<string, Record<string, string>>();
    for (const r of rows) { const s = seed(r); e.set(r.id, { ...s }); b.set(r.id, { ...s }); }
    setEdits(e); setBase(b); setError(null); setOn(true);
  }
  const cancel = () => { setError(null); setOn(false); };
  const get = (id: string, field: string) => edits.get(id)?.[field] ?? "";
  const set = (id: string, field: string, value: string) =>
    setEdits((m) => { const cur = m.get(id); if (!cur) return m; return new Map(m).set(id, { ...cur, [field]: value }); });

  function save() {
    start(async () => {
      // Surface a failed commit instead of silently closing + discarding edits.
      let failed: string | null = null;
      for (const [id, fields] of edits) {
        const b = base.get(id);
        const changed = !b || Object.keys(fields).some((k) => fields[k] !== b[k]);
        if (!changed) continue;
        const res = (await commit(id, fields)) as { ok?: boolean; error?: string } | undefined;
        if (res && res.ok === false) { failed = res.error || "Couldn't save your changes."; break; }
      }
      if (failed) { setError(failed); return; } // keep the editor open so edits aren't lost
      setError(null); setOn(false); onDone?.();
    });
  }

  return { on, begin, cancel, saving, error, get, set, save };
}
