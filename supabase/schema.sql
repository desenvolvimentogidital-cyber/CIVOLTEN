-- CIVOLTEN premium: schema v1 isolado dos projetos anteriores.
-- As tabelas públicas do orçamento legado permanecem intactas.
-- Sem dados fictícios e sem usuários criados pela migração.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.cv_fixed_costs_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (length(btrim(name)) between 1 and 180),
  category text not null default '',
  amount numeric(14,2) not null check (amount >= 0),
  frequency text not null default 'monthly' check (frequency in ('monthly','annual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cv_fixed_costs_v1_user_id_idx on public.cv_fixed_costs_v1(user_id);
alter table public.cv_fixed_costs_v1 enable row level security;
revoke all on table public.cv_fixed_costs_v1 from public, anon, authenticated;
grant select,insert,update,delete on table public.cv_fixed_costs_v1 to authenticated;
create policy "cv1_read_own" on public.cv_fixed_costs_v1 for select to authenticated
 using (user_id = (select auth.uid()));
create policy "cv1_insert_own" on public.cv_fixed_costs_v1 for insert to authenticated
 with check (user_id = (select auth.uid()));
create policy "cv1_update_own" on public.cv_fixed_costs_v1 for update to authenticated
 using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()));
create policy "cv1_delete_own" on public.cv_fixed_costs_v1 for delete to authenticated
 using (user_id = (select auth.uid()));

create table if not exists public.cv_variable_costs_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (length(btrim(name)) between 1 and 180),
  category text not null default '',
  unit text not null default 'un',
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  month_qty numeric(14,4) check (month_qty is null or month_qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cv_variable_costs_v1_user_id_idx on public.cv_variable_costs_v1(user_id);
alter table public.cv_variable_costs_v1 enable row level security;
revoke all on table public.cv_variable_costs_v1 from public, anon, authenticated;
grant select,insert,update,delete on table public.cv_variable_costs_v1 to authenticated;
create policy "cv1_read_own" on public.cv_variable_costs_v1 for select to authenticated
 using (user_id = (select auth.uid()));
create policy "cv1_insert_own" on public.cv_variable_costs_v1 for insert to authenticated
 with check (user_id = (select auth.uid()));
create policy "cv1_update_own" on public.cv_variable_costs_v1 for update to authenticated
 using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()));
create policy "cv1_delete_own" on public.cv_variable_costs_v1 for delete to authenticated
 using (user_id = (select auth.uid()));

create table if not exists public.cv_employees_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (length(btrim(name)) between 1 and 180),
  role text not null,
  contract_type text not null check (contract_type in ('clt','contractor')),
  active boolean not null default true,
  salary numeric(14,2) check (salary is null or salary >= 0),
  hours numeric(12,3) check (hours is null or hours > 0),
  fgts_pct numeric(5,2) check (fgts_pct is null or fgts_pct between 0 and 100),
  employer_pct numeric(5,2) check (employer_pct is null or employer_pct between 0 and 100),
  benefits numeric(14,2) not null default 0 check (benefits >= 0),
  extras numeric(14,2) not null default 0 check (extras >= 0),
  rate numeric(14,2) check (rate is null or rate >= 0),
  rate_unit text check (rate_unit is null or rate_unit in ('hour','day','month')),
  quantity numeric(14,4) check (quantity is null or quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cv_employees_v1_user_id_idx on public.cv_employees_v1(user_id);
alter table public.cv_employees_v1 enable row level security;
revoke all on table public.cv_employees_v1 from public, anon, authenticated;
grant select,insert,update,delete on table public.cv_employees_v1 to authenticated;
create policy "cv1_read_own" on public.cv_employees_v1 for select to authenticated
 using (user_id = (select auth.uid()));
create policy "cv1_insert_own" on public.cv_employees_v1 for insert to authenticated
 with check (user_id = (select auth.uid()));
create policy "cv1_update_own" on public.cv_employees_v1 for update to authenticated
 using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()));
create policy "cv1_delete_own" on public.cv_employees_v1 for delete to authenticated
 using (user_id = (select auth.uid()));
