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


## Orçamentos de demonstração (fase de validação — não oficial)

Acesso em **Início → Orçamentos** ou **Mais → Orçamentos de teste**.
Este módulo foi desenvolvido para testar a construção de orçamentos antes de importar
qualquer tabela oficial. O catálogo contém apenas oito serviços **inventados**,
identificados pelo prefixo \`DEMO-\`. Nenhum deles é SINAPI, SIURB, ORSE,
SICRO ou qualquer composição pública; preços, horas e insumos são ilustrativos.

**Fluxo de teste:** informar título, cliente, obra, local, validade e notas;
adicionar itens fictícios ou manual, editar descrição, unidade, quantidade,
horas por unidade e custo direto por unidade; visualizar custo da mão de obra,
impostos e margem aplicados; salvar/editar/excluir rascunho no Supabase;
abrir versão demonstrativa para impressão/PDF e exportar CSV.
Nenhum orçamento de exemplo é criado automaticamente na conta.

**Precificação:** usa custo mensal da empresa dividido pela capacidade
produtiva e multiplica pelas horas totais de cada item, acrescentando apenas
seus custos diretos não incluídos nos custos mensais. Cada linha recebe o
divisor \`1 - alíquota efetiva - margem desejada\`. O valor final soma as
linhas, com cálculo monetário em centavos. O snapshot de alíquota, margem,
custo mensal e capacidade fica no orçamento, evitando mudanças silenciosas
quando o custo da empresa for atualizado. Para usar os novos valores, o
usuário deve selecionar **Atualizar base de preços** e salvar novamente.
Sem base completa o rascunho pode ser salvo, mas não mostra preço de venda.

**Segurança:** \`supabase/budget_drafts_v1.sql\` cria
\`cv_budget_drafts_v1\`, isolada por \`auth.uid()\` com quatro políticas RLS.
Apenas rascunhos marcados como demonstração são permitidos nesta fase; não
existem vínculos automáticos com contas a receber, faturamento, estoque,
contratos ou execução de obra. A impressão contém aviso visível de teste.

**Próxima fase, apenas após aprovar o fluxo:** escolher fonte pública
(SINAPI ou outro referencial), estado, mês-base, composições e insumos reais,
unidades, produtividade e metodologia de BDI com rastreabilidade. A estrutura
de orçamento atual não inventa código oficial nem valor de referência.


## PDF de proposta comercial — identidade CIVOLTEN V4 aprovada

A saída **Orçamentos → Visualizar / PDF** utiliza o modelo V4 aprovado:
cabeçalho grafite/preto e dourado, logo e símbolo oficiais da CIVOLTEN
(\`assets/civolten-logo.png\`, \`assets/civolten-simbolo.png\`),
marca-d’água com símbolo e nome da empresa ampliados e translúcidos
ao centro **de cada folha**, informações do cliente/obra/validade,
tabela de serviços, total destacado, observações e rodapé.

O conteúdo é HTML/CSS de impressão, não uma imagem estática: reflete os
dados efetivamente cadastrados e recalcula o total com \`priceBudget\`.
A marca, os cabeçalhos da tabela, as informações de identificação e as
linhas são produzidos com elementos reais para preservar legibilidade.
A impressão pode gerar múltiplas folhas A4 quando houver muitos itens;
a página de impressão não mostra as ferramentas de edição do aplicativo.
No celular, abra o orçamento e use **Visualizar / PDF → Salvar como PDF**.

**Importante:** enquanto o módulo utilizar o catálogo \`DEMO-*\`, o PDF
exibirá **ORÇAMENTO DEMONSTRATIVO / NÃO ENVIAR AO CLIENTE / DOCUMENTO DE TESTE**.
O layout já está preparado para apresentar "PROPOSTA COMERCIAL" quando
uma etapa futura validar serviços oficiais e o documento deixar de ser
demonstrativo. Não ative documentos comerciais reais apenas ocultando
os avisos; é preciso revisar preços, documentos fiscais e condições.

A saída mostra **somente preços finais das linhas**. Custos mensais,
horas de formação interna, tributos calculados e lucro gerencial
permanecem na interface do administrador e **não são enviados no PDF**.
Nenhuma tabela, cadastro ou valor no Supabase foi modificado por esta
alteração de apresentação. Testes unitários e testes Playwright
renderizam PDF verdadeiro com logo, marca-d’água e paginação.


## Atualização do layout comercial no aplicativo instalado (PWA)

Após uma publicação, uma aba do Android já aberta continua executando o JavaScript
que foi carregado antes do deploy. Nesta versão os endereços de CSS e JS contêm
um identificador específico para não reutilizar os arquivos antigos no cache.

O service worker mantém o uso offline de recursos previamente baixados, mas,
quando há rede, solicita o HTML, JS e CSS sem cache HTTP antigo. A verificação
do worker é repetida no foco da janela. Caso o worker mude durante uma sessão
ativa, o sistema exibe **Atualizar aplicativo**; o clique recarrega a página e
alerta sobre possíveis edições não salvas no orçamento.

Em **Orçamentos → editar**, é exibido o rótulo **Modelo comercial V4 · identidade
CIVOLTEN**, para confirmar visualmente que a interface atual foi recebida.
O botão **Visualizar / PDF** verifica se o template V4 está disponível antes
de abrir a impressão. Teste de navegador garante que o botão usa a nova versão,
além de validar logo, marca-d’água e paginação A4.


## CIVOLTEN Signature: proposta comercial com 3 ou mais páginas

Novo modelo impresso da tela **Orçamentos → Visualizar / PDF**, inspirado no
layout de capa 2 aprovado e construído com HTML/CSS/SVG + marcas originais.

**Divisão obrigatória e apresentação comercial**:
- **Página 1 — Capa**: identidade CIVOLTEN em preto/dourado, ilustração
  vetorial de construção, informações do cliente, obra, local, data e validade.
- **Página 2 — Descrição dos serviços**: apenas nome/descrição, unidade e
  quantidade. **Não mostra preço unitário, custo, subtotal ou preço final.**
  Com muitos itens, o gerador cria páginas adicionais de serviços e numera
  todas as páginas automaticamente.
- **Última página — Investimento e condições comerciais**: **único valor
  monetário exibido em toda a proposta**, retirado diretamente do cálculo
  validado do orçamento. Mostra pagamento, execução, validade, garantia,
  observações, escopo e espaços de aceite. Não presume prazos ou garantias.
  Os campos não preenchidos aparecem como “A definir entre as partes”.
- As páginas têm o logotipo e o símbolo oficiais, marca-d’água discreta,
  rodapé em preto/dourado e paginação A4. A ilustração da obra é um SVG local
  original, sem dependências de imagens externas ou serviços pagos.

**Configuração adicional da proposta**: os seis campos opcionais
\`paymentTerms\`, \`executionTerm\`, \`warrantyTerms\`, \`scopeNotes\`,
\`companyContact\` e \`companyDocument\` são salvos em
\`cv_budget_drafts_v1.commercial\` (JSONB, conta isolada por RLS).
Aplicar \`supabase/budget_commercial_v1.sql\` **antes** do novo frontend em
produção. Orçamentos anteriores preservam os itens, preços e dados; condições
não existentes são carregadas vazias.

**Fase de teste**: enquanto os serviços forem fictícios, todas as páginas
continuam identificadas como demonstração e não devem ser enviadas a clientes.
A proposta não expõe imposto, margem, custo/hora ou custos internos. O CSV
administrativo permanece completo, mas não é o documento comercial.
