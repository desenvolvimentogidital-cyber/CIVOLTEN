# CIVOLTEN — Orçamentos Premium • SIURB São Paulo
PWA mobile-first da CIVOLTEN, sem login nesta fase.

## Serviços SIURB
Aba **Mais → Serviços**. A tabela oficial de custos de Edificações (EDIF) e Infraestrutura Urbana (INFRA), data-base **julho de 2026**, é consultada no site da Prefeitura de São Paulo: https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179.

Ao abrir a aba pela primeira vez, a interface tenta importar automaticamente os arquivos oficiais pela API `/api/siurb` (somente leitura, URLs fixas). Também é possível atualizar clicando **Carregar tabela oficial**, ou baixar os arquivos XLS no portal e usar o importador de Excel. Os arquivos são da versão onerada (sem desoneração) por padrão; a desonerada pode ser escolhida no seletor.

A pesquisa oferece filtros de elétrica, civil e todos, com código, descrição, unidade e custo unitário. O botão **+ Meu catálogo** copia o serviço selecionado à biblioteca do usuário para utilização em orçamento; não altera serviços ou orçamentos já salvos.

**Atenção:** o custo de referência SIURB é composto e pode incluir mão de obra, materiais e equipamentos. Ele entra como *custo global* e **não é preço final de venda nem apenas mão de obra**. Ajuste a composição conforme fornecimento do cliente, margem e tributos. Não duplique BDI com despesas indiretas da CIVOLTEN. Os valores históricos de propostas permanecem congelados.

## Modalidades de orçamento e separação SIURB

A modalidade inicial de qualquer **novo orçamento** é **Somente mão de obra**. Os outros modos **Completo** (materiais e mão de obra pela empresa) e **Misto** (fornecimento escolhido por item) continuam disponíveis na primeira etapa.

O campo **Custo unitário SIURB** é apenas uma referência **global**, não uma parcela de mão de obra. Para adicionar um serviço SIURB a um orçamento:

1. Na aba **Mais → Serviços**, escolha um item SIURB e use **+ Meu catálogo**.
2. Em **Novo orçamento → Itens**, selecione esse serviço.
3. Preencha separadamente **Mão de obra**, **Materiais** e **Equipamentos/outros**, consultando a composição oficial; não há rateio percentual automático fictício.
4. Marque **Conferi a divisão**. Opcionalmente salve a composição conferida para os próximos orçamentos.
5. Em modo **Mão de obra**, material do cliente fica fora da cobrança. Em **Completo**, material da empresa é incluído. Em **Misto**, selecione o fornecedor por item.

A aplicação impede salvar novos itens SIURB sem conferência dos valores e bloqueia o avanço de propostas em edição cujos itens SIURB ainda não tenham sido separados.

**IMPORTANTE:** nesta etapa a separação é **manual e validada pelo usuário**, não importação automática de todos os componentes de planilhas. A Prefeitura publica **Composições de Custos** específicas de Edificações/Infraestrutura. Os arquivos oficiais devem ser consultados antes de usar custos reais e podem conter componentes auxiliares. O aplicativo não presume valores que não identificou com segurança. Orçamentos existentes e seus valores salvos não são reescritos automaticamente.


## Orçamento rápido e custos reais (novembro/2026)

Fluxo **Novo orçamento → Itens**:
- Descrição é também a **busca por código ou texto**, trazendo a biblioteca SIURB já importada e serviços próprios. Selecionar preenche unidade, descrição e, se houver composição **previamente conferida**, custo separado de mão de obra, materiais e equipamentos.
- Serviços SIURB que possuem **somente custo global** continuam exigindo conferência da composição. **Não calculamos valor de mão de obra por rateio arbitrário nem cobramos o total público como mão de obra.**
- Material cadastrado é opcional; o módulo **Mais → Materiais** permite carregar/importar a tabela pública de **Insumos SIURB** (referência de preços, em cache local IndexedDB) e copiar materiais para seu catálogo.
- Profissionais cadastrados podem ser escolhidos em cada item. No cadastro em **Mais → Profissionais**, use **Empregado CLT** para informar salário mensal, FGTS, INSS patronal, outros encargos, benefícios, provisão de 13º e 1/3 de férias e horas **produtivas** mensais. A seleção do profissional com suas horas por unidade permite preencher o custo da mão de obra (não deve somar de novo o custo de composição SIURB).
- A tabela pública de **Mão de Obra Mensalista/Horista SIURB** pode ser importada como referência. Ela **não substitui o salário real nem o enquadramento sindical/tributário** e não é usada automaticamente como salário CLT.
- Cadastre almoço, transporte, pedágio, combustível, hospedagem, locação etc. em **Mais → Despesas**. Em **Novo orçamento → Itens → Despesas da obra**, escolha as despesas efetivamente aplicáveis e informe quantidades, pessoas e dias; elas são acrescentadas ao custo do orçamento apenas uma vez.
- Revisão do orçamento separa custo de execução, despesas, percentuais e preço final, com margem configurável. Mode padrão: **Somente mão de obra**; **Completo** e **Misto** continuam ativos.

