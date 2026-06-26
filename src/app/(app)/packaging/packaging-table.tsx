"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/primitives";
import { Drawer, DrawerStat } from "@/components/ui/drawer";
import { Field, inputCls, PrimaryButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { money, num, type PackagingItem, type PackagingMove } from "@/lib/derive";
import { updatePackaging, savePackagingDesign, setPackagingSkus } from "./actions";
import { ReceiveButton } from "./packaging-actions";
import { cn } from "@/lib/utils";
import { Boxes, ImagePlus, ExternalLink, Loader2, X } from "lucide-react";

const KINDS = ["Mailer", "Master carton", "Insert", "Polybag", "Label", "Box", "Other"];

type VariantOpt = { id: string; sku: string; name: string };
export type PkgRow = { item: PackagingItem; onHand: number; unit: number; value: number; low: boolean; product: string | null };

export function PackagingTable({ rows, moves, products, variants }: { rows: PkgRow[]; moves: PackagingMove[]; products: { id: string; parent: string }[]; variants: VariantOpt[] }) {
  const [peek, setPeek] = useState<PkgRow | null>(null);
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Packaging</th>
              <th className="px-4 py-2 font-medium">Size</th>
              <th className="px-4 py-2 font-medium">For product</th>
              <th className="px-4 py-2 text-right font-medium">On hand</th>
              <th className="px-4 py-2 text-right font-medium">Unit cost</th>
              <th className="px-4 py-2 text-right font-medium">Value</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No packaging yet.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.item.id} onClick={() => setPeek(r)} className="cursor-pointer hover:bg-accent/40">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="relative inline-grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border bg-info/10 text-info">
                      {r.item.design_url ? <Image src={r.item.design_url} alt="" fill sizes="36px" className="object-cover" /> : <Boxes className="h-4 w-4" />}
                    </span>
                    <div><div className="font-medium">{r.item.name}</div><div className="text-[11px] text-muted-foreground">{r.item.kind}</div></div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[12px] text-muted-foreground">{r.item.size || "—"}</td>
                <td className="px-4 py-2.5">{r.product ? <Badge tone="brand">{r.product}</Badge> : <span className="text-muted-foreground">Any product</span>}</td>
                <td className={cn("tabular px-4 py-2.5 text-right font-mono font-semibold", r.low && "text-warning")}>{num(r.onHand)}</td>
                <td className="tabular px-4 py-2.5 text-right font-mono text-muted-foreground">{money(r.unit)}</td>
                <td className="tabular px-4 py-2.5 text-right font-mono">{money(r.value)}</td>
                <td className="px-4 py-2.5">{r.low ? <Badge tone="warning">Reorder</Badge> : <Badge tone="success">In stock</Badge>}</td>
                <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}><ReceiveButton itemId={r.item.id} name={r.item.name} onHand={r.onHand} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={!!peek} onClose={() => setPeek(null)} title={peek?.item.name}>
        {peek && <PackagingDetail key={peek.item.id} row={peek} moves={moves.filter((m) => m.item_id === peek.item.id)} products={products} variants={variants} onDone={() => setPeek(null)} />}
      </Drawer>
    </Card>
  );
}

