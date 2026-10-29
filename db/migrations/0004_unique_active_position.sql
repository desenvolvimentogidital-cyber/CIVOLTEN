-- Posições só precisam ser exclusivas entre itens ativos; histórico permanece.
ALTER TABLE budget_items DROP CONSTRAINT IF EXISTS budget_items_budget_id_position_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_budget_items_active_position
  ON budget_items(budget_id,position) WHERE deleted_at IS NULL;
