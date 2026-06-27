# Handoff: FBA Calculator (standalone component)

## What this is
A **forward-looking FBA sourcing calculator** — the "should I buy this?" tool. You punch in a target Amazon sale price, a landed-cost buildup, product dims/weight, and category; it returns the **Amazon fee stack (referral + FBA fulfilment + storage), net profit per unit, margin %, ROI %, and the breakeven sale price**, plus an order-size projection (cash in goods, revenue, projected profit). It is the *prospective* counterpart to the Product page (which reports a SKU's *actual* economics after the fact).

This bundle is **one component extracted from a larger app (Vyonix / "FBA Business Manager")**, at the user's request. It's a high-fidelity **HTML + React (in-browser Babel, no build step)** design reference — recreate it in your real codebase (React + TypeScript recommended); don't ship the prototype as-is.

## Fidelity
**High-fidelity.** Colors, type, spacing, layout, and interactions are intentional — reproduce faithfully using the tokens in `vy-app.css`.

## Files in this bundle
- **`fba-calc.jsx`** — the whole calculator. Exports three things on `window`:
  - `FbaCalculator` — the calculator **body** (the form + results). Props: `{ compact, prefill }`.
  - `FbaCalculatorPage` — the **standalone page** (app chrome + breadcrumb + header + `<FbaCalculator>`); reads `?sku=` to prefill from the catalog.
  - `FbaCalcModalApp` + `window.vyOpenFbaCalc(seed)` — a **modal** launchable from anywhere (⌘K, a "Model reorder" button, etc.). When seeded with a SKU it titles itself "Reorder check · <SKU>".
- **`Vyonix FBA Calculator.html`** — the entry point (script load order matters).
- **`vy-icons.jsx`** — `<VyIcon name=… size=… />` inline-SVG icon set.
- **`vy-shell.jsx`** — app chrome (`VySidebar`, `VyHeader`, `VyMobileNav`) used by the standalone page. *Drop this if you embed the calculator in your own shell — the body (`FbaCalculator`) has no chrome dependency.*
- **`catalog-data.jsx`** — product catalog source (`catLoadFamilies()`), used only for the "Prefill from catalog" dropdown. Swap for your product source; the calculator works fully without it (the dropdown just won't show).
- **`vy-app.css`** — all design tokens + base component styles (HSL custom properties, light + `.dark`).

## The fee model (the important part — keep it exact)
Defined at the top of `fba-calc.jsx`; **intentionally identical to the Product page's model** so a SKU reconciles whether viewed here or there. It approximates Amazon's 2026 non-peak US model — close enough to plan margins; exact per-ASIN fees would come from the SP-API Product Fees endpoint.
- **`fcSizeTier(weightLbs, dims)`** → Small/Large standard · Small/Large bulky · Extra-large, from the sorted dims + weight.
- **`fcFulfillmentFee(weightLbs, dims)`** → per-unit FBA fee by tier + weight, + a 3.5% fuel surcharge.
- **`fcStorageMo(dims, months, peak)`** → monthly storage from cubic feet × rate (peak Q4 ≈ 3× non-peak).
- **`fcReferralPct(category)`** → referral % by category (automotive categories pinned to 15% to match the parent app; rest are real 2026 reference rates). User can override the % inline.
- **Net/unit** = price − landed − referral − FBA − storage. **Margin** = net ÷ price. **ROI** = net ÷ landed. **Breakeven** = (landed + FBA + storage) ÷ (1 − referral%).

## Units: metric input, imperial math (the feature just added)
Suppliers spec dims in **cm/kg**; Amazon's fee model is **in/lb**. The Dimensions & weight row has a **`cm / kg` ↔ `in / lb` segmented toggle**:
- Enter metric → converted under the hood (**cm ÷ 2.54 → in**, **kg × 2.2046 → lb**) before any size-tier/fee math.
- A live hint shows the imperial equivalent — *"Amazon sees 11.81 × 7.87 × 3.94 in · 3.31 lb"* — so the listing value is visible.
- Field suffixes follow the unit; prefilling a catalog SKU (stored in inches) snaps back to imperial.

Keep this conversion at the **input boundary** — store/compute canonically in one unit, present in the other.

## Landed-cost input: two modes
- **Build it up** — unit cost + freight/unit + duty % (duty applied to unit cost).
- **Single figure** — one all-in landed number.
The result waterfall + breakeven use whichever is active.

## Inputs → Outputs (the contract)
**Inputs:** target sale price; landed cost (buildup or single); category + referral %; L/W/H + weight (cm/kg or in/lb); storage months + Q4-peak flag; order quantity.
**Outputs:** size tier, FBA fee/unit, referral fee/unit, storage/unit, **net/unit**, margin %, ROI %, breakeven price, and the order projection (cash-in-goods, revenue, projected profit). A **verdict badge** (Loss / Thin / Healthy / Strong) summarizes.

## Design tokens (full set in `vy-app.css`)
- **Primary:** `--primary: 24.6 95% 53.1%` (orange) · **surfaces:** `--background: 42 25% 96%`, `--card: 40 33% 99%`, `--muted-bg: 39 22% 92%` · **text:** `--foreground: 28 12% 10%`, `--muted-fg: 34 8% 41%` · **status:** `--success/--warning/--danger/--info`.
- **Type:** Inter (UI) + JetBrains Mono (all numerics — values, money, dims). Verdict tones color the headline number.
- Inputs are 38px, radius 8–9px; the segmented toggles (cost mode, units) share one `segBtn()` style.

## To productionize
- Rebuild in React + TypeScript; lift the `fc*` fee functions into a typed, unit-tested pricing module (they're pure).
- Replace the approximate fee model with **SP-API Product Fees** for exact per-ASIN fees when a real ASIN is known; keep this estimator as the no-ASIN fallback.
- Wire "Prefill from catalog" to your real product source.
- The component body (`FbaCalculator`) is self-contained — embed it in a modal, a page, or a drawer.
