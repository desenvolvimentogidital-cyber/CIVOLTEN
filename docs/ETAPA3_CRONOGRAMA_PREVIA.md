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
