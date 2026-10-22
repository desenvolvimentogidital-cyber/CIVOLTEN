// Capacidade mensal da empresa: despesas operacionais + folha mensal registrada.
// Funcionarios pagos por obra NAO entram no custo fixo mensal.
const cents=(value,name)=>{
 const n=Number(value??0);
 if(!Number.isSafeInteger(n)||n<0)throw Error(name+' inválido');
 return n;
};
export function payrollSummary(workers=[]){
 if(!Array.isArray(workers))throw Error('Lista de funcionários inválida');
 let monthly_cents=0,monthly_count=0,project_count=0;
 for(const x of workers){
  if(!x||typeof x!=='object')throw Error('Funcionário inválido');
  if(!x.active)continue;
  const mode=x.cost_mode??'monthly';
  if(mode==='project'){project_count++;continue}
  if(mode!=='monthly')throw Error('Modalidade de contratação inválida');
  const days=Number(x.days_month??22),charges=Number(x.charges_pct??0);
  if(!Number.isFinite(days)||days<=0||days>31)throw Error('Dias mensais do funcionário inválidos');
  if(!Number.isFinite(charges)||charges<0||charges>200)throw Error('Encargos do funcionário inválidos');
  const amount=Math.round(cents(x.daily_cents,'Diária do funcionário')*days*(1+charges/100));
  monthly_cents+=amount;
  if(!Number.isSafeInteger(monthly_cents))throw Error('Folha mensal excede o limite seguro');
  monthly_count++;
 }
 return {monthly_cents,monthly_count,project_count};
}
export function companyRates(fixedEntries=[],settings={},workers=[]){
 if(!Array.isArray(fixedEntries))throw Error('Lista de despesas fixas inválida');
 const billable=Number(settings.billable_days_month??22),hours=Number(settings.hours_day??8);
 if(!Number.isFinite(billable)||billable<=0||billable>1000)throw Error('Dias faturáveis devem ser maiores que zero');
 if(!Number.isFinite(hours)||hours<=0||hours>24)throw Error('Horas por dia devem estar entre 0 e 24');
 const fixed_expenses_cents=fixedEntries.reduce((sum,x)=>{
  if(!x||typeof x!=='object')throw Error('Despesa fixa inválida');
  const amount=cents(x.monthly_cents,'Custo mensal');
  const next=sum+(x.active?amount:0);
  if(!Number.isSafeInteger(next))throw Error('Soma de custos fixos muito grande');
  return next;
 },0);
 const payroll=payrollSummary(workers);
 const monthly_cents=fixed_expenses_cents+payroll.monthly_cents;
 if(!Number.isSafeInteger(monthly_cents))throw Error('Total fixo mensal excede o limite seguro');
 const daily_cents=Math.round(monthly_cents/billable);
 const hourly_cents=Math.round(monthly_cents/(billable*hours));
 return {monthly_cents,fixed_expenses_cents,payroll_cents:payroll.monthly_cents,
  monthly_workers:payroll.monthly_count,project_workers:payroll.project_count,
  daily_cents,hourly_cents,billable_days_month:billable,hours_day:hours};
}
