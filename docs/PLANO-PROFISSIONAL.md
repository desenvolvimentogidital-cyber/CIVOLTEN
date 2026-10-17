# CIVOLTEN — melhorias profissionais (v1)

## Funcionamento

1. **Simulação pública:** o cliente continua vendo apenas o valor total de referência.
2. **Orçamento comercial:** o administrador abre **Editar orçamento completo**, revisa serviços, quantidades, unidades e preço unitário; prazo, validade, pagamento e inclusões ficam na proposta. O editor sugere valores iniciais usando a simulação, mas exige conferência do responsável.
3. **PDF:** gerado sob autenticação na Vercel a partir dos itens editados no banco. Serviços e preço total coincidem com o orçamento salvo. Custos internos e preço-base não aparecem.
4. **Link de aprovação:** o administrador salva e gera um link único com token aleatório de 256 bits válido por sete dias; o cliente revisa a proposta e aprova, recusa ou pede revisão. O token fica no *fragmento* da URL (não é enviado ao servidor no acesso à página), e só seu hash é armazenado no banco.
5. **Histórico:** edições, envio e respostas ficam em tabela somente service role, com revisão e data. A aprovação eletrônica não representa, por si só, assinatura digital certificada ou contrato.
6. **Painel:** pesquisa, filtro por situação, indicadores e exportação JSON manual; é importante guardar backups em local privado e verificar a rotina de backup nativa do Supabase.
7. **Identidade visual:** cores e logo PNG/JPEG de até 200 KB no painel, aplicados ao PDF. O microfone usa o mecanismo de ditado do navegador quando disponível, não há gravação enviada para a CIVOLTEN por este recurso.
8. **Site:** linguagem pública mais profissional, mantendo a ressalva de que simulações não são propostas aprovadas.

## Proteções e decisões
- Tabelas novas com RLS, acessíveis exclusivamente pela service role de backend.
- Toda ação de administração continua autenticada com cookie HttpOnly, checagem de origem e confirmação de role no Supabase.
- Links de aprovação expiram em 7 dias. Salvar nova versão invalida o link anterior.
- A edição de proposta aceita exige a criação explícita de uma nova revisão.
- Tentativas de leitura/decisão têm limites independentes por IP, previstos na migração.
- **Não publicar antes de aplicar a migração** \`20261016_professional_quote_suite.sql\` na instância correta e de publicar os novos arquivos de Edge Function.
- A exportação JSON do painel é uma ferramenta manual e não substitui backup automático, restauração testada e políticas de retenção.
- A Vercel pode exigir plano adequado para uso comercial: verificar os termos da conta antes de operar com clientes reais.

## Validação antes de divulgação
- Testes \`npm test\` e geração de PDF exemplar no GitHub Actions.
- Verificar os endpoints públicos sem token (deve retornar 403) e admin sem sessão (401).
- Teste manual com conta de administrador: editar, salvar, baixar PDF, gerar link, abrir em aba anônima, registrar uma decisão, confirmar no painel e verificar a expiração/invalidade após revisão.
- Testar imagem PNG e JPEG de verdade (tamanho, orientação, impressão no PDF).
- Confirmar o uso comercial da hospedagem e o plano de backup do Supabase.
