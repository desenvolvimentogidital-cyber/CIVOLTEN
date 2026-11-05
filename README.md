# CIVOLTEN — Orçamentos Premium • SIURB São Paulo
PWA mobile-first da CIVOLTEN, sem login nesta fase.

## Serviços SIURB
Aba **Mais → Serviços**. A tabela oficial de custos de Edificações (EDIF) e Infraestrutura Urbana (INFRA), data-base **julho de 2026**, é consultada no site da Prefeitura de São Paulo: https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179.

Ao abrir a aba pela primeira vez, a interface tenta importar automaticamente os arquivos oficiais pela API `/api/siurb` (somente leitura, URLs fixas). Também é possível atualizar clicando **Carregar tabela oficial**, ou baixar os arquivos XLS no portal e usar o importador de Excel. Os arquivos são da versão onerada (sem desoneração) por padrão; a desonerada pode ser escolhida no seletor.

A pesquisa oferece filtros de elétrica, civil e todos, com código, descrição, unidade e custo unitário. O botão **+ Meu catálogo** copia o serviço selecionado à biblioteca do usuário para utilização em orçamento; não altera serviços ou orçamentos já salvos.

**Atenção:** o custo de referência SIURB é composto e pode incluir mão de obra, materiais e equipamentos. Ele entra como *custo global* e **não é preço final de venda nem apenas mão de obra**. Ajuste a composição conforme fornecimento do cliente, margem e tributos. Não duplique BDI com despesas indiretas da CIVOLTEN. Os valores históricos de propostas permanecem congelados.

## Modalidades de orçamento e separação SIURB

A modalidade inicial de qualquer **novo orçamento** é **Somente mão de obra**. Os outros modos **Completo** (materiais e mão de obra pela empresa) e **Misto** (fornecimento escolhido por item) continuam disponíveis na primeira etapa.

O campo **Custo unitário SIURB** é apenas uma referência **global**, não uma parcela de mão de obra. Para adicionar um serviço SIURB a um orçamento:

1. Na aba **Mais → Serviços**, escolha um item SIURB e use **+ Meu catálogo**.
2. Em **Novo orçamento → Itens**, selecione esse serviço.
3. Preencha separadamente **Mão de obra**, **Materiais** e **Equipamentos/outros**, consultando a composição oficial; não há rateio percentual automático fictício.
4. Marque **Conferi a divisão**. Opcionalmente salve a composição conferida para os próximos orçamentos.
5. Em modo **Mão de obra**, material do cliente fica fora da cobrança. Em **Completo**, material da empresa é incluído. Em **Misto**, selecione o fornecedor por item.

A aplicação impede salvar novos itens SIURB sem conferência dos valores e bloqueia o avanço de propostas em edição cujos itens SIURB ainda não tenham sido separados.

**IMPORTANTE:** nesta etapa a separação é **manual e validada pelo usuário**, não importação automática de todos os componentes de planilhas. A Prefeitura publica **Composições de Custos** específicas de Edificações/Infraestrutura. Os arquivos oficiais devem ser consultados antes de usar custos reais e podem conter componentes auxiliares. O aplicativo não presume valores que não identificou com segurança. Orçamentos existentes e seus valores salvos não são reescritos automaticamente.


## Orçamento rápido e custos reais (novembro/2026)

Fluxo **Novo orçamento → Itens**:
- Descrição é também a **busca por código ou texto**, trazendo a biblioteca SIURB já importada e serviços próprios. Selecionar preenche unidade, descrição e, se houver composição **previamente conferida**, custo separado de mão de obra, materiais e equipamentos.
- Serviços SIURB que possuem **somente custo global** continuam exigindo conferência da composição. **Não calculamos valor de mão de obra por rateio arbitrário nem cobramos o total público como mão de obra.**
- Material cadastrado é opcional; o módulo **Mais → Materiais** permite carregar/importar a tabela pública de **Insumos SIURB** (referência de preços, em cache local IndexedDB) e copiar materiais para seu catálogo.
- Profissionais cadastrados podem ser escolhidos em cada item. No cadastro em **Mais → Profissionais**, use **Empregado CLT** para informar salário mensal, FGTS, INSS patronal, outros encargos, benefícios, provisão de 13º e 1/3 de férias e horas **produtivas** mensais. A seleção do profissional com suas horas por unidade permite preencher o custo da mão de obra (não deve somar de novo o custo de composição SIURB).
- A tabela pública de **Mão de Obra Mensalista/Horista SIURB** pode ser importada como referência. Ela **não substitui o salário real nem o enquadramento sindical/tributário** e não é usada automaticamente como salário CLT.
- Cadastre almoço, transporte, pedágio, combustível, hospedagem, locação etc. em **Mais → Despesas**. Em **Novo orçamento → Itens → Despesas da obra**, escolha as despesas efetivamente aplicáveis e informe quantidades, pessoas e dias; elas são acrescentadas ao custo do orçamento apenas uma vez.
- Revisão do orçamento separa custo de execução, despesas, percentuais e preço final, com margem configurável. Mode padrão: **Somente mão de obra**; **Completo** e **Misto** continuam ativos.

