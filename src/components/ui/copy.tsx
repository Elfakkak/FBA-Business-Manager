"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";

// One-click copy chip for IDs the forwarder / Amazon asks for (FBA shipment id,
// reference id, etc.). Click anywhere on it to copy; shows a brief check.
export function CopyValue({ value, label, mono = true, className }: { value: string | null | undefined; label?: string; mono?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const v = (value ?? "").toString();
  const copy = async () => {
    if (!v) return;
    try { await navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard blocked */ }
  };
  return (
    <button
      type="button" onClick={copy} disabled={!v} title={v ? `Copy ${label ?? "value"}` : undefined}
      className={cn("group inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background/60 px-2 py-1 text-left transition hover:border-primary/40 disabled:cursor-default disabled:opacity-60", className)}
    >
      <span className={cn("truncate text-[12px]", mono && "font-mono")}>{v || "—"}</span>
      {v && (copied
        ? <Check className="h-3.5 w-3.5 shrink-0 text-success" />
        : <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />)}
    </button>
  );
}

// "Copy everything" button — copies a pre-composed multi-line block (e.g. all the
// IDs a forwarder needs) in one click.
export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" onClick={copy} disabled={!text} className={cn("vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5 disabled:opacity-50", className)}>
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : label}
    </button>
  );
}
