"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, SectionTitle } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { useFormModal } from "@/lib/use-form-modal";
import { logNewSize, addTechPack } from "../actions";
import { sizeCompliance, storagePerUnit, inFromCm, lbFromKg, money, num, type Dim } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { Ruler, FileText, Boxes, Package, Check, X, Plus, History, Upload, Loader2, ExternalLink } from "lucide-react";

const dimStr = (d: Dim, unit: "cm" | "in") => {
  if (!d || !(d.l || d.w || d.h)) return "—";
  const f = (n?: number | null) => (n == null ? "?" : unit === "in" ? inFromCm(n) : n);
  return `${f(d.l)} × ${f(d.w)} × ${f(d.h)} ${unit}`;
};

// ---------- Storage assumption bar ----------
export function StorageBar({ dimCm }: { dimCm: Dim }) {
  const [months, setMonths] = useState(1);
  const [peak, setPeak] = useState(false);
  const perUnit = storagePerUnit(dimCm, months, peak);
  const rate = peak ? 2.4 : 0.78;
  return (
    <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground"><Boxes className="h-4 w-4" /> Storage assumption</span>
      <span className="flex items-center gap-1.5">Hold
        <input type="number" min={1} max={12} value={months} onChange={(e) => setMonths(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
          className="h-7 w-14 rounded border bg-background px-2 text-center font-mono text-sm outline-none focus:ring-2 focus:ring-ring" /> mo</span>
      <button onClick={() => setPeak((p) => !p)} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        peak ? "border-warning/40 bg-warning/10 text-warning" : "text-muted-foreground")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", peak ? "bg-warning" : "bg-muted-foreground")} /> Q4 peak rate
      </button>
      <span className="ml-auto text-[12px] text-muted-foreground tabular">
        {money(rate)}/ft³/mo · <span className="font-mono font-semibold text-foreground">{money(perUnit)}</span>/unit
      </span>
    </Card>
  );
}

// ---------- Dimensions & weight ----------
type HistEntry = { date?: string; dimCm?: Dim; weightKg?: number | null; cartonCm?: Dim; unitsPerCarton?: number | null; note?: string | null };
export function DimensionsCard({ id, dimCm, weightKg, cartonCm, unitsPerCarton, history }: {
  id: string; dimCm: Dim; weightKg: number | null; cartonCm: Dim; unitsPerCarton: number | null; history: HistEntry[];
}) {
  const [open, setOpen] = useState(false);
  const c = sizeCompliance(dimCm, weightKg);
  const sorted = [...history].reverse();

  return (
    <Card className="p-5">
      <SectionTitle icon={Ruler} tone="brand" title="Dimensions & weight" sub="Log a new size to update the current values — each change is kept in history (it affects your FBA fees)."
        action={<GhostButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Log new size</GhostButton>} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="vy-kicker mb-2 flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Product — each unit</div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Spec label="Size" big={dimStr(dimCm, "cm")} small={dimCm && (dimCm.l || dimCm.w || dimCm.h) ? dimStr(dimCm, "in") : undefined} />
            <Spec label="Weight" big={weightKg ? `${weightKg} kg` : "—"} small={weightKg ? `${lbFromKg(weightKg)} lb` : undefined} />
          </dl>
        </div>
        <div>
          <div className="vy-kicker mb-2 flex items-center gap-1.5"><Boxes className="h-3.5 w-3.5" /> Master carton</div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Spec label="Size" big={dimStr(cartonCm, "cm")} small={cartonCm && (cartonCm.l || cartonCm.w || cartonCm.h) ? dimStr(cartonCm, "in") : undefined} />
            <Spec label="Pieces / box" big={unitsPerCarton ? num(unitsPerCarton) : "—"} />
          </dl>
        </div>
      </div>

      {/* size compliance */}
      <div className={cn("mt-4 rounded-lg border p-3",
        c.tone === "success" ? "border-success/30 bg-success/10" : "border-danger/30 bg-danger/10")}>
        <div className="flex items-center gap-2">
          {c.tone === "success" ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-danger" />}
          <span className={cn("text-sm font-medium", c.tone === "success" ? "text-success" : "text-danger")}>{c.label}</span>
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">{c.detail}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <LimitChip ok={c.stdOk} label="Amazon standard max" value="18 × 14 × 8 in · 20 lb" />
          <LimitChip ok={c.awdOk} label="AWD carton max" value="≤ 25 in side · ≤ 50 lb" />
        </div>
      </div>

      {/* history */}
      <div className="mt-4">
        <div className="vy-kicker mb-2 flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Size & weight history</div>
        {sorted.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No changes logged yet. Use <strong>Log new size</strong> — old values are saved here with the date.</p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12px]">
                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", i === 0 ? "bg-primary" : "bg-muted-foreground")} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span>Product {dimStr(h.dimCm ?? null, "cm")}{h.weightKg ? ` · ${h.weightKg} kg` : ""}</span>
                    {i === 0 && <Badge tone="success">Current</Badge>}
                  </div>
                  {h.note && <div className="text-muted-foreground">{h.note}</div>}
                </div>
                <span className="text-muted-foreground">{h.date ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && <LogSizeModal id={id} onClose={() => setOpen(false)} />}
    </Card>
  );
}

function Spec({ label, big, small }: { label: string; big: string; small?: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{big}{small && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{small}</span>}</dd>
    </div>
  );
}
function LimitChip({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-[11px]">
      {ok ? <Check className="h-3 w-3 text-success" /> : <X className="h-3 w-3 text-danger" />}
      <span className="font-medium">{label}</span><span className="text-muted-foreground">{value}</span>
    </span>
  );
}

function LogSizeModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { error, pending, onSubmit } = useFormModal((form) => logNewSize(id, form), { onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="Log new size">
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">Centimeters &amp; kilograms. Current values move into history.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Product dimensions (cm) — L × W × H">
          <div className="grid grid-cols-3 gap-2">
            <input name="dim_l" type="number" step="0.1" className={inputCls} placeholder="L" />
            <input name="dim_w" type="number" step="0.1" className={inputCls} placeholder="W" />
            <input name="dim_h" type="number" step="0.1" className={inputCls} placeholder="H" />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Product weight (kg)"><input name="weight_kg" type="number" step="0.01" className={inputCls} /></Field>
          <Field label="Pieces per box"><input name="units_per_carton" type="number" className={inputCls} /></Field>
        </div>
        <Field label="Master carton (cm) — L × W × H">
          <div className="grid grid-cols-3 gap-2">
            <input name="carton_l" type="number" step="0.1" className={inputCls} placeholder="L" />
            <input name="carton_w" type="number" step="0.1" className={inputCls} placeholder="W" />
            <input name="carton_h" type="number" step="0.1" className={inputCls} placeholder="H" />
          </div>
        </Field>
        <Field label="Note (optional)"><input name="note" className={inputCls} placeholder="e.g. Optimized carton — thinner packaging" /></Field>
        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save size"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Tech pack ----------
type Pack = { id: string; version: number; file_name: string; note: string | null; doc_date: string | null; asset_ref?: string | null; file_size?: number | null };

const fmtSize = (b?: number | null) => (b == null ? null : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

// Tech packs live in a private bucket; open them through a short-lived signed URL.
function ViewTechPackButton({ path }: { path: string }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    const { data } = await supabase.storage.from("tech-packs").createSignedUrl(path, 3600);
    setBusy(false);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  return (
    <button onClick={open} disabled={busy} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline disabled:opacity-60">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />} View PDF
    </button>
  );
}

export function TechPackCard({ familyId, packs }: { familyId: string; packs: Pack[] }) {
  const [open, setOpen] = useState(false);
  const sorted = [...packs].sort((a, b) => b.version - a.version);
  const latest = sorted[0];

  return (
    <Card className="p-5">
      <SectionTitle icon={FileText} tone="warning" title="Tech pack" sub="The product spec (PDF) the factory builds to. Every upload is a new version — history is kept."
        action={<GhostButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Upload new version</GhostButton>} />
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-background/40 px-4 py-8 text-center">
          <span className="inline-grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground"><FileText className="h-5 w-5" /></span>
          <div className="text-sm text-muted-foreground">No tech pack yet — upload the factory spec PDF.</div>
          <PrimaryButton onClick={() => setOpen(true)} className="mt-1 inline-flex items-center gap-1.5"><Upload className="h-4 w-4" /> Upload tech pack</PrimaryButton>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-primary" /><span className="font-medium">v{latest.version}</span><Badge tone="brand">Latest</Badge>
              {latest.asset_ref && <span className="ml-auto"><ViewTechPackButton path={latest.asset_ref} /></span>}
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">{[latest.file_name, fmtSize(latest.file_size), latest.doc_date].filter(Boolean).join(" · ")}</div>
            {latest.note && <div className="text-[12px] text-muted-foreground">{latest.note}</div>}
          </div>
          {sorted.length > 1 && <div className="vy-kicker pt-1">Previous versions</div>}
          {sorted.slice(1).map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-[12px]">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">v{p.version}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{[p.file_name, p.note].filter(Boolean).join(" · ")}</span>
              <span className="text-muted-foreground">{p.doc_date}</span>
              {p.asset_ref && <ViewTechPackButton path={p.asset_ref} />}
            </div>
          ))}
        </div>
      )}
      {open && <TechPackModal familyId={familyId} nextVersion={(latest?.version ?? 0) + 1} onClose={() => setOpen(false)} />}
    </Card>
  );
}

function TechPackModal({ familyId, nextVersion, onClose }: { familyId: string; nextVersion: number; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) { setError("Choose a PDF first."); return; }
    setError(null); setBusy(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    // private bucket — tech packs are confidential factory specs, served via signed URLs
    const path = `${familyId}/v${nextVersion}-${safe}`;
    const { error: upErr } = await supabase.storage.from("tech-packs").upload(path, file, { upsert: true });
    if (upErr) { setError(upErr.message); setBusy(false); return; }
    const form = new FormData();
    form.set("file_name", file.name);
    form.set("asset_ref", path); // store the path, not a public URL
    form.set("file_size", String(file.size));
    form.set("note", note);
    const res = await addTechPack(familyId, form);
    setBusy(false);
    if (!res.ok) {
      await supabase.storage.from("tech-packs").remove([path]); // roll back orphan
      setError(res.error);
      return;
    }
    onClose(); router.refresh();
  }

  return (
    <Modal open onClose={onClose} title={`Tech pack · v${nextVersion}`}>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">Upload the product spec PDF. It&apos;s saved as version {nextVersion}; older versions stay in history.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary">
          <Upload className="h-5 w-5" />
          <span>{file ? file.name : "Choose a PDF — click to browse"}</span>
          <input type="file" accept="application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <Field label="What changed (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="e.g. Updated stitching spec + new colorway" /></Field>
        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={busy || !file} className="inline-flex items-center gap-1.5">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : `Save v${nextVersion}`}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
