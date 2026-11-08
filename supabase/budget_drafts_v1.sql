-- CIVOLTEN · fase de homologação de orçamentos com serviços fictícios.
-- A migração só cria a nova tabela. Não importa SINAPI/SIURB, não altera dados antigos.
create table if not exists public.cv_budget_drafts_v1 (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 title text not null check(length(btrim(title)) between 1 and 180),
 customer text not null check(length(btrim(customer)) between 1 and 180),
 project text not null default '' check(length(project)<=180),
 location text not null default '' check(length(location)<=240),
 expires_on date,
 notes text not null default '' check(length(notes)<=1500),
 items jsonb not null default '[]'::jsonb
  check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=100),
 pricing jsonb
  check(pricing is null or jsonb_typeof(pricing)='object'),
 status text not null default 'draft' check(status='draft'),
 demo boolean not null default true check(demo=true),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists cv_budget_drafts_user_created_idx
 on public.cv_budget_drafts_v1(user_id,created_at desc);
alter table public.cv_budget_drafts_v1 enable row level security;
revoke all on table public.cv_budget_drafts_v1 from public,anon,authenticated;
grant select,insert,update,delete on table public.cv_budget_drafts_v1 to authenticated;
create policy "cv_budget_read_own" on public.cv_budget_drafts_v1
 for select to authenticated using(user_id=(select auth.uid()));
create policy "cv_budget_insert_own" on public.cv_budget_drafts_v1
 for insert to authenticated with check(user_id=(select auth.uid()));
create policy "cv_budget_update_own" on public.cv_budget_drafts_v1
 for update to authenticated using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()));
create policy "cv_budget_delete_own" on public.cv_budget_drafts_v1
 for delete to authenticated using(user_id=(select auth.uid()));
