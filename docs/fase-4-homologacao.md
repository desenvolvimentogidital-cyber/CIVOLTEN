# Fase 4 — homologação integrada CIVOLTEN

## Objetivo
Validar orçamento → proposta/aceite → ordem de serviço → execução → medição aprovada → recebível → baixa financeira, com fidelidade dos valores e comportamento em dispositivos móveis.

## Evidências automatizadas
- `npm test`: inclui `tests/phase4-integration.test.mjs`, com conciliação de orçamento, contrato, medição e recebível; rejeição de medição não aprovada; ausência de custos inventados.
- `npm run test:browser`: conferir execução no Chromium e cenários Android já mantidos no repositório.
- `npm run build`: confirmar compilação de produção.
- GitHub Actions + Vercel: só integrar após ambas as verificações verdes.

## Homologação manual em produção (não substituída pelos testes)
1. Entrar com conta de teste própria, sem usar dados reais de cliente.
2. Cadastrar cliente CPF e CNPJ e selecionar cada um em um orçamento.
3. Criar orçamento de mão de obra com produtividade HH, imposto e margem revisados; salvar e abrir PDF.
4. Validar capa, descrição de serviços sem valores individuais e investimento total; testar impressão A4 no Android.
5. Aceitar proposta por fluxo autorizado; confirmar criação de OS e snapshot do orçamento.
6. Iniciar obra, registrar horas, medir parcialmente, aprovar medição e gerar recebível uma única vez.
7. Conferir valor do recebível, vencimento, baixa e relatórios, sem confundir previsto com recebido.
8. Verificar atualização/recarga da tela, logout/login, separação entre contas e layout no celular.
9. Repetir com custos reais de teste e validar que o preço e o lucro não mudam retroativamente no contrato.

## Limites
Os testes automatizados não comprovam emissão de nota fiscal, pagamento bancário nem a operação com credenciais reais. A homologação final dessas integrações depende de execução com conta autorizada. Não marcar como concluído sem evidência.
