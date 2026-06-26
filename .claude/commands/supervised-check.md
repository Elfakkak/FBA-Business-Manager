---
description: Run a full supervised health + multi-agent review at the end of a phase/session
---

# Supervised Check

Run a complete supervised check of the FBA / Vyonix Business Manager. Goal: confirm the
app is **implemented faithfully to the Claude design prototype** (`_design/prototype/`) and
**runs smoothly** — database connected, deployed, responsive, and free of bugs/regressions.

Perform ALL of these, then produce one consolidated PASS/FAIL report:

## 1. Automated health check
Run: `node scripts/supervised-check.mjs`
This checks Supabase connectivity, every table + row counts, RLS enforcement (anon blocked /
owner allowed), and the live production endpoints. Report the result table.

## 2. Build + types
Run: `npm run build` — confirm it compiles and TypeScript passes. Surface any error.

## 3. Multi-agent review (run the 4 agents IN PARALLEL, one message)
Spawn four subagents, each reviewing the most recent changes (use `git diff` / changed files):
- **Design fidelity agent** — compare the built screens against the matching prototype files
  in `_design/prototype/` (`*-app.jsx`, `Vyonix *.html`, `vy-app.css`). Flag where the
  implementation visually or structurally diverges from the design. The prototype is the spec.
- **Debugging agent** — hunt for correctness bugs, runtime errors, broken data flows, RLS gaps,
  unhandled edge cases, and anything that would not "run smoothly".
- **Engineering agent** — review code quality: component reuse (shared-component strategy),
  derived-vs-stored correctness, type safety, dead code, and adherence to the project's patterns.
- **Component / design-master agent** — audit the shared-component strategy itself (the standing
  rule is: one fix must propagate). For every UI surface touched this session, verify it REUSES the
  shared primitives/components instead of re-implementing or copy-pasting. Concretely check:
  (a) NO native `<select>` / `<datalist>` / ad-hoc dropdowns — everything uses `@/components/ui/select`;
  (b) modals use the shared `Modal`/`Field`, drawers use the shared `Drawer`, badges/cards/KPIs use
  `@/components/ui/primitives`; (c) the SAME component renders a concept everywhere it appears (e.g. the
  invoice quick-view drawer, the charges table, the record-payment/edit modals are single shared
  components used by every surface — list, detail page, AND order shell — not divergent copies);
  (d) design tokens/classes (`vy-*`, HSL vars) are used rather than hard-coded colors/spacing;
  (e) when a concept is duplicated, flag it and name the shared component it SHOULD use. Report each
  divergence with file:line, severity, and the consolidation fix. This is the "think in components" guard.

## 4. Consolidated report
Summarize: ✅/❌ per area (DB, RLS, deploy, build, design fidelity, bugs, engineering,
component-consistency), then a short prioritized list of anything to fix. Be honest — do not
claim pass if an agent found a real issue. Offer to fix the top items.

Keep in mind the standing rules: match the prototype, verify before claiming done, use the
component strategy, and remember reported fixes.
