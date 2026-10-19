# Catálogo pesquisável e carrinho CIVOLTEN

O cliente entra em **/orcamento**, pesquisa por nome ou código técnico e escolhe uma das dez categorias de serviço, mais "todos" e "outros técnicos". O buscador reúne os **17 serviços próprios** e as composições **SIURB EDIF/INFRA** existentes na integração (atualmente cerca de 3.463; quantidade e disponibilidade dependem da API). Os termos por categoria são classificados de forma aproximada usando a descrição; a opção "Todos" permite localizar qualquer composição sem depender da classificação.

Os resultados aparecem em grupos de até 30 por vez para evitar travamento no celular. O usuário pode adicionar itens, ver o carrinho, editar quantidades, remover, abrir edição avançada de modalidades e simular. O carrinho usa as **mesmas linhas e quantidades** que alimentam os endpoints atuais `simulate` e `submit`. O cálculo **continua exclusivamente no servidor**, sem divulgar preços unitários privados no catálogo. Para serviços sem preço cadastrado, o servidor mantém avaliação personalizada.

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
