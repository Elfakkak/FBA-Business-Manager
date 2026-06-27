"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { SelectLabelContext } from "./select";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = "default",
  footer,
  unpadded,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  size?: "default" | "lg" | "xl" | "2xl";
  footer?: React.ReactNode;
  unpadded?: boolean;
  children: React.ReactNode;
}) {
  const maxW = size === "2xl" ? "max-w-[1120px]" : size === "xl" ? "max-w-4xl" : size === "lg" ? "max-w-2xl" : "max-w-lg";
  // Enter motion: mount hidden, flip `is-open` next frame so the CSS transition plays.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) { setShown(false); return; }
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  // Portal to <body> so a `backdrop-filter` ancestor (e.g. .vy-card) can't
  // become the containing block for our position:fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className={cn("vy-modal-scrim absolute inset-0 bg-black/40 backdrop-blur-[2px]", shown && "is-open")} onClick={onClose} />
      {/* Solid (non-translucent) panel, capped height with internal scroll so
          the header + footer buttons never clip off-screen. */}
      <div
        className={cn("vy-modal-panel relative flex w-full flex-col overflow-hidden rounded-xl border", maxW, shown && "is-open")}
        style={{ background: "hsl(var(--card))", color: "hsl(var(--card-fg))", boxShadow: "var(--shadow-lg)", maxHeight: unpadded ? "82vh" : "90vh" }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className={unpadded ? "flex min-h-0 flex-1 flex-col" : "overflow-y-auto p-5"}>{children}</div>
        {footer && <div className="shrink-0 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // labelId lets a wrapped <Select> (a button, not a labelable element) borrow this
  // label as its accessible name via aria-labelledby.
  const labelId = useId();
  return (
    <label className="block space-y-1.5">
      <span id={labelId} className="text-sm font-medium">{label}</span>
      <SelectLabelContext.Provider value={labelId}>{children}</SelectLabelContext.Provider>
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function PrimaryButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={cn("vy-btn vy-btn--primary", className)}>
      {children}
    </button>
  );
}

export function GhostButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={cn("vy-btn vy-btn--outline", className)}>
      {children}
    </button>
  );
}
