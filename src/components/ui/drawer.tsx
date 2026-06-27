"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Right slide-in panel (matches the prototype's quick-view drawers).
// `width` widens the panel (the richer invoice quick-view needs more room);
// `subtitle` renders under the title; `footer` pins an action bar at the bottom.
export function Drawer({ open, onClose, title, subtitle, footer, width = 420, dismissable = true, children }: {
  open: boolean; onClose: () => void;
  title?: React.ReactNode; subtitle?: React.ReactNode; footer?: React.ReactNode;
  width?: number; dismissable?: boolean; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && dismissable) onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, dismissable]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-100" role="dialog" aria-modal>
      {/* Backdrop — click-to-close only when dismissable (so unsaved edits aren't lost). */}
      <div className="absolute inset-0 bg-black/40" onClick={dismissable ? onClose : undefined} />
      <div
        className="absolute right-0 top-0 flex h-full max-w-[96vw] flex-col border-l shadow-xl"
        style={{ width, background: "hsl(var(--card))", color: "hsl(var(--card-fg))", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-medium">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="vy-icon-btn shrink-0" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="shrink-0 border-t bg-card/95 px-5 py-3">{footer}</div>}
      </div>
    </div>,
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
