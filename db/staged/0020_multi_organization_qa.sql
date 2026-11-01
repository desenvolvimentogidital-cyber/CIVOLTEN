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

COMMIT;
