-- Etapa 1: um orçamento deve pertencer ao mesmo cliente que a obra vinculada.
-- Migrar uma única vez, após os checks de integridade do CI.
CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_id_client ON projects(id,client_id);
ALTER TABLE budgets ADD CONSTRAINT budgets_project_client_fk
  FOREIGN KEY(project_id,client_id) REFERENCES projects(id,client_id)
  ON UPDATE RESTRICT ON DELETE RESTRICT;
