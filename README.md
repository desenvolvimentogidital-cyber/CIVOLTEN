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

Cada funcionário também registra os dias previstos no mês (22 como padrão editável), com estimativa mensal da diária e encargos. O valor da folha deve ser conferido para não contar a mesma mão de obra em custos fixos e no orçamento da obra.

## Acesso e recuperação do administrador

O projeto já possui um administrador no Supabase Auth. Para recuperá-lo, use **Esqueci minha senha** com o endereço da conta original. A recuperação envia e-mail pelo Supabase; a aplicação mostra uma mensagem genérica mesmo se o endereço não estiver cadastrado.

Para novos usuários, **Criar conta de acesso** registra uma conta comum. Depois de confirmar o e-mail e iniciar uma sessão, o usuário solicita aprovação; a conta não lê nenhum dado financeiro enquanto estiver pendente. Um administrador previamente autorizado abre **Acessos** e aprova a solicitação. A concessão ocorre por RPC PostgreSQL que exige explicitamente um administrador ativo, além da confirmação do e-mail. Cadastro público não equivale a permissão administrativa.

### Configuração pendente no Supabase Auth
Confira no projeto CIVOLTEN a página Authentication → URL Configuration:
- Site URL: a URL oficial da CIVOLTEN, quando a nova versão entrar em produção;
- Redirect URLs: adicionar a URL **exata** do deployment de prévia testado, terminando em `/`, antes de testar os links de recuperação/confirmação;
- conferir os modelos de e-mail e as configurações de confirmação, pois URLs não autorizadas podem fazer o Supabase enviar o usuário à Site URL em vez da prévia.

Sem essas configurações e sem teste do e-mail real não é possível considerar a recuperação completamente homologada.

A função pública de aprovação usa SECURITY DEFINER de maneira intencional, com `auth.uid()`, conferência em `admin_users` e confirmação do usuário. A análise de segurança do Supabase apresenta um aviso para essa função; é necessário revisar o risco antes de produção.

### Implantação da refatoração
A migração e as alterações estão na branch `refatoracao-custos-reais-20261020`. A branch principal e a produção não foram alteradas. O deploy manual de prévia pela API Vercel retornou 403 (permissão insuficiente); uma implantação mais antiga da branch não representa necessariamente a versão mais nova dos formulários de acesso. Confira se o SHA do deployment corresponde ao HEAD da branch antes de homologar.


## Proposta comercial em PDF (layout corporativo)
No editor de orçamento, escolha **Gerar PDF / imprimir proposta**. No diálogo de impressão do celular ou computador, selecione **Salvar como PDF** para gerar o arquivo A4 para enviar pelo WhatsApp ou e-mail.

O novo documento inclui a marca CIVOLTEN, identificação do projeto e cliente, data e referência quando o orçamento está salvo, prazo, descrição do escopo, condições informadas pelo administrador, investimento total e campos para aceite. A folha é sempre clara, independentemente do tema da interface. O PDF é formado no navegador; não adiciona arquivos externos nem envia o orçamento a serviços de terceiros.

**Privacidade:** o gerador recebe somente título, cliente, endereço, escopo, prazo, observações e o **preço final** já calculado. Os dados de funcionários, custos, encargos, alíquotas, margens, despesas, formação de preço e resultados nunca são interpolados na proposta comercial. Verifique se os campos de escopo e observações não contêm informações internas antes do envio.

**Observação:** a referência `CV-XXXXXXXX` só é exibida depois de salvar o orçamento, quando já existe um identificador real. Antes de salvar, o documento indica `Prévia sem número`. O documento não inventa CNPJ, contatos, condições de pagamento ou prazo de validade que não tenham sido fornecidos.
