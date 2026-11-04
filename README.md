# CIVOLTEN — Orçamentos Premium (PWA)

Protótipo navegável mobile-first da CIVOLTEN — Elétrica & Construção Civil, com identidade visual grafite e dourado.

## Visualização
O aplicativo está em `index.html`. Abra a página publicada na Vercel pelo celular para ver o layout. O projeto utiliza HTML, CSS e JavaScript incorporados, sem etapa de build.

## Publicar na Vercel
1. Em [vercel.com/new](https://vercel.com/new), importe este repositório GitHub.
2. Framework Preset: **Other**.
3. Root Directory: **./**.
4. Build Command: **deixe em branco**.
5. Output Directory: **deixe em branco** (arquivos estáticos na raiz).
6. Clique em **Deploy**.

O site deve abrir na rota `/`. Em HTTPS, o manifesto e o service worker permitem instalação compatível com o navegador/dispositivo.

## Telas
Abertura, início, orçamentos, cadastro e detalhes de propostas, itens e cálculo, clientes, profissionais, materiais, serviços, despesas, financeiro, relatórios e configurações.

## Estado atual
**Protótipo de demonstração, não é um sistema pronto para produção.** Dados de demonstração são armazenados no navegador (`localStorage`); não há autenticação, banco de dados remoto, sincronização entre dispositivos ou emissão fiscal oficial. Os valores tributários e financeiros exigem validação antes do uso comercial.

## Identidade visual
A marca CIVOLTEN utiliza os arquivos da empresa enviados para a construção do protótipo. `assets/civolten-logo.png` e `icons/civolten-simbolo.png` preservam as artes incorporadas ao HTML.

Projeto preparado para revisão visual e posterior evolução funcional.