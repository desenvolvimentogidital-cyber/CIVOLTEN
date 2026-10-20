-- Referências CUB-SP por tipo R1, competência e encargos.
-- Nunca insere automaticamente custos básicos em preços comerciais CIVOLTEN.
CREATE TABLE IF NOT EXISTS public.cub_reference_rates (
 uf text NOT NULL CHECK (uf='SP'),
 base_month text NOT NULL CHECK (base_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 pattern text NOT NULL CHECK (pattern IN ('R1B','R1N','R1A')),
 regime text NOT NULL CHECK (regime IN ('sem_desoneracao','com_desoneracao')),
 unit_cost numeric(14,2) NOT NULL CHECK (unit_cost>0 AND unit_cost<=100000),
 source_url text NOT NULL CHECK (length(source_url) BETWEEN 15 AND 500 AND source_url LIKE 'https://%'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(uf,base_month,pattern,regime)
);
CREATE INDEX IF NOT EXISTS cub_reference_period_idx ON public.cub_reference_rates(base_month DESC);
ALTER TABLE public.cub_reference_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cub_reference_rates FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.cub_reference_rates TO service_role;
