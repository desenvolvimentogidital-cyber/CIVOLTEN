-- CIVOLTEN 0016: frentes e dependências de serviços SEM exigir equipes cadastradas.
-- Somente configuração; dados de orçamento existentes permanecem inalterados.
CREATE TABLE IF NOT EXISTS budget_service_planning (
 budget_item_id UUID PRIMARY KEY REFERENCES budget_items(id) ON DELETE RESTRICT,
 budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
 work_front VARCHAR(80) NOT NULL DEFAULT 'Geral' CHECK(length(trim(work_front)) BETWEEN 1 AND 80),
 wait_workdays INTEGER NOT NULL DEFAULT 0 CHECK(wait_workdays BETWEEN 0 AND 60),
 updated_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_service_planning_budget ON budget_service_planning(budget_id);
CREATE TABLE IF NOT EXISTS budget_service_dependencies (
 budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
 predecessor_item_id UUID NOT NULL REFERENCES budget_items(id) ON DELETE RESTRICT,
 successor_item_id UUID NOT NULL REFERENCES budget_items(id) ON DELETE RESTRICT,
 lag_workdays INTEGER NOT NULL DEFAULT 0 CHECK(lag_workdays BETWEEN 0 AND 60),
 created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(predecessor_item_id,successor_item_id),
 CONSTRAINT budget_service_dependencies_not_self CHECK(predecessor_item_id<>successor_item_id)
);
CREATE INDEX IF NOT EXISTS idx_budget_service_dependencies_budget ON budget_service_dependencies(budget_id);
