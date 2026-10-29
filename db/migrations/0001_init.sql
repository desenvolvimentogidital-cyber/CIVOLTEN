-- CIVOLTEN — migração inicial PostgreSQL (ainda não aplicada; sujeita a revisão)
-- Dados financeiros com NUMERIC, nunca FLOAT. API deve aplicar autorização por usuário.
BEGIN;
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'orcamentista' CHECK(role IN ('administrador','orcamentista','revisor','consulta')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expiration ON app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK(length(btrim(name)) >= 2),
  kind TEXT NOT NULL DEFAULT 'pessoa_juridica' CHECK(kind IN ('pessoa_fisica','pessoa_juridica','condominio','outro')),
  tax_id TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  municipality TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_tax_id ON clients(tax_id) WHERE tax_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  address TEXT,
  municipality TEXT,
  site_constraints TEXT,
  scope TEXT,
  status TEXT NOT NULL DEFAULT 'planejamento',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);

CREATE TABLE IF NOT EXISTS reference_price_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK(source IN ('SIURB','PROPRIA','COTACAO')),
  reference_month CHAR(7) NOT NULL,
  regime TEXT NOT NULL,
  scope TEXT NOT NULL,
  source_url TEXT,
  sha256 CHAR(64),
  published_at DATE,
  reviewed_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source,reference_month,regime,scope,sha256)
);
CREATE TABLE IF NOT EXISTS reference_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES reference_price_versions(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_cost NUMERIC(18,4) NOT NULL CHECK(unit_cost >= 0),
  workforce_hh_direct NUMERIC(18,8),
  productivity_status TEXT NOT NULL DEFAULT 'pendente' CHECK(productivity_status IN ('pendente','direta_parcial','verificada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(version_id,code)
);
CREATE INDEX IF NOT EXISTS idx_reference_prices_code ON reference_prices(code);
CREATE TABLE IF NOT EXISTS composition_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_price_id UUID NOT NULL REFERENCES reference_prices(id) ON DELETE RESTRICT,
  input_code TEXT NOT NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  coefficient NUMERIC(20,9) NOT NULL CHECK(coefficient>=0),
  unit_cost NUMERIC(18,4) NOT NULL CHECK(unit_cost>=0),
  kind TEXT NOT NULL CHECK(kind IN ('labor','material','equipment','auxiliary','unclassified')),
  source_level TEXT NOT NULL DEFAULT 'direct',
  UNIQUE(reference_price_id,input_code,kind,source_level)
);

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES projects(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho','em_revisao','aprovado_internamente','enviado','aceito','perdido')),
  reference_month CHAR(7) NOT NULL,
  regime TEXT NOT NULL,
  bdi_pct NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK(bdi_pct BETWEEN 0 AND 100),
  contingency_pct NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK(contingency_pct BETWEEN 0 AND 100),
  schedule_safety_pct NUMERIC(8,4) NOT NULL DEFAULT 15 CHECK(schedule_safety_pct BETWEEN 0 AND 100),
  planned_start DATE,
  validity_days INTEGER NOT NULL DEFAULT 30 CHECK(validity_days BETWEEN 1 AND 365),
  payment_terms TEXT,
  scope_assumptions TEXT,
  exclusions TEXT,
  technical_review_at TIMESTAMPTZ,
  technical_review_by UUID REFERENCES app_users(id),
  cost_review_at TIMESTAMPTZ,
  cost_review_by UUID REFERENCES app_users(id),
  created_by UUID REFERENCES app_users(id),
  lock_version INTEGER NOT NULL DEFAULT 0 CHECK(lock_version >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budgets_client ON budgets(client_id);
CREATE INDEX IF NOT EXISTS idx_budgets_project ON budgets(project_id);

CREATE TABLE IF NOT EXISTS budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK(position > 0),
  reference_price_id UUID REFERENCES reference_prices(id) ON DELETE RESTRICT,
  source_code TEXT,
  source_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(18,6) NOT NULL CHECK(quantity > 0),
  direct_unit_cost NUMERIC(18,4) NOT NULL CHECK(direct_unit_cost >= 0),
  direct_labor_hh_unit NUMERIC(18,8),
  labor_review_state TEXT NOT NULL DEFAULT 'pendente',
  technical_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(budget_id,position)
);
CREATE INDEX IF NOT EXISTS idx_budget_items_budget ON budget_items(budget_id);

CREATE TABLE IF NOT EXISTS crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  workday_hours NUMERIC(5,2) NOT NULL CHECK(workday_hours BETWEEN 1 AND 12),
  efficiency NUMERIC(5,4) NOT NULL CHECK(efficiency>0 AND efficiency<=1)
);
CREATE TABLE IF NOT EXISTS crew_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL,
  role_name TEXT NOT NULL,
  workers INTEGER NOT NULL CHECK(workers > 0),
  UNIQUE(crew_id,role_code)
);
CREATE TABLE IF NOT EXISTS schedule_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  budget_item_id UUID REFERENCES budget_items(id) ON DELETE SET NULL,
  crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  start_on DATE,
  finish_on DATE,
  days_estimated NUMERIC(10,2),
  duration_review_state TEXT NOT NULL DEFAULT 'pendente',
  CHECK(finish_on IS NULL OR start_on IS NULL OR finish_on >= start_on)
);
CREATE TABLE IF NOT EXISTS task_dependencies (
  predecessor_id UUID NOT NULL REFERENCES schedule_tasks(id) ON DELETE CASCADE,
  successor_id UUID NOT NULL REFERENCES schedule_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'FS',
  lag_days NUMERIC(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY(predecessor_id,successor_id),
  CHECK(predecessor_id<>successor_id)
);

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK(version>0),
  code TEXT NOT NULL UNIQUE,
  snapshot JSONB NOT NULL,
  snapshot_sha256 CHAR(64) NOT NULL,
  pdf_object_key TEXT,
  issued_by UUID NOT NULL REFERENCES app_users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'emitida' CHECK(status IN ('emitida','enviada','aceita','cancelada')),
  UNIQUE(budget_id,version)
);
CREATE INDEX IF NOT EXISTS idx_proposals_budget ON proposals(budget_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID REFERENCES app_users(id),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type,entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at);
COMMIT;
