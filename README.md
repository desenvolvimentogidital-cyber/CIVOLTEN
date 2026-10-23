# CIVOLTEN — Gestão interna por custos reais

Reconstrução independente do OrçaPro e sem nenhuma tabela pública de preços para formar orçamentos.

Sistema privado para cadastrar funcionários, profissões, diárias, encargos, custos fixos mensais, despesas variáveis, dias faturáveis da empresa e parâmetros editáveis de imposto e lucro.

## Cálculo
Custo total = mão de obra alocada + encargos cadastrados + despesas diretas + rateio de custos fixos.
Rateio = custos fixos mensais vezes dias previstos da obra dividido pelos dias faturáveis totais do mês.
Preço sugerido = custo total dividido por (1 - (impostos + margem desejada) / 100).
Impostos e lucro são porcentagens sobre o faturamento, não sobre o custo. Preço manual permite simulação e revela margem real ou prejuízo.

22 dias é padrão inicial ajustável, não norma obrigatória. Em trabalhos paralelos, registre a capacidade faturável mensal agregada corretamente para não duplicar custos. Nenhuma alíquota ou margem são presumidas: ambas começam em zero até você configurar. Valide o regime tributário com contador.

## Privacidade
Os custos nunca entram na proposta impressa ao cliente. Login reutiliza a autenticação CIVOLTEN com cookie seguro HttpOnly. As tabelas cv_ no Supabase protegem os dados privados de cada proprietário por RLS. Não há chave de serviço exposta.

## Segurança de migração
Existe uma referência histórica de código antes da refatoração (`backup-civolten-antes-refatoracao-20261020`). **Uma branch do GitHub não substitui backup do banco Supabase**. As tabelas novas de custos reais preservaram as tabelas antigas; a identidade visual oficial usa dois arquivos PNG locais, e as cores podem ser consultadas pelo serviço de branding. A verificação de sessão ocorre no Supabase Auth; a Edge Function legada só permanece como fonte opcional de identidade visual.

## Teste
Execute `npm run check`. O CI testa sintaxe, calculadora, formulário, proposta, login não autorizado, regras de acesso e operações da API. Essas verificações **não substituem** o teste com a conta real (login, edição, salvamento, PDF, recuperação de senha e permissões) no celular. Alterações devem ser propostas por PR, com CI verde antes de integrar a branch `main`.

Cada funcionário também registra os dias previstos no mês (22 como padrão editável), com estimativa mensal da diária e encargos. O valor da folha deve ser conferido para não contar a mesma mão de obra em custos fixos e no orçamento da obra.

## Autenticação e isolamento por conta (base para SaaS)

O CIVOLTEN usa autenticação Supabase, cookie `HttpOnly; Secure; SameSite=Strict` e valida o JWT da sessão diretamente em `/auth/v1/user`. Não existe mais solicitação nem aprovação administrativa. Cada conta acessa somente seus próprios dados: a tabela guarda `owner_id`, e as políticas RLS de `SELECT/INSERT/UPDATE/DELETE` exigem `owner_id=auth.uid()`. A API utiliza exclusivamente o JWT da conta autenticada, nunca uma chave `service_role`.

**Cadastro:** se o Supabase tiver `Confirm email` desligado, a API de cadastro obtém uma sessão válida e faz login imediatamente. Se estiver ligado (opção recomendada para um SaaS aberto), o usuário confirma o endereço e entra sem aprovação humana. O retorno pelo link de confirmação pode ser convertido em sessão HttpOnly após verificação do token pelo próprio Supabase; a pessoa pode também fazer login normalmente. A configuração `Confirm email` é de responsabilidade do projeto Supabase Auth e não pode ser modificada pela aplicação.

**Privacidade multiusuário:** trabalhadores, custos, caixa, orçamentos e parâmetros têm RLS por proprietário. O catálogo global de profissões contém **somente nomes públicos das atividades**, sem preços ou diárias; funções personalizadas pertencem à respectiva conta. Vincular caixa a uma obra de outro proprietário é bloqueado no banco.

**Recuperação de senha:** Configurações → Minha conta → Receber link para alterar senha. Valide Site URL e Redirect URLs do Supabase Auth para `https://civolten.vercel.app/` e configure a entrega de e-mail antes da abertura a usuários externos.

