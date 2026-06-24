-- =====================================================================
-- FBA Business Manager — initial schema (Phase 0)
-- Derived from the prototype *-data.jsx modules (see _design/prototype).
-- PRINCIPLE: store inputs only. Derived values (company net, COGS,
-- landed cost, reorder qty, TACoS, P&L, balances, aging, on-hand,
-- days-of-cover, settle-up) are COMPUTED in queries/server code, never
-- stored. Natural string IDs from the prototype are kept as PKs so the
-- seed/localStorage data ports cleanly.
-- =====================================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ---------- enums ----------
create type order_status        as enum ('draft','production','inspection','transit','fba','closed');
create type variant_status      as enum ('Ready','Reorder','SKU mislabeled','Not linked');
create type variant_prep        as enum ('Labeled','Stickerless');
create type payterm_type        as enum ('TT','LC','OA','DP','DA');
create type vendor_type         as enum ('Supplier','Forwarder','Agent','Inspection');
create type partner_type        as enum ('Agent','Forwarder','Inspection');
create type payment_status      as enum ('Cleared','Scheduled','Pending');
create type shipment_stage      as enum ('Draft','Booked','Picked up','In transit','Customs','Delivered','At FBA');
create type customs_status      as enum ('Cleared','In clearance','Pending','Docs missing');
create type fba_status          as enum ('Working','Shipped','In transit','Receiving','Closed','Problem');
create type entry_kind          as enum ('revenue','expense','draw','contribution');
create type entry_source        as enum ('amazon','manual','payables');
create type account_kind        as enum ('bank','cash');
create type txn_source          as enum ('amazon','mercury');
create type txn_direction       as enum ('in','out');
create type recur_cadence       as enum ('daily','monthly','yearly');
create type packaging_kind      as enum ('Mailer','Master carton','Insert','Polybag','Label','Box','Other');
create type pkg_move_type       as enum ('receive','consume');
create type team_role           as enum ('Owner','Partner','Operations','Viewer');
create type integration_status  as enum ('connected','disconnected','error','syncing');

