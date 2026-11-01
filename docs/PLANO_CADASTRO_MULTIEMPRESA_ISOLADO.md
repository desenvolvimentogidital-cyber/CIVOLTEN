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

## Condições atuais

O sistema atual opera como um painel interno da CIVOLTEN com bootstrap administrativo e membros internos. **Não é um SaaS multiempresa ainda**. A migração do Supabase legado permanece fora do escopo e intacta. A identidade do cliente, o contrato, o preço final e a emissão comercial têm suas próprias liberações e não podem ser inferidos de autenticação bem-sucedida.
