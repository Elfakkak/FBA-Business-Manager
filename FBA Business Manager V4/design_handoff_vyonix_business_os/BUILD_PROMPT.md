# BUILD PROMPT — FBA Business Manager (paste this into Claude Code)

> This is a **generator prompt**: hand it to Claude Code together with this folder. It explains the full app, frames everything as components, and defines the motion system so animation is consistent app-wide. Read `README.md` and `PROJECT_ARCHITECTURE.md` in this folder first — they are the source of truth; this prompt tells you how to execute.

---

## ROLE
You are building a production front-end for **FBA Business Manager** — an operations console for a private-label Amazon FBA business. A complete, high-fidelity HTML/React prototype is included in this folder (every `Vyonix *.html` entry point, every `*.jsx`, and `vy-app.css`). **Reproduce it faithfully** in a real, typed, component-based codebase. The prototype is the spec; it is not shippable as-is (no build step, globals on `window`, `localStorage` instead of a backend).

## TARGET STACK
Default to **React 18 + TypeScript + Vite**, **CSS Modules or vanilla-extract** (keep the existing HSL CSS-variable token system — do not swap in Tailwind unless I tell you to), **React Router** for routes, and a typed data layer (Zod-validated models + a store like Zustand or TanStack Query). If a codebase already exists, match its conventions instead. Confirm the stack with me in one line before scaffolding, then proceed.

## NON-NEGOTIABLE PRINCIPLES (carry these from the prototype)
1. **One source of truth per concept.** Products = the Catalog. Service charges = the Charge-types catalog. Invoices/payments/charges = the payables model. Packaging = Packaging inventory. Never let two screens own the same fact.
2. **Units vs money deduct in exactly one place each.** Quantity is owned by **Production**; an invoice records only **billed money** per SKU (qty shown read-only). Inventory units enter stock **only at the FBA receipt**. Packaging deducts **only** via the Production draw-down. No path double-counts.
3. **One canonical render path for invoices** — every invoice surface reads the same selectors (lines, payments, balance/status/aging). Build these as pure functions/selectors over the store, not per-screen logic.
4. **Honesty in the UI** — "Auto" vs "Estimate" badges must reflect real data presence, not decoration.

---

## BUILD AS COMPONENTS (the architecture I want)

Think in four layers. Build bottom-up; never inline what should be a primitive.

### Layer 1 — Design tokens (`theme/`)
Port **every** token from `vy-app.css` verbatim: HSL color vars (light + `.dark`), radius scale, the three shadows, the two font families (**Inter** UI / **JetBrains Mono** for all numerics, SKUs, IDs, money). Expose them as CSS variables on `:root` / `.dark`. All components consume tokens — **no hard-coded colors anywhere.** Brand = `--primary: 24.6 95% 53.1%` (Vyonix orange).

### Layer 2 — Primitives (`components/ui/`)
Atomic, stateless, token-driven. Each is its own file with typed props + a stories/example. Derive their exact look from `vy-app.css` classes of the same name:
- `Button` (variants: `primary` · `outline` · `ghost` · `sm`; supports leading `Icon`) ← `.vy-btn*`
- `Badge` (tones: `success` · `warning` · `danger` · `info` · `muted`) ← `.vy-badge*`
- `Card` / `SectionCard` (icon chip + title + sub + actions slot + body) ← `.vy-card`, `ShipSectionCard`
- `Kicker` (uppercase 10–10.5px label) ← `.vy-kicker`
- `Input` / `Select` / `NumberInput` / `MoneyInput` ← `.vy-input`
- `Icon` — wrap one icon set; map by the names used in `vy-icons.jsx`
- `KpiTile`, `FieldRow` / `Field`, `Table` (header + rows + total row), `ProgressBar`
- `Drawer` (right slide-over + scrim), `Modal`/`Dialog` (center + scrim), `Menu` (pop-over), `CommandPalette` (⌘N quick-create)
- `Tabs`/`PillNav`, `Breadcrumb`, `EmptyState`

### Layer 3 — App chrome (`components/shell/`)
`AppShell` = `Sidebar` (grouped nav: Operations / Catalog / Finance / Partners, collapsible) + `Header` (search + theme toggle + quick-create) + `MobileNav`. Port from `vy-shell.jsx`. Every routed page renders inside `AppShell`. Theme = `.dark` on the root.

### Layer 4 — Features (`features/<domain>/`)
One folder per domain, each composing Layer 1–3. Map the prototype entry points to routes:
- `features/dashboard` → `/` ← `Vyonix Dashboard.html`
- `features/orders` → `/orders` (list) and **`/orders/:id`** = the **Order Shell**, a tabbed workspace (Home · Production · Inspection · Shipping · Invoices · Landed cost). Each tab is a section component (`ProductionSection`, `InspectionSection`, `ShippingSection`, `InvoicesSection`, `LandedCostSection`). Tabs switch **in-app** (no reload), support a `#<tab>` hash, and run the page-enter motion (below).
- `features/catalog` → Products + `/products/:family`, Inventory, Performance, Packaging, **Charge types**, FBA calculator
- `features/invoices` → `/invoices` (portfolio AP) + **`/invoices/:id`** (detail). Drawer = quick view; title link = full page.
- `features/shipments` (manual freight) + `features/fba` (Amazon inbounds) — two **separate** objects, kept distinct (physical freight leg vs Amazon FC leg; tracked by different systems, never double-tracked).
- `features/suppliers`, `features/partners`, `features/finances` (P&L, payables, FX), `features/settings` (integrations, profile, team, notifications)

