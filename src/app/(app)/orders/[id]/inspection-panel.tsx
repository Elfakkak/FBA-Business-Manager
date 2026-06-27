"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Badge, Kpi, KpiStrip, SectionHeader, SectionTitle } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { OrderRow } from "@/lib/derive";
import {
  toggleInspectionRequired, scheduleInspection, saveInspectionReport, acceptInspectionReport,
  saveInspectionFolderLink, setInspectionResult,
} from "../actions";
import {
  ClipboardCheck, Calendar, FileText, Package, AlertTriangle, Check, Upload, Link2, ShieldCheck,
} from "lucide-react";
import type { Database } from "@/lib/database.types";

type Inspection = Database["public"]["Tables"]["order_inspections"]["Row"];
type OrderFile = { slot: string; url: string; name: string | null };

const VISIT_TYPES = ["Pre-shipment full", "During production (DUPRO)", "Container loading", "Sample review"];
const AQL_LEVELS = ["II · 2.5 / 4.0", "II · 1.5 / 2.5", "II · 4.0 / 6.5", "I · 2.5 / 4.0"];
const STATUS_LABEL: Record<string, string> = { none: "Not scheduled", scheduled: "Scheduled", completed: "Completed" };
const RESULTS = ["pass", "conditional", "fail"] as const;
const COVERAGE: [string, "reference" | "covered" | "attention"][] = [
  ["Product appearance", "reference"], ["Color consistency", "covered"], ["Stitching / material quality", "covered"],
  ["Carton labeling", "attention"], ["FNSKU / label check", "attention"], ["Carton weight check", "reference"],
  ["Quantity spot check", "covered"], ["Packaging damage", "reference"],
];
const COV_LABEL = { reference: "Reference only", covered: "Covered by report", attention: "Needs attention" } as const;
const COV_TONE = { reference: "muted", covered: "success", attention: "warning" } as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function pickFile(accept: string, onFile: (f: File) => void) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = accept;
  input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) onFile(f); };
  input.click();
}

