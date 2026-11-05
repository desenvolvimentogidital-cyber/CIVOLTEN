# CIVOLTEN — Orçamentos Premium • SIURB São Paulo
PWA mobile-first da CIVOLTEN, sem login nesta fase.

## Serviços SIURB
Aba **Mais → Serviços**. A tabela oficial de custos de Edificações (EDIF) e Infraestrutura Urbana (INFRA), data-base **julho de 2026**, é consultada no site da Prefeitura de São Paulo: https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179.

Ao abrir a aba pela primeira vez, a interface tenta importar automaticamente os arquivos oficiais pela API `/api/siurb` (somente leitura, URLs fixas). Também é possível atualizar clicando **Carregar tabela oficial**, ou baixar os arquivos XLS no portal e usar o importador de Excel. Os arquivos são da versão onerada (sem desoneração) por padrão; a desonerada pode ser escolhida no seletor.

A pesquisa oferece filtros de elétrica, civil e todos, com código, descrição, unidade e custo unitário. O botão **+ Meu catálogo** copia o serviço selecionado à biblioteca do usuário para utilização em orçamento; não altera serviços ou orçamentos já salvos.

**Atenção:** o custo de referência SIURB é composto e pode incluir mão de obra, materiais e equipamentos. Ele entra como *custo global* e **não é preço final de venda nem apenas mão de obra**. Ajuste a composição conforme fornecimento do cliente, margem e tributos. Não duplique BDI com despesas indiretas da CIVOLTEN. Os valores históricos de propostas permanecem congelados.

## Publicação na Vercel
Importe a branch main, **Framework Other**, root `./` e sem build. A Vercel publica o HTML/CSS/JS e a função Node `api/siurb.js`. O serviço upstream pode ficar indisponível; o upload manual continua possível.

## Proteção dos dados
Ainda **sem banco de dados ou login**. Os dados ficam no `localStorage` do navegador/dispositivo, não são sincronizados e podem desaparecer se o armazenamento for limpo. Utilize **Mais → Backup e segurança** frequentemente. Não trate esta fase como sistema empresarial com recuperação automática.

O importador XLS usa a biblioteca SheetJS carregada via CDN no primeiro uso; requer internet. Os arquivos continuam sob sua responsabilidade e a proposta não substitui nota fiscal.