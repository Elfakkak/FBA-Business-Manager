"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, PageHead } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { INTG_STATUS_TONE, INTG_STATUS_LABEL, intgAgo, type IntegrationDef } from "@/lib/integrations";
import { connectIntegration, syncIntegration, disconnectIntegration } from "../integrations/actions";
import { saveBusiness, saveBrand, saveNotifications, inviteMember, updateMember, removeMember } from "./actions";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Activity, Factory, Package, User, Bell, RefreshCw, Plug, Pencil, Plus, X } from "lucide-react";

type IntgState = { def: IntegrationDef; status: string; lastSync: string | null; note: string | null };
type Member = { id: string; name: string; email: string | null; role: string; status: string; is_you: boolean; is_owner: boolean; share: number | null; fin_id: string | null };
type BrandRow = Record<string, unknown> | null;
type BizRow = Record<string, unknown> | null;

const SECTIONS = [
  { key: "integrations", label: "Integrations", icon: Activity },
  { key: "business", label: "Business profile", icon: Factory },
  { key: "brand", label: "Brand", icon: Package },
  { key: "team", label: "Team & roles", icon: User },
  { key: "notifications", label: "Notifications", icon: Bell },
] as const;

export function SettingsView(props: { integrations: IntgState[]; brand: BrandRow; business: BizRow; prefs: Record<string, boolean>; members: Member[] }) {
  const [section, setSection] = useState<string>("integrations");
  return (
    <div className="space-y-6">
      <PageHead kicker="Workspace" title="Settings" sub="Connections, business details and the people who can access Vyonix." />
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-52 lg:flex-col">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button key={s.key} onClick={() => setSection(s.key)}
                className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap transition",
                  section === s.key ? "bg-primary/12 font-medium text-primary" : "text-muted-foreground hover:bg-accent")}>
                <Icon className="h-4 w-4" /> {s.label}
              </button>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1">
          {section === "integrations" && <IntegrationsHub items={props.integrations} />}
          {section === "business" && <BusinessSection business={props.business} />}
          {section === "brand" && <BrandSection brand={props.brand} />}
          {section === "team" && <TeamSection members={props.members} />}
          {section === "notifications" && <NotificationsSection prefs={props.prefs} />}
        </div>
      </div>
    </div>
  );
}

// ---------- Integrations hub ----------
function IntegrationsHub({ items }: { items: IntgState[] }) {
  const connected = items.filter((i) => i.status === "connected").length;
  const errors = items.filter((i) => i.status === "error").length;
  const available = items.filter((i) => i.status === "disconnected").length;
  return (
    <div className="space-y-3">
      <Card className="p-5">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">Connect Vyonix to the tools that feed your data. Amazon drives the sync status on Inventory &amp; FBA Shipments.</p>
        <div className="mt-3 flex gap-5 text-sm">
          <Dot tone="bg-success" label="Connected" value={connected} />
          <Dot tone="bg-danger" label="Needs attention" value={errors} />
          <Dot tone="bg-muted-foreground" label="Available" value={available} />
        </div>
      </Card>
      {items.map((it) => <IntgRow key={it.def.id} state={it} />)}
    </div>
  );
}
function Dot({ tone, label, value }: { tone: string; label: string; value: number }) {
  return <span className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", tone)} /><strong>{value}</strong><span className="text-muted-foreground">{label}</span></span>;
}
function IntgRow({ state }: { state: IntgState }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { def, status, lastSync, note } = state;
  const connected = status === "connected";
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (!r.ok) setError(r.error ?? "Failed"); router.refresh(); });

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <span className={cn("inline-grid h-11 w-11 shrink-0 place-items-center rounded-xl font-bold", connected ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>{def.name[0]}</span>
      <div className="min-w-[200px] flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/integrations/${def.id}`} className="font-semibold hover:text-primary">{def.name}</Link>
          {def.primary && <Badge tone="brand">Primary</Badge>}
          <Badge tone={INTG_STATUS_TONE[status] ?? "muted"}>{INTG_STATUS_LABEL[status] ?? status}</Badge>
        </div>
        <p className="text-[12px] text-muted-foreground">{def.syncs}</p>
        <p className="text-[11px] text-muted-foreground">
          {connected ? <>Last sync {intgAgo(lastSync)}{def.account ? ` · ${def.account}` : ""}</> : note ? <span className="text-danger">{note}</span> : `Not connected — ${def.blurb.slice(0, 60)}…`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {connected ? (
          <>
            <button onClick={() => run(() => syncIntegration(def.id))} disabled={pending} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Sync now</button>
            <button onClick={() => run(() => disconnectIntegration(def.id))} disabled={pending} className="vy-btn vy-btn--ghost vy-btn--sm text-danger">Disconnect</button>
          </>
        ) : (
          <button onClick={() => setOpen(true)} className="vy-btn vy-btn--primary vy-btn--sm inline-flex items-center gap-1.5"><Plug className="h-3.5 w-3.5" /> Connect</button>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={`Connect ${def.name}`}>
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">Credentials stored server-side (owner-only). Live sync activates once the {def.name} fetch is wired.</p>
        <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setError(null); start(async () => { const r = await connectIntegration(def.id, f); if (!r.ok) { setError(r.error); return; } setOpen(false); router.refresh(); }); }} className="space-y-4">
          {def.creds.map((c) => <Field key={c.name} label={c.label}><input name={c.name} type={c.type === "password" ? "password" : "text"} required autoComplete="off" className={inputCls} /></Field>)}
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2"><GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save & connect"}</PrimaryButton></div>
        </form>
      </Modal>
    </Card>
  );
}

