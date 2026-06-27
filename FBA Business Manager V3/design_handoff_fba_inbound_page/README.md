# Handoff: FBA Inbound Detail Page (Amazon leg)

## Overview
A full detail page for a single **Amazon FBA inbound shipment** in the FBA Business Manager — the "Amazon leg" of a two-leg fulfillment journey (forwarder freight → Amazon FC receiving). It opens from the FBA Shipments list when the user clicks an inbound's ID. Its reason to exist (vs. the existing quick-view drawer) is the **per-SKU Contents reconciliation table** — the place a short or over receipt is traced to the exact SKU, which a narrow drawer can't hold.

This pairs with the FBA Shipments **list**, which keeps a quick-view drawer for summaries AND links each row title to this page — mirroring the physical Shipments list (drawer + page). Both patterns are documented below so the page makes sense in context.

## About the Design Files
The files in this bundle are **design references created in HTML/React-via-Babel** — runnable prototypes showing intended look and behavior, **not production code to copy directly**. They use no build step (in-browser Babel), `window`-attached data helpers instead of real APIs, and deterministically *synthesized* data. The task is to **recreate these designs in the target codebase's environment** (React/Next + a real data layer, most likely) using its established component and styling patterns — replacing the synthetic data helpers with real Amazon Selling Partner API (FBA Inbound) calls.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions. Recreate the UI pixel-perfectly using the codebase's existing libraries (the prototype mirrors a shadcn/Tailwind + HSL-token system — see Design Tokens). All color tokens are the real intended values.

---

## Screens / Views

### 1. FBA Inbound Detail Page  — `fba-app.jsx` / `Vyonix FBA Shipment.html`
**Route:** `Vyonix FBA Shipment.html?fba=<inboundId>` → in production: `/operations/fba/[inboundId]`
**Purpose:** Inspect one Amazon inbound end-to-end: status, expected-vs-received reconciliation **per SKU**, the Amazon custody timeline, identifiers, and the seams back to the forwarder leg and the order.

**Layout (top → bottom), single scrolling column inside the app shell content area (max-width 1440px, 24px padding):**
1. **Breadcrumb** — `Operations › FBA Shipments › <inboundId>`.
2. **Header card** — title row + actions.
3. **Sync strip** — full-width info banner (connected) or warning banner (disconnected).
4. **KPI strip** — 6 stat cards, `repeat(auto-fit, minmax(150px,1fr))` grid.
5. **Two-column row** (`grid-template-columns: 1.4fr 1fr; gap:16px; align-items:start`; collapses to one column ≤920px):
   - **Left:** Contents card (the per-SKU table — centerpiece).
   - **Right rail (stacked, gap 16px):** Receiving roll-up card · Forwarder-leg seam card · Amazon identifiers card.
6. **Shipment events** card — Amazon custody timeline (full width).
7. **Order** card — link to the linked order (only if linked).

#### Header card
- Container: `.vy-card`, padding `20px 22px`. Flex row, space-between, wraps.
- **Left:** title line = inbound ID (`<h1 class="vy-title">`, JetBrains Mono) + a **source tag** ("● Amazon") + a status **badge** + an FC badge (muted) + optionally an "Unlinked" (warning) or "Direct to Amazon" (muted) badge. Below: a `.vy-title-meta` row of chips — mode (truck icon), `ETA <date>` (route icon), supplier (factory icon), order title (cube icon).
- **Right actions** (flex, gap 6): **Link** (primary, only if `unlinked`) · **Forwarder leg** (outline, links to the parent shipment page, only if `shipmentId`) · **Open order** (primary, only if `orderId`).

#### Sync strip
- Connected: rounded 10px banner, bg `hsl(var(--info)/0.06)`, border `hsl(var(--info)/0.22)`, a refresh-icon chip (info), text "Synced from Seller Central — Status & received units per SKU · last sync <date> · expected is your packing allocation", and a right-aligned "FBA Inbound API" info badge.
- Disconnected: warning variant (`--warning` tints), "Amazon not connected — Received units aren't syncing — reconnect to resume," and a "Reconnect" outline button → Settings → integrations.

#### KPI strip — 6 cards (`.vy-card.vy-kpi`)
Each: kicker label + optional source tag, big value (18px, 700), sub-label. In order:
1. **Status** — value = amazonStatus (tinted by status tone), sub = `ETA <date>`, source Amazon.
2. **Expected** — units packed, source Manual.
3. **Received** — `<n>` or "—", sub = `<pct>% booked` or "not yet", source Amazon.
4. **Variance** — `received - expected` signed, tone green(0)/red(short)/amber(over)/muted(pending), sub = reconciled/short/over/pending.
5. **SKUs** — line-item count.
6. **Dest FC** — FC code, sub = mode, source Amazon.

