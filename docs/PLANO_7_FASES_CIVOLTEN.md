# CIVOLTEN — fechamento em sete fases (31/10/2026)

Este plano não transforma demonstrações, estimativas ou testes sintéticos em operação validada. O banco de produção é o Neon `civolten`. O Supabase antigo continua preservado e **fora** do sincronismo até aprovação explícita. Para testes, somente recursos gratuitos e PostgreSQL descartável.

## Fase 1 — Segurança e recuperação (bloqueante)
- [x] Banco Neon persistente, autenticação e controles de permissão.
- [x] Branch Neon de segurança pré-lançamento (proteção pontual; não equivale a backup externo).
- [x] Pipeline de `pg_dump`/age/`pg_restore` comprovado no banco QA descartável.
- [ ] Configurar chave pública age + URL Neon de leitura + habilitação segura no GitHub Actions; a chave privada deve ficar sob controle do titular, fora de GitHub/ChatGPT.
- [ ] Verificar execução real automática **e restaurar artefato real** em banco isolado.
- [ ] Trocar senha temporária do administrador, homologar login e papéis em dois dispositivos.
**Aceite:** backup recuperável sem alterar produção, chave sob custódia, acessos revisados e evidências registradas.

## Fase 2 — Fontes SIURB (bloqueante)
- [x] Preços oficiais: 6.988 registros; composições diretas: 6.926 fichas.
- [x] Relações diretas de horas-homem e profissões: nunca confundir hora-máquina com hora-homem.
- [x] Importar no Neon 8 fontes oficiais suplementares com SHA-256 verificável: 5.828 preços (horistas, insumos e equipamentos), 232 composições auxiliares; conferir em `siurb_supplement_sources`, `siurb_supplement_prices`, `siurb_auxiliary_compositions`.
- [x] Importar as duas tabelas oficiais mensalistas de julho/2026: 49 funções por regime, com 196 tarifas horárias com/sem encargos, fontes e hashes preservados. A união de mensalistas e horistas cobre todas as 6.317 ocorrências de funções diretas por regime, sem preencher valores aproximados.
- [x] Expor tarifas horistas e mensalistas oficiais de mão de obra direta no detalhe de composição, sem somá-las novamente ao preço integral SIURB.
- [ ] Revisar as 10 composições auxiliares com diferenças ou parcelas incompletas e reconciliar dependências/encargos e equipamentos por regime; 222 conciliadas aritmeticamente não equivalem a aprovação técnica/comercial.
- [ ] Revisar 62 serviços sem ficha direta ou bloquear cálculo de produtividade; conferir coerência de dados em cada obra.
- [ ] Conferir data-base, regime, localidade e complementos de acordo com a obra; referências de São Paulo não são automaticamente cotações locais.
**Aceite:** toda parcela deriva de fonte oficial rastreável ou de cotação válida, sem valores ausentes substituídos por zero.

## Fase 3 — Custos próprios e tributação (bloqueante)
- [x] Cadastro de salário mensal, adicionais, dias/hora pagos, tarifa por profissão, despesas fixas, margem e pró-labore.
- [ ] Cadastrar custos reais da equipe e despesas; o Neon principal não tinha trabalhadores ou tarifas na última conferência.
- [ ] Revisar encargos, benefícios, dias úteis, produtividade, valores de material/equipamento e critérios de rateio.
- [ ] Contador confirmar o tratamento de tributos de serviços e eventual venda **separada** de materiais; 6% e 4,5% são hipóteses editáveis, não fatos homologados.
- [ ] Conciliar BDI, prolabore, tributos e indiretos para evitar cobrança dupla.
**Aceite:** custos e impostos documentados pelo responsável; simulador nunca autoriza emissão sozinho.

## Fase 4 — Orçamento e duas modalidades (bloqueante)
- [x] Adição de serviços SIURB e cálculo por quantidade, custos e h-h diretas.
- [x] Seleção no fim: `mao_de_obra_e_materiais` ou `somente_mao_de_obra`.
- [x] Rascunho versionado e PDF explicitam a modalidade.
- [x] Estimativa gerencial de preço de mão de obra: custo de equipe remunerada + despesas proporcionais + pró-labore **explicitamente alocado**; margens configuradas e impostos explicitamente informados. **Resultado nunca é preço contratado nem aprovado.**
- [ ] Homologar regras comerciais, quantidades, produtividade e composição completa das duas modalidades; configurar custos faltantes.
**Aceite:** orçamento calculado sem reentrada redundante, com trilha de origem e preço comercial só após aprovação registrada.

## Fase 5 — Cronograma e execução (bloqueante)
- [x] Motor de sugestões, frentes, dependências e tarefas, histórico e medição técnica do sistema.
- [ ] Comprovar criação automática de cronograma executivo persistente a partir do orçamento com responsabilidade técnica, datas, feriados e capacidade reais.
- [ ] Conciliar medições, horas trabalhadas, custos/recebimentos realizados e replanejamento com evidências.
**Aceite:** fluxo orçamento → atividades persistentes → execução/medição sem duplicação e sem alocar trabalhador inexistente.

## Fase 6 — Proposta, contrato e aceite (bloqueante)
- [x] Rascunhos imutáveis com hash SHA-256 e PDFs A4 autenticados, marcados como NÃO EMITIDO.
- [ ] Identidade/CNPJ, assinatura do responsável, modelo de contrato e dados de cliente verificados; termos e exclusões por modalidade.
- [ ] Implementar emissão controlada, numeração, fluxo de envio/aceite e evidência auditável; só liberar com homologação tributária, contratual e de custos.
**Aceite:** valores idênticos no banco e no PDF, identidade verificada e aceite de cada versão comprovado.

## Fase 7 — Homologação comercial e liberação
- [x] CI de testes unitários, integração PostgreSQL descartável e smoke HTTP de Vercel/Neon.
- [ ] Validar login e todo o fluxo no Android e desktop, PDFs, acessibilidade e autorização por perfil.
- [ ] Exercitar mudanças concorrentes, orçamento aditivo, restauração, indisponibilidade, rollback e logs de auditoria.
- [ ] Aprovação da pessoa responsável e evidências externas completas.
**Aceite:** gates `production_ready` e `commercial_release` somente após verificações independentes, jamais por checkbox ou dados fictícios.

## Riscos conhecidos
1. Configuração do backup periódico **não ativada**: só há testes do procedimento no QA.
2. Produtividade SIURB direta **parcial**: prazo não é contratual sem revisão; 10 composições auxiliares seguem sem reconciliação aritmética.
3. Cadastro de custo-hora, itens e BDI incompleto no Neon atual.
4. Modo somente mão de obra só gera **preço indicativo**, não emissão comercial.
5. Integração dos registros legados Supabase não autorizada neste momento.

O painel administrativo em **Verificar liberação real do sistema** mostra sete fases e seus bloqueios. Nenhum status visual transforma estimativa em autorização comercial.
