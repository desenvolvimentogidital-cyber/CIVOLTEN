-- CIVOLTEN: resposta eletrônica simples, com link exclusivo no PDF.
-- Implantação aditiva: nenhum orçamento/contrato/funcionário existente é alterado.
begin;
create table if not exists public.cv_proposal_invites_v1 (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 budget_id uuid not null references public.cv_budget_drafts_v1(id) on delete restrict,
 token text not null unique check(token ~ '^[0-9a-f]{64}$'),
 budget_snapshot jsonb not null check(jsonb_typeof(budget_snapshot)='object'),
 total_cents bigint not null check(total_cents>0 and total_cents<=99999999999999),
 valid_until date not null,
 status text not null default 'pending'
  check(status in ('pending','accepted','declined','revoked')),
 respondent_name text,
 respondent_email text,
 decline_reason text,
 responded_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,budget_id),
 unique(user_id,id),
 constraint cv_response_consistency_v1 check(
  (status='pending' and responded_at is null and respondent_name is null and respondent_email is null)
  or (status='revoked' and responded_at is null)
  or (status in ('accepted','declined') and responded_at is not null
      and length(trim(respondent_name)) between 3 and 150
      and length(trim(respondent_email)) between 5 and 200))
);
create index if not exists cv_proposal_invites_owner_status_v1
 on public.cv_proposal_invites_v1(user_id,status,created_at desc);
alter table public.cv_proposal_invites_v1 enable row level security;
drop policy if exists cv_proposal_invites_owner_select_v1 on public.cv_proposal_invites_v1;
create policy cv_proposal_invites_owner_select_v1 on public.cv_proposal_invites_v1
 for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists cv_proposal_invites_owner_insert_v1 on public.cv_proposal_invites_v1;
create policy cv_proposal_invites_owner_insert_v1 on public.cv_proposal_invites_v1
 for insert to authenticated with check(user_id=(select auth.uid()));
revoke all on public.cv_proposal_invites_v1 from anon,authenticated;
grant select,insert on public.cv_proposal_invites_v1 to authenticated;

create or replace function public.cv_proposal_invite_guard_v1()
returns trigger language plpgsql set search_path='' as $$
declare b public.cv_budget_drafts_v1%rowtype;
begin
 if tg_op='DELETE' then
  raise exception 'O histórico do convite não pode ser excluído';
 end if;
 if tg_op='UPDATE' then
  if current_setting('civolten.proposal_response',true)<>'confirmed' or
     new.user_id is distinct from old.user_id or
     new.budget_id is distinct from old.budget_id or
     new.token is distinct from old.token or
     new.budget_snapshot is distinct from old.budget_snapshot or
     new.total_cents is distinct from old.total_cents or
     new.valid_until is distinct from old.valid_until or
     new.created_at is distinct from old.created_at or old.status<>'pending' or
     new.status not in ('accepted','declined','revoked') then
    raise exception 'Resposta da proposta não pode ser modificada diretamente';
  end if;
  return new;
 end if;
 if auth.uid() is distinct from new.user_id then
  raise exception 'A proposta deve ser enviada pelo seu responsável autenticado';
 end if;
 select * into b from public.cv_budget_drafts_v1 where id=new.budget_id;
 if b.id is null or b.user_id<>new.user_id or b.demo<>false
    or b.commercial->>'laborOnly'<>'true' then
  raise exception 'Selecione proposta real de mão de obra pertencente à sua conta';
 end if;
 if exists(select 1 from public.cv_work_orders_v1 where budget_id=b.id)
  then raise exception 'Esta proposta já tem uma ordem de serviço';end if;
 if new.status<>'pending' or new.responded_at is not null
   or new.respondent_name is not null or new.respondent_email is not null
   or new.decline_reason is not null then
  raise exception 'A proposta deve iniciar aguardando resposta';
 end if;
 if new.valid_until<current_date or
   (b.expires_on is not null and new.valid_until>b.expires_on) then
  raise exception 'Data de validade expirada ou além da validade do orçamento';
 end if;
 if new.budget_snapshot->'items' is distinct from b.items
   or new.budget_snapshot->'commercial' is distinct from b.commercial
   or new.budget_snapshot->'pricing' is distinct from b.pricing
   or new.budget_snapshot->>'customer' is distinct from b.customer
   or new.budget_snapshot->>'title' is distinct from b.title then
  raise exception 'O link precisa congelar a mesma proposta salva no banco';
 end if;
 return new;
