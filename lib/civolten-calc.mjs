// CIVOLTEN: motor de custos reais. Nunca usa referencia de tabelas de precos.
// Valores financeiros invalidos precisam gerar erro, nunca virar zero ou ser truncados.
const finite=(value,label,max=1e11)=>{
 const n=Number(value??0);
 if(!Number.isFinite(n)||n<0||n>max)throw Error(label+' inválido: revise o valor informado.');
 return n;
};
const cents=(value,label)=> {
 const n=finite(value,label);
 if(!Number.isSafeInteger(n))throw Error(label+' deve ser informado em centavos inteiros.');
 return n;
};
const safeCents=(n,label)=>{
 if(!Number.isSafeInteger(n)||n<0)throw Error(label+' excede o limite seguro para um orçamento.');
 return n;
};

export function calculateBudget(b={}){
 if(!b||typeof b!=='object'||Array.isArray(b))throw Error('Orçamento inválido');
 const days=finite(b.days,'Dias previstos',10000),p=b.pricing||{};
 if(!days)throw Error('Informe dias previstos da obra');
 const capacity=finite(p.billable_days_month,'Dias faturáveis mensais',1000);
 if(!capacity)throw Error('Configure os dias faturáveis mensais');
 const tax=finite(p.tax_pct,'Impostos',99),margin=finite(p.margin_pct,'Margem',99);
 if(tax+margin>=100)throw Error('Impostos e margem precisam somar menos de 100%');
 if(!Array.isArray(b.staff||[])||!Array.isArray(b.expenses||[]))throw Error('Itens do orçamento inválidos');

 const labor_cents=safeCents((b.staff||[]).reduce((v,x)=>{
  if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Profissional inválido');
  const charges=finite(x.charges_pct,'Encargos do profissional',200);
  return v+Math.round(cents(x.daily_cents,'Valor da diária')*finite(x.days,'Dias do profissional',10000)*(1+charges/100));
 },0),'Mão de obra');
 const variable_cents=safeCents((b.expenses||[]).reduce((v,x)=>{
  if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Despesa inválida');
  return v+Math.round(cents(x.unit_cents,'Custo unitário')*finite(x.qty,'Quantidade da despesa',100000));
 },0),'Despesas variáveis');
 const fixed_cents=safeCents(Math.round(cents(p.fixed_monthly_cents,'Custo fixo mensal')*days/capacity),'Custos fixos');
 const cost_cents=safeCents(labor_cents+variable_cents+fixed_cents,'Custo total');
 const calculated_price_cents=safeCents(Math.ceil(cost_cents/(1-(tax+margin)/100)-1e-9),'Preço sugerido');
 const manual=b.manual_price_cents;
 const price_cents=manual==null||manual===''?calculated_price_cents:cents(manual,'Preço manual');
 const tax_cents=safeCents(Math.round(price_cents*tax/100),'Impostos sobre venda');
 const profit_cents=price_cents-tax_cents-cost_cents;
 if(!Number.isSafeInteger(profit_cents))throw Error('Lucro/prejuízo excede o limite seguro.');
 return {labor_cents,variable_cents,fixed_cents,cost_cents,calculated_price_cents,price_cents,tax_cents,profit_cents,margin_pct_real:price_cents?profit_cents/price_cents*100:0};
}
