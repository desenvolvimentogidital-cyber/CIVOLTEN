// CIVOLTEN: motor de custos reais. Nunca usa referência de tabelas de preços.
const positive=(v,max=1e11)=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(n,max)):0};
export function calculateBudget(b={}){
 const days=positive(b.days,10000),p=b.pricing||{};
 if(!days)throw Error('Informe dias previstos da obra');
 const capacity=Number(p.billable_days_month),tax=positive(p.tax_pct,99),margin=positive(p.margin_pct,99);
 if(!(capacity>0))throw Error('Configure os dias faturáveis mensais');
 if(tax+margin>=100)throw Error('Impostos e margem precisam somar menos de 100%');
 const labor_cents=(b.staff||[]).reduce((v,x)=>v+Math.round(positive(x.daily_cents)*positive(x.days,10000)*(1+positive(x.charges_pct,200)/100)),0);
 const variable_cents=(b.expenses||[]).reduce((v,x)=>v+Math.round(positive(x.unit_cents)*positive(x.qty,100000)),0);
 const fixed_cents=Math.round(positive(p.fixed_monthly_cents)*days/capacity);
 const cost_cents=labor_cents+variable_cents+fixed_cents;
 const calculated_price_cents=Math.ceil(cost_cents/(1-(tax+margin)/100)-1e-9);
 const manual=b.manual_price_cents;
 const price_cents=manual==null||manual===''?calculated_price_cents:Math.round(positive(manual));
 const tax_cents=Math.round(price_cents*tax/100),profit_cents=price_cents-tax_cents-cost_cents;
 return {labor_cents,variable_cents,fixed_cents,cost_cents,calculated_price_cents,price_cents,tax_cents,profit_cents,margin_pct_real:price_cents?profit_cents/price_cents*100:0};
}
