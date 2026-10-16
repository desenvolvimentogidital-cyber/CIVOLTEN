-- CIVOLTEN 2026-10-16 — REGISTRO da migração aplicada no Supabase CIVOLTEN.
-- Não executar novamente sem verificar o histórico de migrações do projeto.
-- Os zeros significam "padrão não precificado", nunca serviço gratuito.
-- R$ 2.500/m² no padrão médio foi fornecido como exemplo, e depende de revisão financeira.
alter table public.pricing_catalog drop constraint if exists pricing_catalog_check;
alter table public.pricing_catalog
 add constraint pricing_catalog_order_check check (
  baixo=0 or medio=0 or alto=0 or (baixo<=medio and medio<=alto)
 );
alter table public.quote_requests
 add column if not exists request_details jsonb not null default '{}'::jsonb;
insert into public.pricing_catalog(service_id,category,description,unit,baixo,medio,alto,enabled)
values
 ('instalacao_eletrica_completa','instalacoes_eletricas','Instalação elétrica completa (por área)','m²',0,0,0,true),
 ('reforma_apartamento_completa','construcao_civil','Reforma completa de apartamento','m²',0,2500,0,true)
on conflict(service_id) do nothing;
