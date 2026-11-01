# CIVOLTEN — cadastro multiempresa e isolamento estrito (projeto de segurança)

**Estado em 01/11/2026:** preparação em revisão; **cadastro público NÃO liberado**. Não fazer deploy desta funcionalidade enquanto os testes negativos abaixo não forem executados. Este documento é um contrato técnico de implementação, não atestado de homologação.

## Modelo obrigatório

1. **Organização (tenant):** cada conta autônoma possui ID UUID independente, e um administrador proprietário. O login é único na plataforma; usuários criados pelo proprietário entram apenas na sua organização. Os colaboradores da mesma empresa podem compartilhar registros de acordo com seu perfil; contas de empresas diferentes nunca compartilham dados.
2. **Dados privados:** vincular por organização usuários, clientes, obras, orçamentos, itens, custos de pessoal, salários, custos indiretos, equipes, atividades, dependências, medições, propostas, receitas, auditoria e evidências. SIURB oficial permanece catálogo global **somente leitura**. A conta A não deve poder listar, consultar por UUID conhecido, alterar, apagar, exportar ou inferir dados da conta B.
3. **Banco:** criar migração não destrutiva para organizações e colunas `organization_id` dos registros existentes, atribuindo-os a uma organização legada da CIVOLTEN. Preservar os usuários e o banco atual. Ativar RLS com `FORCE ROW LEVEL SECURITY` e políticas `USING` + `WITH CHECK` para cada tabela privada, com índices e chaves estrangeiras compostas por organização. Tabelas de configuração com chave única (tarifa por profissão e singleton de despesas/pró-labore) precisam ser **exclusivas por organização**, sem colisões globais.
4. **Credencial do aplicativo:** precisa ser role PostgreSQL dedicada, `rolsuper=false`, `rolbypassrls=false`, sem permissão de alterar políticas, tabelas ou executar `SET ROLE` privilegiado. A conexão atual da CIVOLTEN, **civolten_owner**, respondeu `rolbypassrls=true` em verificação somente leitura — essa credencial **NÃO atende** o requisito, ainda que tabelas tenham RLS.
5. **Transações:** para cada consulta autenticada usar `set_config('civolten.organization_id', id, true)` **no mesmo transaction()** da consulta (Neon HTTP). Proibido `SET` de sessão ou variável global de JS compartilhada entre requisições. Implementação auxiliar e testes em `src/tenant-db-guard.mjs` e `tests/tenant-db-guard.test.mjs`. Não habilitar a função de registro se a inspeção de role/RLS falhar.
6. **Autenticação:** criar conta, verificar e-mail, login, troca de senha, recuperação segura por token expirável e revogação de sessões; limitação de tentativas e de registros; proteção anti-CSRF; não retornar senhas ou hashes. O primeiro membro é administrador da própria organização, nunca administrador de todas as organizações. Administrador da empresa A não pode gerenciar membro B. **Não criar contas com senha temporária conhecida nem permitir cadastro aberto sem controles antiabuso.**
7. **Deploy:** separar migração, credenciais e rollout, todos testados em branch PostgreSQL descartável. Não executar migrações diretamente na produção sem snapshot/backup verificável, pré-verificação de FKs, plano de rollback e autorização de rollout. Publicação em Vercel **depois** dos testes e da liberação pelo proprietário.

## Provas de aceitação obrigatórias (automáticas e reais)

- Criar organizações A, B, C e usuários administrador, orçamentista, revisor e consulta em cada.
- A cria cliente, obra, orçamento, 2 itens, trabalhador/salário, custos fixos, cronograma, progresso, proposta, custo realizado e recebimento. B e C NÃO conseguem obter nenhum desses dados por listagem, busca textual ou UUID exato.
- B tenta referenciar cliente ou funcionário de A em novo orçamento/atividade: banco rejeita por chave composta ou RLS; nenhum cadastro órfão fica gravado.
- A tenta modificar o perfil e desativar usuário B (IDs conhecidos): HTTP 403/404, banco inalterado.
- Testar `SELECT`, `INSERT`, `UPDATE`, `DELETE` diretamente com role **sem BYPASSRLS**, com e sem contexto, usando duas organizações no mesmo pool. Ausência de contexto → acesso negado. Verificar que uma transação da A não contamina a seguinte da B.
- Testar leitura de salários/valores por perfil; usuario de consulta não vê custos internos, nem dados de outras organizações.
- Executar testes de autenticação concorrente, troca/recuperação de senha, limite de requisições, sessões expiradas e e-mail não verificado.
- Verificar no Android e desktop: contas A e B, navegação, exportação PDF, back button, cache, modo offline/PWA, sincronização após trocar usuário. **Cache offline precisa ser por organização e usuário; logout apaga dados protegidos do dispositivo ou os mantém inacessíveis à próxima sessão.**
- CI do SHA exato aprovado e restauração do backup antes da eventual liberação.