// ---------- Business profile ----------
const BIZ_FIELDS: [string, string][] = [
  ["company", "Legal company name"], ["entity_type", "Entity type"], ["state_of_formation", "State of formation"],
  ["formation_date", "Formation date"], ["ein", "EIN"], ["registered_agent", "Registered agent"],
  ["email", "Email"], ["phone", "Phone"], ["website", "Website"],
  ["address", "Street"], ["city", "City"], ["state", "State"], ["zip", "ZIP"], ["country", "Country"],
];
function BusinessSection({ business }: { business: BizRow }) {
  return <EditCard title="Business profile" sub="Your LLC's legal details — appear on POs, invoices and exports." action={saveBusiness} fields={BIZ_FIELDS} data={business} />;
}

// ---------- Brand ----------
const BRAND_FIELDS: [string, string][] = [
  ["name", "Brand name"], ["tagline", "Tagline"], ["color", "Brand color (hex)"], ["established", "Established"],
  ["registry_id", "Brand Registry ID"], ["store_url", "Amazon Store URL"],
  ["tm_number", "Trademark number"], ["tm_status", "TM status"], ["tm_jurisdiction", "Jurisdiction"], ["tm_owner", "TM owner"],
  ["website", "Website"], ["support_email", "Support email"],
];
function BrandSection({ brand }: { brand: BrandRow }) {
  const b = brand ?? {};
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <span className="inline-grid h-20 w-20 place-items-center rounded-2xl bg-muted text-2xl font-bold text-muted-foreground">{String(b.name ?? "V")[0]}</span>
        <div>
          <div className="text-2xl font-bold tracking-tight">{String(b.name ?? "—")}</div>
          <div className="text-sm text-muted-foreground">{String(b.tagline ?? "")}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={b.registry_enrolled ? "success" : "muted"}>{b.registry_enrolled ? "Brand Registry ✓" : "Not enrolled"}</Badge>
            {b.tm_status ? <Badge tone="muted">{String(b.tm_status)}</Badge> : null}
            {b.color ? <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><span className="h-3 w-3 rounded border" style={{ background: String(b.color) }} />{String(b.color)}</span> : null}
          </div>
        </div>
      </Card>
      <EditCard title="Brand" sub="Your private-label brand registry — the catalog and listings read these details."
        action={saveBrand} fields={BRAND_FIELDS} data={brand}
        toggles={[["registry_enrolled", "Enrolled in Brand Registry"], ["gtin_exempt", "GTIN exemption"]]} />
    </div>
  );
}

// generic editable card (view tiles -> edit inputs)
function EditCard({ title, sub, action, fields, data, toggles }: {
  title: string; sub: string; action: (f: FormData) => Promise<{ ok: boolean; error?: string }>;
  fields: [string, string][]; data: Record<string, unknown> | null; toggles?: [string, string][];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const d = data ?? {};

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => { const r = await action(form); if (!r.ok) { setError(r.error ?? "Failed"); return; } setEditing(false); router.refresh(); });
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{sub}</p></div>
        {!editing && <GhostButton onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</GhostButton>}
      </div>
      {editing ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(([name, label]) => <Field key={name} label={label}><input name={name} defaultValue={String(d[name] ?? "")} className={inputCls} /></Field>)}
          </div>
          {toggles && <div className="space-y-2">{toggles.map(([name, label]) => (
            <label key={name} className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={!!d[name]} /> {label}</label>
          ))}</div>}
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2"><GhostButton type="button" onClick={() => setEditing(false)}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</PrimaryButton></div>
        </form>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {fields.map(([name, label]) => (
            <div key={name}><dt className="vy-kicker">{label}</dt><dd className="mt-0.5 rounded-md border bg-card px-2.5 py-1.5 text-sm">{String(d[name] ?? "—") || "—"}</dd></div>
          ))}
        </dl>
      )}
    </Card>
  );
}

