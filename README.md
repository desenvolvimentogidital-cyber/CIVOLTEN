# CIVOLTEN — Nova base Supabase

Identidade visual preservada: telas Login, Início, Custos e Funcionários com logotipos CIVOLTEN originais, fundo preto, prata, dourado e navegação inferior.

## Banco de dados

O aplicativo utiliza o projeto já existente CIVOLTEN-Orcamentos do Supabase, na região São Paulo, restaurado em 7 de novembro de 2026. O projeto Neon antigo foi preservado; nenhum outro projeto da conta foi excluído.

Três tabelas novas foram adicionadas por meio da migração civolten_premium_base_v1, contida em supabase/schema.sql:

- cv_fixed_costs_v1 — custos fixos mensais ou anuais;
- cv_variable_costs_v1 — custos variáveis por unidade e previsão mensal;
- cv_employees_v1 — funcionários CLT, prestadores, encargos e horas.

Cada uma tem coluna user_id referenciando auth.users, RLS habilitado, uma política para cada operação de leitura, criação, edição e exclusão, e privilégios SQL apenas para authenticated (não para anon). Não contém dados de exemplo.

A auditoria inicial encontrou 29 tabelas antigas vazias e uma conta de autenticação anterior. Foram mantidas intactas por segurança. Os projetos OrçaPro e os bancos de outros aplicativos não foram alterados.

## Autenticação

O aplicativo utiliza Supabase Auth (supabase-js v2.119.0), com cadastro por e-mail e senha, login, sessão persistente, saída e recuperação de senha. Se a confirmação de e-mail estiver ativada, o usuário deverá confirmar antes de entrar.

**Configuração necessária no painel Supabase:** Authentication → URL Configuration → Site URL igual a https://civolten.vercel.app e Redirect URLs incluindo https://civolten.vercel.app/**. Um teste de confirmação com e-mail real é necessário depois da publicação.

No navegador são usados somente a URL e a chave publicável do Supabase. Nenhuma chave secret ou service_role é usada no frontend. O build usa SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY, com fallback para os valores públicos oficiais do projeto CIVOLTEN.

## Persistência

Custos e funcionários são consultados no Supabase quando a sessão inicia, gravados no Supabase antes de confirmar o cadastro e só então replicados num cache local do aparelho. Uma falha na conexão impede gravações divergentes. Usuários não podem acessar registros de outra conta por causa do RLS.

Não há migração dos registros legados do Neon ou do armazenamento local antigo. Essas informações continuam preservadas na fonte original.

## Testes gratuitos

    npm install --no-audit --no-fund
    npm test
    CIVOLTEN_E2E=true npm run build
    npx playwright install --with-deps chromium
    npm run test:browser

O modo de teste E2E somente é habilitado em localhost, nunca em produção. Os testes cobrem cálculos, separação entre contas, CRUD, recarga, login simulado, navegação Android e aparência das quatro telas.

## Próximas etapas

O fluxo de cadastro e login com e-mail real precisa ser validado no domínio de produção após o deploy. Orçamento, SIURB/SINAPI, propostas, cronograma e execução continuam desativados até serem reprojetados e aprovados. Não excluir o Neon ou a conta antiga sem conferir a estratégia de migração e recuperação.
