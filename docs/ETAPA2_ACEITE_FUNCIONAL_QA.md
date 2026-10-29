# CIVOLTEN — Aceite funcional da Etapa 2 (ambiente de QA)

Data: 29/10/2026. Projeto desenvolvido do zero; **não pressupõe orçamentos históricos**.

## Fluxo aprovado no PostgreSQL descartável

Cenário sintético executado pela API autenticada em
`tests/stage2-synthetic-journey.test.mjs`:

1. Cliente fictício cadastrado via API (nenhum CPF/CNPJ real).
2. Obra fictícia de reforma cadastrada e vinculada ao cliente.
3. Orçamento julho/2026, sem desoneração, com dois serviços próprios:
   pintura de 100 m² × R$ 50,00 e piso de 30 m² × R$ 80,00.
4. Custo direto de **R$ 7.400,00**, com cotação rastreável fictícia
   por serviço (fornecedor, referência, data, valor unitário).
5. BDI analítico hipotético (AC 4%, seguro 1%, garantia 0,5%, risco 1%,
   despesas financeiras 1%, lucro 5%, tributos faturamento 7%) e
   contingência financeira 5%; **preço calculado em QA: R$ 9.356,88**.
6. Revisão técnica e comercial marcadas apenas por administrador fictício
   em QA; não representam autorização de profissional real.
7. Sensibilidade de custo calculada para +5%, +10% e +15%.
8. Inclusão de mobilização de R$ 200,00 revogou a aprovação anterior.
   Remoção do custo restaurou o custo direto, mas não a aprovação.
9. Gravação com versão vencida rejeitada HTTP 409; ações auditadas.
10. `commercial_release=false` permaneceu durante todo o percurso.
11. Backup, restauração e recuperação criptografada em banco descartável
   validados pelo workflow PostgreSQL da CI.

**Prova:** https://github.com/desenvolvimentogidital-cyber/CIVOLTEN/actions/runs/40970889115

## Critério de disponibilidade

- A **engenharia de custos de serviços próprios/cotados está funcional em QA**.
- Serviços SIURB podem ser consultados e importados como referências
  unitárias, mas **não são automaticamente aprovados**, principalmente quando
  faltam insumos ou conciliação da composição.
- 8 fontes oficiais suplementares conferidas; 5.828 preços e 232 auxiliares
  normalizados; CI PostgreSQL descartável aprovou importação repetida sem
  duplicar registros.
- Das 6.926 composições de serviços, 2.864 fecharam exatamente, 2.377
  ficaram a até dois centavos, 740 possuem unidade/insumo pendente e 945
  ultrapassam dois centavos de diferença. Também existem 62 preços
  sem ficha direta.

## Bloqueios que permanecem — não confundir com aprovação comercial

- Não publicar orçamentos ou contratos reais até validação humana de
  BDI, tributação e preços da obra.
- Não aceitar preços SIURB com composição não conciliada como certificado
  nem preencher custos faltantes por suposição.
- Precisa validar login, dois dispositivos e backup agendado real.
- A Etapa 3 pode usar a API de orçamento já validada em QA, mantendo
  estas restrições de preço e de uso comercial.
- Entrega comercial da aplicação depende da Etapa 5.

**Não executar migração para produção nem abrir `commercial_release`
automaticamente.**
