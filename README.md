# CIVOLTEN — Sistema interno de orçamentos e obras

## Auditoria obrigatória e fichas de composições — atualização 29/10/2026

**Esta versão ainda não está liberada para propostas reais na Vercel.**

A integração agora possui:

- **6.988 custos unitários** oficiais SIURB jul/2026 com e sem desoneração;
- **6.926 fichas de composição** oficiais, classificando insumos por profissional e demais materiais/equipamentos/auxiliares;
- opção **Ver insumos** na tabela de Composições SIURB, com consulta sob demanda ao arquivo `public/data/siurb-compositions-2026-07.json`;
- **62 custos sem ficha detalhada** nesses conjuntos, tratados como pendentes;
- horas-homem diretas extraídas das fichas e **não utilizadas como prazo automaticamente** sem revisão de equipamentos, atividades auxiliares e equipes;
- auditoria centralizada em `public/audit.js`: cliente/CPF/CNPJ, endereço da obra, escopo, quantidades, custos, h-h, prazo, BDI, validade, pagamento e dados da CIVOLTEN;
- bloqueio de emissão de propostas incompletas no servidor local e impedimento de emissão contratual no modo demonstrativo remoto; prévia interna continua visível;
- testes automáticos de integridade SIURB, cálculo, auditoria e API.

**Atenção**: o banco da Vercel ainda é localStorage no navegador, sem login e persistência central. A documentação para homologação está em `docs/CRITERIOS_DE_LIBERACAO_COMERCIAL.md`. A produção exige PostgreSQL, autenticação real, backup testado, BDI auditado, composições auxiliares recursivas e cronograma por equipes, além de PDF versionado em servidor.

Primeira versão executável local, com identidade visual da CIVOLTEN, para uso em computador e interface responsiva para celular.

**Situação:** base funcional de desenvolvimento (v0.1), **não certificada para envio de orçamentos reais sem validação técnica**. O sistema ainda não tem todos os recursos de uma plataforma de gestão de obras finalizada.

## O que já funciona

- Configuração do primeiro administrador (senha mínima de 10 caracteres) e autenticação por sessão.
- Dashboard, clientes, obras, orçamentos, edição de itens, composições, cronogramas, propostas, relatórios e configurações.
- Banco SQLite local persistente e API HTTP sem dependências npm externas.
- Temas **automático, claro e escuro**, salvos no navegador (automático segue `prefers-color-scheme`).
- Responsividade desktop/mobile e navegação inferior no celular.
- Logotipo e símbolo oficiais fornecidos, em PNG transparente, com versões otimizadas em `public/assets`.
- Cálculo de quantidades × custo unitário, BDI, horas-homem, prazo conservador por capacidade de equipe e margem de segurança.
- Cadastro de data-base e regime de desoneração, importação de CSV do catálogo de custos com histórico por referência.
- Propostas comerciais com identidade visual, escopo, valores, pagamento, prazo e garantia; histórico de snapshots. **Exportação PDF via “Imprimir → Salvar como PDF” do navegador.**
- Testes unitários e teste HTTP de ponta a ponta (sem provedores externos).

## Como abrir no Windows

1. Instale **Node.js 22.13+** (recomenda-se a versão LTS atual). Verifique no PowerShell: `node -v`.
2. Extraia o ZIP e abra o PowerShell dentro da pasta `civolten-sistema`.
3. Execute:

```powershell
node server.mjs
```

4. Acesse **http://127.0.0.1:3100** no navegador do computador.
5. No primeiro acesso, crie usuário e senha. Não existe credencial padrão pré-configurada.
6. Cadastre um cliente, uma obra, um orçamento e os itens do orçamento.

**Não precisa rodar `npm install`** nesta versão. Também pode usar `npm start` ou `npm test`.

O servidor local escuta apenas em `127.0.0.1` por padrão. Para testes em outros dispositivos da mesma rede, `HOST=0.0.0.0` torna a API acessível na rede, mas isso expõe o servidor sem HTTPS; não use com dados reais sem uma configuração de rede e segurança adequada. Em PowerShell: `$env:HOST='0.0.0.0'; node server.mjs`.

## Tema claro/escuro/automático

Abra Configurações → Aparência, ou clique no botão com ícone de sol/lua no topo. O padrão é **Automático**. O sistema acompanha o tema do dispositivo e guarda alterações manuais no `localStorage` do navegador.

## Catálogo SIURB oficial disponível na demonstração Vercel