### Publicação
A aplicação atual usa HTML/JavaScript modular e funções Vercel; não é Next.js/React nem depende de Tailwind. A identidade azul-escuro/dourado e o modo escuro foram preservados. `main` faz um único deploy de produção (previews desabilitados), sempre após os testes do CI.

## Proposta comercial em PDF (layout corporativo)
No editor de orçamento, escolha **Gerar PDF / imprimir proposta**. No diálogo de impressão do celular ou computador, selecione **Salvar como PDF** para gerar o arquivo A4 para enviar pelo WhatsApp ou e-mail.

O novo documento inclui a marca CIVOLTEN, identificação do projeto e cliente, data e referência quando o orçamento está salvo, prazo, descrição do escopo, condições informadas pelo administrador, investimento total e campos para aceite. A folha é sempre clara, independentemente do tema da interface. O PDF é formado no navegador; não adiciona arquivos externos nem envia o orçamento a serviços de terceiros.

**Privacidade:** o gerador recebe somente título, cliente, endereço, escopo, prazo, observações e o **preço final** já calculado. Os dados de funcionários, custos, encargos, alíquotas, margens, despesas, formação de preço e resultados nunca são interpolados na proposta comercial. Verifique se os campos de escopo e observações não contêm informações internas antes do envio.

**Observação:** a referência `CV-XXXXXXXX` só é exibida depois de salvar o orçamento, quando já existe um identificador real. Antes de salvar, o documento indica `Prévia sem número`. O documento não inventa CNPJ, contatos, condições de pagamento ou prazo de validade que não tenham sido fornecidos.

## Memorial descritivo e quantitativos da proposta
No editor do orçamento, preencha **Memorial descritivo / quantitativos** com cada serviço (ex.: execução de parede), unidade (m², m, m³, un, ponto ou serviço) e quantidade. Use **+ Adicionar serviço** e **Remover** para editar a lista. Ela fica salva dentro do conteúdo do orçamento e vai para o PDF do cliente, em tabela com as três colunas, sem preço por item. O preço global permanece calculado por funcionários, despesas e demais custos reais internos, que não são expostos. O campo textual **Serviços que serão executados** continua disponível para explicações adicionais e para orçamentos antigos.

Valide as medições e condições de execução com o responsável pela obra. As quantidades são informadas manualmente, não medidas pelo sistema; o cadastro descritivo não altera automaticamente a formação do preço.

## Identidade visual no cabeçalho do PDF
O PDF comercial exibe **o ícone PNG e a arte PNG horizontal do nome CIVOLTEN lado a lado**, sem fundo branco, com a marca textual duplicada removida do cabeçalho.

As duas imagens PNG enviadas pelo usuário foram adicionadas ao projeto: `assets/civolten-logo.png` (ícone oficial, substitui a identidade anterior nas telas e no PDF) e `assets/civolten-proposal-header.png` (arte horizontal de nome). A arte já é carregada em `index.html`; o PDF a incorpora após o carregamento, ao lado da nova logo, sem precisar modificar os cálculos ou os dados da proposta.

A arte nova está instalada. A área horizontal tem recorte visual para compensar a margem transparente do arquivo, sem modificar os pixels originais. A marca textual no rodapé permanece para identificação comercial.

## Auditoria de integridade (21/10/2026)

- **Cálculos e preços:** entrada negativa, não numérica, fora dos limites ou sem precisão suficiente deve gerar erro — nunca custo reduzido silenciosamente. Os testes automatizados conferem custo real, encargos, despesas, impostos, rateio, preço manual e lucro/prejuízo.
- **Listagem:** funcionários, custos e orçamentos são lidos de forma paginada, em lotes de 250, com ordenação estável. A operação não oculta registros antigos silenciosamente. Há limite operacional defensivo de 2.000 registros por tabela; acima disso, será necessário implementar paginação visual com carregamento incremental.
- **Persistência:** atualizar ou excluir ID inexistente/sem permissão retorna erro, evitando mensagem enganosa de sucesso.
- **API:** corpos JSON são limitados por bytes durante o streaming, inclusive sem `Content-Length`. Endpoints financeiros exigem sessão válida e Supabase aplica RLS por proprietário.
- **Configuração financeira:** na auditoria, a tabela de configurações ainda não tinha um registro. O painel avisa quando impostos, margem e capacidade faturável não foram salvos ou quando margem/impostos estão em zero. **Configure esses valores reais antes de confiar em um preço comercial**.
- **Limitações de homologação:** ainda é necessário testar no aparelho real uma sessão autenticada, recuperação de senha, impressão e restauração de backup do banco. O aviso de proteção contra senhas vazadas do Supabase Auth deve ser revisado nas configurações de autenticação. Os avisos de RLS sem política referem-se a tabelas antigas bloqueadas intencionalmente.
- **Dados:** a auditoria usa consultas de leitura no banco; não apaga nem modifica cadastros existentes e não inclui nenhuma tabela de referência na formação de preços.

