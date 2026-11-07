# CIVOLTEN — Base limpa (7 de novembro de 2026)

Esta é uma reconstrução da interface e do frontend da CIVOLTEN com foco em **Início**, **Configurações → Custos da empresa** e **Funcionários → Custo do funcionário**.

## O que permanece ativo

- Tela principal com resumo mensal: despesas fixas, variável previsto e custo da equipe.
- Configurações: criar, editar e excluir custos fixos mensais/anuais e custos variáveis por unidade de consumo/serviço.
- Cadastro de funcionários CLT e prestadores/terceirizados com custo mensal e custo por hora quando há horas informadas.
- Login/cadastro Neon Auth original e botão Minha conta / Sair, sem criação de novo banco.

Todos os itens são salvos **neste dispositivo**, sob a chave `civolten_core_v1`. A base antiga `civolten_daily_v2` permanece intacta, mas seus registros não são exibidos na nova interface. Não houve migração automática dos dados antigos para evitar misturar cálculos e categorias diferentes.

## Preservação / reversão

Todo o código anterior está guardado em `backup/civolten-completo-antes-reinicio-20261107`, a partir do commit `3712a8b507eb9b14992b19fc857224dc7a377734`. Nenhuma tabela do Neon nem nenhum backup foi excluído. Não apague os dados do navegador antes de confirmar a estratégia de backup e migração da nova base.

A autenticação utiliza `NEON_AUTH_BASE_URL` no build da Vercel. Em produção, não há bypass quando a autenticação está indisponível. O teste sem conta real só existe com `CIVOLTEN_BROWSER_TEST_MODE=true` no ambiente localhost.

## Como são calculados os custos

- Fixo mensal: valor registrado. Fixo anual: valor / 12.
- Variável previsto no mês: preço por unidade × quantidade prevista. Quantidade ausente **não equivale a zero**, e o item não entra na soma prevista.
- CLT: salário-base + provisão mensal de 13º + 1/3 de férias + FGTS percentual informado sobre a base provisionada + encargos patronais percentuais informados + benefícios e outros custos mensais.
- Custo CLT por hora = custo mensal gerencial / horas produtivas mensais informadas.
- Prestador: custo por hora/dia/mês; projeção mensal depende da unidade e quantidade contratada, quando aplicável.
- Capacidade produtiva da empresa opcional: rateio dos custos fixos / horas produtivas da empresa no mês.
- **Não são inventados encargos, horas produtivas nem quantidades**. Se faltarem dados, o painel apresenta estimativa parcial.

Os cálculos são estimativas gerenciais. Conferir legislação, CCT, regime tributário, adicionais e encargos efetivos com profissional contábil antes de definir custo contratual.

## Limitações intencionais desta primeira etapa

Orçamento, SIURB/SINAPI, proposta comercial, obras, produtividade, cronograma, despesas da obra e execução **não estão ativos na nova interface**. Serão reprojetados por etapas.

O backup automático antigo é mantido no backend para eventual recuperação, mas **não deve ser considerado backup do novo armazenamento**. Antes de usar em dois dispositivos, implementar backup/migração específicos da nova base. Os dados atuais são local-first.

## Testes sem serviços pagos

```
npm install --no-audit --no-fund
npm test
# em ambiente CI/dev com NEON_AUTH_BASE_URL e CIVOLTEN_BROWSER_TEST_MODE=true:
npm run build
npx playwright install chromium
npm run test:browser
```
