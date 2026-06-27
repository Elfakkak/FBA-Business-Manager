// team-data.jsx — SINGLE SOURCE OF TRUTH for PEOPLE (workspace members).
// One person = one record here. Two facts layer on top of a member:
//   • role / login (Owner, Partner, Operations, Viewer) — who can see/do what
//   • owner + share — equity: which members co-own the company, and their %
// The Finance section (Net & Draws) DERIVES its partner list from the owners
// here — it never defines people of its own. Settings → Team & roles is where
// people are added/edited; Finance only reads owners + sets their ownership %.
//
// Storage key `vy_team_v1` is shared with Settings (back-compat). A migration
// backfills owner/share/finId onto older saved records so existing data lifts
// into the new model without a reset.

const TEAM_KEY = "vy_team_v1";

// `finId` is the stable id the Finance ledger attributes draws to. The owner
// who is "you" maps to "me"; the seeded co-owner maps to "partner" (matching
// the finance seed entries). New owners get their own member id as finId.
const TEAM_SEED = [
  { id: "owner",   name: "Simo", email: "simo@vyonix.co",     role: "Owner",   status: "active", you: true,  owner: true, share: 0.5, finId: "me" },
  { id: "partner", name: "Youness",   email: "youness@vyonix.co", role: "Partner", status: "active", you: false, owner: true, share: 0.5, finId: "partner" },
];

function teamInitials(name) {
  return (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function teamLoadRaw() {
  try {
    const raw = JSON.parse(localStorage.getItem(TEAM_KEY) || "null");
    if (Array.isArray(raw) && raw.length) return raw;
  } catch (e) {}
  return JSON.parse(JSON.stringify(TEAM_SEED));
}

// Backfill the equity fields onto any record shape we might have saved before.
function teamMigrate(members) {
  let m = members.map((x) => ({ ...x }));

  // 1) ensure at least the "you"/Owner/Partner roles are flagged owners
  if (!m.some((x) => x.owner)) {
    m = m.map((x) => (x.you || x.role === "Owner" || x.role === "Partner" ? { ...x, owner: true } : x));
  }
  // 2) if only one owner exists, add the seeded co-owner so the partner model
  //    (and the seeded finance ledger) stays coherent.
  let owners = m.filter((x) => x.owner);
  if (owners.length === 1 && !m.some((x) => x.finId === "partner" || x.id === "partner")) {
    m = [...m, JSON.parse(JSON.stringify(TEAM_SEED.find((s) => s.finId === "partner")))];
  }
  // 3) finId for every owner
  m = m.map((x) => {
    if (!x.owner) return x;
    return { ...x, finId: x.finId || (x.you ? "me" : x.id) };
  });
  // 4) even split if shares missing / don't sum to ~1
  owners = m.filter((x) => x.owner);
  const sum = owners.reduce((n, o) => n + (Number(o.share) || 0), 0);
  if (!owners.every((o) => Number(o.share) > 0) || Math.abs(sum - 1) > 0.001) {
    const eq = owners.length ? 1 / owners.length : 0;
    m = m.map((x) => (x.owner ? { ...x, share: Number(x.share) > 0 && Math.abs(sum - 1) <= 0.001 ? x.share : eq } : x));
  }
  return m;
}

function teamLoad() { return teamMigrate(teamLoadRaw()); }
function teamSave(members) {
  try { localStorage.setItem(TEAM_KEY, JSON.stringify(members)); } catch (e) {}
  return members;
}

function teamOwners() { return teamLoad().filter((x) => x.owner); }

// The shape Finance consumes: { id (=finId), name, initials, share, email, teamId }.
function teamFinPartners() {
  return teamOwners().map((x) => ({
    id: x.finId || (x.you ? "me" : x.id),
    name: x.name, initials: teamInitials(x.name), share: Number(x.share) || 0,
    email: x.email, teamId: x.id,
  }));
}

// Update an owner (identified by finId) — used by Finance's Partners & split.
function teamUpdateOwner(finId, patch) {
  const m = teamLoad().map((x) => {
    const xf = x.finId || (x.you ? "me" : x.id);
    return (x.owner && xf === finId) ? { ...x, ...patch } : x;
  });
  return teamSave(m);
}
// Set shares for several owners at once: { finId: share }.
function teamSetShares(map) {
  const m = teamLoad().map((x) => {
    const xf = x.finId || (x.you ? "me" : x.id);
    return (x.owner && map[xf] != null) ? { ...x, share: Number(map[xf]) || 0 } : x;
  });
  return teamSave(m);
}

Object.assign(window, {
  TEAM_KEY, TEAM_SEED, teamInitials, teamLoad, teamSave, teamOwners,
  teamFinPartners, teamUpdateOwner, teamSetShares,
});
