"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { attachPaymentProof } from "../actions";
import { Loader2, Paperclip, ExternalLink, Landmark } from "lucide-react";

// Per-payment proof control: a receipt file (real) or a Mercury-linked badge (when wired).
export function PaymentProofCell({ paymentId, invoiceId, proofKind, proofUrl }: {
  paymentId: string; invoiceId: string; proofKind: string | null; proofUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `invoices/${invoiceId}/proof/${paymentId}-${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("product-media").upload(path, file, { upsert: true });
    if (!error) {
      const u = supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl;
      const r = await attachPaymentProof(paymentId, invoiceId, u);
      if (!r.ok) await supabase.storage.from("product-media").remove([path]);
    }
    setBusy(false);
    router.refresh();
  }

  if (proofKind === "mercury") return <Badge tone="info"><Landmark className="mr-1 inline h-3 w-3" />Mercury</Badge>;
  if (proofUrl) return (
    <span className="inline-flex items-center gap-1.5">
      <a href={proofUrl} target="_blank" rel="noopener noreferrer"><Badge tone="success">Receipt <ExternalLink className="ml-0.5 inline h-3 w-3" /></Badge></a>
      <button onClick={() => !busy && fileRef.current?.click()} className="text-[11px] text-muted-foreground hover:text-primary">replace</button>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={onPick} />
    </span>
  );
  return (
    <>
      <button onClick={() => !busy && fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />} Attach
      </button>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={onPick} />
    </>
  );
}