function PackagingDetail({ row, moves, products, variants, onDone }: { row: PkgRow; moves: PackagingMove[]; products: { id: string; parent: string }[]; variants: VariantOpt[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const it = row.item;
  const [kind, setKind] = useState<string>(it.kind);
  const [familyId, setFamilyId] = useState<string>(it.family_id ?? "");

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setErr(null);
    start(async () => { const r = await updatePackaging(it.id, form); if (!r.ok) { setErr(r.error); return; } onDone(); router.refresh(); });
  }
  const history = [...moves].sort((a, b) => (b.move_date ?? "").localeCompare(a.move_date ?? ""));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <DrawerStat label="On hand" value={num(row.onHand)} />
        <DrawerStat label="Unit cost" value={money(row.unit)} />
        <DrawerStat label="Value" value={money(row.value)} />
      </div>

      <PackagingDesign id={it.id} url={it.design_url} name={it.name} />

      <form onSubmit={onSave} className="space-y-3">
        <div className="vy-kicker">Details</div>
        <Field label="Name"><input name="name" defaultValue={it.name} required className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select name="kind" value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: k }))} /></Field>
          <Field label="Size"><input name="size" defaultValue={it.size ?? ""} className={inputCls} placeholder="e.g. 10×13 in" /></Field>
          <Field label="For product">
            <Select name="family_id" value={familyId} onChange={setFamilyId} placeholder="Any product"
              options={[{ value: "", label: "Any product" }, ...products.map((p) => ({ value: p.id, label: p.parent }))]} />
          </Field>
          <Field label="Unit cost"><input name="unit_cost" type="number" step="0.01" defaultValue={it.unit_cost} className={inputCls} /></Field>
          <Field label="Reorder point"><input name="reorder_point" type="number" defaultValue={it.reorder_point ?? ""} className={inputCls} /></Field>
        </div>
        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end"><PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</PrimaryButton></div>
      </form>

      <UsedForSkus itemId={it.id} assigned={it.variant_ids ?? []} variants={variants} />

      <div>
        <div className="vy-kicker mb-2">Move history ({history.length})</div>
        {history.length === 0 ? <p className="text-[12px] text-muted-foreground">No moves yet.</p> : (
          <ul className="space-y-1.5">
            {history.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-[12px]">
                <Badge tone={m.type === "receive" ? "success" : m.type === "consume" ? "warning" : "muted"}>{m.type}</Badge>
                <span className={cn("tabular font-mono font-semibold", m.type === "consume" ? "text-warning" : "text-success")}>{m.type === "consume" ? "−" : "+"}{num(Math.abs(m.qty))}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{m.source || m.note || ""}</span>
                <span className="text-muted-foreground">{m.move_date}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function UsedForSkus({ itemId, assigned, variants }: { itemId: string; assigned: string[]; variants: VariantOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const byId = new Map(variants.map((v) => [v.id, v]));
  const chosen = assigned.filter((id) => byId.has(id));
  const available = variants.filter((v) => !assigned.includes(v.id));

  const save = (ids: string[]) => start(async () => { await setPackagingSkus(itemId, ids); router.refresh(); });

  return (
    <div>
      <div className="vy-kicker mb-2">Used for SKUs <span className="font-normal normal-case text-muted-foreground">— organizing only, doesn&apos;t affect stock</span></div>
      {chosen.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chosen.map((id) => {
            const v = byId.get(id)!;
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pl-2 pr-1 font-mono text-[11px]">
                {v.sku}
                <button onClick={() => save(assigned.filter((x) => x !== id))} disabled={pending} className="rounded p-0.5 hover:bg-danger/10 hover:text-danger" aria-label="Remove"><X className="h-3 w-3" /></button>
              </span>
            );
          })}
        </div>
      )}
      <Select value="" disabled={pending || available.length === 0} placeholder={available.length === 0 ? "All SKUs assigned" : "＋ Assign a SKU…"}
        onChange={(v) => v && save([...assigned, v])}
        options={available.map((v) => ({ value: v.id, label: v.sku, sub: v.name }))} />
    </div>
  );
}

function PackagingDesign({ id, url, name }: { id: string; url: string | null; name: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();
  const isImg = !!url && !/\.pdf($|\?)/i.test(url);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `packaging/${id}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("product-media").upload(path, file, { upsert: true });
    if (!error) {
      const u = supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl;
      const res = await savePackagingDesign(id, u);
      if (!res.ok) await supabase.storage.from("product-media").remove([path]);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div className="vy-kicker mb-2">Design artwork</div>
      <div className="flex items-center gap-3">
        <button onClick={() => !busy && fileRef.current?.click()} className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed bg-muted text-muted-foreground transition hover:border-primary/40">
          {url && isImg ? <Image src={url} alt={name} fill sizes="96px" className="object-cover" /> : busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
        </button>
        <div className="text-[12px] text-muted-foreground">
          {busy ? "Uploading…" : url ? "Design attached." : "No design yet — drop the artwork (image or PDF)."}
          {url && <div className="mt-1 flex gap-3">
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">View <ExternalLink className="h-3.5 w-3.5" /></a>
            <button onClick={() => !busy && fileRef.current?.click()} className="font-medium text-primary hover:underline">Replace</button>
          </div>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={onPick} />
    </div>
  );
}
