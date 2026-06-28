"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, Kpi, PageHead, Avatar, CardHeader } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useFormModal } from "@/lib/use-form-modal";
import { useBulkSelect } from "@/lib/use-bulk-select";
import { Drawer, DrawerStat } from "@/components/ui/drawer";
import { createSupplier, bulkSetSupplierArchived } from "./actions";
import { money, num, PAYTERM_TYPES, PAYTERM_BY_KEY } from "@/lib/derive";
import { cn } from "@/lib/utils";
import { Plus, ArrowRight, Info } from "lucide-react";

export type SupplierSummary = {
  name: string;
  origin: string | null;
  route: string | null;
  leadTimeDays: number | null;
  isNew: boolean | null;
  archived: boolean;
  productCount: number;
  orderCount: number;
  openOrders: number;
  openBalance: number;
};

export function SuppliersList({ suppliers, contactNames }: { suppliers: SupplierSummary[]; contactNames: string[] }) {
  const [q, setQ] = useState("");
  const [peek, setPeek] = useState<SupplierSummary | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return suppliers.filter((s) => (showArchived || !s.archived) && (!n || `${s.name} ${s.origin ?? ""} ${s.route ?? ""}`.toLowerCase().includes(n)));
  }, [suppliers, q, showArchived]);

  const bulk = useBulkSelect(filtered.map((s) => s.name));
  const archivedCount = suppliers.filter((s) => s.archived).length;
  const selItems = suppliers.filter((s) => bulk.has(s.name));
  const canArchive = selItems.some((s) => !s.archived);
  const canUnarchive = selItems.some((s) => s.archived);

  const totalProducts = suppliers.reduce((s, x) => s + x.productCount, 0);
  const openOrders = suppliers.reduce((s, x) => s + x.openOrders, 0);
  const openAP = suppliers.reduce((s, x) => s + x.openBalance, 0);

  return (
    <div className="space-y-6">
      <PageHead
        kicker="Partners"
        title="Suppliers"
        sub="Every factory you buy from — products sourced, orders in flight, lead time and what you owe."
        actions={<NewSupplierButton contactNames={contactNames} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Suppliers" value={num(suppliers.length)} sub="active factories" />
        <Kpi label="Products" value={num(totalProducts)} sub="families sourced" />
        <Kpi label="Open orders" value={num(openOrders)} sub="in flight" tone="info" />
        <Kpi label="Open AP" value={money(openAP)} sub="owed to suppliers" tone={openAP > 0 ? "warning" : "success"} />
      </div>

      <Card className="p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supplier, origin, agent"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </Card>

      {(archivedCount > 0 || bulk.size > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {archivedCount > 0 && <button onClick={() => setShowArchived((v) => !v)} className={cn("vy-chip", showArchived && "is-active")}>{showArchived ? "Hide" : "Show"} archived ({archivedCount})</button>}
          {bulk.size > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-2 rounded-xl border bg-accent/40 px-3 py-1.5 text-sm">
              <span className="font-semibold">{bulk.size} selected</span>
              <button type="button" disabled={bulk.pending || !canArchive} onClick={() => bulk.runBulk((ids) => bulkSetSupplierArchived(ids, true))} className="vy-btn vy-btn--outline vy-btn--sm disabled:opacity-40">Archive</button>
              <button type="button" disabled={bulk.pending || !canUnarchive} onClick={() => bulk.runBulk((ids) => bulkSetSupplierArchived(ids, false))} className="vy-btn vy-btn--ghost vy-btn--sm disabled:opacity-40">Unarchive</button>
              <button type="button" onClick={bulk.clear} className="vy-btn vy-btn--ghost vy-btn--sm">Clear</button>
            </div>
          )}
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader title={`${filtered.length} suppliers`} caption="Open AP = unpaid goods + agent bills on their orders" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="w-9 py-2 pl-4 pr-1"><input type="checkbox" checked={bulk.allSelected} onChange={bulk.toggleAll} className="h-4 w-4 accent-primary" aria-label="Select all" /></th>
                <th className="px-4 py-2 font-medium">Supplier</th>
                <th className="px-4 py-2 font-medium">Origin</th>
                <th className="px-4 py-2 text-right font-medium">Products</th>
                <th className="px-4 py-2 text-right font-medium">Orders</th>
                <th className="px-4 py-2 text-right font-medium">Lead time</th>
                <th className="px-4 py-2 text-right font-medium">Open AP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No suppliers match your search.</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.name} className={cn("cursor-pointer hover:bg-accent/40", s.archived && "opacity-60")} onClick={() => setPeek(s)}>
                  <td className="py-2.5 pl-4 pr-1" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={bulk.has(s.name)} onChange={() => bulk.toggle(s.name)} className="h-4 w-4 accent-primary" aria-label={`Select ${s.name}`} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={s.name} tone="brand" />
                      <div>
                        <Link href={`/suppliers/${encodeURIComponent(s.name)}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primary">{s.name}</Link>
                        {s.isNew && <Badge tone="brand" className="ml-1.5">New</Badge>}
                        {s.archived && <span className="ml-1.5 rounded bg-muted px-1 py-px text-[9px] uppercase tracking-wide">archived</span>}
                        {s.route && <div className="text-[11px] text-muted-foreground">{s.route}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.origin ?? "—"}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{num(s.productCount)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{num(s.orderCount)}<span className="text-[11px] text-info"> · {s.openOrders} open</span></td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{s.leadTimeDays ? `${s.leadTimeDays}d` : "—"}</td>
                  <td className={cn("tabular px-4 py-2.5 text-right font-mono font-semibold", s.openBalance > 0 ? "text-warning" : "text-muted-foreground")}>{s.openBalance > 0 ? money(s.openBalance) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer open={!!peek} onClose={() => setPeek(null)} title="Supplier">
        {peek && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={peek.name} tone="brand" size={44} />
              <div>
                <div className="flex items-center gap-1.5 font-medium">{peek.name}{peek.isNew && <Badge tone="brand">New</Badge>}</div>
                <div className="text-[12px] text-muted-foreground">{peek.route ?? "Direct"}{peek.origin ? ` · ${peek.origin}` : ""}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <DrawerStat label="Products" value={num(peek.productCount)} />
              <DrawerStat label="Orders" value={num(peek.orderCount)} sub={`${peek.openOrders} open`} />
              <DrawerStat label="Open AP" value={peek.openBalance > 0 ? money(peek.openBalance) : "—"} />
            </div>
            <Link href={`/suppliers/${encodeURIComponent(peek.name)}`} className="vy-btn vy-btn--primary w-full justify-center">
              Open full supplier <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </Drawer>
    </div>
  );
}

const NEW_CONTACT = "__new_contact__";
function NewSupplierButton({ contactNames }: { contactNames: string[] }) {
  const router = useRouter();
  const [term, setTerm] = useState("TT");
  const [deposit, setDeposit] = useState("30");
  const [contact, setContact] = useState("");
  const [newContact, setNewContact] = useState("");
  const { open, setOpen, error, pending, onSubmit } = useFormModal(
    (form) => createSupplier(form),
    { onSuccess: (form) => router.push(`/suppliers/${encodeURIComponent(String(form.get("name")))}`) },
  );
  const t = PAYTERM_BY_KEY[term] ?? PAYTERM_BY_KEY.TT;
  const dep = parseFloat(deposit);
  const balance = Number.isFinite(dep) ? Math.max(0, 100 - dep) : null;
  const contactValue = contact === NEW_CONTACT ? newContact : contact;

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> New supplier</PrimaryButton>
      <Modal open={open} onClose={() => setOpen(false)} title="New supplier">
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">Create a supplier record. You can fill in the full profile next.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="term_type" value={term} />
          {!t.hasDeposit && <input type="hidden" name="term_deposit_pct" value="" />}
          <input type="hidden" name="contact" value={contactValue} />
          {contact === NEW_CONTACT && newContact.trim() && <input type="hidden" name="create_contact" value="1" />}

          <Field label="Supplier name"><input name="name" required autoFocus className={inputCls} placeholder="e.g. Ningbo Auto Trim" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origin"><input name="origin" className={inputCls} placeholder="Dongguan, CN" /></Field>
            <Field label="Contact">
              <Select value={contact} onChange={setContact} placeholder="— none —" searchable
                options={[{ value: "", label: "— none —" }, ...contactNames.map((n) => ({ value: n, label: n })), { value: NEW_CONTACT, label: "＋ New contact" }]} />
            </Field>
          </div>
          {contact === NEW_CONTACT && (
            <Field label="New contact name"><input value={newContact} onChange={(e) => setNewContact(e.target.value)} autoFocus className={inputCls} placeholder="Lily Chen" /></Field>
          )}

          <div>
            <div className="vy-kicker mb-1.5">Payment terms</div>
            <div className="flex flex-wrap gap-1.5">
              {PAYTERM_TYPES.map((p) => (
                <button type="button" key={p.key} onClick={() => setTerm(p.key)} className={cn("vy-chip", term === p.key && "is-active")}>{p.label}</button>
              ))}
            </div>
            {t.hasDeposit && (
              <div className="mt-2.5 flex items-center gap-2 text-[13px]">
                <span className="text-muted-foreground">Deposit</span>
                <input name="term_deposit_pct" type="number" min={0} max={100} value={deposit} onChange={(e) => setDeposit(e.target.value)} className={cn(inputCls, "w-20 text-center")} />
                <span className="text-muted-foreground">% / {balance != null ? `${balance}% balance` : "balance"}</span>
              </div>
            )}
            <div className="mt-3 flex gap-2.5 rounded-lg border px-3 py-2.5" style={{ background: "hsl(var(--info) / 0.06)", borderColor: "hsl(var(--info) / 0.22)" }}>
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <div><div className="text-[13px] font-semibold">{t.label} · {t.name}</div><p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{t.blurb}</p></div>
            </div>
          </div>

          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Creating…" : "Create supplier"}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
