// SCREEN 1 — Order Home (`/orders/[id]`) · POST-CUT STATE
//
// REMOVED per SCOPE 44:
//   1. Closeout checklist block (8-item grid at the bottom).
//   2. Notification bell badge in the spine (icon hidden entirely — no count badge).
//
// KEPT unchanged:
//   - Order spine (status pill, D1/D14/D25/D30 milestone strip, KPI row)
//   - Three section cards (Production · Shipping · Inspection)
//   - Two centralized shortcuts (Documents · Payments)
//   - Activity drawer button (rendered to the right of the main column)

function ScreenHome() {
  const order = window.ORDER;
  return (
    <div style={{ display: "flex", minHeight: "100%", background: "hsl(var(--background))" }}>
      <Sidebar />

      <div style={{
        flex: 1, minWidth: 0,
        padding: "16px 24px 32px",
        display: "flex", gap: 16,
      }}>
        {/* Main column (max-w-7xl xl:max-w-[1480px] equivalent) */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Back link */}
          <a href="#" onClick={e => e.preventDefault()} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 12, color: "hsl(var(--muted-fg))",
            textDecoration: "none",
            width: "fit-content",
          }}>
            <Icon name="chevronLeft" size={12} />
            Back to orders
          </a>

          {/* POST-CUT: showBellBadge intentionally omitted */}
          <OrderFullSpine
            order={order}
            milestones={window.MILESTONES}
            kpis={window.KPIS}
          />

          {/* Sections */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Kicker>Sections</Kicker>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SectionSummaryCard routeKey="production" label="Production" summary={window.SECTION_SUMMARIES.production} />
              <SectionSummaryCard routeKey="shipping"   label="Shipping"   summary={window.SECTION_SUMMARIES.shipping} />
              <SectionSummaryCard routeKey="inspection" label="Inspection" summary={window.SECTION_SUMMARIES.inspection} />
            </div>
          </section>

          {/* Centralized views */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Kicker>Centralized views</Kicker>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <CentralizedShortcut
                icon="fileText" label="Documents"
                line={window.CENTRALIZED.documents.byTypeStub}
              />
              <CentralizedShortcut
                icon="receipt" label="Payments"
                line={`${window.CENTRALIZED.payments.clearedCount} cleared · ${window.CENTRALIZED.payments.pendingCount} pending · ${Math.round(window.CENTRALIZED.payments.paidPct * 100)}% paid`}
                rightValue={`$${window.KPIS.paidUsd.toLocaleString(undefined, {minimumFractionDigits:2})}`}
                rightSublabel={`of $${window.KPIS.orderTotalUsd.toLocaleString(undefined, {minimumFractionDigits:2})}`}
              />
            </div>
          </section>

          {/*
            ============================================================
            POST-CUT NOTE
            The "Closeout" checklist card used to live here (8 items in a
            2-column grid: all invoices attached / all payments cleared /
            packing list complete / FBA shipments linked / received qty
            reconciled / etc). Per SCOPE 44 it is removed entirely.
            The page now ends after Centralized views.
            ============================================================
          */}
        </div>

        {/* Right-hand activity drawer (KEEP) */}
        <ActivityDrawer scope="all" feed={window.ACTIVITY_PREVIEW} count={6} />
      </div>
    </div>
  );
}

window.ScreenHome = ScreenHome;
