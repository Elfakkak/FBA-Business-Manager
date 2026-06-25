"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, PageHead } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { Toggle } from "@/components/ui/toggle";
import { createClient } from "@/lib/supabase/client";
import { INTG_STATUS_TONE, INTG_STATUS_LABEL, intgAgo, type IntegrationDef } from "@/lib/integrations";
import { syncIntegration, disconnectIntegration } from "../integrations/actions";
import { ConnectIntegrationModal } from "../integrations/connect-modal";
import { saveBusiness, saveBrand, saveBrandLogo, saveNotifications, inviteMember, updateMember, removeMember } from "./actions";
import { initials, cn } from "@/lib/utils";
import { Activity, Factory, Package, User, Bell, RefreshCw, Plug, Pencil, Plus, ImageIcon, Loader2 } from "lucide-react";

type IntgState = { def: IntegrationDef; status: string; lastSync: string | null; note: string | null };
type Member = { id: string; name: string; email: string | null; role: string; status: string; is_you: boolean; is_owner: boolean; share: number | null; fin_id: string | null };
type Row = Record<string, unknown> | null;

type FieldDef = { name: string; label: string; ph?: string; w?: "full" | "third" };
type ToggleDef = { name: string; label: string; sub?: string };
type Group = { label: string; fields?: FieldDef[]; toggles?: ToggleDef[] };

const SECTIONS = [
  { key: "integrations", label: "Integrations", icon: Activity },
  { key: "business", label: "Business profile", icon: Factory },
  { key: "brand", label: "Brand", icon: Package },
  { key: "team", label: "Team & roles", icon: User },
  { key: "notifications", label: "Notifications", icon: Bell },
] as const;

export function SettingsView(props: { integrations: IntgState[]; brand: Row; business: Row; prefs: Record<string, boolean>; members: Member[] }) {
  const [section, setSection] = useState<string>("integrations");
  return (
    <div className="space-y-6">
      <PageHead kicker="Workspace" title="Settings" sub="Connections, business details and the people who can access Vyonix." />
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto lg:sticky lg:top-4 lg:w-52 lg:flex-col lg:self-start">
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
          {section === "business" && <BusinessSection business={props.business} members={props.members} onGotoTeam={() => setSection("team")} />}
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
  const [pending, start] = useTransition();
  const { def, status, lastSync, note } = state;
  const connected = status === "connected";
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { await fn(); router.refresh(); });

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
      <ConnectIntegrationModal def={def} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

// ---------- Business profile ----------
const BIZ_GROUPS: Group[] = [
  { label: "Legal entity", fields: [
    { name: "company", label: "Legal company name", ph: "e.g. Vyonix Commerce LLC" },
    { name: "entity_type", label: "Entity type", ph: "LLC / Corp / Sole prop" },
    { name: "state_of_formation", label: "State of formation", ph: "e.g. Wyoming", w: "third" },
    { name: "formation_date", label: "Formation date", ph: "YYYY-MM-DD", w: "third" },
    { name: "ein", label: "EIN", ph: "88-1234567", w: "third" },
    { name: "registered_agent", label: "Registered agent", ph: "Agent name", w: "full" },
    { name: "duns_number", label: "DUNS number (optional)", ph: "optional" },
    { name: "website", label: "Website", ph: "vyonix.co" },
  ] },
  { label: "Contact", fields: [
    { name: "email", label: "Email", ph: "you@company.com" },
    { name: "phone", label: "Phone", ph: "+1 …" },
  ] },
  { label: "Principal address", fields: [
    { name: "address", label: "Street", ph: "Street address", w: "full" },
    { name: "city", label: "City", ph: "City", w: "third" },
    { name: "state", label: "State", ph: "State", w: "third" },
    { name: "zip", label: "ZIP", ph: "ZIP", w: "third" },
    { name: "country", label: "Country", ph: "United States" },
  ] },
];
function BusinessSection({ business, members, onGotoTeam }: { business: Row; members: Member[]; onGotoTeam: () => void }) {
  return (
    <div className="space-y-4">
      <EditCard title="Business profile" sub="Your LLC's legal details — appear on POs, invoices and exports." action={saveBusiness} groups={BIZ_GROUPS} data={business} />
      <OwnershipCard members={members} onGotoTeam={onGotoTeam} />
    </div>
  );
}

function OwnershipCard({ members, onGotoTeam }: { members: Member[]; onGotoTeam: () => void }) {
  const [editing, setEditing] = useState<Member | null>(null);
  const owners = members.filter((m) => m.is_owner);
  const total = owners.reduce((n, m) => n + (m.share ?? 0), 0);
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ownership &amp; members</h2>
          <p className="text-[12px] text-muted-foreground">Who owns the company and their split. Drives the partner capital accounts in Finance.</p>
        </div>
        <GhostButton onClick={onGotoTeam} className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Team &amp; roles</GhostButton>
      </div>
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-[10px] border bg-background/40 px-3.5 py-3">
            <span className={cn("inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-semibold", m.is_owner ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground")}>{initials(m.name)}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{m.name}{m.is_you && <span className="font-normal text-muted-foreground"> (you)</span>}</div>
              <div className="text-[11.5px] text-muted-foreground">{m.role} · {m.email}</div>
            </div>
            {m.is_owner ? (
              <>
                <Badge tone="info">{Math.round((m.share ?? 0) * 100)}% ownership</Badge>
                <button onClick={() => setEditing(m)} className="vy-icon-btn" aria-label="Edit ownership"><Pencil className="h-3.5 w-3.5" /></button>
              </>
            ) : (
              <button onClick={() => setEditing(m)} className="vy-btn vy-btn--outline vy-btn--sm inline-flex items-center gap-1.5"><Plus className="h-3 w-3" /> Make owner</button>
            )}
          </div>
        ))}
      </div>
      {owners.length > 0 && (
        <div className={cn("mt-3 text-[12px]", Math.abs(total - 1) > 0.001 ? "text-warning" : "text-muted-foreground")}>
          Ownership total: {Math.round(total * 100)}% {Math.abs(total - 1) > 0.001 ? "— should equal 100%." : "✓"}
        </div>
      )}
      {editing && <MemberModal member={editing} onClose={() => setEditing(null)} ownerDefault={!editing.is_owner} />}
    </Card>
  );
}

