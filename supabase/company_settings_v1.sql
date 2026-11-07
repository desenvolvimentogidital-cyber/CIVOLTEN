-- CIVOLTEN · empresa, precificação e aparência (sem alterar cadastros antigos).
create table if not exists public.cv_company_settings_v1 (
 user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
 company_name text not null default '' check (length(company_name)<=160),
 tax_regime text not null default 'simples'
   check (tax_regime in ('simples','mei','presumido','real','outro')),
 annex text not null default 'nao_definido'
   check (annex in ('nao_definido','I','II','III','IV','V')),
 tax_pct numeric(5,2) not null default 0 check (tax_pct between 0 and 80),
 margin_pct numeric(5,2) not null default 0 check (margin_pct between 0 and 80),
 productive_days smallint not null default 22 check (productive_days between 1 and 31),
 hours_per_day numeric(5,2) not null default 8 check (hours_per_day>0 and hours_per_day<=24),
 productive_people smallint not null default 0 check (productive_people between 0 and 1000),
 theme text not null default 'gold'
   check (theme in ('gold','blue','emerald','violet','coral')),
 reviewed boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint cv_company_prices_valid check (tax_pct+margin_pct<100),
 constraint cv_company_capacity_reviewed check ((not reviewed) or productive_people>=1)
);
alter table public.cv_company_settings_v1 enable row level security;
revoke all on table public.cv_company_settings_v1 from public,anon,authenticated;
grant select,insert,update,delete on table public.cv_company_settings_v1 to authenticated;
create policy "cv_company_select_own" on public.cv_company_settings_v1
 for select to authenticated using(user_id=(select auth.uid()));
create policy "cv_company_insert_own" on public.cv_company_settings_v1
 for insert to authenticated with check(user_id=(select auth.uid()));
create policy "cv_company_update_own" on public.cv_company_settings_v1
 for update to authenticated using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()));
create policy "cv_company_delete_own" on public.cv_company_settings_v1
 for delete to authenticated using(user_id=(select auth.uid()));
