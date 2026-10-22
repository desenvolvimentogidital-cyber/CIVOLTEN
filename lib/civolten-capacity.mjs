// Custo de estrutura: equipe alocada na obra e materiais permanecem separados.
// Taxas sao apenas custo fixo de capacidade, nao preco de venda por si so.
export function companyRates(fixedEntries=[],settings={}){
 if(!Array.isArray(fixedEntries))throw Error('Lista de despesas fixas inválida');
 const billable=Number(settings.billable_days_month??22);
 const hours=Number(settings.hours_day??8);
 if(!Number.isFinite(billable)||billable<=0||billable>1000)throw Error('Dias faturáveis devem ser maiores que zero');
 if(!Number.isFinite(hours)||hours<=0||hours>24)throw Error('Horas por dia devem estar entre 0 e 24');
 const monthly_cents=fixedEntries.reduce((sum,x)=>{
  if(!x||typeof x!=='object')throw Error('Despesa fixa inválida');
  const amount=Number(x.monthly_cents);
  if(!Number.isSafeInteger(amount)||amount<0)throw Error('Custo mensal inválido');
  const next=sum+(x.active?amount:0);
  if(!Number.isSafeInteger(next))throw Error('Soma de custos fixos muito grande');
  return next;
 },0);
 const daily_cents=Math.round(monthly_cents/billable);
 const hourly_cents=Math.round(monthly_cents/(billable*hours));
 return {monthly_cents,daily_cents,hourly_cents,billable_days_month:billable,hours_day:hours};
}