-- =====================================================================
-- TEAM / USERS  (source of truth for owners + equity; finance partners derive from here)
-- =====================================================================
create table public.users (
  id          text primary key,
  name        text not null,
  email       text,
  role        team_role not null default 'Viewer',
  status      text not null default 'active',
  is_you      boolean not null default false,
  is_owner    boolean not null default false,
  share       numeric,                       -- ownership fraction (owners sum ~ 1)
  fin_id      text,                           -- stable id finance draws attribute to
  auth_uid    uuid,                           -- links to auth.users once invited
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger t_users_updated before update on public.users for each row execute function public.set_updated_at();

-- =====================================================================
-- SUPPLIERS / PARTNERS / CONTACTS
-- =====================================================================
create table public.suppliers (
  name           text primary key,
  contact        text,
  email          text,
  phone          text,
  address        text,
  origin         text,
  payment_terms  text,
  incoterm       text,
  lead_time_days integer,
  moq            integer,
  route          text,
  notes          text,
  is_new         boolean default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger t_suppliers_updated before update on public.suppliers for each row execute function public.set_updated_at();

create table public.partners (
  name           text primary key,
  type           partner_type not null,
  contact        text,
  email          text,
  phone          text,
  address        text,
  origin         text,
  payment_terms  text,
  specialty      text,
  notes          text,
  is_new         boolean default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger t_partners_updated before update on public.partners for each row execute function public.set_updated_at();

create table public.contacts (
  id         text primary key,
  company    text not null,                  -- supplier.name | partner.name
  name       text not null,
  role       text,
  wechat     text,
  phone      text,
  email      text,
  is_primary boolean not null default false,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.contacts(company);
create trigger t_contacts_updated before update on public.contacts for each row execute function public.set_updated_at();

-- =====================================================================
-- CATALOG: product families + variants + tech packs
-- =====================================================================
create table public.products (
  id               text primary key,         -- slug e.g. 'semi-swc-18'
  parent           text not null,
  color            text,
  category         text not null,
  brand            text not null default 'Manifest',
  material         text,
  supplier         text references public.suppliers(name) on delete set null,
  supplier_route   text,
  lead_time_days   integer not null default 0,
  moq              integer not null default 0,
  last_ordered     text,
  dims             text,
  dim_cm           jsonb,                     -- {l,w,h}
  weight_lbs       numeric,
  weight_kg        numeric,
  carton_cm        jsonb,
  carton_kg        numeric,
  units_per_carton integer,
  images           jsonb not null default '[]'::jsonb,
  badges           jsonb not null default '[]'::jsonb,
  cost_history     jsonb not null default '[]'::jsonb,
  order_history    jsonb not null default '[]'::jsonb,
  dim_history      jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger t_products_updated before update on public.products for each row execute function public.set_updated_at();

create table public.product_variants (
  id            uuid primary key default gen_random_uuid(),
  family_id     text not null references public.products(id) on delete cascade,
  sku           text not null unique,
  name          text not null,
  pack          text not null default '1-Pack',
  fnsku         text,
  asin          text,
  fba_stock     integer not null default 0,
  inbound       integer not null default 0,
  last_cost_usd numeric,
  last_cost_rmb numeric,
  sale_price    numeric,
  status        variant_status not null default 'Not linked',
  prep          variant_prep not null default 'Labeled',
  has_image     boolean not null default false,
  reorder_point integer,                      -- the one manual inventory field
  velocity      numeric,                      -- amazon-derived units/day (cache)
  unfulfillable integer not null default 0,   -- amazon stranded units (cache)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.product_variants(family_id);
create trigger t_variants_updated before update on public.product_variants for each row execute function public.set_updated_at();

create table public.product_tech_packs (
  id         uuid primary key default gen_random_uuid(),
  family_id  text not null references public.products(id) on delete cascade,
  version    integer not null,
  file_name  text not null,
  file_size  integer,
  asset_ref  text,                            -- supabase storage path
  note       text,
  doc_date   date,
  created_at timestamptz not null default now()
);
create index on public.product_tech_packs(family_id);

-- =====================================================================
-- ORDERS  (units/SKUs live in production; total derives from invoices)
-- =====================================================================
create table public.orders (
  id                   text primary key,      -- 'ORD-2026-05-006'
  title                text not null,
  supplier             text references public.suppliers(name) on delete set null,
  agent                text references public.partners(name) on delete set null,
  route                text,
  placed_on            date,
  fba_eta              date,
  status               order_status not null default 'draft',
  inspection_required  boolean not null default true,
  ship_mode            text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger t_orders_updated before update on public.orders for each row execute function public.set_updated_at();

create table public.order_payment_terms (
  order_id    text primary key references public.orders(id) on delete cascade,
  type        payterm_type not null,
  deposit_pct integer,                        -- TT
  net_days    integer,                         -- OA
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger t_payterms_updated before update on public.order_payment_terms for each row execute function public.set_updated_at();

-- =====================================================================
-- INVOICES / PAYABLES  (COGS source; supplier costs fold into finance live)
-- =====================================================================
create table public.invoices (
  id              text primary key,           -- 'PI-2605-MUTU-001'
  order_id        text references public.orders(id) on delete set null,
  vendor          text not null,              -- supplier.name | partner.name
  vendor_type     vendor_type not null,
  issued          date,
  due             date,
  total           numeric(12,2) not null default 0,
  paid            numeric(12,2) not null default 0,
  currency        text default 'USD',
  fx_rate_locked  numeric,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.invoices(order_id);
create trigger t_invoices_updated before update on public.invoices for each row execute function public.set_updated_at();

create table public.invoice_payments (
  id            text primary key,             -- 'PAY-2605-001'
  invoice_id    text not null references public.invoices(id) on delete cascade,
  amount        numeric(12,2) not null,
  payment_date  date,
  method        text,
  status        payment_status not null default 'Cleared',
  currency      text,
  cadence       jsonb,                         -- transit-tracker stages
  created_at    timestamptz not null default now()
);
create index on public.invoice_payments(invoice_id);

-- =====================================================================
-- LOGISTICS: shipments + fba inbounds + tracking
-- =====================================================================
create table public.shipments (
  id           text primary key,              -- 'SHP-2605-001'
  order_id     text references public.orders(id) on delete set null,
  order_title  text,
  supplier     text references public.suppliers(name) on delete set null,
  mode         text not null,
  forwarder    text references public.partners(name) on delete set null,
  incoterm     text,
  origin       text,
  destination  text,
  etd          date,
  eta          date,
  bol          text,
  stage        shipment_stage not null default 'Draft',
  customs      customs_status,
  cbm          numeric,
  gross_kg     numeric,
  cartons      integer,
  packed       integer not null default 0,
  freight_usd  numeric,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.shipments(order_id);
create trigger t_shipments_updated before update on public.shipments for each row execute function public.set_updated_at();

create table public.fba_inbounds (
  id            text primary key,             -- 'FBA17-WQ4-6B2'
  shipment_id   text references public.shipments(id) on delete set null,
  order_id      text references public.orders(id) on delete set null,
  fc            text not null,                -- fulfillment center
  sku_count     integer not null default 0,
  expected      integer not null default 0,
  received      integer not null default 0,
  amazon_status fba_status not null default 'Working',
  synced        timestamptz,
  mode          text,
  eta           date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.fba_inbounds(shipment_id);
create trigger t_fba_updated before update on public.fba_inbounds for each row execute function public.set_updated_at();

create table public.shipment_tracking (
  shipment_id   text primary key references public.shipments(id) on delete cascade,
  tracking_no   text,
  booking_ref   text,
  carrier       text,
  scac          text,
  stage         shipment_stage,
  last_sync     timestamptz,
  eta_override  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger t_tracking_updated before update on public.shipment_tracking for each row execute function public.set_updated_at();

-- =====================================================================
-- FINANCE: accounts, entries (ledger), bank inbox, rules, recurring
-- =====================================================================
create table public.finance_accounts (
  id         text primary key,                -- 'mercury','cash'
  name       text not null,
  kind       account_kind not null,
  opening    numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger t_finacct_updated before update on public.finance_accounts for each row execute function public.set_updated_at();

create table public.finance_entries (
  id         text primary key,
  entry_date date not null,
  kind       entry_kind not null,
  partner    text,                            -- users.fin_id (draw/contribution)
  amount     numeric(12,2) not null,
  account    text references public.finance_accounts(id) on delete set null,
  source     entry_source not null default 'manual',
  note       text,
  order_id   text references public.orders(id) on delete set null,
  invoice_id text references public.invoices(id) on delete set null,
  locked     boolean not null default false,  -- true for payables-derived
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.finance_entries(entry_date);
create trigger t_finentry_updated before update on public.finance_entries for each row execute function public.set_updated_at();

create table public.bank_transactions (
  id         text primary key,
  txn_date   date not null,
  source     txn_source not null,
  direction  txn_direction not null,
  amount     numeric(12,2) not null,
  account    text references public.finance_accounts(id) on delete set null,
  descr      text,
  reviewed   boolean not null default false,  -- needs_review until confirmed into ledger
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger t_banktxn_updated before update on public.bank_transactions for each row execute function public.set_updated_at();

create table public.categorization_rules (
  id         text primary key,
  match_text text not null,
  kind       entry_kind not null default 'draw',
  partner    text,
  label      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger t_rules_updated before update on public.categorization_rules for each row execute function public.set_updated_at();

create table public.recurring_items (
  id         text primary key,
  name       text not null,
  category   text not null,                   -- free-ish: Salary/VA, Software, ...
  amount     numeric not null,
  cadence    recur_cadence not null default 'monthly',
  start_date date not null,
  match_text text,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger t_recurring_updated before update on public.recurring_items for each row execute function public.set_updated_at();

-- =====================================================================
-- PACKAGING + SUPPLIES (MOQ-leftover ledger)
-- =====================================================================
create table public.packaging_items (
  id            text primary key,
  name          text not null,
  kind          packaging_kind not null default 'Other',
  family_id     text references public.products(id) on delete set null,  -- null = Any
  unit_cost     numeric not null default 0,
  reorder_point integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger t_pkgitems_updated before update on public.packaging_items for each row execute function public.set_updated_at();

create table public.packaging_moves (
  id         text primary key,
  item_id    text not null references public.packaging_items(id) on delete cascade,
  type       pkg_move_type not null,
  qty        integer not null,
  unit_cost  numeric,                         -- receive only
  source     text,                            -- receive only
  order_id   text references public.orders(id) on delete set null,  -- consume only
  note       text,
  move_date  date not null,
  created_at timestamptz not null default now()
);
create index on public.packaging_moves(item_id);

create table public.supplies (
  id          text primary key,
  item        text not null,
  unit_cost   numeric not null,
  qty_ordered integer not null,
  qty_used    integer not null default 0,
  order_id    text references public.orders(id) on delete set null,
  order_title text,
  supply_date date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger t_supplies_updated before update on public.supplies for each row execute function public.set_updated_at();

-- =====================================================================
-- AMAZON CONTRACT (read-through seam; SP-API later) + FX
-- =====================================================================
create table public.amazon_monthly (
  month         text primary key,             -- 'YYYY-MM'
  units         integer not null default 0,
  gross_sales   numeric not null default 0,
  referral_fees numeric not null default 0,
  fba_fees      numeric not null default 0,
  ad_spend      numeric not null default 0,
  refunds       numeric not null default 0,
  net_payout    numeric not null default 0,
  provenance    text not null default 'sample',  -- 'sample' | 'amazon'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger t_amzmonthly_updated before update on public.amazon_monthly for each row execute function public.set_updated_at();

create table public.amazon_product_perf (
  family_id        text primary key references public.products(id) on delete cascade,
  avg_units_month  integer not null default 0,
  sell_price       numeric,
  net_per_unit     numeric,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger t_amzperf_updated before update on public.amazon_product_perf for each row execute function public.set_updated_at();

create table public.fx_rates (
  currency   text primary key,                -- 'USD','CNY','EUR'
  rate       numeric not null,                -- units per 1 USD
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- INTEGRATIONS + WORKSPACE SETTINGS (singletons) + ASSETS
-- =====================================================================
create table public.integrations (
  id          text primary key,               -- amazon, amazonads, mercury, ...
  status      integration_status not null default 'disconnected',
  last_sync   timestamptz,
  note        text,
  oauth_token jsonb,                           -- server-only secrets
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger t_integrations_updated before update on public.integrations for each row execute function public.set_updated_at();

-- single-row settings tables (id = 1 always)
create table public.brand (
  id                integer primary key default 1 check (id = 1),
  name              text,
  tagline           text,
  color             text,
  established        text,
  registry_enrolled boolean default false,
  registry_id       text,
  gtin_exempt       boolean default false,
  tm_number         text,
  tm_status         text,
  tm_jurisdiction   text,
  tm_owner          text,
  website           text,
  store_url         text,
  support_email     text,
  updated_at        timestamptz not null default now()
);
create trigger t_brand_updated before update on public.brand for each row execute function public.set_updated_at();

create table public.business_profile (
  id                  integer primary key default 1 check (id = 1),
  company             text,
  entity_type         text,
  state_of_formation  text,
  ein                 text,
  formation_date      date,
  registered_agent    text,
  email               text,
  phone               text,
  country             text,
  address             text,
  city                text,
  state               text,
  zip                 text,
  duns_number         text,
  website             text,
  updated_at          timestamptz not null default now()
);
create trigger t_business_updated before update on public.business_profile for each row execute function public.set_updated_at();

create table public.notification_prefs (
  id      integer primary key default 1 check (id = 1),
  prefs   jsonb not null default '{}'::jsonb   -- {channelKey: bool}
);

create table public.asset_uploads (
  slot_id    text primary key,                 -- variant sku, brand logo, tech-pack id
  asset_ref  text,                             -- storage path
  mime       text,
  size       integer,
  created_at timestamptz not null default now()
);
