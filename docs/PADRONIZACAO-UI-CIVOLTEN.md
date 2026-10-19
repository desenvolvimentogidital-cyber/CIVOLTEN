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
