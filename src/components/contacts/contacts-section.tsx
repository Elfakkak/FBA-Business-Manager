"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/primitives";
import { Modal, Field, inputCls, PrimaryButton, GhostButton } from "@/components/ui/modal";
import { addContact, updateContact, deleteContact } from "./actions";
import { User, Plus, Pencil } from "lucide-react";

export type Contact = {
  id: string;
  company: string;
  name: string;
  role: string | null;
  wechat: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  note: string | null;
};

export function ContactsSection({ company, contacts }: { company: string; contacts: Contact[] }) {
  const [editing, setEditing] = useState<Contact | "new" | null>(null);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 font-medium"><User className="h-4 w-4 text-info" /> Contacts ({contacts.length})</div>
          <p className="text-sm text-muted-foreground">The people you deal with at {company}.</p>
        </div>
        <GhostButton onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add contact</GhostButton>
      </div>

      {contacts.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No contacts yet. Add the people you work with here.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => (
            <div key={c.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                    {c.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">{c.name}{c.is_primary && <Badge tone="success">Primary</Badge>}</div>
                    {c.role && <div className="text-[11px] text-muted-foreground">{c.role}</div>}
                  </div>
                </div>
                <button onClick={() => setEditing(c)} className="vy-icon-btn" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-2 space-y-1 text-[12px]">
                {c.wechat && <Row tag="WeChat" val={c.wechat} />}
                {c.phone && <Row tag="Phone" val={<a href={`tel:${c.phone}`} className="font-mono hover:text-primary">{c.phone}</a>} />}
                {c.email && <Row tag="Email" val={<a href={`mailto:${c.email}`} className="font-mono hover:text-primary">{c.email}</a>} />}
              </div>
              {c.note && <div className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">{c.note}</div>}
            </div>
          ))}
        </div>
      )}

      {editing && <ContactModal company={company} contact={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function Row({ tag, val }: { tag: string; val: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-12 shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{tag}</span>
      <span className="min-w-0 truncate">{val}</span>
    </div>
  );
}

function ContactModal({ company, contact, onClose }: { company: string; contact: Contact | null; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = contact ? await updateContact(contact.id, company, form) : await addContact(company, form);
      if (!res.ok) { setError(res.error); return; }
      onClose();
      router.refresh();
    });
  }

  function onDelete() {
    if (!contact || !confirm(`Delete ${contact.name}?`)) return;
    start(async () => { await deleteContact(contact.id); onClose(); router.refresh(); });
  }

  return (
    <Modal open onClose={onClose} title={contact ? "Edit contact" : "Add contact"}>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">{company}</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input name="name" required autoFocus defaultValue={contact?.name ?? ""} className={inputCls} /></Field>
          <Field label="Role"><input name="role" defaultValue={contact?.role ?? ""} className={inputCls} placeholder="Sales rep" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="WeChat"><input name="wechat" defaultValue={contact?.wechat ?? ""} className={inputCls} /></Field>
          <Field label="Phone"><input name="phone" defaultValue={contact?.phone ?? ""} className={inputCls} /></Field>
        </div>
        <Field label="Email"><input name="email" type="email" defaultValue={contact?.email ?? ""} className={inputCls} /></Field>
        <Field label="Note"><input name="note" defaultValue={contact?.note ?? ""} className={inputCls} /></Field>
        <label className="flex items-center gap-2 text-sm">
          <input name="is_primary" type="checkbox" defaultChecked={contact?.is_primary ?? false} /> Primary contact for this company
        </label>
        {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-between">
          {contact ? <button type="button" onClick={onDelete} className="vy-btn vy-btn--ghost text-danger">Delete</button> : <span />}
          <div className="flex gap-2">
            <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</PrimaryButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
