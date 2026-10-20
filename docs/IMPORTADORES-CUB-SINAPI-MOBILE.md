# CIVOLTEN — Importar CUB e SINAPI pelo celular

## Como acessar

Após publicar **a função Supabase** e o **frontend Vercel**, abra https://civolten.vercel.app/empresa, faça login de administrador e entre na seção **Base técnica de serviços (SIURB)**. Nessa tela passam a aparecer também o **importador SINAPI SP** e o **importador CUB-SP**, com botões de salvar.

## Formatos disponíveis

- **CSV UTF-8** (separador `; ` ou `,`) e **JSON**. O arquivo é lido diretamente no navegador do celular, com prévia e confirmação antes da gravação.
- **Excel (.xlsx/.xls), PDF ou ZIP oficial não são importados diretamente nesta versão**. Exporte a planilha para CSV no celular ou digite os valores pelo formulário manual. PDF deve ser convertido/revisado antes de importar para evitar nomes, unidades e números trocados.
- Cada tela fornece botão **Baixar modelo CSV**. Não preencha um serviço fictício de exemplo como se fosse composição oficial.

### CUB

1. Consulte a fonte SindusCon-SP para São Paulo: https://sindusconsp.com.br/servicos/cub/ .
2. Selecione o arquivo CSV/JSON e clique em **Conferir arquivo selecionado**. O CSV usa `competencia;padrao;regime;valor;fonte`; competência `AAAA-MM`, padrão `R1B`, `R1N` ou `R1A`, e regime `sem_desoneracao` ou `com_desoneracao`.
3. Confira a prévia do período, custo por m², código e fonte, marque a confirmação e clique em **Salvar valores conferidos no Supabase**. Também há cadastro unitário no próprio celular.
4. A tabela protegida `cub_reference_rates` guarda o histórico mensal; o cálculo auxiliar da construção busca a **última competência importada** de cada tipologia/regime. Se não houver dados ou conexão, aparece a referência incorporada de setembro/2026, identificada explicitamente.
5. Valores CUB nunca alteram automaticamente preços comerciais ou o valor final da proposta.

### SINAPI

1. Consulte https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx . A CAIXA publica composições e relatórios, alguns sem custo atualizado. **Custo zero ou ausente é pendente**.
2. Use **Importar SINAPI do celular** na mesma página: CSV com colunas `codigo;descricao;unidade;custo;fonte` ou JSON no esquema `civolten.sinapi.v1`. Selecione competência `AAAA-MM` e regime `sem_desoneracao` ou `com_desoneracao`.
3. Se o relatório estiver sem custos verificáveis, não marque confirmação; serão importadas descrições e unidades com custo pendente. Se houver custo verificável, confira fonte oficial CAIXA/IBGE e marque a confirmação.
4. Clique em **Conferir arquivo**, revise a prévia e confirme a importação. A importação é feita em lotes de 25 composições, informa progresso e mantém os lotes já salvos em caso de falha. Atualize a página de orçamento para atualizar a lista de serviços.
5. Também é possível adicionar uma composição individual do celular.

### Comparador SIURB × SINAPI

O comparador no painel só indica a base de menor custo quando **escopo, unidade, mês-base e encargos** forem equivalentes e ambas as composições possuírem custos válidos. Com diferenças técnicas mostra os motivos e não declara vencedor. Comparar CUB por m² de uma construção inteira com um serviço isolado SINAPI/SIURB não é válido.

## Segurança, verificações e publicação

- Importadores usam `/api/admin` com autenticação por cookie HttpOnly, checagem de origem, limite de tamanho e validação também no servidor. Nenhum custo é inserido por scripts públicos diretamente no banco.
- A migração `20261020_cub_reference_rates.sql` cria a tabela com RLS ativado e sem leitura pública direta. O endpoint público da função Supabase devolve somente os custos básicos CUB, que já são de divulgação pública.
- A Edge Function **civolten-beta** precisa ser publicada com `cub-reference.ts` e `sinapi-reference.ts`, mantendo `verify_jwt=false` apenas porque a função possui autenticação própria nas rotas `admin-` e o BFF utiliza cookie autenticado. Vercel e Supabase são deployments distintos.
- Testes de código não substituem a importação real pelo celular. Confira no painel se a importação aparece em **Referências salvas**, atualize a página e teste a competência no cálculo.
