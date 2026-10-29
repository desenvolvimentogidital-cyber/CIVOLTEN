-- Etapa 1: impedir que orçamento e obra pertençam a clientes diferentes.
-- A integridade deve valer mesmo com sessões simultâneas ou erros de API.
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projects_id_client_key') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_id_client_key UNIQUE(id,client_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='budgets_project_client_fk') THEN
    ALTER TABLE budgets ADD CONSTRAINT budgets_project_client_fk
      FOREIGN KEY(project_id,client_id) REFERENCES projects(id,client_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
END
$migration$;
