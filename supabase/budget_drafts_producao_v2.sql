-- CIVOLTEN: remover somente a restricao antiga dos orcamentos de demonstracao.
-- Preserva todos os registros e a politica RLS existentes.
begin;
alter table public.cv_budget_drafts_v1
 drop constraint if exists cv_budget_drafts_v1_demo_check;
alter table public.cv_budget_drafts_v1
 alter column demo set default false;
commit;
