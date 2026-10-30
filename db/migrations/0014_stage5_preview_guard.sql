-- Etapa 5: identificador de isolamento exclusivo de ambientes de prévia.
-- A migração cria apenas a tabela, nunca semeia identificadores em produção.
CREATE TABLE IF NOT EXISTS deployment_environment_guards (
 environment TEXT PRIMARY KEY CHECK (environment IN ('preview')),
 branch_id TEXT NOT NULL CHECK (branch_id ~ '^br-[a-z0-9-]+$'),
 registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE deployment_environment_guards IS
'Controle de defesa extra: a Vercel preview só pode gravar se o ID esperado coincide com a branch de homologação explicitamente marcada no banco. Nunca semear na produção.';