### Atenção para empregador MEI
Como referência geral do MEI com empregado: 3% de contribuição previdenciária patronal e 8% de FGTS, além de 13º, férias acrescidas de 1/3 e benefícios/CCT. A simulação mensal NÃO é folha de pagamento nem cálculo trabalhista completo (não determina periculosidade/insalubridade, piso, CCT, rescisão ou todos os custos possíveis). Configurar conforme contador/convenção: https://www.gov.br/esocial/pt-br/microempreendedor-individual/manual-web-mei.

Exemplo apenas ilustrativo: salário-base de R$ 2.800; INSS patronal 3%, FGTS 8%, 13º 1/12 e adicional de férias (1/3)/12, sem benefícios ou outros encargos → **R$ 3.453,33/mês**; com 160 horas produtivas, **R$ 21,58/h**. Com vale-transporte, alimentação, adicionais, CCT e reservas o custo muda.

### Limites desta entrega
Os arquivos oficiais "Insumos" e "Mão de Obra" são disponibilizados via proxy Vercel **somente para download e leitura** quando o portal estiver acessível. A importação está preparada, mas **os layouts exatos de todas as planilhas complementares ainda não foram validados com arquivos reais**; pode ser necessário ajustar os extratores. A tabela de **Composições de Custos** oficial ainda não é decomposta automaticamente por serviço em mão de obra/material/equipamento. Para isso é necessário importar e validar as composições completas.
Dados comerciais continuam no armazenamento local do navegador sem login/servidor sincronizado. Faça backups e não dependa exclusivamente desta versão para operação crítica.


## Automatização de orçamento — etapa novembro/2026

**Novos modelos de produtividade:** Em **Mais → Serviços → Novo/Editar**, cadastre até três funções/profissionais da equipe padrão, as horas de cada um para executar UMA unidade do serviço e a quantidade de profissionais. É possível escolher um material padrão e a quantidade por unidade. O aplicativo calcula o custo real da equipe com os salários, encargos e horas produtivas registrados em **Profissionais**. Dados existentes são mantidos.

**Ao escolher o serviço:** A pesquisa procura na SIURB importada e na biblioteca CIVOLTEN; a unidade e os custos conferidos são preenchidos. Para serviços com equipe padrão cadastrada, mão de obra é calculada automaticamente, e o item salva uma fotografia das horas, taxas e profissionais usados. Mudanças posteriores no catálogo não devem reescrever automaticamente os orçamentos antigos.

**Regra de referência:** o custo efetivo dos profissionais e insumos cadastrados é a base do **custo real**. Se a parcela de mão de obra/material da SIURB estiver **separada e conferida** e for mais alta, ela eleva a base do **preço sugerido** somente quando o escopo corresponder ao da proposta. Isso não aumenta artificialmente o custo real nem mascara o lucro. Não há comparação do custo global SIURB com um orçamento de apenas mão de obra.

**Produção e despesas:** A etapa Itens mostra horas-homem e jornadas equivalentes de 8h quando há produtividade cadastrada. Embaixo, despesas já cadastradas podem ser lançadas com um toque, usando inicialmente 1 unidade/pessoa/dia e permitindo editar as quantidades. Não são incluídas invisivelmente e não entram duas vezes no orçamento.

**O que continua manual:** cliente, quantitativos da obra, endereço, seleção de despesas reais, horas de produtividade ainda não conferidas, condições locais, benefícios e enquadramento de empregados, valores finais de fornecedores, aprovação da composição e conferência da proposta. Importação/validação da **planilha detalhada de Composições de Custos SIURB** ainda é necessária antes de permitir produtividade oficial preenchida automaticamente em TODOS os códigos.

