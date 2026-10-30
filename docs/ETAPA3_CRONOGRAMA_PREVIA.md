# CIVOLTEN — Etapa 3, primeira entrega: prévia de cronograma por equipes

## Objetivo
Conectar as equipes, atividades e dependências já modeladas no banco ao
motor `src/schedule-engine.mjs`, reutilizando a autenticação da API privada.

## Endpoint inicial, somente leitura

`GET /api/v1/budgets/:id/schedule-preview?start_date=2026-11-02&work_days_week=5&safety_pct=25&holidays=2026-11-02,2026-11-20`

Responde com atividades, início/fim calculados, dias úteis, folga, conflitos,
avisos e `ready`. Não altera datas persistidas.

- Só aceita durações de atividades inteiras e individualmente marcadas
  como `revisado`, `aprovado` ou `validado`.
- Bloqueia atividade sem equipe do próprio orçamento, tarefa vinculada a
  serviço arquivado e dependências que não sejam `FS` sem lag.
- Evita converter automaticamente horas de equipamento ou coeficientes de
  h-h SIURB ainda parciais em prazo contratual.
- Calcula atividades em paralelo para equipes diferentes e impede conflitos
  de disponibilidade na mesma equipe.
- Mantém `commercial_release=false` e `preview_only=true`.

## Próximas entregas da Etapa 3
- Tela de cadastro/edição de equipes e funções, com controle por perfil.
- Serviços associados a atividades com rendimento por profissão e equipamento.
- Jornadas, disponibilidade, feriados locais e produtividade efetiva.
- Dependências FS/SS/FF e defasagens após validação matemática.
- Gantt persistido, caminho crítico, simulação de recursos e medições reais.

**Esta entrega inicia a Etapa 3; não a declara concluída nem apta a uso comercial.**


## Entrega integrada de cadastro, revisão e visualização (29/10/2026)

A interface privada `public/secure.js` abre o módulo Cronograma a partir do detalhe
de orçamento. `public/secure-schedule.js` e `public/secure.css` incluem:

- Cadastro de equipe (nome, profissão, número de profissionais, jornada e eficiência).
- Criação de atividade vinculada opcionalmente a um serviço do mesmo orçamento.
- Registro de dependência FS sem defasagem; ciclos impedidos.
- Aprovação **individual** de duração em dias úteis, exclusiva para
  `administrador` ou `revisor` e com justificativa técnica auditada.
- Formulário de simulação de calendário com feriados, regime de cinco ou seis
  dias úteis e margem de segurança.
- Relatório de atividades simultâneas, data de término e linha do tempo
  responsiva para celular e desktop nos modos claro/escuro.
- Indicadores h-h somente quando `labor_review_state` foi validado. Insumos
  parciais SIURB não são convertidos em capacidade real por suposição.

O endpoint `GET /api/v1/budgets/:id/schedule-plan` retorna planejamento completo.
Edições são autenticadas e limitadas a orçamento `rascunho` com
`lock_version`, que impede sobrescrever mudanças concorrentes:

| Método | Endpoint | Permissão |
|---|---|---|
| POST | `/api/v1/budgets/:id/schedule-crews` | administrador/orçamentista |
| POST | `/api/v1/budgets/:id/schedule-tasks` | administrador/orçamentista |
| PUT | `/api/v1/budgets/:id/schedule-tasks/:taskId` | administrador/revisor |
| POST | `/api/v1/budgets/:id/schedule-dependencies` | administrador/orçamentista |
| GET | `/api/v1/budgets/:id/schedule-preview?... ` | usuários autenticados |

Os registros têm trilha de auditoria e não modificam os custos aprovados.
A prévia não altera datas persistidas e mantém `commercial_release=false`.

Testes em `tests/stage3-management.test.mjs`,
`tests/stage3-schedule-api.test.mjs` e `tests/stage3-db-integration.test.mjs`
cobrem permissões, concorrência, ciclos, feriados, paralelo e produtividade.
O banco real de clientes não recebe dados fictícios desses testes; somente
PostgreSQL descartável do GitHub Actions é utilizado.

### Próximas funcionalidades ainda pendentes na Etapa 3
- Edição e arquivamento controlado de equipes/atividades, com histórico.
- Medição de produtividade **real** por frente, profissional e período.
- Alocação de múltiplas profissões por atividade e equipamentos por turno.
- Atualização de cronograma a partir de medições e análise do caminho crítico.
- Revisão visual real em navegador autenticado por duas pessoas/dispositivos.

A Etapa 3 é uma entrega de desenvolvimento; NÃO equivale à liberação comercial.
