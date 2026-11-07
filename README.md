# CIVOLTEN — Interface premium (proposta aprovada)

Reimplementação do aplicativo a partir do GitHub limpo, baseada no layout visual aprovado: **preto, prata e dourado**, utilizando o logotipo e o símbolo originais da empresa (arquivos PNG restaurados por hash Git, sem modificação).

## Telas

- **Entrar / Criar conta**: UI metálica, login por e-mail/senha via Neon Managed Auth já existente. Esqueci minha senha utiliza a função de recuperação quando disponibilizada pelo Neon.
- **Início**: saudação, 4 indicadores financeiros, atalhos e resumo mensal.
- **Custos da empresa**: abas fixos/variáveis, inserção/edição/exclusão, periodicidade mensal ou anual, previsão mensal dos variáveis.
- **Funcionários**: cadastro CLT/prestador, status, custos mensais e por hora com valores reais informados.
- **Mais**: configurações, entrada para custos/equipe e saída da conta.

Os botões "Relatórios" e módulos futuros são **apenas referências visuais**, sem prometer funcionalidades ainda não implementadas.

### Dados

Os valores do mockup (nomes e valores fictícios) **não são inseridos na base real**. O estado inicial está vazio. Dados editados são gravados no navegador em \`civolten_premium_v1_<userId>\` de forma isolada por sessão. **Não há ainda sincronização nem backup da nova base entre celulares.** A integração Neon existente serve à autenticação. Não se escreve em tabelas antigas.

Custos CLT exibidos são projeções gerenciais com 13º, adicional de 1/3 de férias, encargos/FGTS e benefícios **somente conforme percentuais informados**; encargos ausentes ficam pendentes. Confira regras trabalhistas, CCT e tributação antes de usar os valores contratualmente. Custo variável sem previsão de quantidade não vira custo zero inventado.

### Desenvolvimento gratuito

\`\`\`sh
npm install --no-audit --no-fund
npm test
NEON_AUTH_BASE_URL="https://SEU-ENDPOINT-NEON-AUTH" npm run build
npm run test:browser
\`\`\`

O projeto publica no Vercel com o diretório \`dist\`. É necessária a variável \`NEON_AUTH_BASE_URL\` no build do ambiente de produção. **Nunca defina \`CIVOLTEN_E2E=true\` em produção**: essa opção cria um simulador de sessão exclusivamente em localhost para o teste do layout.

## Identidade visual

Usa \`assets/civolten-logo.png\` (wordmark original) e \`assets/civolten-simbolo.png\` (símbolo original), além de um fundo SVG decorativo de construção. Quatro telas compartilham navegação inferior, cartões escuros, reflexos metálicos, botões dourados e adaptação para Android. A aparência é fiel ao conceito aprovado, adaptada às restrições de telas reais e conteúdo variável.

## Validação

- \`npm test\`: preço fixo mensal/anual, variável com/sem previsão, CLT, prestador e isolamento de contas.
- \`npm run test:browser\`: renderização, navegação, criar, editar e excluir, voltar após recarga; roda apenas em build de teste local.
- GitHub Actions realiza ambos antes de permitir merge à \`main\`.

Não foram removidos bancos, contas nem dados existentes no Neon.
