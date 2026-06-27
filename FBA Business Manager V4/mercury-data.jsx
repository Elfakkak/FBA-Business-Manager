// mercury-data.jsx — Mercury (banking) connection + a recent money-out feed, so
// a payment can be backed by a REAL bank transaction instead of (or beside) an
// uploaded receipt. This is the synced MONEY-OUT side, mirroring Amazon's synced
// SALES side: a linked Mercury transaction is API-verified proof — stronger than
// a manually uploaded file.
//
// Exposes (window): mercConnected, mercSetConnected, MERC_TXNS, mercSuggest,
// mercFmt, mercProofBadge, MercuryProofField (a React proof control).
// Plain JSX — load with <script type="text/babel"> BEFORE the invoice apps.

const MERC_KEY_CONNECTED = "vy_mercury_connected_v1";
function mercConnected() {
  try { const v = localStorage.getItem(MERC_KEY_CONNECTED); return v == null ? true : v === "1"; } catch (e) { return true; }
}
function mercSetConnected(on) { try { localStorage.setItem(MERC_KEY_CONNECTED, on ? "1" : "0"); } catch (e) {} }

function mercFmt(n) { return "$" + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Mock recent outflows (would come from Mercury's API). Counterparties match the
// vendors in payables-data so the suggestion matching feels real.
const MERC_TXNS = [
  { id: "merc_8f21", date: "Jun 3", counterparty: "Shenzhen Wheel Co", amount: 1158.00, memo: "Wire · supplier deposit", account: "Mercury ••4471" },
  { id: "merc_8e02", date: "Jun 1", counterparty: "Yiwu Ocean Logistics", amount: 842.00, memo: "Wire · freight", account: "Mercury ••4471" },
  { id: "merc_7d90", date: "May 28", counterparty: "Ningbo Auto Trim", amount: 11352.00, memo: "Wire · balance", account: "Mercury ••4471" },
  { id: "merc_7c55", date: "May 22", counterparty: "Huasheng Leather", amount: 6496.00, memo: "Wire · deposit", account: "Mercury ••4471" },
  { id: "merc_7b13", date: "May 10", counterparty: "QIMA", amount: 320.00, memo: "Card · inspection", account: "Mercury ••4471" },
  { id: "merc_6a88", date: "May 5", counterparty: "Mutual Trade Union", amount: 2000.00, memo: "Wire", account: "Mercury ••4471" },
  { id: "merc_69f0", date: "Apr 30", counterparty: "Fujian PU Goods", amount: 7240.00, memo: "Wire · paid in full", account: "Mercury ••4471" },
  { id: "merc_5e21", date: "Apr 18", counterparty: "DSV", amount: 1310.00, memo: "Wire · freight", account: "Mercury ••4471" },
  { id: "merc_5c02", date: "Apr 2", counterparty: "Flexport", amount: 3200.00, memo: "ACH · freight", account: "Mercury ••4471" },
  { id: "merc_4b77", date: "Mar 30", counterparty: "Ningbo Auto Trim", amount: 6480.00, memo: "Wire", account: "Mercury ••4471" },
];

// Suggest transactions for a payment: closest amount + vendor-name match first.
function mercSuggest(amount, vendor) {
  const amt = Number(amount) || 0;
  const v = (vendor || "").toLowerCase();
  const firstWord = v.split(/\s+/)[0] || "";
  return MERC_TXNS.map((t) => {
    const amtClose = amt > 0 ? Math.abs(t.amount - amt) <= Math.max(1, amt * 0.02) : false;
    const vendorMatch = firstWord.length > 2 && t.counterparty.toLowerCase().includes(firstWord);
    const score = (amtClose ? 2 : 0) + (vendorMatch ? 1 : 0);
    return { ...t, score, amtClose, vendorMatch };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

// Badge descriptor for a payment's proof (caller renders the badge / "Missing").
function mercProofBadge(p) {
  if (!p || !p.proof) return null;
  if (p.proofKind === "mercury" && p.proofTxn) return { label: "Mercury", tone: "info", title: p.proofTxn.counterparty + " · " + mercFmt(p.proofTxn.amount) + " · " + p.proofTxn.date };
  return { label: "Receipt", tone: "success", title: p.proofName || "Receipt on file" };
}

// ----------------------------------------------------------------------
// MercuryProofField — the proof control used in both payment modals. Holds the
// whole "proof of payment" choice: link a Mercury transaction (synced) OR attach
// a receipt file (manual). value = { proof, proofKind, proofName, proofTxn }.
// ----------------------------------------------------------------------
function MercuryProofField({ amount, vendor, value, onChange }) {
  const v = value || {};
  const [showMerc, setShowMerc] = React.useState(false);
  const connected = mercConnected();
  const muted = "hsl(var(--muted-fg))";

  function clear() { onChange({ proof: false, proofKind: null, proofName: "", proofTxn: null }); setShowMerc(false); }
  function pickTxn(t) { onChange({ proof: true, proofKind: "mercury", proofTxn: t, proofName: "" }); setShowMerc(false); }
  function pickFile(name) { if (name) onChange({ proof: true, proofKind: "file", proofName: name, proofTxn: null }); }

  // ----- selected state -----
  if (v.proof && v.proofKind === "mercury" && v.proofTxn) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid hsl(var(--info) / 0.4)", borderRadius: 8, background: "hsl(var(--info) / 0.07)" }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--info) / 0.14)", color: "hsl(var(--info))" }}><VyIcon name="link" size={15} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Mercury · {v.proofTxn.counterparty}</div>
          <div style={{ fontSize: 11, color: muted, fontFamily: "var(--font-mono, monospace)" }}>{mercFmt(v.proofTxn.amount)} · {v.proofTxn.date} · {v.proofTxn.id}</div>
        </div>
        <button type="button" onClick={clear} aria-label="Unlink" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: muted, flexShrink: 0 }}><VyIcon name="x" size={15} /></button>
      </div>
    );
  }
  if (v.proof && v.proofKind === "file" && v.proofName) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid hsl(var(--success) / 0.4)", borderRadius: 8, background: "hsl(var(--success) / 0.06)" }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "hsl(var(--success) / 0.14)", color: "hsl(var(--success))" }}><VyIcon name="fileText" size={15} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.proofName}</div>
          <div style={{ fontSize: 11, color: muted }}>Receipt attached</div>
        </div>
        <button type="button" onClick={clear} aria-label="Remove" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: muted, flexShrink: 0 }}><VyIcon name="x" size={15} /></button>
      </div>
    );
  }

  // ----- unset: choose how to prove -----
  const suggestions = connected ? mercSuggest(amount, vendor) : [];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {connected ? (
          <button type="button" onClick={() => setShowMerc((s) => !s)} style={{ flex: "1 1 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 12px", border: "1px solid " + (showMerc ? "hsl(var(--info))" : "hsl(var(--input))"), borderRadius: 8, background: showMerc ? "hsl(var(--info) / 0.08)" : "hsl(var(--background))", color: "hsl(var(--foreground))", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
            <VyIcon name="link" size={14} style={{ color: "hsl(var(--info))" }} /><span>Link Mercury transaction</span>
          </button>
        ) : null}
        <label style={{ flex: "1 1 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 12px", border: "1px dashed hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background) / 0.4)", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
          <VyIcon name="upload" size={14} style={{ color: muted }} /><span>Attach receipt</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files && e.target.files[0] ? e.target.files[0].name : "")} />
        </label>
      </div>

      {showMerc ? (
        <div style={{ marginTop: 8, border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden", maxHeight: 188, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "hsl(var(--muted-bg) / 0.5)", borderBottom: "1px solid hsl(var(--border))" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "hsl(var(--info))" }} />
            <span className="vy-kicker">Recent Mercury outflows</span>
          </div>
          {suggestions.map((t) => (
            <button key={t.id} type="button" onClick={() => pickTxn(t)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "9px 12px", borderTop: "none", borderBottom: "1px solid hsl(var(--border) / 0.6)", background: t.amtClose ? "hsl(var(--info) / 0.05)" : "transparent", cursor: "pointer", font: "inherit", color: "inherit" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.counterparty}</div>
                <div style={{ fontSize: 10.5, color: muted }}>{t.date} · {t.memo}{t.amtClose ? " · amount matches" : ""}</div>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "var(--font-mono, monospace)", flexShrink: 0 }}>{mercFmt(t.amount)}</div>
            </button>
          ))}
        </div>
      ) : null}
      <div style={{ fontSize: 10.5, color: muted, marginTop: 6 }}>{connected ? "A linked Mercury transaction is verified proof. Use a receipt for payments made outside Mercury." : "Mercury not connected — attach a receipt, or connect Mercury in Settings."}</div>
    </div>
  );
}

Object.assign(window, { mercConnected, mercSetConnected, MERC_TXNS, mercSuggest, mercFmt, mercProofBadge, MercuryProofField });
