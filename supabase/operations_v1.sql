-- CIVOLTEN / fechamento de obras de mao de obra / 2026-11-09.
-- Somente criacao de tabelas e funcoes. Nenhum registro existente e alterado.
begin;
create table if not exists public.cv_work_orders_v1(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 budget_id uuid not null references public.cv_budget_drafts_v1(id) on delete restrict,
 customer text not null check(length(customer) between 1 and 180),
 project text not null default '',
 contract_ref text not null check(length(contract_ref) between 1 and 80),
 acceptance_ref text not null check(length(acceptance_ref) between 1 and 240),
 budget_snapshot jsonb not null,
 priced_rows jsonb not null check(jsonb_typeof(priced_rows)='array'),
 contract_value numeric(14,2) not null check(contract_value>0),
 status text not null default 'approved'
  check(status in ('approved','in_progress','completed','cancelled')),
 approved_on date not null default current_date,
 start_on date,
 finish_on date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,budget_id),
 unique(user_id,id)
);
create table if not exists public.cv_work_logs_v1(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 work_order_id uuid not null references public.cv_work_orders_v1(id) on delete restrict,
 employee_id uuid not null references public.cv_employees_v1(id) on delete restrict,
 item_id text not null check(length(item_id) between 1 and 64),
 work_date date not null,
 hours numeric(7,2) not null check(hours>0 and hours<=24),
 qualification_confirmed boolean not null default false,
 notes text not null default '' check(length(notes)<=900),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists cv_work_logs_order_date_v1 on public.cv_work_logs_v1(user_id,work_order_id,work_date);
create index if not exists cv_work_logs_employee_date_v1 on public.cv_work_logs_v1(user_id,employee_id,work_date);
create table if not exists public.cv_measurements_v1(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 work_order_id uuid not null references public.cv_work_orders_v1(id) on delete restrict,
 item_id text not null check(length(item_id) between 1 and 64),
 measured_on date not null,
 quantity numeric(12,3) not null check(quantity>0),
 amount numeric(14,2) not null default 0 check(amount>=0),
 status text not null default 'draft' check(status in ('draft','approved')),
 approved_at timestamptz,
 notes text not null default '' check(length(notes)<=900),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists cv_measurements_order_v1 on public.cv_measurements_v1(user_id,work_order_id,item_id);

create or replace function public.cv_work_order_guard_v1()
returns trigger language plpgsql set search_path=public as $$
declare owner uuid;original public.cv_budget_drafts_v1%rowtype;priced_total numeric;
begin
 select * into original from public.cv_budget_drafts_v1 b where b.id=new.budget_id;
 owner=original.user_id;
 if owner is distinct from new.user_id then
  raise exception 'Orcamento nao pertence a esta conta';
 end if;
 if tg_op='INSERT' then
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
   from jsonb_array_elements(new.priced_rows) r;
  if priced_total<>new.contract_value*100 or priced_total<=0 then
   raise exception 'O valor do contrato nao fecha com o preco congelado';
  end if;
 end if;
 if tg_op='UPDATE' then
  if new.user_id is distinct from old.user_id
   or new.budget_id is distinct from old.budget_id
   or new.budget_snapshot is distinct from old.budget_snapshot
   or new.priced_rows is distinct from old.priced_rows
   or new.contract_value is distinct from old.contract_value
   or new.approved_on is distinct from old.approved_on
   or new.acceptance_ref is distinct from old.acceptance_ref
   or new.contract_ref is distinct from old.contract_ref
   or new.customer is distinct from old.customer
   or new.project is distinct from old.project then
   raise exception 'Contrato aprovado e valores congelados; abra aditivo para alterar';
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
   if exists(
    select 1 from jsonb_array_elements(new.budget_snapshot->'items') i
    where coalesce((select sum(m.quantity) from public.cv_measurements_v1 m
        where m.work_order_id=new.id and m.item_id=i->>'id' and m.status='approved'),0)
       < (i->>'quantity')::numeric
   ) then
     raise exception 'Aprove as medicoes de todos os servicos antes de concluir';
   end if;
   new.finish_on=coalesce(new.finish_on,current_date);
  end if;
 end if;
 new.updated_at=now();return new;
end $$;
drop trigger if exists cv_work_order_guard_trigger_v1 on public.cv_work_orders_v1;
create trigger cv_work_order_guard_trigger_v1 before insert or update on public.cv_work_orders_v1
for each row execute function public.cv_work_order_guard_v1();

create or replace function public.cv_work_log_guard_v1()
returns trigger language plpgsql set search_path=public as $$
declare work public.cv_work_orders_v1%rowtype;own uuid;used_hours numeric;
begin
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
create trigger cv_work_log_guard_trigger_v1 before insert or update on public.cv_work_logs_v1
for each row execute function public.cv_work_log_guard_v1();

create or replace function public.cv_measurement_guard_v1()
returns trigger language plpgsql set search_path=public as $$
declare work public.cv_work_orders_v1%rowtype;item jsonb;priced jsonb;
 plan_qty numeric;previous_qty numeric;previous_amount numeric;row_sale numeric;
begin
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
create trigger cv_measurement_guard_trigger_v1 before insert or update on public.cv_measurements_v1
for each row execute function public.cv_measurement_guard_v1();

create or replace function public.cv_protect_med_receivable_v1()
returns trigger language plpgsql set search_path=public as $
declare measurement public.cv_measurements_v1%rowtype;
begin
 if tg_op='DELETE' then
  if old.reference like 'MED:%' then raise exception 'Cobrança de medição aprovada não pode ser apagada';end if;
  return old;
 end if;
 if tg_op='UPDATE' and old.reference like 'MED:%' then
  if new.reference is distinct from old.reference
   or new.amount is distinct from old.amount
   or new.kind is distinct from old.kind
   or new.user_id is distinct from old.user_id then
   raise exception 'Valor de medição faturada é imutável. Altere só vencimento ou data recebida';
  end if;
 end if;
 if tg_op='INSERT' and new.reference like 'MED:%' then
  select * into measurement from public.cv_measurements_v1
  where id=substring(new.reference from 5)::uuid and user_id=new.user_id;
  if measurement.id is null or measurement.status<>'approved'
   or measurement.amount<>new.amount or new.kind<>'income' then
   raise exception 'Cobrança deve corresponder a medição aprovada';
  end if;
 end if;
 return new;
end $;
drop trigger if exists cv_protect_med_receivable_trigger_v1 on public.cv_financial_entries_v1;
create trigger cv_protect_med_receivable_trigger_v1
before insert or update or delete on public.cv_financial_entries_v1
for each row execute function public.cv_protect_med_receivable_v1();

create unique index if not exists cv_med_billing_reference_unique_v1
on public.cv_financial_entries_v1(user_id,reference)
where reference like 'MED:%';

create or replace function public.cv_bill_measurement_v1(p_measurement_id uuid,p_due_date date)
returns uuid language plpgsql security invoker set search_path=public as $$
declare m public.cv_measurements_v1%rowtype;work public.cv_work_orders_v1%rowtype;entry_id uuid;
begin
 if auth.uid() is null then raise exception 'Sessao invalida';end if;
 if p_due_date is null then raise exception 'Informe vencimento';end if;
 select * into m from public.cv_measurements_v1
  where id=p_measurement_id and user_id=auth.uid() for update;
 if m.id is null then raise exception 'Medicao nao encontrada';end if;
 if m.status<>'approved' then raise exception 'Aprove a medicao antes de gerar cobranca';end if;
 select * into work from public.cv_work_orders_v1
  where id=m.work_order_id and user_id=auth.uid();
 if work.id is null then raise exception 'Obra nao encontrada';end if;
 select id into entry_id from public.cv_financial_entries_v1
  where user_id=auth.uid() and reference='MED:'||m.id::text;
 if entry_id is not null then return entry_id;end if;
 insert into public.cv_financial_entries_v1
  (user_id,kind,title,party,project,category,amount,due_date,paid_date,reference,notes)
 values(auth.uid(),'income','Medicao da obra '||work.contract_ref,
  work.customer,work.project,'Mao de obra',m.amount,p_due_date,null,
  'MED:'||m.id::text,'Recebivel gerencial vinculado a medicao aprovada. Nao e nota fiscal.')
 returning id into entry_id;
 return entry_id;
end $$;
revoke all on function public.cv_bill_measurement_v1(uuid,date) from public,anon;
grant execute on function public.cv_bill_measurement_v1(uuid,date) to authenticated;

alter table public.cv_work_orders_v1 enable row level security;
alter table public.cv_work_logs_v1 enable row level security;
alter table public.cv_measurements_v1 enable row level security;

drop policy if exists cv_work_orders_owner_v1 on public.cv_work_orders_v1;
create policy cv_work_orders_owner_v1 on public.cv_work_orders_v1
 for all to authenticated using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()));
