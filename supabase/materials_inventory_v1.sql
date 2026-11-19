-- CIVOLTEN | Controle de materiais fase 1
-- Executar somente após revisão e aprovação. RLS por usuário; movimentos são auditáveis.
create table if not exists public.cv_suppliers_v1 (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 name text not null check(length(btrim(name)) between 1 and 180),
 document text not null default '' check(document='' or length(document) in (11,14)),
 phone text not null default '', email text not null default '', notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create index if not exists cv_suppliers_v1_user_idx on public.cv_suppliers_v1(user_id);
alter table public.cv_suppliers_v1 enable row level security;
revoke all on table public.cv_suppliers_v1 from public,anon,authenticated;
grant select,insert,update,delete on public.cv_suppliers_v1 to authenticated;
create policy cv_sup_read_own on public.cv_suppliers_v1 for select to authenticated using(user_id=(select auth.uid()));
create policy cv_sup_insert_own on public.cv_suppliers_v1 for insert to authenticated with check(user_id=(select auth.uid()));
create policy cv_sup_update_own on public.cv_suppliers_v1 for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy cv_sup_delete_own on public.cv_suppliers_v1 for delete to authenticated using(user_id=(select auth.uid()));

create table if not exists public.cv_materials_v1 (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 name text not null check(length(btrim(name)) between 1 and 180),
 category text not null default '', unit text not null default 'un',
 min_stock numeric(14,4) not null default 0 check(min_stock>=0),
 stock numeric(14,4) not null default 0 check(stock>=0),
 average_cost numeric(14,4) not null default 0 check(average_cost>=0),
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create index if not exists cv_materials_v1_user_name_idx on public.cv_materials_v1(user_id,name);
alter table public.cv_materials_v1 enable row level security;
revoke all on table public.cv_materials_v1 from public,anon,authenticated;
grant select,delete on public.cv_materials_v1 to authenticated;
grant insert(id,user_id,name,category,unit,min_stock,active,updated_at) on public.cv_materials_v1 to authenticated;
grant update(name,category,unit,min_stock,active,updated_at) on public.cv_materials_v1 to authenticated;
create policy cv_mat_read_own on public.cv_materials_v1 for select to authenticated using(user_id=(select auth.uid()));
create policy cv_mat_insert_own on public.cv_materials_v1 for insert to authenticated with check(user_id=(select auth.uid()));
create policy cv_mat_update_own on public.cv_materials_v1 for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy cv_mat_delete_own on public.cv_materials_v1 for delete to authenticated using(user_id=(select auth.uid()));

create table if not exists public.cv_material_movements_v1 (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 material_id uuid not null,
 supplier_id uuid,
 movement_type text not null check(movement_type in ('purchase','entry','exit','loss','return','adjustment')),
 quantity numeric(14,4) not null check(quantity<>0),
 unit_cost numeric(14,4) check(unit_cost is null or unit_cost>=0),
 work_order_id uuid,
 reference text not null default '', notes text not null default '',
 created_at timestamptz not null default now(),
 constraint cv_mov_material_owner_fk foreign key(user_id,material_id) references public.cv_materials_v1(user_id,id) on delete restrict,
 constraint cv_mov_supplier_owner_fk foreign key(user_id,supplier_id) references public.cv_suppliers_v1(user_id,id) on delete restrict
);
create index if not exists cv_material_movements_v1_user_material_idx on public.cv_material_movements_v1(user_id,material_id,created_at desc);
alter table public.cv_material_movements_v1 enable row level security;
revoke all on table public.cv_material_movements_v1 from public,anon,authenticated;
grant select on public.cv_material_movements_v1 to authenticated;
create policy cv_mov_read_own on public.cv_material_movements_v1 for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.cv_material_movement_create_v1(
 p_material_id uuid,p_type text,p_quantity numeric,p_unit_cost numeric default null,
 p_supplier_id uuid default null,p_work_order_id uuid default null,
 p_reference text default '',p_notes text default ''
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $
declare m public.cv_materials_v1%rowtype; delta numeric(14,4); next_stock numeric(14,4); next_avg numeric(14,4); movement_id uuid;
begin
 if auth.uid() is null then raise exception 'Sessão inválida'; end if;
 if p_type not in ('purchase','entry','exit','loss','return','adjustment') then raise exception 'Tipo de movimentação inválido'; end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'Quantidade deve ser maior que zero'; end if;
 if p_type in ('purchase','entry') and (p_unit_cost is null or p_unit_cost<0) then raise exception 'Informe custo unitário válido'; end if;
 select * into m from public.cv_materials_v1 where id=p_material_id and user_id=auth.uid() and active=true for update;
 if not found then raise exception 'Material não encontrado ou inativo'; end if;
 if p_supplier_id is not null and not exists(select 1 from public.cv_suppliers_v1 where id=p_supplier_id and user_id=auth.uid()) then raise exception 'Fornecedor inválido'; end if;
 if p_type in ('purchase','entry','return') then delta:=p_quantity;
 elsif p_type in ('exit','loss') then delta:=-p_quantity;
 else delta:=p_quantity-m.stock; end if;
 next_stock:=m.stock+delta;
 if delta=0 then raise exception 'O saldo já corresponde à quantidade informada'; end if;
 if next_stock<0 then raise exception 'Estoque insuficiente'; end if;
 next_avg:=m.average_cost;
 if delta>0 and p_unit_cost is not null and p_type in ('purchase','entry') then
  next_avg:=case when next_stock=0 then 0 else round(((m.stock*m.average_cost)+(delta*p_unit_cost))/next_stock,4) end;
 end if;
 update public.cv_materials_v1 set stock=next_stock,average_cost=next_avg,updated_at=now() where id=m.id and user_id=auth.uid();
 insert into public.cv_material_movements_v1(user_id,material_id,supplier_id,movement_type,quantity,unit_cost,work_order_id,reference,notes)
 values(auth.uid(),m.id,p_supplier_id,p_type,delta,p_unit_cost,p_work_order_id,left(coalesce(p_reference,''),100),left(coalesce(p_notes,''),1000))
 returning id into movement_id;
 return movement_id;
end $$;
revoke all on function public.cv_material_movement_create_v1(uuid,text,numeric,numeric,uuid,uuid,text,text) from public,anon;
grant execute on function public.cv_material_movement_create_v1(uuid,text,numeric,numeric,uuid,uuid,text,text) to authenticated;
