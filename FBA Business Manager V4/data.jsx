// Mock data for SCOPE 44 — one order with 1 PI, some payments logged, a few documents.
// Sentence case throughout. Values mirror the shape used by the real app's server actions.

window.ORDER = {
  id: "ord_2605_mutu_001",
  formatted: "2605-MUTU-001",
  statusPipeline: "in_production",
  statusLabel: "In production",
  statusTone: "info",
  supplier: { name: "Mutual trade union", country: "CN" },
  agent: null,
  sourcingModel: "direct",
  placedAt: "May 4, 2026",
  orderDate: "May 4, 2026",
  totalUnits: 1200,
  totalSkus: 1,
  notificationCount: 3, // Intentionally non-zero in data; the badge is HIDDEN in the post-cut UI.
};

window.MILESTONES = {
  d1:  { label: "D1 · Material",   state: "done",       date: "May 6, 2026" },
  d14: { label: "D14 · Production", state: "in_flight", date: "May 19, 2026" },
  d25: { label: "D25 · Insp ready", state: "estimated", date: "May 30, 2026" },
  d30: { label: "D30 · Ship ready", state: "estimated", date: "Jun 4, 2026" },
};

window.KPIS = {
  orderTotalUsd: 8120.00,
  paidUsd: 2436.00,
  paidPct: 0.30,
  nextDueAmountUsd: 5684.00,
  nextDueDate: "Jun 5, 2026",
  fbaArrivalEta: "Jul 8, 2026",
};

window.SECTION_SUMMARIES = {
  production: {
    statusPill: { text: "On schedule", tone: "info" },
    contextLine: "1 PI · 1 SKU · D14 photos received",
    headlineNumberUsd: 8120.00,
    sublabel: "1,200 pcs",
    alertCount: 0,
  },
  shipping: {
    statusPill: { text: "Awaiting booking", tone: "muted" },
    contextLine: "No forwarder assigned · book by Jun 4",
    headlineNumberUsd: 0,
    sublabel: "Pending",
    alertCount: 0,
  },
  inspection: {
    statusPill: { text: "Scheduled", tone: "info" },
    contextLine: "AQL II · Inspect Pro · May 30",
    headlineNumberUsd: 320.00,
    sublabel: "Fee logged",
    alertCount: 0,
  },
};

window.CENTRALIZED = {
  documents: { byTypeStub: "12 documents · 4 categories · 2 missing" },
  payments:  { clearedCount: 1, pendingCount: 1, paidPct: 0.30 },
};

// One PI / vendor invoice covering the production line items.
window.INVOICE = {
  id: "pi_001",
  invoiceRef: "PI-2605-MUTU-001",
  vendorType: "supplier",        // Variant 2: two-circle cadence
  vendorTypeLabel: "Supplier",
  vendorName: "Mutual trade union",
  currency: "USD",
  amount: 8120.00,
  fxRateLocked: 1,
  status: "Partial",
  statusTone: "info",
  pctPaid: 30,
  invoiceDate: "May 4, 2026",
  dueDate: "Jun 5, 2026",
  coversOrderLineIds: ["ol_1"],
  coversChargeIds: ["ch_1"],
  paidUsd: 2436.00,
  section: "production",
};

// Payments on that invoice. The 4-stage transit tracker (`cadence`)
// is sacred — render exactly as the real component does.
window.PAYMENTS = [
  {
    id: "pay_001",
    paymentNumber: "PAY-2605-001",
    currency: "USD",
    amount: 2436.00,
    paymentDate: "May 6, 2026",
    status: "Cleared",
    statusTone: "info",
    // Supplier cadence (variant 2): cash_sent → supplier_received
    cadence: {
      kind: "supplier",
      stages: [
        { key: "cash_sent",          label: "Cash sent",          ts: "2026-05-06", state: "filled" },
        { key: "supplier_received",  label: "Supplier received",  ts: "2026-05-08", state: "filled" },
      ],
      productionAnchored: "May 8, 2026",
    },
  },
  {
    id: "pay_002",
    paymentNumber: "PAY-2605-002",
    currency: "USD",
    amount: 5684.00,
    paymentDate: "Jun 5, 2026",
    status: "Scheduled",
    statusTone: "info",
    cadence: {
      kind: "supplier",
      stages: [
        { key: "cash_sent",          label: "Cash sent",          ts: null, state: "future" },
        { key: "supplier_received",  label: "Supplier received",  ts: null, state: "future" },
      ],
      productionAnchored: null,
    },
  },
];

// Inspection page state — scheduled with inspector + AQL, no result yet,
// fee logged on Production, photos uploaded.
window.INSPECTION = {
  status: "scheduled",
  statusLabel: "Scheduled",
  statusTone: "info",
  inspectorName: "Inspect Pro · Lin Chen",
  scheduledDate: "May 30, 2026",
  inspectionDate: null,
  aqlUsed: "II / 2.5 / 4.0",
  defectsCountMajor: null,
  defectsCountMinor: null,
  unitsInspected: null,
  lotSize: 1200,
  visitType: "On-site · pre-shipment",
  reportDocId: null,
  photos: [
    { id: "ph_1", filename: "carton_label_FNSKU.jpg", type: "InspectionPhoto" },
    { id: "ph_2", filename: "stitch_close_up_01.jpg", type: "InspectionPhoto" },
    { id: "ph_3", filename: "color_tan_swatch.jpg",   type: "InspectionPhoto" },
    { id: "ph_4", filename: "outer_carton_weight.jpg", type: "InspectionPhoto" },
  ],
  fee: {
    description: "AQL II inspection · 1,200 pcs",
    invoiceRef: "PI-2605-INSP-001",
    invoiceId: "inv_insp_001",
    amount: 320.00,
    currency: "USD",
  },
};

window.ACTIVITY_PREVIEW = [
  { day: "Today",     items: [
    { src: "Pay",  title: "Payment #002 scheduled for Jun 5",      time: "2h ago", icon: "dollar" },
    { src: "Insp", title: "Inspection booked with Lin Chen",       time: "5h ago", icon: "stamp" },
  ]},
  { day: "Yesterday", items: [
    { src: "Doc",  title: "D14 production photos uploaded",        time: "1d ago", icon: "doc" },
    { src: "Inv",  title: "PI-2605-MUTU-001 logged at $8,120",     time: "1d ago", icon: "receipt" },
  ]},
  { day: "May 6",     items: [
    { src: "Pay",  title: "PAY-2605-001 cleared · $2,436",         time: "5d ago", icon: "dollar" },
  ]},
];
