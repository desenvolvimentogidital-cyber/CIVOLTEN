# CIVOLTEN — Central de Respostas dos Clientes

## Organização para o dia a dia

**Orçamentos** é o local para montar, editar, duplicar, salvar e enviar propostas.
**Central de Respostas** é a caixa de entrada para acompanhar os retornos dos clientes.
**Obras e execução** acompanha os contratos aprovados, profissionais, HH e medições.

A Central de Respostas está disponível na tela Inicial (Acesso rápido), no menu
Mais e no topo de Orçamentos. Tocar no **sino** abre diretamente a Central,
mostrando primeiro as respostas novas; não abre mais a lista geral de orçamentos.

Cada registro mostra o **cliente**, a **obra**, o **valor**, quem respondeu e
a **data/hora**. A lista possui pesquisa por cliente, obra, título da proposta,
e-mail ou identificação e filtros:
**Todas, Não lidas, Aceitas, Recusadas e Aguardando**.

Ao selecionar uma mensagem, o sistema abre os detalhes de **apenas aquele
cliente** e registra que a resposta foi visualizada. Essa leitura é salva no
Supabase por usuário, funciona após reiniciar o celular e em outros dispositivos,
e não altera o aceite original nem o preço.

- **Aceite:** a tela permite formalizar o aceite recebido e abrir a OS; se a obra
  já existe, abre a obra diretamente.
- **Recusa:** apresenta o motivo deixado pelo cliente, se houver, e permite
  duplicar o orçamento para negociar uma nova proposta sem modificar a antiga.
- **Aguardando:** oferece link direto para copiar e enviar ao cliente.
- **Orçamentos:** permanece com o histórico comercial, mas o botão
  **Ver resposta do cliente na Central** abre o registro correto imediatamente.

O aviso do painel mostra a contagem de **respostas não lidas**, destacando o
cliente da mais recente. Quando o CIVOLTEN estiver aberto, continua consultando
a chegada de respostas e exibe uma mensagem contextual. Não há SMS, WhatsApp,
push ou e-mail automático neste módulo.

## Segurança

O controle de visualização usa apenas uma nova tabela:
`public.cv_proposal_receipt_reads_v1`, com RLS, permissões SELECT/INSERT
e vínculo ao proprietário do convite. `cv_proposal_mark_read_v1` exige
autenticação e registra leitura só de respostas efetivamente aceitas/recusadas.
É idempotente e não modifica `cv_proposal_invites_v1`.

A migração `supabase/proposal-inbox-v1.sql` é aditiva; não apaga aceites,
recusas, orçamentos, serviços, funcionários nem obras.
A resposta eletrônica continua sendo a manifestação de vontade do cliente,
não assinatura digital certificada nem verificação de identidade.
