-- CIVOLTEN / SIURB July 2026: distinct monthly-salaried professionals.
-- No modifications to existing horista, services, budgets, workers or prices.
-- Monthly labor file already contains official HOURLY costs both with and
-- without statutory charges. Do not divide the official tariff by workdays.
CREATE TABLE IF NOT EXISTS siurb_monthly_labor_sources(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 reference_month TEXT NOT NULL CHECK(reference_month ~ '^20[0-9]{2}-[0-9]{2}$'),
 regime TEXT NOT NULL CHECK(regime IN ('Sem desoneração','Com desoneração')),
 source_url TEXT NOT NULL CHECK(source_url LIKE 'https://smartsampa.prefeitura.sp.gov.br/documents/d/obras/%'),
 sha256 TEXT NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(reference_month,regime,sha256)
);
CREATE TABLE IF NOT EXISTS siurb_monthly_labor_prices(
 source_id UUID NOT NULL REFERENCES siurb_monthly_labor_sources(id) ON DELETE RESTRICT,
 code TEXT NOT NULL CHECK(code ~ '^[0-9]{3,9}$'),
 description TEXT NOT NULL,
 variant TEXT NOT NULL CHECK(variant IN ('sem_encargos','com_encargos')),
 unit TEXT NOT NULL DEFAULT 'H' CHECK(unit='H'),
 unit_cost NUMERIC(18,4) NOT NULL CHECK(unit_cost>0),
 PRIMARY KEY(source_id,code,variant)
);
CREATE INDEX IF NOT EXISTS idx_siurb_monthly_labor_prices_code
 ON siurb_monthly_labor_prices(code);
