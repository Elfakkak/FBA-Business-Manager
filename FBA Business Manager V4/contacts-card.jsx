// contacts-card.jsx — reusable "Contacts" section for a company detail page.
// Lists the people at one company with role + WeChat/phone/email, add/edit/
// remove. Reads contacts-data globals + VyIcon. Exposes VyContactsSection.
// Load after contacts-data.jsx, before partner-app.jsx / supplier-app.jsx.

const { useState: useCcState } = React;
const ccInput = { width: "100%", height: 36, padding: "0 11px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))", boxSizing: "border-box" };
function ccInitials(n) { return (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }

function VyContactsSection({ company }) {
  const [tick, setTick] = useCcState(0);
  const [modal, setModal] = useCcState(null); // null | 'add' | {edit}
  const contacts = (typeof contactsForCompany === "function") ? contactsForCompany(company) : [];
  const refresh = () => setTick((n) => n + 1);

  return (
    <section className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "hsl(var(--info) / 0.12)", color: "hsl(var(--info))" }}><VyIcon name="user" size={15} /></span>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Contacts {contacts.length ? <span style={{ fontWeight: 500, color: "hsl(var(--muted-fg))" }}>({contacts.length})</span> : null}</h3>
            <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>The people you deal with at {company || "this company"}.</p>
          </div>
        </div>
        <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => setModal("add")}><VyIcon name="plus" size={12} /><span>Add contact</span></button>
      </div>

      {contacts.length === 0 ? (
        <div style={{ padding: "18px", textAlign: "center", color: "hsl(var(--muted-fg))", fontSize: 12.5, border: "1px dashed hsl(var(--border))", borderRadius: 10 }}>No contacts yet. Add the people you work with here.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {contacts.map((c) => (
            <div key={c.id} style={{ border: "1px solid hsl(var(--border))", borderRadius: 11, padding: "13px 14px", background: "hsl(var(--background) / 0.4)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", fontWeight: 700, fontSize: 12.5 }}>{ccInitials(c.name)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</span>
                    {c.primary ? <span className="vy-badge vy-badge--success" style={{ fontSize: 9 }}>Primary</span> : null}
                  </div>
                  {c.role ? <div style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{c.role}</div> : null}
                </div>
                <button type="button" onClick={() => setModal({ edit: c })} aria-label="Edit" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: "hsl(var(--muted-fg))", flexShrink: 0 }}><VyIcon name="pencil" size={13} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                {c.wechat ? <CcRow tag="WeChat" label={c.wechat} /> : null}
                {c.phone ? <CcRow tag="Phone" label={c.phone} href={"tel:" + c.phone} mono /> : null}
                {c.email ? <CcRow tag="Email" label={c.email} href={"mailto:" + c.email} mono /> : null}
              </div>
              {c.note ? <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 8, paddingTop: 8, borderTop: "1px solid hsl(var(--border) / 0.6)" }}>{c.note}</div> : null}
            </div>
          ))}
        </div>
      )}

      {modal === "add" ? <CcModal company={company} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} /> : null}
      {modal && modal.edit ? <CcModal company={company} contact={modal.edit} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} /> : null}
    </section>
  );
}

function CcRow({ tag, label, href, mono }) {
  const inner = (
    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "hsl(var(--foreground))", minWidth: 0 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 44, flexShrink: 0 }}>{tag}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: mono ? "var(--font-mono, monospace)" : undefined }}>{label}</span>
    </span>
  );
  return href ? <a href={href} style={{ textDecoration: "none", color: "inherit" }}>{inner}</a> : inner;
}

function CcField({ label, children }) {
  return <label style={{ display: "block" }}><div className="vy-kicker" style={{ marginBottom: 5 }}>{label}</div>{children}</label>;
}

function CcModal({ company, contact, onClose, onSaved }) {
  const editing = !!contact;
  const [name, setName] = useCcState(contact ? contact.name : "");
  const [role, setRole] = useCcState(contact ? contact.role : "");
  const [wechat, setWechat] = useCcState(contact ? contact.wechat : "");
  const [phone, setPhone] = useCcState(contact ? contact.phone : "");
  const [email, setEmail] = useCcState(contact ? contact.email : "");
  const [note, setNote] = useCcState(contact ? contact.note : "");
  const [primary, setPrimary] = useCcState(contact ? !!contact.primary : false);
  const valid = name.trim();
  function save() {
    const payload = { name: name.trim(), role, wechat, phone, email, note, primary };
    if (editing) contactsUpdate(contact.id, payload);
    else contactsAdd(company, payload);
    onSaved();
  }
  function del() { contactsRemove(contact.id); onSaved(); }
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 440, maxHeight: "88vh", overflowY: "auto", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 22px 12px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editing ? "Edit contact" : "Add contact"}</h3><p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "3px 0 0" }}>{company}</p></div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-fg))" }}><VyIcon name="x" size={18} /></button>
        </div>
        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <CcField label="Name"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lucy Chen" style={ccInput} /></CcField>
            <CcField label="Role"><input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Sales rep" style={ccInput} /></CcField>
          </div>
          <CcField label="WeChat"><input type="text" value={wechat} onChange={(e) => setWechat(e.target.value)} placeholder="WeChat ID" style={ccInput} /></CcField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <CcField label="Phone"><input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+86…" style={ccInput} /></CcField>
            <CcField label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@…" style={ccInput} /></CcField>
          </div>
          <CcField label="Note"><input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Handles AQL checks" style={ccInput} /></CcField>
          <button type="button" onClick={() => setPrimary((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 9, background: "transparent", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: "grid", placeItems: "center", border: "1.5px solid " + (primary ? "hsl(var(--primary))" : "hsl(var(--border))"), background: primary ? "hsl(var(--primary))" : "transparent", color: "#fff" }}>{primary ? <VyIcon name="check" size={12} /> : null}</span>
            <span style={{ fontSize: 12.5 }}>Primary contact for this company</span>
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 22px 16px", borderTop: "1px solid hsl(var(--border))" }}>
          {editing ? <button type="button" className="vy-btn vy-btn--ghost" style={{ color: "hsl(0 72% 51%)" }} onClick={del}>Delete</button> : <span />}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={save}><VyIcon name="check" size={14} /><span>{editing ? "Save" : "Add"}</span></button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

Object.assign(window, { VyContactsSection });
