// Vyonix Orders List — interactive prototype
// Route: /orders

const { useState, useEffect, useRef } = React;

// ----------------------------------------------------------------------
// KPI STRIP (icon-led summary of the portfolio)
// ----------------------------------------------------------------------
const ORDERS_KPI_ICON = {
  Activity: "boxes", Money: "dollar", Production: "hammer",
  QC: "clipboard", Ship: "truck", Closeout: "closeout",
};

function OrdersKpiRow() {
  return (
    <div className="vy-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
      {ORDERS_KPI.map((kpi, i) => (
        <div
          key={i}
          className={"vy-card vy-kpi" + (kpi.tone ? ` vy-kpi--${kpi.tone}` : "")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <VyIcon name={ORDERS_KPI_ICON[kpi.kicker] || "boxes"} size={14} style={{ opacity: 0.7 }} />
            <span className="vy-kicker">{kpi.label}</span>
          </div>
          <div className="vy-kpi-value" style={{ fontSize: 18 }}>{kpi.value}</div>
          <div className="vy-kpi-sub">{kpi.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// SEARCH + FILTER BAR
// ----------------------------------------------------------------------
function OrdersFilterBar({ activeChips, onToggleChip, statusFilter, onStatusChange }) {
  const [showDropdown, setShowDropdown] = useState(null);

  return (
    <div className="vy-card" style={{ padding: "14px 16px" }}>
      {/* Search + dropdowns */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 320px", minWidth: 0 }}>
          <VyIcon
            name="search"
            size={14}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-fg))" }}
          />
          <input
            type="text"
            className="vy-input"
            placeholder="Search order, supplier, agent, PI, SKU, FBA ID"
            style={{ paddingLeft: 34 }}
          />
        </div>
        <select className="vy-input" style={{ width: 140 }} value={statusFilter} onChange={(e) => onStatusChange && onStatusChange(e.target.value)}>
          <option>All statuses</option>
          <option>Draft</option>
          <option>In production</option>
          <option>Inspection</option>
          <option>In transit</option>
          <option>At FBA</option>
          <option>Closed</option>
        </select>
        <select className="vy-input" style={{ width: 140 }}>
          <option>All suppliers</option>
          <option>Sheng Te Long</option>
          <option>Huasheng Leather</option>
          <option>Ningbo Auto Trim</option>
          <option>Fujian PU Goods</option>
          <option>Shenzhen Wheel Co</option>
        </select>
        <button type="button" className="vy-btn vy-btn--outline">
          <VyIcon name="calendar" size={13} />
          <span>Date range</span>
        </button>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FILTER_CHIPS.map((chip) => {
          const isActive = activeChips.includes(chip);
          return (
            <button
              key={chip}
              type="button"
              className="vy-chip"
              onClick={() => onToggleChip(chip)}
              style={
                isActive
                  ? {
                      background: "hsl(var(--primary) / 0.12)",
                      color: "hsl(var(--primary))",
                      borderColor: "hsl(var(--primary) / 0.3)",
                    }
                  : {}
              }
            >
              {chip}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// ORDERS TABLE — desktop table, mobile cards
// ----------------------------------------------------------------------
function OrdersTable({ orders, onOpenOrder, emptyFiltered, onClearFilter, onNewOrder, selectedIds, onToggleSelect, onToggleAll }) {
  if (!orders.length) {
    return emptyFiltered ? (
      <VyEmptyState
        icon="filter"
        title="No orders match this filter"
        body="No orders are in this status right now. Clear the filter to see the full list."
        actions={[{ label: "Clear filter", icon: "x", onClick: onClearFilter, primary: true }]}
      />
    ) : (
      <VyEmptyState
        icon="cube"
        tone="primary"
        title="No orders yet"
        body="Create your first purchase order to start tracking production, shipping, inspection, invoices and landed cost in one place."
        actions={[{ label: "New order", icon: "plus", onClick: onNewOrder, primary: true }]}
      />
    );
  }
  const allSelected = orders.length > 0 && orders.every((o) => selectedIds.has(o.id));
  const someSelected = orders.some((o) => selectedIds.has(o.id));
  return (
    <div className="vy-card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Desktop table */}
      <div className="vy-orders-table">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
              <th style={{ ...thStyle, width: 40, paddingRight: 0 }}>
                <input type="checkbox" aria-label="Select all orders" checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }} onChange={onToggleAll} style={ordCheckbox} />
              </th>
              <th style={thStyle}>Order</th>
              <th style={thStyle}>Units</th>
              <th style={thStyle}>Supplier</th>
              <th style={thStyle}>Dates</th>
              <th style={thStyle}>Money</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const meta = order.meta || "";
              const unitsM = meta.match(/([\d,]+)\s*units/i);
              const skuM = meta.match(/(\d+)\s*SKUs?/i);
              const parts = meta.split("·").map((s) => s.trim()).filter(Boolean);
              const placed = order.placedOn || (parts.length ? parts[parts.length - 1] : "");
              const etaM = (order.shippingSub || "").match(/FBA ETA\s*([A-Za-z0-9 ]+)/i);
              const fbaEta = order.fbaEta || (etaM ? etaM[1].trim() : "");
              const dimMuted = { fontSize: 11, color: "hsl(var(--muted-fg))", lineHeight: 1.35 };
              return (
              <tr
                key={order.id}
                className="vy-order-row"
                onClick={() => onOpenOrder(order.id)}
                style={{ cursor: "pointer", background: selectedIds.has(order.id) ? "hsl(var(--primary) / 0.05)" : undefined }}
              >
                <td style={{ ...tdStyle, paddingRight: 0 }} onClick={(e) => { e.stopPropagation(); onToggleSelect(order.id); }}>
                  <input type="checkbox" aria-label={"Select " + order.id} checked={selectedIds.has(order.id)} onChange={() => onToggleSelect(order.id)} onClick={(e) => e.stopPropagation()} style={ordCheckbox} />
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="vy-mono" style={{ fontSize: 11, color: "hsl(var(--muted-fg))", lineHeight: 1.3, display: "flex", alignItems: "center", gap: 6 }}>
                      {order.id}
                      {order.isDraft ? <span className="vy-badge vy-badge--brand" style={{ fontSize: 9, padding: "1px 6px" }}>New</span> : null}
                      {order.archived ? <span className="vy-badge vy-badge--muted" style={{ fontSize: 9, padding: "1px 6px" }}>Archived</span> : null}
                    </span>
                    <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(order.id)} onClick={(e) => e.stopPropagation()} title="Open order" style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))", lineHeight: 1.3, textDecoration: "none" }} className="vy-order-title-link">
                      {order.title}
                    </a>
                  </div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="vy-mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{unitsM ? unitsM[1] : "—"}<span style={{ fontWeight: 400, color: "hsl(var(--muted-fg))" }}> units</span></span>
                    <span style={dimMuted}>{skuM ? skuM[1] + (Number(skuM[1]) === 1 ? " SKU" : " SKUs") : "—"}</span>
                  </div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>{order.supplier}</span>
                    <span style={dimMuted}>{order.route}</span>
                  </div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={dimMuted}><span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>Placed</span> {placed || "—"}</span>
                    <span style={dimMuted}><span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>Ship</span> {order.shipping || "TBD"}</span>
                    <span style={dimMuted}><span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>FBA ETA</span> {fbaEta || "—"}</span>
                  </div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="vy-mono" style={{ fontSize: 12, fontWeight: 600 }}>{order.moneyTotal}</span>
                    <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{order.moneyDue}</span>
                    {order.moneyPct && (
                      <span style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{order.moneyPct}</span>
                    )}
                  </div>
                </td>
                <td style={tdStyle}>
                  <span className={`vy-badge vy-badge--${order.statusTone}`}>{order.status}</span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="vy-orders-mobile">
        {orders.map((order) => (
          <div
            key={order.id}
            className="vy-order-card"
            onClick={() => onOpenOrder(order.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
                <input type="checkbox" aria-label={"Select " + order.id} checked={selectedIds.has(order.id)} onChange={() => onToggleSelect(order.id)} onClick={(e) => e.stopPropagation()} style={{ ...ordCheckbox, marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <span className="vy-mono" style={{ fontSize: 11, color: "hsl(var(--muted-fg))", display: "flex", alignItems: "center", gap: 6 }}>
                    {order.id}
                    {order.archived ? <span className="vy-badge vy-badge--muted" style={{ fontSize: 9, padding: "1px 6px" }}>Archived</span> : null}
                  </span>
                  <a href={"Vyonix Order Shell.html?order=" + encodeURIComponent(order.id)} onClick={(e) => e.stopPropagation()} style={{ fontSize: 14, fontWeight: 600, display: "block", marginTop: 2, color: "inherit", textDecoration: "none" }}>
                    {order.title}
                  </a>
                </div>
              </div>
              <span className={`vy-badge vy-badge--${order.statusTone}`}>{order.status}</span>
            </div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginBottom: 10 }}>{order.meta}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", fontSize: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: "hsl(var(--muted-fg))", marginBottom: 2 }}>Supplier</div>
                <div style={{ fontWeight: 500 }}>{order.supplier}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "hsl(var(--muted-fg))", marginBottom: 2 }}>Money</div>
                <div className="vy-mono" style={{ fontWeight: 600, fontSize: 11 }}>{order.moneyTotal}</div>
                <div style={{ fontSize: 10, color: "hsl(var(--muted-fg))" }}>{order.moneyDue}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "hsl(var(--muted-fg))", marginBottom: 2 }}>Placed</div>
                <div style={{ fontWeight: 500 }}>{(order.meta.split("·").map((s) => s.trim()).filter(Boolean).pop()) || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "hsl(var(--muted-fg))", marginBottom: 2 }}>FBA ETA</div>
                <div style={{ fontWeight: 500 }}>{order.fbaEta || ((order.shippingSub || "").match(/FBA ETA\s*([A-Za-z0-9 ]+)/i) || [])[1] || (order.shippingSub || "").split(" · ")[0] || "—"}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const thStyle = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "hsl(var(--muted-fg))",
  background: "hsl(var(--background) / 0.4)",
};

const tdStyle = {
  padding: "14px 14px",
  borderBottom: "1px solid hsl(var(--border) / 0.6)",
  fontSize: 12.5,
  color: "hsl(var(--foreground))",
};

const ordCheckbox = { width: 16, height: 16, accentColor: "hsl(var(--primary))", cursor: "pointer", verticalAlign: "middle" };

// ----------------------------------------------------------------------
// NEW ORDER MODAL — centered, matches the Shipments "New shipment" pattern.
// Plain form; in the reorder path it shows a context strip + a Reorder line.
// ----------------------------------------------------------------------
function OrdNewField({ label, children, half, hint }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: half ? "1 1 calc(50% - 7px)" : "1 1 100%", minWidth: 0 }}>
      <span className="vy-kicker">{label}</span>
      {children}
      {hint ? <span style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))" }}>{hint}</span> : null}
    </label>
  );
}

const ordNewInput = { height: 38, width: "100%", padding: "0 12px", fontSize: 13, border: "1px solid hsl(var(--input))", borderRadius: 8, background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

function OrdersNewOrderModal({ prefill, onClose, onSubmit }) {
  const reorder = !!(prefill && prefill.sku);
  const suppliers = [...new Set(ORDERS_LIST.map((o) => o.supplier))];
  const supplierOpts = reorder && prefill.supplier && !suppliers.includes(prefill.supplier)
    ? [prefill.supplier, ...suppliers] : suppliers;

  const [form, setForm] = useState(() => ({
    name: reorder ? "Reorder — " + (prefill.name || prefill.sku) : "",
    shipDate: "",
    supplier: reorder && prefill.supplier ? prefill.supplier : supplierOpts[0],
    payRoute: "direct",
    agent: "",
    units: reorder ? prefill.qty || "" : "",
    cost: reorder ? prefill.cost || "" : "",
  }));
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const agentResolved = form.agent === "__new" ? (form.agentNew || "").trim() : (form.agent || "").trim();
  const valid = form.name.trim() && form.supplier && (form.payRoute !== "agent" || agentResolved);

  function submit() {
    const units = parseFloat(String(form.units).replace(/[^\d.]/g, "")) || 0;
    const cost = parseFloat(String(form.cost).replace(/[^\d.]/g, "")) || 0;
    const total = units * cost;
    const money = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dateLabel = form.shipDate
      ? new Date(form.shipDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "No ship date";
    const bits = [];
    if (reorder) bits.push("1 SKU");
    if (units) bits.push(units.toLocaleString() + " units");
    bits.push(dateLabel);

    onSubmit({
      id: "ORD-NEW-" + Date.now().toString().slice(-4),
      title: form.name.trim() || "Untitled draft order",
      meta: bits.join(" · "),
      supplier: form.supplier,
      route: form.payRoute === "agent" && agentResolved ? "via " + agentResolved : "Direct supplier",
      payee: form.payRoute === "agent" && agentResolved ? agentResolved : form.supplier,
      payeeKind: form.payRoute === "agent" ? "agent" : "direct",
      production: "Draft", productionSub: "awaiting deposit",
      moneyTotal: total ? money(total) + " total" : "Total TBD",
      moneyDue: total ? money(total * 0.3) + " deposit needed" : "Deposit needed",
      moneyPct: "0% paid", moneySub: "",
      shipping: "TBD", shippingSub: "FBA not linked",
      proof: "0/12 filled", proofSub: reorder ? "Seeded from Inventory · " + prefill.sku : "New draft",
      nextStep: "Send deposit to start production",
      status: "Draft", statusTone: "muted", isDraft: true,
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "hsl(0 0% 0% / 0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }} onClick={onClose}>
      <div className="vy-card" style={{ width: "100%", maxWidth: 540, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>New order</h3>
            <p style={{ fontSize: 12.5, color: "hsl(var(--muted-fg))", margin: "4px 0 0", maxWidth: "44ch" }}>
              {reorder ? "Seeded from Inventory — review the line, then create the draft." : "Start a buying record. Add products, invoices and shipments after."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))" }}>
            <VyIcon name="x" size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 24px", overflowY: "auto" }}>
          {/* Reorder context strip */}
          {reorder ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "hsl(var(--primary) / 0.06)", border: "1px solid hsl(var(--primary) / 0.2)" }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", background: "hsl(var(--primary) / 0.14)", color: "hsl(var(--primary))", flexShrink: 0 }}>
                <VyIcon name="refresh" size={13} />
              </span>
              <div style={{ fontSize: 12, lineHeight: 1.45 }}>
                Reordering <strong className="vy-mono" style={{ fontWeight: 700 }}>{prefill.sku}</strong> · suggested <strong>{prefill.qty} pcs</strong> from your sales velocity &amp; lead time.
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <OrdNewField label="Order name">
              <input className="vy-input" style={ordNewInput} value={form.name} onChange={set("name")} placeholder="e.g. Q2 restock — Floor mats" />
            </OrdNewField>
            <OrdNewField label="Supplier" half>
              <select className="vy-input" style={ordNewInput} value={form.supplier} onChange={set("supplier")}>
                {supplierOpts.map((s) => <option key={s}>{s}</option>)}
              </select>
            </OrdNewField>
            <OrdNewField label="Target ship date" half>
              <input type="date" className="vy-input" style={ordNewInput} value={form.shipDate} onChange={set("shipDate")} />
            </OrdNewField>

            <OrdNewField label="Payment route">
              <div style={{ display: "flex", gap: 8 }}>
                {[["direct", "Direct to supplier", "supplier accepts USD"], ["agent", "Via agent", "supplier wants RMB"]].map(([val, label, sub]) => {
                  const active = form.payRoute === val;
                  return (
                    <button key={val} type="button" onClick={() => setForm((p) => ({ ...p, payRoute: val }))} style={{
                      flex: 1, textAlign: "left", padding: "10px 12px", borderRadius: 9, cursor: "pointer",
                      border: "1px solid " + (active ? "hsl(var(--primary))" : "hsl(var(--border))"),
                      background: active ? "hsl(var(--primary) / 0.08)" : "transparent",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))" }}>
                        <span style={{ width: 13, height: 13, borderRadius: 999, flexShrink: 0, border: "2px solid " + (active ? "hsl(var(--primary))" : "hsl(var(--border))"), background: active ? "hsl(var(--primary))" : "transparent" }}></span>
                        {label}
                      </div>
                      <div style={{ fontSize: 10.5, color: "hsl(var(--muted-fg))", marginTop: 3, marginLeft: 20 }}>{sub}</div>
                    </button>
                  );
                })}
              </div>
            </OrdNewField>
            {form.payRoute === "agent" ? (
              <>
                <OrdNewField label="Agent / trading company" hint="You pay the agent in USD; they pay the factory in RMB.">
                  <select className="vy-input" style={ordNewInput} value={form.agent} onChange={set("agent")}>
                    <option value="">Select an agent…</option>
                    {[...new Set(ORDERS_LIST.map((o) => { const m = (o.route || "").match(/via\s+(.+)/i); return m ? m[1].trim() : null; }).filter(Boolean))].map((a) => <option key={a} value={a}>{a}</option>)}
                    <option value="__new">+ Add new agent…</option>
                  </select>
                </OrdNewField>
                {form.agent === "__new" ? (
                  <OrdNewField label="New agent name">
                    <input className="vy-input" style={ordNewInput} value={form.agentNew || ""} onChange={set("agentNew")} placeholder="e.g. Mutual Trade Union" autoFocus />
                  </OrdNewField>
                ) : null}
              </>
            ) : null}

            {reorder ? (
              <>
                <OrdNewField label="SKU" half>
                  <input className="vy-input" style={{ ...ordNewInput, fontFamily: "var(--font-mono, monospace)" }} value={prefill.sku} readOnly />
                </OrdNewField>
                <OrdNewField label="Units" half>
                  <input type="number" className="vy-input" style={ordNewInput} value={form.units} onChange={set("units")} placeholder="pcs" />
                </OrdNewField>
                <OrdNewField label="Unit cost (USD)" half>
                  <input type="number" className="vy-input" style={ordNewInput} value={form.cost} onChange={set("cost")} placeholder="$" />
                </OrdNewField>
              </>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vy-btn vy-btn--primary" disabled={!valid} style={valid ? undefined : { opacity: 0.5, cursor: "not-allowed" }} onClick={submit}>
            <VyIcon name="plus" size={14} /><span>Create draft order</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
function OrdersListPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(() => {
    try { return new URLSearchParams(location.search).get("new") === "1"; } catch (e) { return false; }
  });
  const [dialogKey, setDialogKey] = useState(null);
  const [activeChips, setActiveChips] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [reorderPrefill, setReorderPrefill] = useState(null);
  const [orders, setOrders] = useState(() => ordAllOrders());
  const [toast, setToast] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [peekId, setPeekId] = useState(null); // order being quick-peeked
  const [editOrder, setEditOrder] = useState(null); // order being edited in-place

  // If we arrived from an Inventory "Reorder" click, open the create-order
  // sheet pre-seeded with that SKU + suggested quantity.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("reorder") === "1" && p.get("sku")) {
      setReorderPrefill({
        sku: p.get("sku"),
        name: p.get("name") || "",
        supplier: p.get("supplier") || "",
        qty: p.get("qty") || "",
        cost: p.get("cost") || "",
      });
      setNewOrderOpen(true);
      // Drop the params so a refresh doesn't re-open the modal.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  function toggleChip(chip) {
    setActiveChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  }

  function openOrder(orderId) {
    window.location.href = `Vyonix Order Shell.html?order=${orderId}`;
  }

  // ---- selection + archive ----
  const visibleOrders = (statusFilter === "All statuses" ? orders : orders.filter((o) => (o.status || "") === statusFilter))
    .filter((o) => (showArchived ? true : !o.archived));
  const archivedCount = orders.filter((o) => o.archived).length;
  function toggleSelect(id) {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelectedIds((prev) => {
      const allSel = visibleOrders.length > 0 && visibleOrders.every((o) => prev.has(o.id));
      return allSel ? new Set() : new Set(visibleOrders.map((o) => o.id));
    });
  }
  const selectedList = [...selectedIds];
  const selectedAllArchived = selectedList.length > 0 && selectedList.every((id) => { const o = orders.find((x) => x.id === id); return o && o.archived; });
  function bulkArchive(archived) {
    if (typeof ordSetArchived === "function") ordSetArchived(selectedList, archived);
    setOrders(ordAllOrders());
    setSelectedIds(new Set());
    setToast({ id: "bulk", title: selectedList.length + " order" + (selectedList.length === 1 ? "" : "s") + (archived ? " archived" : " restored") });
  }

  function handleCreateOrder(draft) {
    ordAddDraft(draft);
    setOrders(ordAllOrders());
    setNewOrderOpen(false);
    setReorderPrefill(null);
    setToast({ id: draft.id, title: draft.title });
  }

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="vy-app">
      <VySidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNavigate={() => setMobileNavOpen(false)}
      />

      <div className="vy-app-main">
        <VyHeader
          onToggleMobileNav={() => setMobileNavOpen(true)}
          onOpenSearch={() => alert("Search modal")}
          onToggleTheme={() => setIsDark(!isDark)}
          isDark={isDark}
          onToggleActivity={() => alert("Activity feed (not on Orders list)")}
        />

        <main className="vy-content">
          <div className="vy-content-inner">
            {/* Page header */}
            <div className="vy-card vy-page-head-card">
              <div className="vy-page-head-main">
                <div className="vy-kicker">Operations command center</div>
                <h1 className="vy-page-title" style={{ fontSize: 24, margin: "6px 0 0", fontWeight: 600 }}>
                  Orders
                </h1>
                <p className="vy-page-sub" style={{ margin: "4px 0 0" }}>
                  Track production, invoices, payments, shipping, inspection, FBA inbound, and landed cost in one buying record.
                </p>
              </div>
              <div className="vy-page-head-actions" style={{ marginLeft: "auto" }}>
                <button type="button" className={"vy-btn " + (showArchived ? "vy-btn--outline" : "vy-btn--ghost")} onClick={() => setShowArchived((v) => !v)} title={archivedCount + " archived order" + (archivedCount === 1 ? "" : "s")}>
                  <VyIcon name={showArchived ? "eye" : "archive"} size={14} />
                  <span>{showArchived ? "Hide archived" : "Show archived"}{archivedCount ? " (" + archivedCount + ")" : ""}</span>
                </button>
                <button type="button" className="vy-btn vy-btn--ghost" onClick={() => setDialogKey("export")}>
                  <VyIcon name="arrowUpRight" size={14} />
                  <span>Export</span>
                </button>
                <button type="button" className="vy-btn vy-btn--primary" onClick={() => setNewOrderOpen(true)}>
                  <VyIcon name="plus" size={14} />
                  <span>New order</span>
                </button>
              </div>
            </div>

            {/* KPI strip */}
            <OrdersKpiRow />

            {/* Filter bar */}
            <OrdersFilterBar activeChips={activeChips} onToggleChip={toggleChip} statusFilter={statusFilter} onStatusChange={setStatusFilter} />

            {/* Bulk action bar — appears when rows are selected */}
            {selectedIds.size > 0 ? (
              <div className="vy-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", flexWrap: "wrap", borderColor: "hsl(var(--primary) / 0.4)", background: "hsl(var(--primary) / 0.05)" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.size} selected</span>
                <div style={{ flex: 1 }} />
                {selectedAllArchived
                  ? <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" onClick={() => bulkArchive(false)}><VyIcon name="eye" size={13} /><span>Restore</span></button>
                  : <button type="button" className="vy-btn vy-btn--outline vy-btn--sm" onClick={() => bulkArchive(true)}><VyIcon name="archive" size={13} /><span>Archive</span></button>}
                <button type="button" className="vy-btn vy-btn--ghost vy-btn--sm" onClick={() => setSelectedIds(new Set())}><VyIcon name="x" size={13} /><span>Clear</span></button>
              </div>
            ) : null}

            {/* Orders table */}
            <OrdersTable
              orders={visibleOrders}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
              onOpenOrder={(id) => setPeekId(id)}
              emptyFiltered={statusFilter !== "All statuses"}
              onClearFilter={() => setStatusFilter("All statuses")}
              onNewOrder={() => setNewOrderOpen(true)}
            />
          </div>
        </main>
      </div>

      <VyMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {newOrderOpen ? (
        <OrdersNewOrderModal prefill={reorderPrefill} onClose={() => { setNewOrderOpen(false); setReorderPrefill(null); }} onSubmit={handleCreateOrder} />
      ) : null}

      {peekId ? (
        <OrdPeekDrawer order={orders.find((o) => o.id === peekId)} onClose={() => setPeekId(null)} onOpen={() => openOrder(peekId)} onEdit={(o) => {
          // map the list row to the shape VyEditOrderDrawer reads, then open it in place
          const meta = o.meta || "";
          const parts = meta.split("·").map((s) => s.trim()).filter(Boolean);
          const placed = parts.length ? parts[parts.length - 1] : "";
          const etaM = (o.shippingSub || "").match(/FBA ETA\s*([A-Za-z0-9 ]+)/i);
          const agent = /via\s+/i.test(o.route || "") ? o.route.replace(/^via\s+/i, "").trim() : "Direct";
          window.VY_CURRENT_ORDER = { id: o.id, title: o.title, factory: o.supplier, agent, placedOn: placed, fbaEta: etaM ? etaM[1].trim() : "" };
          setPeekId(null);
          setEditOrder(o.id);
        }} />
      ) : null}

      {editOrder && typeof VyEditOrderDrawer === "function" ? (
        <VyEditOrderDrawer open={true} onClose={() => setEditOrder(null)} />
      ) : null}

      {dialogKey && (
        <React.Fragment>
          <VyScrim open={!!dialogKey} onClose={() => setDialogKey(null)} />
          <div className={"vy-dialog-wrap" + (dialogKey ? " is-open" : "")} aria-hidden={!dialogKey}>
            <div className="vy-dialog" role="dialog">
              <div className="vy-dialog-head">
                <span className="vy-dialog-icon vy-dialog-icon--warning">
                  <VyIcon name="info" size={18} />
                </span>
                <div>
                  <div className="vy-dialog-title">
                    Export orders
                  </div>
                  <div className="vy-dialog-helper">
                    Export the current filtered view as CSV or Excel.
                  </div>
                </div>
              </div>
              <div className="vy-dialog-foot">
                <button type="button" className="vy-btn vy-btn--ghost" onClick={() => setDialogKey(null)}>
                  Cancel
                </button>
                <button type="button" className="vy-btn vy-btn--primary" onClick={() => setDialogKey(null)}>
                  Export
                </button>
              </div>
            </div>
          </div>
        </React.Fragment>
      )}



      {toast && (
        <div
          role="status"
          style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 12, zIndex: 200,
            padding: "12px 16px", borderRadius: 12, maxWidth: 460,
            background: "hsl(var(--foreground))", color: "hsl(var(--background))",
            boxShadow: "0 12px 32px -8px hsl(0 0% 0% / 0.35)",
          }}
        >
          <span style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", background: "hsl(var(--primary))", color: "#fff", flexShrink: 0 }}>
            <VyIcon name="check" size={14} />
          </span>
          <div style={{ fontSize: 13, lineHeight: 1.35 }}>
            <strong style={{ fontWeight: 600 }}>Draft order created.</strong>
            <span style={{ opacity: 0.8 }}>&nbsp;{toast.id} · {toast.title}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{ marginLeft: 4, background: "transparent", border: "none", color: "inherit", opacity: 0.7, cursor: "pointer", display: "grid", placeItems: "center" }}
            aria-label="Dismiss"
          >
            <VyIcon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// ORDER PEEK DRAWER — read-only quick look from the list (the order itself is a
// workspace; editing happens inside the Order Shell). "Open order" navigates.
// ----------------------------------------------------------------------
function OrdPeekRow({ label, value, sub }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div className="vy-kicker" style={{ marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value || "—"}</div>
      {sub ? <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))" }}>{sub}</div> : null}
    </div>
  );
}

function OrdPeekDrawer({ order: o, onClose, onOpen, onEdit }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  if (!o) return null;

  const oid = encodeURIComponent(o.id);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.4)", opacity: shown ? 1 : 0, transition: "opacity 200ms ease" }} />
      <aside style={{
        position: "absolute", top: 0, right: 0, height: "100%", width: "min(440px, 92vw)",
        background: "hsl(var(--card))", borderLeft: "1px solid hsl(var(--border))",
        boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
        transform: shown ? "translateX(0)" : "translateX(100%)", transition: "transform 240ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="vy-mono" style={{ fontSize: 12, color: "hsl(var(--muted-fg))" }}>{o.id}</span>
                {o.isDraft ? <span className="vy-badge vy-badge--brand" style={{ fontSize: 9, padding: "1px 6px" }}>New</span> : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{o.title}</div>
                <button type="button" aria-label="Edit order" title="Edit order" onClick={() => onEdit && onEdit(o)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: "hsl(var(--muted-fg))", flexShrink: 0, display: "inline-flex" }}>
                  <VyIcon name="pencil" size={13} />
                </button>
              </div>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-fg))", marginTop: 2 }}>{o.meta}</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "hsl(var(--muted-fg))", flexShrink: 0 }}>
              <VyIcon name="x" size={18} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            <span className={"vy-badge vy-badge--" + o.statusTone}>{o.status}</span>
            <span className="vy-badge vy-badge--muted">{o.supplier}</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Next action */}
          {o.nextStep ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 10, background: "hsl(var(--primary) / 0.07)", border: "1px solid hsl(var(--primary) / 0.2)" }}>
              <VyIcon name="arrowRight" size={14} style={{ color: "hsl(var(--primary))", flexShrink: 0, marginTop: 2 }} />
              <div>
                <div className="vy-kicker" style={{ marginBottom: 2 }}>Next step</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{o.nextStep}</div>
              </div>
            </div>
          ) : null}

          {/* Money */}
          <div style={{ display: "flex", gap: 16, padding: "12px 14px", borderRadius: 10, background: "hsl(var(--background) / 0.5)", border: "1px solid hsl(var(--border))" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vy-kicker" style={{ marginBottom: 3 }}>Order total</div>
              <div className="vy-mono" style={{ fontSize: 15, fontWeight: 700 }}>{o.moneyTotal}</div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-fg))", marginTop: 1 }}>{o.moneyPct}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vy-kicker" style={{ marginBottom: 3 }}>Balance</div>
              <div className="vy-mono" style={{ fontSize: 15, fontWeight: 700, color: /paid in full|fully paid|0%/i.test(o.moneyDue) ? "hsl(var(--success))" : "hsl(var(--warning))" }}>{o.moneyDue}</div>
            </div>
          </div>

          {/* Detail rows */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px 16px" }}>
            <OrdPeekRow label="Supplier / route" value={o.supplier} sub={o.route} />
            <OrdPeekRow label="Production" value={o.production} sub={o.productionSub} />
            <OrdPeekRow label="Shipping / FBA" value={o.shipping} sub={o.shippingSub} />
            <OrdPeekRow label="Proof / files" value={o.proof} sub={o.proofSub} />
          </div>

          {/* Jump-to-section links */}
          <div>
            <div className="vy-kicker" style={{ marginBottom: 8 }}>Jump to</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { label: "Shipping", page: "shipping", icon: "truck" },
                { label: "Invoices", page: "invoices", icon: "receipt" },
                { label: "Production", page: "production", icon: "hammer" },
                { label: "Landed cost", page: "closeout", icon: "closeout" },
              ].map((s) => (
                <a key={s.page} href={"Vyonix Order Shell.html?order=" + oid + "#" + s.page}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 8, border: "1px solid hsl(var(--border))", textDecoration: "none", color: "inherit", fontSize: 12, fontWeight: 600 }}>
                  <VyIcon name={s.icon} size={12} style={{ opacity: 0.7 }} />{s.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, padding: "14px 20px", borderTop: "1px solid hsl(var(--border))" }}>
          <button type="button" className="vy-btn vy-btn--primary" onClick={onOpen} style={{ flex: 1, justifyContent: "center" }}>
            <span>Open order</span><VyIcon name="arrowRight" size={14} />
          </button>
          <button type="button" className="vy-btn vy-btn--outline" onClick={onClose}>Close</button>
        </div>
      </aside>
    </div>
  );
}

// ----------------------------------------------------------------------
// MOUNT
// ----------------------------------------------------------------------
const root = ReactDOM.createRoot(document.getElementById("vy-root"));
root.render(<OrdersListPage />);
