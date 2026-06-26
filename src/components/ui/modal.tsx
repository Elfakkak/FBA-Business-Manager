"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  size = "default",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "default" | "lg" | "xl";
  children: React.ReactNode;
}) {
  const maxW = size === "xl" ? "max-w-4xl" : size === "lg" ? "max-w-2xl" : "max-w-lg";
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Solid (non-translucent) panel, capped height with internal scroll so
          the header + footer buttons never clip off-screen. */}
      <div
        className={cn("relative flex w-full flex-col overflow-hidden rounded-xl border", maxW)}
        style={{ background: "hsl(var(--card))", color: "hsl(var(--card-fg))", boxShadow: "var(--shadow-lg)", maxHeight: "90vh" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
          <h2 className="font-medium">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
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
