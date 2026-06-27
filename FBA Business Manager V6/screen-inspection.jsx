// SCREEN 2 — Order > Inspection (`/orders/[id]/inspection`) · POST-CUT STATE
//
// REMOVED per SCOPE 44:
//   - The 12-item Inspection checklist card (stitching quality, color
//     consistency, carton labeling FNSKU, carton weight, etc.)
//
// KEPT unchanged:
//   - Status header with status pill + inspector/AQL/visit type meta row
//   - Schedule controls + Upload photos / Upload report buttons
//   - Photos gallery
//   - Inspection report doc link card (when present) — here we show the
//     "no report yet" variant since result hasn't landed.
//   - Inspection fee service line link
//   - Extended switcher pills (Production · Shipping · Inspection │ Documents · Payments)
//   - Activity drawer

function ScreenInspection() {
  const order = window.ORDER;
  const insp  = window.INSPECTION;

  return (
    <div style={{ display: "flex", minHeight: "100%", background: "hsl(var(--background))" }}>
      <Sidebar />

      <div style={{
        flex: 1, minWidth: 0,
        padding: "16px 24px 32px",
        display: "flex", gap: 16,
      }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Breadcrumb */}
          <Breadcrumb trail={[
            { label: "Orders", back: true },
            { label: order.formatted, mono: true },
            { label: "Inspection", current: true },
          ]} />

          {/* Sub-spine */}
          <OrderSubSpine order={order} kpis={window.KPIS} />

          {/* Extended switcher pills — KEEP */}
          <SectionSwitcher active="inspection" />

          {/* Page header */}
          <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: -0.4 }}>Inspection</h2>
            <p style={{ margin: 0, fontSize: 14, color: "hsl(var(--muted-fg))" }}>
              QC truth · pre-shipment quality verification.
            </p>
          </header>

          {/* Schedule actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button size="sm" variant="outline" icon="cal">Edit schedule</Button>
            <Button size="sm" variant="outline" icon="imagePlus">Upload photos</Button>
            <Button size="sm" variant="outline" icon="upload">Upload report</Button>
          </div>

          {/* Status header card */}
          <Card style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <Icon name="clipboard" size={16} style={{ color: "hsl(var(--muted-fg))" }} />
                  <StatusBadge tone={insp.statusTone}>{insp.statusLabel}</StatusBadge>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{insp.inspectorName}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", columnGap: 16, rowGap: 4, fontSize: 11, color: "hsl(var(--muted-fg))" }}>
                  <span><span style={{ opacity: 0.7 }}>Scheduled:</span>{" "}
                    <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>{insp.scheduledDate}</span>
                  </span>
                  <span><span style={{ opacity: 0.7 }}>Visited:</span>{" "}
                    <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>—</span>
                  </span>
                  <span><span style={{ opacity: 0.7 }}>AQL:</span>{" "}
                    <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>{insp.aqlUsed}</span>
                  </span>
                  <span><span style={{ opacity: 0.7 }}>Defects (major / minor):</span>{" "}
                    <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>— / —</span>
                  </span>
                  <span><span style={{ opacity: 0.7 }}>Visit type:</span>{" "}
                    <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>{insp.visitType}</span>
                  </span>
                </div>
              </div>
              {/* No report yet — show muted "report pending" pill instead of the
                  green "Open report" link the page renders post-result. */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                borderRadius: 6, border: "0.5px dashed hsl(var(--border))",
                background: "hsl(var(--muted-bg))", color: "hsl(var(--muted-fg))",
                padding: "2px 8px", fontSize: 11,
              }}>
                <Icon name="fileText" size={11} />
                Report not received
              </span>
            </div>
          </Card>

          {/*
            ============================================================
            POST-CUT NOTE
            The "Inspection checklist" card used to live here — a 3-column
            grid with 12 items split into pre-visit / during-visit /
            post-visit (stitching quality, color consistency, carton
            labeling FNSKU, carton weight, etc). Per SCOPE 44 it is
            removed entirely. The page now jumps straight from status
            header into Photos.
            ============================================================
          */}

          {/* Photos gallery */}
          <Card style={{ overflow: "hidden" }}>
            <div style={{
              display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
              gap: 8,
              padding: 12, borderBottom: "0.5px solid hsl(var(--border))",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="imagePlus" size={16} style={{ color: "hsl(var(--muted-fg))" }} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Photos &amp; videos</h3>
                <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>
                  {insp.photos.length} files
                </span>
              </div>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8, padding: 12,
            }}>
              {insp.photos.map(p => (
                <a key={p.id} href="#" onClick={e => e.preventDefault()} style={{
                  aspectRatio: "1 / 1",
                  borderRadius: 6,
                  border: "0.5px solid hsl(var(--border))",
                  background: "hsl(var(--muted-bg))",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 4,
                  color: "hsl(var(--muted-fg))",
                  position: "relative",
                  overflow: "hidden",
                  textDecoration: "none",
                }} title={p.filename}>
                  {/* Subtle striped placeholder — a real photo loads in production */}
                  <div style={{
                    position: "absolute", inset: 0,
                    backgroundImage: "repeating-linear-gradient(135deg, hsl(var(--muted-bg)) 0 10px, hsl(var(--background)) 10px 20px)",
                    opacity: 0.55,
                  }} />
                  <Icon name="fileText" size={20} style={{ position: "relative", zIndex: 1 }} />
                  <span style={{ position: "relative", zIndex: 1, fontSize: 10 }}>Image</span>
                  <div style={{
                    position: "absolute", left: 0, right: 0, bottom: 0,
                    background: "hsl(var(--background) / 0.92)",
                    fontSize: 10, padding: "3px 6px",
                    color: "hsl(var(--muted-fg))",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{p.filename}</div>
                </a>
              ))}
            </div>
          </Card>

          {/* Fee reference card */}
          <Card style={{
            padding: 12,
            display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <Icon name="receipt" size={16} style={{ color: "hsl(var(--muted-fg))" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  Inspection fee · {insp.fee.description}
                </div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>
                  Logged as a service line on{" "}
                  <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{insp.fee.invoiceRef}</span>{" "}
                  — view on the Production page.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                ${insp.fee.amount.toLocaleString(undefined, {minimumFractionDigits:2})}
              </span>
              <Button size="sm" variant="outline">Open invoice</Button>
            </div>
          </Card>
        </div>

        <ActivityDrawer
          scope="inspection"
          count={4}
          feed={[
            { day: "Today",     items: [
              { src: "Insp", title: "Inspection booked with Lin Chen", time: "5h ago", icon: "stamp" },
              { src: "Doc",   title: "Pre-visit briefing emailed",      time: "5h ago", icon: "doc" },
            ]},
            { day: "Yesterday", items: [
              { src: "Insp", title: "AQL II locked at 2.5 / 4.0",       time: "1d ago", icon: "stamp" },
              { src: "Inv",   title: "Inspection fee added to PI",      time: "1d ago", icon: "receipt" },
            ]},
          ]}
        />
      </div>
    </div>
  );
}

window.ScreenInspection = ScreenInspection;
