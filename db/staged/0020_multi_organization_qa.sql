-- STAGING ONLY: execute on disposable PostgreSQL for cross-tenant authorization tests.
-- DO NOT deploy this file to the live Neon database without release preflight.
BEGIN;
CREATE TABLE IF NOT EXISTS organizations (
 id UUID PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 250),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO organizations(id,name)
 VALUES('00000000-0000-4000-8000-000000000001','CIVOLTEN (registros legados)')
 ON CONFLICT(id) DO NOTHING;

-- Existing internal users remain active; new signups must verify e-mail.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS organization_id UUID
 NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'
 REFERENCES organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_users_organization ON app_users(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_id_org ON app_users(id,organization_id);

-- Once the tenant context is supplied by the server, ALL new rows default to
-- that organization. Unscoped bootstrap/legacy SQL falls back to the legacy
-- organization ONLY for backward compatibility, not as authorization.
DO $isolation$
DECLARE tbl TEXT;
BEGIN
 FOREACH tbl IN ARRAY ARRAY[
  'clients','projects','budgets','budget_items','budget_item_cost_reviews',
  'budget_costing_profiles','budget_extra_direct_costs','budget_service_planning',
  'budget_service_dependencies','company_workers','company_labor_rates',
  'company_overhead_config','company_pricing_config','crews','crew_roles',
  'schedule_tasks','schedule_progress_measurements','task_dependencies',
  'proposal_draft_snapshots','proposals','budget_actual_costs',
  'budget_cash_receipts','budget_completion_forecasts','audit_events'
 ] LOOP
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id UUID',tbl);
  EXECUTE format('UPDATE %I SET organization_id = $1 WHERE organization_id IS NULL',tbl)
     USING '00000000-0000-4000-8000-000000000001'::uuid;
  EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL',tbl);
  EXECUTE format($q$ALTER TABLE %I ALTER COLUMN organization_id SET DEFAULT
   coalesce(nullif(current_setting('civolten.organization_id',true),'')::uuid,
            '00000000-0000-4000-8000-000000000001'::uuid)$q$,tbl);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (organization_id)',
   'idx_'||tbl||'_organization',tbl);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format($q$CREATE POLICY tenant_only ON %I
   FOR ALL USING (organization_id=nullif(current_setting('civolten.organization_id',true),'')::uuid)
   WITH CHECK (organization_id=nullif(current_setting('civolten.organization_id',true),'')::uuid)$q$,tbl);
 END LOOP;
END;
$isolation$;

-- Make company-wide settings independent for each account. Existing rows and
-- numeric settings are preserved in the legacy organization.
ALTER TABLE company_labor_rates DROP CONSTRAINT IF EXISTS company_labor_rates_pkey;
ALTER TABLE company_labor_rates ADD CONSTRAINT company_labor_rates_pkey
 PRIMARY KEY(organization_id,role_code);
ALTER TABLE company_overhead_config DROP CONSTRAINT IF EXISTS company_overhead_config_pkey;
ALTER TABLE company_overhead_config ADD CONSTRAINT company_overhead_config_pkey
 PRIMARY KEY(organization_id,singleton);
ALTER TABLE company_pricing_config DROP CONSTRAINT IF EXISTS company_pricing_config_pkey;
ALTER TABLE company_pricing_config ADD CONSTRAINT company_pricing_config_pkey
 PRIMARY KEY(organization_id,singleton);
DROP INDEX IF EXISTS uq_clients_tax_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_org_tax_id
 ON clients(organization_id,tax_id) WHERE tax_id IS NOT NULL;

