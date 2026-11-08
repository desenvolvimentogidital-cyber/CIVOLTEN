# CIVOLTEN — CI/CD gratuito via GitHub Actions + Vercel CLI

Este projeto utiliza o fluxo:

1. Pull request / push em `main` → GitHub Actions executa `.github/workflows/ui.yml`.
2. Somente quando o **push em `main`** termina com CI **success**, o GitHub inicia `.github/workflows/deploy-vercel.yml`.
3. O workflow verifica se `main` ainda está no mesmo commit testado. Versões ultrapassadas são ignoradas.
4. A Action executa `vercel pull`, `vercel build --prod` e `vercel deploy --prebuilt --prod`.
5. A implantação usa a Vercel Hobby, sem contratação de recursos pagos.

**Importante sobre limites:** deploy via GitHub Actions/Vercel CLI **também consome a quota de deploys da Vercel**. O plano Hobby tem limite de 100 implantações em 24 horas; o limite de 2.000 implantações por semana via CLI é adicional, não substitui a quota diária. Se atingir o limite, aguarde a renovação gratuita. Não mude o plano.

## Configuração inicial necessária (uma única vez por repositório)

O projeto Vercel e seu identificador de equipe já estão configurados no workflow:
- `VERCEL_PROJECT_ID`: `prj_rD5nuIakujmss9n36L6sc199URTq`
- `VERCEL_ORG_ID`: `team_5riNeVAJVfakHxuvcW1pGMXM`

Esses identificadores **não são senhas**. Falta somente garantir a presença do segredo `VERCEL_TOKEN` no repositório GitHub.

1. Abra https://vercel.com/account/tokens e crie um token de acesso com escopo à equipe dona do projeto CIVOLTEN, com prazo de validade apropriado.
2. Abra https://github.com/desenvolvimentogidital-cyber/CIVOLTEN/settings/secrets/actions
3. Clique em **New repository secret**.
4. Nome: `VERCEL_TOKEN`. Valor: token recém-gerado. Salve no GitHub.
5. **Nunca envie o token ao chat, nunca faça commit do token e nunca publique `.vercel/.env*`.**

Assim que o segredo existir, um próximo commit aprovado na `main` será publicado automaticamente. Se já houver uma execução de CD falha por ausência do segredo, abra a execução no GitHub Actions e use **Re-run failed jobs** após adicionar o segredo.

## Cuidados

- A Action só tem acesso de leitura ao código. Segredos não são fornecidos ao CI dos pull requests.
- O token é passado apenas para as etapas de configuração, construção e implantação.
- A Action possui `concurrency` de produção e impede publicação de commit antigo.
- Não utiliza a API de implantação do conector ChatGPT.
- A Vercel pode ainda tentar publicar commits automaticamente pela **Git Integration**. Após o primeiro CD por Actions ser confirmado, avaliar desativar deploys duplicados pelo Git Integration nas configurações Vercel, sem desconectar o projeto nem bloquear a versão atual.
- O plano gratuito do GitHub Actions tem suas próprias regras; o projeto atual é público.

## Padrão para outros projetos

Para outros repositórios, replicar o workflow com o **nome exato do respectivo CI**, seu `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID` e um segredo `VERCEL_TOKEN` no repositório correspondente. Não copiar IDs da CIVOLTEN para outros projetos. Não ativar automaticamente para outros repositórios sem revisar suas configurações.
