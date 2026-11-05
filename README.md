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

## Publicação na Vercel
Importe a branch main, **Framework Other**, root `./` e sem build. A Vercel publica o HTML/CSS/JS e a função Node `api/siurb.js`. O serviço upstream pode ficar indisponível; o upload manual continua possível.

## Proteção dos dados
Ainda **sem banco de dados ou login**. Os dados ficam no `localStorage` do navegador/dispositivo, não são sincronizados e podem desaparecer se o armazenamento for limpo. Utilize **Mais → Backup e segurança** frequentemente. Não trate esta fase como sistema empresarial com recuperação automática.

O importador XLS usa a biblioteca SheetJS carregada via CDN no primeiro uso; requer internet. Os arquivos continuam sob sua responsabilidade e a proposta não substitui nota fiscal.

## Correção do importador (novembro de 2026)
O importador agora tenta células com formatação de exibição para preservar códigos mascarados do Excel, aceita variações de colunas e unidades, apresenta diagnóstico de leitura e mantém os dados antigos quando uma das tabelas falha. Os valores importados continuam sendo **custos de referência**. Teste com o arquivo oficial no navegador antes de utilizar preços em propostas reais.