**Testes deste ciclo:** validação de sintaxe JS, cálculo de equipe CLT/terceirizada, exibição de campos de produtividade, cálculo de piso de preços em diferentes regimes de fornecimento e criação do build na Vercel. Testes completos num aparelho real, importação de toda a planilha oficial e persistência em banco ainda pendentes.

## Custos fixos, pró-labore e modelo de despesas por obra — Novembro/2026

O app passa a **pré-cadastrar uma única vez**, sem sobrescrever os registros da CIVOLTEN, os custos abaixo como **VALORES FICTÍCIOS EDITÁVEIS** de planejamento. São referências e hipóteses, **não orçamentos de fornecedores**.

### Fixos mensais fictícios
- Meta de pró-labore/retirada do titular: **R$ 10.000,00/mês** (não é salário CLT nem lançamento tributário automático).
- DAS MEI serviços (2026): **R$ 86,05/mês** (oficial para atividade apenas de serviços; confirmar regime real).
- Contabilidade: R$ 250; celular: R$ 100; internet: R$ 130; software: R$ 95.
- EPIs/uniformes: R$ 200; ferramentas/manutenção: R$ 280; seguro operacional (reserva): R$ 180.
- Veículo (seguro/IPVA/manutenção fixa): R$ 400; escritório/administrativo: R$ 300; água/luz: R$ 140.
- **Total inicial: R$ 12.161,05/mês**, se nenhum custo anterior foi substituído por um valor próprio.
- Capacidade inicial de rateio: **160 horas produtivas faturáveis/mês da empresa**, configurável. Base: aproximadamente **R$ 76,01 por hora**.

Não criar salários fictícios na equipe real, pois empregados e terceirizados existentes já são lançados nos serviços pela sua taxa de custo. O pró-labore como **meta mensal de retirada** é rateado como planejamento de custo de gestão. **Não cobrar novamente o próprio trabalho via profissional "Próprio"**, ou haverá dupla contagem.

### Variáveis de obra fictícias
Cadastradas como modelos editáveis: almoço R$ 32/refeição, deslocamento R$ 1,10/km, água/lanche R$ 8/pessoa/dia, estacionamento R$ 22/dia, pedágio R$ 18/passagem, frete R$ 150/viagem, locação de equipamento R$ 95/dia, hospedagem R$ 180/noite e descarte R$ 140/viagem.

**Almoço e deslocamento** são pré-incluídos em **NOVOS orçamentos**, com quantidade inicial de 1 refeição por pessoa/dia e deslocamento de 20 km por dia, ajustáveis com o botão de edição. Se houver equipe e produtividade cadastradas, dias/pessoas sugeridos são recalculados (não são prazos contratuais). Despesas opcionais só entram se selecionadas.

Despesas mensais não devem aparecer também como despesas avulsas; alimentação e transporte já pagos como benefício CLT não devem ser lançados novamente sem justificativa.

### Como editar
- **Mais → Despesas:** editar pró-labore, despesas mensais, despesas variáveis e configurações de aplicação automática.
- **Mais → Despesas → Horas produtivas faturáveis:** editar capacidade mensal de trabalho da empresa.
- **Novo orçamento → Itens:** revisar almoço, quilometragem e outras despesas. Nenhuma suposição de dias/quilômetros é uma medição real.
- **Novo orçamento → Revisão:** visualizar rateio fixo, informar horas manualmente se não houver produtividade e usar **Atualizar custos mensais desta proposta** para buscar os valores atualizados.

### Cálculo e preservação
Novas propostas usam o modelo **fixed_hourly_v1**:
- Custos diretos = mão de obra real da equipe + material fornecido pela empresa + equipamentos.
- Rateio fixo = (total mensal de despesas e meta de retirada / horas faturáveis mensais) × horas de execução previstas (horas-homem), ou horas de rateio editadas para aquela obra.
- Despesas variáveis da obra = quantidade × pessoas × dias × custo unitário, apenas uma vez.
- Reserva/imprevistos configurável e margens/tributos existentes continuam atuando.
- O percentual genérico de custos indiretos **não** é aplicado novamente ao usar o rateio fixo.
- Sem horas confiáveis, o app pede horas de rateio antes de emitir proposta que não seja rascunho.
- Rascunhos antigos e orçamentos emitidos **não são migrados automaticamente**; cada novo orçamento guarda fotografia dos valores mensais e capacidade no momento da criação.

**Atenção ao MEI:** a meta de retirada de R$ 10 mil/mês é uma meta pessoal/financeira e pode não ser compatível com o faturamento e custos reais enquanto a empresa permanecer no MEI. Não significa pró-labore juridicamente obrigatório. Referência Receita Federal, Solução de Consulta Cosit 251/2024: https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=140333 . Limite anual e regime devem ser acompanhados com contador.

