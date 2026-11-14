-- CIVOLTEN: exclusão definitiva do orçamento com confirmação na UI.
-- Conserva integralmente convites, respostas, OS, medições e financeiro.
-- FKs dos históricos apontam NULL após exclusão; snapshots guardam o ID original.
-- Um convite pendente é revogado atomicamente antes da remoção do orçamento.
-- RLS do orçamento continua restringindo DELETE ao seu proprietário.
create schema if not exists civolten_internal;
revoke all on schema civolten_internal from public, anon, authenticated;

create or replace function civolten_internal.cv_prepare_budget_delete_v1()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if (select auth.uid()) is distinct from old.user_id then
    raise exception 'Somente o proprietário pode excluir este orçamento';
  end if;
  perform pg_catalog.set_config('civolten.removing_budget', old.id::text, true);
  -- A política existente permite somente mudanças de resposta controladas.
  perform pg_catalog.set_config('civolten.proposal_response', 'confirmed', true);
  update public.cv_proposal_invites_v1
     set status='revoked'
   where budget_id=old.id and user_id=old.user_id and status='pending';
  return old;
end
$fn$;
revoke all on function civolten_internal.cv_prepare_budget_delete_v1()
 from public, anon, authenticated;

drop trigger if exists aa_cv_prepare_budget_delete_trigger_v1 on public.cv_budget_drafts_v1;
create trigger aa_cv_prepare_budget_delete_trigger_v1
 before delete on public.cv_budget_drafts_v1
 for each row execute function civolten_internal.cv_prepare_budget_delete_v1();

-- Mantém a imutabilidade de proposta enviada. Apenas DELETE próprio é liberado.
create or replace function public.cv_protect_accepted_budget_v1()
returns trigger language plpgsql set search_path = 'public' as $fn$
begin
 if tg_op='DELETE' then
   if (select auth.uid()) is distinct from old.user_id then
     raise exception 'Orçamento não pertence à sua conta';
   end if;
   return old;
 end if;
 if not exists(select 1 from public.cv_work_orders_v1 w where w.budget_id=old.id)
    and not exists(select 1 from public.cv_proposal_invites_v1 i where i.budget_id=old.id)
 then return new; end if;
 if new.title is distinct from old.title or new.customer is distinct from old.customer
  or new.project is distinct from old.project or new.location is distinct from old.location
  or new.notes is distinct from old.notes or new.expires_on is distinct from old.expires_on
  or new.items is distinct from old.items or new.pricing is distinct from old.pricing
  or new.commercial is distinct from old.commercial or new.demo is distinct from old.demo then
    raise exception 'Proposta enviada é imutável. Use Duplicar para uma nova versão';
 end if;
 return new;
end
$fn$;

-- Preserva a proteção contra alterações ao aceite.
-- Exceção estrita: a FK fica NULL quando o orçamento acaba de ser excluído.
create or replace function public.cv_proposal_invite_guard_v1()
returns trigger language plpgsql set search_path to '' as $fn$
declare b public.cv_budget_drafts_v1%rowtype;
begin
 if tg_op='DELETE' then
   raise exception 'O histórico do convite não pode ser excluído';
 end if;
 if tg_op='UPDATE' then
   if old.budget_id is not null and new.budget_id is null
      and pg_catalog.current_setting('civolten.removing_budget',true)=old.budget_id::text
      and (pg_catalog.to_jsonb(new) - 'budget_id') =
          (pg_catalog.to_jsonb(old) - 'budget_id')
   then return new; end if;
   if pg_catalog.current_setting('civolten.proposal_response',true)<>'confirmed' or
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
 if (select auth.uid()) is distinct from new.user_id then
   raise exception 'A proposta deve ser enviada pelo seu responsável autenticado';
 end if;
 select * into b from public.cv_budget_drafts_v1 where id=new.budget_id;
 if b.id is null or b.user_id<>new.user_id or b.demo<>false
    or b.commercial->>'laborOnly'<>'true' then
   raise exception 'Selecione proposta real de mão de obra pertencente à sua conta';
 end if;
 if exists(select 1 from public.cv_work_orders_v1 where budget_id=b.id) then
   raise exception 'Esta proposta já tem uma ordem de serviço';
 end if;
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
end
$fn$;