## Catálogo pesquisável de profissões

Em **Funcionários → Cadastrar funcionários → Profissão / função**, toque no campo para abrir a lista de profissões. O catálogo inicial contém **90 funções** de construção civil, elétrica, instalações, acabamento e apoio; digite parte do nome para pesquisar, inclusive sem acento. Escolha uma opção ou informe uma profissão diferente. Depois de salvar um funcionário com uma profissão nova, essa função é armazenada na tabela `cv_professions`, privada da sua conta, e fica disponível em futuros cadastros. A lista também contempla as funções já registradas antes da atualização.

Em **Orçamentos → Mão de obra por diária**, pesquise um funcionário já cadastrado pelo nome ou pela profissão e selecione-o para adicionar à obra. Clicar no seletor sem filtro mostra toda a equipe ativa.

O catálogo contém **somente nomes de profissões**; não altera valores de diárias, custos, encargos ou fórmulas, e não contém nenhuma referência de preços SINAPI/CUB/SIURB. O Supabase aplica RLS para impedir que contas sem login leiam ou adicionem profissões; as opções gerais são compartilhadas, enquanto as personalizadas pertencem ao respectivo administrador.

## Custos fixos, materiais opcionais e indicador de capacidade

**Custos fixos:** todas as despesas marcadas como ativas entram na base mensal de manutenção da CIVOLTEN, mesmo sem obra em andamento. Uma despesa ativa de **R$ 0** não altera a base. Custos como aluguel devem ficar em zero quando a empresa ainda não os paga. **Nunca confunda as estimativas iniciais da lista com custos reais.**

**Indicadores:** o painel e a página de custos fixos exibem o total mensal, custo por dia faturável e custo por hora faturável. Fórmulas:

- Custo por dia = total mensal das despesas fixas ativas ÷ dias-equipe faturáveis por mês.
- Custo por hora = custo por dia ÷ horas de trabalho por dia.
- A jornada em horas/dia é editável em **Configurações financeiras** (inicialmente 8 h), assim como a capacidade em dias-equipe (inicialmente 22). Esses padrões são apenas exemplos, não confirmação de sua jornada.

**Por obra:** o sistema copia o custo fixo mensal ativo para o novo orçamento e considera apenas o rateio proporcional aos dias da obra, além dos profissionais alocados diretamente. A tabela de **Custos variáveis** é um catálogo de materiais e serviços: nada é incorporado ao orçamento sem selecionar/adicionar o item. Se o cliente fornecer os materiais, não os inclua. Se a CIVOLTEN fornecer, acrescente apenas quantidades e custos que efetivamente assumirá.

**Tributos e margem:** impostos e margem alvo são calculados sobre o preço de venda, não apenas somados como porcentagens do custo. Para preservar a margem configurada, o preço sugerido divide o total dos custos por `1 - (alíquota de imposto + margem) / 100`. O sistema mostra os impostos estimados e o resultado final na análise interna.

**Evite dupla contagem:** trabalhadores pagos por diária já entram como mão de obra da obra. Salários fixos de administração podem integrar custos fixos; se um mesmo trabalhador estiver lançado no custo fixo mensal e também como diária na obra, a remuneração poderá ser contada duas vezes. Reveja esses lançamentos antes de precificar. Propostas salvas preservam um retrato dos parâmetros originais: alterações nos custos fixos não alteram automaticamente documentos antigos.

## Folha mensal de funcionários e barra de totais

