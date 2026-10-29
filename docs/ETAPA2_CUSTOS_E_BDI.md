# CIVOLTEN — etapa 2: engenharia de custos e revisão de orçamento

**Estado:** funcionalidades integradas em desenvolvimento; **não homologado para emissão de orçamentos contratuais reais** enquanto pendências abaixo não forem resolvidas. Não avançar automaticamente para a etapa 3.

## O que foi implementado

- Migração `0007_cost_engineering.sql`: perfil analítico de BDI e contingência por orçamento, evidências por serviço (medição, fonte, fornecedor, data e referência de cotação, perdas, frete, custos unitários complementares) e custos diretos extras (mobilização, frete, equipamentos, descarte e outros).
- Migração `0008_siurb_component_details.sql`: preserva, sem adulterar, coeficientes e listas diretas de profissionais, materiais, equipamentos e auxiliares do catálogo SIURB.
- O **catálogo SIURB de julho de 2026, rerratificado em 01/10/2026**, foi importado para `reference_prices`/ `reference_price_versions`, com **6.988 preços**, versões por categoria/regime e URL/SHA-256 das quatro planilhas oficiais.
- Foram inseridas **6.926 fichas de composições diretas** vinculadas a preços. Exatamente **62 preços não possuem composição** nos arquivos de origem. Não são considerados completos, não se inventam coeficientes ou serviços auxiliares.
- A API privada inclui busca de itens SIURB, consulta detalhada de composição e inclusão de preços oficiais diretamente no orçamento com verificação de regime, data-base, código, unidade e preço pela **base do servidor**.
- `GET /api/v1/budgets/:id/costs`: demonstra custo direto, BDI calculado, contingência, custo por item, alertas e cenários de elevação dos custos em 5%, 10% e 15%.
- `PUT /budgets/:id/cost-settings`: registra taxas separadas e justificativa revisada, com controle de versão, trilha de auditoria e permissões. A aprovação depende de administrador/revisor e **não é automática**.
- `PUT /budgets/:id/cost-review/:itemId`: confirma medição e evidência da fonte/cotação, perdas e custos complementares; itens SIURB só aceitam referência oficial compatível e não podem marcar composição ausente como revisada.
- `POST/DELETE /budgets/:id/extra-costs`: extras documentados separadamente, com bloqueio de duplicação declarada.
- Alterações de serviços, preços ou extras **invalidam aprovações financeiras anteriores**, de maneira atômica no PostgreSQL.
- O painel privado agora tem **Conferir custos e BDI**, busca de serviços SIURB, visão de insumos diretos, custo total calculado por item e avisos.

## Fórmula de BDI

A forma implementada, em percentuais parametrizados por orçamento, é:

```text
BDI = [(1 + AC + S + G + R) * (1 + DF) * (1 + L) / (1 - I)] - 1
```

AC = administração central; S = seguros; G = garantias; R = riscos; DF = despesas financeiras; L = lucro; I = tributos sobre o faturamento.

Referência técnica: https://www.tce.to.gov.br/profissaogestor/images/obrasPublicas/CartilhaObrasPublicas3aEdicao2013TCU.pdf (cartilha de obras públicas). **Nenhum percentual é presumido como alíquota legal da empresa.** Tributos e composição do BDI devem ser revisados por contador ou profissional responsável.

A contingência financeira é calculada em separado, sobre custos diretos, e **não** substitui produtividade nem margem de segurança do cronograma. O sistema alerta sobre risco no BDI e contingência concomitantes, e sobre custos extras já incluídos no preço de itens.

## Precisão monetária

O motor `src/estimate-engine.mjs` converte quantidade com até 6 casas, custo unitário com até 4 casas, perdas com até 2 casas e extras em centavos, usando operações `BigInt` e arredondamento ao centavo. A ficha apresenta custo base, perdas, frete, outros valores e eventual ajuste de arredondamento, para que a soma final seja reproduzível.

A regra de cálculo é:

```text
unitário final = unitário base + arredondamento( unitário base × perdas%) + frete unitário + demais custos unitários
custo direto do serviço = arredondamento(quantidade × unitário final)
custo direto global = soma(serviços) + custos diretos extras não incluídos
preço estimado = custo direto global + BDI calculado + contingência explícita
```

As taxas e custos de serviço não são automaticamente sinônimos de preço de venda aprovado. Deve-se verificar não incidência duplicada dos insumos e dos encargos.

## Limites e pendências para encerrar a etapa 2

1. **Composições auxiliares recursivas e insumos oficiais detalhados**: os arquivos SIURB incorporados têm somente fichas diretas; ainda não foi homologada toda a expansão de auxiliares com custo de cada componente. As fichas sem composição permanecem bloqueadas e as fichas parciais são sinalizadas.
2. **Conferência com cotações locais e orçamento histórico**: reconciliar orçamentos representativos da CIVOLTEN com planilhas conferidas por técnico, comparando centavos, unidades, quantidades, encargos, perdas, fretes, materiais e produtividade necessária. Não usar valores fictícios como aprovação comercial.
3. **Revisão tributária responsável**: impostos, regime da empresa, tributos pertinentes ao faturamento, administração central e taxa de lucro precisam de assinatura de responsável.
4. **Aceite do fluxo online**: publicar a versão atual do GitHub na Vercel, executar smoke test dos arquivos/rotas; operador autenticado ainda precisa testar busca SIURB, inclusão, cotações e revisões no browser. Permanecem válidos os controles de acesso, backup recorrente e restauração previstos na etapa 1.
5. **Condições de aprovação:** `commercial_release=false` no endpoint; a geração de propostas reais da etapa 4 continua bloqueada.

## Fontes e proveniência

- Prefeitura de São Paulo — tabelas oficiais SIURB: https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179
- Dados locais com catálogo e SHA por origem: `public/data/siurb-2026-07.json`; composições: `public/data/siurb-compositions-2026-07.json`.
- Scripts e testes: `src/costing-api.mjs`, `src/estimate-engine.mjs`, `tests/costing-integration.test.mjs`, `tests/estimate-engine.test.mjs`, `tests/complete-flow.test.mjs`.
- Banco exclusivo de desenvolvimento: Neon `civolten-orcamentos-dev` (`main` original). Nenhum banco de outro projeto deve ser utilizado.

**Regra de liberação:** nunca garantir preço final sem conferência de escopo, quantidades, cotação local, tributação e revisão técnica humana.
