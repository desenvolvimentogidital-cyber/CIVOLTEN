-- CIVOLTEN etapa 3: arquivamento lógico, nunca exclui diário de execução.
ALTER TABLE crews ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE schedule_tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_crews_active_budget ON crews(budget_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_active_budget ON schedule_tasks(budget_id) WHERE archived_at IS NULL;
