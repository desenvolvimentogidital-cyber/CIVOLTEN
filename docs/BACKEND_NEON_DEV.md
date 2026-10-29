# Backend PostgreSQL CIVOLTEN — desenvolvimento (29/10/2026)

## Estado real

- Banco exclusivo Neon: `civolten-orcamentos-dev`, banco `civolten`, região AWS São Paulo, plano gratuito.
- Migrações `0001_init.sql`, `0002_bootstrap_lock.sql`, `0003_soft_delete.sql`, `0004_unique_active_position.sql` aplicadas e validadas: 16 tabelas, controle único de bootstrap e exclusão lógica de itens.
- A branch **main original** permanece sem administrador, clientes ou orçamentos. A branch de QA restaurada tem 1 cliente, 1 obra, 1 orçamento e 1 item fictícios, isolados.
- Snapshot manual de desenvolvimento foi criado e a restauração da estrutura foi verificada. A restauração inicialmente promoveu a cópia; a configuração foi corrigida, `main` voltou à branch original e `DATABASE_URL` da Vercel foi reconferida apontando para esse banco. Não executar novamente restauração sem `target_branch_id` explícito e prévia sem finalização.
- Variável `DATABASE_URL` configurada na Vercel como **encrypted**, para **production** e **preview**. O segredo não pertence ao repositório.
- Função independente em `api/index.mjs` com rotas sob `/api/v1/*`; interface privada em `public/secure.html`, `public/secure.js` e `public/secure.css`. A aplicação demonstrativa pública não foi substituída.
- Bloqueio confirmado: a Vercel respondeu `402 api-deployments-free-per-day` (mais de 100 deploys em 24h). Os últimos commits ainda não estão publicados; **não há homologação online** da interface privada/API. Não elevar o plano pago automaticamente.

## Endpoints homologáveis

| Método | Endpoint | Condição |
|---|---|---|
| GET | `/api/v1/health` | Verifica conexão; não expõe segredo |
| GET | `/api/v1/auth/status` | Consulta status da sessão |
| POST | `/api/v1/auth/bootstrap` | Criação única do administrador; exige `CIVOLTEN_BOOTSTRAP_SECRET` e banco sem usuários |
| POST | `/api/v1/auth/login` | Credenciais; cookie HttpOnly Secure SameSite=Strict, validade 8h |
| POST | `/api/v1/auth/logout` | Revoga sessão |
| POST | `/api/v1/auth/change-password` | Exige sessão, senha atual e revoga outras sessões |
| GET | `/api/v1/me` | Requer sessão |
| GET / POST / PUT / DELETE | `/api/v1/clients` | Requer sessão; arquivamento lógico e edição autorizada |
| GET / POST / PUT / DELETE | `/api/v1/projects` | Requer sessão; arquivamento lógico e edição autorizada |
| GET / POST / PUT / DELETE | `/api/v1/budgets` | Requer sessão; rascunho editável com versão otimista, cancelamento lógico |
| POST / PUT / DELETE | `/api/v1/budgets/:id/items` | Serviços: inclusão, revisão e remoção lógica; somente rascunhos |

Todas as gravações exigem `Content-Type: application/json` e cabeçalho `X-CIVOLTEN-Request: 1`, além da conferência da origem; jamais usar a chave do banco no JavaScript do navegador.

**Bootstrap ainda desativado:** nenhuma variável `CIVOLTEN_BOOTSTRAP_SECRET` foi criada. Não habilitar cadastro livre de administrador. O administrador e sua senha devem ser definidos pelo responsável, de forma segura, apenas após validar o backend.

A API ainda **não inclui** emissão contratual aprovada, todas as rotinas com transações atômicas, autenticação multiusuário completa, backup recorrente, PDF conectado à sessão, engenharia de custos auditada e cronograma executivo. Há bibliotecas e testes puros em `src/estimate-engine.mjs`, `src/schedule-engine.mjs` e `src/proposal-pdf.mjs`, mas ainda não formam um fluxo homologado na produção. Não armazenar clientes reais.

## Segurança operacional (importante)

- **NÃO há `CIVOLTEN_BOOTSTRAP_SECRET` configurado**: criação do primeiro administrador permanece bloqueada até o deploy da API atual e a definição de credenciais de forma segura pelo responsável.
- A branch de QA restaurada existe apenas para validação; não é destino do sistema. Antes de qualquer migração, conferir via Neon a branch default `main` original, ID e conexão `DATABASE_URL` da Vercel.
- O plano gratuito permite apenas snapshot manual limitado; backup recorrente externo e restauração com dados de teste completos ainda não foram homologados.

## Validação obrigatória antes de ativar a interface

1. Confirmar pelo deploy correto que `GET /api/v1/health` responde 200 sem divulgar segredos.
2. Confirmar que `GET /api/v1/clients` sem cookie retorna 401 e POST sem cabeçalho anti-CSRF retorna 403.
3. Criar o primeiro administrador com segredo separado e senha forte; confirmar login e logout.
4. Cadastrar apenas cliente fictício, criar obra e orçamento, relogar e consultar do computador e celular.
5. Verificar controle de perfis e limite de tentativas; garantir sem mensagens de SQL ao usuário.
6. Testar backup/restore numa ramificação separada.
7. Somente após auditoria completa, substituir o front-end demonstrativo pela API persistente.

## Precauções

- Não publicar `DATABASE_URL` em commits, logs, documentação, screenshots ou artefatos.
- Não reutilizar qualquer banco de outro projeto.
- Não considerar planilhas SIURB como preços comerciais garantidos.
- Não permitir propostas reais até cumprir `docs/CRITERIOS_DE_LIBERACAO_COMERCIAL.md`.
