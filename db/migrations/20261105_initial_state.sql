-- CIVOLTEN novo Neon / 2026-11-05
-- Executado em "civolten-novo-2026" (Postgres 17, São Paulo).
-- Sem cópia, exclusão ou mudança no banco Neon antigo.
CREATE SCHEMA IF NOT EXISTS civolten_app;
CREATE TABLE IF NOT EXISTS civolten_app.user_state (
  auth_user_id text PRIMARY KEY CHECK (length(auth_user_id) BETWEEN 1 AND 200),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  data jsonb NOT NULL CHECK (
    jsonb_typeof(data)='object' AND
    jsonb_typeof(data->'clients')='array' AND
    jsonb_typeof(data->'quotes')='array'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS civolten_app.user_state_history (
  auth_user_id text NOT NULL REFERENCES civolten_app.user_state(auth_user_id) ON DELETE RESTRICT,
  revision bigint NOT NULL CHECK (revision >= 1),
  data jsonb NOT NULL CHECK (jsonb_typeof(data)='object'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(auth_user_id, revision)
);
CREATE OR REPLACE FUNCTION civolten_app.archive_previous_state()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.revision <> OLD.revision + 1 THEN
   RAISE EXCEPTION 'Revisão inválida: atualização deve incrementar em 1';
 END IF;
 INSERT INTO civolten_app.user_state_history(auth_user_id,revision,data,recorded_at)
 VALUES (OLD.auth_user_id,OLD.revision,OLD.data,OLD.updated_at);
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_archive_previous_state ON civolten_app.user_state;
CREATE TRIGGER trg_archive_previous_state BEFORE UPDATE ON civolten_app.user_state
 FOR EACH ROW EXECUTE FUNCTION civolten_app.archive_previous_state();
REVOKE ALL ON SCHEMA civolten_app FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA civolten_app FROM PUBLIC;
CREATE TABLE IF NOT EXISTS civolten_app.schema_migrations (
  version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO civolten_app.schema_migrations(version)
VALUES ('2026-11-05-initial-state') ON CONFLICT DO NOTHING;