#### Contents card — CENTERPIECE (`.vy-card`)
- Header: boxes icon (success tint), title "Contents" + Amazon source tag, sub "Per-SKU receiving reconciliation — this is where a short or over receipt is traced to the exact SKU."
- **Table** (full-bleed to card edges via negative margin, `min-width:520px`, horizontal scroll on overflow):
  - Header row bg `hsl(var(--muted-bg)/0.5)`; columns: **SKU** (left) · **FNSKU** (left) · **Expected** (right, Manual tag) · **Received** (right, Amazon tag) · **Variance** (right).
  - Body rows: SKU cell = mono bold code (e.g. `SCV-BLK-M`) + muted descriptor under it (e.g. "Seat cover · Black · M"); FNSKU mono muted; Expected mono 600; Received mono 700 (or "—" before receiving); Variance mono 700, colored red(<0)/amber(>0)/green(0)/muted(pending).
  - **tfoot Total row:** 2px top border, bg `hsl(var(--muted-bg)/0.35)`, bold totals; Variance total colored by sign.
- Caption under table (11px muted) — context-sensitive: not-received / fully-reconciled / short-by-N (mentions red SKUs, suggests removal or reconciliation case) / over-by-N.

#### Right rail
- **Receiving card** — clipboard icon (info). 3 inline stats (Expected/Received/Variance) + an 8px progress bar (`received/expected`, green normally, **red if short**) + caption "<pct>% of expected units booked in" / "Receiving not started".
- **Forwarder-leg seam** — three states:
  - *Linked:* clickable card (`hsl(var(--accent)/0.5)` bg) "← Forwarder leg (freight to the FC)" + mono `shipmentId` + arrow → parent shipment page.
  - *Unlinked:* warning-tinted card with a "Link" primary-sm button opening the Link modal.
  - *Standalone:* muted card "Direct to Amazon — Standalone inbound — no forwarder leg tracked."
- **Amazon identifiers card** — hash icon. 4 stats: FBA shipment ID · Amazon ref (`7` + last-6 of id) · Dest FC · ETA.

#### Shipment events card
- route icon (info), title "Shipment events" + Amazon tag, sub "From Seller Central — the Amazon custody leg, starting at the FC handoff."
- Vertical timeline, 6 nodes: **Shipment created · In transit · Delivered to FC · Checked in · Received · Shipment closed**. Each node: 12px dot (filled green if done, info ring if current, hollow border if pending) connected by a 2px rail (green between two done nodes, else border color). Label + date (done nodes show a formatted datetime; "Checked in" appends the FC; pending shows italic "pending").
- Done-count derives from amazonStatus + received: Closed→all, received>0→through Received, Receiving→through Checked in, Shipped/In transit→through In transit, else→Created only.

#### Order card (only if linked)
- cube icon (primary). A single link row → order page: mono order id (muted) + order title + arrow.

#### Link modal (unlinked inbounds)
- Centered dialog (max-width 480, `var(--shadow-lg)`), backdrop `hsl(0 0% 0%/0.5)`, Escape closes.
- Title "Link FBA inbound" + sub `<id> · <fc> · <n> units`. A **shipment `<select>`** (lists all shipments: `id · orderTitle (packed pcs)`), an explainer of which order it links to. Footer: **Keep standalone** (ghost, left) · **Cancel** (ghost) · **Link** (primary, disabled if none chosen). On commit: persists the link then reloads.

### 2. FBA Shipments List (context) — `fba-list-app.jsx` / `Vyonix FBA Shipments.html`
**Purpose:** Portfolio of all Amazon inbounds across orders (the synced world). The relevant pattern for this handoff:
- **Row click → opens the quick-view drawer** (`FbaDrawer`) for a fast summary.
- **Row title (the FBA shipment ID) → links to the detail page** (`?fba=<id>`), `e.stopPropagation()` so it doesn't also open the drawer. The title uses the shared `.vy-row-title` style: **default text color**, orange underline **on hover only** — NOT a permanently-colored link (important: the page has exactly one orange link per row — the parent-shipment cross-reference; the row's own title must not compete with it).
- Drawer footer has a primary **"View full details & contents"** button → the detail page.

This drawer+page duality is the app-wide convention (same as physical Shipments, Suppliers, Partners, Integrations). Preserve it.

---

## Interactions & Behavior
- **Navigation:** list row title & drawer button → `?fba=<id>` page; page Forwarder-leg → `?shipment=<id>` page; page Open-order → order page; Reconnect → settings.
- **Link flow:** unlinked inbound → Link modal → choose shipment or keep standalone → persist → reload (so derived link state re-reads). In production, replace reload with a state refetch/mutation.
- **Hover:** `.vy-row-title` underlines orange on hover; `.vy-order-row` shifts 2px right + accent bg + left accent bar.
- **Responsive:** two-column block collapses to one column at ≤920px; KPI grid auto-fits at 150px min; Contents table scrolls horizontally below ~520px.
- **Dark mode:** all colors are HSL tokens — flipping `.dark` on `<html>` recolors everything. No hardcoded hex in components.
- **No loading/error states** are mocked beyond the "Amazon not connected" banner; add real ones for async fetches.