drop policy if exists cv_work_logs_owner_v1 on public.cv_work_logs_v1;
create policy cv_work_logs_owner_v1 on public.cv_work_logs_v1
 for all to authenticated
 using(user_id=(select auth.uid()) and exists(
  select 1 from public.cv_work_orders_v1 w where w.id=work_order_id and w.user_id=(select auth.uid())))
 with check(user_id=(select auth.uid()) and exists(
  select 1 from public.cv_work_orders_v1 w where w.id=work_order_id and w.user_id=(select auth.uid()))
  and exists(select 1 from public.cv_employees_v1 e
   where e.id=employee_id and e.user_id=(select auth.uid())));
drop policy if exists cv_measurements_owner_v1 on public.cv_measurements_v1;
create policy cv_measurements_owner_v1 on public.cv_measurements_v1
 for all to authenticated
 using(user_id=(select auth.uid()) and exists(
  select 1 from public.cv_work_orders_v1 w where w.id=work_order_id and w.user_id=(select auth.uid())))
 with check(user_id=(select auth.uid()) and exists(
  select 1 from public.cv_work_orders_v1 w where w.id=work_order_id and w.user_id=(select auth.uid())));
grant select,insert,update,delete on public.cv_work_orders_v1 to authenticated;
grant select,insert,update,delete on public.cv_work_logs_v1 to authenticated;
grant select,insert,update,delete on public.cv_measurements_v1 to authenticated;
commit;
