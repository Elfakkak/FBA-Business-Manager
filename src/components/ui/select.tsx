"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string; sub?: string };

// App-wide pretty dropdown. Replaces native <select> so the option list is styled,
// searchable for long lists, keyboard-navigable, and consistent everywhere.
// The popover renders in a portal with fixed positioning so it floats above modals/
// cards instead of being clipped by their overflow. Form-friendly via a hidden input.
export function Select({
  value, onChange, options, placeholder = "Select…", name, searchable, disabled, className, ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  name?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const autoSearch = searchable ?? options.length > 8;
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return options;
    return options.filter((o) => `${o.label} ${o.sub ?? ""} ${o.value}`.toLowerCase().includes(n));
  }, [options, q]);

  function reposition() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < 300 && r.top > below;
    setPos({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: r.width, up });
  }

  useEffect(() => {
    if (!open) { setPos(null); setQ(""); return; }
    reposition();
    if (autoSearch) requestAnimationFrame(() => searchRef.current?.focus());
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onMove = () => reposition();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("scroll", onMove, true); window.removeEventListener("resize", onMove); };
  }, [open, autoSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    if (!open || !listRef.current) return;
    (listRef.current.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(v: string) { onChange(v); setOpen(false); }
  function onKey(e: React.KeyboardEvent) {
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); const o = filtered[active]; if (o) choose(o.value); }
  }

  return (
    <div className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef} type="button" disabled={disabled} onKeyDown={onKey} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm outline-none transition focus:ring-2 focus:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          open && "ring-2 ring-ring",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[200] overflow-hidden rounded-xl border bg-card"
          style={{ left: pos.left, width: pos.width, top: pos.up ? undefined : pos.top, bottom: pos.up ? window.innerHeight - pos.top : undefined, boxShadow: "var(--shadow-lg)" }}
        >
          {autoSearch && (
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search…" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
          )}
          <ul ref={listRef} role="listbox" className="max-h-72 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <li className="px-2.5 py-6 text-center text-[12px] text-muted-foreground">No matches</li>
            ) : filtered.map((o, i) => {
              const isSel = o.value === value;
              return (
                <li key={o.value || `__${i}`}>
                  <button type="button" role="option" aria-selected={isSel} onMouseEnter={() => setActive(i)} onClick={() => choose(o.value)}
                    className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition", i === active && "bg-accent", isSel && "text-primary")}>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate", isSel && "font-semibold")}>{o.label}</span>
                      {o.sub && <span className="block truncate text-[11px] text-muted-foreground">{o.sub}</span>}
                    </span>
                    {isSel && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
