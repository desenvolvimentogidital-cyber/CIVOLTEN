-- Etapa 4 — rascunhos de proposta NÃO comerciais e custos realizados com evidência.
CREATE TABLE IF NOT EXISTS proposal_draft_snapshots (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 99999),
 budget_lock_version INTEGER NOT NULL CHECK(budget_lock_version>=0),
 snapshot JSONB NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 snapshot_sha256 TEXT NOT NULL CHECK(snapshot_sha256 ~ '^[a-f0-9]{64}$'),
 status TEXT NOT NULL DEFAULT 'rascunho' CHECK(status='rascunho'),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(budget_id,version)
);
CREATE INDEX IF NOT EXISTS idx_proposal_drafts_latest ON proposal_draft_snapshots(budget_id,version DESC);

CREATE TABLE IF NOT EXISTS budget_actual_costs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
 category TEXT NOT NULL CHECK(category IN ('mao_de_obra','material','equipamento','frete','servico_terceiro','outro')),
 description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 5 AND 250),
 amount NUMERIC(18,2) NOT NULL CHECK(amount>0 AND amount<=100000000),
 incurred_on DATE NOT NULL,
 evidence_ref TEXT NOT NULL CHECK(length(trim(evidence_ref)) BETWEEN 6 AND 180),
 evidence_notes TEXT NOT NULL CHECK(length(trim(evidence_notes)) BETWEEN 15 AND 1500),
 status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','validado','rejeitado')),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reviewed_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
 reviewed_at TIMESTAMPTZ,
 review_notes TEXT,
 UNIQUE(budget_id,evidence_ref),
 CONSTRAINT budget_actual_costs_review_integrity CHECK(
  (status='pendente' AND reviewed_by IS NULL AND reviewed_at IS NULL)
  OR (status IN ('validado','rejeitado') AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL AND review_notes IS NOT NULL AND length(trim(review_notes))>=15)
 )
);
CREATE INDEX IF NOT EXISTS idx_budget_actual_by_budget ON budget_actual_costs(budget_id,incurred_on DESC);
