-- CIVOLTEN financeiro v2: lançamento gerencial independente das previsões.
-- Não altera tabelas/cadastros existentes. Não emite nota fiscal eletrônica.
create table if not exists public.cv_financial_entries_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('income','expense')),
  title text not null check (length(btrim(title)) between 1 and 180),
  party text not null default '' check (length(party) <= 180),
  project text not null default '' check (length(project) <= 180),
  category text not null default '' check (length(category) <= 180),
  amount numeric(14,2) not null check (amount > 0),
  due_date date not null,
  paid_date date,
  reference text not null default '' check (length(reference) <= 80),
  notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cv_financial_entries_v1_user_due_idx
 on public.cv_financial_entries_v1(user_id,due_date desc);
create index if not exists cv_financial_entries_v1_user_paid_idx
 on public.cv_financial_entries_v1(user_id,paid_date desc);
alter table public.cv_financial_entries_v1 enable row level security;
revoke all on table public.cv_financial_entries_v1 from public, anon, authenticated;
grant select,insert,update,delete on table public.cv_financial_entries_v1 to authenticated;
create policy "cv_fin_read_own" on public.cv_financial_entries_v1
 for select to authenticated using (user_id=(select auth.uid()));
create policy "cv_fin_insert_own" on public.cv_financial_entries_v1
 for insert to authenticated with check (user_id=(select auth.uid()));
create policy "cv_fin_update_own" on public.cv_financial_entries_v1
 for update to authenticated
 using (user_id=(select auth.uid()))
 with check (user_id=(select auth.uid()));
create policy "cv_fin_delete_own" on public.cv_financial_entries_v1
 for delete to authenticated using (user_id=(select auth.uid()));
