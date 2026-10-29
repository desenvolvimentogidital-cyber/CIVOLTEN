-- CIVOLTEN / Etapa 2: fonte oficial suplementar SIURB Jul/2026.
-- Não modifica preços de serviços existentes e não habilita emissão comercial.
CREATE TABLE IF NOT EXISTS siurb_supplement_sources (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 reference_month TEXT NOT NULL CHECK(reference_month ~ '^20[0-9]{2}-[0-9]{2}$'),
 regime TEXT NOT NULL CHECK(regime IN ('Sem desoneração','Com desoneração')),
 kind TEXT NOT NULL CHECK(kind IN ('horista','equipamentos','insumos','auxiliares')),
 source_url TEXT NOT NULL CHECK(source_url LIKE 'https://smartsampa.prefeitura.sp.gov.br/documents/d/obras/%'),
 sha256 TEXT NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(reference_month,regime,kind,sha256)
);
CREATE INDEX IF NOT EXISTS idx_siurb_supp_source_lookup ON siurb_supplement_sources(reference_month,regime,kind,imported_at DESC);

CREATE TABLE IF NOT EXISTS siurb_supplement_prices (
 source_id UUID NOT NULL REFERENCES siurb_supplement_sources(id) ON DELETE RESTRICT,
 code TEXT NOT NULL CHECK(code ~ '^[0-9]{3,9}$'),
 description TEXT NOT NULL CHECK(length(trim(description))>0),
 unit TEXT NOT NULL CHECK(length(trim(unit))>0),
 kind TEXT NOT NULL CHECK(kind IN ('horista','equipamentos','insumos')),
 variant TEXT NOT NULL CHECK(variant IN ('sem_encargos','com_encargos','operacao','disponibilidade','padrao')),
 unit_cost NUMERIC(18,4) NOT NULL CHECK(unit_cost>0),
 PRIMARY KEY(source_id,code,variant)
);
CREATE INDEX IF NOT EXISTS idx_siurb_supp_price_code ON siurb_supplement_prices(code);

CREATE TABLE IF NOT EXISTS siurb_auxiliary_compositions (
 source_id UUID NOT NULL REFERENCES siurb_supplement_sources(id) ON DELETE RESTRICT,
 code TEXT NOT NULL CHECK(code ~ '^[0-9]{3,9}$'),
 description TEXT NOT NULL CHECK(length(trim(description))>0),
 unit TEXT NOT NULL CHECK(length(trim(unit))>0),
 official_unit_cost NUMERIC(18,4) NOT NULL CHECK(official_unit_cost>=0),
 components JSONB NOT NULL CHECK(jsonb_typeof(components)='array'),
 sum_official_partials NUMERIC(18,2) NOT NULL DEFAULT 0,
 difference_to_official NUMERIC(18,2) NOT NULL DEFAULT 0,
 arithmetically_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
 commercially_approved BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(source_id,code),
 CHECK(commercially_approved=FALSE)
);
CREATE INDEX IF NOT EXISTS idx_siurb_aux_lookup ON siurb_auxiliary_compositions(code);
