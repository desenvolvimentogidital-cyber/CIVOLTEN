# CIVOLTEN — Orçamentos PWA (modo de trabalho)

Aplicativo mobile-first com identidade premium da CIVOLTEN para orçamentos de elétrica e construção civil.

## Publicação na Vercel

Arquivos estáticos na raiz do repositório. Em Vercel, selecione Framework Preset **Other**, Root Directory **./**, sem comandos de build. GitHub `main` publica por integração com a Vercel.

## Funcionalidades existentes nesta etapa

- **Sem login de usuário:** abre diretamente no painel; não há tela de registro ou senha.
- Clientes cadastráveis na proposta; profissionais, serviços, materiais e despesas.
- Orçamentos de mão de obra, completo e misto, itens personalizados e por fornecimento de material.
- Custos, despesas indiretas, imprevistos, taxas, impostos proporcionais, margem sobre a receita, desconto e preço manual.
- Salvar propostas e rascunhos; editar com histórico de revisão, duplicar, acompanhar status e imprimir proposta para PDF.
- Exportar backup JSON e importar com confirmação; planilha CSV de orçamentos; PWA com manifesto e cache offline.

## Importante: armazenamento e segurança

**Esta fase ainda não tem backend nem autenticação.** Os dados são salvos no `localStorage` do navegador no aparelho utilizado. **Eles não são sincronizados nem recuperáveis automaticamente** em caso de perda, troca de dispositivo, limpeza de cache/dados ou falha do armazenamento. Use **Mais → Backup e segurança → Fazer backup completo** e guarde o JSON em lugar seguro; faça backups frequentes.

A aplicação hospedada é publicamente acessível, mas cada visitante vê apenas os dados locais do próprio navegador. Não use em aparelhos compartilhados e não confie nesse modo local para informações empresariais sensíveis. Para uso seguro em múltiplos dispositivos e recuperação confiável, a próxima etapa exigirá banco de dados, controle de acesso e backups automáticos. Login/cadastro de usuário continuam desligados por solicitação.

Os valores de impostos são parâmetros comerciais configuráveis, não substituem orientação contábil. A proposta comercial não é nota fiscal. O PDF é obtido pela impressão do navegador. As funções foram verificadas por testes de lógica e sintaxe; testes visuais em dispositivo real ainda são necessários.