// ---------- Brand ----------
const BRAND_GROUPS: Group[] = [
  { label: "Identity", fields: [
    { name: "name", label: "Brand name", ph: "e.g. Vyonix" },
    { name: "color", label: "Brand color (hex)", ph: "#E8602C", w: "third" },
    { name: "established", label: "Established", ph: "2024", w: "third" },
    { name: "tagline", label: "Tagline", ph: "Short brand line", w: "full" },
  ] },
  { label: "Amazon Brand Registry",
    toggles: [
      { name: "registry_enrolled", label: "Enrolled in Brand Registry", sub: "Amazon brand protection" },
      { name: "gtin_exempt", label: "GTIN exemption", sub: "Sell without UPC barcodes" },
    ],
    fields: [
      { name: "registry_id", label: "Brand Registry ID", ph: "BR-…" },
      { name: "store_url", label: "Amazon Store URL", ph: "amazon.com/yourbrand" },
    ] },
  { label: "Trademark", fields: [
    { name: "tm_number", label: "Trademark number", ph: "US 97/…" },
    { name: "tm_status", label: "Status", ph: "Registered / Pending" },
    { name: "tm_jurisdiction", label: "Jurisdiction", ph: "USPTO" },
    { name: "tm_owner", label: "Owner", ph: "Legal owner" },
  ] },
  { label: "Presence", fields: [
    { name: "website", label: "Website", ph: "brand.co" },
    { name: "support_email", label: "Support email", ph: "support@brand.co" },
  ] },
];
function BrandSection({ brand }: { brand: Row }) {
  const b = brand ?? {};
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-start gap-4 p-5">
        <BrandLogo url={(b.logo_url as string) ?? null} name={String(b.name ?? "V")} />
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold tracking-tight">{String(b.name ?? "—")}</div>
          <div className="text-sm text-muted-foreground">{String(b.tagline ?? "")}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={b.registry_enrolled ? "success" : "muted"}>{b.registry_enrolled ? "Brand Registry ✓" : "Not enrolled"}</Badge>
            {b.tm_status ? <Badge tone="muted">{String(b.tm_status)}</Badge> : null}
            {b.color ? <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><span className="h-3 w-3 rounded border" style={{ background: String(b.color) }} />{String(b.color)}</span> : null}
          </div>
        </div>
      </Card>
      <EditCard title="Brand" sub="Your private-label brand registry — the catalog and listings read these details." action={saveBrand} groups={BRAND_GROUPS} data={brand} />
    </div>
  );
}

