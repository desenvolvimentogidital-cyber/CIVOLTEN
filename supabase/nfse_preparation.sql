-- CIVOLTEN NFS-e | etapa pré-API: apenas clientes e rascunhos, nunca NFS-e autorizada.
-- Banco existente preservado; acesso restrito ao auth.uid() do usuário autenticado.
create table if not exists public.cv_nfse_drafts_v1 (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 payload jsonb not null default '{}'::jsonb,
 status text not null default 'draft' check (status in ('draft','ready')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint cv_nfse_draft_payload_object check (jsonb_typeof(payload)='object'),
 constraint cv_nfse_draft_payload_size check (octet_length(payload::text)<=60000)
);
create index if not exists cv_nfse_drafts_user_updated_idx
 on public.cv_nfse_drafts_v1(user_id,updated_at desc);
alter table public.cv_nfse_drafts_v1 enable row level security;
revoke all on public.cv_nfse_drafts_v1 from public,anon,authenticated;
grant select,insert,update,delete on public.cv_nfse_drafts_v1 to authenticated;
create policy cv_nfse_drafts_select on public.cv_nfse_drafts_v1 for select to authenticated
 using ((select auth.uid())=user_id);
create policy cv_nfse_drafts_insert on public.cv_nfse_drafts_v1 for insert to authenticated
 with check ((select auth.uid())=user_id);
create policy cv_nfse_drafts_update on public.cv_nfse_drafts_v1 for update to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy cv_nfse_drafts_delete on public.cv_nfse_drafts_v1 for delete to authenticated
 using ((select auth.uid())=user_id);

create table if not exists public.cv_nfse_clients_v1 (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 cnpj text not null check (cnpj ~ '^[0-9]{14}$'),
 legal_name text not null check (length(btrim(legal_name)) between 1 and 180),
 email text not null default '',
 address jsonb not null default '{}'::jsonb check (jsonb_typeof(address)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint cv_nfse_client_unique unique (user_id,cnpj)
);
create index if not exists cv_nfse_clients_user_updated_idx
 on public.cv_nfse_clients_v1(user_id,updated_at desc);
alter table public.cv_nfse_clients_v1 enable row level security;
revoke all on public.cv_nfse_clients_v1 from public,anon,authenticated;
grant select,insert,update,delete on public.cv_nfse_clients_v1 to authenticated;
create policy cv_nfse_clients_select on public.cv_nfse_clients_v1 for select to authenticated
 using ((select auth.uid())=user_id);
create policy cv_nfse_clients_insert on public.cv_nfse_clients_v1 for insert to authenticated
 with check ((select auth.uid())=user_id);
create policy cv_nfse_clients_update on public.cv_nfse_clients_v1 for update to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy cv_nfse_clients_delete on public.cv_nfse_clients_v1 for delete to authenticated
 using ((select auth.uid())=user_id);
