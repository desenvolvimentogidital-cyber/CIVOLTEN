# CIVOLTEN — Orçamento Digital (Repositório independente)

**Este repositório pertence exclusivamente à CIVOLTEN; não contém código, dados ou dependências do OrçaPro.**

## Estado atual

- A tela de teste **`index.html`** é uma aplicação estática responsiva para celular, sem build. Ela chama a API que já foi implantada no Supabase próprio da CIVOLTEN.
- Backend ativo: `https://rvhnuowqfdugcecgmxnv.supabase.co/functions/v1/civolten-beta` (Edge Function).
- PostgreSQL exclusivo da CIVOLTEN no Supabase, região São Paulo. Catálogo com 15 serviços e três padrões.
- A versão Next.js completa continua disponível no pacote de origem, mas **nem todos os seus arquivos foram sincronizados aqui**. No GitHub foram enviados o site estático, API Supabase, matriz, motor de cálculo, migrações e configurações. Não tente implantar `app-nextjs/` antes de completar a sincronização e os testes. Não colocar as chaves do OrçaPro.
- Ambiente **BETA** para testes. Não divulgar publicamente até concluir testes de upload, login, permissões, antispam, LGPD e retenção dos arquivos.

## Publicação rápida em Vercel (ambiente de teste, não comercial)

> A conexão Vercel via ChatGPT retornou 403 ao criar o projeto; não há implantação confirmada. Importar manualmente este repositório na Vercel pode contornar a limitação da integração se sua conta tiver permissão.

1. O repositório `desenvolvimentogidital-cyber/CIVOLTEN` já existe e contém a tela e a API de testes. Está **público**; para torná-lo privado, acesse Settings → General → Danger Zone → Change repository visibility.
2. Na Vercel, use `Add New > Project` e selecione **somente** `desenvolvimentogidital-cyber/CIVOLTEN`.
3. Framework: `Other` (site HTML estático); Root Directory: `/` (raiz); build command: nenhum.
4. Abra o endereço temporário e valide pelo celular os fluxos básicos, gravação de áudio, upload e login.
5. Para operação comercial da CIVOLTEN, use hospedagem/plano que permita uso comercial. Plano Vercel Hobby é para uso pessoal não comercial.

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