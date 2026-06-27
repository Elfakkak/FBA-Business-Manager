# Build prompt — Order page-switcher navigation (breadcrumb + segmented pill bar)

Paste everything below into Claude Code. It is the exact spec for the in-order navigation: a breadcrumb line above a segmented "pill" tab bar (Home · Production · Inspection · Shipping · Invoices · Landed cost), active pill filled in brand orange. Match this precisely.

---

## What to build
A header block shown at the top of every **Order** view, containing two stacked rows:

1. **Breadcrumb** — `Orders ›  ORD-2026-05-006 ›  Landed cost`
   - "Orders" is a muted link, the order ID is mono and muted, the current page is darker/medium weight. Chevron separators between.
2. **Segmented pill bar** — a single rounded container holding 6 pills: **Home · Production · Inspection · Shipping · Invoices · Landed cost**. Each pill = icon + label. The **active** page's pill is filled brand-orange with white text + soft orange glow; the rest are transparent, muted text, with a subtle hover. Clicking a pill switches the order view (no full reload). It's the same component on every section — only which pill is active changes.

## Exact structure (HTML)
```html
<div class="vy-order-shell-head">
  <!-- 1. Breadcrumb -->
  <nav class="vy-breadcrumb" aria-label="Breadcrumb">
    <a class="vy-bc-link" href="/orders">Orders</a>
    <svg class="chev">›</svg>
    <a class="vy-bc-link vy-bc-mono" href="/orders/ORD-2026-05-006">ORD-2026-05-006</a>
    <svg class="chev">›</svg>
    <span class="vy-bc-current">Landed cost</span>
  </nav>

  <!-- 2. Pill bar -->
  <nav class="vy-pageswitch" aria-label="Order pages">
    <button class="vy-page-pill" aria-current="false"><Icon home/><span>Home</span></button>
    <button class="vy-page-pill" ><Icon wrench/><span>Production</span></button>
    <button class="vy-page-pill" ><Icon clipboard-check/><span>Inspection</span></button>
    <button class="vy-page-pill" ><Icon truck/><span>Shipping</span></button>
    <button class="vy-page-pill" ><Icon receipt/><span>Invoices</span></button>
    <button class="vy-page-pill is-active" aria-current="page"><Icon file-text/><span>Landed cost</span></button>
  </nav>
</div>
```
Drive it from a `pages` array `[{ key, label, icon }]`; map to pills; add `is-active` when `key === activePage`; `onClick` sets `activePage`. Icons at 13px. Labels never wrap.

## Exact CSS (verbatim — uses HSL CSS-variable tokens)
```css
.vy-order-shell-head { display: flex; flex-direction: column; gap: 10px; }

.vy-breadcrumb { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: hsl(var(--muted-fg)); }
.vy-bc-link { text-decoration: none; color: hsl(var(--muted-fg)); transition: color 120ms ease; }
.vy-bc-link:hover { color: hsl(var(--foreground)); }
.vy-bc-mono { font-family: "JetBrains Mono", monospace; font-size: 11.5px; }
.vy-bc-current { color: hsl(var(--foreground)); font-weight: 500; }

.vy-pageswitch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 10px;
  background: hsl(var(--card) / 0.75);
  border: 1px solid hsl(var(--border) / 0.8);
  box-shadow: var(--shadow-sm);
  align-self: flex-start;       /* shrink to content, don't stretch full width */
  max-width: 100%;
  overflow-x: auto;             /* scrolls horizontally on narrow screens */
  scrollbar-width: none;
}
.vy-pageswitch::-webkit-scrollbar { display: none; }

.vy-page-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  padding: 7px 12px;
  font-size: 12.5px;
  font-weight: 600;
  color: hsl(var(--muted-fg));
  background: transparent;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  transition: background 180ms ease, color 180ms ease, transform 120ms ease;
}
.vy-page-pill:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }
.vy-page-pill.is-active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-fg));
  box-shadow: 0 1px 2px hsl(var(--primary) / 0.35), 0 2px 6px hsl(var(--primary) / 0.18);
}
.vy-page-pill:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }
```

## Required design tokens (HSL triplets — define once, e.g. :root)
```css
--primary:    24.6 95% 53.1%;   /* brand orange — the active pill fill */
--primary-fg: 0 0% 98%;         /* white text on the active pill */
--card:       40 33% 99%;       /* pill-bar container bg (used at 0.75 alpha) */
--border:     38 18% 84%;       /* container hairline */
--muted-fg:   34 8% 41%;        /* inactive pill + breadcrumb text */
--foreground: 28 12% 10%;       /* hover / current text */
--accent:     40 30% 94%;       /* inactive pill hover bg */
--ring:       24.6 95% 53.1%;   /* keyboard focus ring */
--shadow-sm:  0 1px 2px hsl(28 12% 10% / 0.05);
```
Everything is `hsl(var(--token))` — the `/ 0.75` and `/ 0.8` are alpha. The brand color is the SAME hue across primary + ring; that's intentional.

## The 3 details that are usually gotten wrong
1. **It's a SINGLE pill container, not 6 separate buttons floating in a row.** The rounded card with the hairline border + `padding:4px` wraps all pills; the active pill is a smaller rounded rect *inside* it. Build the container first.
2. **The bar hugs its content** (`align-self:flex-start`) and **scrolls horizontally** when cramped — it never stretches full-width or wraps to two lines.
3. **Active = filled orange with the double box-shadow glow**, inactive = transparent. Hover on inactive is a faint `--accent` wash, not orange. Keep the 180ms transitions.

## Icons (per pill, in order)
Home → house · Production → wrench/hammer · Inspection → clipboard-check · Shipping → truck · Invoices → receipt · Landed cost → file-text. Any consistent 13px line-icon set is fine.

## Acceptance
- One rounded bordered container holding all 6 pills, hugging content, left-aligned under the breadcrumb (10px gap).
- Active pill = orange fill + white text + soft glow; others muted with faint hover.
- Click switches the active page in-place; `aria-current="page"` on the active pill; visible focus ring on keyboard nav.
- Horizontal scroll (no wrap) when the viewport is narrow.
