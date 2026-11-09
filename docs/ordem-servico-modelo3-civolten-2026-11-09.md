# Ordem de Serviço CIVOLTEN — Modelo 3 oficial (A4)

Implantação: 09/11/2026. A Ordem de Serviço foi redesenhada conforme o
**modelo técnico-profissional número 3** aprovado, com a identidade oficial
da empresa: símbolo CIVOLTEN, logotipo CIVOLTEN — Elétrica & Construção Civil,
preto, dourado e branco. Os recursos são carregados dos arquivos oficiais
`/assets/civolten-simbolo.png`, `/assets/civolten-logo.png` e
`/assets/skyline.svg` do mesmo projeto; nenhum logotipo foi inventado.

## Dados apresentados na OS
- Número da OS, nome do cliente, obra e referência do aceite informado.
- Datas de aprovação e de início previsto.
- Relação de serviços contratados, com unidade e quantidade.
- Responsabilidade do contratante por materiais e insumos de aplicação,
  condições/exclusões e vínculo com a proposta comercial aprovada.
- Assinaturas da CIVOLTEN e do cliente, além de identificação do documento
  gerencial e paginação.

## Valores comerciais e financeiros
**A Ordem de Serviço NÃO apresenta preços unitários, mão de obra por unidade,
HH/custo da empresa, margem, impostos nem valor total contratado.**
O contrato e os valores continuam preservados integralmente no orçamento,
na proposta comercial e nas telas administrativas da obra e Financeiro.

## Impressão no celular
Em **Obras e execução → abrir a obra → Visualizar / PDF da OS**, selecione
**Salvar como PDF** no Android. Use papel **A4** e, se o visualizador oferecer
a configuração, habilite a impressão de elementos gráficos em cores.
Em uma OS curta, o documento cabe em uma folha. Em OS com muitos serviços,
o sistema distribui a tabela em folhas adicionais sem omitir itens;
as observações e assinaturas ficam na última folha.

A impressão é criada dinamicamente com os dados efetivos da OS. Não utiliza
imagem fixa com cliente, preço ou datas falsos.

## Testes
- `tests/work-order-print.test.mjs` valida campos, proteção contra HTML
  não confiável, ausência de valores e distribuição integral dos serviços.
- `tests/work-order-print-browser.cjs` gera PDF A4 em Chromium com logos
  carregados e verifica número de páginas e o documento multipágina.
- `tests/budget-browser.cjs` confere o botão de impressão da OS real
  no fluxo de navegador mobile.

Nenhum registro de obra, orçamento, medição, cliente ou folha de pagamento
é alterado por esta atualização visual.
