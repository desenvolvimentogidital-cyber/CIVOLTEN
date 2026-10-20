# CIVOLTEN — Simplificação da home e do orçamento

## Diagnóstico da interface anterior

O formulário de seleção rápida da home duplicava o catálogo pesquisável do orçamento. O cliente selecionava serviços na apresentação e voltava a selecionar no orçamento, criando duas jornadas distintas. Ao entrar no orçamento, dados pessoais, anexos e detalhes técnicos ocupavam espaço antes do catálogo/carrinho.

## Nova organização (mobile-first)

**Home (/) — vitrine institucional**
- Logo oficial sobre azul técnico, hero principal em destaque, dois CTAs claros: **Escolher serviços** e **Conhecer serviços**.
- Categorias ilustradas, explicação curta em 3 etapas e rodapé.
- Não há mais pré-formulário, quantidade, modalidades ou seleção de serviços duplicada na home.
- Links dos cards continuam encaminhando para `/orcamento?servico=...` (o filtro seleciona a categoria).

**Orçamento (/orcamento) — jornada principal**
1. Pesquisar nome/código SIURB e navegar por categoria; montar carrinho, revisar quantidade e remover serviços.
2. Simular valor usando as regras e API existentes. Padrão de execução, dias e distância estão em `details` opcional com padrões iniciais preservados. A edição avançada de composições continua disponível em `cartTechnicalEditor`.
3. Abrir **Enviar pedido para a CIVOLTEN** somente quando quiser informar nome, WhatsApp, descrição e consentimento. Campos de bairro/cidade/categoria/urgência e anexos de imagem, vídeo e áudio ficam em seções opcionais.

O botão **Continuar para enviar pedido** abre a etapa 3 e posiciona o foco no nome; ele não envia dados sozinho. O envio real continua no botão `#send`, com validações, consentimento e autenticação/servidor intactos.

## Preservação de negócio e segurança

- Não foram modificados preços, categorias de tarifa, cálculos, endpoints, PDF, SIURB, autenticação ou cookies.
- Simulação não pede informações pessoais.
- Nome, telefone e descrição seguem obrigatórios apenas para envio.
- Modalidade mão de obra exclusiva com composição SIURB, catálogo avançado e anexos continuam acessíveis.
- Retirados o script antigo `civolten-servicos-rapidos.js` e o controlador visual duplicado. Links antigos de pré-seleção podem continuar sendo interpretados no orçamento pelo roteador existente.

## Homologação recomendada

- Conferir home com logo + imagem em 360, 390, 768 e 1440px.
- Verificar pesquisa por nome, por código e filtros; adicionar dois serviços, alterar quantidade e remover.
- Simular carrinho sem dados pessoais, alterar padrão/dias/km e verificar resultado.
- Abrir os dados para envio, anexar mídia opcional e enviar pedido real em ambiente de teste.
- Revisar navegação mobile, login da empresa e identidade visual.
- Rodar `npm test` e confirmar o commit publicado; CI não substitui teste visual de navegador.

O deploy depende de publicação aprovada e disponibilidade da Vercel.
