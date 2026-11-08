-- Adição reversível, sem modificar orçamentos, custos, equipe ou preços históricos.
-- Objetivo: condições comerciais opcionais exibidas apenas na página de encerramento.
alter table public.cv_budget_drafts_v1
 add column if not exists commercial jsonb not null default '{}'::jsonb
 check (jsonb_typeof(commercial) = 'object');
-- RLS de cv_budget_drafts_v1 permanece habilitada e inalterada.
