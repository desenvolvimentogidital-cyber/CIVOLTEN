# Avisos de orçamento e instalação no celular — 10/11/2026

## Caminho do usuário (Android/Chrome)
1. Abrir https://civolten.vercel.app e entrar na conta da CIVOLTEN.
2. Ir em **Mais → Ativar avisos no celular** e permitir as notificações solicitadas pelo navegador/Android.
3. Ir em **Mais → Instalar CIVOLTEN no celular**. Se o navegador não mostrar o diálogo, usar Chrome → menu ⋮ → Instalar app / Adicionar à tela inicial.
4. Deixar o celular conectado, notificações do Chrome/CIVOLTEN habilitadas e sem bloqueio de som no Android.
5. Novos pedidos exibem contador no sino da tela inicial, atalho Solicitações do site e aba Mais. Com o aplicativo fechado, a assinatura Web Push recebe notificações na bandeja do Android (a entrega depende de Chrome, rede, Android e política de bateria).

## Implementação
- Frontend: \`src/push-client.mjs\`, contador \`newSiteLeadCount\`, SW \`sw.js\`, manifesto \`manifest.webmanifest\`.
- Serviço: Edge Function **civolten-push**, versão inicial publicada no Supabase; VAPID mantido em \`cv_push_runtime_v1\`, não exposto ao cliente.
- Segurança: tabela \`cv_push_subscriptions_v1\` tem RLS por \`auth.uid()\`; webhook usa token aleatório armazenado no banco, enviado ao servidor pela função de trigger, sem aparecer no JavaScript do navegador. O telefone/nome do cliente não entram no texto da notificação.
- Disparo: após inserir uma nova solicitação no Supabase, gatilho \`cv_site_lead_notify_v1\` chama o servidor via \`pg_net\`. O registro de um aparelho também dispara rechecagem. Cron a cada 5 minutos corrige falhas transitórias. Registros são reivindicados com bloqueio (\`SKIP LOCKED\`), marcados como enviados após pelo menos uma resposta positiva do serviço push.
- Acompanhamento: \`cv_site_leads_v1\` com \`status='novo'\` compõe o contador. O polling a cada 30 segundos funciona apenas com aplicativo visível; não reinicializa formulário de orçamento que esteja sendo editado.
- Som: aviso curto por Web Audio enquanto o app estiver aberto, após gesto do usuário; com app fechado, o som é o padrão do Android e depende das configurações locais. Não há como forçar um toque personalizado de um PWA.
- O aplicativo não virou APK e não está na Play Store: é um PWA instalável, gratuito e atualizado pelo mesmo site.

## Verificações no servidor
- Endpoint GET da Edge Function respondeu HTTP 200, fornecendo somente chave pública.
- Endpoint de despacho autorizado respondeu HTTP 200 sem envios enquanto nenhum aparelho estava cadastrado.
- Teste final com o telefone exige a autorização de notificações e o cadastro de assinatura Push real pelo usuário; não afirmar que o aviso chegou ao Android sem esse teste.