O catálogo da data-base **julho/2026**, retificada em **01/10/2026**, foi integrado ao modo de demonstração com **6.988 serviços precificados** das planilhas oficiais: 2.630 de Edificações e 864 de Infraestrutura em cada regime (com e sem desoneração).

- Dados: `public/data/siurb-2026-07.json` (não ficam duplicados no localStorage).
- Fonte oficial: `https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179`.
- URLs exatas e SHA-256 dos quatro arquivos: `meta.origins` dentro do catálogo JSON.
- Geração auditável: `scripts/publish_siurb_2026.py`, validada no GitHub Actions por `.github/workflows/publish-siurb.yml`.
- Na Vercel, abra **Composições SIURB** e pesquise código, serviço, regime ou categoria.
- Em um orçamento, **Adicionar item** permite buscar pelo código/descrição e usa **apenas a data-base e regime definidos no orçamento**. Custo do serviço selecionado é copiado para o item do orçamento, preservando o preço no snapshot.
- **Não estão incluídos os coeficientes h-h/unidade** nessa fonte de custos unitários. Os campos permanecem sem produtividade validada, mesmo quando o serviço possui preço oficial. É necessária a leitura e conferência das planilhas oficiais de composições para calcular horas-homem e cronogramas de modo tecnicamente adequado.
- **A demonstração online não utiliza banco central nem login verdadeiro.** Não inserir dados reais de clientes ou gerar proposta comercial definitiva.

A versão **local (servidor SQLite)** não incorpora esses registros automaticamente e mantém o processo de importação manual por CSV. O catálogo público da Vercel e o servidor local são modos distintos nesta fase.

## Importar custos SIURB (tabelas oficiais de São Paulo)

Fonte: https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179

Em outubro de 2026, a data-base mais recente publicada é **julho de 2026**, com retificação de 01/10/2026. Existem arquivos distintos para infraestrutura/edificações, com e sem desoneração, e custos unitários/composições/insumos. O banco vem **sem valores oficiais carregados**: os serviços só passam a aparecer depois da sua importação e conferência.

No menu **Composições SIURB → Importar CSV**, selecione arquivo normalizado com:

```csv
codigo;descricao;unidade;custo;hh_un;categoria
```

Campos `codigo`, `descricao` e `custo` são obrigatórios; `unidade` e `hh_un` são recomendados. Use `,` decimal ou `.`. `hh_un` representa a soma de horas-homem de todas as funções da composição por unidade do serviço, **não a produção diária em unidades**. O modelo fornecido contém serviços fictícios marcados como `DEMO` e deve ser importado somente como **Tabela própria**. O sistema rejeita itens de demonstração rotulados como SIURB.

Para converter planilhas **XLS ou XLSX** (os arquivos oficiais podem estar no formato `.xls`), existe o utilitário `scripts/siurb_planilha_para_csv.py` (opcional, requer Python + `pip install xlrd openpyxl`). É necessário identificar as colunas e as abas da versão real. Exemplo ilustrativo:

```powershell
python scripts/siurb_planilha_para_csv.py custos.xls --sheet "Planilha1" --header-row 3 --code A --desc B --unit C --cost D --output siurb-normalizada.csv
```

**Não presuma que o exemplo de colunas corresponde ao formato da SIURB.** Confira o arquivo oficial. O importador CSV não decompõe automaticamente os arquivos de composições em insumos/coeficientes por profissão; essa integração detalhada está no plano de evolução.

## Regras de cálculo atualmente implementadas

- Custo direto: soma de `quantidade × custo unitário`.
- BDI (modelo simplificado): `custo direto × percentual de BDI`.
- Preço final: custo direto + BDI.
- Horas-homem: soma de `quantidade × coeficiente h-h/unidade`.
- Capacidade diária: trabalhadores × horas/dia × eficiência.
- Dias por serviço: arredondamento para cima de `(h-h do serviço / capacidade diária)`.
- Cronograma: sequência conservadora de atividades, com dias úteis seg-sex ou seg-sáb; ao final, somam-se os dias de margem de segurança.

**Esses cálculos são uma fundação, não um cronograma executivo de alta precisão.** Ainda faltam equipes específicas por especialidade, restrições de recursos, atividades simultâneas com dependências, caminho crítico calculado, custos indiretos/encargos/tributos por composição e BDI técnico por metodologia apropriada. Nunca trate dados do protótipo como composição SIURB verificada sem conferir a planilha original.

## PDF comercial