// ---------- Team & roles ----------
function TeamSection({ members }: { members: Member[] }) {
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const ownershipTotal = members.filter((m) => m.is_owner).reduce((s, m) => s + (m.share ?? 0), 0);
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div><h2 className="text-lg font-semibold">Team &amp; roles</h2><p className="text-sm text-muted-foreground">Who can access this workspace. Ownership split drives the partner capital accounts in Finance.</p></div>
        <GhostButton onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Invite</GhostButton>
      </div>
      <ul className="divide-y">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <span className={cn("inline-grid h-9 w-9 place-items-center rounded-full text-xs font-semibold", m.is_owner ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground")}>{initials(m.name)}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{m.name}{m.is_you && <span className="text-muted-foreground"> (you)</span>}</div>
              <div className="text-[12px] text-muted-foreground">{m.email}</div>
            </div>
            <Badge tone={m.status === "active" ? "success" : "warning"}>{m.status === "active" ? "Active" : "Invited"}</Badge>
            {m.is_owner && <Badge tone="info">{Math.round((m.share ?? 0) * 100)}%</Badge>}
            <Badge tone="muted">{m.role}</Badge>
            <button onClick={() => setEditing(m)} className="vy-icon-btn" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      <div className={cn("mt-3 text-[12px]", Math.abs(ownershipTotal - 1) > 0.001 ? "text-warning" : "text-muted-foreground")}>
        Ownership total: {Math.round(ownershipTotal * 100)}% {Math.abs(ownershipTotal - 1) > 0.001 ? "— should equal 100%." : "✓"}
      </div>
      {editing && <MemberModal member={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}
function MemberModal({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [owner, setOwner] = useState(member?.is_owner ?? false);
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = member ? await updateMember(member.id, form) : await inviteMember(form);
      if (!r.ok) { setError(r.error); return; }
      onClose(); router.refresh();
    });
  }
  function onRemove() { if (member && confirm(`Remove ${member.name}?`)) start(async () => { await removeMember(member.id); onClose(); router.refresh(); }); }
  return (
    <Modal open onClose={onClose} title={member ? "Edit member" : "Invite teammate"}>
      <form onSubmit={onSubmit} className="space-y-4">
        {member && <Field label="Name"><input name="name" defaultValue={member.name} className={inputCls} /></Field>}
        <Field label="Email"><input name="email" type="email" required defaultValue={member?.email ?? ""} autoFocus={!member} className={inputCls} /></Field>
        <Field label="Access role">
          <select name="role" defaultValue={member?.role ?? "Viewer"} className={inputCls}>
            {["Owner", "Admin", "Editor", "Operations", "Viewer", "Partner"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        {member && (
          <>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_owner" defaultChecked={owner} onChange={(e) => setOwner(e.target.checked)} /> Company owner (counts toward the partner split)</label>
            {owner && <Field label="Ownership %"><input name="share" type="number" min={0} max={100} defaultValue={Math.round((member.share ?? 0) * 100)} className={inputCls} /></Field>}
          </>
        )}
        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-between">
          {member && !member.is_you ? <button type="button" onClick={onRemove} className="vy-btn vy-btn--ghost text-danger">Remove</button> : <span />}
          <div className="flex gap-2"><GhostButton type="button" onClick={onClose}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : member ? "Save" : "Send invite"}</PrimaryButton></div>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Notifications ----------
const NOTIF: [string, string, string][] = [
  ["lowstock", "Low stock / reorder alerts", "When an SKU drops below its reorder point."],
  ["overdue", "Overdue invoices", "When a vendor bill passes its due date."],
  ["fbavar", "FBA receiving variance", "When received units differ from expected."],
  ["sync", "Sync failures", "When an integration can't reach its API."],
];
function NotificationsSection({ prefs }: { prefs: Record<string, boolean> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => { const r = await saveNotifications(form); if (!r.ok) setError(r.error ?? "Failed"); router.refresh(); });
  }
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Notifications</h2>
      <p className="text-sm text-muted-foreground">Choose what Vyonix alerts you about.</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-1">
        {NOTIF.map(([name, label, sub]) => (
          <label key={name} className="flex items-center justify-between border-b py-3 last:border-0">
            <span><span className="text-sm font-medium">{label}</span><span className="block text-[12px] text-muted-foreground">{sub}</span></span>
            <input type="checkbox" name={name} defaultChecked={prefs[name] ?? true} />
          </label>
        ))}
        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end pt-2"><PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save preferences"}</PrimaryButton></div>
      </form>
    </Card>
  );
}
