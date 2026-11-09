# CIVOLTEN — Operação de mão de obra da proposta ao recebimento

Versão de implantação: 09/11/2026. Apenas prestação de serviços de mão de obra;
sem compra, venda ou fornecimento de materiais pelo CIVOLTEN nesta etapa.

## Como usar no celular

1. Em **Orçamentos**, crie uma proposta com serviços SIURB/SINAPI. Cada item
   usa **quantidade × HH/un × custo da HH** e imposto e margem cadastrados na
   empresa. Confirme cliente, escopo, validade, pagamento, prazo e garantia.
   Salve e revise a proposta Signature PDF.
2. Depois de receber o aceite efetivo do cliente, abra **Orçamentos** e toque
   em **Registrar aceite e abrir obra**. Informe número da OS e a evidência
   verificável do aceite (contrato, e-mail, mensagem), marque a confirmação.
   Isso gera uma **ordem de serviço** no Supabase; não é assinatura eletrônica.
3. Abra **Obras e execução**, escolha a OS e toque em **Iniciar execução**.
   A proposta, HH e valores ficam congelados no documento aprovado. O
   orçamento original não pode ser alterado nem excluído depois da aprovação.
   Para uma nova proposta, utilize a opção **Duplicar para nova proposta**.
4. Em **Apontar horas trabalhadas**, selecione serviço, funcionário ativo,
   data e horas reais. O sistema confronta a função cadastrada com as funções
   da composição SIURB, exigindo confirmação expressa da qualificação se
   houver diferença. Jornadas acima do horário da empresa em obras
   simultâneas exigem confirmação de horas extras. A gravação no Supabase
   impede o mesmo funcionário ultrapassar 24 HH totais por dia. Apontamentos
   equivocados podem ser removidos enquanto a obra estiver em execução.
5. Em **Registrar medição**, escolha o serviço e a quantidade executada;
   o banco calcula o valor proporcional ao preço **congelado** no contrato,
   sem usar o custo atual da empresa. Nunca permite medir mais que a quantidade
   contratada. Revise e toque em **Aprovar medição**; depois de aprovada,
   não pode ser apagada ou alterada. Medições ainda em conferência podem
   ser removidas e refeitas.
6. Em **Lançar a receber**, escolha o vencimento. A operação registra
   **uma única** receita em aberto no Financeiro para essa medição e não
   considera dinheiro recebido nem emite NFS-e. O débito de medição não pode
   ser apagado ou modificado; só o vencimento e a data de recebimento podem
   mudar. No Financeiro, marque recebido **somente quando o pagamento entrar**.
7. A conclusão da obra exige **pelo menos um apontamento real de horas** e
   a aprovação das quantidades contratadas de todos os serviços. Use
   **Exportar relatório CSV** para auditoria de HH, progresso, medições e
   recebíveis, e **Imprimir ordem de serviço** para arquivo ou assinatura
   física. Uma OS aprovada, mas ainda não iniciada, pode ser cancelada com
   preservação do histórico.

## Segurança e integridade

- `cv_work_orders_v1`: uma OS por orçamento, valor aprovado e itens
  congelados (snapshot), transições aprovada → execução → concluída.
- `cv_work_logs_v1`: apontamentos ligados a usuário, obra, serviço e
  profissional; alterações e exclusões só enquanto a obra estiver em execução.
- `cv_measurements_v1`: quantidades por item e medição; gatilho limita
  ao contratado e calcula preço no PostgreSQL. Medição aprovada é imutável.
- `cv_bill_measurement_v1`: lançamento financeiro atômico e idempotente;
  índice único por `MED:<uuid>`.
- Todas as tabelas novas possuem RLS com `auth.uid()` e permissões limitadas
  a usuários autenticados. Sem uso de `service_role` no navegador.
- A proteção de orçamento e cobranças financeiras impede exclusão/acidentes.
- Migrações aditivas: `supabase/operations_v1.sql` e
  `supabase/operations_v1_hardening.sql`. Nenhum orçamento, salário, contrato
  histórico, serviço ou preço existente foi alterado.

## Cálculos e relatórios

- Horas previstas por serviço = quantidade contratada × HH/un.
- HH reais = soma de apontamentos por pessoa e serviço.
- Custo gerencial das HH reais = HH reais × custo de HH capturado na
  proposta aprovada (estimativa para gestão, não folha efetivamente paga).
- Medição parcial = preço total do item aceito × quantidade medida /
  quantidade contratada. O último saldo recebe eventual ajuste de centavos
  para fechamento exato com o total do contrato.
- O total medido e o recebido são diferentes: o recebimento só acontece
  na data de baixa financeira informada pelo usuário.

## Pendências que ninguém pode confirmar automaticamente

- **Encargos CLT:** a configuração fiscal e encargos dos dois funcionários
  existentes ainda precisam de validação contábil. Não marque como revisado
  sem conferir o regime, RAT/FAP, benefícios e impostos aplicáveis.
- **Produtividade:** há 191 serviços SIURB sem HH; precisam de composição
  própria antes de cotação.
- **Aceite do cliente:** deve existir prova real do contrato, mensagem ou
  assinatura. O sistema apenas registra a referência e data informadas.
- **Emissão NFS-e:** é feita pelo emissor oficial autorizado da empresa;
  este módulo é **faturamento gerencial**, não integração municipal de notas.
- **Feriados, clima, simultaneidade física e segurança no canteiro** exigem
  avaliação da operação; o cronograma automático é uma estimativa de horas.
- **Aditivos contratuais:** use uma nova proposta e faça o instrumento
  contratual correspondente fora do aplicativo. O preço aprovado original
  não é reescrito, para manter rastreabilidade.

## Testes

A suíte `npm test` valida cálculo, contratos, HH reais, quantidades medidas,
arredondamento e lançamentos únicos. O teste Android `tests/budget-browser.cjs`
simula o fluxo salvo em um Supabase local de testes (E2E):
proposta → OS → HH → medição → financeiro → conclusão → recarga.
O CI roda em recursos gratuitos do GitHub Actions e Chromium.
