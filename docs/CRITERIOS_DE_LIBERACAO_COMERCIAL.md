# CIVOLTEN — critérios para liberação comercial segura

Estado em 29/10/2026: **NÃO LIBERADO PARA DADOS OU PROPOSTAS CONTRATUAIS REAIS NA VERCEL**.

## Fontes incorporadas e verificação

- Dados oficiais SIURB SP jul/2026, rerratificação 01/10/2026.
- 6.988 preços unitários, regimes com/sem desoneração, Edificações/Infraestrutura, fonte e SHA256 registrados.
- 6.926 fichas de composições, com discriminação de **horas diretas de profissionais** e insumos complementares.
- 62 preços sem ficha de composição correspondente nestes quatro arquivos: indisponibilidade assinalada, jamais estimar h-h automaticamente.
- A aplicação **não interpreta hora de trator, retroescavadeira, ferramentas ou veículos como hora-homem**.
- Composições auxiliares ainda não estão inteiramente expandidas; por isso os valores de h-h diretas **não são considerados prazo certificado** e ficam separados de estimativas manuais.
- Relatório de ensaios: `npm test`, incluindo consistência entre fichas e custos.

Fonte: https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179

## Controle obrigatório de emissão

A emissão de proposta deve ser bloqueada se faltarem:

1. cliente e CPF/CNPJ verificados;
2. obra identificada, endereço e escopo/observações detalhados;
3. serviços com unidade, quantidade e custo unitário positivo, sem erros matemáticos;
4. coeficientes h-h revisados para cada serviço e prazo calculável;
5. data-base/regime coerentes e condições de pagamento e validade preenchidas;
6. identificação/CNPJ/contato da empresa;
7. ambiente persistente, com autenticação e backups; demonstração Vercel nunca deve emitir documento contratual.

Depois disso, é necessária **assinatura de responsabilidade técnica/comercial** sobre riscos que a regra automática não consegue conferir. Sem validação humana não usar a expressão “preço fechado sem risco”.

## Execução em fases, com critérios de aceite

### M1 — segurança e persistência (bloqueante)

- Criar banco PostgreSQL separado para CIVOLTEN, utilizando plano gratuito durante testes. Nunca reaproveitar banco de outro sistema.
- Criar migrações idempotentes, constraints de integridade e transações.
- Autenticação real e cookies HTTP-only Secure; hash de senha, limite de tentativas, proteção contra CSRF e separação de perfis.
- Clientes, obras, orçamentos e versões de propostas com histórico imutável e controle de revisão.
- Backups restauráveis e **teste de restauração**, proteção de dados LGPD, retenção configurável.
- **Aceite:** criar orçamento no desktop, recuperar no celular com mesma conta; sair/entrar sem perda; recuperar backup; usuário não autorizado não acessa dados.

### M2 — engenharia dos custos (bloqueante)

- Composições auxiliares recursivas, encargos, mão de obra horista/mensalista, materiais, equipamentos, critérios de medição e classificação específica.
- Conferir códigos, unidades, valores, soma das parcelas, perdas, fretes, mobilização e impostos.
- BDI detalhado por administração central, riscos, seguro, garantia, despesas financeiras, tributos e lucro, sem duplicidade; fórmulas e tributação devem ser aprovadas por responsável.
- Cotação local dos itens fora da SIURB e comparação entre preço de referência e orçamento de fornecedores.
- Reserva de contingência **financeira** separada da folga **de cronograma**. Não esconder uma na outra.
- Comparativo de risco ±5%, ±10%, ±15% e mínima margem comercial.
- **Aceite:** conjunto de orçamentos reais históricos reconciliado com planilhas conferidas por técnico, sem arredondamentos inesperados.

### M3 — produtividade e prazo (bloqueante)

- Coeficientes de mão de obra **por função**, jornadas, tamanho real de cada equipe, equipamento e capacidade.
- Disponibilidade, dependências, atividades paralelas, caminho crítico, dias não úteis, clima, acesso, cura e suprimentos.
- Folga de segurança configurável e explicitada, sem compensar erros sistemáticos de produtividade.
- Ajuste com produtividades históricas observadas, registrado por obra e responsável.
- **Aceite:** cronograma revisado para cenários com equipes diferentes e conflitos de recursos; nunca permitir término calculado quando houver atividade sem rendimento validado.

### M4 — proposta e contratos (bloqueante)

- PDF diretamente gerado em servidor, identidade CIVOLTEN, numeração e versionamento.
- Descrições completas, quantitativos, exclusões, condições, validade, impostos, garantia e reajustes.
- Histórico de envio e aceite com registro de versão; nenhuma alteração silenciosa após emissão.
- **Aceite:** PDF A4 legível em desktop e celular, com valores idênticos ao orçamento e exportação reprodutível.

### M5 — homologação

- Testes completos de cliente → obra → composição → quantidade → precificação → produtividade → cronograma → proposta → aceite.
- Testes para temas claro/escuro/automático, resolução 360/390/768/1440, acessibilidade e erros offline.
- Simular mudança de preço, supressão/aditivo, orçamento duplicado, usuário simultâneo, backup e restauração.
- **Aceite:** relatório de QA assinado com pendências críticas zeradas; monitoramento de erro em produção.

## Restrição de infraestrutura atual

A Vercel atualmente serve uma demonstração estática com dados em localStorage. Esse modo **não sincroniza, não tem autenticação de produção e não oferece banco/backup central**. A primeira versão de servidor SQLite é local, não pode ser hospedada como banco persistente em funções serverless. Não inserir CPF/CNPJ reais nesse ambiente.

## Regras de publicação

- Uso comercial real: permitido somente após M1–M4 e homologação M5.
- Custos oficiais: referências de cálculo, não são preços garantidos no local da obra.
- Trabalhar em GitHub com CI aprovado. Não alterar a conta gratuita ou contratar plano sem solicitação explícita.