end $$;
drop trigger if exists cv_proposal_invite_guard_trigger_v1 on public.cv_proposal_invites_v1;
create trigger cv_proposal_invite_guard_trigger_v1 before insert or update or delete
 on public.cv_proposal_invites_v1 for each row
 execute function public.cv_proposal_invite_guard_v1();

-- Acesso público limitado: só quem possui o token de 256 bits pode ver os
-- dados comerciais dessa proposta. A tabela não tem política SELECT anônima.
create or replace function public.cv_proposal_lookup_v1(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.cv_proposal_invites_v1%rowtype;
declare b jsonb;
begin
 if p_token is null or length(p_token)<>64 or p_token !~ '^[0-9a-f]{64}$' then
  return jsonb_build_object('available',false);
 end if;
 select * into i from public.cv_proposal_invites_v1 where token=p_token;
 if i.id is null or i.status='revoked' then
  return jsonb_build_object('available',false);
 end if;
 b=i.budget_snapshot;
 return jsonb_build_object('available',true,'status',
    case when i.status='pending' and current_date>i.valid_until then 'expired' else i.status end,
  'reference','PC-'||left(i.budget_id::text,8),
  'title',b->>'title','customer',b->>'customer',
  'project',b->>'project','location',b->>'location',
  'totalCents',i.total_cents,'validUntil',i.valid_until,
  'companyName',b->'pricing'->>'companyName',
  'paymentTerms',b->'commercial'->>'paymentTerms',
  'executionTerm',b->'commercial'->>'executionTerm',
  'warrantyTerms',b->'commercial'->>'warrantyTerms',
  'scopeNotes',b->'commercial'->>'scopeNotes',
  'laborOnly',true,
  'services',(select coalesce(jsonb_agg(jsonb_build_object(
   'description',x->>'description','unit',x->>'unit',
   'quantity',x->>'quantity')),'[]'::jsonb)
    from jsonb_array_elements(b->'items') x),
  'respondedAt',i.responded_at);
end $$;
revoke all on function public.cv_proposal_lookup_v1(text) from public;
grant execute on function public.cv_proposal_lookup_v1(text) to anon,authenticated;

create or replace function public.cv_proposal_respond_v1(
 p_token text,p_decision text,p_name text,p_email text,p_reason text,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.cv_proposal_invites_v1%rowtype;
declare clean_name text;clean_email text;clean_reason text;
begin
 if p_token is null or length(p_token)<>64 or p_token !~ '^[0-9a-f]{64}$' then
  raise exception 'Link inválido';
 end if;
 if p_decision not in ('accepted','declined') or p_confirmed is distinct from true then
  raise exception 'Escolha aceitar ou recusar e confirme sua decisão';
 end if;
 clean_name=trim(coalesce(p_name,''));
 clean_email=lower(trim(coalesce(p_email,'')));
 clean_reason=trim(coalesce(p_reason,''));
 if length(clean_name) not between 3 and 150 or
    length(clean_email) not between 5 and 200 or
    clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or
    length(clean_reason)>800 then
  raise exception 'Informe nome e e-mail válidos e mensagem com até 800 caracteres';
 end if;
 select * into i from public.cv_proposal_invites_v1 where token=p_token for update;
 if i.id is null or i.status='revoked' then raise exception 'Link indisponível';end if;
 if i.status in ('accepted','declined') then
  raise exception 'Esta proposta já possui uma resposta definitiva';
 end if;
 if i.valid_until<current_date then raise exception 'O prazo de resposta expirou';end if;
 -- Não permitir atualização direta via RLS; esta função é o único caminho público.
 -- O gatilho ignora UPDATE somente nesta transação quando o contexto foi
 -- configurado pela própria função, não por alegação do navegador.
 perform set_config('civolten.proposal_response','confirmed',true);
 update public.cv_proposal_invites_v1
 set status=p_decision,respondent_name=clean_name,respondent_email=clean_email,
  decline_reason=case when p_decision='declined' then clean_reason else null end,
  responded_at=now(),updated_at=now()
 where id=i.id and status='pending';
 perform set_config('civolten.proposal_response','',true);
 return jsonb_build_object('ok',true,'status',p_decision);
end $$;
revoke all on function public.cv_proposal_respond_v1(text,text,text,text,text,boolean) from public;
grant execute on function public.cv_proposal_respond_v1(text,text,text,text,text,boolean)
 to anon,authenticated;

-- A revogação é exclusiva do proprietário autenticado.
create or replace function public.cv_proposal_revoke_v1(p_budget_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare i public.cv_proposal_invites_v1%rowtype;
begin
 if auth.uid() is null then raise exception 'Faça login na CIVOLTEN';end if;
 select * into i from public.cv_proposal_invites_v1
  where budget_id=p_budget_id and user_id=auth.uid() for update;
 if i.id is null then raise exception 'Convite não encontrado';end if;
 if i.status<>'pending' then raise exception 'Somente convites ainda sem resposta podem ser revogados';end if;
 perform set_config('civolten.proposal_response','confirmed',true);
 update public.cv_proposal_invites_v1 set status='revoked',updated_at=now() where id=i.id;
 perform set_config('civolten.proposal_response','',true);
 return true;
end $$;
revoke all on function public.cv_proposal_revoke_v1(uuid) from public,anon;
grant execute on function public.cv_proposal_revoke_v1(uuid) to authenticated;

-- Guardar o orçamento enviado: ninguém pode modificar valores ou condições
-- enquanto o link existe. A nova proposta deve nascer de "Duplicar".
create or replace function public.cv_protect_accepted_budget_v1()
returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from public.cv_work_orders_v1 w where w.budget_id=old.id)
    and not exists(select 1 from public.cv_proposal_invites_v1 i where i.budget_id=old.id) then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if tg_op='DELETE' then raise exception 'Proposta enviada ou aprovada não pode ser excluída';end if;
 if new.title is distinct from old.title or new.customer is distinct from old.customer
  or new.project is distinct from old.project or new.location is distinct from old.location
  or new.notes is distinct from old.notes or new.expires_on is distinct from old.expires_on
  or new.items is distinct from old.items or new.pricing is distinct from old.pricing
  or new.commercial is distinct from old.commercial or new.demo is distinct from old.demo then
  raise exception 'Proposta enviada é imutável. Use Duplicar para uma nova versão';
 end if;
 return new;
end $$;
create or replace function public.cv_require_customer_response_v1()
returns trigger language plpgsql set search_path='' as $$
declare i public.cv_proposal_invites_v1%rowtype;
begin
 select * into i from public.cv_proposal_invites_v1 where budget_id=new.budget_id;
 if i.id is null then return new;end if;
 if i.status<>'accepted' then
  raise exception 'Aguarde o aceite do cliente ou faça uma nova proposta';
 end if;
 if new.acceptance_ref not like '%'||i.id::text||'%'
    or new.contract_value*100<>i.total_cents then
  raise exception 'A ordem de serviço deve preservar o aceite e valor da proposta respondida';
 end if;
 return new;
end $$;
drop trigger if exists cv_require_customer_response_trigger_v1 on public.cv_work_orders_v1;
create trigger cv_require_customer_response_trigger_v1
before insert on public.cv_work_orders_v1
for each row execute function public.cv_require_customer_response_v1();

commit;
