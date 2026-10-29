/**
 * CIVOLTEN — Motor de estimativa auditável (não conectado a emissão contratual).
 * Valores monetários calculados com BigInt, evitando erros cumulativos de float.
 * BDI: [(1+AC+S+G+R)(1+DF)(1+L)/(1-I)]-1.
 * Percentuais são parametrizados por orçamento, sem alíquotas presumidas.
 */
const invalid=(m)=>{throw new RangeError(m)};
function scaled(value,precision,name){
  if(value===null||value===undefined||value==='')invalid(name+' não preenchido');
  let txt=String(value).trim();
  if(txt.includes(',')&&txt.includes('.'))txt=txt.replace(/\./g,'').replace(',','.');
  else txt=txt.replace(',','.');
  if(!/^\d+(?:\.\d+)?$/.test(txt))invalid(name+' inválido');
  const parts=txt.split('.');
  if((parts[1]||'').length>precision)invalid(name+' possui casas decimais demais');
  const scalar=10n**BigInt(precision);
  const int=BigInt(parts[0]);
  if(int>10n**13n)invalid(name+' excede limite seguro');
  return int*scalar+BigInt((parts[1]||'').padEnd(precision,'0')||'0');
}
const roundDiv=(num,den)=>(num+den/2n)/den;
const toNumber=value=>{if(value>BigInt(Number.MAX_SAFE_INTEGER))invalid('Total acima do limite seguro');return Number(value)};
const reais=cents=>toNumber(cents)/100;
const parseRate=(val,name)=>{const a=scaled(val,2,name);if(a>10000n)invalid(name+' não pode ultrapassar 100%');return a};
const knownCostFields=['administracaoCentral','seguro','garantia','risco','despesasFinanceiras','lucro','tributosSobreReceita'];
function auditText(report,code,message,critical=false){
  (critical?report.errors:report.warnings).push({code,message});
}
/** Recebe preço unitário em R$ com até 4 casas e quantidade com até 6.
    Risco em BDI e contingência não são confundidos com margem de cronograma. */
export function estimateBudget(input){
 const errors=[],warnings=[],report={errors,warnings};
 const lines=[],items=Array.isArray(input?.items)?input.items:[];
 let direct=0n;
 if(items.length===0)auditText(report,'NO_ITEMS','Orçamento sem serviços.',true);
 const reference=String(input?.reference_month||''),regime=String(input?.regime||'');
 items.forEach((entry,i)=>{
  const id=String(entry.code||'SEM-CODIGO'),src=String(entry.source||'MANUAL');
  let cost=0n;
  try{
   const quantity=scaled(entry.quantity,6,'Quantidade do item '+(i+1));
   const unitCost=scaled(entry.unit_cost,4,'Preço unitário do item '+(i+1));
   if(quantity<=0n||unitCost<=0n)invalid('Quantidade e custo unitário devem ser positivos');
   cost=roundDiv(quantity*unitCost,100000000n);
   direct+=cost;
  }catch(error){auditText(report,'INVALID_ITEM','Item '+(i+1)+' ('+id+'): '+error.message,true)}
  if(!entry.unit||!String(entry.description||'').trim())auditText(report,'SCOPE','Item '+(i+1)+' sem descrição ou unidade.',true);
  if(src==='SIURB'){
   if(!reference||!regime||entry.reference_month!==reference||entry.regime!==regime)
     auditText(report,'REFERENCE_MISMATCH','Item '+id+' com data-base ou regime divergente.',true);
   if(!entry.composition_reviewed)auditText(report,'UNREVIEWED_COMPOSITION','Composição SIURB '+id+' exige revisão de insumos e coeficientes.');
  }else{
   if(!entry.supplier_quote_verified)auditText(report,'UNQUOTED','Serviço '+id+' sem cotação local validada.');
  }
  if(!entry.quantity_verified)auditText(report,'MEASUREMENTS','Quantitativo do serviço '+id+' precisa de medição validada.');
  lines.push({code:id,description:String(entry.description||''),unit:String(entry.unit||''),cost_cents:toNumber(cost),cost_reais:reais(cost),source:src});
 });
 const extra=[];
 for(const a of (input?.extra_direct_costs||[])){
   const label=String(a.description||'Ajuste direto');
   try{
    const value=scaled(a.amount,2,'Custo adicional '+label);
    extra.push({description:label,value_cents:toNumber(value)});
    direct+=value;
   }catch(error){auditText(report,'DIRECT_ADDON',error.message,true)}
   if(a.included_in_unit_prices)auditText(report,'DUPLICATION','O adicional '+label+' pode estar duplicado no custo unitário.',true);
 }
 const rate={},rawRates=input?.bdi||{};
 for(const name of knownCostFields){
   try{rate[name]=parseRate(rawRates[name],name)}
   catch(err){auditText(report,'BDI_INPUT',err.message,true);rate[name]=0n}
 }
 const first=10000n+rate.administracaoCentral+rate.seguro+rate.garantia+rate.risco;
 const divisor=10000n-rate.tributosSobreReceita;
 if(divisor<=0n)auditText(report,'BDI_TAX','Tributos deixam denominador do BDI inválido.',true);
 let sell=0n,bdiAmount=0n,contingency=0n;
 if(divisor>0n){
   const numerator=first*(10000n+rate.despesasFinanceiras)*(10000n+rate.lucro);
   sell=roundDiv(direct*numerator,10000n*10000n*divisor);
   bdiAmount=sell-direct;
 }
 try{const pct=parseRate(input?.contingency_pct??0,'contingência');
   contingency=roundDiv(direct*pct,10000n);
   if(pct>0n&&rate.risco>0n)auditText(report,'RISK_DUPLICATION','Há risco no BDI e contingência extra; confira se tratam eventos diferentes.');
 }catch(err){auditText(report,'CONTINGENCY',err.message,true)}
 const total=sell+contingency;
 if(!input?.bdi_reviewed)auditText(report,'BDI_NOT_REVIEWED','BDI precisa ser aprovado com base tributária e tipo de obra.',true);
 if(!input?.technical_reviewed)auditText(report,'TECHNICAL_REVIEW','Quantidades, composição e produtividade aguardam responsável técnico.',true);
 if(!input?.commercial_reviewed)auditText(report,'COMMERCIAL_REVIEW','Premissas contratuais, cotações e margem aguardam revisão comercial.',true);
 // Exposição indicativa: preço de venda fixo, custo direto maior, sem assumir custo tributário específico.
 const scenarios=[5,10,15].map(pct=>{
   const stressed=roundDiv(direct*(100n+BigInt(pct)),100n);
   const contribution=total-stressed;
   return {cost_increase_pct:pct,estimated_direct_cost_reais:reais(stressed),
      contribution_reais:contribution>=0n?reais(contribution):-reais(-contribution),
      below_direct_cost:contribution<0n};
 });
 return {
   source_model:'TCU-BDI-parametrizado-revisao-obrigatoria',
   reference_month:reference,regime,
   lines,extra,errors,warnings,ready:errors.length===0,
   direct_cost_reais:reais(direct),bdi_amount_reais:reais(bdiAmount),
   contingency_reais:reais(contingency),total_reais:reais(total),
   bdi_effective_pct:direct?Number(roundDiv(bdiAmount*100000n,direct))/1000:0,
   scenarios,review_required:true,
   caveat:'Estimativa preliminar. Não substitui avaliação tributária, técnica, cotação local ou revisão de escopo.'
 };
}
