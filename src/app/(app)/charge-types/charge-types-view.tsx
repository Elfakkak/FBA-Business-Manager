"use client";

import { useState, useTransition } from "react";
import { Card, Badge, Kpi, PageHead } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { num, type Tone } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { createChargeType, updateChargeType, setChargeTypeArchived } from "./actions";
import { Tags, Users, Archive, Plus, Pencil, RotateCcw } from "lucide-react";

export type ChargeType = { id: string; label: string; owner: string; archived: boolean };

const OWNERS = ["Supplier", "Agent", "Forwarder", "Inspection", "Broker", "—"];
const OWNER_TONE: Record<string, Tone> = { Supplier: "brand", Agent: "info", Forwarder: "info", Inspection: "warning", Broker: "danger", "—": "muted" };

export function ChargeTypesView({ rows }: { rows: ChargeType[] }) {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState<"new" | ChargeType | null>(null);
  const [pending, start] = useTransition();

  const active = rows.filter((r) => !r.archived);
  const archivedCount = rows.length - active.length;
  const ownersUsed = new Set(active.map((r) => r.owner).filter((o) => o !== "—")).size;
  const visible = showArchived ? rows : active;
  const groups = OWNERS.filter((o) => visible.some((r) => r.owner === o)).map((o) => ({ owner: o, items: visible.filter((r) => r.owner === o) }));

  const toggleArchive = (r: ChargeType) => start(async () => { await setChargeTypeArchived(r.id, !r.archived); router.refresh(); });

  return (
    <div className="space-y-6">
      <PageHead kicker="Catalog" title="Charge types"
        sub="Your vocabulary of non-product costs — agent fees, freight, packaging, inspection, duties. Tag invoice service lines with these so spend rolls up by category."
        actions={<button onClick={() => setModal("new")} className="vy-btn vy-btn--primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> New charge type</button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Charge types" value={num(active.length)} sub="active in the catalog" icon={Tags} />
        <Kpi label="Billed by" value={num(ownersUsed)} sub="vendor roles" icon={Users} />
        <Kpi label="Tracked spend" value="—" sub="needs invoice line tagging" icon={Tags} tone="muted" />
        <Kpi label="Archived" value={num(archivedCount)} sub="hidden from pickers" icon={Archive} tone={archivedCount ? "warning" : undefined} />
      </div>

      {archivedCount > 0 && (
        <button onClick={() => setShowArchived((v) => !v)} className={cn("vy-chip", showArchived && "is-active")}>{showArchived ? "Hide" : "Show"} archived ({archivedCount})</button>
      )}

      {groups.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">No charge types yet — add one to start your catalog.</Card>
      ) : groups.map((g) => (
        <Card key={g.owner} className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b px-5 py-3"><span className="vy-kicker">Billed by</span><Badge tone={OWNER_TONE[g.owner] ?? "muted"}>{g.owner}</Badge><span className="text-[11px] text-muted-foreground">{g.items.length} type{g.items.length === 1 ? "" : "s"}</span></div>
          <ul className="divide-y">
            {g.items.map((r) => (
              <li key={r.id} className={cn("flex items-center gap-3 px-5 py-3", r.archived && "opacity-55")}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Tags className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{r.label}{r.archived && <Badge tone="muted" className="ml-2">Archived</Badge>}</div><div className="font-mono text-[11px] text-muted-foreground">{r.id}</div></div>
                <button onClick={() => setModal(r)} className="vy-icon-btn" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => toggleArchive(r)} disabled={pending} className="vy-icon-btn" aria-label={r.archived ? "Restore" : "Archive"}>{r.archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}</button>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {modal && <ChargeTypeModal ct={modal === "new" ? undefined : modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function ChargeTypeModal({ ct, onClose }: { ct?: ChargeType; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [owner, setOwner] = useState(ct?.owner ?? "Supplier");
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => { const r = ct ? await updateChargeType(ct.id, fd) : await createChargeType(fd); if (!r.ok) { setErr(r.error); return; } onClose(); router.refresh(); });
  }
  return (
    <Modal open onClose={onClose} title={ct ? "Edit charge type" : "New charge type"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Label"><input name="label" required autoFocus defaultValue={ct?.label ?? ""} className={inputCls} placeholder="e.g. Inland trucking" /></Field>
        <Field label="Billed by"><Select name="owner" value={owner} onChange={setOwner} options={OWNERS.map((o) => ({ value: o, label: o === "—" ? "— (unassigned)" : o }))} /></Field>
        {err && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</PrimaryButton></div>
      </form>
    </Modal>
  );
}
