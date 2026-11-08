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

O aplicativo utiliza Supabase Auth (supabase-js v2.119.0), com cadastro por e-mail e senha, login, sessão persistente, saída e recuperação de senha.

**Decisão de produto (07/11/2026): cadastro e acesso imediato, sem confirmação por e-mail.** Para ativar esse comportamento, no projeto CIVOLTEN-Orcamentos do Supabase, abrir **Authentication → Sign In / Providers → Email**, desligar **Confirm Email** (ou "Enable email confirmations") e salvar. Esse controle pertence ao servidor Supabase, **não é possível desligá-lo apenas pelo JavaScript, pela migração SQL nem pelo deploy da Vercel**. A integração MCP atual não possui operação de alterar configurações de Auth, portanto a configuração precisa ser salva no painel do projeto.

Com Confirm Email desligado, `auth.signUp()` retorna `data.session` imediatamente e o CIVOLTEN abre o painel sem apresentar tela de confirmação ou outro login. Os testes Chromium foram atualizados para reproduzir essa configuração. Sem alterar a opção, novos cadastros ainda pedirão confirmação, mesmo com os testes passando.

**Atenção à segurança:** desligar a confirmação permite cadastrar e-mails não verificados. Não conceder permissões administrativas nem usar o e-mail como prova de propriedade; manter senha, RLS e defesa contra abusos. Contas antigas com senha desconhecida continuam necessitando de recuperação de senha, e cadastrar novamente o mesmo e-mail não a redefine.

**URL do projeto:** Authentication → URL Configuration → Site URL `https://civolten.vercel.app` e Redirect URLs incluindo `https://civolten.vercel.app/**` (necessário para recuperação de senha).

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


## Financeiro, faturamento e relatórios (v2)

- **Início → Financeiro**: lançar receitas/faturamento e contas a pagar, com cliente/fornecedor,
  obra, categoria, referência, valor e vencimento; editar/excluir e baixar como recebido/pago.
- **Início → Relatórios**: receitas com vencimento no período, caixa efetivamente recebido/pago,
  contas em aberto, atrasos, gráfico dos últimos seis meses, categorias de despesas pagas,
  custos previstos da equipe/fixos/variáveis; exportação CSV UTF-8 para planilha e impressão em PDF.
- O **faturamento é gerencial**, sem integração de emissão de NF-e, NFS-e ou boleto.
  Não confundir recebível cadastrado com valor efetivamente recebido.
- Os custos mensais e folha antigos continuam **previsões**. Só os lançamentos com data de
  recebimento/pagamento movimentam o fluxo de caixa; não há duplicação automática.
- **Banco:** nova tabela isolada \`cv_financial_entries_v1\` com RLS e políticas por usuário
  definida em \`supabase/financeiro_schema_v2.sql\`. Aplique essa migração ao Supabase
  CIVOLTEN-Orcamentos antes de publicar o frontend. Nenhuma tabela antiga deve ser excluída.
- **Precisão:** valor monetário com duas casas decimais; somas internas em centavos.
  Relatórios são gerenciais, não substituem contabilidade ou apuração fiscal.

Os custos históricos cadastrados seguem nas tabelas originais. O módulo novo só apresenta
receitas e pagamentos a partir dos lançamentos efetivamente informados: não inventa
faturamento ou despesas pagas com base em orçamentos ou custos previstos.


## Empresa, preços da mão de obra e temas

Em **Mais → Empresa e precificação**, o usuário configura, por conta:
- Nome comercial, regime tributário e anexo do Simples Nacional (referência);
- Alíquota **efetiva total estimada sobre o preço da nota** (%) e **margem de lucro sobre a venda** (%);
- Dias produtivos/mês, horas produtivas/dia por profissional e **número de profissionais produtivos**.
- Simulação de horas de mão de obra e custos diretos adicionais; custo do serviço, imposto,
  lucro e preço ao cliente, sem salvar orçamento nem emitir nota.
- Em **Mais → Cores do aplicativo**, escolhe tema dourado, azul, verde, violeta ou coral,
  salvo no Supabase e recuperado ao entrar.

A formação de preço usa o **custo mensal da empresa (fixos + variáveis estimados + equipe)**
dividido pela capacidade faturável total (profissionais × dias × horas). Assim, a sobrecarga
administrativa integra o custo/hora da equipe produtiva. A hora e o dia podem ser usados como
base em futuros orçamentos — a ligação automática a contratos/medições ainda não foi criada.

**Cálculo gerencial:**

\`preço de venda = (custo de mão de obra + custos diretos adicionais) ÷ (1 - taxa efetiva de tributos - margem)\`

As taxas acima são frações (e.g., 10%=0,10). Imposto e margem sobre **preço de venda**, não
simples markup sobre custo. Os centavos são arredondados para cima no preço, evitando
subprecificação por arredondamento. Se a capacidade, custos ou ajustes não estiverem prontos,
a simulação não apresenta um preço. Não adicione custos diretos que já estão contabilizados
nos custos mensais para evitar duplicidade. O lucro é uma **estimativa gerencial**, antes de
outros riscos de execução, retrabalho e variações de insumos.

A **alíquota efetiva do Simples Nacional** depende, entre outros fatores, do Anexo, RBT12,
parcela a deduzir, segregação de receitas, fator R, retenções e peculiaridades tributárias.
Não é calculada só a partir do anexo e **não há percentuais automáticos presumidos**.
O usuário informa e valida o total apropriado com contador. O Simples/DAS pode conter
ISS: não some o ISS novamente sem orientação contábil. Para MEI ou outros regimes,
ajuste manualmente o percentual de tributos efetivamente aplicável ao serviço. Este sistema
não substitui PGDAS-D/contabilidade, nem emite NF-e ou NFS-e.

**Banco:** migration \`supabase/company_settings_v1.sql\` cria
\`cv_company_settings_v1\` com RLS por usuário, uma linha por usuário. Nenhum dado de
funcionários, custos, faturamento, encargos CLT ou contratos antigos é alterado.
A tabela precisa existir antes do frontend atualizado entrar em produção.
