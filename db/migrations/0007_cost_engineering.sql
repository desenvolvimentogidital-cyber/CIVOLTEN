-- CIVOLTEN etapa 2: fichas verificáveis dos custos e revisão comercial
CREATE TABLE IF NOT EXISTS budget_costing_profiles (
  budget_id UUID PRIMARY KEY REFERENCES budgets(id) ON DELETE CASCADE,
  bdi_components JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(bdi_components)='object'),
  contingency_pct NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK(contingency_pct BETWEEN 0 AND 100),
  bdi_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  technical_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  commercial_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  review_notes TEXT,
  reviewed_by UUID REFERENCES app_users(id),
  updated_by UUID REFERENCES app_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS budget_item_cost_reviews (
  budget_item_id UUID PRIMARY KEY REFERENCES budget_items(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL','SIURB','COTACAO')),
  reference_price_id UUID REFERENCES reference_prices(id) ON DELETE RESTRICT,
  category TEXT,
  quantity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  composition_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  supplier_quote_verified BOOLEAN NOT NULL DEFAULT FALSE,
  supplier_name TEXT,
  quote_reference TEXT,
  quote_date DATE,
  quote_unit_cost NUMERIC(18,4) CHECK(quote_unit_cost>=0),
  loss_pct NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK(loss_pct BETWEEN 0 AND 100),
  freight_unit_cost NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(freight_unit_cost>=0),
  other_unit_cost NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(other_unit_cost>=0),
  notes TEXT,
  reviewed_by UUID REFERENCES app_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(source<>'SIURB' OR reference_price_id IS NOT NULL),
  CHECK(source<>'COTACAO' OR supplier_name IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS budget_extra_direct_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('mobilizacao','frete','equipamento','descarte','indireto_local','outro')),
  amount NUMERIC(18,2) NOT NULL CHECK(amount>=0),
  included_in_unit_prices BOOLEAN NOT NULL DEFAULT FALSE,
  supplier_name TEXT,
  quote_reference TEXT,
  quote_date DATE,
  created_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_extra_costs_budget ON budget_extra_direct_costs(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_cost_reviews_source ON budget_item_cost_reviews(source);
