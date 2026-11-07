# CIVOLTEN • Encargos CLT automáticos

Implementado em 07/11/2026 no aplicativo premium CIVOLTEN, sem recriar funcionários/custos existentes.

## Como funciona

Em Funcionários → Novo/Editar → CLT, basta preencher nome, função e salário-base. Ao informar R$ 2.800, por exemplo, o aplicativo imediatamente apresenta a estimativa mensal global, discriminando salário, provisão de 13º, provisão para férias/cobertura, adicional constitucional de 1/3, FGTS, CPP/INSS patronal, RAT/FAP, outras entidades, benefícios e outros custos. Os custos são exibidos no cartão do empregado, no total da equipe e no painel inicial. Horas produtivas são opcionais, necessárias somente para custo/hora.

As alíquotas são configuradas **uma vez por conta** em Mais → Encargos CLT da empresa. A tabela Supabase public.cv_payroll_settings_v1, migração civolten_company_clt_rates_v1, salva o enquadramento e taxas com RLS de proprietário. **Os salários, despesas e funcionários já cadastrados não são alterados.** A escolha de regime passa a recalcular todos os trabalhadores CLT sem gravar valores de estimativa nos registros.

## Cenários iniciais (não homologados)

| Tipo | FGTS | CPP patronal | RAT estimado | Terceiros |
|---|---:|---:|---:|---:|
| Simples Nacional, Anexo IV (cenário inicial) | 8% | 20% | 2% | 0% |
| Simples Nacional, demais anexos | 8% | 0% | 0% | 0% |
| Lucro Presumido / Real | 8% | 20% | 2% | 5,8% |

**Não é possível determinar o enquadramento da empresa apenas pelo salário.** Os percentuais variam com CNAE, Anexo do Simples, RAT ajustado por FAP, entidades de terceiros, lotação tributária, eventual CPRB/desoneração e regras específicas. A configuração padrão é um ponto de partida para cenários de obras, mas pode não ser o enquadramento da empresa. O contador deve conferir e ajustar uma única vez. A estimativa não deve ser tratada como guia de pagamento, valor exato da folha ou obrigação fiscal.

O modelo de provisão gerencial usa salário + 1/12 de 13º + 1/12 de férias/cobertura + 1/36 do adicional constitucional de férias e calcula os encargos percentuais sobre essa base gerencial. Isso é **custo para planejamento de mão de obra**, não soma de obrigações mensais recolhidas na mesma competência: a rubrica de férias/cobertura evita falta de orçamento quando o empregado sai de férias ou é substituído. Em operações sem cobertura, confirme com a contabilidade se a parcela deve ser ajustada para evitar duplicidade com o salário já pago.

O sistema não supõe benefícios, vale-transporte, alimentação, periculosidade, insalubridade, horas extras, adicionais noturnos, afastamentos, complementos de convenção coletiva ou multa rescisória. Benefícios e extras são somados só quando informados. Descontos de INSS/IRRF do trabalhador não são custos patronais adicionais e não são novamente somados.

Exemplo ilustrativo com R$ 2.800, sem benefícios e cenário inicial Anexo IV:
- Salário-base: R$ 2.800,00
- 13º proporcional: R$ 233,33
- Férias/cobertura: R$ 233,33
- Terço de férias: R$ 77,78
- FGTS: R$ 267,56
- CPP patronal: R$ 668,89
- RAT estimado: R$ 66,89
- Total: **R$ 4.347,78/mês (estimativa de planejamento)**

Referências federais:
- [Receita Federal: CPP no Simples Nacional Anexo IV](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cobrancas-e-intimacoes/contribuicao-previdenciaria-anexo-iv-do-simples-nacional)
- [Receita Federal: contribuições previdenciárias para PJ](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/contribuicoes-previdenciarias-pj)
- [FGTS: depósito de 8% no vínculo CLT](https://www.fgts.gov.br/Paginas/subpaginas/recolhimento-empregado.aspx)
- [Gov.br: planilha gerencial de 13º, férias e encargos](https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-5-de-26-de-maio-de-2017-atualizada)

## Segurança e testes

RLS individual para SELECT/INSERT/UPDATE/DELETE, user_id PK/foreign key para auth.users. Não usa service-role no navegador; banco de dados é fonte autoritativa. Testes Node e Playwright verificam cálculos, configuração e recarga, sem custos externos.