-- A OS também conserva seu snapshot imutável e os lançamentos existentes.
-- A referência física FK pode ficar NULL somente na exclusão do pai.
create or replace function public.cv_work_order_guard_v1()
returns trigger language plpgsql set search_path to 'public' as $fn$
declare owner uuid;
original public.cv_budget_drafts_v1%rowtype;
priced_total numeric;
begin
 if tg_op='UPDATE' and old.budget_id is not null and new.budget_id is null
    and pg_catalog.current_setting('civolten.removing_budget',true)=old.budget_id::text
    and (pg_catalog.to_jsonb(new) - 'budget_id') =
        (pg_catalog.to_jsonb(old) - 'budget_id') then
   return new;
 end if;
 if tg_op='INSERT' then
   select * into original from public.cv_budget_drafts_v1 b where b.id=new.budget_id;
   owner=original.user_id;
   if owner is distinct from new.user_id then
     raise exception 'Orcamento nao pertence a esta conta';
   end if;
   if new.status<>'approved' then
     raise exception 'Ordem de servico inicia com aceite aprovado';
   end if;
   if original.demo<>false or original.commercial->>'laborOnly'<>'true' then
     raise exception 'Contrato exige proposta comercial exclusiva de mao de obra';
   end if;
   if new.budget_snapshot->'items' is distinct from original.items or
      new.budget_snapshot->'pricing' is distinct from original.pricing or
      new.budget_snapshot->'commercial' is distinct from original.commercial then
     raise exception 'Contrato deve congelar exatamente a proposta aceita';
   end if;
   select coalesce(sum((r->>'selling')::numeric),0) into priced_total
      from pg_catalog.jsonb_array_elements(new.priced_rows) r;
   if priced_total<>new.contract_value*100 or priced_total<=0 then
     raise exception 'O valor do contrato nao fecha com o preco congelado';
   end if;
 end if;
 if tg_op='UPDATE' then
   if new.user_id is distinct from old.user_id or
      new.budget_id is distinct from old.budget_id or
      new.budget_snapshot is distinct from old.budget_snapshot or
      new.priced_rows is distinct from old.priced_rows or
      new.contract_value is distinct from old.contract_value or
      new.approved_on is distinct from old.approved_on or
      new.acceptance_ref is distinct from old.acceptance_ref or
      new.contract_ref is distinct from old.contract_ref or
      new.customer is distinct from old.customer or
      new.project is distinct from old.project then
       raise exception 'Contrato aprovado e valores congelados; abra aditivo para alterar';
   end if;
   if new.budget_id is not null then
     select * into original from public.cv_budget_drafts_v1 b where b.id=new.budget_id;
     if original.user_id is distinct from new.user_id then
       raise exception 'Contrato não pertence à conta do orçamento';
     end if;
   elsif (select auth.uid()) is distinct from new.user_id then
     raise exception 'Contrato não pertence à sua conta';
   end if;
   if new.status<>old.status and not (
     (old.status='approved' and new.status in ('in_progress','cancelled')) or
     (old.status='in_progress' and new.status='completed')
   ) then raise exception 'Transicao de estado invalida'; end if;
   if new.status='completed' and old.status<>'completed' then
     if not exists(select 1 from public.cv_work_logs_v1 l
        where l.work_order_id=new.id and l.user_id=new.user_id) then
       raise exception 'Registre horas executadas antes de concluir obra';
     end if;
     if exists(select 1 from pg_catalog.jsonb_array_elements(new.budget_snapshot->'items') i
       where coalesce((select sum(m.quantity) from public.cv_measurements_v1 m
           where m.work_order_id=new.id and m.item_id=i->>'id' and m.status='approved'),0)
          < (i->>'quantity')::numeric
     ) then raise exception 'Aprove as medicoes de todos os servicos antes de concluir'; end if;
     new.finish_on=coalesce(new.finish_on,current_date);
   end if;
 end if;
 new.updated_at=now();return new;
end
$fn$;

-- O histórico sobrevive, mas não existe FK para um orçamento apagado.
alter table public.cv_proposal_invites_v1
  alter column budget_id drop not null;
alter table public.cv_work_orders_v1
  alter column budget_id drop not null;

alter table public.cv_proposal_invites_v1
  drop constraint cv_proposal_invites_v1_budget_id_fkey;
alter table public.cv_proposal_invites_v1
  add constraint cv_proposal_invites_v1_budget_id_fkey
  foreign key (budget_id) references public.cv_budget_drafts_v1(id)
  on delete set null;

alter table public.cv_work_orders_v1
  drop constraint cv_work_orders_v1_budget_id_fkey;
alter table public.cv_work_orders_v1
  add constraint cv_work_orders_v1_budget_id_fkey
  foreign key (budget_id) references public.cv_budget_drafts_v1(id)
  on delete set null;
