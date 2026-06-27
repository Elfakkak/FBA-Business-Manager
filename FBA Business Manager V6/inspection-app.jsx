// Vyonix Inspection Section — chrome-less body, embedded inside the Order Shell
// Inspection tab. Exposes VyInspectionBody via window. Does NOT self-mount.
//
// Design follows the SAME pattern as Shipping / Invoices (not a dense layout):
//   header + next-action  →  5-KPI strip  →  release-gate banner  →
//   stacked detail cards (inspection state · schedule · report & media ·
//   coverage reference). Interactive: Schedule inspection modal, Upload
//   report/media pickers, Link folder, Accept report, Record result — all
//   mutate state; KPIs/badges/gate derive live.

const { useState: useInspState } = React;

// ----------------------------------------------------------------------
// DATA — initial inspection state for this order
// ----------------------------------------------------------------------
// Per-order scope (null = sample or standalone → curated literal below). The
// inspection state reflects where the order sits in its lifecycle: not booked
// while in production, scheduled during the inspection stage, and a passed +
// accepted report once the order has shipped or beyond.
const INSP_SCOPE = (window.VY_ORDER_SCOPE && !window.VY_ORDER_SCOPE.isSample) ? window.VY_ORDER_SCOPE : null;

const INSP_INITIAL = INSP_SCOPE ? (
  INSP_SCOPE.stageRank >= 3
    ? { status: "Completed", inspector: "Senior QC agent", date: "Completed", aql: "II · 2.5 / 4.0", visitType: "Pre-shipment full", factoryContact: "", result: "Pass", report: { name: "inspection-report.pdf", accepted: true }, mediaCount: 12, folderLink: null, supplierMedia: true }
    : INSP_SCOPE.stageKey === "inspection"
      ? { status: "Scheduled", inspector: "Senior QC agent", date: "Inspection window", aql: "II · 2.5 / 4.0", visitType: "Pre-shipment full", factoryContact: "", result: "Pending", report: null, mediaCount: 0, folderLink: null, supplierMedia: false }
      : { status: "Not scheduled", inspector: "Unassigned", date: "Before balance release", aql: "II · 2.5 / 4.0", visitType: "Pre-shipment full", factoryContact: "", result: "Pending", report: null, mediaCount: 0, folderLink: null, supplierMedia: false }
) : {
  status: "Not scheduled",           // Not scheduled | Scheduled | Completed
  inspector: "Unassigned",
  date: "Before balance release",
  aql: "II · 2.5 / 4.0",
  visitType: "Pre-shipment full",
  factoryContact: "",
  result: "Pending",                 // Pending | Pass | Conditional | Fail
  report: null,                      // null | { name, accepted }
  mediaCount: 0,
  folderLink: null,                  // null | url string
  supplierMedia: false,
};

// Reference checklist — informational only; final evidence lives in the report.
const INSP_COVERAGE = [
  { label: "Product appearance", state: "reference" },
  { label: "Color consistency", state: "covered" },
  { label: "Stitching / material quality", state: "covered" },
  { label: "Carton labeling", state: "attention" },
  { label: "FNSKU / label check", state: "attention" },
  { label: "Carton weight check", state: "reference" },
  { label: "Quantity spot check", state: "covered" },
  { label: "Packaging damage", state: "reference" },
];

const COVERAGE_LABEL = { reference: "Reference only", covered: "Covered by report", attention: "Needs attention" };
const COVERAGE_TONE = { reference: "muted", covered: "success", attention: "warning" };

// ----------------------------------------------------------------------
// Shared presentational helpers (self-contained — no cross-file coupling)
// ----------------------------------------------------------------------
function InspSectionCard({ icon, title, sub, actions, iconTone = "primary", children }) {
  const toneVar = iconTone === "muted" ? "muted-fg" : iconTone;
  return (
    <section className="vy-card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: children ? 16 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {icon ? (
            <span style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center",
              background: `hsl(var(--${toneVar}) / 0.12)`, color: `hsl(var(--${toneVar}))`,
            }}>
              <VyIcon name={icon} size={15} />
            </span>
          ) : null}
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
            {sub ? <p style={{ fontSize: 11.5, color: "hsl(var(--muted-fg))", margin: "2px 0 0" }}>{sub}</p> : null}
          </div>
        </div>
        {actions ? <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function InspField({ label, children, mono, tone }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "12px 16px" }}>
      <div className="vy-kicker" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 15, fontWeight: 700,
        color: tone ? `hsl(var(--${tone}))` : undefined,
        fontFamily: mono ? "var(--font-mono, 'JetBrains Mono', monospace)" : undefined,
      }}>
        {children}
      </div>
    </div>
  );
}