## Fluxo de conta implementado em QA (não publicado)

- `POST /api/v1/auth/signup`: cria organização e administrador **inativo** em transação; grava somente SHA-256 de código aleatório 256-bit para verificação (30 minutos). Não cria sessão, não libera orçamento, nem devolve token na resposta. Registro duplicado responde sem revelar se o e-mail já existe. Tentativas limitadas por e-mail e origem.
- `POST /api/v1/auth/verify-email`: consome token uma só vez, ativa administrador e registra auditoria no contexto da organização.
- `POST /api/v1/auth/resend-verification`: solicita novo código de confirmação de conta pendente.
- `POST /api/v1/auth/request-reset`: resposta genérica, código válido por 20 minutos somente para conta ativa com e-mail verificado.
- `POST /api/v1/auth/reset-password`: consome código uma só vez, gera hash scrypt com salt aleatório, registra auditoria e revoga TODAS as sessões anteriores.
- `public/secure.js`: formulários de cadastro, confirmação e recuperação. O código é carregado no fragmento `#verify=...`/`#reset=...`, que não é enviado como parte do pedido HTTP de página, e apagado da barra após o uso.
- Envio de mensagem: `src/account-mail.mjs` implementa a API HTTPS do Resend como integração **opcional**. Testes usam envio injetado e não enviam mensagens reais. Para ativar futuramente o dono deve configurar `CIVOLTEN_PUBLIC_ORIGIN` com HTTPS canônico, `CIVOLTEN_MAIL_FROM` de domínio verificado, e `RESEND_API_KEY` como segredo protegido na Vercel. Não adicionar segredos ao repositório ou ao chat.
- Controle adicional: `CIVOLTEN_MULTI_TENANT=true` e `CIVOLTEN_SIGNUP_ENABLED=true` precisam ser expressamente ativados após isolamento completo. Com flags ausentes e sem remetente o serviço retorna 503 `SIGNUP_NOT_RELEASED`, preservando os cadastros internos atuais.
- CI exige PostgreSQL real com usuário de testes `NOBYPASSRLS` e empresas A/B distintas; verifica que login antes da confirmação falha, token expirado/reutilizado é recusado, cliente de A não aparece em B, senha antiga não funciona depois da troca e sessão antiga é revogada. Em produção, ainda faltam e-mail real, controle antiabuso escalável, auditoria de privilégios e homologação Android/desktop.

## Atenção ao armazenamento offline

Cópias anteriores salvas em IndexedDB não eram criptografadas nem separadas por organização. Para evitar divulgação acidental, contas com `organization_id` **não podem usar rascunhos offline ou sincronizá-los** nesta versão; o navegador registra o bloqueio quando reconhece uma conta multiempresa. O sistema não apaga silenciosamente os rascunhos antigos, para preservar trabalho pendente. Antes do rollout real, orientar o proprietário do dispositivo a sincronizar/exportar o trabalho legado e limpar as cópias locais; permitir offline multiempresa **somente depois** de implantar criptografia por usuário/organização, bloqueio no logout e testes entre contas no mesmo aparelho.

## Próxima autorização de lançamento

1. Backup real recuperável e pré-verificação da migração `db/staged/0020_multi_organization_qa.sql`, convertida de QA para migração revisada e versionada; não alterar Supabase antigo.
2. Criar role Neon de aplicação com somente permissões necessárias e `rolbypassrls=false`; atualizar **somente** a URL de conexão protegida na Vercel. Proibir escrita ou leitura cross-tenant inclusive em tabelas de usuários, sessões e logs conforme escopo.
3. Confirmar e-mail real do domínio e habilitar controles de abuso além do limitador de tentativas básico, especialmente para cadastro aberto.
4. Testes de aceitação com 3 organizações, dispositivo compartilhado, cargo administrador, orçamentista, consulta, PDFs, backup, recuperação e revogação. Bloquear exportações fora da organização.
5. Somente depois, ativar flags e deploy após autorização separada. Este PR fica em rascunho e sem deploy.

## Condições atuais

O sistema atual opera como um painel interno da CIVOLTEN com bootstrap administrativo e membros internos. **Não é um SaaS multiempresa ainda**. A migração do Supabase legado permanece fora do escopo e intacta. A identidade do cliente, o contrato, o preço final e a emissão comercial têm suas próprias liberações e não podem ser inferidos de autenticação bem-sucedida.
