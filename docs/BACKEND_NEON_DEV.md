# Backend PostgreSQL CIVOLTEN — desenvolvimento (29/10/2026)

## Estado real

- Banco exclusivo Neon: `civolten-orcamentos-dev`, banco `civolten`, região AWS São Paulo, plano gratuito.
- Migração `db/migrations/0001_init.sql` aplicada e validada: 15 tabelas, 23 FKs, 25 índices únicos.
- O banco está inicialmente vazio, sem administrador, clientes ou orçamentos.
- Variável `DATABASE_URL` configurada na Vercel como **encrypted**, para **production** e **preview**. O segredo não pertence ao repositório.
- Função independente em `api/index.mjs` com rotas sob `/api/v1/*`; ela **não substitui** o `public/demo-api.js` nem altera o aplicativo demonstrativo atual.
- O deploy da API precisa ser confirmado depois que a cota gratuita da Vercel permitir publicações novamente. O status `READY` de publicação antiga não é prova de acesso funcional à API nova.

## Endpoints homologáveis

| Método | Endpoint | Condição |
|---|---|---|
| GET | `/api/v1/health` | Verifica conexão; não expõe segredo |
| GET | `/api/v1/auth/status` | Consulta status da sessão |
| POST | `/api/v1/auth/bootstrap` | Criação única do administrador; exige `CIVOLTEN_BOOTSTRAP_SECRET` e banco sem usuários |
| POST | `/api/v1/auth/login` | Credenciais; cookie HttpOnly Secure SameSite=Strict, validade 8h |
| POST | `/api/v1/auth/logout` | Revoga sessão |
| GET | `/api/v1/me` | Requer sessão |
| GET / POST | `/api/v1/clients` | Requer sessão; gravação exige perfil administrador/orçamentista |
| GET / POST | `/api/v1/projects` | Requer sessão; gravação exige permissão |
| GET / POST | `/api/v1/budgets` | Requer sessão; gravação exige permissão |

Todas as gravações exigem `Content-Type: application/json` e cabeçalho `X-CIVOLTEN-Request: 1`, além da conferência da origem; jamais usar a chave do banco no JavaScript do navegador.

**Bootstrap ainda desativado:** nenhuma variável `CIVOLTEN_BOOTSTRAP_SECRET` foi criada. Não habilitar cadastro livre de administrador. O administrador e sua senha devem ser definidos pelo responsável, de forma segura, apenas após validar o backend.

A API é a primeira etapa de homologação e ainda **não inclui** a CRUD completa de itens, autorização granular para organizações, backup/restauração testados, geração PDF em servidor, precificação e BDI auditados ou cronograma definitivo. Não armazenar clientes reais.

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
