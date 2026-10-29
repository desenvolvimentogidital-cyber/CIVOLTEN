-- Etapa 1: senhas iniciais precisam ser substituídas antes de liberar cadastros.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
-- Corrigir exclusivamente a conta inicial ainda não utilizada.
UPDATE app_users SET must_change_password = true
WHERE login = 'admin' AND role = 'administrador' AND last_login_at IS NULL;
