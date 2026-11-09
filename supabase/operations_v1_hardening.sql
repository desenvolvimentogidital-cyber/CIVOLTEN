-- CIVOLTEN 2026-11-09: impedir exclusões de obra concluída e propostas aceitas.
begin;
create or replace function public.cv_work_log_guard_v1()
returns trigger language plpgsql set search_path=public as $$
declare work public.cv_work_orders_v1%rowtype;own uuid;used_hours numeric;
begin
 if tg_op='DELETE' then
  if not exists(select 1 from public.cv_work_orders_v1 w
   where w.id=old.work_order_id and w.user_id=old.user_id and w.status='in_progress') then
   raise exception 'Horas de obra concluida nao podem ser apagadas';
  end if;
  return old;
 end if;
 select * into work from public.cv_work_orders_v1 where id=new.work_order_id;
 select user_id into own from public.cv_employees_v1 where id=new.employee_id;
 if work.id is null or work.user_id<>new.user_id or own is distinct from new.user_id then
  raise exception 'Obra ou funcionario nao pertence a esta conta';
 end if;
 if work.status<>'in_progress' then raise exception 'A obra precisa estar em execucao para apontar horas';end if;
 if not exists(select 1 from jsonb_array_elements(work.budget_snapshot->'items') i
   where i->>'id'=new.item_id) then raise exception 'Servico nao pertence ao contrato';end if;
 perform pg_advisory_xact_lock(hashtext(new.employee_id::text||new.work_date::text));
 select coalesce(sum(hours),0) into used_hours from public.cv_work_logs_v1 l
  where l.user_id=new.user_id and l.employee_id=new.employee_id and l.work_date=new.work_date
    and l.id<>new.id;
 if used_hours+new.hours>24 then raise exception 'Funcionario excede 24 horas registradas no dia';end if;
 new.updated_at=now();return new;
end $$;

drop trigger if exists cv_work_log_guard_trigger_v1 on public.cv_work_logs_v1;
create trigger cv_work_log_guard_trigger_v1
 before insert or update or delete on public.cv_work_logs_v1
 for each row execute function public.cv_work_log_guard_v1();

create or replace function public.cv_measurement_guard_v1()
returns trigger language plpgsql set search_path=public as $$
declare work public.cv_work_orders_v1%rowtype;item jsonb;priced jsonb;
 plan_qty numeric;previous_qty numeric;previous_amount numeric;row_sale numeric;
begin
 if tg_op='DELETE' then
  if old.status='approved' then
   raise exception 'Medição aprovada não pode ser apagada';
  end if;
  if not exists(select 1 from public.cv_work_orders_v1 w
   where w.id=old.work_order_id and w.user_id=old.user_id and w.status='in_progress') then
   raise exception 'Medição de obra encerrada não pode ser apagada';
  end if;
  return old;
 end if;
 select * into work from public.cv_work_orders_v1
  where id=new.work_order_id for update;
 if work.id is null or work.user_id<>new.user_id then
  raise exception 'Obra nao pertence a esta conta';
 end if;
 if tg_op='UPDATE' then
  if old.status='approved' then raise exception 'Medicao aprovada nao pode ser editada'; end if;
  if new.work_order_id<>old.work_order_id or new.user_id<>old.user_id
   or new.item_id<>old.item_id then raise exception 'A medicao pertence ao servico original';end if;
 end if;
 if work.status<>'in_progress' then raise exception 'Inicie a obra antes de registrar medicoes';end if;
 select x into item from jsonb_array_elements(work.budget_snapshot->'items') x
  where x->>'id'=new.item_id limit 1;
 select x into priced from jsonb_array_elements(work.priced_rows) x
  where x->>'id'=new.item_id limit 1;
 if item is null or priced is null then raise exception 'Servico nao pertence ao preco aprovado';end if;
 plan_qty=(item->>'quantity')::numeric;
 row_sale=(priced->>'selling')::numeric/100;
 if plan_qty<=0 or row_sale<=0 then raise exception 'Valor de contrato invalido';end if;
 select coalesce(sum(quantity),0),coalesce(sum(amount),0)
 into previous_qty,previous_amount from public.cv_measurements_v1
  where work_order_id=new.work_order_id and item_id=new.item_id and id<>new.id;
 if previous_qty+new.quantity>plan_qty then
  raise exception 'Medicao supera a quantidade contratada';
 end if;
 -- Arredondamento do ultimo saldo garante que a soma das medicoes fecha no valor contratado.
 if previous_qty+new.quantity=plan_qty then
  new.amount=row_sale-previous_amount;
 else
  new.amount=round(row_sale*new.quantity/plan_qty,2);
 end if;
 if new.amount<0 then raise exception 'Valor medido invalido';end if;
 if new.status='approved' then new.approved_at=coalesce(new.approved_at,now());
 else new.approved_at=null;end if;
 new.updated_at=now();return new;
end $$;

drop trigger if exists cv_measurement_guard_trigger_v1 on public.cv_measurements_v1;
create trigger cv_measurement_guard_trigger_v1
 before insert or update or delete on public.cv_measurements_v1
 for each row execute function public.cv_measurement_guard_v1();

create or replace function public.cv_protect_accepted_budget_v1()
returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from public.cv_work_orders_v1 w where w.budget_id=old.id) then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if tg_op='DELETE' then raise exception 'Proposta com obra aprovada nao pode ser excluida';end if;
 if new.title is distinct from old.title or new.customer is distinct from old.customer
  or new.project is distinct from old.project or new.location is distinct from old.location
  or new.notes is distinct from old.notes or new.expires_on is distinct from old.expires_on
  or new.items is distinct from old.items or new.pricing is distinct from old.pricing
  or new.commercial is distinct from old.commercial or new.demo is distinct from old.demo then
  raise exception 'Proposta aprovada e imutavel. Gere uma nova proposta para alteracoes';
 end if;
 return new;
end $$;
drop trigger if exists cv_protect_accepted_budget_trigger_v1 on public.cv_budget_drafts_v1;
create trigger cv_protect_accepted_budget_trigger_v1 before update or delete on public.cv_budget_drafts_v1
for each row execute function public.cv_protect_accepted_budget_v1();
commit;
