# NFS-e Nacional — preparação da emissão automática

Fonte oficial: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual
APIs oficiais: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao

## Estado atual
O CIVOLTEN tem formulário, validação e rascunhos na nuvem. O adaptador Node de servidor implementa o empacotamento da DPS XML assinada em GZip/Base64, transporte HTTPS com certificado cliente e seleção restrita de domínios SEFIN. A função de transmissão **não está conectada a uma ação pública de emissão**: é intencional até que haja certificado e homologação fiscal. Não existe emissão simulada marcada como nota real.

## Configuração futura — apenas variáveis de ambiente protegidas do servidor
- `NFSE_CERT_PFX_BASE64`: certificado A1 PKCS#12 em base64, **nunca no repositório ou no navegador**
- `NFSE_CERT_PASSPHRASE`: senha do certificado
- `NFSE_ISSUER_CNPJ`: CNPJ titular do certificado / contribuinte autorizado
- `NFSE_ENVIRONMENT`: `homologation` inicialmente; `production` somente após homologação
- `NFSE_TRANSMISSION_ENABLED`: `false` até testes e autorização

`GET /api/nfse/status` retorna apenas estado operacional, sem dados secretos.

## Ainda pendente (não é só inserir o certificado)
1. Confirmar credenciamento do contribuinte, município, regime, códigos de tributação e parâmetros municipais.
2. Gerar XML DPS conforme XSD e regras oficiais vigentes (incluindo IBS/CBS quando aplicável), validar e assinar XMLDSig com certificado autorizado.
3. Conectar endpoint autenticado por sessão e com autorização de proprietário, idempotência, auditoria e proteção contra emissão duplicada.
4. Homologar envio e consulta na produção restrita, armazenar XML e chave oficial, obter DANFSe e tratar rejeição/cancelamento/substituição.
5. Liberar produção somente depois da homologação com certificado real. **Sem certificado, os testes locais são apenas de contrato e segurança; não comprovam emissão fiscal.**

Nunca publicar certificado, senha, token ou XML fiscal em logs ou código frontend.
