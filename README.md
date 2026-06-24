# Manifest — FBA Business Manager

Operations platform for a two-person Amazon FBA / import business (owner **Simo**, partner **Youness**). Covers the full purchase-order lifecycle (Production → Inspection → Shipping → Invoices → Landed cost) plus Catalog, Inventory, Packaging, Suppliers/Partners, Finance, Performance & reorder planning, notifications, and external integrations.

This repo is the production rebuild of the HTML/React prototype in `_design/prototype/` (local reference, git-ignored).

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind v4**
- **Supabase** — Postgres + Auth + Row-Level Security + Storage
- **Vercel** — hosting + CI from GitHub
- **shadcn/ui** — component primitives, themed with the prototype's `vy-app.css` HSL tokens (warm cream canvas, orange primary, tabular numerals)

## Project layout

```
src/
  app/
    page.tsx              # protected dashboard shell
    login/page.tsx        # email/password sign-in
    auth/signout/route.ts # sign-out handler
    layout.tsx            # Inter + JetBrains Mono, brand metadata
    globals.css           # design tokens -> Tailwind v4 theme
  lib/
    supabase/client.ts    # browser client (RLS-enforced)
    supabase/server.ts    # server client + service-role client
    supabase/middleware.ts# session refresh + route guard
    database.types.ts     # generated from the live schema
    utils.ts              # cn()
  proxy.ts                # Next 16 proxy (was middleware)
supabase/
  migrations/
    0001_initial_schema.sql  # 30 tables + 20 enums
    0002_auth_rls.sql        # roles, per-section RLS, auth-link trigger
_design/                  # prototype + handoff (git-ignored reference)
```

## Data model

30 tables derived from the prototype `*-data.jsx` modules. **Inputs are stored; derived values are computed** (company net, COGS, landed cost, reorder qty, TACoS, P&L, balances, aging, on-hand, days-of-cover, settle-up are never persisted). See `supabase/migrations/0001_initial_schema.sql`.

## Auth & permissions (Decision #1)

- **Simo = Owner** -> full read + write on every table.
- **Youness = Partner** -> view-only, and only the sections Simo grants. Per-section visibility lives in `public.users.section_perms` (jsonb), enforced by RLS via `is_owner()` / `can_view(section)`. Finance is hidden unless explicitly granted.
- New auth users are auto-linked to their `public.users` row by email on signup.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev
```

Required env vars (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; for syncs / derived recalculation)

## Roadmap

- **Phase 0 — Foundation** ✅ scaffold, schema, auth/RLS, Supabase wiring, deploy
- **Phase 1** — Catalog + Inventory + Packaging
- **Phase 2** — Orders lifecycle + Suppliers/Partners/Contacts
- **Phase 3** — Finance (entries, capital accounts, P&L, recurring, payment terms)
- **Phase 4** — Integrations: Mercury -> Amazon SP-API -> Amazon Ads -> 17TRACK -> QuickBooks -> Wise FX
- **Phase 5** — Derived dashboards, notifications, performance & reorder
