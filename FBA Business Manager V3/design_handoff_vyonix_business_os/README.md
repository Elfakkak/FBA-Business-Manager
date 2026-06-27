# Handoff: Vyonix Business OS — FBA Business Manager

## Overview
Vyonix is an operations console for a private-label Amazon FBA business. It manages the full lifecycle of an overseas purchase order — **Production → Inspection → Shipping → Invoices → Landed cost** — plus the surrounding catalog, inventory, suppliers, partners, and finances. The central job it does that a spreadsheet can't: tie *what you ordered* (Production), *what you were billed* (Invoices), and *what it actually cost to land per unit* (Landed cost) into one consistent, reconciled picture.

## About the design files
The files in this bundle are a **working design prototype built in HTML + React (via in-browser Babel)** — they show the intended look, data model, and behavior with realistic mock data. **They are design references, not production code.** The task is to **recreate these designs in the target codebase's environment** (a real React/Next build with a bundler, a Vue app, native, etc.) using its established patterns, component library, routing, and data layer. If no environment exists yet, pick the most appropriate modern framework (React + TypeScript + a real bundler is the natural fit, since the prototype is already React) and implement there.

Do **not** ship the prototype as-is: it has no build step, no types, no backend, and persists to `localStorage` instead of a database. Treat it as an exhaustive, interactive spec.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, layout, copy, and interactions are all intentional and should be reproduced faithfully. The design tokens are listed below and defined in `vy-app.css`. Rebuild the UI pixel-faithfully using the target codebase's component primitives; match the tokens exactly.

## Tech in the prototype (and how to read it)
- **React 18 + in-browser Babel, no build step.** Each screen is an HTML entry point that loads shared scripts in a fixed order. Every `.jsx` file ends with `Object.assign(window, {...})` to expose its components/helpers globally (there are no ES modules) — **script load order matters**.
- **Styling**: one global stylesheet, `vy-app.css`, using HSL CSS custom properties (light + `.dark`). Components also use inline `style={{…}}` objects heavily.
- **Icons**: `vy-icons.jsx` exposes `<VyIcon name=… size=… />`. Check it for valid names.
- **App chrome**: `vy-shell.jsx` exposes `VySidebar`, `VyHeader`, `VyMobileNav` (grouped left nav + top bar). Shared across every page.
- **Persistence**: browser `localStorage` only (keys listed below). In production these become API/database calls.

> **The authoritative architecture document is the project-root `README.md`** (a living doc, also included at `./PROJECT_ARCHITECTURE.md` in this bundle). It contains the full file-by-file map, the cross-section data-flow bridges, the current state of every screen, and a dated change log. Read it first — this handoff summarizes; that file is the source of truth.

## Entry points / screens
Each is a top-level `Vyonix *.html` file that mounts one root React component:
- **Dashboard** (`Vyonix Dashboard.html`) — command overview.
- **Orders list** (`Vyonix Orders List.html`) + **Order Shell** (`Vyonix Order Shell.html?order=<id>`) — the Order Shell is the heart: a tabbed per-order workspace (Home · Production · Inspection · Shipping · Invoices · Landed cost) where each tab is a chrome-less "body" component embedded by `vy-app.jsx`.
- **Catalog** group: Products (`Vyonix Catalog.html`) + Product (`Vyonix Product.html?family=`), Inventory, Performance, Packaging, **Charge types** (`Vyonix Charge Types.html`), FBA calculator.
- **Invoices** portfolio (`Vyonix Invoices.html`) + **Invoice** detail (`Vyonix Invoice.html?invoice=<id>`).
- **Shipments**, **FBA Shipments** (+ detail pages), **Suppliers**, **Partners**, **Finances**, **Settings**.

## The data model — source-of-truth principles (most important section)
The recent work hardened a single, consistent model. **Preserve these rules when you rebuild — they prevent double-counting of money and inventory.**

