-- CIVOLTEN Etapa 3: evidências reais de produtividade por atividade e data.
-- Sempre inserção pendente; revisão é ato separado do administrador/revisor.
-- Não altera preços, BDI, contratos nem libera orçamento comercial.
CREATE TABLE IF NOT EXISTS schedule_progress_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
  task_id UUID NOT NULL REFERENCES schedule_tasks(id) ON DELETE RESTRICT,
  worked_on DATE NOT NULL,
  completed_quantity NUMERIC(16,4) NOT NULL CHECK (completed_quantity>0 AND completed_quantity<=1000000),
  workers INTEGER NOT NULL CHECK (workers BETWEEN 1 AND 100),
  hours_per_worker NUMERIC(8,4) NOT NULL CHECK (hours_per_worker>0 AND hours_per_worker<=12),
  actual_person_hours NUMERIC(18,4) GENERATED ALWAYS AS (workers * hours_per_worker) STORED,
  evidence_ref TEXT NOT NULL CHECK (length(trim(evidence_ref)) BETWEEN 6 AND 180),
  evidence_notes TEXT NOT NULL CHECK (length(trim(evidence_notes)) BETWEEN 15 AND 1500),
  review_status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (review_status IN ('pendente','validado')),
  created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  CONSTRAINT schedule_progress_review_integrity CHECK
   ((review_status='pendente' AND reviewed_by IS NULL AND reviewed_at IS NULL)
     OR (review_status='validado' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
      AND review_notes IS NOT NULL AND length(trim(review_notes))>=15)),
  CONSTRAINT schedule_progress_unique_task_date UNIQUE(task_id,worked_on)
);
CREATE INDEX IF NOT EXISTS idx_schedule_progress_budget ON schedule_progress_measurements(budget_id,task_id,worked_on DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_progress_validated ON schedule_progress_measurements(task_id,worked_on) WHERE review_status='validado';