Em **Funcionários**, cada profissional tem diária, dias trabalhados no mês (22 como ponto inicial ajustável), encargos e uma **Forma de custo**.

- **Fixo mensal** (padrão dos cadastrados): projeção mensal = diária multiplicada pelos dias previstos e acrescida dos encargos. A projeção dos trabalhadores ativos entra automaticamente na base fixa mensal e é mostrada na barra inferior, sempre visível enquanto a lista rola.
- **Por obra**: não entra na folha mensal; pode ser adicionado como mão de obra extra no orçamento, apenas quando contratado para aquela obra.

O dashboard e a aba de custos fixos mostram despesas da empresa separadas da folha, e o **total combinado por mês, dia e hora**. Novos orçamentos copiam automaticamente a base fixa mensal, que é rateada pelos dias previstos da obra. O trabalhador mensal não precisa ser incluído novamente em cada orçamento e não aparece no seletor de mão de obra extra. Orçamentos antigos preservam o próprio retrato dos custos registrados.

**Evite dupla contagem:** se uma remuneração registrada na folha mensal também estiver lançada como salário administrativo nos custos fixos, ajuste um desses lançamentos. Profissionais pagos apenas quando há serviço devem ter forma de custo **Por obra**.

## Visão geral financeira — custos, lucro, obras e caixa

A Visão geral agora tem indicadores do custo mensal da estrutura (despesas fixas + folha), custo por dia/hora, quantidade de obras aprovadas e **venda, custos, impostos e lucro previstos das obras aprovadas**. A projeção de lucro não representa recebimento de dinheiro.

**Resultado por obra:** pesquise por título/cliente e filtre por rascunho, enviado, aprovado ou recusado. Cada obra exibe os valores históricos de custo, preço de venda, impostos estimados (alíquota registrada naquela proposta) e lucro/margem resultantes. A tela mantém os botões de abrir proposta e não reescreve o orçamento antigo.

**Gráficos:** dois gráficos dos últimos seis meses. O primeiro compara venda/custo previstos das propostas atualmente aprovadas, agrupadas pela data de criação. O segundo mostra entradas/saídas **registradas efetivamente no livro de caixa** por data do movimento. Não há integração bancária nem reconhecimento automático de receitas.

**Caixa da empresa:** registre manualmente cada entrada efetivamente recebida e cada despesa paga, com data, categoria, descrição e vínculo opcional a uma obra. Lançamentos são protegidos por login, RLS e propriedade de cada usuário. Podem ser excluídos mediante confirmação; para corrigir valores, exclua e lance novamente. O saldo exibido é apenas entradas menos saídas **registradas desde o início** — não representa saldo bancário inicial, contas a pagar nem o lucro contábil.

**Margem e impostos:** formulário rápido na Visão geral ajusta as configurações financeiras utilizadas em **novas** propostas; exige percentuais válidos cuja soma seja inferior a 100. Propostas já salvas preservam os valores originais para evitar revisões silenciosas.

**Limites financeiros:** valores de orçamentos são estimativas e custos fixos são rateados pelo prazo da obra, não saídas de caixa automaticamente pagas. A saúde financeira só pode ser avaliada de forma completa quando os pagamentos e recebimentos reais, obrigações, tributos e extratos forem conciliados. Não contabilize uma proposta aprovada como recebimento sem lançar o pagamento.

## Orçamento simples: equipe selecionável e configuração centralizada

O orçamento agora funciona em **quatro passos**: dados da obra, profissionais, serviços/quantitativos e materiais/despesas opcionais. Na etapa de profissionais, a busca e a lista exibem **todos os funcionários ativos**, agrupados como **Equipe fixa mensal** e **Profissionais por obra**. Basta selecionar e adicionar. Um mesmo profissional não pode ser incluído duas vezes na mesma obra.

