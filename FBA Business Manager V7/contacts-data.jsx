// contacts-data.jsx — CONTACT PEOPLE per company (partner/supplier).
// A company (agent, forwarder, factory) often has several people you deal with
// — sales rep, QC contact, logistics. Each contact belongs to a company (by
// name) and has role + WeChat/phone/email. Persisted to localStorage.
// Load before partner-app.jsx / supplier-app.jsx.

const CONTACTS_KEY = "vy_contacts_v1";

function contactsSeed() {
  return [
    { id: "ct-1", company: "Mutual Trade Union", name: "Lucy Chen", role: "Sales rep", wechat: "lucy_mtu", phone: "+86 138 0013 8000", email: "lucy@mutualtrade.cn", primary: true, note: "Main account manager" },
    { id: "ct-2", company: "Mutual Trade Union", name: "David Wu", role: "QC / inspection", wechat: "davidwu_qc", phone: "+86 139 2200 1188", email: "qc@mutualtrade.cn", primary: false, note: "Handles AQL checks" },
    { id: "ct-3", company: "Mutual Trade Union", name: "Coco Zhang", role: "Logistics", wechat: "coco_logi", phone: "", email: "ship@mutualtrade.cn", primary: false, note: "Booking + docs" },
  ];
}

function contactsLoad() {
  try { const a = JSON.parse(localStorage.getItem(CONTACTS_KEY) || "null"); if (Array.isArray(a)) return a; } catch (e) {}
  const s = contactsSeed(); contactsSave(s); return s;
}
function contactsSave(list) { try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(list)); } catch (e) {} }
function contactsUid() { return "ct-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

// All contacts for a company (primary first).
function contactsForCompany(company) {
  if (!company) return [];
  const key = company.trim().toLowerCase();
  return contactsLoad()
    .filter((c) => (c.company || "").trim().toLowerCase() === key)
    .sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));
}

function contactsAdd(company, person) {
  const list = contactsLoad();
  // if marked primary, demote other primaries for this company
  if (person.primary) list.forEach((c) => { if ((c.company || "").toLowerCase() === company.toLowerCase()) c.primary = false; });
  list.push({
    id: contactsUid(), company,
    name: (person.name || "Contact").trim(), role: person.role || "", wechat: person.wechat || "",
    phone: person.phone || "", email: person.email || "", primary: !!person.primary, note: person.note || "",
  });
  contactsSave(list); return list;
}
function contactsUpdate(id, patch) {
  const list = contactsLoad();
  const target = list.find((c) => c.id === id);
  if (!target) return list;
  if (patch.primary) list.forEach((c) => { if ((c.company || "").toLowerCase() === (target.company || "").toLowerCase()) c.primary = false; });
  Object.assign(target, patch);
  contactsSave(list); return list;
}
function contactsRemove(id) { const list = contactsLoad().filter((c) => c.id !== id); contactsSave(list); return list; }

Object.assign(window, {
  CONTACTS_KEY, contactsLoad, contactsSave, contactsForCompany, contactsAdd, contactsUpdate, contactsRemove,
});
