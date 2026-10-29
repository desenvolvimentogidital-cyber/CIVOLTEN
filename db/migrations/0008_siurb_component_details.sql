-- SIURB Julho/2026: preserve direct component lists with source provenance.
-- Auxiliary compositions are not expanded; no unit-cost inference from these lists.
CREATE TABLE IF NOT EXISTS reference_composition_details (
  reference_price_id UUID PRIMARY KEY REFERENCES reference_prices(id) ON DELETE RESTRICT,
  labor JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(labor)='array'),
  other JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(other)='array'),
  direct_hh_per_unit NUMERIC(18,8) CHECK(direct_hh_per_unit>=0),
  validation TEXT NOT NULL DEFAULT 'apenas_direta',
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