### 1. One canonical source per concept
- **Products** → the Catalog (`catalog-data.jsx`, `CAT_FAMILIES` / `catLoadFamilies()`). Every SKU exists once.
- **Service charges** → the Charge-types catalog (`payables-data.jsx`, `PAY_CHARGE_TYPES` + the managed store; page `charge-types-app.jsx`). A controlled vocabulary (freight, agent fee, packaging, inspection, duty, …) every invoice picks from, so spend rolls up by type (`chgSpendByType`).
- **Invoices (bills, payments, proof, terms, charges)** → `payables-data.jsx` is the **single source**. `PAY_INVOICES` is the seed; a working-set store (`vy_invoices_v1`) holds edits. Both the standalone Invoice page and the Order-Shell Invoices section read/write the same records.
- **Packaging/consumables** → Packaging inventory (separate stock, bought in bulk MOQs, drawn down per order).

### 2. Units vs money — they deduct in exactly one place each
- **Quantity is owned by Production** (ordered qty per SKU). The invoice records only the **billed money** per SKU; it shows qty as read-only context, never as an editable inventory entry.
- **Inventory units enter stock only at the physical FBA receipt** (`inventory-data.jsx`, `onHand` ← Amazon SP-API) — never from Production and never from an invoice.
- **Packaging units deduct only via the Production "use from inventory" draw-down**, never from a product-supplier invoice.
- Net effect: Production = the plan; the invoice = a parallel *money* track keyed by SKU (for billed-vs-ordered reconciliation + landed cost); receipt = the *units* event. No path double-counts.

### 3. One canonical render path for invoices
Every invoice surface renders the same helpers from `payables-data.jsx`, so an edit shows everywhere:
- **Lines/charges** → `payInvoiceLines(inv)` (leads with fresh per-SKU goods via `paySupplierGoods` + billed-vs-ordered reconciliation, then services carrying their `chargeType`). Used by the standalone page, both invoice drawers, Landed cost, and charge-type spend.
- **Payments** → `payInvoicePayments` / `payClearedPaid` / `payEffectivePaid` (store-backed; logged via `payLogPayment`).
- **Balance/status/aging** → `payBalance` / `payStatus` / `payAging`, all derived from `payEffectivePaid`.

### 4. Landed cost (`closeout-app.jsx`)
Final landed cost per SKU = **billed goods** (per-SKU, from the supplier invoice) **+ allocated cost buckets ÷ received units**. Buckets are **classified by charge type** (freight/docs→Freight, agent_fee→Agent fees, packaging→Packaging, duty/brokerage→Duties, inspection→Inspection), allocated across SKUs by units or value. Duties are entered manually.

### Currency note
Supplier quotes may be in RMB but the payable + payments are recorded in **USD** (the supplier provides a USD total; the buyer pays USD). The app stores USD only; the Edit-charges modal's "Itemized vs invoice total · matches" check confirms per-product USD figures sum to the supplier's USD total. (`fx-data.jsx` exists for RMB→USD reference conversion in landed cost, but invoices are USD-native.)

## Interactions & behavior
- **Order Shell tabs** navigate in-app (SPA state in `vy-app.jsx`, `activePage`), with `#<tab>` hash support (e.g. `…#closeout`). No full reloads.
- **Drawers** (invoice, supplier, order, FBA, catalog peek) slide in from the right, portaled to `document.body`, with a scrim. List rows open a quick-view drawer; the row's title link opens the full page.
- **Modals** (Edit charges, Log/Record payment, Adjust cost buckets, New/Edit invoice, Add SKUs, Add non-product cost): fixed overlay, `Esc` to close, click-scrim to dismiss.
- **Edit charges modal** (`InvChargesModal` in `invoice-app.jsx`): goods table is `Product · Qty · Billed`; goods picked from Production scope or the Catalog; services pick a charge type from a `<select>` (label derives from type; "Other" reveals a custom label). Bottom bar reconciles itemized total vs invoice total.
- **Status engine**: section milestones auto-advance the order's lifecycle (`ordAdvanceToAtLeast`, forward-only, rising-edge), persisted to `vy_order_status_v1`, broadcast via a `vy-order-status-changed` event.
- **Theme**: light/dark toggled by `.dark` on `<html>`.

