# CIVOLTEN — Backup operacional sem contratação de serviços

**Status:** fluxo preparado; **não ativado**. O backup automático ainda não opera até as configurações abaixo serem concluídas no GitHub.

O Neon gratuito permite uma janela limitada de recuperação instantânea e **não oferece agendamento automático de snapshots no plano Free**. A rotina GitHub Actions `.github/workflows/backup-civolten.yml` foi preparada como opção gratuita: diariamente às **05:17 UTC (02:17 de Brasília)** ela exportará um dump PostgreSQL 17 e enviará **somente o conteúdo criptografado** para o armazenamento de artefatos do GitHub, com retenção de 14 dias.

## Habilitação responsável (uma única vez)

1. Gere um par de chaves [age](https://age-encryption.org/) **em computador seguro**:
   ```bash
   age-keygen -o civolten-backup-private.agekey
   age-keygen -y civolten-backup-private.agekey
   ```
   A segunda linha informa a **chave pública**, que começa por `age1`. Guarde o arquivo privado, por exemplo, em cofre de senhas e em uma cópia física/externa protegida. Não envie o arquivo privado para ChatGPT, GitHub, Vercel ou outros repositórios.
2. No GitHub, entre em **CIVOLTEN → Settings → Secrets and variables → Actions → Secrets → New repository secret**. Adicione `CIVOLTEN_BACKUP_DATABASE_URL`, com URL de conexão **somente leitura** para o banco Neon `civolten` de desenvolvimento. Preferir role PostgreSQL dedicada com `CONNECT`, `USAGE` e `SELECT` nas tabelas necessárias, sem permissão de gravação.
3. Em **Variables**, adicione `CIVOLTEN_BACKUP_PUBLIC_KEY`, com o texto da chave pública age (`age1...`).
4. Em **Variables**, adicione `CIVOLTEN_BACKUP_ENABLED` com valor `true`. Até isso acontecer, os trabalhos agendados são pulados.
5. Execute uma vez **Actions → Backup criptografado CIVOLTEN → Run workflow** e confirme a existência do artefato `.dump.age` sem erro.

**Nunca coloque URL, senha ou chave privada em workflow, commit, comentário, issue ou mensagem de chat.** Utilize sempre Secrets/Variables do próprio GitHub. A configuração não deve ser ativada até a conta permitir a validação de permissões e armazenamento seguro.

## Restauração de teste antes de produção

- Faça download do artefato criptografado por uma conta autorizada.
- Descriptografe **somente em equipamento seguro**, com `age -d -i civolten-backup-private.agekey -o backup.dump civolten-XXXX.dump.age`.
- Crie um novo banco de **QA isolado**, nunca aponte a restauração ao banco atual de produção. Use clientes fictícios no exercício.
- Restaure com o cliente PostgreSQL 17: `pg_restore --no-owner --no-privileges --exit-on-error -d banco_de_qa backup.dump`.
- Confira contagem de clientes, obras, orçamentos, itens, usuários e logs, e abra os cadastros recuperados.
- Apague o dump descriptografado com procedimento apropriado ao armazenamento local e ao prazo de retenção.
- Documente data, tamanho, resultado e operador da restauração.

Não basta ver um arquivo no histórico: a etapa 1 só considera backup **homologado para uso real** após um exercício de restauração de um arquivo efetivamente criado pelo job agendado. Os testes de integração em PostgreSQL temporário já validam `pg_dump`/`pg_restore`, mas não provam que o agendamento e a chave privada estejam operacionais no Neon.

## Limitações dos recursos gratuitos

- Retenção de artefatos: 14 dias (arquivos antigos deixam de estar disponíveis).
- O workflow depende de cotas gratuitas de GitHub Actions e de conectividade com Neon. Um job pode falhar; monitorar semanalmente a última execução concluída.
- O dump só inclui a base PostgreSQL, não inclui uploads externos, documentos em object storage, configurações da Vercel ou arquivos do repositório.
- Para produção, avaliar políticas de retenção maiores e armazenamento redundante, mantendo os segredos isolados.

Referência técnica de preços e limites: https://neon.com/docs/introduction/plans e https://api-docs.neon.tech/reference/setsnapshotschedule

Este procedimento não configura serviços pagos nem habilita backups automaticamente.
