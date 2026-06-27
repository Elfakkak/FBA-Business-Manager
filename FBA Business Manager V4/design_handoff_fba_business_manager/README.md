# Handoff: FBA Business Manager (brand: Manifest)

## Overview
An operations platform for a two-person Amazon FBA / import business (owner **Simo** + partner **Youness**). It covers the full lifecycle of a purchase order — **Production → Inspection → Shipping → Invoices → Landed cost** — plus Catalog/Products, Inventory, Packaging inventory, Suppliers & Trading partners, a Finance suite (company net, partner capital accounts, P&L, tax), Product performance & reorder planning, a derived notifications/alerts system, and external integrations.

## About the design files
The files in this bundle are **design references created in HTML/React (in-browser Babel, no build step)** — high-fidelity prototypes showing intended look, data relationships, and behavior. They are **not production code to ship directly.** The task is to **recreate them in a real codebase** (recommended: React + TypeScript + a real backend/DB + auth) using that environment's established patterns. All data currently lives in `localStorage`; persistence, auth, and the external API integrations are the real build.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, layouts, and interactions are intended as-is. Recreate the UI faithfully, but swap localStorage for a real database and the simulated integrations for live APIs.

---

## Architecture (current prototype)
- **Entry points:** one HTML file per screen (`Vyonix Dashboard.html`, `Vyonix Orders List.html`, `Vyonix Order Shell.html`, `Vyonix Finances.html`, `Vyonix Catalog.html`, `Vyonix Product.html`, `Vyonix Inventory.html`, `Vyonix Packaging.html`, `Vyonix Performance.html`, `Vyonix Suppliers.html`/`Supplier.html`, `Vyonix Partners.html`/`Partner.html`, `Vyonix Shipments.html`/`Shipment.html`, `Vyonix FBA Shipments.html`, `Vyonix Settings.html`, `Vyonix Integration.html`, `Vyonix FBA Calculator.html`).
- **Pattern:** each `*-data.jsx` is a data/logic module attaching helpers to `window`; each `*-app.jsx` is the page UI. Shared shell in `vy-shell.jsx`, icons in `vy-icons.jsx`, all CSS in `vy-app.css` (HSL custom-property tokens).
- **Brand-driven naming:** app name comes from `brand-data.jsx` (`brandName()`), so it changes with the brand. Current brand: **Manifest**; subtitle "FBA Business Manager".

## Data model (entities → make these DB tables)
- **Order** (`orders-data.jsx`): id, title, supplier, agent/route, units, skuCount, total, placedOn, fbaEta, status (pipeline: production→inspection→shipping→invoices→closed), per-order edits (`vy_order_edits_v1`), inspection-required flag (`vy_order_inspection_v1`), payment terms (`vy_payment_terms_v1`).
- **Order scope** (`order-scope.jsx`): derives one order's SKUs/units/supplier/costs from `?order=` — Production/Shipping/Inspection/Landed-cost read this.
- **Product family + variants** (`catalog-data.jsx`): family (parent, category, supplier, brand, material, dims/weight, leadTime, moq) → variants (SKU, ASIN, cost, stock). Extras (`product-extras.jsx`): dual-unit dims (metric master + imperial), size/weight history, master-carton + pieces-per-box, Amazon size compliance, versioned tech-pack PDFs.
- **Inventory** (`inventory-data.jsx`): per-SKU rows built from catalog + live-stock fields.
- **Packaging** (`packaging-data.jsx`): items (kind, assigned familyId, unitCost, reorderPoint) + movements (receive/consume) → on-hand; `vy_packaging_v1`.
- **Supplier** (`suppliers-data.jsx`) / **Partner** (`partners-data.jsx`): companies; **Contacts** (`contacts-data.jsx`, `vy_contacts_v1`) = people per company (role, WeChat/phone/email, primary).
- **Shipment** (`logistics-data.jsx`) + **tracking** (`tracking-data.jsx`): freight legs, ETA, incoterm, customs, FBA inbounds; 17TRACK-shaped milestones.
- **Invoice / Payables** (`payables-data.jsx`, `data.jsx`): vendor bills per order; paid/balance drives COGS.
- **Finance** (`finances-data.jsx`): every dollar is an entry (revenue/expense/draw/contribution × partner × account); derives company net, per-partner capital accounts, settle-up, tax reserve. P&L in `finances-pnl.jsx`; recurring overhead in `recurring-data.jsx` (reconciles to bank by memo match).
- **Amazon source** (`amazon-source.jsx`): THE contract for Amazon data — monthly {units, grossSales, referralFees, fbaFees, adSpend, refunds, netPayout} + per-product perf + reorder plan. Seeded; swap fetch fns for SP-API.
- **FX** (`fx-data.jsx`): USD-base rates; converts RMB/EUR supplier costs to USD.
- **Notifications** (`notifications-data.jsx`): derives reorder/production/shipping alerts from the above.

## Derived (compute on backend, do NOT store)
Company net = Σrevenue − Σexpense (draws are NOT expenses). COGS = paid supplier invoices. Landed cost, per-partner entitled/drawn/balance + settle-up, tax reserve, reorder qty (velocity × (lead+cover) − on-hand−inbound, MOQ-rounded), TACoS, P&L per month, net-by-month, days-of-cover.

## Integration contracts (all currently SIMULATED → real API wiring is the main build)
- **Amazon Seller Central (SP-API):** Sales & Traffic report → units/gross; Finances API → fees/refunds/settlements; FBA Inventory API; Orders API. Maps into `amazon-source.jsx` shape.
- **Amazon Ads API:** ad spend, ACoS/TACoS, campaigns → P&L + Performance.
- **Mercury:** balances, transactions (the cash source of truth), FX.
- **QuickBooks Online:** bills/COGS, partner draws (journal entries).
- **17TRACK:** container/vessel tracking milestones (one connection, code per shipment).
- **Wise:** live USD↔RMB FX.

