## Situação verificada da etapa 1 — 29/10/2026

**Código e serviços online:** a publicação Vercel do commit `ae45e57e` está `READY` e atende ao painel seguro em `/secure.html`. Verificação externa de 10 rotas/arquivos concluída no [GitHub Actions 40938872838](https://github.com/desenvolvimentogidital-cyber/CIVOLTEN/actions/runs/40938872838): Neon/health e auth/status 200, rotas privadas sem sessão 401, proteção de requisições 403, bootstrap público bloqueado e arquivos do painel acessíveis.

**Segurança e integridade:** PostgreSQL de desenvolvimento com migrações 0001–0006 aplicadas; primeiro administrador exige troca de senha; chaves de integridade cliente/obra/orçamento e auditoria atômica; o ambiente principal permanece sem clientes ou orçamentos. [CI 40939093170](https://github.com/desenvolvimentogidital-cyber/CIVOLTEN/actions/runs/40939093170): 48 testes automatizados, integração de autenticação/cadastros/permissões e restauração real de banco descartável, inclusive backup **criptografado age** de registros existentes.

**Ainda não liberado para clientes reais:** não foi comprovado login e troca de senha pelo responsável no site nem sincronização via dois dispositivos. A rotina diária de backup criptografado está criada no GitHub Actions, mas **ainda não está ativa** por falta de configuração protegida de `CIVOLTEN_BACKUP_DATABASE_URL`, `CIVOLTEN_BACKUP_PUBLIC_KEY` e `CIVOLTEN_BACKUP_ENABLED` pelo proprietário. Um teste com chave efêmera no CI não substitui um backup real agendado e restaurado. Consulte [BACKUP_OPERACIONAL.md](BACKUP_OPERACIONAL.md). Nenhum plano pago foi contratado.

# Backend PostgreSQL CIVOLTEN — desenvolvimento (29/10/2026)

## Estado real

- Banco exclusivo Neon: `civolten-orcamentos-dev`, banco `civolten`, região AWS São Paulo, plano gratuito.
- Migrações 0001–0006 aplicadas, incluindo controle de bootstrap, exclusão lógica de itens, troca de senha inicial obrigatória e chave composta de integridade cliente/obra/orçamento.
- A branch **main original** tem uma conta administrativa de desenvolvimento e permanece sem clientes ou orçamentos. A branch de QA restaurada tem 1 cliente, 1 obra, 1 orçamento e 1 item fictícios, isolados.
- Snapshot manual de desenvolvimento foi criado e a restauração da estrutura foi verificada. A restauração inicialmente promoveu a cópia; a configuração foi corrigida, `main` voltou à branch original e `DATABASE_URL` da Vercel foi reconferida apontando para esse banco. Não executar novamente restauração sem `target_branch_id` explícito e prévia sem finalização.
- Variável `DATABASE_URL` configurada na Vercel como **encrypted**, para **production** e **preview**. O segredo não pertence ao repositório.
- Função independente em `api/index.mjs` com rotas sob `/api/v1/*`; interface privada em `public/secure.html`, `public/secure.js` e `public/secure.css`. A aplicação demonstrativa pública não foi substituída.
- O limite diário anterior da Vercel foi superado: o deploy de aplicação `ae45e57e` ficou `READY` e os testes remotos de API e arquivos passaram. Alterações posteriores em scripts/CI podem não integrar o deploy, sem afetar o runtime testado.

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

- **Administrador inicial criado:** login `admin` e senha temporária entregue diretamente ao responsável. A trava `app_bootstrap_lock` impede nova inicialização. A senha deve ser alterada imediatamente no primeiro acesso; o segredo de bootstrap público permanece desabilitado.
- A branch de QA restaurada existe apenas para validação; não é destino do sistema. Antes de qualquer migração, conferir via Neon a branch default `main` original, ID e conexão `DATABASE_URL` da Vercel.
- O plano gratuito permite apenas snapshot manual limitado; backup recorrente externo e restauração com dados de teste completos ainda não foram homologados.

## Validação obrigatória antes de ativar a interface

1. [CONCLUÍDO] Confirmado por GitHub Actions que `GET /api/v1/health` responde 200 sem divulgar segredos.
2. [CONCLUÍDO] Confirmado que `GET /api/v1/clients` sem cookie retorna 401 e POST sem cabeçalho anti-CSRF retorna 403.
3. [PARCIAL] Administrador criado na base exclusiva; confirmar login, troca de senha e logout reais.
4. Cadastrar apenas cliente fictício, criar obra e orçamento, relogar e consultar do computador e celular.
5. Verificar controle de perfis e limite de tentativas; garantir sem mensagens de SQL ao usuário.
6. Testar backup/restore numa ramificação separada.
7. Somente após auditoria completa, substituir o front-end demonstrativo pela API persistente.

## Precauções

- Não publicar `DATABASE_URL` em commits, logs, documentação, screenshots ou artefatos.
- Não reutilizar qualquer banco de outro projeto.
- Não considerar planilhas SIURB como preços comerciais garantidos.
- Não permitir propostas reais até cumprir `docs/CRITERIOS_DE_LIBERACAO_COMERCIAL.md`.