function InspFieldGrid({ children }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden",
      background: "hsl(var(--background) / 0.4)",
    }}>
      {React.Children.map(children, (child, i) => (
        <div key={i} style={{
          borderLeft: i % 3 === 0 ? "none" : "1px solid hsl(var(--border))",
          borderTop: i >= 3 ? "1px solid hsl(var(--border))" : "none",
        }}>
          {child}
        </div>
      ))}
    </div>
  );
}

// One file/asset row inside Report & media
function InspAssetRow({ icon, iconTone, title, sub, subTone, actionLabel, onAction }) {
  const toneVar = iconTone === "muted" ? "muted-fg" : iconTone;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", border: "1px solid hsl(var(--border))", borderRadius: 10,
      background: "hsl(var(--background) / 0.4)",
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center",
        background: `hsl(var(--${toneVar}) / 0.12)`, color: `hsl(var(--${toneVar}))`,
      }}>
        <VyIcon name={icon} size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11, color: subTone ? `hsl(var(--${subTone === "muted" ? "muted-fg" : subTone}))` : "hsl(var(--muted-fg))", marginTop: 1 }}>{sub}</div>
      </div>
      <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" style={{ fontSize: 11.5 }} onClick={onAction}>
        <VyIcon name={actionLabel === "Link" ? "link" : "upload"} size={12} /><span>{actionLabel}</span>
      </button>
    </div>
  );
}

const inspInputStyle = {
  width: "100%", height: 38, padding: "0 12px", fontSize: 13,
  border: "1px solid hsl(var(--input))", borderRadius: 8,
  background: "hsl(var(--background))", color: "hsl(var(--foreground))",
};

