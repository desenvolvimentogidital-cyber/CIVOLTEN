-- Livro de caixa: apenas movimentos efetivamente registrados pelo administrador.
-- Nao considera propostas aprovadas como recebimentos e nao cria lançamentos automaticamente.
create table if not exists public.cv_cash_entries (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check (kind in ('entrada','saida')),
 amount_cents bigint not null check (amount_cents between 1 and 100000000000),
 description text not null check (char_length(btrim(description)) between 2 and 140),
 category text not null default 'Geral' check (char_length(btrim(category)) between 1 and 80),
 occurred_on date not null default current_date,
 budget_id uuid references public.cv_budgets(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists cv_cash_by_owner_date on public.cv_cash_entries(owner_id,occurred_on desc,created_at desc);
alter table public.cv_cash_entries enable row level security;
revoke all on public.cv_cash_entries from anon,authenticated;
grant select,insert,update,delete on public.cv_cash_entries to authenticated;
create policy cv_cash_entries_select on public.cv_cash_entries for select to authenticated
 using (owner_id=(select auth.uid()) and (select cv_private.is_admin()));
create policy cv_cash_entries_insert on public.cv_cash_entries for insert to authenticated
 with check (owner_id=(select auth.uid()) and (select cv_private.is_admin())
 and (budget_id is null or exists (
  select 1 from public.cv_budgets b where b.id=budget_id and b.owner_id=(select auth.uid())
 )));
create policy cv_cash_entries_update on public.cv_cash_entries for update to authenticated
 using (owner_id=(select auth.uid()) and (select cv_private.is_admin()))
 with check (owner_id=(select auth.uid()) and (select cv_private.is_admin())
 and (budget_id is null or exists (
  select 1 from public.cv_budgets b where b.id=budget_id and b.owner_id=(select auth.uid())
 )));
create policy cv_cash_entries_delete on public.cv_cash_entries for delete to authenticated
 using (owner_id=(select auth.uid()) and (select cv_private.is_admin()));