- **Funcionário fixo mensal**: seu salário já faz parte da folha registrada em Custos fixos e rateada no preço da obra. Pode ser selecionado para indicar quem executará o serviço, **sem acrescentar uma segunda diária**. Na lista aparece *Já considerado*.
- **Profissional contratado por obra**: sua diária, dias da obra e encargos informados no cadastro são utilizados como custo adicional, sem entrar no rateio mensal.
- **Dia(s) na obra** continua editável por profissional; **dias faturáveis mensais, horas/dia, impostos e margem** ficam exclusivamente em **Configurações financeiras**, onde também há o resumo de despesas fixas e folha e atalhos para editar custos/encargos individuais.
- **Serviços e quantidades** entram no PDF; **materiais** só são cobrados quando selecionados. O preço sugerido é automático; a opção de preço manual permanece recolhida em detalhes para casos especiais.
- **Orçamentos anteriores** conservam suas informações e parâmetros históricos. Nunca recalcular valores antigos apenas por ter alterado configuração, funcionário ou despesas da empresa. Ao abrir uma proposta existente, seus dados continuam disponíveis.

Essa divisão evita duplicidade entre folha fixa e mão de obra por obra e preserva o cálculo de impostos sobre preço de venda. O painel não utiliza tabelas externas de preços.

## Ditado por voz em campos de texto

Os campos de **texto livre** do sistema (nome, função, categoria, descrição da obra, itens e quantitativos descritivos, observações, buscas e lançamentos de caixa) mostram um ícone de **microfone** ao lado direito. Toque no microfone, autorize o acesso quando o navegador solicitar e fale em **português do Brasil**. O texto reconhecido é inserido no campo e passa pelo mesmo evento `input` dos campos digitados: pesquisas e resumos são atualizados automaticamente. Toque novamente para parar. A gravação não é salva pelo CIVOLTEN.

A transcrição **não substitui o texto anterior**: o trecho novo é inserido na posição do cursor, preservando o resto. Pode corrigir ou completar a frase com o teclado normalmente. Ao falar em um campo com limite de caracteres, o texto respeita o limite do próprio campo.

**Privacidade:** o CIVOLTEN não armazena áudio, não envia gravações a suas próprias APIs e não utiliza serviços pagos de voz. O reconhecimento depende da API de voz oferecida pelo navegador: alguns navegadores **podem enviar o áudio ao provedor externo de reconhecimento**. Use somente quando concordar com essa operação e **revise o texto reconhecido antes de salvar ou emitir o PDF**, especialmente nomes, números, endereços e termos técnicos.

**Compatibilidade:** o ditado depende do navegador, HTTPS, internet quando exigida pelo provedor e autorização do microfone. Pode não estar disponível em navegadores embutidos, versões antigas ou configurações restritivas. Se o navegador não expuser a API, o botão orienta usar o **microfone do teclado do celular**. Os campos continuam funcionando normalmente pelo teclado. Por segurança, não há ditado em senhas, e-mails, telefones, números, datas ou valores financeiros.

### Correção de repetições no ditado

O reconhecimento de voz pode enviar a mesma frase várias vezes — por exemplo, um resultado parcial **“Kleber”** seguido do resultado ampliado **“Kleber Nunes”**. O CIVOLTEN agora verifica a sobreposição de palavras e frases entre os segmentos antes de preencher o campo. Assim, trechos já reconhecidos não são acrescentados novamente. A verificação também remove repetições consecutivas idênticas dentro de um único segmento, sem apagar o texto que estava no campo antes de iniciar o ditado.

A gravação continua sem armazenamento no CIVOLTEN, e o reconhecimento ainda depende do navegador. Sempre confira nomes próprios e palavras técnicas antes de salvar.

## Desconto e proposta comercial

No fechamento do orçamento, o usuário simula descontos percentuais. O sistema exibe valor de referência, desconto, preço global ao cliente, impostos sobre a venda, lucro líquido estimado e margem final, além da margem original. O desconto é salvo no orçamento e integra o preço do PDF quando confirmado. O PDF comercial usa o gerador existente de folha A4, mantendo apenas dados comerciais (cliente, serviços, quantitativos descritivos, prazo, condições e investimento total), sem salários, custos, impostos ou margem.

## Indicadores por situação

A Visão geral separa **propostas enviadas em aberto**, **obras aprovadas/fechadas** e **rascunhos ainda em preparação**, sem confundir previsão de venda com dinheiro efetivamente recebido. O livro de caixa reflete somente os pagamentos e recebimentos lançados.

## Contratos de prestação de serviços

