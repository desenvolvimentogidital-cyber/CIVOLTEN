# CIVOLTEN — aceite ou recusa online na proposta PDF

## Como formalizar e enviar

1. Monte a proposta exclusiva de mão de obra, confira impostos, margem, escopo, prazo,
   condições de pagamento, garantia e cliente. **Salve primeiro o orçamento no Supabase.**
2. Em **Orçamentos**, na proposta salva, clique em **Gerar botão de aceite no PDF**.
   Confirme que esse orçamento está pronto: o preço e os serviços ficam **congelados**
   e não poderão mais ser alterados. A validade do link vai até o prazo da proposta
   ou até 30 dias da emissão, o que vier antes.
3. Abra o orçamento salvo, clique em **Visualizar/PDF** e salve/compartilhe o PDF
   atualizado com o botão clicável **RESPONDER À PROPOSTA ONLINE** na última folha.
   A opção **Copiar link** pode ser usada para enviar a resposta diretamente por
   WhatsApp ou e-mail, junto do PDF.
4. O contratante abre o link da proposta em qualquer navegador, vê serviços,
   quantitativos, preço total e condições. Informa **nome e e-mail**, marca que leu
   as condições e seleciona **Aceitar** ou **Recusar**, confirmando a decisão.
   A identificação é **declarada pelo próprio respondente**, sem verificação de
   identidade por certificado, documento ou e-mail.
5. A resposta é registrada no banco com data e hora do servidor. Ao abrir a CIVOLTEN,
   o proprietário vê o estado no orçamento e o resumo no painel. Quando o app está
   em primeiro plano, consulta novas respostas periodicamente.
6. **Aceita:** em Orçamentos, utilize **Formalizar aceite recebido e abrir obra**.
   A OS recupera a referência de aceite, nome, e-mail e data do registro e exige
   conferência humana da autorização.
7. **Recusada:** o orçamento fica marcado como recusado; use **Duplicar para nova
   proposta** se quiser negociar escopo, preço ou prazo diferentes.
8. **Revogar:** enquanto estiver aguardando resposta, o proprietário pode revogar
   o link. Um orçamento já enviado permanece no histórico; para reemitir um link
   use uma nova proposta.

## Segurança e limites

- Link de 256 bits, criado com `crypto.getRandomValues`, armazenado de modo
  privado sob RLS. Aparece em fragmento `#t=` do endereço e não é enviado como
  parâmetro de navegação ao servidor; a resposta é transmitida ao RPC apenas
  depois que a página carregar.
- O acesso ao documento depende da **posse do link**: não compartilhe em grupos
  ou páginas públicas. A plataforma não verifica quem está segurando o dispositivo.
- Resposta é de ocorrência única (primeira confirmação definitiva), salvo somente
  no banco por uma função controlada; o cliente não tem acesso à tabela privada.
- O dono não pode alterar o valor de uma proposta enviada; o banco também impede
  iniciar OS com convite pendente/recusado e exige a mesma precificação do aceite.
- Não envia e-mails, SMS, push de celular nem WhatsApp automaticamente.
  **Confirmação aparece dentro da CIVOLTEN** após sincronização.
- Não gera certificado digital nem assinatura ICP-Brasil. É um registro
  de manifestação de vontade/aceite eletrônico simples e pode não preencher
  exigências formais para qualquer espécie de contrato. Para contratos de maior
  risco, obtenha documentação assinada por método apropriado e consulta jurídica.
- Alguns leitores de PDF não preservam links clicáveis; por isso, envie também o
  link de resposta no corpo do WhatsApp/e-mail usando **Copiar link**.
- A proposta usa apenas mão de obra; materiais/insumos ficam com o contratante.
- No momento, a página não possui desafio anti-bot próprio. O segredo aleatório
  longo torna impraticável adivinhar o link, mas se um link vazar o acesso deve
  ser revogado enquanto pendente. Consulte requisitos de LGPD antes de divulgar
  informações pessoais.

## Estrutura técnica

- `public.cv_proposal_invites_v1`: uma emissão por orçamento, token, cópia imutável
  do escopo e preço, estado, nome/e-mail e data de resposta. RLS do proprietário.
- `cv_proposal_lookup_v1`: função anônima retorna somente resumo da proposta
  correspondente a token válido.
- `cv_proposal_respond_v1`: registra uma única resposta, exige nome, e-mail e
  confirmação explícita, sem permitir mudança da decisão.
- `cv_proposal_revoke_v1`: revoga link pendente apenas quando autenticado.
- `aceite.html` / `aceite.js`: página estática em Vercel usando somente chave
  Supabase publishable, sem serviço pago.
- `src/budget-print.mjs`: botão HTML `<a href>` que se transforma em hyperlink
  no PDF gerado pelo navegador.
- `tests/proposal-acceptance.test.mjs`, `tests/proposal-browser.cjs`: validação
  de link, privacidade, resposta, PDF e abertura de OS.

Migração aditiva: `supabase/proposal-acceptance-v1.sql`. Não altera funcionários,
custos, catálogo SIURB ou propostas antigas.
