# Padronização visual da CIVOLTEN — 19/10/2026

## Critérios de identidade
- Identidade cadastrada em **Área da empresa → Logo e cores** é a única fonte de logotipo, cores principais e largura. Nunca usar logo fictícia no lugar da imagem.
- `assets/civolten-padrao.css` contém tokens globais `--cv-*` que dependem de `--brand-primary` e `--brand-accent` aplicados por `assets/site-branding.js`; incluir por último em cada página.
- A base visual é fundo claro para formulários/painel e fundo azul-marinho nas seções fotográficas; detalhes dourados e contrastes acessíveis.
- O site preserva as imagens existentes de `assets/images` e respeita escolhas de movimento reduzido.

## Telas e navegação
| Caminho | Destino |
| --- | --- |
| `/` | Apresentação e categorias |
| `/servicos` | Serviços e diferenciais |
| `/orcamento` | Formulário e simulação do cliente |
| `/empresa` | Painel restrito a usuários autenticados |
| `/empresa?secao=logo` | Identidade visual |
| `/proposta.html` | Proposta compartilhada por link autorizado |
| `/privacidade.html` | Aviso de privacidade |

A versão para celular usa menu compacto com os destinos principais. Links da vitrine levam ao formulário sem misturar as telas. A página de proposta mantém sua lógica de leitura, aceite e solicitação de alterações.

## Escopo de alterações
Somente HTML e CSS de apresentação, navegação mobile, atualização de cache do script da marca e testes. **Não foram modificados** valores, login/cookies, funções Supabase, banco de dados, geração de PDF, dados de clientes, catálogo SIURB ou links previamente emitidos.

## Validação de homologação
- Rodar `npm test` e confirmar os testes estáticos e de integração, incluindo `tests/padronizacao-ui.test.mjs`.
- Conferir manualmente no Android as telas de início, serviços, orçamento, empresa, logo/cores e proposta por link de teste.
- Testar o formulário e o PDF em ambiente apropriado com dados fictícios.
- Confirmar que logotipo/cor foram carregados de configuração oficial e nenhuma imagem institucional genérica substituiu a marca quando não configurada.
- Verificar links de propostas já enviadas e contraste no celular.

## Correção de sobreposição de CSS — 19/10/2026

Antes, o navegador carregava até cinco folhas de estilos sequenciais na página inicial, misturando tokens de tema escuro e claro, regras antigas de cartões/painel e modificações de última camada. Isso provocava telas com fundos e cores diferentes.

**Arquitetura atual:** cada HTML entrega **uma única folha CSS compilada**:
- `index.html` → `assets/civolten-app-unificado.css`
- `servicos.html` → `assets/civolten-servicos-unificado.css`
- `proposta.html` → `assets/civolten-proposta-unificado.css`
- `privacidade.html` → `assets/civolten-privacidade-unificado.css`

O compilador `scripts/build-css.mjs` usa módulos estruturais existentes e consolida o resultado com **tokens compartilhados em `assets/temas/comum.css`** e **ajustes específicos em `assets/temas/{app,servicos,proposta,privacidade}.css`**. Os módulos antigos permanecem como fontes estruturais, mas **não são mais importados pelo navegador individualmente**.

Após alterar uma fonte CSS, rodar `npm run build:css` e depois `npm test`. O comando de testes executa `npm run check:css` para recusar qualquer bundle desatualizado. Não reinserir múltiplas referências `<link rel="stylesheet">` nos documentos.

O mesmo padrão de cores é aplicado à home, formulário, painel, serviços, proposta e privacidade: fundo branco ou cinza muito claro, azul-marinho institucional em cabeçalhos/detalhes, dourado de destaque. **Somente a fotografia do hero, faixas institucionais e rodapé usam fundo escuro intencionalmente.** Cores definidas em Logo e cores têm precedência por meio das variáveis CSS em tempo real. A regra de ocultação de elementos impede que login e painel sejam mostrados simultaneamente.