A aba **Contratos** permite criar, editar, salvar, acompanhar e imprimir contratos em folha A4 (opção do navegador **Salvar como PDF**). O sistema aceita dois cenários: **a CIVOLTEN como prestadora** e **a CIVOLTEN como contratante** de outra empresa ou profissional.

**Configurações → Dados para contratos**: informe uma única vez o nome/razão social legal da sua empresa, CPF/CNPJ, endereço, representante e contatos. Novos contratos fazem uma cópia desses dados. Alterar o perfil depois **não modifica contratos já salvos**.

**Contrato novo:** informe o tipo de contratação, outra parte (nome e CPF/CNPJ), descrição dos serviços, local, datas de início e término, valor global e condições de pagamento. O sistema preenche cláusulas sugeridas sobre materiais, obrigações, alterações, encerramento e garantias. Abra **Revisão das cláusulas** para editar o texto ou incluir condições particulares e foro; esses valores são **editáveis**, não conclusões automáticas sobre a lei.

**Contrato a partir de orçamento:** gera minuta com nome da obra, cliente, endereço, escopo/quantidades e preço final salvos naquele orçamento. **Não importa equipe, custos, impostos, lucro ou margens**. Complete as informações restantes antes de emitir ou imprimir.

**Estados:** rascunho, emitido, assinado (marcação manual) e cancelado. Marcar como assinado **não significa** aplicar assinatura eletrônica. Para emitir ou marcar como assinado, a API exige os dados essenciais completos. Contratos incompletos podem ser guardados como rascunho.

**Isolamento:** cada contrato e perfil tem `owner_id`, controlado por quatro políticas RLS por usuário autenticado. Um contrato vinculado a orçamento só pode referenciar um orçamento do mesmo usuário. Nenhum dado de outra conta deve ser consultável, editável ou impresso.

**Revisão jurídica:** trata-se de minuta genérica de prestação de serviços. O texto deve ser revisado para o serviço concreto, natureza da contratação, normas aplicáveis, responsáveis técnicos, tributação, materiais, garantia, rescisão e forma de assinatura. O sistema não substitui advogado, contador ou responsáveis habilitados.

## Melhorias de segurança contratual (23/10/2026)

- **Antes do primeiro contrato:** em Configurações → Dados para contratos, cadastre o nome legal e um CPF/CNPJ válido. O validador aceita CNPJ numérico e CNPJ alfanumérico vigente a partir de 2026.
- **Salvar e emitir:** crie e salve como **rascunho**. Preencha identificação das partes, escopo, local, datas, valor, condições de pagamento e um cronograma de parcelas/vencimentos ou de medições. Depois mude a situação para **emitido** e salve.
- **Versões preservadas:** o conteúdo de contrato emitido não pode ser reescrito nem excluído. Pode passar a assinado (registro manual) ou cancelado. Para mudar escopo, cláusulas ou valor, use **Criar nova revisão** e justifique-a; o documento anterior permanece.
- **Modelo:** cláusulas editáveis de materiais, obrigações, alterações, suspensão, atraso, aceite, garantias, encerramento, responsabilidade técnica (ART/RRT quando aplicável) e dados pessoais. Confirme os termos para o caso concreto; o sistema não determina automaticamente obrigações legais.
- **PDF:** botão **Gerar contrato / salvar em PDF**, impressão A4 no próprio navegador, paginação compatível com navegadores que suportam caixas de margem e áreas para assinaturas das partes e testemunhas.
- **Assinatura:** o status assinado é um marcador interno; **não executa assinatura eletrônica, não coleta assinaturas e não valida a autenticidade de assinaturas em arquivos externos**. Guarde as vias assinadas por meio apropriado.
- **Proteção adicional no banco:** a migração `20261023184500_cv_contracts_lifecycle_guard.sql` cria um trigger que impede alterações e exclusões indevidas depois da emissão, inclusive por escrita direta no banco. Aplicar na produção antes de usar o bloqueio de versões.

**Testes de homologação manual:** após fazer login, salvar perfil, criar rascunho, emitir, gerar PDF no Chrome/Android e em desktop, conferir que quebra de páginas e assinaturas ficaram corretas e que o documento emitido só oferece atualização de situação ou criação de revisão. Nunca use dados reais de clientes nos testes de visualização públicos.