### Referências e hipóteses de 2026
- DAS MEI 2026 de serviços: https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/servicos-para-mei/perguntas-frequentes .
- Gasolina SP em torno de R$ 6,36/l no fim de outubro de 2026: https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas .
- Deslocamento a R$ 1,10/km é **premissa de orçamento**, que combina estimativa de combustível, manutenção e desgaste, e não tarifa oficial.
- Todos os demais custos são estimativas fictícias ilustrativas a substituir pelos seus valores comprovados.

## Equipe planejada, encargos e cronograma — novembro/2026

### Cinco postos de exemplo (NÃO admitidos)
O app cria uma única vez cinco perfis de **planejamento**, preservando funcionários reais cadastrados:
- 1 eletricista: salário-base ilustrativo R$ 3.500/mês;
- 2 pedreiros: R$ 3.200/mês cada;
- 2 ajudantes: R$ 2.200/mês cada.

Esses salários **não foram extraídos da SIURB**, nem confirmados com CCT ou piso sindical. São valores editáveis de simulação. A tabela **Mão de Obra Mensalista/Horista SIURB julho/2026** pode ser importada e pesquisada por profissão em **Mais → Profissionais**; seus custos de referência podem incluir encargos e **não são automaticamente tratados como salário-base**, nem criam vínculos empregatícios. O botão **Criar cargo modelo** exige informar o salário-base antes de usá-lo.

### Cenário de encargos
**Mais → Profissionais** permite um cenário **MEI** (3% CPP e 8% FGTS como parâmetros usuais), **Simples Nacional Anexo IV** (simulação de 20% CPP, 2% RAT e 8% FGTS), demais anexos ou personalizado. O cenário de cinco empregados é **SOMENTE simulação** e não altera `db.company.taxRegime` nem a condição jurídica efetiva. **MEI só pode ter um empregado** (com as condições legais aplicáveis). Construção civil no Anexo IV pode ter CPP fora do DAS. O correto depende de CNAE, obra, risco, convenção coletiva, RAT/FAP, benefícios e contador.

O módulo simula salário-base + provisão de 13º (1/12) + 1/3 de férias (1/36) + encargos parametrizados sobre essa base + benefícios mensais e reservas cadastradas. Não substitui folha/eSocial nem apura automaticamente periculosidade, insalubridade, piso/CCT, rescisões, adicionais, encargos de todas as situações, afastamentos ou impostos de faturamento.

**Custo/hora** = custo mensal estimado ÷ horas produtivas/mês cadastradas. Alterar salário ou percentuais no perfil recalcula automaticamente as taxas para **novos orçamentos**; cotações anteriores preservam sua fotografia de custos e não são reprecificadas sem edição.

### Cronograma por produtividade
Acesse **Mais → Cronograma e equipe** ou **Novo orçamento → Itens → Abrir cronograma**.
- Prazo editável (ex.: 10, 15, 20, 45 dias úteis); data inicial e jornada produtiva/remunerada por dia.
- Usa quantidade do serviço × coeficientes de horas por unidade × profissionais da equipe padrão.
- Dimensiona a equipe necessária **por função**, independentemente de quantas pessoas estão marcadas como ativas no banco. Exibe necessidade, postos planejados e empregados ativos.
- Modo sequencial ou frentes paralelas, com calendário de segunda a sexta, sem feriados. O escalonamento conservador evita sobreposição de uma mesma função entre frentes; exibe datas e barras por serviço.
- Requer produtividade por serviço conferida. Se faltar, mostra alerta: não inventa horas ou duração.
- **Equipe exclusiva durante a obra**: opção que acrescenta apenas o custo de disponibilidade acima do custo de mão de obra já lançado, com base no maior entre dias previstos e dias calculados, sem cobrar a mesma hora duas vezes. A revisão exibe o complemento.
- As despesas padrão de alimentação e deslocamento levam em conta pessoas e dias do cronograma quando há dedicação exclusiva. Devem ser revisadas (quantidade, local, benefícios já existentes, condições de acesso).
- Não inclui automaticamente feriados, chuvas, dependências de suprimento, licenças, restrições de acesso, paralisações, absenteísmo, múltiplas frentes parcialmente compartilhadas ou programação CPM/PERT. Cronograma ainda é **estimativa técnica** e exige verificação da execução real.

