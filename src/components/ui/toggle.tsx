"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Pill switch matching the prototype. Renders a hidden checkbox named `name` so it
// participates in native FormData submission (form.get(name) === "on").
export function Toggle({
  name, label, sub, defaultChecked, tone = "success", onChange,
}: {
  name: string; label?: string; sub?: string; defaultChecked?: boolean; tone?: "success" | "primary"; onChange?: (v: boolean) => void;
}) {
  const [on, setOn] = useState(!!defaultChecked);
  const toggle = () => setOn((v) => { onChange?.(!v); return !v; });
  const sw = (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={toggle}
      className={cn(
        "relative h-6 w-[42px] shrink-0 rounded-full transition-colors",
        on ? (tone === "primary" ? "bg-primary" : "bg-success") : "bg-muted"
      )}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[19px]" : "left-0.5")} />
    </button>
  );
  // hidden checkbox carries the value into FormData
  const field = <input type="checkbox" name={name} checked={on} readOnly hidden />;

  if (!label) return <>{sw}{field}</>;
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span>
        <span className="text-sm font-medium">{label}</span>
        {sub && <span className="block text-[12px] text-muted-foreground">{sub}</span>}
      </span>
      {sw}
      {field}
    </label>
  );
}
