/** Motor de precificação CIVOLTEN. Valores BRL; cálculo monetário em centavos. */
export const PADROES = Object.freeze(['baixo','medio','alto']);
export const NOMES_PADRAO = Object.freeze({baixo:'Baixo Padrão',medio:'Médio Padrão',alto:'Alto Padrão'});
const CENTAVOS = 100;
function erro(msg){ throw new RangeError(msg); }
function numero(valor,nome,min=0,max=1e9){
  if(typeof valor!=='number'||!Number.isFinite(valor)||valor<min||valor>max)erro(`${nome} inválido`);
  return valor;
}
export const centavos = valor => Math.round(numero(valor,'Valor monetário',0,1e9)*CENTAVOS);
export const reais = valor => Number((valor/CENTAVOS).toFixed(2));
export const brl = valor => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(valor);

/** A matriz é injetada a partir do JSON local (testes) ou da tabela do banco (produção). */
export function calcularOrcamento({itens,padrao,dias_estimados_obra,distancia_km,custos_diretos=null,custos_extras_comprovados=0},matriz,parametros){
  if(!PADROES.includes(padrao))erro('Padrão desconhecido');
  if(!Array.isArray(itens)||itens.length<1||itens.length>60)erro('Informe entre 1 e 60 itens');
  const dias=numero(dias_estimados_obra,'Dias estimados',1,365);
  if(!Number.isInteger(dias))erro('Dias estimados precisam ser inteiros');
  const distancia=numero(distancia_km,'Distância em km',0,1000);
  const conf=parametros||{};
  const diasProdutivos=numero(conf.dias_produtivos_mes,'Dias produtivos mensais',1,31);
  const custosFixosMensais=numero(conf.pro_labore_mensal,'Pró-labore',0)+numero(conf.despesas_operacionais_mensais,'Despesas operacionais',0);
  const aliquota=numero(conf.imposto_sobre_valor_final,'Imposto',0,0.8);
  const taxaDiaria=numero(conf.logistica_diaria_obra_pequena,'Logística diária',0);
  const limiteMedidas=numero(conf.limiar_soma_medidas,'Limiar de medidas',0);
  const kmLimite=numero(conf.limite_distancia_km,'Limite de distância',0);
  const taxaDistancia=numero(conf.sobretaxa_distancia_sobre_servicos,'Sobretaxa de distância',0,2);
  const margemAlvo=numero(conf.margem_minima_alvo,'Margem-alvo',0,0.8);
  const detalhe=[];
  let subtotalCent=0,somaMedidas=0,temMedida=false;
  for(const [i,item] of itens.entries()){
    if(!item||typeof item!=='object')erro(`Item ${i+1} inválido`);
    const chave=item.servico_id ?? item.servico;
    if(typeof chave!=='string'||!Object.hasOwn(matriz,chave))erro(`Serviço não cadastrado: ${String(chave).slice(0,80)}`);
    const svc=matriz[chave];
    const qtd=numero(item.quantidade,'Quantidade',0.001,100000);
    if(Math.abs(Math.round(qtd*1000)-qtd*1000)>1e-7)erro('Quantidade permite até 3 casas decimais');
    if(svc.unidade==='unidade'&&!Number.isInteger(qtd))erro('Quantidade de unidade deve ser inteira');
    const unitarioCent=centavos(svc[padrao]);
    const linhaCent=Math.round(unitarioCent*qtd);
    if(!Number.isSafeInteger(linhaCent))erro('Valor da linha excedeu o limite seguro');
    subtotalCent+=linhaCent;
    if(svc.unidade==='m²'||svc.unidade==='metro'){temMedida=true;somaMedidas+=qtd;}
    detalhe.push({servico_id:chave,descricao:svc.descricao||chave,unidade:svc.unidade,quantidade:qtd,preco_unitario:reais(unitarioCent),total:reais(linhaCent)});
  }
  if(subtotalCent>9e12)erro('Orçamento muito elevado');
  // Regra comercial do solicitante: soma numericamente m² e metros.
  // Só se aplica caso haja ao menos um serviço medido, não aos serviços apenas por unidade.
  const obraPequena=temMedida && somaMedidas<limiteMedidas;
  const logisticaCent=obraPequena?centavos(taxaDiaria)*dias:0;
  const deslocamentoCent=distancia>kmLimite?Math.round(subtotalCent*taxaDistancia):0;
  // Rateio explícito dos custos fixos por dias PRODUTIVOS; não cobra os R$13 mil inteiros.
  const custoFixoAlocadoCent=Math.round((centavos(custosFixosMensais)/diasProdutivos)*dias);
  const baseTabelaCent=subtotalCent+logisticaCent+deslocamentoCent+custoFixoAlocadoCent;
  let baseTributavelCent=baseTabelaCent;
  let diagnostico={situacao:'custos_nao_informados',margem_minima_alvo:margemAlvo*100,margem_efetiva:null,ajuste_para_margem:0,
    aviso:'Sem os custos diretos reais de materiais e mão de obra não é possível garantir margem ou ausência de prejuízo.'};
  if(custos_diretos!==null){
    const custoDiretoCent=centavos(custos_diretos),custosExtrasCent=centavos(custos_extras_comprovados);
    const custosTotaisCent=custoDiretoCent+custoFixoAlocadoCent+custosExtrasCent;
    // Preço mínimo líquido para obter margem operacional sobre a receita após imposto.
    const pisoCent=Math.ceil(custosTotaisCent/(1-margemAlvo));
    baseTributavelCent=Math.max(baseTabelaCent,pisoCent);
    const margem=(baseTributavelCent-custosTotaisCent)/baseTributavelCent;
    diagnostico={situacao:'margem_validada_sobre_custos_informados',margem_minima_alvo:margemAlvo*100,margem_efetiva:Number((margem*100).toFixed(2)),ajuste_para_margem:reais(baseTributavelCent-baseTabelaCent),
      aviso:'Margem calculada apenas sobre os custos declarados; conferir BDI, tributos, riscos e escopo antes da proposta final.'};
  }
  // Imposto de 10% calculado SOBRE o total bruto (valor com imposto dentro): total=líquido/(1-0.10).
  const totalBrutoCent=Math.ceil(baseTributavelCent/(1-aliquota));
  const impostoCent=totalBrutoCent-baseTributavelCent;
  return {
    padrao,rotulo_padrao:NOMES_PADRAO[padrao],itens:detalhe,dias_estimados_obra:dias,distancia_km:distancia,
    soma_medidas_regra:Number(somaMedidas.toFixed(3)),obra_pequena:obraPequena,
    subtotal_servicos:reais(subtotalCent),taxa_logistica:reais(logisticaCent),sobretaxa_distancia:reais(deslocamentoCent),
    custos_fixos_mensais:reais(centavos(custosFixosMensais)),rateio_custos_fixos:reais(custoFixoAlocadoCent),
    ajuste_margem:reais(baseTributavelCent-baseTabelaCent),base_antes_imposto:reais(baseTributavelCent),
    imposto_aliquota:aliquota*100,imposto:reais(impostoCent),total_bruto:reais(totalBrutoCent),
    diagnostico_margem:diagnostico,
    observacoes:[
      'Estimativa orientativa sujeita à avaliação de escopo, condições de execução, custos reais e visita técnica quando necessária.',
      'Soma de áreas em m² e extensões em metros utilizada apenas como índice comercial da regra de logística, não como unidade física.',
      'Rateio de custos fixos considera os dias produtivos informados, pressupondo capacidade comercial para cobrir esse calendário.'
    ]
  };
}