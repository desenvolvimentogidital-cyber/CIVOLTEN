# CIVOLTEN — Auditoria de preços, custos e automação
**Data:** 05/11/2026  
**Escopo:** PWA de orçamento, catálogo SIURB/SINAPI, folha de custo, despesas fixas/variáveis, cronograma, proposta, persistência local e publicação.  
**Regra de publicação:** usar somente recursos gratuitos. Não substituir nem modificar cadastros reais do usuário durante auditoria.

## 1. Correções prioritárias implementadas
| Risco encontrado | Correção | Arquivo |
|---|---|---|
| Permitir emitir preço manual/desc. com prejuízo ou margem menor que a configurada | Auditoria antes de **Salvar proposta**: valida custo+tributos, desconto, margem alvo e maior referência comparável | `financial-audit.js` |
| Atualizar rascunho diretamente para Enviado/Aprovado sem revisão | Validação também na mudança de situação de uma proposta salva | `financial-audit.js` |
| Ratear despesas fixas somente em alguns serviços com horas cadastradas | Exige produtividade para cada item ou total de horas conferido do orçamento antes de emitir | `financial-audit.js` |
| Dimensionar menos pessoas que a equipe mínima da composição | Respeita o mínimo de cada profissão; dimensiona adicionalmente pelo prazo | `workforce-schedule.js` |
| Ignorar profissional com tarifa 0 quando outro da mesma função possui custo | Sinaliza custo da equipe incompleto, especialmente quando dedicação exclusiva está ativa | `workforce-schedule.js` |
| Selecionar SINAPI ou SIURB na pesquisa, mas perder a maior referência ao adicionar o item diretamente | Puxa as duas fontes estritamente comparáveis para o item, usa a **maior** na base comercial (escopo completo, custo próprio separado) | `quote-automation.js` |
| Mapeamento de função com acentos falhava em algumas correspondências de SINAPI | Normalização Unicode da profissão | `quote-automation.js` |
| Múltiplos campos na tela de item, dificultando orçamento | Exibe **pesquisa + quantidade**, com dados técnicos recolhidos em Detalhes avançados | `quick-quote-item.js` e `daily-workflow.js` |

### Regras de cálculo verificadas
1. **Funcionário CLT:** salário-base + adicionais condicionais + provisão do 13º (1/12) + adicional constitucional de férias (1/36) + FGTS/CPP/RAT definidos por cenário + benefícios e reservas. O aplicativo não calcula uma folha de pagamento fiscal completa nem garante que os percentuais correspondem ao enquadramento legal do usuário.
2. **Custos diretos:** soma, por serviço, `quantidade × (mão de obra própria + materiais fornecidos pela empresa + equipamentos)`.
3. **Custos fixos:** nos orçamentos novos que usam `fixed_hourly_v1`, `horas-homem × despesa fixa mensal / capacidade mensal de horas faturáveis`. A capacidade deve refletir toda a empresa, não só um funcionário.
4. **Despesas da obra:** alimentação/deslocamento e outras variáveis entram separadamente, com quantidade/pessoas/dias. Não lançar benefícios já incluídos na folha uma segunda vez.
5. **Preço:** `(custo real + proteção comercial comparável) / (1 - margem alvo - tributos sobre venda - taxas)`. O prêmio de referência não se torna despesa contábil; desconto e preço manual são revalidados antes de emitir.
6. **Cronograma:** `quantidade × horas de profissional por unidade`; equipe mínima da composição e prazo por função; dias úteis de segunda a sexta, sem feriados. Rateio de dedicação exclusiva somente quando escolhido.

## 2. Verificações executadas
- Sintaxe dos arquivos JS principais e scripts embutidos no HTML.
- Cenários de salário-base R$ 2.800 e R$ 3.000, MEI ilustrativo, Anexo IV ilustrativo e adicional de periculosidade quando aplicável.
- Preço automático com margem; preço manual abaixo do custo; desconto abaixo da margem; ausência de mão de obra; composição SINAPI não conferida; custos fixos com produtividade parcial; referencia pública global maior sem contaminar custos reais.
- Pesquisa de serviços importados direto de SIURB/SINAPI e preservação de códigos, fontes e valores; coeficientes de pedreiro/ajudante mapeados para profissionais com custo/hora.
- Cronograma com equipe mínima da composição e tarifa ausente em uma parte da equipe.
- Fluxo de formulário rápido com campo único de quantidade e detalhes técnicos recolhidos.
- Criado `tests/financial-audit.cjs` para regressões e `.github/workflows/financial-audit.yml` para executar automaticamente ao alterar o código. **Condição de verificação do GitHub Actions deve ser confirmada antes de usar o status como evidência de aprovação**.

