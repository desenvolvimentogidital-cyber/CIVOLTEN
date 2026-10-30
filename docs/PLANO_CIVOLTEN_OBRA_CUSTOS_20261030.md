# CIVOLTEN — Levantamento e plano de execução (30/10/2026)

## Objetivo
Ao adicionar serviços a um orçamento, o CIVOLTEN deve sugerir automaticamente **sequência técnica**, **quantidade de pedreiros/ajudantes/eletricistas e demais profissões**, **dias úteis da obra**, **pico de funcionários sem contar o proprietário** e **custos gerenciais internos**. O usuário não é obrigado a cadastrar uma equipe para gerar a estimativa.

## Situação conferida (código e banco de 30/10/2026)
- GitHub \`desenvolvimentogidital-cyber/CIVOLTEN\`: orçamento, catálogo de 6.988 referências SIURB, estimador de horas-homem, sequência sugerida alvenaria → chapisco → reboco, resumo de profissões, cadastro opcional de custos internos e auditoria.
- Neon principal: 1 orçamento, 2 itens (100 m² de alvenaria / 200 m² de reboco); nenhum chapisco incluído; não há tabela comercial de custos preenchida nem cadastro real de profissionais.
- Coeficientes observados nos itens: alvenaria 1,4 h de pedreiro + 1,1 h de servente/m²; reboco 0,34 h de pedreiro + 0,28 h de servente/m². **Coeficientes SIURB diretos parciais**, sem liberação técnica.
- A ordem técnica encontra chapisco ausente e não preenche quantidade ou custo por conta própria. Pode haver chapisco em composição de outro serviço, o que deve ser revisado por técnico para evitar duplicidade.
- Vercel: o domínio de produção permaneceu no commit \`6ffb23f\` na última conferência, embora o GitHub esteja mais avançado. Deployment novo foi recusado por cota grátis de 100/dia. Não contratar plano pago para contornar.
- Banco/segurança: backups/cópias independentes existentes, inclusive branch \`civolten-backup-pre-custos-20261030\`. Migração \`0015\` já aplicada à base principal. Preços, clientes, orçamento, contas e contratos preservados.
- Os testes automatizados não substituem a homologação da navegação autenticada no celular.

## Implementações por ordem de prioridade

### P0 – Simulação de equipe disponível (iniciado nesta branch)
- Informar opcionalmente **N profissionais disponíveis** (ex.: 5 ou 10), **fora o proprietário**. Se não informado, utilizar o cenário anterior por prazo.
- Para cada serviço, distribuir no máximo N profissionais por profissão, com horas/dia e eficiência editáveis. Usar o gargalo da função que leva mais dias. Nenhum usuário precisa registrar equipe real.
- Se N for inferior ao número mínimo de especialidades exigidas simultaneamente, avisar que a composição não fecha; jamais inventar polivalência.
- Recalcular dias do serviço, pico de pessoal por profissão, sequência técnica e custo gerencial derivado. **N é limite por frente/atividade sequencial**; obras com frentes simultâneas precisam de dimensionamento global por período.

**Aceite:** testes com 5 vs 10, 1 profissional insuficiente, serviço sem composição, insumos indiretos fora de h-h; UI responsiva; API responde HTTP 400 em valores inválidos.

### P0 – Dependências e cronograma técnico real (próxima etapa)
- Introduzir regras de precedência configuráveis por item e frente de serviço, sem inferência rígida baseada apenas em texto. Usuário/técnico aprova a relação; registrar versão e trilha de auditoria.
- Incluir marcos e tempos tecnológicos (cura, secagem, inspeção, liberação, mobilização) somente quando definidos.
- Calcular início/término e caminho crítico; permitir atividades independentes em paralelo **sem atribuir os mesmos profissionais a duas frentes no mesmo dia**.
- Sinalizar serviços ausentes no orçamento, como chapisco, sem lançá-los automaticamente nem presumir metragem igual à da alvenaria/reboco.
- Evitar datas contratuais até revisão e aprovação. Controlar feriados, finais de semana e indisponibilidades locais no cálculo final.

**Aceite:** alvenaria antes de chapisco antes de reboco quando no mesmo sistema de paredes; duas frentes independentes podem se sobrepor sem duplicar trabalhadores; ciclo detectado e recusado; itens faltantes bloqueiam total final.

### P1 – Banco de profissionais, custos e capacidade da empresa (estrutura já criada)
- Aperfeiçoar perfis profissionais: função, custo-hora com salário + encargos + benefícios, disponibilidade, função do proprietário **opt-in** e status ativo. Não usar CPF nem dados sensíveis para simulação.
- Tratar explicitamente o número de pessoas disponíveis vs número realmente registrado, evitando atribuir funcionários fictícios.
- Modelar mobilização, terceirizados, transporte, alimentação, EPIs, ferramentas, locações, gestão, despesas fixas e custos de manutenção. Registrar de quem é cada custo para não contar duas vezes.
- Ratear despesas fixas por critério transparente (horas efetivamente produtivas, dias, horas por projeto ou participação); não jogar 100% das despesas mensais em toda obra simultânea.
- Controlar duração remunerada e dias de ociosidade: coeficiente h-h da SIURB não equivale automaticamente a folha paga.
- Operação interna: cenários \`5 profissionais\`/\`10 profissionais\`, dias, custo de mão de obra, custo indireto, custo total, margem e preço sugerido separados.

**Aceite:** relatório com todas as hipóteses e valores de referência; incompletos não exibem total fechado ou lucro inventado.

### P1 – Formação de preço e proposta
- Conciliar preços SIURB (que podem incluir mão de obra, materiais e equipamentos) com custos próprios para evitar duplicidade; suportar modo “referência SIURB” **ou** modo “custo próprio” explicitamente.
- Conferir BDI, encargos, impostos segundo regime e município/serviço, lucro desejado e contingências; não inferir alíquota individual automaticamente.
- Separar orçamento de custo interno, preço de venda e fluxo de caixa. Aprovação comercial humana e condições do contrato antes de liberar envio de proposta.

### P2 – Experiência e homologação
- Fluxo compacto: Cliente → Obra → Selecionar serviços → Cronograma automático → Ajustar equipe/prazo → Conferir custos → Revisar orçamento → PDF.
- Tela mobile: resumo de profissionais por função, sequência, dias, campos opcionais; sem obrigar cadastro de equipe/atividade.
- Testes reais de login, edição, busca SIURB, permissões, conversão monetária, PDF, faltas de composição, dados vazios, cache de CSS/JS, claro/escuro.
- Publicar preview assim que liberar cota grátis Vercel, verificar sessão e contrato comercial bloqueado, promover produção só após CI + verificações de banco.

## Proteções
1. Nenhum cadastro de teste deve modificar preços de referência SIURB.
2. Nenhuma conclusão deve ser rotulada “prazo de obra aprovado” sem escopo fechado e revisão técnica.
3. Salário/custo individual e overhead somente a perfis autorizados; não vazar ao PDF comercial.
4. Não inserir serviços ausentes sem o usuário escolher explicitamente uma referência e quantidade.
5. Não executar deploy pago, apagar dados, substituir banco principal ou remover autenticação.
6. CI automatizado e integração PostgreSQL precisam passar em cada PR antes do merge.

## Próxima entrega recomendada
Concluir P0 da capacidade disponível, testar em banco descartável, mesclar e publicar com a cota gratuita. Em seguida partir para relações de dependência por frente e cálculo de caminho crítico, ainda sem emitir valores comerciais.
