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
Existe uma referência histórica de código antes da refatoração (`backup-civolten-antes-refatoracao-20261020`). **Uma branch do GitHub não substitui backup do banco Supabase**. As tabelas novas de custos reais preservaram as tabelas antigas; a identidade visual oficial usa dois arquivos PNG locais, e as cores podem ser consultadas pelo serviço de branding. A Edge Function participa da verificação de administrador.

## Teste
Execute `npm run check`. O CI testa sintaxe, calculadora, formulário, proposta, login não autorizado, regras de acesso e operações da API. Essas verificações **não substituem** o teste com a conta real (login, edição, salvamento, PDF, recuperação de senha e permissões) no celular. Alterações devem ser propostas por PR, com CI verde antes de integrar a branch `main`.

Cada funcionário também registra os dias previstos no mês (22 como padrão editável), com estimativa mensal da diária e encargos. O valor da folha deve ser conferido para não contar a mesma mão de obra em custos fixos e no orçamento da obra.

## Acesso e recuperação do administrador

O projeto já possui um administrador no Supabase Auth. Para recuperá-lo, use **Esqueci minha senha** com o endereço da conta original. A recuperação envia e-mail pelo Supabase; a aplicação mostra uma mensagem genérica mesmo se o endereço não estiver cadastrado.

Para novos usuários, **Criar conta de acesso** registra uma conta comum. Depois de confirmar o e-mail e iniciar uma sessão, o usuário solicita aprovação; a conta não lê nenhum dado financeiro enquanto estiver pendente. Um administrador previamente autorizado abre **Acessos** e aprova a solicitação. A concessão ocorre por RPC PostgreSQL que exige explicitamente um administrador ativo, além da confirmação do e-mail. Cadastro público não equivale a permissão administrativa.

### Configuração pendente no Supabase Auth
Confira no projeto CIVOLTEN a página Authentication → URL Configuration:
- Site URL: `https://civolten.vercel.app/`;
- Redirect URLs: permitir a URL de produção `https://civolten.vercel.app/` e somente outros endereços efetivamente necessários;
- conferir os modelos de e-mail e as configurações de confirmação, pois URLs não autorizadas podem fazer o Supabase enviar o usuário à Site URL em vez da prévia.

Sem essas configurações e sem teste do e-mail real não é possível considerar a recuperação completamente homologada.

A função pública de aprovação usa `SECURITY DEFINER` de maneira intencional, com `auth.uid()`, conferência em `admin_users`, `search_path` vazio e confirmação do usuário. A análise de segurança do Supabase ainda apresenta um aviso para essa função por ser executável por autenticados. Não retirar os bloqueios nem ampliar os grants sem nova auditoria.

### Implantação atual
A aplicação CIVOLTEN está em produção na Vercel e é publicada pela branch `main`. `vercel.json` desabilita deploys de preview para branches secundárias, preservando a cota e exigindo somente um deploy após integração. Confira sempre se o SHA do deployment `production` corresponde ao commit de `main`.


## Proposta comercial em PDF (layout corporativo)
No editor de orçamento, escolha **Gerar PDF / imprimir proposta**. No diálogo de impressão do celular ou computador, selecione **Salvar como PDF** para gerar o arquivo A4 para enviar pelo WhatsApp ou e-mail.

O novo documento inclui a marca CIVOLTEN, identificação do projeto e cliente, data e referência quando o orçamento está salvo, prazo, descrição do escopo, condições informadas pelo administrador, investimento total e campos para aceite. A folha é sempre clara, independentemente do tema da interface. O PDF é formado no navegador; não adiciona arquivos externos nem envia o orçamento a serviços de terceiros.

**Privacidade:** o gerador recebe somente título, cliente, endereço, escopo, prazo, observações e o **preço final** já calculado. Os dados de funcionários, custos, encargos, alíquotas, margens, despesas, formação de preço e resultados nunca são interpolados na proposta comercial. Verifique se os campos de escopo e observações não contêm informações internas antes do envio.

**Observação:** a referência `CV-XXXXXXXX` só é exibida depois de salvar o orçamento, quando já existe um identificador real. Antes de salvar, o documento indica `Prévia sem número`. O documento não inventa CNPJ, contatos, condições de pagamento ou prazo de validade que não tenham sido fornecidos.

## Memorial descritivo e quantitativos da proposta
No editor do orçamento, preencha **Memorial descritivo / quantitativos** com cada serviço (ex.: execução de parede), unidade (m², m, m³, un, ponto ou serviço) e quantidade. Use **+ Adicionar serviço** e **Remover** para editar a lista. Ela fica salva dentro do conteúdo do orçamento e vai para o PDF do cliente, em tabela com as três colunas, sem preço por item. O preço global permanece calculado por funcionários, despesas e demais custos reais internos, que não são expostos. O campo textual **Serviços que serão executados** continua disponível para explicações adicionais e para orçamentos antigos.

Valide as medições e condições de execução com o responsável pela obra. As quantidades são informadas manualmente, não medidas pelo sistema; o cadastro descritivo não altera automaticamente a formação do preço.

## Identidade visual no cabeçalho do PDF
O PDF comercial exibe **o ícone PNG e a arte PNG horizontal do nome CIVOLTEN lado a lado**, sem fundo branco, com a marca textual duplicada removida do cabeçalho.

As duas imagens PNG enviadas pelo usuário foram adicionadas ao projeto: `assets/civolten-logo.png` (ícone oficial, substitui a identidade anterior nas telas e no PDF) e `assets/civolten-proposal-header.png` (arte horizontal de nome). A arte já é carregada em `index.html`; o PDF a incorpora após o carregamento, ao lado da nova logo, sem precisar modificar os cálculos ou os dados da proposta.

A arte nova está instalada. A área horizontal tem recorte visual para compensar a margem transparente do arquivo, sem modificar os pixels originais. A marca textual no rodapé permanece para identificação comercial.

## Auditoria de integridade (21/10/2026)

- **Cálculos e preços:** entrada negativa, não numérica, fora dos limites ou sem precisão suficiente deve gerar erro — nunca custo reduzido silenciosamente. Os testes automatizados conferem custo real, encargos, despesas, impostos, rateio, preço manual e lucro/prejuízo.
- **Listagem:** funcionários, custos e orçamentos são lidos de forma paginada, em lotes de 250, com ordenação estável. A operação não oculta registros antigos silenciosamente. Há limite operacional defensivo de 2.000 registros por tabela; acima disso, será necessário implementar paginação visual com carregamento incremental.
- **Persistência:** atualizar ou excluir ID inexistente/sem permissão retorna erro, evitando mensagem enganosa de sucesso.
- **API:** corpos JSON são limitados por bytes durante o streaming, inclusive sem `Content-Length`. Endpoints financeiros exigem sessão e administrador; Supabase aplica RLS por proprietário.
- **Configuração financeira:** na auditoria, a tabela de configurações ainda não tinha um registro. O painel avisa quando impostos, margem e capacidade faturável não foram salvos ou quando margem/impostos estão em zero. **Configure esses valores reais antes de confiar em um preço comercial**.
- **Limitações de homologação:** ainda é necessário testar no aparelho real uma sessão autenticada, recuperação de senha, impressão e restauração de backup do banco. O aviso de proteção contra senhas vazadas do Supabase Auth deve ser revisado nas configurações de autenticação. Os avisos de RLS sem política referem-se a tabelas antigas bloqueadas intencionalmente.
- **Dados:** a auditoria usa consultas de leitura no banco; não apaga nem modifica cadastros existentes e não inclui nenhuma tabela de referência na formação de preços.
