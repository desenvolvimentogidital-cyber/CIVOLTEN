# CIVOLTEN — Auditoria de cálculos, dados e arquitetura

Data-base da verificação: 09/11/2026 (UTC). Repositório: `desenvolvimentogidital-cyber/CIVOLTEN`.
Projeto Supabase: `CIVOLTEN-Orcamentos`, sem exclusão ou alteração de registros de produção.

## Escopo técnico verificado

1. **Custos da empresa:** `src/calc.mjs`, `src/payroll.mjs`, `src/cost-presets.mjs`.
   - Fixos mensais são somados; anuais são rateados por 12.
   - Variáveis usam quantidade mensal, com padrão 1 quando preço foi informado sem quantidade.
   - Funcionários ativos CLT têm provisões gerenciais de folha (13º, férias, FGTS, CPP/RAT conforme regime), terceirizados usam unidade/quantidade contratada.
   - Modelos de custos com valor zero não entram no somatório.
2. **Base de preços:** `src/pricing.mjs`, `src/settings-ui.mjs`.
   - Capacidade mensal em HH = dias produtivos × horas/dia × profissionais produtivos.
   - Rateio da despesa mensal pela capacidade; sem incluir salários já presentes como custos diretos novamente.
   - Preço = custo ÷ (1 − alíquota tributária efetiva% − margem sobre a venda%).
   - Valores monetários de venda e impostos utilizam centavos inteiros e pontos-base de 0,01% (BigInt), sem diferenças de arredondamento de ponto flutuante.
   - O simulador unitário compartilha o motor de cotações com o orçamento.
3. **Orçamentos:** `src/budget.mjs`, `src/budget-ui.mjs`, `src/budget-print.mjs`.
   - HH totais da linha = quantidade × coeficiente HH por unidade.
   - Materiais/equipamentos adicionais são multiplicados pela quantidade, quando informados.
   - Total das linhas, custo, tributo e lucro fecham com o preço comercial; arquivo CSV e PDF são derivados do mesmo cálculo.
   - O modo *por dias* é um orçamento distinto: rateia o custo mensal por dias produtivos e multiplica pela duração da obra; não deve ser confundido com precificação por HH.
   - Preço dos rascunhos contém fotografia dos parâmetros no momento de criação; novos custos não sobrescrevem orçamentos antigos.
4. **Cronograma:** `src/budget-schedule.mjs`.
   - Estima duração útil = teto(HH totais ÷ [profissionais × horas/dia]).
   - Sem teto artificial de 730 dias; calcula dias de trabalho em vez de criar milhares de datas.
   - Sugere equipe para reduzir prazo e para um mês produtivo.
5. **Catálogo SIURB/SINAPI:** `src/catalog-xls.mjs`, `src/catalog-import.mjs`, `src/service-catalog.mjs`.
   - Arquivos XLS, XLSX e CSV com códigos, nomes, unidades e coeficientes HH; preços oficiais não entram.
   - Produção em 09/11/2026: 2.617 composições SIURB, 2.426 com coeficientes de mão de obra e **191 sem coeficientes**; nenhuma composição tem custo direto próprio cadastrado.
   - Serviços sem HH precisam de avaliação técnica antes de gerar preço de execução.
6. **Financeiro:** `src/finance.mjs`.
   - Faturamento por vencimento, caixa por data de pagamento/recebimento; propostas e custos previstos não criam lançamentos realizados automaticamente.
7. **Banco e segurança:** `src/cloud.mjs` e tabelas `cv_*` do Supabase.
   - Todas as oito tabelas da aplicação em `public` estão com RLS ativo e políticas por usuário (`auth.uid()`).
   - Paginação corrigida em todas as tabelas, em lotes de 500 com ordenação estável por `created_at,id`, para não perder linhas além do limite padrão de resultados.
   - Nenhuma alteração de banco ou saldos foi necessária nesta auditoria.
8. **Entrega:** GitHub Actions `npm test`, build `npm run build`, Chromium mobile e teste de formulário; publicação por workflow da `main` e Vercel.

## Verificações quantitativas

Cenário operacional da configuração atual (sem expor dados de pessoas):
- Dias produtivos: **22**; horas/dia: **8**; profissionais produtivos: **2**; capacidade: **352 HH/mês**.
- Imposto informado: **6% da venda**; margem: **30% da venda**.
- Exemplo: R$ 21.153,35 por mês ÷ 352 = R$ 60,0947/HH.
- Serviço de 150 m² × 1,78 HH/m² = **267 HH**; mão de obra **R$ 16.045,30**; preço **R$ 25.070,79** sem materiais adicionais.
- Os testes automatizados verificam cenários de múltiplos serviços, pagamento por HH ou por dias, valores unitários/quantidades, impostos, margem, relatórios, cronograma e grandes tabelas no banco simulado.

## Pontos que exigem confirmação antes de chamar preço de definitivo

- **Encargos CLT não revisados:** em produção existem dois profissionais CLT ativos e **nenhuma configuração de encargos revisada/salva**. O aplicativo usa parâmetros **iniciais gerenciais**, que podem variar por enquadramento fiscal, CNAE, FAP e convenção coletiva. É necessário confirmar os parâmetros com a contabilidade em *Mais → Encargos CLT da empresa*. A nova tela de orçamento avisa isso explicitamente.
- **Custos incompletos:** existem 30 linhas de custos fixos (2 acima de zero) e 38 linhas de custos variáveis (3 acima de zero). Os demais modelos não entram no custo mensal; rever se representam despesas que de fato existem. Materiais diretos e equipamentos de cada obra exigem orçamento próprio quando não incluídos corretamente nas despesas mensais.
- **Alíquota de venda:** os 6% informados são configuração da empresa, não apuração fiscal verificada. Confirmar alíquota efetiva do serviço, retenções e impostos aplicáveis.
- **Produtividade SIURB:** 191 serviços sem HH; coeficientes com valores extremos e serviços auxiliares devem ser revisados por profissional habilitado. A equipe genérica do cronograma é estimada em HH totais; o sistema **não valida automaticamente a função/qualificação de cada funcionário para cada serviço**, nem a produtividade real em campo.
- **Prazo:** a estimativa considera semana de segunda a sexta, sem feriados, paralelismo real, dependências técnicas, mobilização, clima ou deslocamentos. É planejamento gerencial, não cronograma executivo validado.
- **Execução/contratos:** no conjunto de tabelas e módulos inspecionados não foi encontrado persistência estruturada de contratos, medições de execução por serviço, diário de obra, cronograma realizado ou apontamento de HH em campo. Não confundir o orçamento/cronograma preliminar com acompanhamento completo da execução.
- **Segurança adicional:** o advisor Supabase aponta `auth_leaked_password_protection` desativado. Avaliar habilitar na área de Auth se disponível no plano: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- **Histórico:** há um rascunho antigo marcado como `demo=true` no banco. Ele é preservado e deve ser revisado antes de emitir como proposta real.

## Política para alterações

- Nenhuma alteração de salário, preço, quantidade, contrato, orçamento ou lançamento de produção sem autorização e revisão.
- Sem serviços pagos para testes: GitHub Actions, simulador Supabase e Chromium.
- O resultado correto dos testes de software não garante que entradas como salários, tributos, HH da SIURB, materiais e produtividade real foram confirmadas: tais dados exigem conferência técnica/contábil.