## Build in phases (recommended roadmap)
Build in dependency order; each phase is shippable before the next.
- **Phase 0 — Foundation:** Next.js + Supabase + Vercel + GitHub; Auth (Simo full / Youness view-only + per-section permissions via RLS); full DB schema; shadcn themed with `vy-app.css` tokens.
- **Phase 1 — Catalog + Inventory + Packaging:** the record spine everything references. CRUD, no integrations.
- **Phase 2 — Orders lifecycle:** Orders list + Order Shell (Production→Inspection→Shipping→Invoices→Landed cost), Suppliers/Partners + Contacts. Manual data only.
- **Phase 3 — Finance:** entries, partner capital accounts, P&L, recurring overhead, payment terms (COGS from invoices).
- **Phase 4 — Integrations (last, one at a time):** Mercury → Amazon SP-API → Amazon Ads → 17TRACK → QuickBooks → Wise FX. OAuth + fetch + map into the defined contracts.
- **Phase 5 — Derived + polish:** Dashboard, notifications/alerts, Performance & reorder, headline bar — these consume everything above and light up once real data flows.

## Component library
Use **shadcn/ui** for the component primitives (tables, drawers/sheets, dialogs, dropdowns, tabs, toasts, forms, date pickers) — but **theme it with the `vy-app.css` tokens, not the stock slate defaults.** shadcn is Tailwind + HSL CSS variables, which map ~1:1 onto the existing token system (incl. `--c-revenue/--c-net/--c-expense`). Keep the app's distinct identity (warm cream canvas, orange primary, mono tabular numerals); shadcn is the accessible skeleton underneath, not the visual look.

## Recommended stack (user's chosen infra)
Build with **Next.js + TypeScript + Tailwind**, deployed on **Vercel**, source on **GitHub**, backend on **Supabase**:
- **Supabase Postgres** — the database. The `*-data.jsx` modules are the de-facto schema; model them as tables (Order, OrderEdit, ProductFamily, Variant, InventoryRow, PackagingItem, PackagingMovement, Supplier, Partner, Contact, Shipment, FbaInbound, Invoice, FinanceEntry, RecurringItem, PaymentTerm, Brand, Integration). Derived values (net, COGS, landed cost, reorder qty, TACoS, P&L) are computed in queries/server code, NOT stored.
- **Supabase Auth + Row-Level Security** — handles decision #1 directly: Simo = owner (full); Youness = partner (full read, RLS-restricted finance writes). No third-party auth needed.
- **Supabase Storage** — tech-pack PDFs (`product-extras.jsx` versioned uploads), product/brand images (currently `<image-slot>` localStorage).
- **Vercel** — hosts the Next.js app; serverless functions / Supabase Edge Functions run the integration calls and OAuth callbacks. Auto-deploy from GitHub.
- **Integrations** (TypeScript, server-side; tokens in Supabase): Amazon SP-API, Amazon Ads API, Mercury, QuickBooks Online, 17TRACK, Wise FX. Map each into the contract shapes already defined (see `amazon-source.jsx`).
- **Port path:** the existing React/JSX components move over with minimal rewrite; replace `window`-attached `*-data.jsx` helpers with typed data-access modules hitting Supabase. Tailwind config mirrors the HSL tokens in `vy-app.css` (incl. the `--c-revenue/--c-net/--c-expense` data-viz tokens).

## Decisions (CONFIRMED by owner)
1. **Auth & multi-user:** **Simo = full access.** **Youness = view-only**, with **per-section visibility controlled by Simo** — i.e. Simo toggles which parts (Dashboard, Orders, Catalog, Finance, etc.) Youness can see. Implement as a role + a per-user section-permission map, enforced with Supabase RLS. No partner write access; finance is hidden unless Simo grants view.
2. **Accounting basis:** **Cash basis** (cost hits when the supplier invoice is paid) as the default; keep the units-sold feed so an **accrual view** can be added later. (Owner leaning cash; treat cash as the shipped default.)
3. **Source-of-truth precedence:** **Both rules apply** — **synced data wins for actuals** (Amazon = revenue/units/fees; Mercury = cash; invoices = COGS) AND **manual entry fills gaps** no integration covers; a manual value that overrides a synced one is flagged as an override.

## Open decisions — original recommended defaults (superseded by Decisions above)
1. **Auth & multi-user:** two users (Simo = owner/full; Youness = partner). *Recommended:* partner has full visibility, limited finance-edit. **← confirm Youness's permissions.**
2. **Accounting basis:** *Recommended:* **cash basis** (cost hits when supplier invoice is paid), with units-sold data enabling an accrual *view* later. **← confirm.**
3. **Source-of-truth precedence when synced ≠ manual:** *Recommended:* **synced wins for actuals** (Amazon = revenue/units/fees; Mercury = cash; invoices = COGS); manual entry covers gaps and is flagged when it overrides a synced value. **← confirm.**

## What's intentionally faked
- All integrations (toggling "connect" doesn't call real APIs) — real OAuth + fetch is the biggest task.
- `localStorage` everywhere → real DB + multi-device sync.
- Seeded sample data (orders, shipments, finance months, Amazon units) → replace with live/imported data.

## Files
All `*.html` (screens) and `*.jsx` (data + app modules) at project root; styling in `vy-app.css`; the running spec/history in `README.md`. The `*-data.jsx` files are the de-facto schema.
