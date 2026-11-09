-- Central de respostas CIVOLTEN: registro de leitura persistente entre dispositivos.
-- Migração aditiva; não altera orçamentos, convites ou decisões dos clientes.
begin;
create table if not exists public.cv_proposal_receipt_reads_v1 (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 invite_id uuid not null references public.cv_proposal_invites_v1(id) on delete restrict,
 seen_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique (user_id,invite_id)
);
create index if not exists cv_proposal_receipt_reads_user_v1 on public.cv_proposal_receipt_reads_v1 (user_id,seen_at desc);
alter table public.cv_proposal_receipt_reads_v1 enable row level security;
drop policy if exists cv_proposal_reads_select_v1 on public.cv_proposal_receipt_reads_v1;
create policy cv_proposal_reads_select_v1 on public.cv_proposal_receipt_reads_v1
 for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists cv_proposal_reads_insert_v1 on public.cv_proposal_receipt_reads_v1;
create policy cv_proposal_reads_insert_v1 on public.cv_proposal_receipt_reads_v1
 for insert to authenticated with check(
  user_id=(select auth.uid())
  and exists(select 1 from public.cv_proposal_invites_v1 p
    where p.id=invite_id and p.user_id=(select auth.uid())
    and p.status in ('accepted','declined'))
 );
revoke all on public.cv_proposal_receipt_reads_v1 from anon,authenticated;
grant select,insert on public.cv_proposal_receipt_reads_v1 to authenticated;
create or replace function public.cv_proposal_mark_read_v1(p_invite_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Faça login para abrir as respostas';end if;
 if not exists (
  select 1 from public.cv_proposal_invites_v1 i where
  i.id=p_invite_id and i.user_id=auth.uid() and i.status in ('accepted','declined')
 ) then
  raise exception 'Resposta não encontrada ou ainda pendente';
 end if;
 insert into public.cv_proposal_receipt_reads_v1 (user_id,invite_id)
 values(auth.uid(),p_invite_id)
 on conflict (user_id,invite_id) do nothing;
 return true;
end $$;
revoke all on function public.cv_proposal_mark_read_v1(uuid) from public,anon;
grant execute on function public.cv_proposal_mark_read_v1(uuid) to authenticated;
commit;