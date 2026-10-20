-- Migration already applied to CIVOLTEN Supabase on 2026-10-20.
-- Historical record: 20261020182834_civolten_custos_reais_v1_20261020
-- Do not re-run manually in the active project.
create schema if not exists cv_private;
create or replace function cv_private.is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid())
    and a.enabled is true and a.role = 'admin'
 );
$$;
revoke all on function cv_private.is_admin() from public, anon, authenticated;
grant usage on schema cv_private to authenticated;
grant execute on function cv_private.is_admin() to authenticated;

create table if not exists public.cv_settings (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique default auth.uid() references auth.users(id),
 workdays_month integer not null default 22 check (workdays_month between 1 and 31),
 billable_days_month numeric(10,2) not null default 22 check (billable_days_month > 0 and billable_days_month <= 1000),
 tax_pct numeric(6,2) not null default 0 check (tax_pct between 0 and 99),
 margin_pct numeric(6,2) not null default 0 check (margin_pct between 0 and 99),
 updated_at timestamptz not null default now(),
 check (tax_pct + margin_pct < 100)
);
create table if not exists public.cv_workers (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id),
 name text not null check (char_length(trim(name)) between 1 and 120),
 profession text not null check (char_length(trim(profession)) between 1 and 100),
 daily_cents bigint not null default 0 check (daily_cents between 0 and 100000000000),
 charges_pct numeric(6,2) not null default 0 check (charges_pct between 0 and 200),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.cv_fixed_costs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id),
 name text not null check (char_length(trim(name)) between 1 and 120),
 category text not null default 'Operação' check (char_length(category) <= 100),
 monthly_cents bigint not null default 0 check (monthly_cents between 0 and 100000000000),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.cv_variable_costs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id),
 name text not null check (char_length(trim(name)) between 1 and 120),
 category text not null default 'Diversos' check (char_length(category) <= 100),
 unit text not null default 'un' check (char_length(unit) <= 30),
 unit_cents bigint not null default 0 check (unit_cents between 0 and 100000000000),
 created_at timestamptz not null default now()
);
create table if not exists public.cv_budgets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id),
 title text not null check (char_length(trim(title)) between 1 and 150),
 customer text not null default '' check (char_length(customer) <= 150),
 status text not null default 'rascunho' check (status in ('rascunho','enviado','aprovado','recusado')),
 content jsonb not null default '{}'::jsonb check (jsonb_typeof(content)='object' and octet_length(content::text) <= 70000),
 cost_cents bigint not null default 0 check (cost_cents >= 0),
 price_cents bigint not null default 0 check (price_cents >= 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists cv_workers_by_owner on public.cv_workers(owner_id);
create index if not exists cv_fixed_by_owner on public.cv_fixed_costs(owner_id);
create index if not exists cv_variable_by_owner on public.cv_variable_costs(owner_id);
create index if not exists cv_budgets_by_owner on public.cv_budgets(owner_id, created_at desc);
do $$
declare t text;
begin
 foreach t in array array['cv_settings','cv_workers','cv_fixed_costs','cv_variable_costs','cv_budgets'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon, authenticated',t);
  execute format('grant select, insert, update, delete on table public.%I to authenticated',t);
  execute format('create policy %I on public.%I for select to authenticated using (owner_id = (select auth.uid()) and (select cv_private.is_admin()))','cv_'||t||'_select',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (owner_id = (select auth.uid()) and (select cv_private.is_admin()))','cv_'||t||'_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using (owner_id = (select auth.uid()) and (select cv_private.is_admin())) with check (owner_id = (select auth.uid()) and (select cv_private.is_admin()))','cv_'||t||'_update',t);
  execute format('create policy %I on public.%I for delete to authenticated using (owner_id = (select auth.uid()) and (select cv_private.is_admin()))','cv_'||t||'_delete',t);
 end loop;
end $$;