function BrandLogo({ url, name }: { url: string | null; name: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `brand/logo-${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("product-media").upload(path, file, { upsert: true });
    if (!error) {
      const u = supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl;
      const res = await saveBrandLogo(u);
      if (!res.ok) await supabase.storage.from("product-media").remove([path]);
    }
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button onClick={() => !busy && fileRef.current?.click()} className="relative h-[84px] w-[84px] overflow-hidden rounded-2xl border border-dashed bg-muted text-muted-foreground transition hover:border-primary/40" aria-label="Upload logo">
        {url ? <Image src={url} alt={name} fill sizes="84px" className="object-cover" /> : (
          <span className="grid h-full w-full place-items-center text-2xl font-bold">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : name[0]}</span>
        )}
      </button>
      <span className="text-[10.5px] text-muted-foreground">{busy ? "Uploading…" : url ? "Replace logo" : "Drop logo"}</span>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
    </div>
  );
}

// generic grouped editable card (view tiles -> edit inputs); used by Business & Brand
const span = (w?: "full" | "third") => (w === "full" ? "col-span-6" : w === "third" ? "col-span-2" : "col-span-3");
function EditCard({ title, sub, action, groups, data }: {
  title: string; sub: string; action: (f: FormData) => Promise<{ ok: boolean; error?: string }>; groups: Group[]; data: Row;
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
          <div className="grid grid-cols-6 gap-3">
            {groups.map((g) => (
              <div key={g.label} className="contents">
                <div className="col-span-6 mt-1 vy-kicker text-primary">{g.label}</div>
                {g.toggles?.map((t) => (
                  <div key={t.name} className="col-span-3 rounded-md border bg-background/40 px-3 py-2"><Toggle name={t.name} label={t.label} sub={t.sub} defaultChecked={!!d[t.name]} /></div>
                ))}
                {g.fields?.map((f) => (
                  <div key={f.name} className={span(f.w)}><Field label={f.label}><input name={f.name} defaultValue={String(d[f.name] ?? "")} placeholder={f.ph} className={inputCls} /></Field></div>
                ))}
              </div>
            ))}
          </div>
          {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2"><GhostButton type="button" onClick={() => setEditing(false)}>Cancel</GhostButton><PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</PrimaryButton></div>
        </form>
      ) : (
        <div className="grid grid-cols-6 gap-3">
          {groups.map((g) => (
            <div key={g.label} className="contents">
              <div className="col-span-6 mt-1 vy-kicker text-primary">{g.label}</div>
              {g.toggles?.map((t) => (
                <div key={t.name} className="col-span-3"><dt className="vy-kicker">{t.label}</dt><dd className="mt-0.5"><Badge tone={d[t.name] ? "success" : "muted"}>{d[t.name] ? "Enabled" : "Off"}</Badge></dd></div>
              ))}
              {g.fields?.map((f) => (
                <div key={f.name} className={span(f.w)}><dt className="vy-kicker">{f.label}</dt><dd className="mt-0.5 rounded-md border bg-card px-2.5 py-1.5 text-sm">{String(d[f.name] ?? "—") || "—"}</dd></div>
              ))}
            </div>
          ))}
        </div>
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
function MemberModal({ member, onClose, ownerDefault }: { member: Member | null; onClose: () => void; ownerDefault?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [owner, setOwner] = useState(member?.is_owner ?? ownerDefault ?? false);
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
            {["Owner", "Partner", "Operations", "Viewer"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        {member && (
          <>
            <div className="rounded-md border px-3 py-2">
              <Toggle name="is_owner" label="Company owner" sub="Counts toward the partner split" defaultChecked={owner} tone="primary" onChange={setOwner} />
            </div>
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
          <div key={name} className="border-b py-1.5 last:border-0">
            <Toggle name={name} label={label} sub={sub} defaultChecked={prefs[name] ?? true} />
          </div>
        ))}
        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end pt-3"><PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save preferences"}</PrimaryButton></div>
      </form>
    </Card>
  );
}