// ----------------------------------------------------------------------
// INSPECTION BODY
// ----------------------------------------------------------------------
function VyInspectionBody() {
  const [insp, setInsp] = useInspState(INSP_INITIAL);
  const [modal, setModal] = useInspState(null); // null | 'schedule'

  const patch = (p) => setInsp((prev) => ({ ...prev, ...p }));

  function pickFile(accept, onFile) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = (e) => { if (e.target.files[0]) onFile(e.target.files[0]); };
    input.click();
  }

  // ---- derived ----
  const scheduled = insp.status !== "Not scheduled";
  const reportUploaded = !!insp.report;
  const reportAccepted = reportUploaded && insp.report.accepted;
  const attentionCount = INSP_COVERAGE.filter((c) => c.state === "attention").length;
  const releaseOk = reportAccepted && insp.result === "Pass";

  // Data-driven status: when inspection clears (report accepted + Pass), the
  // order auto-advances past Inspection (forward-only; manual controls still
  // override). Fires on the rising edge only — not on mount for an order that
  // already loaded cleared.
  const inspAdvRef = React.useRef(releaseOk);
  React.useEffect(() => {
    if (releaseOk && !inspAdvRef.current && typeof ordAdvanceToAtLeast === "function") {
      const o = window.VY_CURRENT_ORDER;
      if (o && o.id) {
        ordAdvanceToAtLeast(o.id, o.status && o.status.label, "transit", "Inspection passed");
      }
    }
    inspAdvRef.current = releaseOk;
  }, [releaseOk]);

  const reportState = !reportUploaded ? "Missing" : reportAccepted ? "Accepted" : "Uploaded";
  const reportTone = !reportUploaded ? "danger" : reportAccepted ? "success" : "warning";

  // Next action
  let nextTitle, nextSub, nextBtn;
  if (!scheduled) {
    nextTitle = "Schedule inspection";
    nextSub = "Pick the inspector, date, AQL level, and visit type before balance release.";
    nextBtn = { label: "Schedule inspection", icon: "calendar", onClick: () => setModal("schedule") };
  } else if (!reportUploaded) {
    nextTitle = "Upload inspection report";
    nextSub = "Inspection is booked. Upload the QC report once the visit is complete.";
    nextBtn = { label: "Upload report", icon: "upload", onClick: () => pickFile(".pdf,.png,.jpg,.jpeg", (f) => patch({ report: { name: f.name, accepted: false } })) };
  } else if (!reportAccepted) {
    nextTitle = "Review & accept report";
    nextSub = "Report uploaded — review the findings and accept it to unlock balance release.";
    nextBtn = { label: "Accept report", icon: "check", onClick: () => patch({ report: { ...insp.report, accepted: true } }) };
  } else if (insp.result === "Pending") {
    nextTitle = "Record result";
    nextSub = "Report accepted. Set the inspection result to clear goods for release.";
    nextBtn = { label: "Mark as Pass", icon: "check", onClick: () => patch({ result: "Pass" }) };
  } else {
    nextTitle = releaseOk ? "Cleared for release" : "Result recorded";
    nextSub = releaseOk ? "Report accepted and result is Pass. Balance can be released." : "Result is " + insp.result + ". Review before releasing balance.";
    nextBtn = null;
  }

  const kpis = [
    { icon: "clipboard", label: "Status", value: insp.status, sub: scheduled ? insp.date : "Not booked", tone: scheduled ? undefined : "warning" },
    { icon: "check", label: "Result", value: insp.result, sub: insp.aql, tone: insp.result === "Pass" ? "success" : insp.result === "Fail" ? "danger" : undefined },
    { icon: "fileText", label: "Report", value: reportState, sub: reportUploaded ? insp.report.name : "Not uploaded", tone: reportTone === "danger" ? "warning" : reportTone },
    { icon: "package", label: "Media", value: String(insp.mediaCount), sub: insp.mediaCount === 1 ? "file" : "files", tone: undefined },
    { icon: "alert", label: "Needs attention", value: String(attentionCount), sub: attentionCount ? "coverage items" : "all covered", tone: attentionCount ? "warning" : undefined },
  ];

  return (
    <>
      {window.VyExampleNote ? <window.VyExampleNote section="inspection" /> : null}
      {/* Header + next action */}
      <section className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 460px", padding: "20px 22px", minWidth: 0 }}>
            <h1 className="vy-page-title" style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Inspection</h1>
            <p className="vy-page-sub" style={{ margin: "6px 0 0", maxWidth: "62ch" }}>
              Schedule QC, collect the report and media, and decide whether goods can be released.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <span className={"vy-badge vy-badge--" + (scheduled ? "info" : "warning")}>{insp.status}</span>
              <span className={"vy-badge vy-badge--" + (insp.result === "Pass" ? "success" : insp.result === "Fail" ? "danger" : "muted")}>{insp.result}</span>
              {reportUploaded ? <span className={"vy-badge vy-badge--" + reportTone}>Report {reportState.toLowerCase()}</span> : null}
            </div>
          </div>
          <div style={{
            flex: "1 1 300px", padding: "20px 22px", minWidth: 260,
            borderLeft: "1px solid hsl(var(--border))", background: "hsl(var(--accent) / 0.5)",
          }}>
            <div className="vy-kicker" style={{ marginBottom: 6 }}>Next action</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{nextTitle}</div>
            <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "4px 0 14px" }}>{nextSub}</p>
            {nextBtn ? (
              <button type="button" className="vy-btn vy-btn--primary" onClick={nextBtn.onClick}>
                <VyIcon name={nextBtn.icon} size={14} />
                <span>{nextBtn.label}</span>
              </button>
            ) : (
              <span className="vy-badge vy-badge--success"><VyIcon name="check" size={12} style={{ marginRight: 4 }} />Ready</span>
            )}
          </div>
        </div>
      </section>

      {/* KPI strip */}
      <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {kpis.map((k, i) => (
          <div key={i} className={"vy-card vy-kpi" + (k.tone ? ` vy-kpi--${k.tone}` : "")}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <VyIcon name={k.icon} size={14} style={{ opacity: 0.7 }} />
              <span className="vy-kicker">{k.label}</span>
            </div>
            <div className="vy-kpi-value" style={{ fontSize: 18 }}>{k.value}</div>
            <div className="vy-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Release-gate banner */}
      {!releaseOk ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          padding: "12px 16px", borderRadius: 10,
          background: "hsl(var(--warning) / 0.08)", border: "1px solid hsl(var(--warning) / 0.25)",
        }}>
          <VyIcon name="alert" size={15} style={{ color: "hsl(var(--warning))", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
            <strong style={{ fontWeight: 600 }}>Balance should not be released yet</strong>
            <span style={{ color: "hsl(var(--muted-fg))" }}>
              &nbsp;&nbsp;{!reportAccepted ? "Report must be uploaded and accepted first." : "Record a Pass result to clear goods for release."}
            </span>
          </div>
        </div>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          padding: "12px 16px", borderRadius: 10,
          background: "hsl(var(--success) / 0.08)", border: "1px solid hsl(var(--success) / 0.25)",
        }}>
          <VyIcon name="check" size={15} style={{ color: "hsl(var(--success))", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
            <strong style={{ fontWeight: 600 }}>Cleared for release</strong>
            <span style={{ color: "hsl(var(--muted-fg))" }}>&nbsp;&nbsp;Report accepted and result is Pass.</span>
          </div>
        </div>
      )}

      {/* Inspection state */}
      <InspSectionCard icon="clipboard" title="Inspection details" iconTone="primary">
        <InspFieldGrid>
          <InspField label="Inspector">{insp.inspector}</InspField>
          <InspField label="Date">{insp.date}</InspField>
          <InspField label="AQL" mono>{insp.aql}</InspField>
          <InspField label="Visit type">{insp.visitType}</InspField>
        </InspFieldGrid>
      </InspSectionCard>

      {/* Schedule */}
      <InspSectionCard
        icon="calendar"
        title="Schedule"
        iconTone="primary"
        actions={scheduled ? (
          <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => setModal("schedule")}>
            <VyIcon name="pencil" size={12} /><span>Reschedule</span>
          </button>
        ) : null}
      >
        {scheduled ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "14px 16px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--background) / 0.4)" }}>
            <span style={{ width: 36, height: 36, borderRadius: 9, display: "grid", placeItems: "center", background: "hsl(var(--success) / 0.12)", color: "hsl(var(--success))", flexShrink: 0 }}>
              <VyIcon name="calendar" size={17} />
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{insp.visitType} · {insp.date}</div>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>
                {insp.inspector}{insp.factoryContact ? " · factory contact " + insp.factoryContact : ""} · AQL {insp.aql}
              </div>
            </div>
            <span className="vy-badge vy-badge--info">Booked</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "16px", border: "1px dashed hsl(var(--border))", borderRadius: 12, background: "hsl(var(--background) / 0.4)" }}>
            <span style={{ width: 36, height: 36, borderRadius: 9, display: "grid", placeItems: "center", background: "hsl(var(--muted-bg))", color: "hsl(var(--muted-fg))", flexShrink: 0 }}>
              <VyIcon name="calendar" size={17} />
            </span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Inspection is not scheduled yet</div>
              <p style={{ fontSize: 12, color: "hsl(var(--muted-fg))", margin: "3px 0 0", maxWidth: "60ch" }}>
                Pick the inspector, date, AQL level, visit type, and factory contact before balance release.
              </p>
            </div>
            <button type="button" className="vy-btn vy-btn--primary" style={{ flexShrink: 0 }} onClick={() => setModal("schedule")}>
              <VyIcon name="calendar" size={14} /><span>Schedule inspection</span>
            </button>
          </div>
        )}
      </InspSectionCard>

      {/* Report & media */}
      <InspSectionCard icon="fileText" title="Report & media" iconTone="info">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <InspAssetRow
            icon="fileText"
            iconTone={reportUploaded ? "success" : "muted"}
            title="Inspection report"
            sub={reportUploaded ? insp.report.name + (reportAccepted ? " · accepted" : " · awaiting acceptance") : "Missing"}
            subTone={reportUploaded ? (reportAccepted ? "success" : "warning") : "muted"}
            actionLabel={reportUploaded ? "Replace" : "Upload"}
            onAction={() => pickFile(".pdf,.png,.jpg,.jpeg", (f) => patch({ report: { name: f.name, accepted: false } }))}
          />
          <InspAssetRow
            icon="package"
            iconTone={insp.mediaCount ? "info" : "muted"}
            title="Photos / videos"
            sub={insp.mediaCount + (insp.mediaCount === 1 ? " file" : " files")}
            actionLabel="Upload"
            onAction={() => pickFile("image/*,video/*", () => patch({ mediaCount: insp.mediaCount + 1 }))}
          />
          <InspAssetRow
            icon="link"
            iconTone={insp.folderLink ? "info" : "muted"}
            title="Folder link"
            sub={insp.folderLink || "Not linked"}
            subTone={insp.folderLink ? "info" : "muted"}
            actionLabel="Link"
            onAction={() => { const u = prompt("Paste folder URL (Drive, Dropbox, …)"); if (u) patch({ folderLink: u }); }}
          />
          <InspAssetRow
            icon="package"
            iconTone={insp.supplierMedia ? "info" : "muted"}
            title="Supplier-provided media"
            sub={insp.supplierMedia ? "Uploaded" : "Not uploaded"}
            subTone={insp.supplierMedia ? "info" : "muted"}
            actionLabel="Upload"
            onAction={() => pickFile("image/*,video/*,.pdf", () => patch({ supplierMedia: true }))}
          />
        </div>
        {reportUploaded && !reportAccepted ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12, padding: "10px 14px", borderRadius: 9, background: "hsl(var(--warning) / 0.08)", border: "1px solid hsl(var(--warning) / 0.25)" }}>
            <span style={{ fontSize: 12.5, flex: 1, minWidth: 200 }}>Report uploaded — accept it to unlock balance release.</span>
            <button type="button" className="vy-btn vy-btn--primary vy-btn--sm" style={{ fontSize: 11.5 }} onClick={() => patch({ report: { ...insp.report, accepted: true } })}>
              <VyIcon name="check" size={12} /><span>Accept report</span>
            </button>
          </div>
        ) : null}
      </InspSectionCard>

      {/* Coverage reference */}
      <InspSectionCard icon="clipboard" title="Coverage reference" sub="Reference checklist only. Final pass/fail evidence lives in the accepted report." iconTone="muted">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {INSP_COVERAGE.map((c, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 9,
              background: "hsl(var(--background) / 0.4)",
            }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</span>
              <span className={"vy-badge vy-badge--" + COVERAGE_TONE[c.state]}>{COVERAGE_LABEL[c.state]}</span>
            </div>
          ))}
        </div>
      </InspSectionCard>

      {/* Schedule modal */}
      {modal === "schedule" ? (
        <InspScheduleModal insp={insp} onClose={() => setModal(null)} onSubmit={(vals) => { patch({ ...vals, status: "Scheduled" }); setModal(null); }} />
      ) : null}
    </>
  );
}

