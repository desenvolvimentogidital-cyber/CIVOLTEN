-- SINAPI: referências de serviço do Estado de SP com preços opcionais.
-- Separado de pricing_catalog e de siurb_reference_services, sem preços de venda.
-- O valor NULL significa preço indisponível, nunca custo zero de obra.
create table if not exists public.sinapi_reference_services (
 uf text not null check(uf='SP'),
 base_month text not null check(base_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 regime text not null check(regime in ('com_desoneracao','sem_desoneracao')),
 code text not null check(code ~ '^[0-9]{4,10}$'),
 description text not null check(length(description) between 3 and 1200),
 unit text not null check(length(unit) between 1 and 24),
 unit_cost numeric(14,2) null check(unit_cost>0 and unit_cost<=100000000),
 price_verified boolean not null default false,
 source_url text not null default '' check(length(source_url)<=500),
 inputs jsonb not null default '[]'::jsonb check(jsonb_typeof(inputs)='array' and jsonb_array_length(inputs)<=150),
 updated_at timestamptz not null default now(),
 primary key(uf,base_month,regime,code),
 constraint sinapi_price_source_check check (
  unit_cost is null or (price_verified=true and source_url like 'https://%')
 )
);
create index if not exists sinapi_reference_code on public.sinapi_reference_services(code);
create index if not exists sinapi_reference_desc on public.sinapi_reference_services(lower(description) text_pattern_ops);
alter table public.sinapi_reference_services enable row level security;
revoke all on public.sinapi_reference_services from public,anon,authenticated;
grant select,insert,update on public.sinapi_reference_services to service_role;
