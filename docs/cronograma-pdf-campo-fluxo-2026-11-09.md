# CIVOLTEN — Revisão de fluxo e Cronograma para Campo (PDF)

## Fluxo do sistema verificado

1. Configurar custos fixos, variáveis, equipe/encargos e alíquota/margem.
2. Importar catálogo SIURB/SINAPI para usar coeficientes de mão de obra (HH/unidade).
3. Elaborar orçamento de **mão de obra**, quantidade e HH, conferir cálculo.
4. Gerar proposta PDF comercial, com preço e condições, e disponibilizar aceite/recusa.
5. Receber resposta na Central de Respostas, validar o cliente e abrir OS aprovada.
6. Gerar OS administrativa PDF **sem preços**.
7. Gerar **Cronograma para Campo em PDF A4 sem preços** e entregar à equipe.
8. Iniciar execução, apontar HH reais por profissional e serviço, registrar medições.
9. Aprovar medições, lançar a receber, conciliar pagamentos e concluir obra.

O sistema possui etapas automáticas, mas o responsável deve conferir produtividade,
cronograma, presença da equipe, conclusão física, aceite, documentos de campo e
requisitos fiscais. Não afirmar que o cronograma é um plano executivo detalhado
apenas pela distribuição das HH.

## Como imprimir o cronograma no celular

**Antes de abrir a obra:** Orçamentos → Abrir orçamento →
Cronograma automático → **Visualizar / PDF para campo**.
O CSV de cronograma continua disponível separadamente.

**Depois da contratação:** Obras e execução → Abrir obra →
**Cronograma para campo / PDF**.

O Android exibirá **Salvar como PDF**; selecione papel **A4**.

O documento contém:
- Logo e símbolo oficiais CIVOLTEN.
- Cliente, obra e referência da proposta/OS.
- Prazo em dias úteis, equipe prevista, HH e datas estimadas.
- Serviços e quantidades, funções sugeridas e previsão por serviço.
- Caixas **Pendente**, **Em execução** e **Concluído**.
- Campo para data de marcação, ocorrências, responsável e assinatura.
- Uma ou mais páginas conforme quantidade de serviços.
- **Nenhuma informação de preço ou custos internos.**

Os quadrinhos são para preenchimento manual **após imprimir**. As marcações
feitas no papel **não atualizam automaticamente** o Supabase.
O encarregado precisa registrar as HH reais e medições no aplicativo.

O calendário considera segunda a sexta e **não desconta feriados**;
exclui chuva, acesso, sobreposição de frentes de serviço, dependências
e problemas de campo. As datas do papel são estimadas; precisam de
validação pelo responsável da obra antes de serem tratadas como compromisso.

No orçamento, a prévia usa os dados da edição atual; sem salvar, alterações
não são arquivadas. Na obra, o PDF usa a cópia congelada da proposta
aprovada e a data de início armazenada na OS, quando informada.

## Próximas melhorias recomendadas (não implementadas neste pacote)

- Validar com o contador encargos CLT, produtividade e custos operacionais.
- Fazer um teste completo numa obra real: HH executadas → medição → conta a
  receber → pagamento efetivamente recebido.
- Criar apontamento **digital** por profissional, com responsável, fotos e
  evidências, de modo a reduzir dependência de fichas de papel.
- Acrescentar feriados e dependências entre serviços ao cronograma executivo,
  revisão de sequenciamento e reprogramações por imprevistos.
- Manter histórico de versões de cronogramas validados antes do envio
  à equipe, sem mudar propostas já aceitas.

## Verificações automáticas

- `tests/schedule-print.test.mjs`: plano congelado, conteúdo/checkboxes,
  proteção contra HTML e nenhuma linha de preço.
- `tests/schedule-print-browser.cjs`: impressão real de uma e muitas folhas
  A4, logos carregados, sem páginas extras.
- `tests/budget-browser.cjs`: valida os botões de cronograma PDF tanto
  no orçamento como na OS aprovada, além dos fluxos anteriores.
