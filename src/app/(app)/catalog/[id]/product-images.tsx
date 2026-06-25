"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addProductImage, removeProductImage } from "../actions";
import { cn } from "@/lib/utils";
import { ImageIcon, X, Loader2 } from "lucide-react";

// Matches the prototype Images card: one large "Drop product image" slot beside two
// stacked smaller slots (Detail / Packaging). Slots fill in order as you upload.
export function ProductImages({ id, images }: { id: string; images: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const supabase = createClient();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${id}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("product-media").upload(path, file, { upsert: false });
    if (upErr) { setError(upErr.message); setBusy(false); return; }
    const url = supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl;
    const res = await addProductImage(id, url);
    setBusy(false);
    if (!res.ok) {
      // roll back the orphaned upload so storage stays clean
      await supabase.storage.from("product-media").remove([path]);
      setError(res.error);
      return;
    }
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  function onRemove(url: string) {
    start(async () => { await removeProductImage(id, url); router.refresh(); });
  }

  const pick = () => !busy && fileRef.current?.click();

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        <Slot url={images[0]} label="Drop product image" w={220} h={160} busy={busy} onPick={pick} onRemove={onRemove} />
        <div className="flex flex-col gap-2.5">
          <Slot url={images[1]} label="Detail" w={105} h={75} busy={busy} onPick={pick} onRemove={onRemove} />
          <Slot url={images[2]} label="Packaging" w={105} h={75} busy={busy} onPick={pick} onRemove={onRemove} />
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
      {error && <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

function Slot({ url, label, w, h, busy, onPick, onRemove }: {
  url?: string; label: string; w: number; h: number; busy: boolean; onPick: () => void; onRemove: (url: string) => void;
}) {
  const small = h < 120;
  if (url) {
    return (
      <div className="group relative overflow-hidden rounded-xl border bg-muted" style={{ width: w, height: h }}>
        <Image src={url} alt={label} fill sizes={`${w}px`} className="object-cover" />
        <button onClick={() => onRemove(url)} className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1 text-white opacity-0 transition group-hover:opacity-100" aria-label={`Remove ${label}`}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onPick}
      disabled={busy}
      style={{ width: w, height: h }}
      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-60"
    >
      {busy ? <Loader2 className={cn("animate-spin", small ? "h-4 w-4" : "h-6 w-6")} /> : <ImageIcon className={small ? "h-4 w-4" : "h-6 w-6"} />}
      <span className={cn("font-medium", small ? "text-[11px]" : "text-sm")}>{label}</span>
      {!small && <span className="text-[11px]">or <span className="underline">browse files</span></span>}
    </button>
  );
}
