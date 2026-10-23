-- Proteção do histórico contratual: um contrato emitido não pode ser reescrito.
-- ALTERAÇÃO APÓS EMISSÃO: gere novo rascunho em vez de sobrescrever a versão anterior.
create or replace function public.cv_contracts_lifecycle_guard()
returns trigger language plpgsql set search_path = public as $$
declare original_status text;
begin
 if tg_op = 'DELETE' then
  if old.status <> 'rascunho' then
   raise exception 'Contratos emitidos e finalizados devem ser preservados no histórico.' using errcode='23514';
  end if;
  return old;
 end if;
 if tg_op = 'INSERT' then
  if new.status <> 'rascunho' then
   raise exception 'Novo contrato deve iniciar como rascunho.' using errcode='23514';
  end if;
 end if;
 if tg_op = 'UPDATE' then
  if old.status in ('assinado','cancelado') then
   raise exception 'Contrato finalizado não pode ser editado.' using errcode='23514';
  end if;
  if old.status = 'emitido' then
   if new.status not in ('emitido','assinado','cancelado') then
    raise exception 'Transição de contrato emitido não permitida.' using errcode='23514';
   end if;
   if new.title is distinct from old.title or new.counterparty is distinct from old.counterparty
    or new.content is distinct from old.content or new.budget_id is distinct from old.budget_id
    or new.owner_id is distinct from old.owner_id then
    raise exception 'Contrato emitido não pode ter conteúdo alterado. Crie nova revisão.' using errcode='23514';
   end if;
  elsif old.status='rascunho' and new.status not in ('rascunho','emitido','cancelado') then
   raise exception 'Emita o contrato antes de marcar como assinado.' using errcode='23514';
  end if;
 end if;
 if new.status='emitido' and (tg_op='INSERT' or (tg_op='UPDATE' and old.status='rascunho')) then
  if length(btrim(coalesce(new.content->>'scope','')))<12
   or length(btrim(coalesce(new.content->>'payment_terms','')))<6
   or length(btrim(coalesce(new.content->>'payment_schedule','')))<8
   or length(btrim(coalesce(new.content->>'counterparty_document','')))<11
   or length(btrim(coalesce(new.content#>>'{company,company_document}','')))<11 then
   raise exception 'Dados essenciais insuficientes para emitir contrato.' using errcode='23514';
  end if;
 end if;
 if tg_op='INSERT' and length(coalesce(new.content->>'revision_of',''))>0 then
  if not exists (
   select 1 from public.cv_contracts parent
   where parent.id::text=new.content->>'revision_of'
    and parent.owner_id=new.owner_id and parent.status<>'rascunho'
  ) then
   raise exception 'Referência de revisão inválida ou fora da conta.' using errcode='23514';
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists cv_contracts_lifecycle_guard_trigger on public.cv_contracts;
create trigger cv_contracts_lifecycle_guard_trigger
 before insert or update or delete on public.cv_contracts
 for each row execute function public.cv_contracts_lifecycle_guard();
revoke all on function public.cv_contracts_lifecycle_guard() from public,anon,authenticated;