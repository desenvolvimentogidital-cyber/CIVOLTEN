# Plano de fechamento do CIVOLTEN — operação exclusiva de mão de obra

Referência: 09/11/2026. Escopo definido: **prestar serviços de mão de obra**, sem comercializar ou fornecer materiais ao cliente nesta fase.

## O que já pode ser usado

1. **Custos da empresa:** despesas fixas e variáveis reais, equipe CLT e encargos gerenciais agregados ao custo mensal, por usuário.
2. **Capacidade produtiva:** dias úteis/mês × horas produtivas/dia × profissionais produtivos.
3. **Catálogo técnico:** importação e busca SIURB/SINAPI, nomes, unidades, composição de funções e HH/un, sem importação de preços oficiais.
4. **Orçamentos:** quantidade × HH/un × custo real HH, imposto e margem sobre a venda; alternativa de preço por dias do cronograma; PDF e CSV. Novas propostas usam escopo exclusivo de mão de obra; orçamentos históricos mantêm seus preços originais.
5. **Cronograma preliminar:** esforço total, estimativa de duração com equipe cadastrada, profissionais para outro prazo, datas de segunda a sexta; sem limite arbitrário de 730 dias.
6. **Financeiro:** receitas/despesas por vencimento e por realização, relatórios e CSV, sem lançamento de receita automática por orçamento.
7. **Publicação:** GitHub Actions, build, testes de cálculo e Android, Supabase autenticado, Vercel.

## Decisões deste ciclo

- **Sem fornecimento de materiais:** não cobrar materiais/insumos em nenhum novo orçamento. O formulário de novos serviços oculta o campo de materiais; o motor recusa qualquer item com custo adicional diferente de zero quando `commercial.laborOnly = true`.
- **Histórico preservado:** orçamento existente com adicionais não será reprecificado. O escopo `laborOnly` é explicitamente marcado apenas em orçamentos novos; orçamento antigo sem marca segue a composição histórica.
- **PDF comercial:** sempre informar que materiais e insumos são fornecidos pelo cliente e excluídos da proposta. Equipamentos especiais precisam ser contratados/negociados à parte se necessários.
- **Despesas da empresa não são fornecimento ao cliente:** salários, EPI, ferramentas, deslocamento e despesas gerais que realmente existirem podem permanecer no custo mensal para compor o valor da hora. Conferir sua classificação e frequência; não adicionar como materiais de obra automaticamente.
- **Produtividade SIURB/SINAPI:** serviço importado fica tecnicamente apto quando tem coeficiente HH/un validado, sem precisar cadastrar custo de material.

## Pendências para declarar o uso diário liberado

| Prioridade | Bloco | Próxima ação | Responsável pela confirmação |
|---|---|---|---|
| **P0** | **Encargos CLT** | Configurar o regime real e revisar FGTS, CPP/RAT, terceiros e provisões; em produção existem dois funcionários CLT e nenhuma configuração revisada salva | Empresa + contador |
| **P0** | **Custo-hora efetivo** | Conferir despesas fixas, custos variáveis que são despesas operacionais e salários, para que o rateio 22 dias × 8h × 2 profissionais reflita a realidade | Empresa |
| **P0** | **Impostos e margem** | Confirmar alíquota efetiva do serviço por CNAE/regime e margem comercial; evitar dupla tributação | Contador + empresa |
| **P0** | **Produtividade aplicável** | Há 2.617 serviços SIURB importados, 2.426 com HH e 191 sem HH; revisar coeficientes usados nos primeiros orçamentos e profissões aptas | Responsável técnico |
| **P0** | **Aceite comercial** | Preencher condições de pagamento, validade, garantia, prazo e cláusula de materiais fornecidos pelo cliente em cada proposta | Empresa |
| **P1** | **Contratos e aceite formal** | Criar vínculo orçamento aprovado → contrato/ordem de serviço, versão do escopo, aprovação e histórico, sem sobrescrever proposta original | Desenvolvimento |
| **P1** | **Execução e medições** | Registrar HH realizadas, atividades, progresso, medição por serviço, datas e custo realizado; comparar estimativa versus realizado | Desenvolvimento + operação |
| **P1** | **Planejamento da equipe** | Vincular profissão exigida na composição à equipe habilitada disponível, férias e obras paralelas; cronograma atual usa capacidade genérica | Desenvolvimento + operação |
| **P2** | **Faturamento associado à medição** | Vincular medição aprovada à emissão/lançamento financeiro, sem presumir receita antes do aceite; nota fiscal não é emitida pelo sistema atualmente | Desenvolvimento + contador |
| **P2** | **Segurança** | Avaliar proteção contra senhas vazadas no Supabase Auth, conforme recurso do plano | Administrador |

## Critérios de fechamento mínimo (MVP de mão de obra)

- Dois profissionais e sua capacidade produtiva revisados; encargos CLT registrados e aprovados.
- Despesas operacionais mensais confirmadas e documentação de que não se fornecem materiais.
- Cinco serviços com produtividade conferida e orçamento calculado manualmente em planilha/amostra, com variação de quantidade e HH.
- Proposta só mão de obra validada, salva no Supabase, reaberta, exportada para PDF/CSV e conferida no celular.
- Prazo e dimensionamento simulados para equipe atual, inclusive acima de 730 dias.
- GitHub Actions concluído com sucesso e Vercel com o mesmo commit publicado.

## Limites conhecidos

A fórmula de precificação pode estar tecnicamente correta e ainda assim produzir preço insuficiente se despesas estiverem ausentes ou o regime tributário não tiver sido confirmado. O cronograma é preliminar: não inclui feriados, clima, restrições de acesso, relações de precedência ou profissionais efetivamente escalados. Não se devem prometer contratos eletrônicos, medições realizadas ou diário de obra sem módulos persistentes próprios no banco. Nenhum dado real foi alterado nesta implementação.
