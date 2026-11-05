/* CIVOLTEN — métricas operacionais; nunca confundir caixa com lucro. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.CIVOLTENOperationsCore=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const n=v=>{const x=Number(String(v??0).replace(',','.'));return Number.isFinite(x)?x:0};
 const money=v=>Math.round(n(v)*100)/100;
 function summary(q={},defaults={}){
  const ex=q.execution||{},entries=Array.isArray(ex.entries)?ex.entries:[];
  const costs=entries.filter(e=>e.type==='cost').reduce((sum,e)=>sum+n(e.amount),0);
  const receipts=entries.filter(e=>e.type==='receipt').reduce((sum,e)=>sum+n(e.amount),0);
  const spent=money(Math.max(0,costs)),received=money(Math.max(0,receipts));
  const price=Math.max(0,n(q.price)),plannedCost=Math.max(0,n(q.cost));
  const percent=Math.min(100,Math.max(0,n(ex.percent)));
  const taxes=Math.max(0,n(q.tax??defaults.tax)+n(q.fees??defaults.fees));
  const netContract=money(price*(1-Math.min(100,taxes)/100));
  const hasRealCosts=entries.some(e=>e.type==='cost'&&n(e.amount)>0);
  const factor=percent/100;
  // EAC = maior entre custo do realizado/avanço e custo já lançado +
  // fração orçada ainda não executada. Evita lucro projetado sem lançamentos.
  const projectedCost=hasRealCosts&&percent>0?money(
   percent===100?spent:Math.max(spent/factor,spent+plannedCost*(1-factor),plannedCost)
  ):null;
  const projectedResult=projectedCost===null?null:money(netContract-projectedCost);
  const cashBalance=money(received-spent);
  const alerts=[];
  if(spent>plannedCost+0.01&&plannedCost>0)alerts.push({level:'critical',code:'cost-overrun',message:'Custo real lançado ultrapassou o orçamento de execução.'});
  if(projectedResult!==null&&projectedResult<0)alerts.push({level:'critical',code:'projected-loss',message:'Projeção de resultado negativo com os custos lançados. Revise antes de assumir novos compromissos.'});
  if(percent>0&&percent<100&&spent>plannedCost*factor*1.15&&plannedCost>0)
   alerts.push({level:'warning',code:'spend-ahead',message:'Gasto acima da proporção de avanço da obra. Conferir produtividade e despesas.'});
  if(received>price+0.01&&price>0)alerts.push({level:'warning',code:'receipt-above',message:'Recebimentos lançados superam o preço do orçamento. Verifique aditivos ou erro de lançamento.'});
  if((q.status||'')!=='Aprovado'&&entries.length)
   alerts.push({level:'warning',code:'unapproved-operations',message:'Há lançamentos operacionais em um orçamento ainda não aprovado.'});
  if(percent>0&&!hasRealCosts)
   alerts.push({level:'warning',code:'missing-actuals',message:'Avanço registrado sem custos reais: ainda não é possível estimar resultado final.'});
  return {plannedCost:money(plannedCost),price:money(price),percent,spent,received,netContract,
   cashBalance,projectedCost,projectedResult,entryCount:entries.length,alerts};
 }
 function validEntry(entry){
  return !!entry&&['cost','receipt'].includes(entry.type)&&
   Number.isFinite(Number(entry.amount))&&Number(entry.amount)>0&&Number(entry.amount)<=1e9&&
   typeof entry.description==='string'&&entry.description.trim().length>0&&entry.description.length<=200&&
   typeof entry.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(entry.date)&&
   !Number.isNaN(new Date(entry.date+'T12:00:00Z').getTime())&&
   new Date(entry.date+'T12:00:00Z').toISOString().slice(0,10)===entry.date;
 }
 return {summary,validEntry};
});
