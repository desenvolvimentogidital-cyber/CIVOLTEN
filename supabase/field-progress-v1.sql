-- CIVOLTEN: acompanhamento de campo por serviço, separado de medições e custos.
-- RLS proprietário; nenhuma alteração em dados existentes.
begin;
create table if not exists public.cv_field_progress_v1 (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 work_order_id uuid not null references public.cv_work_orders_v1(id) on delete restrict,
 item_id text not null check(length(item_id) between 1 and 64),
 status text not null default 'pending' check(status in ('pending','in_progress','blocked','done')),
 executed_quantity numeric(14,3) not null default 0 check(executed_quantity>=0),
 employee_id uuid references public.cv_employees_v1(id) on delete restrict,
 observed_on date not null default current_date,
 notes text not null default '' check(length(notes)<=1200),
 photo_paths text[] not null default array[]::text[] check(cardinality(photo_paths)<=3),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,work_order_id,item_id)
);
create index if not exists cv_field_progress_user_work_v1
 on public.cv_field_progress_v1(user_id,work_order_id,updated_at desc);
alter table public.cv_field_progress_v1 enable row level security;
drop policy if exists cv_field_select_v1 on public.cv_field_progress_v1;
create policy cv_field_select_v1 on public.cv_field_progress_v1
 for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists cv_field_insert_v1 on public.cv_field_progress_v1;
create policy cv_field_insert_v1 on public.cv_field_progress_v1
 for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists cv_field_update_v1 on public.cv_field_progress_v1;
create policy cv_field_update_v1 on public.cv_field_progress_v1
 for update to authenticated using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()));
revoke all on public.cv_field_progress_v1 from anon,authenticated;
grant select,insert,update on public.cv_field_progress_v1 to authenticated;
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
drop trigger if exists cv_field_progress_guard_trigger_v1 on public.cv_field_progress_v1;
create trigger cv_field_progress_guard_trigger_v1 before insert or update
on public.cv_field_progress_v1 for each row
execute function public.cv_field_progress_guard_v1();
-- Fotos privadas; só o proprietário da obra pode acessar seus arquivos.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cv-field-evidence-v1','cv-field-evidence-v1',false,4194304,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists cv_field_photo_read_v1 on storage.objects;
create policy cv_field_photo_read_v1 on storage.objects
 for select to authenticated using(
 bucket_id='cv-field-evidence-v1' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.cv_work_orders_v1 w
  where w.id::text=(storage.foldername(name))[2] and w.user_id=(select auth.uid()))
 );
drop policy if exists cv_field_photo_insert_v1 on storage.objects;
create policy cv_field_photo_insert_v1 on storage.objects
 for insert to authenticated with check(
 bucket_id='cv-field-evidence-v1' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.cv_work_orders_v1 w
  where w.id::text=(storage.foldername(name))[2] and w.user_id=(select auth.uid())
  and w.status='in_progress')
 );
drop policy if exists cv_field_photo_delete_v1 on storage.objects;
create policy cv_field_photo_delete_v1 on storage.objects
 for delete to authenticated using(
 bucket_id='cv-field-evidence-v1' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.cv_work_orders_v1 w
  where w.id::text=(storage.foldername(name))[2] and w.user_id=(select auth.uid())
  and w.status='in_progress')
 );
commit;
