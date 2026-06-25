"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead, Avatar, CardHeader } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Drawer, DrawerStat } from "@/components/ui/drawer";
import { createPartner } from "./actions";
import { money, num, PARTNER_TYPE_TONE } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { Plus, ArrowRight } from "lucide-react";

export type PartnerSummary = {
  name: string;
  type: string;
  origin: string | null;
  specialty: string | null;
  isNew: boolean | null;
  orderCount: number;
  invoiceCount: number;
  openBalance: number;
};

const SUBLABEL: Record<string, string> = { Agent: "Trading agent", Forwarder: "Freight forwarder", Inspection: "Inspection agency" };
const CHIPS = [
  { key: "all", label: "All" }, { key: "Agent", label: "Agents" },
  { key: "Forwarder", label: "Forwarders" }, { key: "Inspection", label: "Inspections" },
];
export function PartnersList({ partners }: { partners: PartnerSummary[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [peek, setPeek] = useState<PartnerSummary | null>(null);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return partners.filter((p) => {
      if (type !== "all" && p.type !== type) return false;
      if (n && !`${p.name} ${p.type} ${p.origin ?? ""} ${p.specialty ?? ""}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [partners, q, type]);

  const agents = partners.filter((p) => p.type === "Agent").length;
  const forwarders = partners.filter((p) => p.type === "Forwarder").length;
  const inspections = partners.filter((p) => p.type === "Inspection").length;
  const openAP = partners.reduce((s, p) => s + p.openBalance, 0);

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Partners"
        title="Trading partners"
        sub="The agents, freight forwarders and inspection agencies you work with — what they've touched, and what you owe them."
        actions={<NewPartnerButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Partners" value={num(partners.length)} sub={`${agents} agents · ${forwarders} forwarders`} />
        <Kpi label="Forwarders" value={num(forwarders)} sub="freight" tone="brand" />
        <Kpi label="Inspection" value={num(inspections)} sub="QC agencies" tone="warning" />
        <Kpi label="Open AP" value={money(openAP)} sub="owed to partners" tone={openAP > 0 ? "warning" : "success"} />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search partner, origin, specialty"
            className="min-w-56 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex gap-1">
            {CHIPS.map((c) => (
              <button key={c.key} onClick={() => setType(c.key)} className={cn("vy-chip", type === c.key && "is-active")}>{c.label}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={`${filtered.length} partners`} caption="Open AP = unpaid service bills (not goods)" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Partner</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 text-right font-medium">Orders</th>
                <th className="px-4 py-2 text-right font-medium">Bills</th>
                <th className="px-4 py-2 text-right font-medium">Open AP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No partners match your filters.</td></tr>
              ) : filtered.map((p) => (
                <tr key={p.name} className="cursor-pointer hover:bg-accent/40" onClick={() => setPeek(p)}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p.name} tone={PARTNER_TYPE_TONE[p.type] ?? "muted"} />
                      <div>
                        <Link href={`/partners/${encodeURIComponent(p.name)}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primary">{p.name}</Link>
                        {p.isNew && <Badge tone="brand" className="ml-1.5">New</Badge>}
                        <div className="text-[11px] text-muted-foreground">{p.specialty ?? SUBLABEL[p.type] ?? ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><Badge tone={PARTNER_TYPE_TONE[p.type] ?? "muted"}>{p.type}</Badge></td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{p.orderCount || "—"}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{p.invoiceCount || "—"}</td>
                  <td className={cn("tabular px-4 py-2.5 text-right font-mono font-semibold", p.openBalance > 0 ? "text-warning" : "text-muted-foreground")}>{p.openBalance > 0 ? money(p.openBalance) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer open={!!peek} onClose={() => setPeek(null)} title="Partner">
        {peek && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={peek.name} tone={PARTNER_TYPE_TONE[peek.type] ?? "muted"} size={44} />
              <div>
                <div className="flex items-center gap-1.5 font-medium">{peek.name}<Badge tone={PARTNER_TYPE_TONE[peek.type] ?? "muted"}>{peek.type}</Badge>{peek.isNew && <Badge tone="brand">New</Badge>}</div>
                <div className="text-[12px] text-muted-foreground">{peek.specialty ?? SUBLABEL[peek.type] ?? ""}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <DrawerStat label="Orders" value={num(peek.orderCount)} />
              <DrawerStat label="Bills" value={num(peek.invoiceCount)} />
              <DrawerStat label="Open AP" value={peek.openBalance > 0 ? money(peek.openBalance) : "—"} />
            </div>
            <Link href={`/partners/${encodeURIComponent(peek.name)}`} className="vy-btn vy-btn--primary w-full justify-center">
              Open full partner <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function NewPartnerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await createPartner(form);
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      router.push(`/partners/${encodeURIComponent(String(form.get("name")))}`);
      router.refresh();
    });
  }

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> New partner</PrimaryButton>
      <Modal open={open} onClose={() => setOpen(false)} title="New partner">
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">Add an agent, forwarder or inspection agency. Full profile next.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Partner name"><input name="name" required autoFocus className={inputCls} placeholder="e.g. Flexport" /></Field>
            <Field label="Type">
              <select name="type" className={inputCls} defaultValue="Forwarder">
                <option>Agent</option><option>Forwarder</option><option>Inspection</option>
              </select>
            </Field>
          </div>
          <Field label="Specialty"><input name="specialty" className={inputCls} placeholder="Sea LCL · China → US West" /></Field>
          <Field label="Contact"><input name="contact" className={inputCls} placeholder="Maria Lopez" /></Field>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Creating…" : "Create partner"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
