// Auditoria determinística: valores monetários são centavos inteiros.
import {priceBudget} from './budget.mjs';
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
