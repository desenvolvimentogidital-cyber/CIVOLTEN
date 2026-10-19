# CIVOLTEN — revisão do layout antes do próximo deploy

Data: 19/10/2026. Etapa atual: aprovar melhorias e manter branch principal atualizada; **não solicitar deploy nesta alteração**.

## Identidade visual aprovada nesta etapa

- Sem rosa, magenta ou roxo na barra.
- Barra superior com azul-marinho **#0B203C**, azul técnico **#173C67** e azul médio **#2B6094**, em degradê.
- Navegação branca e indicadores/detalhes dourados, preservando a cor de destaque configurada pela empresa.
- A logo oficial vem das configurações (não substituir com marca simulada). Base branca translúcida atrás da logo preserva o contraste mesmo quando a arte contém texto escuro.
- A mesma identidade se aplica à home, serviços, orçamento, empresa, privacidade e cabeçalho da proposta.

## Melhorias identificadas para aprovação posterior

1. **Prioridade alta — formulário rápido no celular:** dez categorias + subtarefas ficam extensos e deslocam o hero para baixo. Proposta: categorias agrupadas em seletor compacto expansível, campo de pesquisa, subtarefas em acordeão. Testar scroll e acessibilidade em Android.
2. **Prioridade alta — desempenho e carregamento:** `empresa.html` e `orcamento.html` são derivados do `index.html` e contêm estrutura de telas ocultas. O JS do formulário inicializa e baixa catálogo inclusive no painel. Proposta: carregamento progressivo do catálogo apenas na tela de orçamento, com erro e retentativa acessíveis, e divisão real de HTML/JS quando homologado.
3. **Prioridade média — recuperação da identidade:** o logo é ocultado se a API de identidade ficar indisponível. Proposta: sinalizar erro de carregamento e permitir nova tentativa, sem mostrar logotipo fictício nem expor dados de administração.
4. **Prioridade média — cobertura visual:** os testes atuais verificam markup e regras CSS, mas **não comprovam a aparência real** em telefone, tablet e desktop. Fazer capturas comparativas nas larguras 360, 390, 768 e 1440 px, checar overflow, contraste e funcionamento do menu.
5. **Prioridade média — catálogo de serviços:** opções de pintura de tetos, pisos e drywall são enviadas para avaliação personalizada porque não há composição/preço isolado cadastrado para cada uma. Energia solar e hidráulica também não têm composição rápida. Adicionar categorias reais ao backend apenas com regra comercial aprovada e mantendo validação dos preços no servidor.

## Critérios antes de publicar

- Confirmar em tela real a cor da barra, contraste da logo e menu branco.
- Verificar acesso e login da Área da empresa.
- Simular solicitação de pintura de paredes e pedido de pintura de teto/piso/drywall sem serviço incorreto e sem preço fictício.
- Conferir que o PDF, a autenticação, a tabela de preços e o catálogo SIURB não tiveram regressões.
- Executar `npm test` e confirmar que `build:css` e `build:pages` estão sincronizados.
- Publicar somente depois da decisão do responsável e disponibilidade da Vercel.

As melhorias opcionais listadas aqui **não estão implementadas** neste PR. A alteração de código desta etapa limita-se a remover o tom rosado, atualizar as versões CSS e manter as páginas geradas sincronizadas.


## Ajustes executados: seleção móvel e carregamento condicionado

- Na home, até 630 px, as dez categorias são apresentadas em um **select nativo com rótulo**, evitando duas colunas de dez botões e preservando a área de serviços específicos. Em desktop a grade continua visível; a mudança de categoria sincroniza os controles.
- A Área da empresa e a home deixam de iniciar automaticamente a busca de catálogo/SIURB e de construir uma linha do formulário escondido. A busca e construção acontecem na rota `/orcamento` (ou `/orcamento.html`); o formulário de orçamento mantém o catálogo de reserva e a opção de atualizar serviços.
- O **azul técnico #173C67** permanece no centro da faixa de topo, com azul-marinho e azul médio como apoio, menu branco e logo oficial em base clara. Nenhum rosa foi reintroduzido.
- A estrutura HTML das páginas segue compartilhada por `scripts/build-pages.mjs` e as folhas finais por `scripts/build-css.mjs`.
- **Não iniciar deploy manual** nesta etapa. Os arquivos estão preparados para homologação; merges em `main` podem, conforme conexão atual, acionar a Vercel automaticamente.

Permanecem para revisão posterior, sem mudanças nesta entrega: divisão real do código-fonte HTML/JS entre telas, recuperação da logo com botão de repetição e testes visuais em navegador real.
