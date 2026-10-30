-- CIVOLTEN Etapa 4 — receita recebida e estimativa de custo a completar.
-- Todas as evidências iniciam pendentes e exigem conferência por outra pessoa.
-- Nenhuma tabela abaixo emite nota fiscal, proposta ou assina contrato.
CREATE TABLE IF NOT EXISTS budget_cash_receipts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
 amount NUMERIC(18,2) NOT NULL CHECK (amount > 0 AND amount <= 100000000),
 received_on DATE NOT NULL,
 method TEXT NOT NULL CHECK (method IN ('pix','transferencia','boleto','cartao','dinheiro','outro')),
 payer_name TEXT NOT NULL CHECK (length(trim(payer_name)) BETWEEN 3 AND 180),
 evidence_ref TEXT NOT NULL CHECK (length(trim(evidence_ref)) BETWEEN 6 AND 180),
 evidence_notes TEXT NOT NULL CHECK (length(trim(evidence_notes)) BETWEEN 15 AND 1500),
 status TEXT NOT NULL DEFAULT 'pendente'
   CHECK (status IN ('pendente','validado','rejeitado')),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reviewed_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
 reviewed_at TIMESTAMPTZ,
 review_notes TEXT,
 UNIQUE (budget_id,evidence_ref),
 CONSTRAINT receipts_review_integrity CHECK (
  (status='pendente' AND reviewed_by IS NULL AND reviewed_at IS NULL)
  OR (status IN ('validado','rejeitado') AND reviewed_by IS NOT NULL
   AND reviewed_at IS NOT NULL AND review_notes IS NOT NULL
   AND length(trim(review_notes)) >= 15 AND reviewed_by <> created_by)
 )
);
CREATE INDEX IF NOT EXISTS idx_receipts_budget ON budget_cash_receipts(budget_id,received_on DESC);

CREATE TABLE IF NOT EXISTS budget_completion_forecasts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
 expected_remaining_cost NUMERIC(18,2) NOT NULL CHECK (
   expected_remaining_cost >= 0 AND expected_remaining_cost <= 100000000),
 as_of DATE NOT NULL,
 evidence_ref TEXT NOT NULL CHECK (length(trim(evidence_ref)) BETWEEN 6 AND 180),
 assumptions TEXT NOT NULL CHECK (length(trim(assumptions)) BETWEEN 20 AND 3000),
 includes_pending_costs BOOLEAN NOT NULL DEFAULT false,
 status TEXT NOT NULL DEFAULT 'pendente' CHECK (
   status IN ('pendente','validado','rejeitado')),
 created_by UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reviewed_by UUID REFERENCES app_users(id) ON DELETE RESTRICT,
 reviewed_at TIMESTAMPTZ,
 review_notes TEXT,
 UNIQUE (budget_id,evidence_ref),
 CONSTRAINT completion_review_integrity CHECK (
  (status='pendente' AND reviewed_by IS NULL AND reviewed_at IS NULL)
  OR (status IN ('validado','rejeitado') AND reviewed_by IS NOT NULL
   AND reviewed_at IS NOT NULL AND review_notes IS NOT NULL
   AND length(trim(review_notes)) >= 15 AND reviewed_by <> created_by)
 )
);
CREATE INDEX IF NOT EXISTS idx_completion_budget ON budget_completion_forecasts(budget_id,created_at DESC);