## 3. Limites e pendências — necessários antes de liberar uso sem supervisão
| Prioridade | Limitação | Ação recomendada |
|---|---|---|
| Alta | **Sem auditoria do usuário no navegador real e sem comprovação de testes de ponta a ponta** (cadastro → orçamento → PDF → edição) | Testar 3 obras reais no celular, comparando a memória de cálculo com orçamento manual |
| Alta | Composições SINAPI podem conter subcomposições com trabalho e materiais não desmembrados automaticamente; SIURB pode ter metodologia e custos distintos | Validar a cadeia analítica, coeficientes e equivalência técnica antes de propor preço real |
| Alta | Preços SINAPI/SIURB não devem substituir o custo efetivo dos insumos da obra; custo real de materiais pode faltar | Vincular e conferir preços por fornecedor, frete, perdas, impostos e variação local |
| Alta | Salários e encargos são **estimativas de simulação**, não folha/eSocial: pisos da CCT, RAT/FAP, férias/substituição, horas extras, adicionais, rescisões e benefícios podem ser diferentes | Conferir com contador e RH antes de contratar e orçar grandes obras |
| Alta | Persistência principal no **localStorage**, com SINAPI no IndexedDB; sem sincronização multiaparelho e sem backup automático no servidor | Exportar backup JSON periodicamente, guardar o XLSX e testar restauração antes de confiar dados críticos |
| Média | Capacidade mensal fixa padrão de **160 horas** pode estar incoerente para equipes de 5 ou mais postos e super/superalocar indiretos | Ajustar ao total real de horas-homem faturáveis mensais da empresa |
| Média | Cronograma não inclui automaticamente feriados, chuva, acesso, férias da equipe, frentes com dependências completas e produtividade real da obra | Validar com engenheiro/responsável técnico, registrar contingência e atualizar execução |
| Média | Orçamentos históricos não foram reprecificados nem auditados retroativamente; podem conter valores antigos e condições próprias | Conferir individualmente antes de reenviar proposta antiga |
| Média | Tributos configurados com 0% podem não representar as alíquotas reais (MEI tem tratamento próprio e Simples varia) | Definir regime e alíquotas com contador |

## 4. Critérios de aceite para a próxima fase
- Selecionar serviço SIURB/SINAPI → informar somente quantidade → preencher horas, custo real de equipe e material **quando os dados estiverem conferidos**, sem valores fictícios.
- No exemplo da alvenaria de 300 m², reproduzir coeficientes oficiais da composição específica e calcular horas-homem, quantidade de profissionais e prazo, sem extrapolar para alvenarias de outra espessura/material.
- Orçamento com custo zero de mão de obra, material obrigatório ausente, margem negativa, preço abaixo da maior referência aplicável ou produtividades incompletas **não pode ser emitido como proposta validada**.
- Confirmar que despesas mensais, despesas da obra e custo CLT não são somados em duplicidade.
- Revisar visual da proposta/PDF e comparar o somatório de serviços, valor bruto e lucro com a memória de cálculo, inclusive com desconto e impostos.
- Fazer backup e restauração num dispositivo de teste, sem mexer nos cadastros originais.

## 5. Situação da publicação
A auditoria distingue **código salvo no GitHub**, **testes lógicos simulados** e **produção Vercel READY**. Uma atualização só é considerada publicada quando o SHA da implantação de produção corresponder ao commit que contém a correção. Limites de implantação do plano gratuito podem impedir ou atrasar novas versões; não relatar código apenas em GitHub como se estivesse ativo no site.

**Conclusão:** houve correção de riscos relevantes, mas **não existe base para garantir risco zero de prejuízo** enquanto custos, convenções coletivas, materiais, tabelas e execução real não forem validados.
