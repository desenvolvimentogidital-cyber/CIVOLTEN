# CIVOLTEN — CUB, SINAPI e comparador de composições

## Construção residencial a partir do CUB-SP

- O cálculo auxiliar na página `/orcamento` usa apenas **custo básico referencial por m²** para residência unifamiliar térrea R1-B, R1-N ou R1-A, com/sem desoneração, São Paulo, competência **09/2026**.
- Fonte SindusCon-SP: https://sindusconsp.com.br/cub-paulista-sobe-013-em-setembro/ . Tabela integral reproduzida em https://portaldori.com.br/2026/10/05/sinduscon-divulga-tabelas-de-custo-unitario-basico-no-estado-de-sao-paulo-referencia-setembro-de-2026/ .
- Exemplos R1-N (set/2026): R$ 2.690,33/m² sem desoneração, R$ 2.595,06/m² com desoneração. Outros padrões estão identificados no código `assets/civolten-cub.js`.
- **Não é custo de obra pronta, preço de venda, margem de lucro nem proposta**. O CUB da NBR 12721 não contempla todos os itens necessários à entrega, como projetos, impostos, fundações especiais, obras externas, taxas e custos específicos. O contrato requer orçamento analítico revisado por responsável técnico.
- A multiplicação área x CUB aparece em quadro separado. **Não altera preço nem total do backend** `simulate`. A composição `construcao_residencial_completa` permanece com valores zero/pending na tabela comercial até definição da empresa.

## SINAPI-SP pesquisável e armazenado de modo seguro

- A base SINAPI é um **cadastro técnico separado**, sem inserir preços em `pricing_catalog`. Somente a API autenticada do administrador pode importar as referências; o endpoint público `sinapi-list` devolve nomes/códigos/unidades, **nunca custos**.
- **Importação**: painel da empresa → Base SIURB (com seção SINAPI). A equipe pode registrar uma composição manualmente pelo celular ou importar arquivo JSON em lotes, preservando UF, competência e regime. O sistema suporta `SP`, `YYYY-MM`, regime com/sem desoneração e código de 4 a 10 dígitos.
- Esquema de importação: `{ "schema":"civolten.sinapi.v1","uf":"SP","period":"2026-09","regime":"sem_desoneracao","items":[{"code":"123456","description":"EXEMPLO — não importar como serviço real","unit":"M2","cost":null}] }`. Não importar o registro ilustrativo; substituir por código, descrição e unidade originais de fonte oficial.
- `cost:null` ou `cost:0` significa **pendente**; nunca apresenta preço zero ao visitante. Preço maior que zero exige `price_verified:true` e URL oficial CAIXA/IBGE rastreável. A simulação só converte custo unitário em estimativa com a margem do servidor quando o custo verificado existe; senão retorna avaliação personalizada.
- Relatórios oficiais CAIXA: https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx . Notas oficiais: https://www.caixa.gov.br/Downloads/sinapi-historico-de-encargos-e-notas/Notas_SINAPI.pdf . A CAIXA registrou publicação excepcional de custos de composições zerados a partir de 10/2025. Não inferir nem inventar preços de composição a partir do indicador médio m² IBGE.
- **Sem importação real, não há composições SINAPI no catálogo**. O código não apresenta catálogo completo fictício ou disponibilidade falsa. Para cobertura ampla, é necessário transformar os relatórios oficiais em registros neste esquema e checar os valores.

## Comparação SIURB × SINAPI

- A comparação aparece no painel administrativo. Selecionar SINAPI, identificar composição SIURB EDIF/INFRA correspondente e **confirmar escopo equivalente**.
- O servidor compara somente quando a unidade normalizada, a competência, o regime, a existência de preço SINAPI oficial verificado e a confirmação de escopo são compatíveis.
- Mostra `menor custo de referência` e diferença unitária **apenas nessas condições**. Caso contrário, mostra os motivos e **não elege vencedor**.
- SIURB carregada atualmente refere-se a julho/2026 com desoneração. Se os registros SINAPI forem de outra competência/regime, comparação será bloqueada. Isso evita escolher a menor taxa de bases tecnicamente diferentes.
- Comparar custo de referência não garante o melhor orçamento para o cliente: coeficientes, inclusões e exclusões, execução, transporte, logística, impostos, BDI/margem e prazos devem ser avaliados tecnicamente.
- **Não comparar CUB da casa inteira contra composição isolada de serviço SIURB/SINAPI** como se fossem grandezas equivalentes.

## Publicação, atualização e controle

- Arquivos públicos e scripts estão versionados. A migração `20261020_sinapi_reference_services.sql` cria a tabela com RLS/revogação de acesso público.
- A Edge Function `civolten-beta` precisa ser publicada juntamente com o frontend para ativar novos endpoints e o registro no banco precisa existir. Deploy da Vercel sozinho não publica as rotas do Supabase.
- Como inicialmente não existe catálogo SINAPI importado, a listagem pública continuará exibindo CIVOLTEN/SIURB, com SINAPI disponível após a importação.
- Testar via celular: multiplicação do CUB R1N 120m², troca de regime, importar SINAPI sem preço, consultar código, tentativa de simular com avaliação personalizada e comparação de meses diferentes sem indicação de vencedor.

## Limitações

- Os dados CUB incluídos são apenas SP 09/2026; devem ser substituídos/atualizados quando o SindusCon-SP divulgar nova competência.
- A importação SINAPI inicial aceita JSON preparado e registro unitário no celular, não lê XLSX oficial diretamente. É uma etapa adicional converter os relatórios CAIXA para o esquema sem perder códigos, unidades, mês e encargos.
- Não se deve anunciar SINAPI já carregado, nem preços atualizados automaticamente, enquanto não houver importação e verificação real.
