# Auditoria de segurança e desempenho — 22/11/2026

## Corrigido
- Dez índices de apoio a chaves estrangeiras criados no Supabase, sem alterar dados ou lógica.
- Migração aplicada: `audit_add_missing_foreign_key_indexes_20261122`.
- Script versionado: `supabase/audit_fk_indexes_20261122.sql`.
- Verificação posterior: zero avisos de `unindexed_foreign_keys`.

## Avisos que não devem ser apagados cegamente
- `cv_proposal_lookup_v1` e `cv_proposal_respond_v1`: RPCs públicas para consulta e aceite/recusa com token. Revogar acesso anônimo interrompe o aceite de propostas.
- `cv_submit_site_lead_v1`: RPC pública para solicitações do site; contém validações de entrada e limite por telefone. Revogar acesso anônimo interrompe o formulário.
- `cv_site_photo_upload_allowed_v1`: checagem de autorização para anexos do site, usada pelo fluxo público.
- `cv_material_movement_create_v1`: RPC autenticada para movimentações de estoque; confere `auth.uid()`, material e fornecedor pertencentes ao usuário.
- `cv_proposal_revoke_v1`: operação autenticada de revogação de proposta; revisar escopo antes de alterar permissões.
- `cv_push_runtime_v1`: RLS habilitado sem policy, mas sem grants para `anon` e `authenticated`; tabela de serviço interno. Não adicionar policy pública apenas para suprimir INFO.

Esses alertas exigem avaliação contextual e testes de autorização; o linter não comprova vulnerabilidade. Testar abuso de token, limite de requisições, permissões entre usuários e acessos anônimos antes de mudar privilégios.

## Pendente fora do SQL
- `auth_leaked_password_protection`: ativar em Supabase Auth, se disponível no plano, e conferir fluxo de cadastro/login.
- Índices sem uso registrado: informativos, não remover sem dados de utilização representativos.
- Testes reais em Android: login, proposta PDF, aceite/recusa, financeiro, estoque e sincronização.
- NFS-e: transmissão real permanece desativada até implementação/homologação e certificado.

**Status:** índices corrigidos; demais avisos não equivalem a falhas confirmadas. Não afirmar auditoria 100% aprovada antes dos testes reais.
