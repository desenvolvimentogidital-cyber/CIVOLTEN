# CIVOLTEN — Orçamento Digital (Repositório independente)

**Este repositório pertence exclusivamente à CIVOLTEN; não contém código, dados ou dependências do OrçaPro.**

## Estado atual e publicação

- Site responsivo e painel: \`https://civolten.vercel.app\` (Vercel, projeto \`civolten\`).
- API administrativa: sessão segura em cookie HttpOnly, com autorização validada no Supabase.
- Backend: Supabase próprio \`rvhnuowqfdugcecgmxnv\`, Edge Function \`civolten-beta\`.
- Gerador PDF: \`api/quote-pdf.mjs\`, A4 com dados dinâmicos e identidade configurável.
- Melhorias comerciais: editor de serviços e preços, condições, aceitação via link temporário, histórico, painel e exportação de dados.
- O diretório \`app-nextjs/\` é um protótipo independente; não o publique sem sincronizar e testar.
- **Cuidado com dados reais:** revise disponibilidade, regras LGPD, rotina de backups e permissões de produção antes da divulgação pública.
- **Uso comercial na Vercel:** confirme que o plano da conta permite sua operação comercial; o plano Hobby possui limitações para uso comercial.

### Passos de publicação

1. Executar migração aditiva \`supabase/migrations/20261016_professional_quote_suite.sql\` no Supabase da CIVOLTEN (uma vez).
2. Publicar \`index.ts\`, \`site.ts\` e \`quote-extra.ts\` da Edge Function \`civolten-beta\`, mantendo \`verify_jwt=false\` porque a função faz sua própria checagem de acesso.
3. Executar \`npm test\` no GitHub Actions, revisar amostra de PDF e mesclar a atualização aprovada para a branch \`main\`.
4. Conferir deploy READY na Vercel com o SHA correto e validar pelo celular um pedido sem dados reais.
5. Testar token inválido, aceite/rejeição, alteração após aprovação, exportação de backup e upload de logo.

Detalhes e limitações: [Plano profissional](docs/PLANO-PROFISSIONAL.md).

### Banco de dados

O banco CIVOLTEN e a API Edge já existem no Supabase. **Não execute novamente as migrações deste pacote automaticamente**: elas são versões de referência, e o banco real já recebeu migrações equivalentes, atualizadas. Na transição do modo estático para Next.js, reconciliar as migrações antes de qualquer nova execução.

### Primeiro administrador

A função da CIVOLTEN contém fluxo de criação do primeiro administrador por código único, com validade limitada. O HTML `index.html` tem o campo **Código de ativação**. Não registrar senhas nem convites de acesso no GitHub; o convite deve ser enviado fora do repositório.

### Segurança

- Nenhuma `service_role` key nem token administrativo faz parte do repositório.
- A chave `sb_publishable_...` usada pela tela de teste é pública por design; as regras de acesso devem continuar restritas no backend.
- Uploads são armazenados em bucket privado, com URLs temporárias e verificação administrativa.
- O cálculo de orçamento é executado no servidor. Simulação não é orçamento definitivo nem garantia de lucro.

## Desenvolvimento do sistema Next.js completo

```bash
cd app-nextjs
npm ci # quando houver package-lock.json gerado
npm run test
npm run lint:syntax
```

O Next.js completo tem suas próprias variáveis listadas em `app-nextjs/.env.example`. Elas não são necessárias para hospedar a página estática da raiz. Para publicar a app Next.js completa, é preciso validar build e configurar variáveis próprias da CIVOLTEN em ambiente protegido.

*Atualizado em 2026-10-16.*
## Telas e navegação do site

O projeto utiliza rotas públicas separadas, com os mesmos recursos e regras de negócio:

- `/` — página inicial e apresentação dos serviços.
- `/servicos` — vitrine completa de serviços oferecidos.
- `/orcamento` — formulário de solicitação, anexos e simulação.
- `/empresa` — login e painel de gestão, protegido por sessão e autorização.
- `/empresa?secao=visao`, `pedidos`, `orcamentos`, `precos`, `siurb`, `logo`, `textos`, `backup` — seções internas; apenas usuários autorizados acessam dados.

A pré-seleção de categoria e quantidade na página inicial é encaminhada via parâmetros para `/orcamento`. O CSS de cada tela apenas controla qual interface aparece; a API, a validação, o cadastro e os PDFs não são duplicados. A identidade visual continua vindo de **Área da empresa → Logo e cores**.
