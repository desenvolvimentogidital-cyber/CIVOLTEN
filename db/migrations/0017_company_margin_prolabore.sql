-- CIVOLTEN: configuracao de margem alvo e pro-labore. Nao alterar BDI historico.
-- Por escolha expressa, margem de 30% sobre receita e pro-labore R$10.000/mes.
-- Custos indiretos existentes em company_overhead_config permanecem inalterados.
CREATE TABLE IF NOT EXISTS company_pricing_config (
 singleton INTEGER PRIMARY KEY DEFAULT 1 CHECK (singleton=1),
 target_margin_pct NUMERIC(5,2) NOT NULL CHECK (target_margin_pct BETWEEN 0 AND 80),
 owner_prolabore_monthly NUMERIC(14,2) NOT NULL CHECK (owner_prolabore_monthly BETWEEN 0 AND 10000000),
 updated_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO company_pricing_config(singleton,target_margin_pct,owner_prolabore_monthly)
 VALUES (1,30.00,10000.00)
 ON CONFLICT(singleton) DO NOTHING;