### Data layer (`data/` + `store/`)
Port the `*-data.jsx` files into typed models + selectors. Replace each `localStorage` key with a store slice / API call (keys to model: `vy_invoices_v1`, `vy_charge_types_v1`, `vy_payables_applied_v1`, `vy_order_status_v1`, `vy_orders_drafts_v1`, catalog/closeout/profile/team/notification keys). Keep cross-section bridges (e.g. Invoices→Landed cost) as **store selectors** so they survive reload — fix the prototype's in-memory-only limitation.

---

## MOTION SYSTEM (build this as a shared layer, applied app-wide)

The prototype has a deliberate, restrained motion language. **Encode it once as tokens + a few reusable primitives, then every component inherits it** — do not scatter ad-hoc transitions.

### Motion tokens (`theme/motion`)
- **Signature easing — `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`** (a fast-start, soft-settle curve). Use for *entrances and transforms* (pages, drawers, dialogs, menus, pop-ins).
- **`--ease-standard: ease`** — use for *state/color/hover* changes only.
- **Duration scale:** `--dur-1: 120ms` (hover, color, focus, tiny state) · `--dur-2: 160–180ms` (small enters: menus, pop-ins, row hover lift) · `--dur-3: 240–280ms` (pages, scrims, dialogs, sidebar width, mobile nav) · `--dur-4: 320ms` (right-side drawers) · one-off `400ms` for progress-bar fills.
- **Transform amounts (keep subtle):** hover lift `translateY(-1px)`; menu/pop enter `translateY(-4px) scale(0.98)→0`; dialog enter `translateY(10px) scale(0.98)→0`; drawer enter `translateX(110%)→0` (left nav: `-110%`); submenu `translateY(-2px)`.

### Named entrances (port these keyframes verbatim)
- **`pageIn`** — `opacity 0→1`, `--dur-3`, `--ease-out`, `both`. Wrap every routed page / Order-Shell section body so navigation feels alive. (Opacity-only on purpose — see reduced-motion rule.)
- **`fadeDown`** — `opacity 0 + translateY(-2px) → 0`, `--dur-2`. Expanding nav submenus.
- **`popIn`** — `opacity 0 + translateY(-4px) scale(0.98) → 1/0/1`, `--dur-2`, `--ease-out`. Pop-over menus.
- **Dialog/Drawer/Scrim** are **transition-based** (open class), not keyframes: scrim `opacity`, drawer `transform: translateX`, dialog `transform: translateY+scale`, all `--ease-out`.

### Interaction motion (bake into primitives, not pages)
- **Buttons:** `transition: background, color, border-color, box-shadow --dur-1, transform 80ms`. Active press = tiny `scale(0.98)`/`translateY(1px)`.
- **Hoverable cards/rows** (`KpiTile`, order rows, need-rows, section rows): `box-shadow + transform + border-color --dur-2`; hover = `shadow-md` + optional `translateY(-1px)`. Keep it whisper-light — this app is calm, not bouncy.
- **Inputs:** focus `border-color + box-shadow --dur-1` (focus ring = `--ring`).
- **Theme toggle:** body `background-color + color 250ms ease`.
- **Sidebar collapse:** `width 220ms ease`.

### Rules (apply globally)
1. **Reduced-motion safety:** any element that animates **from `opacity: 0`** must reach its visible state under `@media (prefers-reduced-motion: reduce)` (and in print/PDF). Prefer **transform-only** entrances where an element could otherwise get stuck invisible (the prototype's quick-create palette uses a transform-only `vgsPop` precisely for this). Provide a global `@media (prefers-reduced-motion: reduce)` block that drops non-essential animation to near-instant and forces final opacity.
2. **No infinite/looping decorative animation** on content. Motion serves orientation (where am I, what just changed), nothing more.
3. **One easing for entrances** (`--ease-out`) — consistency is the whole point. Don't introduce new curves per component.
4. Respect a single **`MotionProvider`/util** that exposes the tokens; primitives reference tokens so a future global tweak (e.g. snappier) is one edit.

---

## EXECUTION ORDER
1. Confirm stack (one line), scaffold the project, wire routing + `AppShell`.
2. Port **tokens** + **motion tokens** + global reduced-motion block.
3. Build **Layer 2 primitives** with the motion baked in; verify each against the matching `vy-app.css` class.
4. Build the **Order Shell** (`/orders/:id`) end-to-end first — it exercises tabs, sections, drawers, modals, tables, and the data model. Use it to prove the architecture.
5. Then Catalog, Invoices (+ the canonical selectors), Landed cost, Shipments/FBA, Finances, Settings, Dashboard.
6. Replace `localStorage` with the real store/API; make cross-section bridges store-backed.
7. Keep a running `CHANGELOG` and update a project README as you go (the prototype's `PROJECT_ARCHITECTURE.md` is the model for that doc).

## DELIVERABLE CHECK
- Pixel-faithful to the prototype (tokens, type, spacing, density, copy).
- Every screen reachable; drawers/modals/menus animate per the motion system; reduced-motion verified.
- Source-of-truth rules enforced in the data layer, not just the UI.
- No hard-coded colors; no duplicated owners of the same fact.

When something in the prototype is ambiguous, **ask me** rather than guessing — especially around the money/units ownership rules.