## State management & persistence (localStorage keys)
Replace each with a real API/store in production:
- `vy_invoices_v1` — invoice working set (payments, proof, terms, charges, per-SKU goods).
- `vy_charge_types_v1` — managed charge-type catalog.
- `vy_payables_applied_v1` — applied-payment overrides (Finance review inbox).
- `vy_order_status_v1` — per-order lifecycle status.
- `vy_orders_drafts_v1` — draft/created orders.
- `vy_catalog_*`, `vy_closeout_saleprices_v1`, `vy_closeout_feemodel_v1`, `vy_business_profile_v1`, `vy_team_v1`, `vy_notifications_v1`, plus image-slot drop sidecars.

## Design tokens (light mode; full set + dark in `vy-app.css`)
Colors are HSL triplets used as `hsl(var(--token))`.
- **Brand / primary**: `--primary: 24.6 95% 53.1%` (Vyonix orange), `--primary-fg: 0 0% 98%`
- **Surfaces**: `--background: 42 25% 96%`, `--card: 40 33% 99%`, `--surface-warm: 40 43% 97%`, `--muted-bg: 39 22% 92%`
- **Text**: `--foreground: 28 12% 10%`, `--muted-fg: 34 8% 41%`
- **Lines/inputs**: `--border: 38 18% 84%`, `--input: 38 18% 84%`, `--ring: 24.6 95% 53.1%`
- **Status**: `--success: 142 71% 32%`, `--warning: 32 95% 36%`, `--danger: 0 74% 42%`, `--info: 199 89% 38%`
- **Radius**: `--radius: 10px` (cards 12–14px, inputs 7–8px, pills/badges 999px)
- **Shadows**: `--shadow-sm/md/lg` (see file) — soft, warm-tinted
- **Type**: **Inter** (UI, weights 400–800) + **JetBrains Mono** (all numerics/SKUs/IDs). Load both from Google Fonts. KPI values, money, SKUs, and codes are mono.
- **Density**: slide/print scales aside, body UI text 11–13.5px; section titles 15–17px; page titles 24px; kickers are 10–10.5px uppercase, letter-spacing ~0.05em, muted.

## Assets
- Icons are inline SVG via `vy-icons.jsx` (no external icon font). Reproduce or map to the target codebase's icon set by name.
- User-supplied images (logos, product shots, invoice PDFs) use the `<image-slot>` web component (`image-slot.js`) — a drag-drop placeholder persisting to a localStorage sidecar. In production these become real uploads.
- No proprietary/brand third-party assets are bundled.

## Files
This bundle includes the full prototype (all `Vyonix *.html` entry points + all `*.jsx` logic/data files + `vy-app.css`). Start here:
- `./PROJECT_ARCHITECTURE.md` — the complete living architecture doc (file map, data-flow bridges, change log). **Read first.**
- `payables-data.jsx` — invoice/charge single source of truth.
- `vy-shell.jsx`, `vy-app.jsx`, `vy-order.jsx`, `order-scope.jsx` — chrome + Order-Shell spine.
- `invoice-app.jsx`, `invoices-app.jsx`, `invoices-list-app.jsx` — the three invoice surfaces.
- `closeout-app.jsx` — landed cost. `charge-types-app.jsx` — services catalog. `catalog-data.jsx` / `inventory-data.jsx` — products/stock.
- `vy-app.css` — all design tokens + component styles.

## What is intentionally NOT production-ready
- No build/bundler/types; globals via `window` instead of imports.
- `localStorage` instead of a backend; mock seed data.
- In-memory cross-section bridges (e.g. Invoices→Landed cost) work within a session but don't survive a hard reload onto a downstream tab — wire these to the real store/API on rebuild.
- Amazon SP-API / Mercury / Wise / QuickBooks integrations are mocked (`integrations-data.jsx`, `mercury-data.jsx`, `fx-data.jsx`).
