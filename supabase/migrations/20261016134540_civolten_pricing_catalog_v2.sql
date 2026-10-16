create table if not exists public.pricing_catalog (
 service_id text primary key check(service_id ~ '^[a-z_]{3,80}$'),
 category text not null check(category in ('construcao_civil','instalacoes_eletricas')),
 description text not null,
 unit text not null check(unit in ('m²','metro','unidade')),
 baixo numeric(12,2) not null check(baixo>=0),
 medio numeric(12,2) not null check(medio>=0),
 alto numeric(12,2) not null check(alto>=0),
 enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 check(baixo<=medio and medio<=alto)
);
insert into public.pricing_catalog(service_id,category,description,unit,baixo,medio,alto)
values
('demolicao_alvenaria','construcao_civil','Demolição de alvenaria','m²',80,110,150),
('regularizacao_contrapiso','construcao_civil','Regularização de contrapiso','m²',90,120,180),
('levantamento_bloco','construcao_civil','Levantamento de blocos','m²',110,150,210),
('reboco_interno','construcao_civil','Reboco interno','m²',85,110,160),
('drywall_pintura_premium','construcao_civil','Drywall com pintura premium','m²',280,390,450),
('assentamento_porcelanato','construcao_civil','Assentamento de porcelanato','m²',150,220,350),
('assentamento_azulejo_pastilha','construcao_civil','Assentamento de azulejo/pastilha','m²',120,170,260),
('pintura_alvenaria','construcao_civil','Pintura em alvenaria','m²',60,85,130),
('rasgo_parede_conduite','instalacoes_eletricas','Rasgo em parede para conduíte','metro',45,65,95),
('passagem_fiacao','instalacoes_eletricas','Passagem de fiação','metro',20,30,50),
('quadro_distribuicao','instalacoes_eletricas','Quadro de distribuição','unidade',800,1100,1800),
('ponto_tomada_interruptor','instalacoes_eletricas','Ponto de tomada/interruptor','unidade',30,45,75),
('luminaria_spot_led','instalacoes_eletricas','Luminária ou spot LED','unidade',40,60,110),
('fita_led_sanca','instalacoes_eletricas','Fita LED em sanca','metro',65,90,160),
('instalacao_chuveiro','instalacoes_eletricas','Instalação de chuveiro','unidade',100,150,250)
on conflict(service_id) do nothing;
create table if not exists public.pricing_config (
 id smallint primary key default 1 check(id=1),
 pro_labore_mensal numeric(12,2) not null default 10000 check(pro_labore_mensal>=0),
 despesas_operacionais_mensais numeric(12,2) not null default 3000 check(despesas_operacionais_mensais>=0),
 dias_produtivos_mes numeric(5,2) not null default 22 check(dias_produtivos_mes>0 and dias_produtivos_mes<=31),
 imposto_sobre_valor_final numeric(6,4) not null default 0.10 check(imposto_sobre_valor_final>=0 and imposto_sobre_valor_final<0.8),
 logistica_diaria_obra_pequena numeric(12,2) not null default 150 check(logistica_diaria_obra_pequena>=0),
 limiar_soma_medidas numeric(12,2) not null default 30 check(limiar_soma_medidas>=0),
 limite_distancia_km numeric(12,2) not null default 15 check(limite_distancia_km>=0),
 sobretaxa_distancia_sobre_servicos numeric(6,4) not null default 0.15 check(sobretaxa_distancia_sobre_servicos>=0 and sobretaxa_distancia_sobre_servicos<1),
 margem_minima_alvo numeric(6,4) not null default 0.20 check(margem_minima_alvo>=0 and margem_minima_alvo<0.8)
);
insert into public.pricing_config(id) values(1) on conflict(id) do nothing;
create table if not exists public.quote_pricing_snapshots(
 request_id uuid primary key references public.quote_requests(id) on delete cascade,
 padrao text not null check(padrao in ('baixo','medio','alto')),
 dias_estimados_obra integer not null check(dias_estimados_obra>0),
 distancia_km numeric(10,2) not null check(distancia_km>=0),
 itens jsonb not null,parametros jsonb not null,calculo jsonb not null,
 total_bruto numeric(14,2) not null check(total_bruto>=0),
 created_at timestamptz not null default now()
);
create index if not exists quote_pricing_snapshots_total on public.quote_pricing_snapshots(total_bruto);
alter table public.pricing_catalog enable row level security;
alter table public.pricing_config enable row level security;
alter table public.quote_pricing_snapshots enable row level security;
revoke all on public.pricing_catalog,public.pricing_config,public.quote_pricing_snapshots from public,anon,authenticated;
grant select,insert,update,delete on public.pricing_catalog,public.pricing_config,public.quote_pricing_snapshots to service_role;
