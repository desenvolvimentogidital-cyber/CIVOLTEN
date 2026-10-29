-- Migração 0002: impede duas inicializações administrativas simultâneas.
-- O primeiro administrador só pode ser criado uma vez por banco.
CREATE TABLE IF NOT EXISTS app_bootstrap_lock (
  singleton SMALLINT PRIMARY KEY CHECK(singleton=1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
