# CIVOLTEN — implantação de aparência e estabilidade

## Configuração no celular
1. Entre em https://civolten.vercel.app → Área da empresa → Entrar.
2. Clique em **Personalizar site e logo**. O painel é restrito a administradores.
3. Envie a logo oficial PNG ou JPEG, escolha **largura entre 60 e 320 px**, ajuste as cores, título, descrição, rodapé e WhatsApp comercial.
4. Confira a imagem na prévia e pressione **Salvar personalização do site e PDFs**.
5. Atualize a página pública, abra a página da proposta e gere PDF de teste.

A imagem enviada é a **única marca visual** no cabeçalho do site, no rodapé, na página de propostas e nos PDFs. Não existe título de marca ou símbolo de raio de substituição. **Sem arquivo de logo, o espaço visual de marca permanece vazio**. O nome administrativo continua existindo apenas no cadastro.

A página de propostas agora utiliza um CSS externo, compatível com a política CSP, e o formulário aponta para privacidade.html.

A lista de serviços SIURB e o catálogo antigo permanecem intactos. O seletor reutiliza a estrutura das opções e as ordena alfabeticamente por EDIF/INFRA para evitar reconstrução desnecessária a cada item.

## Dependências e limites de homologação
- O banco requer a migração aditiva 20261017_branding_site_pro.sql.
- O Edge Function civolten-beta deve ser publicado com index.ts, quote-extra.ts e demais arquivos da função após a migração.
- npm test inclui verificações de identidade, PDF, segurança e seleção dos serviços.
- O upload no navegador otimiza imagens PNG/JPG de até 8 MB para caber no limite seguro de armazenamento (até ~200 KB em base64 compactado).
- A identidade oficial só é aplicada quando o administrador faz upload de uma imagem autorizada.

### Verificações que dependem de acesso humano/infraestrutura
- Fazer um pedido de teste completo no smartphone e emitir uma proposta, abrir link anônimo, aprovar/rejeitar e confirmar histórico e PDF.
- **Proteção contra senhas vazadas**: está desativada no painel Supabase Auth; habilitar conforme plano e verificar alerta de segurança. Não é uma configuração alterável via migração SQL do banco de usuários.
- **Backup e recuperação**: exportação JSON administrativa é manual e parcial acima de 1.000 registros; não constitui rotina automatizada, cópia externa nem restauração testada. Configurar backup adequado ao plano do Supabase e testar restauração em ambiente isolado, jamais apagando produção.
- **LGPD**: a base registra prazo de retenção de 90 dias; ainda é preciso definir e executar rotina adequada à política jurídica, incluindo arquivos no Storage. Aviso de privacidade é um modelo técnico e precisa de revisão legal e dos contatos completos da empresa.
- **Hospedagem comercial**: confirmar permissões/limites do plano Vercel.
