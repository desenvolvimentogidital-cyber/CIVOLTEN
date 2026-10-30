-- CIVOLTEN: catálogo de custos INTERNOS para planejamento, sem preços fictícios.
-- Dados de pessoas limitados a nome profissional (sem CPF, contatos ou dados sensíveis extras).
-- Não altera valores SIURB, orçamento, contratos, propostas nem despesas realizadas.
CREATE TABLE IF NOT EXISTS company_labor_rates (
 role_code TEXT PRIMARY KEY CHECK (length(trim(role_code)) BETWEEN 1 AND 40),
 role_name TEXT NOT NULL CHECK (length(trim(role_name)) BETWEEN 2 AND 140),
 hourly_employer_cost NUMERIC(12,2) NOT NULL CHECK (hourly_employer_cost >= 0 AND hourly_employer_cost <= 1000000),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS company_overhead_config (
 singleton INTEGER PRIMARY KEY DEFAULT 1 CHECK (singleton=1),
 monthly_overhead NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monthly_overhead BETWEEN 0 AND 100000000),
 workdays_per_month INTEGER NOT NULL DEFAULT 22 CHECK (workdays_per_month BETWEEN 15 AND 31),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS company_workers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 2 AND 160),
 role_code TEXT NOT NULL CHECK (length(trim(role_code)) BETWEEN 1 AND 40),
 role_name TEXT NOT NULL CHECK (length(trim(role_name)) BETWEEN 2 AND 140),
 monthly_employer_cost NUMERIC(12,2) NOT NULL CHECK (monthly_employer_cost BETWEEN 0 AND 1000000),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_workers_role ON company_workers(role_code,active);
