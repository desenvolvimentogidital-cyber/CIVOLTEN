# CIVOLTEN — Etapa 3: diário de execução, produtividade e cadeia crítica

Atualização: 29/10/2026. Projeto novo, sem dados de clientes ou orçamentos antigos.

## Recursos incluídos nesta entrega

- Migração aditiva `0010_schedule_progress.sql`: registro por atividade e
  dia executado, quantidade medida, trabalhadores, horas por trabalhador,
  horas-homem reais calculadas no PostgreSQL, referência da evidência e notas.
- Um lançamento começa sempre `pendente`. Revisores autorizados, diferentes
  do criador, podem definir `validado` ou `rejeitado`, com justificativa
  obrigatória. Medições rejeitadas não são apagadas.
- Autorização por sessão, anti-CSRF, estados de rascunho e `lock_version`
  impedem gravações concorrentes. O servidor recusa data futura,
  tarefa de outro orçamento e duplicidade por tarefa/dia.
- API `GET /api/v1/budgets/:id/schedule-progress`: retorna últimas
  200 evidências e **totais do histórico inteiro** por tarefa, incluindo
  quantidades validadas, h-h, h-h/unidade, percentual executado em relação à
  quantidade de orçamento vinculada e alertas de quantidades acima de 100%.
- API `POST /api/v1/budgets/:id/schedule-progress`: insere a evidência
  pendente com auditoria. `PUT /api/v1/budgets/:id/schedule-progress/:id`
  valida ou rejeita por perfil autorizado e pessoa diferente.
- Painel do cronograma: lançamento de medições por data, revisão de
  evidências, indicadores de produtividade observada, identificação de
  atividades críticas no Gantt e resumo operacional.
- `src/schedule-critical-chain.mjs`: calcula **cadeia crítica preliminar**
  da sequência FS e das restrições de equipe. Separada da margem de
  segurança e sempre marcada como não contratual.

## Regras de negócio inegociáveis

- Horas-homem de composição SIURB *parcial* não viram produtividade real.
- Evidência pendente ou rejeitada não entra em quantidades e horas validadas.
- A aprovação operacional **não** altera preços, BDI, propostas nem ativa
  `commercial_release`.
- Não apagar medição, nem sobrescrever revisão concluída.
- Não gravar clientes fictícios no Neon principal.
- A implantação em produção requer aplicar a migração em ambiente
  controlado antes de abrir a tela; CI usa PostgreSQL descartável.

## Testes

`tests/stage3-progress-integration.test.mjs` testa o fluxo completo
na API real em banco descartável: autorização por perfil, dia futuro,
quantidade/horas inválidas, duplicidade, concorrência, aprovação,
rejeição, produtividade observada, trilha de auditoria e cálculo correto
do total mesmo que o número de evidências supere o limite de exibição.

`tests/stage3-critical-chain.test.mjs` confirma cálculo das tarefas
críticas com equipes simultâneas, restrição de equipe e tarefas sem
duração validada.

## Pendências para concluir a Etapa 3

- Edição e arquivamento de equipes, atividades e dependências com histórico.
- Atualizar as previsões de duração restante conforme medições reais,
  respeitando o calendário e o vínculo a serviço.
- Testar a interação no navegador autenticado em celular e desktop.
- Homologar migração e políticas em ambiente de desenvolvimento antes de
  integrar ao site comercial.
- Somente depois de concluída a Etapa 3 iniciar a Etapa 4
  (propostas, margens e acompanhamento financeiro).

**Status: Em desenvolvimento. PR em rascunho; produção não liberada.**