Após preencher o orçamento, vá a Propostas PDF → Exportar como PDF. Uma versão com os valores e descrição atuais é salva no banco e uma nova janela abre a impressão; selecione **Salvar como PDF**. Para personalizar razão social, CNPJ, contato e garantia, acesse Configurações primeiro. A função de envio automático por e-mail ainda não está conectada.

## Banco, backup e segurança

- Dados salvos em `data/civolten.sqlite` e arquivos transitórios `data/civolten.sqlite-wal` e `data/civolten.sqlite-shm` quando ativos.
- Para backup manual confiável, pare o servidor antes de copiar o arquivo SQLite completo. O botão “Exportar dados em JSON” é somente uma **exportação parcial de informações**, não substitui backup do SQLite.
- Não publique este servidor diretamente na internet. A configuração atual é para desenvolvimento local, sem HTTPS, recuperação de senha, proteção contra força bruta, auditoria completa e gestão de múltiplos usuários.
- A implementação usa `node:sqlite`, API ainda classificada como experimental em algumas versões do Node 22. Avalie migrar para driver de banco estável ou PostgreSQL antes da produção.

## Repositório no Bitbucket

Quando o repositório vazio estiver criado, envie estes arquivos:

```powershell
git init
git add .
git commit -m "feat: iniciar sistema de orçamentos CIVOLTEN"
git branch -M main
git remote add origin URL_DO_REPOSITORIO_BITBUCKET
git push -u origin main
```

O `.gitignore` exclui o banco local e a senha/sessão, para não subir dados de clientes. **Não inclua o arquivo `data/civolten.sqlite` no Git.**

## Estrutura

```text
public/index.html       Interface web
public/style.css        CSS responsivo e temas
public/app.js           Interface em JavaScript puro
public/assets/          Logos e modelo CSV
server.mjs              HTTP, autenticação, persistência e API
src/calc.mjs            Fórmulas de custo, horas e cronograma
tests/                  Testes automatizados
scripts/                Conversão opcional de XLS/XLSX para CSV
data/                   Banco local (ignorado pelo Git)
```

**Observação técnica:** o protótipo usa HTML, JavaScript e CSS modular próprio **sem dependências**, para ser executado imediatamente. Ainda não tem etapa de compilação do Tailwind CSS; a migração para Tailwind/componentização é uma evolução planejada, preservando o mesmo layout.

## GitHub e Vercel — demonstração online (v0.1)

Repositório oficial do projeto novo: https://github.com/desenvolvimentogidital-cyber/CIVOLTEN

Este repositório contém **dois modos de execução**:

1. **Local (Node.js 22.13+)**: `npm start` inicia `server.mjs`, com API, login e banco SQLite persistido na pasta `data/` do computador.
2. **Vercel (prévia estática)**: `vercel.json` publica `public/`. O arquivo `demo-api.js` habilita um modo de simulação **somente em domínios remotos**. A aplicação usa dados fictícios e salva alterações no `localStorage` do navegador; NÃO usa autenticação real, NÃO sincroniza entre dispositivos e NÃO possui banco central. Não utilizar dados de clientes reais nem propostas contratuais.

A separação é intencional: arquivos SQLite gravados no disco temporário de uma função serverless não fornecem persistência confiável. Para colocar a API real na Vercel é necessário migrar para PostgreSQL gerenciado com autenticação adequada, políticas de segurança e backups.

**Como publicar o protótipo na Vercel:** Add New → Project → importar `desenvolvimentogidital-cyber/CIVOLTEN` → preset `Other` → root directory `/` → Deploy. O arquivo `vercel.json` informa `outputDirectory: public`, sem comando de build. Se aparecer um formulário de criação de senha online, a configuração está errada: a prévia deve entrar automaticamente no painel com uma tarja amarela de demonstração. A tela local continua protegida por credenciais.

**Identidade visual:** as imagens otimizadas `public/assets/logo.png` e `public/assets/icone.png` são derivados dos PNGs fornecidos, não de imagens inventadas. Os originais em alta resolução estão no pacote de logos já compartilhado com o proprietário.

**Limitações conhecidas:** cronograma é sequencial, BDI simplificado, produtividade não certificada, custos unitários SIURB jul/2026 já publicados na demonstração mas composições/insumos e coeficientes de mão de obra ainda requerem integração e auditoria, PDF depende da impressão do navegador. São melhorias do produto futuro; a prévia não representa um orçamento técnico certificado.