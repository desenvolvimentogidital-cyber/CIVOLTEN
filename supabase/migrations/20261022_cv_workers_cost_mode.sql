-- Modalidade de cobranca: salario mensal recorrente ou mao de obra por obra.
-- Profissionais atuais passam a integrar automaticamente a folha fixa mensal.
-- Os trabalhadores contratados por obra ficam fora da folha e sao adicionados
-- individualmente ao orçamento quando necessarios.
alter table public.cv_workers
 add column if not exists cost_mode text not null default 'monthly'
 check (cost_mode in ('monthly','project'));
comment on column public.cv_workers.cost_mode is
 'monthly = custo fixo mensal pelo valor da diaria x dias no mes x encargos; project = custo sob demanda em orcamentos';
