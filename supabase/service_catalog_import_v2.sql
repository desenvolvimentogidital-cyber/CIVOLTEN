-- Atualizacao segura: permite referencias SIURB e ate 30 coeficientes por composicao.
-- Nao apaga registros, orcamentos, funcionarios nem custos.
begin;
alter table public.cv_service_catalog_v1 drop constraint if exists cv_service_catalog_v1_source_check;
alter table public.cv_service_catalog_v1
 add constraint cv_service_catalog_v1_source_check
 check (source in ('internal','sinapi','siurb'));
alter table public.cv_service_catalog_v1 drop constraint if exists cv_service_catalog_v1_roles_check;
alter table public.cv_service_catalog_v1
 add constraint cv_service_catalog_v1_roles_check
 check (jsonb_typeof(roles) = 'array' and jsonb_array_length(roles) <= 30);
commit;
