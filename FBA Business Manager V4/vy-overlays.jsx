// Overlays: Activity drawer (right), Sheets (right on desktop, bottom on mobile),
// Confirm dialog, More-actions dropdown.

const { useEffect: vyUseEffect, useState: vyUseState, useRef: vyUseRef } = React;

// ----------------------------------------------------------------------
// SCRIM + lock body scroll while any overlay is open
// ----------------------------------------------------------------------
function VyScrim({ open, onClose }) {
  return (
    <div
      className={"vy-scrim" + (open ? " is-open" : "")}
      onClick={onClose}
      aria-hidden="true"
    />
  );
}

// ----------------------------------------------------------------------
// ACTIVITY DRAWER — right slide-in titled "Order activity"
// ----------------------------------------------------------------------
const ACTIVITY_FEED = [
  { day: "Today", items: [
    { icon: "dollar",   src: "Pay",  title: "PAY-2605-002 scheduled for Jun 5",   time: "2h ago", tone: "info" },
    { icon: "clipboard", src: "Insp", title: "Inspection booked with Lin Chen",    time: "5h ago", tone: "info" },
    { icon: "alert",    src: "Ship", title: "Shipment 2 flagged — packing list missing", time: "7h ago", tone: "danger" },
  ]},
  { day: "Yesterday", items: [
    { icon: "package",  src: "Doc",  title: "D14 production photos uploaded",     time: "1d ago", tone: "success" },
    { icon: "receipt",  src: "Inv",  title: "PI-2605-MUTU-001 logged at $14,125", time: "1d ago", tone: "info" },
  ]},
  { day: "May 6", items: [
    { icon: "check",    src: "Pay",  title: "PAY-2605-001 cleared · $8,980.15",   time: "5d ago", tone: "success" },
    { icon: "factory",  src: "Prod", title: "Production clock D1 anchored",        time: "5d ago", tone: "info" },
  ]},
];

