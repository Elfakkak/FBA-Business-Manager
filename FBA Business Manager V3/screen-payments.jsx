// SCREEN 3 — Order > Payments (`/orders/[id]/payments`) · POST-CUT STATE
//
// REMOVED per SCOPE 44:
//   - The section filter chips above the per-PI groups
//     ("All PIs · Production · Shipping · Inspection · Other")
//
// KEPT unchanged:
//   - 4 summary cards (Order total / Paid to date / Outstanding / Next due)
//   - Per-PI grouping blocks with their headers
//   - Payment row columns
//   - Inline 4-stage transit tracker (CENTERPIECE — do not touch)
//   - 24-business-hour prompt cadence indicators
//   - "+ Log payment" CTA
//   - Extended switcher pills
//   - Activity drawer

function ScreenPayments() {
  const order   = window.ORDER;
  const invoice = window.INVOICE;
  const payments = window.PAYMENTS;
  const kpis    = window.KPIS;
  const outstanding = kpis.orderTotalUsd - kpis.paidUsd;

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
            { label: "Payments", current: true },
          ]} />

          {/* Sub-spine */}
          <OrderSubSpine order={order} kpis={kpis} />

          {/* Extended switcher pills — KEEP */}
          <SectionSwitcher active="payments" />

          {/* Page header + Log payment CTA */}
          <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: -0.4 }}>Payments</h2>
              <p style={{ margin: "4px 0 0", fontSize: 14, color: "hsl(var(--muted-fg))" }}>
                All payments across all PIs · grouped by invoice.
              </p>
            </div>
            <Button variant="outline" size="sm" icon="plus">Log payment</Button>
          </header>

          {/* 4 summary cards — KEEP */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            <SummaryCard label="Order total"
              value={`$${kpis.orderTotalUsd.toLocaleString(undefined, {minimumFractionDigits:2})}`} />
            <SummaryCard label="Paid"
              value={`$${kpis.paidUsd.toLocaleString(undefined, {minimumFractionDigits:2})}`}
              sublabel={`${Math.round(kpis.paidPct * 100)}%`}
              accent="success" />
            <SummaryCard label="Outstanding"
              value={`$${outstanding.toLocaleString(undefined, {minimumFractionDigits:2})}`}
              accent="warning" />
            <SummaryCard label="Next due"
              value={`$${kpis.nextDueAmountUsd.toLocaleString(undefined, {minimumFractionDigits:2})}`}
              sublabel={kpis.nextDueDate} />
          </div>

          {/*
            ============================================================
            POST-CUT NOTE
            The section filter chip row used to live here:
              [ All PIs · Production · Shipping · Inspection · Other ]
            Per SCOPE 44 it is removed entirely. The page now jumps
            straight from the 4-summary grid into the per-PI grouping
            blocks below.
            ============================================================
          */}

          {/* Per-PI grouping — KEEP */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Card style={{ overflow: "hidden" }}>
              <PiHeader inv={invoice} />
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
                {payments.map((p, i) => (
                  <li key={p.id} style={{
                    padding: 12,
                    borderTop: i === 0 ? "none" : "0.5px solid hsl(var(--border))",
                    display: "flex", flexDirection: "column", gap: 10,
                  }}>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          fontSize: 11, fontWeight: 500,
                        }}>{p.paymentNumber}</span>
                        <span style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>
                          {p.currency} {p.amount.toLocaleString(undefined, {minimumFractionDigits:2})}
                        </span>
                        <span style={{ fontSize: 10, color: "hsl(var(--muted-fg))" }}>{p.paymentDate}</span>
                      </div>
                      <StatusBadge tone={p.statusTone} compact>{p.status}</StatusBadge>
                    </div>
                    <TransitCadenceIndicator payment={p} />
                  </li>
                ))}
              </ul>
            </Card>

            {/* Block totals footer (matches PisBlock) */}
            <Card style={{
              padding: "10px 16px",
              display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12,
              fontSize: 12,
            }}>
              <div style={{ color: "hsl(var(--muted-fg))" }}>
                <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>1</span> PI ·{" "}
                <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>2</span> payments logged
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  ${kpis.orderTotalUsd.toLocaleString(undefined, {minimumFractionDigits:2})}
                </div>
                <div style={{ fontSize: 10, color: "hsl(var(--muted-fg))" }}>
                  ${kpis.paidUsd.toLocaleString(undefined, {minimumFractionDigits:2})} cleared
                </div>
              </div>
            </Card>
          </div>
        </div>

        <ActivityDrawer
          scope="all"
          count={6}
          feed={[
            { day: "Today",     items: [
              { src: "Pay", title: "Payment #002 scheduled for Jun 5", time: "2h ago", icon: "dollar" },
              { src: "Insp", title: "Inspection booked with Lin Chen", time: "5h ago", icon: "stamp" },
            ]},
            { day: "Yesterday", items: [
              { src: "Doc", title: "D14 production photos uploaded",   time: "1d ago", icon: "doc" },
              { src: "Inv", title: "PI-2605-MUTU-001 logged at $8,120", time: "1d ago", icon: "receipt" },
            ]},
            { day: "May 6",     items: [
              { src: "Pay", title: "PAY-2605-001 cleared · $2,436",    time: "5d ago", icon: "dollar" },
            ]},
          ]}
        />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sublabel, accent }) {
  const color = accent === "success" ? "hsl(var(--success))" :
                accent === "warning" ? "hsl(var(--warning))" :
                "hsl(var(--foreground))";
  return (
    <Card style={{ padding: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.6, color: "hsl(var(--muted-fg))",
      }}>{label}</div>
      <div style={{
        fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums",
        color,
      }}>{value}</div>
      {sublabel ? <div style={{ fontSize: 10, color: "hsl(var(--muted-fg))" }}>{sublabel}</div> : null}
    </Card>
  );
}

window.ScreenPayments = ScreenPayments;
