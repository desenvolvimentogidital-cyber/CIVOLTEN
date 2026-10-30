# CIVOLTEN — Etapa 4: proposta interna, histórico e acompanhamento de custos

## Conclusão da primeira entrega funcional

O projeto é construído do zero. Todos os testes de orçamentos, propostas e
notas são realizados com clientes, fornecedores e valores estritamente
**fictícios** em PostgreSQL descartável, sem gravar no banco principal.

### Propostas internas
- Migração `0012_stage4_finance.sql`: `proposal_draft_snapshots` com
  versões sequenciais por orçamento, revisão da origem, payload JSON imutável,
  SHA-256, autoria e data.
- O snapshot contém orçamento, cliente, obra, itens, escopo, exclusões,
  pagamento, validade e cálculo da **mesma API de custo da Etapa 2**.
- O sistema apresenta os erros de revisão de custos e marca qualquer
  versão antiga como **desatualizada** após alteração do orçamento.
- PDF A4 de rascunho, com marca d'água visível `RASCUNHO - NAO EMITIDO`,
  liberado somente por sessão autenticada. O PDF comercial aprovado
  `src/proposal-pdf.mjs` permanece separado e não é acionado.
- Documentos internos não são ofertas, contratos nem aceites.
  `commercial_release=false` mesmo quando o custo está matematicamente
  revisado.

### Financeiro
- `budget_actual_costs`: descrição, categoria, data, valor em centavos,
  evidência documental e notas. Cada lançamento nasce pendente.
- A validação ou rejeição é exclusivamente por administrador/revisor **diferente
  do criador**, com justificativa e trilha de auditoria.
- `GET /api/v1/budgets/:id/financial-summary` discrimina custo realizado
  validado, pendente e categorias, e compara com custo direto orçado.
- O sistema calcula contribuição indicativa do orçamento e percentual de
  custo já realizado, mas não apresenta isso como lucro líquido. Sem custo
  a completar, faturamento e tributos efetivos, `final_profit_reais=null`.
- Rejeições e evidências passadas são preservadas, nenhuma emissão real é
  criada automaticamente e a tabela antiga `proposals` permanece inalterada.

### Endpoints internos
- `GET/POST /api/v1/budgets/:id/proposal-drafts`
- `GET /api/v1/budgets/:id/proposal-drafts/:draftId`
- `GET /api/v1/budgets/:id/proposal-drafts/:draftId/pdf`
- `GET/POST /api/v1/budgets/:id/financial-actuals`
- `PUT /api/v1/budgets/:id/financial-actuals/:actualId`
- `GET /api/v1/budgets/:id/financial-summary`

As rotas exigem sessão. Os POST/PUT usam `lock_version` e o cabeçalho
anti-CSRF existente. Documentos financeiros só são adicionados em orçamento
rascunho. A interface preserva temas claro/escuro e layout de celular.

### Testes
- `tests/stage4-finance-integration.test.mjs`: documento versionado,
  conflito de versão, indicação de revisão faltante, desatualização,
  documento PDF autenticado, custo pendente, duplicidade, aprovação/rejeição
  separadas, comparação de valores e confirmação de **zero** propostas
  comerciais na tabela `proposals`.
- `tests/proposal-draft-pdf.test.mjs`: A4, marca de não emissão,
  várias páginas, bloqueio de snapshot sem assinatura hash e recusa de
  documentos marcados como emitidos/comerciais.
- Testes gerais e PostgreSQL descartável com backup/restauração no
  GitHub Actions.

## Ainda pendente para homologação da Etapa 4 e entrega final
1. Revisão tributária, preço real, insumos SIURB divergentes, empresa e
   responsável por assinatura: não substituir por números fictícios.
2. Emissão comercial, envio, aceite verificável do cliente e aditivos,
   somente depois de aprovação explícita de escopo, preço e prazo.
3. Fluxo de faturamento, recebimentos reais e custo a completar para
   cálculo responsável de margem efetiva e receita.
4. Teste em navegador autenticado no celular/desktop, restauração de
   backup e implantação liberada na Vercel. A produção está limitada por
   permissão/limite de builds da conta gratuita.

A Etapa 4 já possui a **base funcional em QA**. Seu uso comercial
permanece bloqueado e esta entrega não deve ser descrita como homologação
integral para clientes reais.


## Fechamento da Etapa 4 — recebimentos, previsão e integridade

Implementação adicional em **PR #6**:
- Migração `0013_stage4_receipts_forecasts.sql` adiciona recebimentos
  documentados (`budget_cash_receipts`) e snapshots de custo a completar
  (`budget_completion_forecasts`), ambos com registros imutáveis de evidência,
  estados `pendente/validado/rejeitado`, data efetiva, justificativa e
  **validação por outra pessoa**.
- `GET/POST /api/v1/budgets/:id/financial-receipts` e
  `PUT /api/v1/budgets/:id/financial-receipts/:recordId`;
  `GET/POST /api/v1/budgets/:id/financial-forecasts` e
  `PUT /api/v1/budgets/:id/financial-forecasts/:recordId`.
- `GET /api/v1/budgets/:id/financial-closeout` apresenta recebimentos
  validados e pendentes, custos realizados, custo a completar do último
  snapshot validado, custo total previsto e contribuição **hipotética**
  em comparação ao preço estimado. Somatórios monetários usam `BigInt`
  em centavos; o relatório usa agregados PostgreSQL e não limita totais
  à paginação recente.
- O fechamento sinaliza quando um gasto validado após a revisão do custo
  restante exige atualizar a previsão. Ausência de forecast validado gera
  valores `null`, não números inventados.
- `GET /api/v1/budgets/:id/commercial-readiness` lista os
  bloqueios para emissão, envio, assinatura e aceite de proposta.
  **Não existe aceite eletrônico válido ou emissão habilitada** sem
  homologação profissional, fiscal e identificação/autorização do cliente.
- Interface responsiva para lançar e revisar recebimentos e previsões,
  comparativo financeiro e motivos de bloqueio comercial.
- Os snapshots JSONB são conferidos novamente por SHA-256 antes de
  exibir ou gerar PDF de rascunho; adulterações são rejeitadas.
- Cenários sintéticos de QA cobrem pagamentos pendentes, duplicação de
  comprovantes, revisões independentes, previsão com custos validados,
  diferenças centavo a centavo, resultado hipotético negativo e
  tentativa de adulteração de snapshot/PDF.

### Critérios de aceite técnico e liberação comercial

Os critérios técnicos são testes gerais e integração em PostgreSQL isolado
com autenticação, auditoria, concorrência, recuperação e PDF.
**A liberação comercial é um processo diferente**, que continua exigindo:
1. Regularização/homologação dos custos oficiais SIURB divergentes e preços
   próprios, tributos aplicáveis, assinaturas de responsáveis e condições de
   contratação da empresa.
2. Identificação do aceitante e método verificável de aceite com prova de
   integridade, mais integração fiscal/nota fiscal se for emitir documentos
   tributários. O projeto ainda **não presta serviço de assinatura digital**.
3. Migrações 0010 a 0013 e testes de navegador/backup em implantação
   protegida autorizada — **não executados no banco principal**.
4. Liberação da cota/permissão de builds gratuitos da Vercel e homologação
   em celular/desktop autenticados.

O desenvolvimento funcional do núcleo de orçamento, cronograma, propostas
**internas** e controle financeiro está pronto para a Etapa 5 de
homologação/publicação, mas não equivale a documento contratual ou
processamento financeiro real homologado.