### Atenção para empregador MEI
Como referência geral do MEI com empregado: 3% de contribuição previdenciária patronal e 8% de FGTS, além de 13º, férias acrescidas de 1/3 e benefícios/CCT. A simulação mensal NÃO é folha de pagamento nem cálculo trabalhista completo (não determina periculosidade/insalubridade, piso, CCT, rescisão ou todos os custos possíveis). Configurar conforme contador/convenção: https://www.gov.br/esocial/pt-br/microempreendedor-individual/manual-web-mei.

Exemplo apenas ilustrativo: salário-base de R$ 2.800; INSS patronal 3%, FGTS 8%, 13º 1/12 e adicional de férias (1/3)/12, sem benefícios ou outros encargos → **R$ 3.453,33/mês**; com 160 horas produtivas, **R$ 21,58/h**. Com vale-transporte, alimentação, adicionais, CCT e reservas o custo muda.

### Limites desta entrega
Os arquivos oficiais "Insumos" e "Mão de Obra" são disponibilizados via proxy Vercel **somente para download e leitura** quando o portal estiver acessível. A importação está preparada, mas **os layouts exatos de todas as planilhas complementares ainda não foram validados com arquivos reais**; pode ser necessário ajustar os extratores. A tabela de **Composições de Custos** oficial ainda não é decomposta automaticamente por serviço em mão de obra/material/equipamento. Para isso é necessário importar e validar as composições completas.
Dados comerciais continuam no armazenamento local do navegador sem login/servidor sincronizado. Faça backups e não dependa exclusivamente desta versão para operação crítica.


## Automatização de orçamento — etapa novembro/2026

**Novos modelos de produtividade:** Em **Mais → Serviços → Novo/Editar**, cadastre até três funções/profissionais da equipe padrão, as horas de cada um para executar UMA unidade do serviço e a quantidade de profissionais. É possível escolher um material padrão e a quantidade por unidade. O aplicativo calcula o custo real da equipe com os salários, encargos e horas produtivas registrados em **Profissionais**. Dados existentes são mantidos.

**Ao escolher o serviço:** A pesquisa procura na SIURB importada e na biblioteca CIVOLTEN; a unidade e os custos conferidos são preenchidos. Para serviços com equipe padrão cadastrada, mão de obra é calculada automaticamente, e o item salva uma fotografia das horas, taxas e profissionais usados. Mudanças posteriores no catálogo não devem reescrever automaticamente os orçamentos antigos.

**Regra de referência:** o custo efetivo dos profissionais e insumos cadastrados é a base do **custo real**. Se a parcela de mão de obra/material da SIURB estiver **separada e conferida** e for mais alta, ela eleva a base do **preço sugerido** somente quando o escopo corresponder ao da proposta. Isso não aumenta artificialmente o custo real nem mascara o lucro. Não há comparação do custo global SIURB com um orçamento de apenas mão de obra.

**Produção e despesas:** A etapa Itens mostra horas-homem e jornadas equivalentes de 8h quando há produtividade cadastrada. Embaixo, despesas já cadastradas podem ser lançadas com um toque, usando inicialmente 1 unidade/pessoa/dia e permitindo editar as quantidades. Não são incluídas invisivelmente e não entram duas vezes no orçamento.

**O que continua manual:** cliente, quantitativos da obra, endereço, seleção de despesas reais, horas de produtividade ainda não conferidas, condições locais, benefícios e enquadramento de empregados, valores finais de fornecedores, aprovação da composição e conferência da proposta. Importação/validação da **planilha detalhada de Composições de Custos SIURB** ainda é necessária antes de permitir produtividade oficial preenchida automaticamente em TODOS os códigos.

**Testes deste ciclo:** validação de sintaxe JS, cálculo de equipe CLT/terceirizada, exibição de campos de produtividade, cálculo de piso de preços em diferentes regimes de fornecimento e criação do build na Vercel. Testes completos num aparelho real, importação de toda a planilha oficial e persistência em banco ainda pendentes.

## Publicação na Vercel
Importe a branch main, **Framework Other**, root `./` e sem build. A Vercel publica o HTML/CSS/JS e a função Node `api/siurb.js`. O serviço upstream pode ficar indisponível; o upload manual continua possível.

## Proteção dos dados
Ainda **sem banco de dados ou login**. Os dados ficam no `localStorage` do navegador/dispositivo, não são sincronizados e podem desaparecer se o armazenamento for limpo. Utilize **Mais → Backup e segurança** frequentemente. Não trate esta fase como sistema empresarial com recuperação automática.

O importador XLS usa a biblioteca SheetJS carregada via CDN no primeiro uso; requer internet. Os arquivos continuam sob sua responsabilidade e a proposta não substitui nota fiscal.

## Correção do importador (novembro de 2026)
O importador agora tenta células com formatação de exibição para preservar códigos mascarados do Excel, aceita variações de colunas e unidades, apresenta diagnóstico de leitura e mantém os dados antigos quando uma das tabelas falha. Os valores importados continuam sendo **custos de referência**. Teste com o arquivo oficial no navegador antes de utilizar preços em propostas reais.