-- Composite foreign keys prevent an A-owned record pointing to B-owned
-- clients, budgets, employees, crews, or tasks even when UUIDs are guessed.
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_id ON clients(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_org_id ON projects(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_budgets_org_id ON budgets(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_budget_items_org_id ON budget_items(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_crews_org_id ON crews(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_schedule_tasks_org_id ON schedule_tasks(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_proposal_drafts_org_id ON proposal_draft_snapshots(id,organization_id);

ALTER TABLE projects ADD CONSTRAINT fk_projects_org_client
 FOREIGN KEY(client_id,organization_id) REFERENCES clients(id,organization_id);
ALTER TABLE budgets ADD CONSTRAINT fk_budgets_org_client
 FOREIGN KEY(client_id,organization_id) REFERENCES clients(id,organization_id);
ALTER TABLE budgets ADD CONSTRAINT fk_budgets_org_project
 FOREIGN KEY(project_id,organization_id) REFERENCES projects(id,organization_id);
ALTER TABLE budget_items ADD CONSTRAINT fk_budget_items_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);
ALTER TABLE budget_item_cost_reviews ADD CONSTRAINT fk_item_reviews_org_item
 FOREIGN KEY(budget_item_id,organization_id) REFERENCES budget_items(id,organization_id);
ALTER TABLE budget_costing_profiles ADD CONSTRAINT fk_cost_profiles_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);
ALTER TABLE budget_extra_direct_costs ADD CONSTRAINT fk_extra_costs_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);
ALTER TABLE budget_service_planning ADD CONSTRAINT fk_service_plan_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);
ALTER TABLE budget_service_planning ADD CONSTRAINT fk_service_plan_org_item
 FOREIGN KEY(budget_item_id,organization_id) REFERENCES budget_items(id,organization_id);
ALTER TABLE budget_service_dependencies ADD CONSTRAINT fk_service_deps_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);
ALTER TABLE budget_service_dependencies ADD CONSTRAINT fk_service_deps_org_from
 FOREIGN KEY(predecessor_item_id,organization_id) REFERENCES budget_items(id,organization_id);
ALTER TABLE budget_service_dependencies ADD CONSTRAINT fk_service_deps_org_to
 FOREIGN KEY(successor_item_id,organization_id) REFERENCES budget_items(id,organization_id);
ALTER TABLE crews ADD CONSTRAINT fk_crews_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);
ALTER TABLE crew_roles ADD CONSTRAINT fk_crew_roles_org_crew
 FOREIGN KEY(crew_id,organization_id) REFERENCES crews(id,organization_id);
ALTER TABLE schedule_tasks ADD CONSTRAINT fk_schedule_tasks_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);
ALTER TABLE schedule_tasks ADD CONSTRAINT fk_schedule_tasks_org_crew
 FOREIGN KEY(crew_id,organization_id) REFERENCES crews(id,organization_id);
ALTER TABLE schedule_tasks ADD CONSTRAINT fk_schedule_tasks_org_item
 FOREIGN KEY(budget_item_id,organization_id) REFERENCES budget_items(id,organization_id);
ALTER TABLE task_dependencies ADD CONSTRAINT fk_task_dependencies_org_before
 FOREIGN KEY(predecessor_id,organization_id) REFERENCES schedule_tasks(id,organization_id);
ALTER TABLE task_dependencies ADD CONSTRAINT fk_task_dependencies_org_after
 FOREIGN KEY(successor_id,organization_id) REFERENCES schedule_tasks(id,organization_id);
ALTER TABLE schedule_progress_measurements ADD CONSTRAINT fk_progress_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);
ALTER TABLE schedule_progress_measurements ADD CONSTRAINT fk_progress_org_task
 FOREIGN KEY(task_id,organization_id) REFERENCES schedule_tasks(id,organization_id);
ALTER TABLE proposal_draft_snapshots ADD CONSTRAINT fk_drafts_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);
ALTER TABLE proposals ADD CONSTRAINT fk_proposals_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);
ALTER TABLE budget_actual_costs ADD CONSTRAINT fk_actuals_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);
ALTER TABLE budget_cash_receipts ADD CONSTRAINT fk_receipts_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);
ALTER TABLE budget_completion_forecasts ADD CONSTRAINT fk_forecasts_org_budget
 FOREIGN KEY(budget_id,organization_id) REFERENCES budgets(id,organization_id);

