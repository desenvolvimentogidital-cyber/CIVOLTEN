# Catálogo técnico SIURB – Julho/2026
Arquivos fornecidos pelo usuário, com desoneração:
- EDIF: 2.617 composições e 10.398 insumos.
- INFRA: 846 composições e 3.395 insumos.
- Total: 3.463 serviços, 13.793 insumos.

## Como importar pelo celular
1. Baixar do ChatGPT os dois arquivos JSON de importação.
2. Abrir civolten.vercel.app, acessar Área da empresa e entrar.
3. Em Bases técnicas SIURB — julho/2026 selecionar os dois arquivos JSON.
4. Clicar em Importar / atualizar bases. A importação usa lotes de 25 e pode ser repetida sem duplicar registros.
5. Validar a contagem: EDIF 2617 e INFRA 846.

## Como usar
No editor comercial, procurar serviço ou código, consultar composição analítica e adicionar ao orçamento.
O item novo tem preço de VENDA zero por segurança: conferir os custos de referência e definir manualmente o preço comercial.

## Coexistência
A tabela antiga de preços (pricing_catalog) e os orçamentos atuais permanecem inalterados.
O custo SIURB não é preço de venda; não inclui automaticamente BDI, tributos finais, logística ou margem.
A tabela nova registra fonte, competência, regime, código, descrição, unidade, custo e insumos detalhados.

## Proteção e homologação
Administração somente por sessão autenticada e RLS na tabela. Testar busca por código, descritivo, importação idempotente e composição detalhada.
Não anunciar a importação como concluída até que os contadores consultados no Supabase confirmem 3.463 composições.