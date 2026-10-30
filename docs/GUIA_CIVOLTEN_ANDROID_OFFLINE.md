# CIVOLTEN no celular — PWA e modo offline

## Instalação pelo Android
1. Acesse https://civolten-gj91.vercel.app/secure.html no Chrome, com internet.
2. Entre com a conta e use **Instalar CIVOLTEN**, quando disponível; ou Chrome > menu de três pontos > **Adicionar à tela inicial / Instalar aplicativo**.
3. Abra o ícone CIVOLTEN. É uma instalação PWA em HTTPS, **não um APK nativo assinado**.
4. Em cada orçamento que quiser acessar sem internet, selecione **Salvar para usar offline**.
5. Em modo avião, abra o aplicativo e **Rascunhos offline**. Consulte serviços, ajuste quantidades de itens SIURB já existentes e registre anotações no dispositivo.
6. Reconnecte, faça login, abra o mesmo orçamento e selecione **Sincronizar rascunho offline**. Confirme as alterações. A API impede sobrescrever preços/quantidades modificados por outra pessoa.

## Limitações e cuidados
- Não há login, consulta ao catálogo, criação de serviços oficiais, PDF comercial ou atualização do Neon sem internet.
- Os preços unitários salvos localmente são cópias de referência e podem ficar desatualizados. Os subtotais não são valores de venda aprovados.
- As notas são locais e **não sincronizam**. Apenas quantidades de itens SIURB existentes podem ser enviadas com confirmação e autenticação.
- Não são salvos clientes, CPF, senha, cookie de sessão ou token, mas os serviços e valores locais são armazenados no IndexedDB **sem criptografia própria do aplicativo**. Use PIN/biometria e não faça isso em celular compartilhado.
- Limpar dados do navegador ou desinstalar o app pode eliminar rascunhos não sincronizados. Não use o app offline como único backup.
- O manifesto PWA e o Service Worker só guardam recursos estáticos públicos. As rotas da API são sempre online.
- A instalação física e testes em modo avião num dispositivo Android ainda precisam de homologação. A CI automatizada não substitui essa verificação.

## Testes
A suíte npm test inclui validação de rascunhos, detecção de conflito, manifesto e política de cache. O recurso não exige novas tabelas nem alterações de banco.

## Próximos passos
Suporte para catálogo SIURB versionado offline, criação de serviços locais que sincronizem e edição de medições demandam projeto específico de conflitos, integridade e segurança.
