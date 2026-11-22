// Auditoria determinística: valores monetários são centavos inteiros.
import {priceBudget} from './budget.mjs';
import {summary} from './calc.mjs';
export function auditBudgetFinancials(budget){
 const errors=[];
 let price;
 try{price=priceBudget(budget);}catch(err){return {ok:false,errors:[String(err.message||err)]};}
 if(!price)return {ok:false,errors:['Orçamento sem precificação válida.']};
 const integer=(v)=>Number.isSafeInteger(v)&&v>=0;
 for(const key of ['totalCost','totalSale','totalTax','profit']){
  if(!Number.isSafeInteger(price[key]))errors.push(key+' não é inteiro em centavos.');
 }
 if(!integer(price.totalSale)||!integer(price.totalCost)||!integer(price.totalTax))
  errors.push('Totais financeiros inválidos.');
 if(price.totalSale-price.totalCost-price.totalTax!==price.profit)
  errors.push('Lucro não reconcilia com venda, custos e impostos.');
 if(price.totalSale<=0)errors.push('Venda deve ser maior que zero.');
 if(price.profit<0)errors.push('Orçamento com prejuízo calculado.');
 if(!Array.isArray(price.rows)||price.rows.length===0)errors.push('Orçamento sem serviços.');
 else{
  for(const key of [['cost','totalCost'],['selling','totalSale'],['tax','totalTax']]){
   if(price.rows.some(row=>!integer(row[key[0]])))errors.push('Valor inválido em '+key[0]+'.');
   if(price.rows.reduce((sum,row)=>sum+row[key[0]],0)!==price[key[1]])
    errors.push('Soma dos serviços não reconcilia: '+key[1]+'.');
  }
  if(price.rows.reduce((sum,row)=>sum+(row.laborSelling||0)+(row.materialsSelling||0),0)!==price.totalSale)
   errors.push('Distribuição mão de obra/materiais não reconcilia.');
 }
 return {ok:errors.length===0,errors,totals:{cost:price.totalCost,sale:price.totalSale,tax:price.totalTax,profit:price.profit}};
}

export function auditWorkBilling(order,measurements=[],ledger=[]){
 const errors=[];
 if(!order?.id||!Array.isArray(order.pricedRows))return {ok:false,errors:['Ordem de serviço inválida.']};
 const orderMeasurements=measurements.filter(m=>m.workOrderId===order.id);
 const priced=new Map(order.pricedRows.map(row=>[row.id,row]));
 const sums=new Map();
 let approvedCents=0,billedCents=0;
 for(const m of orderMeasurements){
  const row=priced.get(m.itemId);
  if(!row){errors.push('Medição sem serviço contratado: '+m.id);continue;}
  const value=Math.round(Number(m.amount)*100);
  if(!Number.isSafeInteger(value)||value<0||Math.abs(Number(m.amount)*100-value)>1e-6){
   errors.push('Valor monetário inválido na medição: '+m.id);continue;
  }
  sums.set(m.itemId,(sums.get(m.itemId)||0)+value);
  if(sums.get(m.itemId)>row.selling)errors.push('Medições excedem valor contratado: '+m.itemId);
  if(m.status==='approved')approvedCents+=value;
  const entries=ledger.filter(entry=>entry.reference==='MED:'+m.id);
  if(entries.length>1)errors.push('Recebível duplicado para medição: '+m.id);
  if(entries.length){
   if(m.status!=='approved')errors.push('Recebível vinculado a medição não aprovada: '+m.id);
   for(const entry of entries){
    const cents=Math.round(Number(entry.amount)*100);
    if(!Number.isSafeInteger(cents)||cents!==value)
     errors.push('Recebível diverge da medição: '+m.id);
    billedCents+=Number.isSafeInteger(cents)?cents:0;
   }
  }
 }
 const contractCents=Math.round(Number(order.contractValue)*100);
 if(!Number.isSafeInteger(contractCents)||contractCents<0)
  errors.push('Valor do contrato inválido.');
 if(approvedCents>contractCents)errors.push('Medições aprovadas superam o contrato.');
 return {ok:errors.length===0,errors,totals:{contract:contractCents,approved:approvedCents,billed:billedCents,pending:approvedCents-billedCents}};
}

export function auditMonthlyCosts(data){
 const cost=summary(data);
 const errors=[];
 for(const key of ['fixed','variable','team','total'])
  if(!Number.isSafeInteger(cost[key])||cost[key]<0)errors.push('Custo mensal inválido: '+key);
 if(cost.fixed+cost.variable+cost.team!==cost.total)
  errors.push('Total mensal não reconcilia com custos fixos, variáveis e equipe.');
 if(!cost.readyForPricing)errors.push('Há custos inválidos que bloqueiam a precificação.');
 return {ok:errors.length===0,errors,totals:{fixed:cost.fixed,variable:cost.variable,team:cost.team,monthly:cost.total},missing:cost.missing,blocking:cost.blocking};
}
