# Escopo de evolução para versão de produção

Esta versão contém o ciclo básico funcional, mas não corresponde à plataforma completa solicitada para uso profissional final.

## Próximos desenvolvimentos prioritários

1. Importador nativo do formato real SIURB 2026, incluindo hierarquia de composições e insumos, códigos, versionamento, referência com e sem desoneração e coeficientes por categoria profissional, com testes confrontados com os arquivos oficiais.
2. Motor de orçamentos com preço por composição, custos de encargos, memória de cálculo e BDI auditável sem duplicidades, tratamento de reajustes, impostos, quantitativos e versões de revisão.
3. Motor de cronograma com atividades simultâneas, equipes e habilidades distintas, calendário por frente de trabalho, dependências, caminho crítico, produtividade real observada, curva S física e financeira.
4. Gerador de PDF paginado e automático no servidor, modelos comerciais, anexos, memorial, cronograma e número de revisão.
5. Envio seguro de propostas e aceite digital, histórico, notificações, contratos, medições, custos reais e acompanhamento técnico.
6. Segurança de produção: controle de acesso por papéis, recuperação de conta, trilha de auditoria, validações de domínio, HTTPS, backup/restauração e PostgreSQL.
7. Projeto build com Tailwind CSS, componentes organizados, testes E2E completos desktop/mobile e CI/CD no Bitbucket.

Não publique nem envie propostas com dados oficiais sem validar integralmente todos os campos e cálculos no ambiente definitivo.