function VyActivityDrawer({ open, onClose }) {
  vyUseEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <React.Fragment>
      <VyScrim open={open} onClose={onClose} />
      <aside
        className={"vy-drawer" + (open ? " is-open" : "")}
        role="dialog"
        aria-label="Order activity"
        aria-hidden={!open}
      >
        <div className="vy-drawer-head">
          <div>
            <div className="vy-drawer-title">Order activity</div>
            <div className="vy-drawer-sub vy-mono">{ORDER.id}</div>
          </div>
          <button type="button" className="vy-icon-btn" onClick={onClose} aria-label="Close activity">
            <VyIcon name="x" size={15} />
          </button>
        </div>
        <div className="vy-drawer-filters" role="tablist">
          {["All", "Pay", "Inv", "Insp", "Ship", "Doc"].map((c, i) => (
            <button key={c} type="button" className={"vy-drawer-chip" + (i === 0 ? " is-active" : "")}>
              {c}
            </button>
          ))}
        </div>
        <div className="vy-drawer-body">
          {ACTIVITY_FEED.map((group) => (
            <div className="vy-drawer-group" key={group.day}>
              <div className="vy-kicker">{group.day}</div>
              {group.items.map((it, i) => (
                <div className="vy-activity-row" key={i}>
                  <span className={"vy-activity-icon vy-activity-icon--" + it.tone}>
                    <VyIcon name={it.icon} size={11} />
                  </span>
                  <div className="vy-activity-main">
                    <div className="vy-activity-title">{it.title}</div>
                    <div className="vy-activity-meta">
                      <span className="vy-tag-mono">{it.src}</span>
                      <span>·</span>
                      <span>{it.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="vy-drawer-foot">
          <a href="#" onClick={(e) => e.preventDefault()}>
            See full journal
            <VyIcon name="arrowRight" size={12} />
          </a>
        </div>
      </aside>
    </React.Fragment>
  );
}

// ----------------------------------------------------------------------
// SHEET — right on desktop, bottom on mobile; placeholder forms
// ----------------------------------------------------------------------
const SHEET_DEFS = {
  "create-order": {
    title: "Create order",
    helper: "Start a new buying record. Add products, invoices, and shipments after creation.",
    sections: [
      { title: "Order basics", fields: [
        { label: "Order ref",      type: "text",     value: "ORD-2026-05-010", placeholder: "Auto-generated", fullWidth: false },
        { label: "Order name",     type: "text",     value: "", placeholder: "e.g. Q2 restock — Floor mats", fullWidth: false },
        { label: "Target ship date", type: "date",   value: "", fullWidth: true },
      ]},
      { title: "Supplier", fields: [
        { label: "",               type: "select",   options: ["Mutual Trade Union", "Sheng Te Long", "Huasheng Leather", "Ningbo Auto Trim", "Fujian PU Goods", "Shenzhen Wheel Co", "+ New supplier"], fullWidth: true },
      ]},
    ],
    confirm: "Create draft order",
  },
  "add-product-step1": {
    custom: true,
  },
  "add-product-step2": {
    custom: true,
  },
  "add-product": {
    title: "Add product line",
    helper: "Attach an existing SKU to this order, or create a new one.",
    sections: [
      { title: "Product", fields: [
        { label: "SKU",            type: "select",   options: ["BSC-TAN-XL · Beaded seat cover · Tan · XL", "BSC-BLK-XL · Beaded seat cover · Black · XL", "+ Create new variant"] },
        { label: "Parent product", type: "text",     value: "Beaded seat cover" },
      ]},
      { title: "Quantity", fields: [
        { label: "Units",          type: "number",   value: "1600", suffix: "pcs" },
        { label: "Carton qty",     type: "number",   value: "40",   suffix: "pcs/ctn" },
      ]},
      { title: "Pricing", fields: [
        { label: "Unit cost",      type: "number",   value: "8.83", prefix: "$" },
        { label: "Currency",       type: "select",   options: ["USD", "CNY"] },
      ]},
    ],
    confirm: "Add product line",
  },
  "add-shipment": {
    title: "Add shipment batch",
    helper: "Each batch ships separately and can link to one or more FBA inbounds.",
    sections: [
      { title: "Identity", fields: [
        { label: "Batch ref",      type: "text",     value: "SHIP-2605-002" },
        { label: "Mode",           type: "select",   options: ["Sea · FCL", "Sea · LCL", "Air · Express", "Air · Cargo"] },
      ]},
      { title: "Route", fields: [
        { label: "Origin",         type: "text",     value: "Yantian, CN" },
        { label: "Destination",    type: "text",     value: "Long Beach, US" },
      ]},
      { title: "Forwarder", fields: [
        { label: "Forwarder",      type: "select",   options: ["ECU Worldwide", "Flexport", "Yusen Logistics", "+ New forwarder"] },
        { label: "ETA",            type: "date",     value: "2026-06-24" },
      ]},
    ],
    confirm: "Create shipment",
  },
  "schedule-inspection": {
    title: "Schedule inspection",
    helper: "Book a QC visit. The inspector receives a confirmation email automatically.",
    sections: [
      { title: "Inspector", fields: [
        { label: "Agency",         type: "select",   options: ["Inspect Pro", "AsiaInspection", "QIMA", "+ New agency"] },
        { label: "Lead inspector", type: "text",     value: "Lin Chen" },
      ]},
      { title: "Scope", fields: [
        { label: "AQL",            type: "select",   options: ["II / 2.5 / 4.0", "II / 1.5 / 2.5", "III / 2.5 / 4.0"] },
        { label: "Visit type",     type: "select",   options: ["On-site · pre-shipment", "On-site · during", "Container loading"] },
      ]},
      { title: "Date", fields: [
        { label: "Scheduled date", type: "date",     value: "2026-05-30" },
        { label: "Fee",            type: "number",   value: "320.00", prefix: "$" },
      ]},
    ],
    confirm: "Book inspection",
  },
  "add-invoice": {
    title: "Add invoice",
    helper: "Log a vendor bill — payments and proof attach to it once cleared.",
    sections: [
      { title: "Vendor", fields: [
        { label: "Vendor type",    type: "select",   options: ["Supplier", "Agent", "Forwarder", "Inspection", "Other"] },
        { label: "Vendor name",    type: "select",   options: ["Mutual Trade Union", "Sheng Te Long", "Inspect Pro", "+ New vendor"] },
      ]},
      { title: "Invoice", fields: [
        { label: "Invoice ref",    type: "text",     value: "PI-2605-MUTU-002" },
        { label: "Issue date",     type: "date",     value: "2026-05-23" },
        { label: "Due date",       type: "date",     value: "2026-06-05" },
        { label: "Amount",         type: "number",   value: "5465.63", prefix: "$" },
      ]},
    ],
    confirm: "Log invoice",
  },
};

// Read the create-order sheet's DOM values (uncontrolled inputs) by zipping the
// rendered inputs/selects with the flattened field list, then assemble a draft
// order row in the ORDERS_LIST shape so it slots straight into the table.
function buildOrderDraft(bodyEl, def, prefill) {
  const fields = [];
  (def.sections || []).forEach((s) => (s.fields || []).forEach((f) => fields.push({ section: s.title, label: f.label })));
  const els = bodyEl ? bodyEl.querySelectorAll(".vy-field input, .vy-field select, .vy-field textarea") : [];
  const get = (section, label) => {
    const idx = fields.findIndex((f) => f.section === section && f.label === label);
    return idx >= 0 && els[idx] ? String(els[idx].value).trim() : "";
  };

  const ref = get("Order basics", "Order ref") || ("ORD-DRAFT-" + Date.now().toString().slice(-5));
  const name = get("Order basics", "Order name") || "Untitled draft order";
  const shipDate = get("Order basics", "Target ship date");
  const supplier = get("Supplier", "") || "Unassigned supplier";
  const sku = get("Reorder line", "SKU") || (prefill && prefill.sku) || "";
  const unitsRaw = get("Reorder line", "Units");
  const costRaw = get("Reorder line", "Unit cost");
  const units = parseFloat(unitsRaw.replace(/[^\d.]/g, "")) || 0;
  const cost = parseFloat(costRaw.replace(/[^\d.]/g, "")) || 0;

  const total = units * cost;
  const money = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateLabel = shipDate
    ? new Date(shipDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "No ship date";

  const metaBits = [];
  if (sku) metaBits.push("1 SKU");
  if (units) metaBits.push(units.toLocaleString() + " units");
  metaBits.push(dateLabel);

  return {
    id: ref,
    title: name,
    meta: metaBits.join(" · "),
    supplier,
    route: "Direct supplier",
    production: "Draft",
    productionSub: "awaiting deposit",
    moneyTotal: total ? money(total) + " total" : "Total TBD",
    moneyDue: total ? money(total * 0.3) + " deposit needed" : "Deposit needed",
    moneyPct: "0% paid",
    moneySub: "",
    shipping: "TBD",
    shippingSub: "FBA not linked",
    proof: "0/12 filled",
    proofSub: sku ? "Seeded from Inventory · " + sku : "New draft",
    nextStep: "Send deposit to start production",
    status: "Draft",
    statusTone: "muted",
    isDraft: true,
  };
}

function VySheet({ sheetKey, prefill, onCreate, onClose }) {
  const open = !!sheetKey;
  const bodyRef = vyUseRef(null);
  let def = sheetKey ? SHEET_DEFS[sheetKey] : null;

  // Seed the create-order form when launched from an Inventory "Reorder" click.
  if (def && sheetKey === "create-order" && prefill && prefill.sku) {
    const supplierOpts = SHEET_DEFS["create-order"].sections[1].fields[0].options;
    const opts = supplierOpts.includes(prefill.supplier) || !prefill.supplier
      ? supplierOpts
      : [prefill.supplier, ...supplierOpts];
    def = {
      ...def,
      helper: "Seeded from Inventory — review the suggested line, then create the draft.",
      banner: { sku: prefill.sku, qty: prefill.qty },
      sections: [
        {
          title: "Order basics",
          fields: [
            { label: "Order ref", type: "text", value: "ORD-2026-05-010", placeholder: "Auto-generated" },
            { label: "Order name", type: "text", value: "Reorder — " + (prefill.name || prefill.sku) },
            { label: "Target ship date", type: "date", value: "", fullWidth: true },
          ],
        },
        {
          title: "Supplier",
          fields: [{ label: "", type: "select", options: opts, value: prefill.supplier || opts[0], fullWidth: true }],
        },
        {
          title: "Reorder line",
          fields: [
            { label: "SKU", type: "text", value: prefill.sku, fullWidth: true },
            { label: "Units", type: "number", value: prefill.qty, suffix: "pcs" },
            { label: "Unit cost", type: "number", value: prefill.cost, prefix: "$" },
          ],
        },
      ],
    };
  }

  vyUseEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <React.Fragment>
      <VyScrim open={open} onClose={onClose} />
      <aside
        className={"vy-sheet" + (open ? " is-open" : "")}
        role="dialog"
        aria-label={def ? def.title : "Sheet"}
        aria-hidden={!open}
      >
        {def ? (
          <React.Fragment>
            <div className="vy-sheet-head">
              <div>
                <div className="vy-sheet-title">{def.title}</div>
                <div className="vy-sheet-helper">{def.helper}</div>
              </div>
              <button type="button" className="vy-icon-btn" onClick={onClose} aria-label="Close sheet">
                <VyIcon name="x" size={15} />
              </button>
            </div>
            <div className="vy-sheet-body" ref={bodyRef}>
              {def.banner ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 16, borderRadius: 10, background: "hsl(var(--primary) / 0.07)", border: "1px solid hsl(var(--primary) / 0.22)" }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.14)", color: "hsl(var(--primary))", flexShrink: 0 }}>
                    <VyIcon name="refresh" size={13} />
                  </span>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    Reordering <strong className="vy-mono" style={{ fontWeight: 700 }}>{def.banner.sku}</strong> · suggested <strong>{def.banner.qty} pcs</strong> from your sales velocity &amp; lead time.
                  </div>
                </div>
              ) : null}
              {def.sections.map((s, si) => (
                <div className="vy-form-section" key={si}>
                  <div className="vy-kicker">{s.title}</div>
                  <div className="vy-form-grid">
                    {s.fields.map((f, fi) => (
                      <label 
                        className="vy-field" 
                        key={fi}
                        style={f.fullWidth ? { gridColumn: "1 / -1" } : {}}
                      >
                        {f.label && <span className="vy-field-label">{f.label}</span>}
                        {f.type === "select" ? (
                          <select 
                            className="vy-input" 
                            defaultValue={f.value || f.options[0]}
                          >
                            {f.options.map((o) => <option key={o}>{o}</option>)}
                          </select>
                        ) : f.type === "date" ? (
                          <input className="vy-input" type="date" defaultValue={f.value} />
                        ) : (
                          <span className="vy-input-wrap">
                            {f.prefix ? <span className="vy-input-affix">{f.prefix}</span> : null}
                            <input
                              className={"vy-input" + (f.prefix ? " vy-input--prefixed" : "") + (f.suffix ? " vy-input--suffixed" : "")}
                              type={f.type === "number" ? "text" : "text"}
                              defaultValue={f.value}
                              placeholder={f.placeholder}
                              inputMode={f.type === "number" ? "decimal" : undefined}
                            />
                            {f.suffix ? <span className="vy-input-affix vy-input-affix--right">{f.suffix}</span> : null}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="vy-sheet-foot">
              <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
              <button 
                type="button" 
                className="vy-btn vy-btn--primary" 
                onClick={() => {
                  if (sheetKey === "create-order") {
                    if (onCreate) {
                      onCreate(buildOrderDraft(bodyRef.current, def, prefill));
                    } else {
                      // No handler wired (e.g. opened from the Order Shell) — keep the stub.
                      alert("Draft order created!");
                      onClose();
                    }
                  } else {
                    onClose();
                  }
                }}
              >
                {def.confirm}
              </button>
            </div>
          </React.Fragment>
        ) : null}
      </aside>
    </React.Fragment>
  );
}

// ----------------------------------------------------------------------
// CONFIRM DIALOG — finalize closeout
// ----------------------------------------------------------------------
function VyDialog({ dialogKey, onClose }) {
  const open = !!dialogKey;

  vyUseEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <React.Fragment>
      <VyScrim open={open} onClose={onClose} />
      <div className={"vy-dialog-wrap" + (open ? " is-open" : "")} aria-hidden={!open}>
        <div className="vy-dialog" role="dialog" aria-label="Finalize landed cost">
          <div className="vy-dialog-head">
            <span className="vy-dialog-icon vy-dialog-icon--warning">
              <VyIcon name="alert" size={18} />
            </span>
            <div>
              <div className="vy-dialog-title">Finalize landed cost?</div>
              <div className="vy-dialog-helper">
                Locks the inventory lot, freezes landed cost, and exports the accountant package.
                You can still attach documents after, but cost lines become read-only.
              </div>
            </div>
          </div>
          <div className="vy-dialog-checklist">
            <div className="vy-check-row vy-check-row--ok">
              <VyIcon name="check" size={12} />
              <span>All invoices reconciled</span>
            </div>
            <div className="vy-check-row vy-check-row--pending">
              <VyIcon name="alert" size={12} />
              <span>Units received not yet counted</span>
            </div>
            <div className="vy-check-row vy-check-row--pending">
              <VyIcon name="alert" size={12} />
              <span>Balance due of $5,465.63 outstanding</span>
            </div>
          </div>
          <div className="vy-dialog-foot">
            <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="vy-btn vy-btn--primary" onClick={onClose} disabled>
              Finalize landed cost
            </button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ----------------------------------------------------------------------
// MORE-actions dropdown (small popover anchored to the title bar)
// ----------------------------------------------------------------------
function VyMoreMenu({ open, onClose, inspectionRequired = true, onToggleInspection, onEditOrder }) {
  vyUseEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (!e.target.closest(".vy-more-menu") && !e.target.closest("[data-vy-more-trigger]")) {
        onClose();
      }
    }
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="vy-more-menu" role="menu">
      <button type="button" className="vy-more-item" role="menuitem" onClick={() => { if (onEditOrder) onEditOrder(); else onClose(); }}>
        <VyIcon name="pencil" size={13} />
        <span>Edit order</span>
      </button>
      {onToggleInspection ? (
        <button type="button" className="vy-more-item" role="menuitemcheckbox" aria-checked={inspectionRequired} onClick={() => { onToggleInspection(); onClose(); }}>
          <VyIcon name={inspectionRequired ? "check" : "clipboard"} size={13} />
          <span>{inspectionRequired ? "Inspection required" : "Inspection not required"}</span>
        </button>
      ) : null}
      <div className="vy-more-sep" />
      <button type="button" className="vy-more-item vy-more-item--danger" role="menuitem" onClick={onClose}>
        <VyIcon name="alert" size={13} />
        <span>Archive order</span>
      </button>
    </div>
  );
}

Object.assign(window, { VyActivityDrawer, VySheet, VyDialog, VyMoreMenu, VyScrim, SHEET_DEFS, ACTIVITY_FEED });

// ----------------------------------------------------------------------
// ADD PRODUCT SHEET (multi-step) - for Production page
// ----------------------------------------------------------------------
const PRODUCT_CATALOG = [
  {
    parent: "Beaded seat cover — Black",
    parentSku: "SKU-BSC",
    variants: [
      { sku: "SEMI-BSC-1P-BLK", name: "Semi truck 1-piece black", inventory: 245, image: true },
      { sku: "SEMI-BSC-2P-BLK", name: "Semi truck 2-piece black", inventory: 180, image: true },
      { sku: "CAR-BSC-1P-BLK", name: "Car 1-piece black", inventory: 320, image: true },
      { sku: "CAR-BSC-2P-BLK", name: "Car 2-piece black", inventory: 156, image: false },
    ],
  },
  {
    parent: "Beaded seat cover — Tan",
    parentSku: "SKU-BSC-TAN",
    variants: [
      { sku: "SEMI-BSC-1P-TAN", name: "Semi truck 1-piece tan", inventory: 89, image: true },
      { sku: "SEMI-BSC-2P-TAN", name: "Semi truck 2-piece tan", inventory: 52, image: false },
      { sku: "CAR-BSC-1P-TAN", name: "Car 1-piece tan", inventory: 210, image: true },
      { sku: "CAR-BSC-2P-TAN", name: "Car 2-piece tan", inventory: 143, image: true },
    ],
  },
  {
    parent: "Microfiber steering cover",
    parentSku: "SKU-MSC",
    variants: [
      { sku: "MSC-BLK-S", name: "Black small", inventory: 412, image: true },
      { sku: "MSC-BLK-M", name: "Black medium", inventory: 528, image: true },
      { sku: "MSC-BLK-L", name: "Black large", inventory: 367, image: true },
      { sku: "MSC-GRY-S", name: "Gray small", inventory: 198, image: false },
      { sku: "MSC-GRY-M", name: "Gray medium", inventory: 243, image: true },
      { sku: "MSC-GRY-L", name: "Gray large", inventory: 189, image: true },
    ],
  },
];

function AddProductSheetMulti({ onClose }) {
  const [step, setStep] = vyUseState(1);
  const [selectedParent, setSelectedParent] = vyUseState("");
  const [selectedVariants, setSelectedVariants] = vyUseState([]);
  const [variantData, setVariantData] = vyUseState({});

  const currentParent = PRODUCT_CATALOG.find(p => p.parent === selectedParent);

  function toggleVariant(sku) {
    if (selectedVariants.includes(sku)) {
      setSelectedVariants(selectedVariants.filter(s => s !== sku));
    } else {
      setSelectedVariants([...selectedVariants, sku]);
    }
  }

  function updateVariantData(sku, field, value) {
    setVariantData({
      ...variantData,
      [sku]: { ...(variantData[sku] || {}), [field]: value },
    });
  }

  function handleNext() {
    if (step === 1 && selectedVariants.length > 0) {
      setStep(2);
    }
  }

  function handleBack() {
    if (step === 2) {
      setStep(1);
    }
  }

  function handleAddProducts() {
    alert(`Adding ${selectedVariants.length} products to order`);
    onClose();
  }

  return (
    <React.Fragment>
      <VyScrim open={true} onClose={onClose} />
      <div className="vy-dialog-wrap is-open" style={{ zIndex: 100 }}>
        <div className="vy-dialog" role="dialog" style={{ maxWidth: 720, width: "90vw" }}>
          <div className="vy-dialog-head">
            <span className="vy-dialog-icon vy-dialog-icon--brand">
              <VyIcon name="package" size={18} />
            </span>
            <div style={{ flex: 1 }}>
              <div className="vy-dialog-title">
                {step === 1 ? "Add product — Select variants" : "Add product — Enter details"}
              </div>
              <div className="vy-dialog-helper">
                {step === 1 
                  ? "Choose a parent product, then select one or more variants to add to this order." 
                  : `Enter quantity and pricing for ${selectedVariants.length} selected variant${selectedVariants.length > 1 ? 's' : ''}.`}
              </div>
            </div>
            <button type="button" className="vy-icon-btn" onClick={onClose} aria-label="Close">
              <VyIcon name="x" size={15} />
            </button>
          </div>

          <div style={{ padding: "20px 24px", maxHeight: "60vh", overflowY: "auto" }}>
          {step === 1 ? (
            <React.Fragment>
              <div className="vy-form-section">
                <div className="vy-kicker">Parent product</div>
                <select 
                  className="vy-input" 
                  value={selectedParent}
                  onChange={(e) => {
                    setSelectedParent(e.target.value);
                    setSelectedVariants([]);
                  }}
                >
                  <option value="">Select parent product</option>
                  {PRODUCT_CATALOG.map(p => (
                    <option key={p.parent} value={p.parent}>{p.parent}</option>
                  ))}
                  <option value="__new__">+ Create new product</option>
                </select>
              </div>

              {currentParent && (
                <div className="vy-form-section">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div className="vy-kicker">Select variants ({selectedVariants.length} selected)</div>
                    <button
                      type="button"
                      className="vy-btn vy-btn--ghost vy-btn--sm"
                      style={{ height: 26, fontSize: 11 }}
                      onClick={() => {
                        if (selectedVariants.length === currentParent.variants.length) {
                          setSelectedVariants([]);
                        } else {
                          setSelectedVariants(currentParent.variants.map(v => v.sku));
                        }
                      }}
                    >
                      {selectedVariants.length === currentParent.variants.length ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {currentParent.variants.map(variant => {
                      const isSelected = selectedVariants.includes(variant.sku);
                      return (
                        <div
                          key={variant.sku}
                          onClick={() => toggleVariant(variant.sku)}
                          style={{
                            padding: "12px 14px",
                            border: isSelected ? "2px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            background: isSelected ? "hsl(var(--primary) / 0.05)" : "hsl(var(--background) / 0.6)",
                            cursor: "pointer",
                            transition: "all 120ms ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              style={{ marginTop: 2, width: 16, height: 16, cursor: "pointer" }}
                            />
                            <div
                              style={{
                                width: 50,
                                height: 50,
                                borderRadius: 6,
                                background: variant.image 
                                  ? "linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--border)) 100%)"
                                  : "hsl(var(--border) / 0.3)",
                                border: "1px solid hsl(var(--border))",
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                              }}
                            >
                              {variant.image ? (
                                <VyIcon name="package" size={20} style={{ color: "hsl(var(--muted-fg))" }} />
                              ) : (
                                <VyIcon name="alert" size={16} style={{ color: "hsl(var(--warning))" }} />
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, fontFamily: "JetBrains Mono, monospace", marginBottom: 3 }}>
                                {variant.sku}
                              </div>
                              <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginBottom: 4 }}>
                                {variant.name}
                              </div>
                              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>
                                Inventory: <span style={{ fontWeight: 600, color: variant.inventory > 200 ? "hsl(var(--success))" : variant.inventory > 50 ? "hsl(var(--warning))" : "hsl(var(--danger))" }}>
                                  {variant.inventory} pcs
                                </span>
                              </div>
                              {!variant.image && (
                                <div style={{ fontSize: 10, color: "hsl(var(--warning))", marginTop: 2 }}>
                                  No image
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </React.Fragment>
          ) : (
            <div className="vy-form-section">
              <div className="vy-kicker" style={{ marginBottom: 10 }}>Product details</div>
              <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))" }}>SKU</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 100 }}>QTY</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 110 }}>UNIT ¥ REF</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--muted-fg))", width: 110 }}>UNIT $ INVOICE</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVariants.map(sku => {
                    const variant = currentParent?.variants.find(v => v.sku === sku);
                    const data = variantData[sku] || {};
                    return (
                      <tr key={sku} style={{ borderBottom: "1px solid hsl(var(--border) / 0.6)" }}>
                        <td style={{ padding: "10px 10px" }}>
                          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11.5, fontWeight: 600 }}>{sku}</div>
                          <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{variant?.name}</div>
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <input
                            className="vy-input"
                            type="text"
                            inputMode="numeric"
                            value={data.qty || ""}
                            onChange={(e) => updateVariantData(sku, "qty", e.target.value)}
                            placeholder="0"
                            style={{ width: "100%", textAlign: "right", fontFamily: "JetBrains Mono, monospace" }}
                          />
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <input
                            className="vy-input"
                            type="text"
                            inputMode="decimal"
                            value={data.rmb || ""}
                            onChange={(e) => updateVariantData(sku, "rmb", e.target.value)}
                            placeholder="0.00"
                            style={{ width: "100%", textAlign: "right", fontFamily: "JetBrains Mono, monospace" }}
                          />
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <input
                            className="vy-input"
                            type="text"
                            inputMode="decimal"
                            value={data.usd || ""}
                            onChange={(e) => updateVariantData(sku, "usd", e.target.value)}
                            placeholder="0.00"
                            style={{ width: "100%", textAlign: "right", fontFamily: "JetBrains Mono, monospace" }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>

          <div className="vy-dialog-foot">
            {step === 2 && (
              <button type="button" className="vy-btn vy-btn--ghost" onClick={handleBack}>
                <VyIcon name="chevronLeft" size={14} />
                <span>Back</span>
              </button>
            )}
            <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
            {step === 1 ? (
              <button
                type="button"
                className="vy-btn vy-btn--primary"
                onClick={handleNext}
                disabled={selectedVariants.length === 0}
              >
                <span>Next — Enter details</span>
                <VyIcon name="chevronRight" size={14} />
              </button>
            ) : (
              <button type="button" className="vy-btn vy-btn--primary" onClick={handleAddProducts}>
                Add {selectedVariants.length} product{selectedVariants.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { AddProductSheetMulti });
