create extension if not exists pgcrypto;
create table if not exists public.quote_requests (
 id uuid primary key default gen_random_uuid(), access_hash text not null unique,
 customer_name text, phone text, city text, neighborhood text, category text,
 description text, urgency text,
 status text not null default 'rascunho' check(status in ('rascunho','novo','analisando','aguardando_cliente','orcamento_enviado','visita_necessaria','concluido','recusado')),
 estimate_min numeric(12,2), estimate_max numeric(12,2), admin_notes text not null default '',
 created_at timestamptz not null default now(), submitted_at timestamptz, updated_at timestamptz not null default now()
);
create index if not exists requests_submitted on public.quote_requests(submitted_at desc) where submitted_at is not null;
create table if not exists public.quote_media (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.quote_requests(id) on delete cascade,
 path text not null unique, original_name text not null, mime_type text not null,
 size bigint not null check(size>0 and size<=47185920), created_at timestamptz not null default now()
);
create index if not exists quote_media_request on public.quote_media(request_id);
create table if not exists public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.pricing_rules (
 category text primary key,min_price numeric(12,2) check(min_price >= 0),
 max_price numeric(12,2) check(max_price >= 0), enabled boolean not null default false,
 check(min_price is null or max_price is null or max_price>=min_price)
);
insert into public.pricing_rules(category) values
('eletrica'),('manutencao'),('iluminacao'),('reforma'),('construcao'),('pintura'),('hidraulica'),('outros')
on conflict(category) do nothing;
create table if not exists public.ip_limits (
 ip_hash text not null, action text not null, window_start timestamptz not null,
 attempts integer not null default 0,primary key(ip_hash,action,window_start)
);
create index if not exists ip_limits_window on public.ip_limits(window_start);
alter table public.quote_requests enable row level security;
alter table public.quote_media enable row level security;
alter table public.admin_users enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.ip_limits enable row level security;
revoke all on public.quote_requests,public.quote_media,public.admin_users,public.pricing_rules,public.ip_limits from anon,authenticated;
grant select,insert,update,delete on public.quote_requests,public.quote_media,public.admin_users,public.pricing_rules,public.ip_limits to service_role;
create or replace function public.civolten_consume_limit(p_ip text,p_action text,p_limit integer)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare current_attempts integer;
begin
 if p_action not in ('start','sign','submit') or p_limit<1 or p_limit>100 or length(p_ip)<>64 then return false; end if;
 insert into public.ip_limits(ip_hash,action,window_start,attempts)
 values(p_ip,p_action,date_trunc('hour',now()),1)
 on conflict(ip_hash,action,window_start) do update set attempts=public.ip_limits.attempts+1
 returning attempts into current_attempts;
 return current_attempts<=p_limit;
end;
$$;
revoke all on function public.civolten_consume_limit(text,text,integer) from public,anon,authenticated;
grant execute on function public.civolten_consume_limit(text,text,integer) to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values('civolten-media','civolten-media',false,47185920,array[
'image/jpeg','image/png','image/webp','image/heic','image/heif',
'video/mp4','video/quicktime','video/webm',
'audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-m4a'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
