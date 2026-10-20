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
Os custos nunca entram na proposta impressa ao cliente. Login reutiliza a autenticação CIVOLTEN com cookie seguro HttpOnly. Novas tabelas cv_ no Supabase protegem cada administrador por RLS. Não há chave de serviço exposta.

## Segurança de migração
Versão anterior preservada em backup-civolten-antes-refatoracao-20261020. A versão nova usa cinco tabelas novas sem alterar dados de preço antigos. A identidade visual original (logo e cores) vem de civolten_branding. A Edge Function original ainda participa somente da checagem do administrador e do carregamento da logo.

## Teste
Execute npm run check. A publicação em produção exige teste real de login, impressão de proposta, cálculos e permissões no celular. A nova versão é proposta em branch separada da main.
