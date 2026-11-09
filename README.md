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


## Artes reais do PDF Signature — sem fornecedores pagos

O visual da proposta comercial passou a incorporar a arte fotográfica
\`assets/proposal-photo-atlas.webp\` — fotografia recortada das artes
de referência aprovadas, armazenada **diretamente no GitHub**, sem carregar
imagens de serviços externos na impressão. O arquivo otimizado contém,
em um único atlas, a cena de obra e capacete para a capa, uma vista de
obra ao pôr do sol para o cabeçalho e a silhueta de obras para o rodapé.
O CSS recorta cada trecho para a composição A4. Os logotipos oficiais
\`civolten-logo.png\` e \`civolten-simbolo.png\` continuam no repositório;
o cabeçalho recebeu tratamento que elimina as grandes bordas vazias
dos PNGs e dá à marca o destaque do mockup.

As três páginas têm layout fotográfico em grafite, ouro e prata; a
primeira exibe foto e dados do cliente, a segunda mostra serviços,
unidades e quantidades **sem valores**, e a última traz um **único valor
total** e condições comerciais. Custo interno, impostos e margem não
aparecem. Texto, cliente e valores são HTML dinâmico, não pixels gravados
na arte. O atlas local também está incluído no precache do PWA.

Nenhuma integração paga foi contratada. GitHub, navegador de teste local,
dados existentes do Supabase e publicação padrão da Vercel utilizam
os recursos gratuitos já configurados no projeto.

## Imagem de fundo real na capa do PDF (arte original enviada pelo usuário)

Na capa da **Proposta Signature**, o arquivo `assets/file_000000007df8820eb700b32dbfca9c55.png`
foi enviado diretamente pelo usuário à pasta `assets` do GitHub. O identificador do arquivo
foi mantido, sem exigir renomeação nem novo upload.

O gerador inclui um `<img class="proposal-cover-background">` exclusivamente na
primeira folha, posicionado por CSS para cobrir integralmente o formato A4.
O cabeçalho, o título, os dados do cliente, os serviços e os valores continuam
em HTML e não são gravados na imagem. A impressão verifica que o PNG carregou,
para evitar um PDF sem a fotografia no Android. O SW precacheia o arquivo para
disponibilidade quando a aplicação estiver instalada. Nenhum serviço pago é necessário.

A página 2 continua sem preços e a última mostra o preço total uma única vez.

## Catalogo tecnico SIURB/SINAPI por importacao (08/11/2026)

A lista fixa CIVOLTEN de servicos/produtividades foi removida. O catalogo abre vazio
e recebe somente servicos importados na conta autenticada. Orcamentos historicos
continuam com as descricoes e valores que foram salvos originalmente.

1. Acesse **Orcamentos > Abrir catalogo**. Selecione **SIURB** ou **SINAPI** e a competencia AAAA-MM.
2. Escolha um arquivo **XLSX/CSV/TSV** oficial. O arquivo e aberto no proprio aparelho,
   sem servico pago nem envio a conversores externos.
3. Confira a aba e associe as colunas **codigo, descricao, unidade**.
   A funcao/profissional e o coeficiente **HH por unidade** podem ser associados
   se estiverem expressos na composicao analitica.
4. Revise a amostra e importe. Os registros sao salvos em lotes de 100 no Supabase
   com RLS; reimportacoes preservam custos diretos e produtividades editadas.
5. No orcamento, selecione o servico importado ou cadastre um item manual.
   Os custos unitarios oficiais **nao sao copiados**; o preco e calculado pelos custos
   reais/horas produtivas da CIVOLTEN, mais materiais, equipamentos, tributos e margem.

**Cuidado:** planilhas de custos unitarios nao necessariamente trazem coeficientes
de mao de obra. Para HH, consulte as composicoes analiticas e seus servicos
auxiliares. Caso nao haja coeficiente confiavel, o campo fica vazio para
preenchimento/validacao da empresa. Nao duplique salarios ja incluidos no custo
mensal ao informar custo direto de servico.

Fontes: [SIURB Sao Paulo](https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179)
e [SINAPI CAIXA](https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx).

A tabela Supabase `cv_service_catalog_v1` foi preservada. Restricoes ampliadas
para fonte SIURB e ate 30 funcoes por servico. Nenhuma outra tabela foi apagada.

### Planilhas SIURB Excel .xls (edição de julho/2026)

O seletor de arquivos do catálogo agora aceita Excel 97-2003 **.xls**, Excel
**.xlsx** e CSV/TSV no Android e desktop. O leitor BIFF8 funciona localmente,
sem CDN ou conversão paga. Ao identificar a estrutura de composições SIURB,
organiza automaticamente código/descrição/unidade e as linhas de insumos da
composição. Coeficientes HH são retirados somente das funções de mão de obra
(códigos de insumo 1000 a 2999 e unidade H). Coeficientes de equipamento,
materiais e os preços públicos são descartados.

Na planilha `DESONERADA__COM_Des__Comp_Custos_Unit_EDIF__JUL26.xls`, a
competência é 2026-07; serviços sem coeficiente de mão de obra permanecem
com HH em aberto para conferência antes do orçamento. A importação mantém
funcionários, custos mensais, orçamentos e contratos existentes.

### Precificação automática por HH e orçamento comercial (08/11/2026)

O total mensal da CIVOLTEN reúne custos fixos, variáveis e profissionais
ativos, considerando apenas despesas com valores cadastrados. A capacidade
produtiva é calculada por `dias produtivos × horas/dia × profissionais`.
A configuração atualmente usada como padrão é 22 dias × 8h/dia; o número
de profissionais vem das configurações já salvas na empresa.

O orçamento calcula automaticamente:
- **Custo da hora-homem** = despesa mensal ÷ horas produtivas mensais.
- **Mão de obra por unidade** = custo da HH × coeficiente HH/un do serviço.
- **Custo total** = mão de obra × quantidade + materiais/equipamentos adicionais.
- **Preço de venda** = custo total ÷ (1 − imposto% − margem%).
  Imposto e margem não devem ser somados novamente ao custo/hora.

O campo de adicionais do formulário é opcional e assume zero, mas materiais
e máquinas **não são grátis**: valores não contidos nas despesas mensais
precisam ser informados separadamente, para evitar subprecificação.
O resumo visual exibe hora e preço por unidade, recalculados ao alterar HH.
Preços antigos salvos não são alterados sem revisão.

A regra antiga de homologação que exigia `demo=true` em
`cv_budget_drafts_v1` foi removida no Supabase de produção, e seu
padrão passou para `demo=false`. Orçamentos e demais registros
anteriores foram preservados. Veja `supabase/budget_drafts_producao_v2.sql`.

## Serviços do orçamento — consulta rápida ao catálogo importado

Na tela **Orçamentos > Montar orçamento > Serviços**, todos os serviços
sincronizados da conta são pesquisáveis por nome, código SIURB/SINAPI,
grupo ou unidade. A lista mostra até 60 resultados por vez para não
sobrecarregar o celular; **a busca percorre todos os registros**,
inclusive aqueles que não aparecem inicialmente.

As linhas alternam fundo **branco, escuro, branco, escuro**, com textos
contrastantes para facilitar a leitura. Toque em uma linha para abrir o
formulário com descrição, unidade e HH importados, mantendo a precificação
automática com os custos internos da empresa. A opção de serviço manual
continua disponível. O catálogo na tela de importação segue a mesma
alternância e mantém sua pesquisa independente.

Esta melhoria altera somente a interface do aplicativo, não exclui nem
reescreve registros no Supabase.

## Cronograma com prazo superior a 730 dias úteis

A estimativa do cronograma não fica limitada a 730 dias. Para a equipe
informada, o sistema calcula `teto(total de HH / (profissionais × horas/dia))`,
apresenta a duração mesmo quando extensa e mostra também o prazo para a equipe
produtiva cadastrada. A tela sugere o dimensionamento para metade do prazo
e para um mês produtivo (dias configurados pela empresa), sem contratar nem
alterar a equipe ou a precificação automaticamente.

O cálculo de datas úteis usa acesso direto ao dia útil de cada marco, sem
criar uma lista de milhares de datas na memória. Feriados, produtividade real,
mobilização, equipamentos e dependências precisam ser revisados. Caso o prazo
ultrapasse o intervalo de datas suportado, a quantidade de dias continua
visível, mas a data final fica sem previsão. A exportação CSV inclui equipe
atual e seu prazo. Valores já salvos no banco permanecem inalterados.

## Auditoria: preço total por quantidade × HH (08/11/2026)

Para cada serviço, o CIVOLTEN calcula **quantidade × produtividade HH/un = HH totais**.
A mão de obra da linha é `arredondar para cima em centavos
(custo mensal em centavos × HH totais ÷ capacidade mensal em HH)`.
O custo de materiais/equipamentos por unidade, quando houver, é
**multiplicado pela quantidade**. Depois o orçamento aplica imposto e margem
**uma única vez**: `preço da linha = teto em centavos(custo total /
(1 - imposto% - margem%))`.

O valor médio por unidade é mostrado com até quatro casas decimais e não
deve ser multiplicado antes do cálculo: **o preço total da linha e da proposta
é a referência**, evitando divergências de arredondamento em grandes quantidades.

Exemplo da tela: custo mensal R$ 21.153,35, 22 dias, 8 horas, 2 profissionais,
150 m² × 1,78 HH/m² = 267 HH totais. Mão de obra R$ 16.045,30 e preço
total R$ 25.070,79 com imposto 6%, margem 30%, materiais adicionais R$ 0,00.

Na modalidade alternativa **por dias de execução**, o valor final continua
derivado do custo diário × dias calculados no cronograma; o modal sinaliza
que o orçamento por dias pode ter preço diferente da estimativa por HH.
Os orçamentos salvos permanecem preservados.
