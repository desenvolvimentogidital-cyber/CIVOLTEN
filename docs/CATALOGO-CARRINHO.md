# Catálogo pesquisável e carrinho CIVOLTEN

O cliente entra em **/orcamento**, pesquisa por nome ou código técnico e escolhe uma das dez categorias de serviço, mais "todos" e "outros técnicos". O buscador reúne os **17 serviços próprios** e as composições **SIURB EDIF/INFRA** existentes na integração (atualmente cerca de 3.463; quantidade e disponibilidade dependem da API). Os termos por categoria são classificados de forma aproximada usando a descrição; a opção "Todos" permite localizar qualquer composição sem depender da classificação.

A lista exibe **todos os serviços disponíveis por rolagem contínua**, sem botão “Mostrar mais”: carrega automaticamente lotes de até 50 itens ao chegar perto do final, evitando travar o celular. A posição da lista é preservada ao adicionar itens ao carrinho. O usuário pode adicionar itens, ver o carrinho, editar quantidades, remover, abrir edição avançada de modalidades e simular. O carrinho usa as **mesmas linhas e quantidades** que alimentam os endpoints atuais `simulate` e `submit`. O cálculo **continua exclusivamente no servidor**, sem divulgar preços unitários privados no catálogo. Para serviços sem preço cadastrado, o servidor mantém avaliação personalizada.

A simulação usa padrão de acabamento, dias estimados e distância fornecidos no formulário. O carrinho não é pedido finalizado: só é enviado após o consentimento e a confirmação em "Enviar pedido de orçamento". Nenhuma seleção é salva em `localStorage` ou `sessionStorage`; fotos e dados pessoais seguem o fluxo já implementado.

## Limites e revisão

- Máximo de 60 linhas por pedido e até 100.000 unidades por item, segundo validação do formulário. Respeitar frações conforme unidade.
- Energia solar, hidráulica e pintura específica podem depender de avaliação: o buscador não inventa serviços ou preços.
- A classificação do texto técnico SIURB por palavras-chave é **heurística**, podendo requerer ajuste após observar consultas reais. Uma composição pode aparecer em "Todos" mesmo sem categoria bem definida.
- Serviços de segurança e automação residencial, que estão fora do escopo comercial atual, não são oferecidos como opção de pesquisa.
- Em dispositivos móveis, o catálogo e o carrinho formam blocos verticais; em desktops ficam lado a lado.
- As páginas ainda compartilham partes do HTML por compatibilidade. O código do buscador só roda no orçamento.

## Critérios para homologação antes de publicar

1. Testar buscas por 'tomada', 'pintura', 'porcelanato' e código SIURB.
2. Confirmar que a pintura não mostra reboco como pintura e que o carrinho permite misturar serviços de categorias diferentes.
3. Adicionar/remover itens, alterar quantidade, editar modalidade SIURB e simular; revisar se o valor veio da API.
4. Acessar a Área da empresa no celular e verificar que os formulários do catálogo não impedem o login.
5. Com uma API indisponível, confirmar que os 17 itens básicos permanecem selecionáveis e que o botão "Atualizar serviços" funciona.
6. Rodar `npm test`. Conferir visualmente em celular antes do deploy.

**Nota de publicação:** esta entrega será somente mergeada no GitHub. Não iniciar deploy manual enquanto a atualização da Vercel não for autorizada.


## Correção de integração carrinho → simulação (20/10/2026)

O passo **Simulação do orçamento** agora exibe uma revisão sempre sincronizada do carrinho: descrição de cada serviço, quantidade, unidade e modalidade. Não é criado um segundo carrinho ou valores locais; a mesma lista `currentItems()` alimenta o servidor. O botão **Ir à simulação** posiciona o cliente nessa revisão.

Ao executar **Simular meu carrinho** ou **Calcular simulação**, a própria etapa exibe `Calculando`, seguida do total real devolvido pela API, solicitação de avaliação personalizada ou erro legível no mesmo local (inclusive de validação). O resultado é trazido para a área visível do celular. Fotos, dados pessoais e consentimento não são exigidos para simular; continuam necessários para enviar pedidos segundo as regras já existentes. O painel e a autenticação permanecem inalterados.

Teste manual recomendado: adicionar dois serviços de categorias diferentes, alterar quantidades, clicar em **Ir à simulação** e **Simular meu carrinho**, confirmar os itens/quantidades e o resultado (ou mensagem de avaliação) sem perda de seleção.


## Projetos integrais por m² — nova experiência

A tela `/orcamento` possui dois acessos rápidos antes da busca dos serviços:

- **Construção residencial completa — do zero à entrega pronta** (`construcao_residencial_completa`): informar a **área construída aproximada em m²**, não a metragem do terreno. Adiciona uma composição própria, de `construcao_civil`, ao carrinho com a metragem digitada. Inicialmente preços `baixo=0, medio=0, alto=0`, de forma que a API apresente **Avaliação personalizada** em vez de fingir uma estimativa. O administrador poderá configurar referências de custo por m² verificadas quando o escopo for definido.
- **Reforma completa de apartamento** (`reforma_apartamento_completa`): informa m² da reforma e reutiliza o serviço já cadastrado e as regras do orçamento real, sem um cálculo paralelo. **Atenção:** a tabela original registra R$ 2.500/m² no padrão médio como *exemplo inicial*, e os outros padrões estão sem preço. Confirmar essa referência no painel antes de considerá-la uma estimativa comercial válida.

Ambos os atalhos mantêm o carrinho unificado e preenchem a descrição do pedido apenas quando estiver vazia. O cliente pode depois incluir outros serviços, alterar quantidades e solicitar a avaliação técnica; dados de contato continuam apenas no envio. O sistema não promete um escopo fechado, que depende de projeto executivo, condições do terreno, número de pavimentos, fundações, aprovações legais, padrão e materiais, despesas indiretas e cronograma.

A migração `20261020_construcao_residencial_completa_m2.sql` cria o serviço no catálogo da API de forma idempotente, sem alterar preços preexistentes. **Antes de liberar cálculos automáticos de obra integral**, o responsável técnico deve definir o que a composição inclui e qual referência regional/temporal é adequada (por exemplo CUB/SINAPI), com ajustes próprios de cada obra. Referências de custo não são propostas fechadas nem substituem orçamento analítico.
