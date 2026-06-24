-- =====================================================================
-- Auth + RLS (Phase 0)  — Decision #1
--   Simo   = Owner  -> full read + write on everything
--   Youness= Partner-> VIEW ONLY, and only the sections Simo grants.
--   Per-section visibility lives in public.users.section_perms (jsonb
--   map { section: true }). Finance is hidden unless explicitly granted.
-- Server code uses the service role (bypasses RLS) for syncs/derived calc.
-- =====================================================================

alter table public.users
  add column if not exists section_perms jsonb not null default '{}'::jsonb;

-- ---- helper functions (security definer so they can read public.users) ----
create or replace function public.app_role()
returns team_role language sql stable security definer set search_path = public as $$
  select role from public.users where auth_uid = auth.uid() limit 1;
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where auth_uid = auth.uid() and (is_owner = true or role = 'Owner')
  );
$$;

-- can the current user view a given app section?
create or replace function public.can_view(section text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.is_owner() then true
    else coalesce(
      (select (section_perms ->> section)::boolean
         from public.users where auth_uid = auth.uid() limit 1),
      false)
  end;
$$;

-- ---- auto-link an auth user to its public.users row on signup ----
-- Matches by email. First user / known owner email becomes Owner.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.users
     set auth_uid = new.id
   where lower(email) = lower(new.email) and auth_uid is null;
  if not found then
    insert into public.users (id, name, email, role, auth_uid, is_owner)
    values (
      new.id::text,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
      new.email,
      'Viewer',
      new.id,
      false
    );
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- =====================================================================
-- Enable RLS + policies. Pattern per table:
--   owner_all : owners do anything
--   sect_view : authenticated users may SELECT when can_view('<section>')
-- Reference data (fx_rates, asset_uploads) is viewable by any signed-in user.
-- =====================================================================
do $$
declare
  r record;
  -- table -> section map
  sect jsonb := jsonb_build_object(
    'orders','orders', 'order_payment_terms','orders',
    'products','catalog', 'product_variants','catalog', 'product_tech_packs','catalog',
    'packaging_items','packaging', 'packaging_moves','packaging', 'supplies','packaging',
    'suppliers','suppliers', 'contacts','suppliers',
    'partners','partners',
    'shipments','shipments', 'fba_inbounds','shipments', 'shipment_tracking','shipments',
    'invoices','finance', 'invoice_payments','finance',
    'finance_accounts','finance', 'finance_entries','finance',
    'bank_transactions','finance', 'categorization_rules','finance',
    'recurring_items','finance', 'amazon_monthly','finance',
    'amazon_product_perf','performance',
    'integrations','settings', 'brand','settings', 'business_profile','settings',
    'notification_prefs','settings', 'users','settings'
  );
  section text;
begin
  for r in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);

    -- owners: full access
    execute format($f$
      create policy owner_all on public.%I
        for all to authenticated
        using (public.is_owner()) with check (public.is_owner());
    $f$, r.tablename);

    section := sect ->> r.tablename;
    if section is not null then
      -- non-owners: read only when the section is granted
      execute format($f$
        create policy sect_view on public.%I
          for select to authenticated
          using (public.can_view(%L));
      $f$, r.tablename, section);
    else
      -- reference tables (fx_rates, asset_uploads): any signed-in user may read
      execute format($f$
        create policy ref_view on public.%I
          for select to authenticated using (true);
      $f$, r.tablename);
    end if;
  end loop;
end $$;
