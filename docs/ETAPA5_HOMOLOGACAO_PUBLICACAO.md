# CIVOLTEN — Etapa 5: homologação e publicação segura

Atualizado em 29–30/10/2026. Este documento é um *runbook* de
homologação, não atestado de liberação para clientes reais.

## 1. Estado observado dos ambientes

| Ambiente | Estado verificado | Pode receber cliente? |
|---|---|---|
| GitHub `main` | Etapa 4, commit `75d2038e8af0c0d46d21d519867deaac3e12ac74` | Não apenas por CI |
| Vercel `civolten-gj91` | Hobby, build-rate-limit; último deployment production READY no SHA `0fe2bbaa3639c9d7d22a239cf4fb4c45bae4f986` | Não: código anterior |
| Neon `main` | Migrações 0001–0008 existentes, sem tabelas 0010–0013 | Não publicar nova API |
| Neon `civolten-stage5-homologacao-20261029` | Cópia isolada de main, migrations 0010–0013 aplicadas em transação | Somente QA |

Projeto Neon: `mute-poetry-27518267`, branch de QA:
`br-crimson-fog-b6pyoiov` (não é branch principal).
O projeto está no plano Neon `free_v3` e a equipe Vercel no Hobby.
O banco principal **não foi alterado**. Na QA foram confirmadas:
`schedule_progress_measurements`, `proposal_draft_snapshots`,
`budget_actual_costs`, `budget_cash_receipts`,
`budget_completion_forecasts` e `archived_at` nas equipes e tarefas.
O SQL de QA foi gerado exclusivamente das migrações versionadas e
executado em transação: 15 instruções aditivas, sem `DELETE` ou `DROP`.
Os testes de integração com bancos descartáveis já estavam aprovados.

**Atenção:** na Vercel há uma variável criptografada `DATABASE_URL`
aplicada aos targets `production` e `preview`. Isso não prova que os
valores são iguais, mas também não prova que sejam diferentes.
**NUNCA** simular clientes ou emitir POST na prévia sem antes verificar
que a variável específica da prévia leva à branch isolada da Neon.
Não copiar/registrar URLs com senha em logs, tickets ou scripts.

## 2. Comandos locais de verificação (somente leitura)

Com o token/URL do ambiente correto configurado **localmente**, sem
enviá-lo em chat ou commitar:

```powershell
npm ci
npm test
npm run preflight:stage5
```

O último comando lê apenas `information_schema`. Confere as tabelas
e colunas mínimas e mostra o que falta, sem imprimir `DATABASE_URL`.
Ele não aplica migrations, não publica código e **não** altera
`commercial_release` do servidor.

## 3. Requisitos antes de ativar a prévia

1. Conferir `DATABASE_URL` target `preview` sem mostrar segredo;
   direcioná-la exclusivamente a um banco de QA. Não apontar a
   prévia de testes para `main`.
2. Fixar o SHA de commit do teste. Repetir ações GitHub `tests` e
   `integration`, inclusive backup cifrado e restauração isolada.
3. Testar no browser autenticado: login e logout, perfis
   `administrador/orcamentista/revisor/consulta`, criação e aprovação
   de medições/recebimentos/custos, proteção CSRF, revisão simultânea
   (HTTP 409), Gantt, PDF A4 marcado *NÃO EMITIDO*, modos claro/escuro
   e celular/tablet/desktop.
4. Registrar capturas de tela sem dados sensíveis e resultados de
   acessibilidade/uso. Verificar ausência de erros de runtime.
5. Isolar os dados fictícios, nunca sincronizá-los para produção.

## 4. Critérios adicionais para ativar produção

- Aguardar restabelecimento da cota Hobby **sem contratar upgrade**;
  usar somente uma publicação de SHA aprovado, sem forçar builds
  repetidos no limite.
- Confirmar configuração do projeto, domínio, variables e autorizações
  da conta Vercel. O acesso conectado de automação pode ter restrições
  diferentes do papel `OWNER` no time.
- Confirmar backup/restauração e autorização explícita antes da
  transação de migrations **0010–0013 no Neon principal**.