### Fontes primárias
- <https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179>
- <https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/servicos-para-mei/contratacao-de-empregado>
- <https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cobrancas-e-intimacoes/contribuicao-previdenciaria-anexo-iv-do-simples-nacional>
- <https://www.gov.br/esocial/pt-br/microempreendedor-individual/manual-web-mei>

**Dados e segurança:** nada é sincronizado ainda; localStorage/IndexedDB do navegador e importação oficial dependente de conexão. Faça backup JSON frequentemente e valide os valores em um orçamento real antes de utilizá-lo como proposta definitiva.

## Consulta separada de mão de obra SIURB (julho/2026)

Tabelas oficiais: [Mão de Obra Mensalista](https://prefeitura.sp.gov.br/documents/d/obras/onerada-sem-des-mobra-mensalista-julho-2026-1-xlsx) e [Mão de Obra Horista](https://prefeitura.sp.gov.br/documents/d/obras/onerada-sem-des-mobra-horista-julho-2026-1-xlsx).

O importador agora distingue **valor sem encargos** e **valor com encargos** quando as colunas estão explicitamente identificadas e os valores têm consistência. Também respeita cabeçalhos de **custo horário** mesmo quando a tabela se chama "mensalista". Mostra os valores lado a lado na consulta de **Profissionais**. O custo SIURB não é automaticamente salário-base CLT; a configuração do salário precisa de conversão de unidade/carga horária, conferência do piso da categoria, regime tributário e validação do Excel oficial.

**Limitação importante:** Não foi possível abrir e validar a planilha Excel da SIURB julho de 2026 neste ambiente. O importador passou em testes com exemplos estruturais, mas os salários dos cinco postos planejados continuam **fictícios**, até conferência de todas as linhas e unidades de origem. Não divulgar valores como "salários oficiais SIURB" antes disso. Não sobrescrever os salários/custos reais já cadastrados e não somar encargos duas vezes. Preferir conferir a planilha XLSX original no sistema e, se necessário, enviá-la ao projeto para mapear as colunas precisamente.

## Custo completo do empregado nos orçamentos e cronogramas (novembro/2026)

**Regra adotada:** o valor usado como mão de obra no custo da CIVOLTEN é o **custo completo estimado do empregador**, não o salário bruto e tampouco o salário líquido recebido pelo trabalhador. Os três módulos — cadastro do profissional, composição de serviços/orçamento e cronograma — usam a função única de `payroll-cost.js`.

Cálculo mensal configurável: remuneração bruta = salário-base + adicional de periculosidade *quando devida* ou de insalubridade *quando devida* + adicionais salariais fixos. Provisão adicional de 13º = remuneração/12. Férias já remuneradas pelo salário mensal; provisiona-se o **terço constitucional adicional** = remuneração/36. Sobre a base adotada, calcula-se FGTS patronal e encargos previdenciários configurados (CPP e RAT/FAP, além de outras contribuições se aplicáveis). Soma benefícios mensais (alimentação, transporte, outros), reservas gerenciais de rescisão e substituição/ausências se informadas, e outras reservas. Custo unitário/hora = total estimado / horas produtivas mensais.

**Importante:** este é um **simulador de custo de empresa**, não cálculo legal completo e definitivo da folha: o desconto de INSS do funcionário é retenção sobre a remuneração, **não acréscimo independente ao custo da empresa**. Benefícios previstos em convenção coletiva, seguro, eSocial, RAT/FAP efetivo, adicionais condicionais, piso salarial, afastamentos, férias durante a execução, aviso prévio e indenizações de rescisão precisam ser validados individualmente. Reservas opcionais não são percentuais legais obrigatórios. Salário-base e adicionais permanecem editáveis por funcionário.

Periculosidade **não é ativada automaticamente** pela palavra "eletricista"; o adicional típico de 30% demanda condições e enquadramento legal e técnico. Insalubridade também exige enquadramento e cálculo conforme o caso, e não é somada simultaneamente à periculosidade como padrão.

**SIURB:** importar o custo com encargos e sem encargos separadamente quando o Excel apresenta colunas claramente identificadas; custo **com encargos** de referência da SIURB não recebe encargos novamente ao ser utilizado em cadastro do tipo "Referência SIURB". Custo horário SIURB não vira salário-base CLT por multiplicação implícita. A planilha oficial de julho/2026 ainda precisa ser inspecionada antes de utilizar seus valores como salários reais.

Exemplo de comparação simulada para salário-base R$ 3.000 (160h produtivas):
- MEI, 3% CPP + 8% FGTS: **R$ 3.700,00/mês (R$ 23,13/h)**;
- Simples Nacional Anexo IV, 20% CPP + 2% RAT + 8% FGTS: **R$ 4.333,33/mês (R$ 27,08/h)**;
- Com periculosidade de 30% quando devida, no segundo cenário: **R$ 5.633,33/mês (R$ 35,21/h)**.

Os exemplos **não incluem benefícios**, cobertura de férias por substitutos nem valores de CCT. Estes devem ser cadastrados para aproximar o custo real.

**Fontes oficiais para revisão**:
- Direitos do empregado: https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/servicos-para-mei/contratacao-de-empregado
- Encargos MEI eSocial: https://www.gov.br/esocial/pt-br/microempreendedor-individual/manual-web-mei
- Contribuições fora do DAS no Anexo IV: https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cobrancas-e-intimacoes/contribuicao-previdenciaria-anexo-iv-do-simples-nacional
- Exposição a periculosidade NR-16: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/perguntas-frequentes

## Proposta comercial com equipe, horas e prazo (2026-11-05)

Depois de criar um orçamento e adicionar os serviços, a etapa **Itens** mostra automaticamente a equipe sugerida por função, carga total em horas-homem e previsão em dias úteis, **desde que o serviço tenha produtividade cadastrada**. Use **Abrir cronograma e ajustar equipe** para editar o prazo desejado, quantidade de profissionais, dia inicial e horas produtivas por pessoa/dia. Para confirmar, é necessário que todos os itens tenham coeficientes confiáveis e que o cronograma calculado caiba no prazo escolhido.

Quando o cronograma estiver conferido e salvo, a proposta comercial (**Visualizar proposta → Imprimir/Salvar PDF**) passa a exibir:
- Equipe necessária por função (quantidades de pedreiros, ajudantes, eletricistas etc., não nomes de empregados);
- Horas-homem estimadas, datas e prazo estimado em dias úteis;
- Quantidade, unidade, equipe e duração prevista de cada serviço;
- Preço de venda **global** da proposta e a distribuição comercial por serviço, utilizando o motor de precificação existente.

**Nunca mostrar** salário de cada funcionário, custo/hora da folha, FGTS, tributos internos ou margem da CIVOLTEN na proposta do cliente. O resumo comercial fica **congelado no orçamento salvo** para evitar alteração retroativa quando salários ou produtividade mudarem. Ao reeditar o orçamento e confirmar um novo cronograma, uma nova versão do resumo pode ser gerada.

Para serviços sem produtividade confiável e cronograma ainda não confirmado, a proposta **não publica estimativas inventadas de equipe e prazo**: mantém o campo contratual de prazo `A combinar` ou o que o usuário informou. Só utilizar a produtividade SIURB quando seus coeficientes tiverem sido efetivamente extraídos e conferidos na biblioteca de serviços.

Obs.: alvenaria de vedação costuma ser medida em **m²**, não metros lineares; a unidade é extraída do cadastro do serviço. Para 300 m², a estimativa depende dos coeficientes da composição, do tipo de bloco, altura, acesso, espessura, perdas e organização da equipe. O sistema não presume uma produtividade única para todos os tipos de alvenaria.

## Publicação na Vercel
Importe a branch main, **Framework Other**, root `./` e sem build. A Vercel publica o HTML/CSS/JS e a função Node `api/siurb.js`. O serviço upstream pode ficar indisponível; o upload manual continua possível.

## Proteção dos dados
Ainda **sem banco de dados ou login**. Os dados ficam no `localStorage` do navegador/dispositivo, não são sincronizados e podem desaparecer se o armazenamento for limpo. Utilize **Mais → Backup e segurança** frequentemente. Não trate esta fase como sistema empresarial com recuperação automática.

O importador XLS usa a biblioteca SheetJS carregada via CDN no primeiro uso; requer internet. Os arquivos continuam sob sua responsabilidade e a proposta não substitui nota fiscal.

## Correção do importador (novembro de 2026)
O importador agora tenta células com formatação de exibição para preservar códigos mascarados do Excel, aceita variações de colunas e unidades, apresenta diagnóstico de leitura e mantém os dados antigos quando uma das tabelas falha. Os valores importados continuam sendo **custos de referência**. Teste com o arquivo oficial no navegador antes de utilizar preços em propostas reais.
