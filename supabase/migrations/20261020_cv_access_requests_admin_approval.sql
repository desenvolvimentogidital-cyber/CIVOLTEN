-- CIVOLTEN: fluxo de solicitação de acesso a contas registradas.
-- Regra: criar conta não concede direitos de administrador.
create table if not exists public.cv_access_requests(
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null check (length(email) between 5 and 180),
 status text not null default 'pending' check (status in ('pending','approved')),
 requested_at timestamptz not null default now(),
 approved_at timestamptz
);
alter table public.cv_access_requests enable row level security;
revoke all on public.cv_access_requests from anon,authenticated;
grant select,insert on public.cv_access_requests to authenticated;
create policy cv_access_select on public.cv_access_requests for select to authenticated
using (user_id=(select auth.uid()) or (select cv_private.is_admin()));
create policy cv_access_request on public.cv_access_requests for insert to authenticated
with check (user_id=(select auth.uid()) and status='pending' and approved_at is null
and lower(email)=lower((select auth.jwt()->>'email')));
create or replace function public.cv_approve_access_request(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
 if (select auth.uid()) is null or not (select cv_private.is_admin()) then
  raise exception 'Permissão negada' using errcode='42501';
 end if;
 if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then
  raise exception 'Conta não confirmada';
 end if;
 update public.cv_access_requests set status='approved',approved_at=now()
 where user_id=p_user_id and status='pending';
 if not found then raise exception 'Solicitação pendente não encontrada'; end if;
 insert into public.admin_users(user_id,role,enabled)
 values(p_user_id,'admin',true)
 on conflict (user_id) do update set role='admin',enabled=true;
 return true;
end $$;
revoke all on function public.cv_approve_access_request(uuid) from public,anon;
grant execute on function public.cv_approve_access_request(uuid) to authenticated;