## State Management
Page is essentially **read-only** off one inbound record plus derived values. Needed state in a real build:
- **Inbound record** (fetched by id): `id, amazonStatus, fc, mode, eta, expected, received, skuCount, supplier, shipmentId?, orderId?, orderTitle?, unlinked, standalone, synced?`.
- **Per-SKU lines** `items[]`: `{ sku, name, fnsku, expected, received }` — in production from the **FBA Inbound Items API**. (In the prototype these are *synthesized* — see Data Notes; do not port the synthesis.)
- **Derived (compute in selectors):** variance & tone, received %, done-index for the timeline, amazon-ref string, per-line variance.
- **Link mutation:** writes `{ shipmentId }` or `{ standalone: true }` for an inbound (prototype: localStorage key `vy_fba_links_v1`; production: a real association).
- **Integration status:** `amazonConnected` boolean drives the sync strip.

## Design Tokens
HSL triplets, used as `hsl(var(--token))` or `hsl(var(--token) / <alpha>)`. Light mode:

| Token | Value (HSL) | Use |
|---|---|---|
| `--background` | `42 25% 96%` | app bg |
| `--foreground` | `28 12% 10%` | text |
| `--card` | `40 33% 99%` | card bg |
| `--primary` | `24.6 95% 53.1%` | **Vyonix orange** — primary buttons, the single per-row cross-link, hover underline |
| `--muted-bg` | `39 22% 92%` | table header / progress track |
| `--muted-fg` | `34 8% 41%` | secondary text |
| `--accent` | `32 100% 96%` | seam/link card bg (used at 0.5 alpha) |
| `--border` / `--input` | `38 18% 84%` | borders, dividers |
| `--success` | `142 71% 32%` | reconciled / received bar |
| `--warning` | `32 95% 36%` | over-receipt, unlinked, disconnected |
| `--danger` | `0 74% 42%` | short receipt |
| `--info` | `199 89% 38%` | Amazon-sync accents, timeline current node |
| `--radius` | `10px` | card radius (chips/badges smaller) |
| `--shadow-lg` | `0 1px 2px …/.08, 0 18px 48px …/.10` | modal |

Dark-mode equivalents exist for every token (see `vy-app.css` `.dark`). **Source tag dots:** Amazon = filled `--info` dot; Manual = hollow ring. **Status→tone map** (`LOG_FBA_TONE`): Receiving→info, Received/Closed→success, In transit/Shipped→warning, etc. (see `logistics-data.jsx`).

**Typography:** UI = Inter (400–800); all IDs/SKUs/numbers = **JetBrains Mono** (`--font-mono`). Title ~22px/700; card titles 15px/700; KPI value 18px/700; table body 12.5px; kickers 10px uppercase 0.05em tracking, muted.

**Spacing:** card padding 16–22px; grid/flex gaps 6 (actions) / 14 (stats) / 16 (cards); table cells `11px 18px`.

## Assets
- **Icons:** `VyIcon` component (`vy-icons.jsx`) — inline SVG set. Names used here: `truck, route, ship, cube, boxes, clipboard, hash, refresh, link, x, check, arrowRight, chevronRight, alert, factory`. Map to the codebase's icon library (lucide-style) by name.
- **Fonts:** Inter + JetBrains Mono (Google Fonts). No raster images.

## Files (in this bundle / project)
- **`fba-app.jsx`** — the detail page (`FbaInboundPage`). Primary reference.
- **`Vyonix FBA Shipment.html`** — entry point / script load order for the page.
- **`fba-list-app.jsx`** — the list + drawer (context for the drawer+page pattern and the row-title link).
- **`Vyonix FBA Shipments.html`** — list entry point.
- **`logistics-data.jsx`** — shared data layer. Key exports: `logAllFbaRows()` (flattens inbounds), **`logFbaLines(f)`** (per-SKU lines — see Data Notes), `LOG_FBA_TONE`, `logAllShipments()`, `logSaveFbaLink()`. **Replace with real API calls.**
- **`vy-app.css`** — full token system + `.vy-card/.vy-kpi/.vy-badge/.vy-chip/.vy-row-title/.vy-order-row/.vy-title` classes. Lift token values; reimplement classes in the codebase's styling system.
- **`vy-shell.jsx`** — app chrome (`VySidebar/VyHeader/VyMobileNav`) the page mounts inside.

## Data Notes (IMPORTANT — do not port the synthetic data)
The prototype has **no real per-SKU data**. `logFbaLines(f)` *deterministically synthesizes* lines from the inbound (hashes the id, splits `expected` into `skuCount` integer parts that sum exactly, allocates `received` exact-sum — overage on line 1, shortfall spread by largest fractional part). This exists only so the table renders believably offline. In production, **delete this** and fetch real line items from the Amazon FBA Inbound Items API; the Contents table and all derived variances read straight from `items[]`.
