# CIVOLTEN — integração NFS-e Nacional (MEI)

## Estado real
O aplicativo prepara e salva rascunhos de NFS-e. **Não emite notas fiscais pela API**. O certificado digital e o credenciamento do emitente ainda não foram configurados. Não tratar rascunho como nota autorizada.

## Requisitos antes da ativação
1. Confirmar CNPJ e enquadramento MEI/SIMEI, atividade/CNAE e código nacional do serviço, município de incidência e situação fiscal com contador.
2. Realizar credenciamento para API no Painel do Contribuinte da NFS-e Nacional.
3. Adquirir certificado ICP-Brasil compatível com autenticação mútua TLS e assinatura XML, observando representação/procuração quando aplicável. Nunca colocar senha, certificado, token ou chave no navegador, GitHub, localStorage ou banco público.
4. Configurar segredos somente no servidor (Vercel ou função privada), com criptografia, acesso mínimo, rotação e auditoria.
5. Validar leiautes XSD e regras de negócio da versão vigente, inclusive IBS/CBS quando aplicável.
6. Implementar serviço backend de assinatura XML DPS, autenticação mTLS, POST /nfse, consulta por chave, eventos de cancelamento/substituição, tratamento de rejeições e idempotência para evitar emissão duplicada.
7. Persistir XML autorizado, chave de acesso, protocolo/retorno, estado e trilha de auditoria em tabelas com RLS. Nunca marcar como emitida antes de confirmação oficial. Gerar DANFSe a partir do XML autorizado quando necessário (a API pública de PDF foi desativada em agosto de 2026).
8. Executar testes na **produção restrita** com certificado/credenciamento válidos, incluindo rejeição, timeout, repetição e reconciliação; somente depois habilitar produção mediante confirmação explícita.

## Referências oficiais (consultadas em 21/11/2026)
- https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/documentacao-atual
- https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao
- https://www.gov.br/nfse/pt-br/perguntas-frequentes/perguntas-frequentes-nfs-e-v1-3-20261106.pdf
- https://www.nfse.gov.br/EmissorNacional/

## Configuração futura sugerida (nomes não operacionais)
- Ambiente: homologação ou produção, nunca trocar automaticamente.
- Certificado e senha: somente em cofre de segredos server-side.
- CNPJ e município do prestador: parâmetros server-side validados.
- Chave de habilitação de emissão: desligada por padrão até homologação.

**Não confundir credencial de API com uma simples chave:** o padrão oficial exige certificado digital para emissão automatizada, inclusive MEI.
