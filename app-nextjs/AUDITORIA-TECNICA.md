# CIVOLTEN — auditoria independente e diagnóstico, 16/10/2026

Escopo: código do projeto `civolten-precificacao-v2`, atualizado com correção de privacidade comercial em `civolten-audit-v3`. **Nenhum recurso do OrçaPro foi modificado.**

## Resultados verificados

- Inventário da matriz: 8 itens de construção civil + 7 de elétrica; 45 valores (15 × 3 padrões) e unidades conferidos em teste independente com base nos preços fornecidos.
- O cálculo usa `preço_unitário × quantidade`, soma por serviço, mobilização para índice medido inferior a 30, 15% sobre subtotal dos serviços quando distância > 15 km e rateio de (10.000 + 3.000) / 22 × dias. Aplica imposto sobre preço final via divisão por 0,90.
- Arredondamento em centavos; todos os testes unitários executados localmente.
- Corrigida a exposição pública do pró-labore e da margem-alvo da empresa no endpoint de simulação e no texto do WhatsApp. Ver `lib/public-quote.mjs`.
- Imports e sintaxe passaram verificação estática; Next.js build, banco SQL, login, mídia e fluxo HTTP **não foram testados de ponta a ponta**.

## Pendências antes da publicação para clientes reais

1. **Infraestrutura separada:** criar Supabase exclusivo CIVOLTEN ou serviço PostgreSQL + autenticação/armazenamento equivalentes. Nunca aplicar os arquivos SQL ao OrçaPro.
2. **SQL e acesso:** executar migrações 001 e 002 em banco exclusivo; revisar RLS, políticas de Storage, funções RPC, cadastro do administrador e permissões; executar testes reais de isolamento de acesso.
3. **Hospedagem:** tentativa de criar projeto Vercel isolado `civolten-orcamentos-teste` retornou `403 forbidden: You don't have permission to create the project`. CLI Vercel não instalado. Nenhum deploy realizado.
4. **Uso comercial:** Vercel Hobby gratuito é de uso pessoal não comercial. Para serviços comerciais, usar plano Vercel compatível ou hospedagem gratuita que permita atividade comercial.
5. **Build:** tentativa de instalar dependências npm falhou com `EAI_AGAIN` (registry.npmjs.org inacessível neste ambiente), logo falta validar build Next e compatibilidade do app.
6. **Uploads:** verificar no celular com diferentes vídeos/HEIC e áudios; o limite atual é 45 MB/arquivo, 6 anexos, 120 MB/pedido. Falta reserva atômica de cota de anexos, detecção de conteúdo por assinatura, limpeza de uploads abandonados e recuperação/resume em falhas.
7. **Segurança operacional:** validar IP de proxy para rate limit, configuração de Turnstile, HTTPS, consentimento e aviso LGPD, rotina de expurgo e limites de tamanho/custo.
8. **Orçamento e margem:** margem nunca é garantida por valores tabelados; custos diretos precisam ser cadastrados e auditados. A confirmação de margem ainda é volátil no painel (não persistida como proposta aprovada). Falta gerenciamento de versão de propostas, PDF real e histórico de edições.
9. **Regra comercial a revisar:** `m² + metro` representa um índice de mobilização, não dimensão física coerente. Regra foi mantida como solicitado; ideal separar critérios por categoria.
10. **Rateio a revisar:** 22 dias/mês é hipótese. O custo fixo pode ser duplicado em obras simultâneas ou não ser recuperado em períodos ociosos. Recalibrar por capacidade e taxa de ocupação.
11. **Tributação:** 10% é parâmetro comercial solicitado, não alíquota confirmada por regime tributário; alinhar com contador antes de enviar propostas.

## Situação

**Pronto para revisão e testes locais; NÃO pronto para produção.** O bloqueio de deploy Vercel é de permissão e o banco ainda não foi criado/configurado. Não existe URL pública verificada nesta entrega.