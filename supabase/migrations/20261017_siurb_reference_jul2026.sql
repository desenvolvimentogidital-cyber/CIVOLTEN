-- Base de referência SIURB — competência 07/2026, com desoneração.
-- Adição separada: não altera pricing_catalog, preços comerciais ou pedidos anteriores.
create table if not exists public.siurb_reference_services (
 source text not null check(source in ('INFRA','EDIF')),
 base_month text not null check(base_month ~ '^[0-9]{4}-[0-9]{2}$'),
 regime text not null default 'com_desoneracao' check(regime='com_desoneracao'),
 code text not null check(code ~ '^[0-9]{5,12}$'),
 description text not null check(length(description) between 3 and 1200),
 unit text not null check(length(unit) between 1 and 24),
 unit_cost numeric(14,2) not null check(unit_cost>=0 and unit_cost<=100000000),
 inputs jsonb not null default '[]'::jsonb check(jsonb_typeof(inputs)='array' and jsonb_array_length(inputs)<=150),
 updated_at timestamptz not null default now(),
 primary key(source,base_month,regime,code)
);
create index if not exists siurb_reference_search_code on public.siurb_reference_services(code);
create index if not exists siurb_reference_search_desc on public.siurb_reference_services(lower(description) text_pattern_ops);
alter table public.siurb_reference_services enable row level security;
revoke all on public.siurb_reference_services from public,anon,authenticated;
grant select,insert,update,delete on public.siurb_reference_services to service_role;
