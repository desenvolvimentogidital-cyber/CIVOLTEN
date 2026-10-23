// Indicadores financeiros: proposta ≠ dinheiro recebido.
// Apenas movimentacoes de caixa registradas manualmente representam fluxo realizado.
const cents=(v,label)=>{const n=Number(v??0);if(!Number.isSafeInteger(n)||n<0)throw Error(label+' inválido');return n};
export function budgetFinancials(row){
 if(!row||typeof row!=='object')throw Error('Orçamento inválido');
 const cost_cents=cents(row.cost_cents,'Custo'),price_cents=cents(row.price_cents,'Preço');
 const tax=Number(row.content?.pricing?.tax_pct??0);
 if(!Number.isFinite(tax)||tax<0||tax>99)throw Error('Alíquota inválida no orçamento');
 const tax_cents=Math.round(price_cents*tax/100);
 const profit_cents=price_cents-cost_cents-tax_cents;
 if(!Number.isSafeInteger(profit_cents))throw Error('Resultado inválido');
 return {...row,cost_cents,price_cents,tax_cents,profit_cents,
  margin_pct:price_cents?100*profit_cents/price_cents:0};
}
export function financeOverview(budgets=[],cash=[]){
 if(!Array.isArray(budgets)||!Array.isArray(cash))throw Error('Dados financeiros inválidos');
 const all=budgets.map(budgetFinancials),accepted=all.filter(b=>b.status==='aprovado');
 const sum=(rows,key)=>rows.reduce((t,row)=>t+row[key],0);
 const approved={count:accepted.length,price_cents:sum(accepted,'price_cents'),cost_cents:sum(accepted,'cost_cents'),
 tax_cents:sum(accepted,'tax_cents'),profit_cents:sum(accepted,'profit_cents')};
 const open=all.filter(b=>b.status==='enviado');
 const drafts=all.filter(b=>b.status==='rascunho');
 const pipeline={open_count:open.length,open_cents:sum(open,'price_cents'),
  closed_count:accepted.length,closed_cents:approved.price_cents,
  draft_count:drafts.length,draft_cents:sum(drafts,'price_cents')};
 const cashTotals={income_cents:0,expense_cents:0,balance_cents:0,count:cash.length};
 for(const row of cash){
  const amount=cents(row.amount_cents,'Movimentação');
  if(row.kind==='entrada')cashTotals.income_cents+=amount;
  else if(row.kind==='saida')cashTotals.expense_cents+=amount;
  else throw Error('Tipo de movimentação inválido');
 }
 cashTotals.balance_cents=cashTotals.income_cents-cashTotals.expense_cents;
 if(![...Object.values(approved),...Object.values(cashTotals)].every(Number.isSafeInteger))throw Error('Soma financeira excede limite');
 return {all,approved,pipeline,cash:cashTotals,byStatus:{
  rascunho:all.filter(b=>b.status==='rascunho').length,
  enviado:all.filter(b=>b.status==='enviado').length,
  aprovado:accepted.length,
  recusado:all.filter(b=>b.status==='recusado').length
 }};
}
export function financeMonths(budgets=[],cash=[],now=new Date()){
 const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-5,1));
 const arr=Array.from({length:6},(_,i)=>{
  const date=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i,1));
  const key=date.toISOString().slice(0,7);
  return {key,label:date.toLocaleDateString('pt-BR',{month:'short',year:'2-digit',timeZone:'UTC'}),
   price_cents:0,cost_cents:0,profit_cents:0,income_cents:0,expense_cents:0};
 });
 const byKey=new Map(arr.map(x=>[x.key,x]));
 for(const b of budgets){
  if(b.status!=='aprovado')continue;
  const t=String(b.created_at??'').slice(0,7),month=byKey.get(t);
  if(!month)continue;
  const x=budgetFinancials(b);
  month.price_cents+=x.price_cents;month.cost_cents+=x.cost_cents;month.profit_cents+=x.profit_cents;
 }
 for(const x of cash){
  const t=String(x.occurred_on??'').slice(0,7),month=byKey.get(t);
  if(!month)continue;
  if(x.kind==='entrada')month.income_cents+=cents(x.amount_cents,'Movimentação');
  else if(x.kind==='saida')month.expense_cents+=cents(x.amount_cents,'Movimentação');
 }
 return arr;
}