-- Non-tenant public login rate limiting must NOT be written into customer audit
-- logs before the account is resolved.
CREATE TABLE IF NOT EXISTS auth_login_attempts(
 fingerprint CHAR(64) NOT NULL,
 attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_login_attempts
 ON auth_login_attempts(fingerprint,attempted_at DESC);
CREATE TABLE IF NOT EXISTS auth_signup_attempts(
 fingerprint CHAR(64) NOT NULL,
 attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_signup_attempts
 ON auth_signup_attempts(fingerprint,attempted_at DESC);

CREATE TABLE IF NOT EXISTS account_action_tokens(
 token_hash CHAR(64) PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL,
 consumed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_action_tokens_user_purpose
 ON account_action_tokens(user_id,purpose,created_at DESC);
-- Account identities and session tokens are private tenant resources too.
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_only ON app_users FOR ALL
 USING (organization_id=nullif(current_setting('civolten.organization_id',true),'')::uuid)
 WITH CHECK (organization_id=nullif(current_setting('civolten.organization_id',true),'')::uuid);

ALTER TABLE app_sessions ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE app_sessions s SET organization_id=u.organization_id
 FROM app_users u WHERE s.user_id=u.id AND s.organization_id IS NULL;
ALTER TABLE app_sessions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE app_sessions ALTER COLUMN organization_id SET DEFAULT
 nullif(current_setting('civolten.organization_id',true),'')::uuid;
CREATE INDEX IF NOT EXISTS idx_app_sessions_org ON app_sessions(organization_id);
ALTER TABLE app_sessions ADD CONSTRAINT fk_sessions_org_user
 FOREIGN KEY(user_id,organization_id) REFERENCES app_users(id,organization_id);
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_only ON app_sessions FOR ALL
 USING (organization_id=nullif(current_setting('civolten.organization_id',true),'')::uuid)
 WITH CHECK (organization_id=nullif(current_setting('civolten.organization_id',true),'')::uuid);

-- SECURITY DEFINER functions are deliberately narrow: they only return the
-- minimal data needed to start an authenticated tenant transaction.
-- Functions are owned by the migrator, not by the no-BYPASSRLS application.
CREATE OR REPLACE FUNCTION public.civolten_auth_session(p_hash TEXT)
 RETURNS TABLE(id UUID,login TEXT,role TEXT,must_change_password BOOLEAN,organization_id UUID)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
 SELECT u.id,u.login,u.role,u.must_change_password,u.organization_id
 FROM public.app_sessions s JOIN public.app_users u ON u.id=s.user_id
 WHERE s.token_hash=p_hash AND s.revoked_at IS NULL AND s.expires_at>now()
  AND u.is_active=true LIMIT 1
 $fn$;

CREATE OR REPLACE FUNCTION public.civolten_auth_login(p_login TEXT)
 RETURNS TABLE(id UUID,login TEXT,password_hash TEXT,role TEXT,must_change_password BOOLEAN,organization_id UUID)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
 SELECT id,login,password_hash,role,must_change_password,organization_id
 FROM public.app_users WHERE login=p_login AND is_active=true LIMIT 1
 $fn$;

CREATE OR REPLACE FUNCTION public.civolten_auth_user(p_login TEXT,p_purpose TEXT)
 RETURNS TABLE(id UUID,organization_id UUID)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
 SELECT id,organization_id FROM public.app_users
 WHERE login=p_login AND
 ((p_purpose='exists') OR
  (p_purpose='verify' AND email_verified_at IS NULL AND is_active=false) OR
  (p_purpose='reset' AND email_verified_at IS NOT NULL AND is_active=true))
 LIMIT 1
 $fn$;

CREATE OR REPLACE FUNCTION public.civolten_auth_token_org(p_hash TEXT,p_purpose TEXT)
 RETURNS TABLE(organization_id UUID)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
 SELECT u.organization_id FROM public.account_action_tokens t
 JOIN public.app_users u ON u.id=t.user_id
 WHERE t.token_hash=p_hash AND t.purpose=p_purpose
  AND t.consumed_at IS NULL AND t.expires_at>now() LIMIT 1
 $fn$;

REVOKE ALL ON FUNCTION public.civolten_auth_session(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.civolten_auth_login(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.civolten_auth_user(TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.civolten_auth_token_org(TEXT,TEXT) FROM PUBLIC;
-- CI grants EXECUTE only to its disposable app role. A production role must
-- be granted explicitly, after sign-off and RLS isolation validation.

COMMIT;
