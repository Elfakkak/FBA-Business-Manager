---
description: Supervised health + multi-agent review (smoke or deep audit) at the end of a phase/session
---

# Supervised Check (v2)

Confirm the FBA / Vyonix Business Manager is **built faithfully to the active design handoff**
(the latest `FBA Business Manager V*/` folder — currently **V6**) and **runs smoothly in
production** — connected, deployed *with the latest code actually live*, responsive, and free
of regressions.

Two tiers — pick based on the arg (`/supervised-check smoke` or `/supervised-check audit`;
default = audit):
- **SMOKE** — steps 1–3 only. Fast, run every PR.
- **AUDIT** — everything, incl. the 6 parallel agents. Run at each phase/session end.

Produce ONE consolidated PASS/FAIL report at the end. Be honest — never claim pass if an
agent found a real issue. Offer to fix the top items.

## 1. Automated health check
Run `node scripts/supervised-check.mjs` — Supabase connectivity, every table + row counts,
RLS (anon blocked / owner allowed), and live endpoints. Report the table.

## 2. Build + types
Run `npx tsc --noEmit` then `npm run build`. Confirm both pass; surface any error verbatim.
Note any `next/font` / Google-Fonts fetch failure — it can silently break the production build.

## 3. Deploy / release freshness  ⚠️ (the check that catches "still same")
Verify production is actually serving the **latest commit**, not a cached/stale bundle:
- Compare local `git rev-parse HEAD` to what's deployed. If `/api/version` exists, fetch it and
  compare SHAs; otherwise fetch the prod URL and confirm a known change from the latest PR is live.
- Check the host's last deployment **succeeded** (Vercel MCP `list_deployments` / build logs if
  linked) — a failed build silently keeps prod on an old version.
- Watch specifically for **JS-fresh / CSS-stale drift**: if a recent JS-only change is live but a
  recent `globals.css` change is NOT (e.g. a new `.vy-*` class renders unstyled), flag it — that's a
  CSS-bundle cache desync, and the fix is inline styles or a clean rebuild.
- ❌ FAIL this step if prod ≠ latest commit, even when every endpoint returns 200.

## 4. Multi-agent review — AUDIT only (spawn all 6 IN PARALLEL, one message)
Each agent reviews this session's changes (`git diff` / changed files) and reports findings as
`file:line · severity · one-line fix`.

1. **Deploy/Release verifier** — deepen step 3: env vars present (e.g. `TRACK17_API_KEY`,
   Amazon creds), migrations applied to the live DB, no orphaned `?new=1`/route assumptions, and
   the deployed commit == HEAD across JS *and* CSS.
2. **Visual / screenshot** — render the touched screens (Playwright, desktop **and** mobile) and
   compare against the V6 prototype PNGs/JSX. Catch what text review can't: unstyled/missing CSS,
   wrapping/overflow, contrast, broken drawers, misaligned grids. Attach which screens looked wrong.
3. **Debugging / data-flow** — correctness bugs, runtime errors, RLS gaps, unhandled edges; AND
   pull real rows from the live DB to verify any **derived** numbers (activity feed, FIFO
   sell-through, PO-vs-invoiced, rollups) actually reconcile — don't just read the code.
4. **Component-consistency** ("think in components") — every touched surface REUSES shared
   primitives, not copies: (a) no native `<select>`/ad-hoc dropdowns — all `@/components/ui/select`;
   (b) shared `Modal`/`Field`/`Drawer`/primitives; (c) one component per concept across list +
   detail + order-shell; (d) `vy-*`/HSL tokens, no hard-coded colors; (e) shared behaviors
   (bulk-archive, smart-disable, drawer DirtyGuard) reused. Name the component each duplication SHOULD use.
5. **Dead-code / drift** — orphaned exports/components after refactors (e.g. removed modals), unused
   imports, and **hand-patched `database.types.ts` vs the live schema** (every recent `alter table`
   reflected in the types Row/Insert/Update).
6. **A11y / interaction** — keyboard + focus rings, outside-click/Escape on menus & drawers
   (the Quick-create bug class), the Drawer dirty-guard, label/aria, and mobile: tables scroll,
   drawers fit, nav doesn't overflow.

## 5. Consolidated report
✅/❌ per area: **DB · RLS · Build · Deploy-freshness · Visual · Bugs/data · Components · Dead-code · A11y**.
Then a short prioritized fix list. Standing rules still apply: match the V6 prototype, verify
before claiming done, think in components, remember reported fixes.
