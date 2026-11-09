-- Correção da validação do sufixo JPG (primeira versão ainda sem dados).
create or replace function public.cv_field_progress_guard_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare w public.cv_work_orders_v1%rowtype;
 target numeric;
 p text;
begin
 if tg_op='UPDATE' and
  (new.id<>old.id or new.user_id<>old.user_id or
   new.work_order_id<>old.work_order_id or new.item_id<>old.item_id or
   new.created_at<>old.created_at) then
   raise exception 'Identificação do acompanhamento não pode ser alterada';
 end if;
 select * into w from public.cv_work_orders_v1
  where id=new.work_order_id and user_id=new.user_id;
 if not found then raise exception 'Obra indisponível para este usuário';end if;
 if w.status<>'in_progress' then
  raise exception 'Inicie a obra antes de atualizar o acompanhamento de campo';
 end if;
 select (entry->>'quantity')::numeric into target
 from jsonb_array_elements(w.budget_snapshot->'items') entry
 where entry->>'id'=new.item_id limit 1;
 if target is null or target<=0 then
  raise exception 'O serviço não pertence ao escopo da obra aprovada';
 end if;
 if new.executed_quantity>target then
  raise exception 'Quantidade executada excede a contratada';
 end if;
 if new.status='pending' and new.executed_quantity<>0 then
  raise exception 'Serviço pendente deve ter quantidade executada zero';
 end if;
 if new.status='done' and new.executed_quantity<>target then
  raise exception 'Serviço concluído deve ter a quantidade total executada';
 end if;
 if new.employee_id is not null and not exists(
   select 1 from public.cv_employees_v1
   where id=new.employee_id and user_id=new.user_id and active=true
 ) then raise exception 'Responsável deve ser um profissional ativo da empresa';end if;
 foreach p in array new.photo_paths loop
  if p not like new.user_id::text||'/'||new.work_order_id::text||'/'||new.item_id||'/%'
     or right(p,4)<>'.jpg' then
    raise exception 'Foto deve pertencer a esta obra e serviço';end if;
 end loop;
 new.updated_at=now();
 return new;
end $$;