export function InspectionPanel({ order, inspection, orderFiles }: { order: OrderRow; inspection: Inspection | null; orderFiles: OrderFile[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [scheduling, setScheduling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ---- not required -> minimal enable card ----
  if (!order.inspection_required && !inspection) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Inspection" blurb="Schedule QC, collect the report and media, and decide whether goods can be released." badges={<Badge tone="muted">Not required</Badge>} />
        <Card className="p-8 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground"><ShieldCheck className="h-5 w-5" /></span>
          <div className="font-semibold">This order doesn&apos;t need inspection</div>
          <p className="mx-auto mt-1 max-w-[40ch] text-[12px] text-muted-foreground">No QC visit is planned for this order. Mark it required if you want to book one and gate balance release on the result.</p>
          <button type="button" onClick={() => start(async () => { await toggleInspectionRequired(order.id, true); router.refresh(); })} disabled={pending} className="vy-btn vy-btn--primary mt-4 inline-flex items-center gap-1.5"><ClipboardCheck className="h-4 w-4" /> Mark inspection required</button>
        </Card>
      </div>
    );
  }

  // ---- derived state ----
  const i = inspection;
  const status = i?.status ?? "none";
  const scheduled = status !== "none";
  const result = i?.result ?? "pending";
  const aql = i?.aql ?? AQL_LEVELS[0];
  const visitType = i?.visit_type ?? VISIT_TYPES[0];
  const inspector = i?.inspector || "Unassigned";
  const dateLabel = i?.scheduled_date || "Before balance release";
  const reportUploaded = !!i?.report_url;
  const reportAccepted = reportUploaded && !!i?.report_accepted;
  const releaseOk = reportAccepted && result === "pass";
  const photos = orderFiles.filter((f) => f.slot === "inspection_photos");
  const supplierMedia = orderFiles.filter((f) => f.slot === "inspection_supplier_media");
  const attention = COVERAGE.filter(([, s]) => s === "attention").length;
  const reportState = !reportUploaded ? "Missing" : reportAccepted ? "Accepted" : "Uploaded";

  const run = (fn: () => Promise<unknown>) => start(async () => { setErr(null); await fn(); router.refresh(); });

  async function upload(slot: "report" | "inspection_photos" | "inspection_supplier_media", file: File) {
    setBusy(slot); setErr(null);
    const supabase = createClient();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `orders/${order.id}/inspection/${slot}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("product-media").upload(path, file, { upsert: true });
    if (error) { setErr(`Upload failed: ${error.message}`); setBusy(null); return; }
    const url = supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl;
    if (slot === "report") await saveInspectionReport(order.id, url, file.name);
    else { const { saveOrderFile } = await import("../actions"); await saveOrderFile(order.id, slot, url, file.name); }
    setBusy(null); router.refresh();
  }

  // ---- next action (state machine, mirrors prototype) ----
  const next = !scheduled
    ? { headline: "Schedule inspection", detail: "Pick the inspector, date, AQL level, and visit type before balance release.", severity: "warning" as const,
        cta: <button type="button" onClick={() => setScheduling(true)} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Schedule inspection</button> }
    : !reportUploaded
    ? { headline: "Upload inspection report", detail: "Inspection is booked. Upload the QC report once the visit is complete.", severity: undefined,
        cta: <button type="button" disabled={busy === "report"} onClick={() => pickFile(".pdf,.png,.jpg,.jpeg", (f) => upload("report", f))} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Upload className="h-4 w-4" /> {busy === "report" ? "Uploading…" : "Upload report"}</button> }
    : !reportAccepted
    ? { headline: "Review & accept report", detail: "Report uploaded — review the findings and accept it to unlock balance release.", severity: undefined,
        cta: <button type="button" disabled={pending} onClick={() => run(() => acceptInspectionReport(order.id))} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> Accept report</button> }
    : result === "pending"
    ? { headline: "Record result", detail: "Report accepted. Set the inspection result to clear goods for release.", severity: undefined,
        cta: <button type="button" disabled={pending} onClick={() => run(() => setInspectionResult(order.id, "pass"))} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> Mark as Pass</button> }
    : { headline: releaseOk ? "Cleared for release" : "Result recorded", detail: releaseOk ? "Report accepted and result is Pass. Balance can be released." : `Result is ${cap(result)}. Review before releasing balance.`, severity: undefined, cta: undefined };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Inspection"
        blurb="Schedule QC, collect the report and media, and decide whether goods can be released."
        badges={<>
          <Badge tone={scheduled ? "info" : "warning"}>{STATUS_LABEL[status]}</Badge>
          <Badge tone={result === "pass" ? "success" : result === "fail" ? "danger" : "muted"}>{cap(result)}</Badge>
        </>}
        nextAction={next}
      />

      <KpiStrip cols={5}>
        <Kpi label="Status" value={STATUS_LABEL[status]} sub={scheduled ? String(dateLabel) : "Not booked"} icon={ClipboardCheck} tone={scheduled ? undefined : "warning"} />
        <Kpi label="Result" value={cap(result)} sub={aql} icon={Check} tone={result === "pass" ? "success" : result === "fail" ? "danger" : undefined} />
        <Kpi label="Report" value={reportState} sub={reportUploaded ? (i?.report_name ?? "uploaded") : "Not uploaded"} icon={FileText} tone={!reportUploaded ? "warning" : reportAccepted ? "success" : "warning"} />
        <Kpi label="Media" value={String(photos.length)} sub={photos.length === 1 ? "file" : "files"} icon={Package} />
        <Kpi label="Needs attention" value={String(attention)} sub={attention ? "coverage items" : "all covered"} icon={AlertTriangle} tone={attention ? "warning" : undefined} />
      </KpiStrip>

      {/* release gate */}
      {releaseOk ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: "hsl(var(--success) / 0.08)", borderColor: "hsl(var(--success) / 0.3)" }}>
          <Badge tone="success"><Check className="h-3 w-3" /> Cleared</Badge>
          <span><span className="font-semibold">Cleared for release.</span><span className="text-muted-foreground"> Report accepted and result is Pass — balance can be released.</span></span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.3)" }}>
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span><span className="font-semibold">Balance should not be released yet.</span><span className="text-muted-foreground"> {reportUploaded ? (reportAccepted ? "Record a passing result first." : "Report must be accepted first.") : "Report must be uploaded and accepted first."}</span></span>
        </div>
      )}

      {err && <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">{err}</div>}

      {/* Inspection details */}
      <Card className="p-5">
        <SectionTitle icon={ClipboardCheck} tone="brand" strong title="Inspection details" />
        <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {[["Inspector", inspector], ["Date", String(dateLabel)], ["AQL", aql], ["Visit type", visitType]].map(([k, v]) => (
            <div key={k} className="bg-card px-4 py-3"><div className="vy-kicker">{k}</div><div className={cn("mt-0.5 text-[13px] font-semibold", k === "AQL" && "font-mono")}>{v}</div></div>
          ))}
        </div>
        {reportAccepted && result === "pending" && <ResultRecorder orderId={order.id} />}
        {(i?.defects_critical != null || i?.defects_major != null || i?.defects_minor != null) && (
          <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
            <Badge tone={i?.defects_critical ? "danger" : "muted"}>{i?.defects_critical ?? 0} critical</Badge>
            <Badge tone={i?.defects_major ? "warning" : "muted"}>{i?.defects_major ?? 0} major</Badge>
            <Badge tone="muted">{i?.defects_minor ?? 0} minor</Badge>
          </div>
        )}
      </Card>

      {/* Schedule */}
      <Card className="p-5">
        <SectionTitle icon={Calendar} tone="warning" strong title="Schedule" />
        {scheduled ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/40 px-4 py-3">
            <div className="text-sm"><span className="font-semibold">{inspector}</span><span className="text-muted-foreground"> · {String(dateLabel)} · {visitType}</span></div>
            <button type="button" onClick={() => setScheduling(true)} className="vy-btn vy-btn--outline vy-btn--sm">Edit schedule</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-background/40 px-4 py-4">
            <div><div className="text-[13px] font-semibold">Inspection is not scheduled yet</div><p className="mt-0.5 text-[11px] text-muted-foreground">Pick the inspector, date, AQL level, visit type, and factory contact before balance release.</p></div>
            <button type="button" onClick={() => setScheduling(true)} className="vy-btn vy-btn--primary inline-flex shrink-0 items-center gap-1.5"><Calendar className="h-4 w-4" /> Schedule inspection</button>
          </div>
        )}
      </Card>

      {/* Report & media */}
      <Card className="p-5">
        <SectionTitle icon={FileText} tone="info" strong title="Report & media" />
        <div className="grid gap-3 sm:grid-cols-2">
          <MediaSlot icon={FileText} title="Inspection report" sub={reportUploaded ? (reportAccepted ? `Accepted · ${i?.report_name}` : `Uploaded · ${i?.report_name}`) : "Missing"} tone={reportUploaded ? (reportAccepted ? "success" : "warning") : "muted"}
            action={reportUploaded && !reportAccepted
              ? <button type="button" disabled={pending} onClick={() => run(() => acceptInspectionReport(order.id))} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Accept</button>
              : <button type="button" disabled={busy === "report"} onClick={() => pickFile(".pdf,.png,.jpg,.jpeg", (f) => upload("report", f))} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> {busy === "report" ? "…" : reportUploaded ? "Replace" : "Upload"}</button>} />
          <MediaSlot icon={Package} title="Photos / videos" sub={`${photos.length} file${photos.length === 1 ? "" : "s"}`} tone={photos.length ? "info" : "muted"}
            action={<button type="button" disabled={busy === "inspection_photos"} onClick={() => pickFile("image/*,video/*", (f) => upload("inspection_photos", f))} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> {busy === "inspection_photos" ? "…" : "Upload"}</button>} />
          <MediaSlot icon={Link2} title="Folder link" sub={i?.folder_link ? "Linked" : "Not linked"} tone={i?.folder_link ? "info" : "muted"}
            action={<button type="button" onClick={() => { const url = window.prompt("Paste a shared folder link (Drive, Dropbox…)", i?.folder_link ?? ""); if (url != null) run(() => saveInspectionFolderLink(order.id, url)); }} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> {i?.folder_link ? "Edit" : "Link"}</button>} />
          <MediaSlot icon={Package} title="Supplier-provided media" sub={supplierMedia.length ? `${supplierMedia.length} file${supplierMedia.length === 1 ? "" : "s"}` : "Not uploaded"} tone={supplierMedia.length ? "info" : "muted"}
            action={<button type="button" disabled={busy === "inspection_supplier_media"} onClick={() => pickFile("image/*,video/*", (f) => upload("inspection_supplier_media", f))} className="vy-btn vy-btn--ghost vy-btn--sm inline-flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> {busy === "inspection_supplier_media" ? "…" : "Upload"}</button>} />
        </div>
      </Card>

      {/* Coverage reference */}
      <Card className="p-5">
        <SectionTitle icon={ClipboardCheck} tone="muted" strong title="Coverage reference" sub="Reference checklist only. Final pass/fail evidence lives in the accepted report." />
        <div className="space-y-2">
          {COVERAGE.map(([label, state]) => (
            <div key={label} className="flex items-center justify-between gap-3 rounded-lg border bg-background/40 px-4 py-2.5">
              <span className="text-[13px]">{label}</span>
              <Badge tone={COV_TONE[state]}>{COV_LABEL[state]}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {scheduling && <ScheduleModal order={order} inspection={i} onClose={() => setScheduling(false)} onSaved={() => { setScheduling(false); router.refresh(); }} />}
    </div>
  );
}

function MediaSlot({ icon: Icon, title, sub, tone, action }: { icon: React.ElementType; title: string; sub: string; tone: "success" | "warning" | "info" | "muted"; action: React.ReactNode }) {
  const tc = tone === "success" ? "bg-success/12 text-success" : tone === "warning" ? "bg-warning/12 text-warning" : tone === "info" ? "bg-info/12 text-info" : "bg-muted text-muted-foreground";
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background/40 px-3.5 py-3">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md", tc)}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{title}</div><div className="truncate text-[11px] text-muted-foreground">{sub}</div></div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

// Inline result recorder (Pass / Conditional / Fail + defect counts) once the report is accepted.
function ResultRecorder({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [crit, setCrit] = useState(""); const [maj, setMaj] = useState(""); const [min, setMin] = useState("");
  const num = (s: string) => { const n = Number(s); return s.trim() === "" || !Number.isFinite(n) ? null : n; };
  const record = (result: string) => start(async () => { await setInspectionResult(orderId, result, { critical: num(crit), major: num(maj), minor: num(min) }); router.refresh(); });
  return (
    <div className="mt-3 rounded-lg border bg-accent/40 p-3">
      <div className="mb-2 text-[12px] font-semibold">Record result</div>
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="block"><span className="vy-kicker">Critical</span><input value={crit} onChange={(e) => setCrit(e.target.value)} inputMode="numeric" className="mt-0.5 w-20 rounded-md border bg-background px-2 py-1 font-mono text-[12px]" placeholder="0" /></label>
        <label className="block"><span className="vy-kicker">Major</span><input value={maj} onChange={(e) => setMaj(e.target.value)} inputMode="numeric" className="mt-0.5 w-20 rounded-md border bg-background px-2 py-1 font-mono text-[12px]" placeholder="0" /></label>
        <label className="block"><span className="vy-kicker">Minor</span><input value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" className="mt-0.5 w-20 rounded-md border bg-background px-2 py-1 font-mono text-[12px]" placeholder="0" /></label>
        <div className="ml-auto flex gap-1.5">
          {RESULTS.map((r) => (
            <button key={r} type="button" disabled={pending} onClick={() => record(r)} className={cn("vy-btn vy-btn--sm", r === "pass" ? "vy-btn--primary" : "vy-btn--outline")}>{cap(r)}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScheduleModal({ order, inspection, onClose, onSaved }: { order: OrderRow; inspection: Inspection | null; onClose: () => void; onSaved: () => void }) {
  const [inspector, setInspector] = useState(inspection?.inspector && inspection.inspector !== "Unassigned" ? inspection.inspector : "");
  const [date, setDate] = useState(inspection?.scheduled_date ?? "");
  const [visitType, setVisitType] = useState(inspection?.visit_type ?? VISIT_TYPES[0]);
  const [aql, setAql] = useState(inspection?.aql ?? AQL_LEVELS[0]);
  const [contact, setContact] = useState(inspection?.factory_contact ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const valid = inspector.trim() && date.trim();

  const save = async () => {
    setSaving(true); setErr(null);
    const r = await scheduleInspection(order.id, { inspector, scheduled_date: date, visit_type: visitType, aql, factory_contact: contact });
    setSaving(false);
    if (r.ok) onSaved(); else setErr(r.error);
  };

  return (
    <Modal open onClose={onClose} title="Schedule inspection" subtitle="Book the QC visit. This sets the inspection to Scheduled; upload the report after the visit."
      footer={<div className="flex justify-end gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="button" onClick={save} disabled={!valid || saving} className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {saving ? "Scheduling…" : "Schedule"}</PrimaryButton></div>}
    >
      <div className="space-y-4">
        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Inspector"><input className={inputCls} value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="e.g. QIMA · Wang L." autoFocus /></Field>
          <Field label="Date"><input className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} placeholder="e.g. Jan 10" /></Field>
          <Field label="Visit type"><Select value={visitType} onChange={setVisitType} options={VISIT_TYPES.map((v) => ({ value: v, label: v }))} /></Field>
          <Field label="AQL level"><Select value={aql} onChange={setAql} options={AQL_LEVELS.map((a) => ({ value: a, label: a }))} /></Field>
        </div>
        <Field label="Factory contact (optional)"><input className={inputCls} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. Mr. Chen · +86 …" /></Field>
      </div>
    </Modal>
  );
}
