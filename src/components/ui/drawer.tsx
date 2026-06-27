"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// --- Close-guard plumbing -------------------------------------------------
// Industry-standard drawer behaviour: a drawer is dismissable by default
// (scrim-click / Esc / ✕ all close). The MOMENT it holds unsaved changes it
// stops closing silently and asks "Discard changes?" instead. Any editor
// anywhere inside the drawer opts in by rendering <DrawerGuard active={dirty} />
// — no per-drawer wiring, so every drawer (present and future) gets it for free.
type GuardRegister = (on: boolean, key: symbol) => void;
const DrawerGuardCtx = createContext<GuardRegister | null>(null);

export function DrawerGuard({ active }: { active: boolean }) {
  const register = useContext(DrawerGuardCtx);
  const [key] = useState(() => Symbol("drawer-guard"));
  useEffect(() => {
    register?.(active, key);
    return () => register?.(false, key);
  }, [active, key, register]);
  return null;
}

// Right slide-in panel (matches the prototype's quick-view drawers).
// `width` widens the panel (the richer invoice quick-view needs more room);
// `subtitle` renders under the title; `footer` pins an action bar at the bottom.
// `dismissable={false}` hard-locks the drawer (rare — prefer DrawerGuard so a
// read-only view still closes on click-away).
export function Drawer({ open, onClose, title, subtitle, footer, width = 420, dismissable = true, children }: {
  open: boolean; onClose: () => void;
  title?: React.ReactNode; subtitle?: React.ReactNode; footer?: React.ReactNode;
  width?: number; dismissable?: boolean; children: React.ReactNode;
}) {
  const [guards, setGuards] = useState<Set<symbol>>(() => new Set());
  const [confirm, setConfirm] = useState(false);
  const register = useCallback<GuardRegister>((on, key) => {
    setGuards((prev) => {
      if (on === prev.has(key)) return prev;
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  }, []);
  const dirty = guards.size > 0;

  // Any close attempt (scrim, Esc, ✕): confirm when dirty, otherwise just close.
  const attemptClose = useCallback(() => {
    if (!dismissable) return;
    if (dirty) setConfirm(true);
    else onClose();
  }, [dismissable, dirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") attemptClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, attemptClose]);

  useEffect(() => { if (!open) setConfirm(false); }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <DrawerGuardCtx.Provider value={register}>
      <div className="fixed inset-0 z-100" role="dialog" aria-modal>
        {/* Backdrop — click closes (or asks to discard when there are unsaved edits). */}
        <div className="absolute inset-0 bg-black/40" onClick={dismissable ? attemptClose : undefined} />
        <div
          className="absolute right-0 top-0 flex h-full max-w-[96vw] flex-col border-l shadow-xl"
          style={{ width, background: "hsl(var(--card))", color: "hsl(var(--card-fg))", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-3">
            <div className="min-w-0">
              <h2 className="truncate font-medium">{title}</h2>
              {subtitle && <div className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</div>}
            </div>
            <button onClick={attemptClose} className="vy-icon-btn shrink-0" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          {footer && <div className="shrink-0 border-t bg-card/95 px-5 py-3">{footer}</div>}

          {/* Discard-changes confirm — only ever shown when an editor is dirty. */}
          {confirm && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-black/30 p-6" onClick={() => setConfirm(false)}>
              <div className="w-full max-w-xs rounded-xl border p-4" style={{ background: "hsl(var(--card))", boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
                <div className="text-[14px] font-semibold">Discard changes?</div>
                <p className="mt-1 text-[12px] text-muted-foreground">You have unsaved changes in this panel. Closing will lose them.</p>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setConfirm(false)} className="vy-btn vy-btn--ghost vy-btn--sm">Keep editing</button>
                  <button onClick={() => { setConfirm(false); onClose(); }} className="vy-btn vy-btn--sm text-white" style={{ background: "hsl(var(--danger))" }}>Discard</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DrawerGuardCtx.Provider>,
    document.body
  );
}

export function DrawerStat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tabular mt-1 font-mono text-sm font-semibold">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