// ----------------------------------------------------------------------
// Modal shell + schedule form
// ----------------------------------------------------------------------
function InspModalShell({ title, sub, onClose, children, footer, width = 540 }) {
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: width, maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
            {sub ? <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0", maxWidth: "46ch" }}>{sub}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 24px", overflowY: "auto" }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>{footer}</div>
      </div>
    </div>,
    document.body
  );
}

function InspFormField({ label, children, half }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: half ? "1 1 calc(50% - 7px)" : "1 1 100%", minWidth: 0 }}>
      <span className="vy-kicker">{label}</span>
      {children}
    </label>
  );
}

function InspScheduleModal({ insp, onClose, onSubmit }) {
  const [form, setForm] = useInspState({
    inspector: insp.inspector === "Unassigned" ? "" : insp.inspector,
    date: insp.date === "Before balance release" ? "" : insp.date,
    aql: insp.aql,
    visitType: insp.visitType,
    factoryContact: insp.factoryContact,
  });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const valid = form.inspector.trim() && form.date.trim();

  return (
    <InspModalShell
      title="Schedule inspection"
      sub="Book the QC visit. This sets the inspection to Scheduled; upload the report after the visit."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={() => onSubmit({ ...form, inspector: form.inspector.trim(), date: form.date.trim() })}>
            <VyIcon name="calendar" size={14} /><span>Schedule</span>
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <InspFormField label="Inspector" half>
          <input className="vy-input" style={inspInputStyle} value={form.inspector} onChange={set("inspector")} placeholder="e.g. QIMA · Wang L." />
        </InspFormField>
        <InspFormField label="Date" half>
          <input className="vy-input" style={inspInputStyle} value={form.date} onChange={set("date")} placeholder="e.g. Jan 10" />
        </InspFormField>
        <InspFormField label="Visit type" half>
          <select className="vy-input" style={inspInputStyle} value={form.visitType} onChange={set("visitType")}>
            <option>Pre-shipment full</option>
            <option>During production (DUPRO)</option>
            <option>Container loading</option>
            <option>Sample review</option>
          </select>
        </InspFormField>
        <InspFormField label="AQL level" half>
          <select className="vy-input" style={inspInputStyle} value={form.aql} onChange={set("aql")}>
            <option>II · 2.5 / 4.0</option>
            <option>II · 1.5 / 2.5</option>
            <option>II · 4.0 / 6.5</option>
            <option>I · 2.5 / 4.0</option>
          </select>
        </InspFormField>
        <InspFormField label="Factory contact (optional)">
          <input className="vy-input" style={inspInputStyle} value={form.factoryContact} onChange={set("factoryContact")} placeholder="e.g. Mr. Chen · +86 …" />
        </InspFormField>
      </div>
    </InspModalShell>
  );
}

Object.assign(window, { VyInspectionBody, INSP_INITIAL, INSP_COVERAGE });
