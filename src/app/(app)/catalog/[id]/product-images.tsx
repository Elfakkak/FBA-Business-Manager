"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addProductImage, removeProductImage } from "../actions";
import { ImagePlus, X, Loader2 } from "lucide-react";

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
    if (!res.ok) { setError(res.error); return; }
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  function onRemove(url: string) {
    start(async () => { await removeProductImage(id, url); router.refresh(); });
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((url) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
            <Image src={url} alt="" fill sizes="160px" className="object-cover" />
            <button onClick={() => onRemove(url)} className="absolute right-1 top-1 rounded-md bg-black/50 p-1 text-white opacity-0 transition group-hover:opacity-100" aria-label="Remove">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-[11px]">{busy ? "Uploading…" : "Add image"}</span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
      {error && <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
