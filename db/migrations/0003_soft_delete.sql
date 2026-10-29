-- Exclusão lógica para rastreabilidade e proteção contra perda de dados.
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_status_check;
ALTER TABLE budgets ADD CONSTRAINT budgets_status_check CHECK (status IN
 ('rascunho','em_revisao','aprovado_internamente','enviado','aceito','perdido','cancelado'));
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_budget_items_active ON budget_items(budget_id,position) WHERE deleted_at IS NULL;