- Publicar um build com ambiente de **produção** e comprovar que usa
  migrations correspondentes ao código. Não promover uma prévia com
  ambiente de QA diretamente para o domínio comercial.
- Validar custos/cotações SIURB faltantes e divergentes, regime
  tributário, BDI, cronograma e assinatura dos responsáveis.
- A emissão, envio, assinatura e aceite verificável de proposta comercial
  permanecem desabilitados. O sistema ainda não implementa serviço
  integrado de assinatura digital/nota fiscal. A funcionalidade não
  deve ser simulada como conclusão jurídica.
- Somente após smoke real, revisão e liberação formal (com evidências
  e SHA) autorizar clientes reais.

## 5. Trava de liberação

`src/stage5-release-gates.mjs` exige evidência de: CI, esquema,
backup, isolamento de prévia, permissão/cota Vercel, browser,
conciliação de custos, tributos, contrato, aceite e autorização da
publicação. Um booleano simples ou alegação sem referência verificável
não marca o checklist como aprovado.

**Resultado corrente:** implementação funcional pronta para
homologação controlada; deploy de produção e
`commercial_release` seguem BLOQUEADOS.

## 6. Próxima intervenção segura

Esperar a janela de quota Hobby e identificar/fixar
`DATABASE_URL` preview→QA antes de emitir um único POST; repetir
testes de browser, registrar aprovação dos responsáveis e aplicar a
migração principal apenas depois do aceite formal.


## 7. Defesa adicional testada na prévia — migração 0014

- A Vercel possui agora `DATABASE_URL` **somente em production**.
  A opção `preview` foi retirada da variável original, sem alterar seu
  valor criptografado. Este isolamento impede a herança involuntária do
  banco principal pelas prévias.
- Foi criada a branch de GitHub `qa-stage5-homologacao-20261029`,
  apontando para uma versão da etapa 5.
  Uma prévia da Vercel chegou a `READY` no deployment
  `dpl_64a4TYRqiT4Lgod8F5sqAVa9DHdQ`. A verificação de interface
  autenticada permanece pendente: o ambiente possui proteção SSO e,
  corretamente, **não possui DATABASE_URL na prévia**.
- A Vercel possui a variável **não secreta**
  `CIVOLTEN_QA_DB_BRANCH_ID=br-crimson-fog-b6pyoiov`, somente para
  a branch de GitHub `qa-stage5-homologacao-20261029`.
- A migração `0014_stage5_preview_guard.sql` cria a tabela
  `deployment_environment_guards`. O banco Neon de homologação recebeu,
  **somente nele**, uma linha com `environment=preview` e o
  identificador correspondente. A migração **não semeia** esta linha.
- Antes de qualquer POST, PUT ou DELETE quando `VERCEL_ENV=preview`,
  o servidor verifica no banco conectado a existência da marca correta.
  Ausência da variável, ausência da tabela, erro SQL ou divergência do
  ID produzem **HTTP 503** sem executar a escrita. Este mecanismo é
  uma defesa complementar à separação de `DATABASE_URL`.
- A camada de checklist não pode liberar clientes ou contratos por
  simples flags: `production_ready` e `commercial_release` seguem
  `false` mesmo que todos os itens documentais sejam alegados
  como concluídos. Homologação e aceite profissional são processos
  externos independentes.

**Ação manual inevitável e restrita:** na Vercel, abrir
Project `civolten-gj91` → Settings → Environment Variables → adicionar
`DATABASE_URL` com target **Preview** e Git branch exclusiva
`qa-stage5-homologacao-20261029`, utilizando a URL da branch Neon QA
`br-crimson-fog-b6pyoiov`. Não aplicar esse valor a Production nem a
todas as prévias. A ferramenta de automação bloqueou a transferência
de credenciais entre conexões Neon e Vercel por política de segurança.
O usuário deve copiar o segredo diretamente nos painéis, sem enviar
senhas ao ChatGPT. Só depois repetir o deploy de prévia e os testes
autenticados no navegador. A Vercel pode continuar protegendo a URL
por SSO; não desligar essa proteção para realizar o teste.
