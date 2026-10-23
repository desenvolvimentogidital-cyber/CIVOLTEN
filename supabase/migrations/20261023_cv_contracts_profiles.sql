-- Contratos de prestação de serviços: dados financeiros isolados por proprietário.
-- Perfil reutilizável da conta e contratos com retrato imutável das partes em cada documento salvo.
create table if not exists public.cv_contract_profiles (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 company_name text not null default 'CIVOLTEN — Construção & Elétrica',
 company_document text not null default '',
 company_address text not null default '',
 company_representative text not null default '',
 company_phone text not null default '',
 company_email text not null default '',
 city text not null default '',
 updated_at timestamptz not null default now(),
 constraint cv_contract_profiles_owner_unique unique(owner_id)
);
create table if not exists public.cv_contracts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 budget_id uuid references public.cv_budgets(id) on delete set null,
 title text not null check(char_length(btrim(title)) between 3 and 180),
 counterparty text not null default '',
 status text not null default 'rascunho' check(status in ('rascunho','emitido','assinado','cancelado')),
 content jsonb not null default '{}'::jsonb check(jsonb_typeof(content)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists cv_contracts_by_owner_created on public.cv_contracts(owner_id,created_at desc,id desc);
alter table public.cv_contract_profiles enable row level security;
alter table public.cv_contracts enable row level security;
revoke all on public.cv_contract_profiles,public.cv_contracts from anon,authenticated;
grant select,insert,update,delete on public.cv_contract_profiles,public.cv_contracts to authenticated;
create policy cv_contract_profiles_select on public.cv_contract_profiles for select to authenticated using (owner_id=(select auth.uid()));
create policy cv_contract_profiles_insert on public.cv_contract_profiles for insert to authenticated with check (owner_id=(select auth.uid()));
create policy cv_contract_profiles_update on public.cv_contract_profiles for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy cv_contract_profiles_delete on public.cv_contract_profiles for delete to authenticated using (owner_id=(select auth.uid()));
create policy cv_contracts_select on public.cv_contracts for select to authenticated using (owner_id=(select auth.uid()));
create policy cv_contracts_delete on public.cv_contracts for delete to authenticated using (owner_id=(select auth.uid()));
create policy cv_contracts_insert on public.cv_contracts for insert to authenticated
 with check (owner_id=(select auth.uid()) and (budget_id is null or exists(
  select 1 from public.cv_budgets b where b.id=cv_contracts.budget_id and b.owner_id=(select auth.uid())
 )));
create policy cv_contracts_update on public.cv_contracts for update to authenticated
 using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()) and
 (budget_id is null or exists(
  select 1 from public.cv_budgets b where b.id=cv_contracts.budget_id and b.owner_id=(select auth.uid())
 )));
