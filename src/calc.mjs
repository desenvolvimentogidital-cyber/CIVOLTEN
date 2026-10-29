/** Cálculos monetários e de produtividade em unidades explícitas.
 * h-h/un = soma dos coeficientes de cada categoria profissional na composição.
 * A eficiência e a equipe afetam o prazo, não reduzem as horas-homem necessárias.
 */
export const money = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const numeric = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
export function computeBudget(items, budget = {}) {
  const rows = items.map(item => {
    const qty = Math.max(0, numeric(item.qty));
    const unitCost = Math.max(0, numeric(item.unit_cost));
    const hhUnit = Math.max(0, numeric(item.hh_unit));
    return {...item, qty, unit_cost: unitCost, hh_unit: hhUnit,
      subtotal: money(qty * unitCost), laborHours: Math.round(qty * hhUnit * 100)/100};
  });
  const cost = money(rows.reduce((s, i) => s + i.subtotal, 0));
  const bdi = Math.max(0, numeric(budget.bdi, 0));
  const bdiValue = money(cost * bdi / 100);
  const total = money(cost + bdiValue);
  const laborHours = Math.round(rows.reduce((s, i) => s + i.laborHours, 0)*100)/100;
  return {rows, cost, bdi, bdiValue, total, laborHours};
}

function addWorkingDays(date, numDays, workDays=5) {
  const dt = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(dt.valueOf())) return date;
  let left = Math.max(0, Math.round(numDays));
  // A jornada é de segunda a sexta (5) ou segunda a sábado (6).
  while (left > 0) {
    const wd = dt.getUTCDay();
    if (wd!==0 && (workDays === 6 || wd !== 6)) left--;
    if(left>0) dt.setUTCDate(dt.getUTCDate()+1);
  }
  return dt.toISOString().slice(0,10);
}
export function calculatePlan(items, budget={}) {
  const budgetSummary = computeBudget(items,budget);
  const workers = Math.max(1,Math.min(1000,numeric(budget.workers,2)));
  const hoursDay = Math.max(1,Math.min(24,numeric(budget.hours_day,8)));
  const efficiency = Math.max(.1,Math.min(1,numeric(budget.efficiency,0.8)));
  const safetyPct = Math.max(0,Math.min(100,numeric(budget.safety_pct,15)));
  const workDays = numeric(budget.work_days_week,5)===6?6:5;
  const capacityDay = workers*hoursDay*efficiency;
  const segments = budgetSummary.rows.map((item,idx)=>{
    const durationDays = Math.max(1,Math.ceil(item.laborHours / capacityDay));
    // Sequenciamento conservador e seguro; ajustes de precedência são manuais
    // até a validação das equipes e atividades simultâneas.
    return {id:item.id,name:item.description,code:item.code,unit:item.unit,qty:item.qty,
      hours:item.laborHours,cost:item.subtotal,durationDays,step:idx+1};
  });
  const baseDays=segments.reduce((s,x)=>s+x.durationDays,0);
  const safetyDays=Math.ceil(baseDays*safetyPct/100);
  const totalDays=baseDays+safetyDays;
  const start=budget.start_date||new Date().toISOString().slice(0,10);
  let offset=0;
  const tasks=segments.map(x=>{
    const begin=addWorkingDays(start, offset+1,workDays);
    const end=addWorkingDays(start,offset+x.durationDays,workDays);
    offset+=x.durationDays;
    return {...x,start:begin,end};
  });
  return {tasks,baseDays,safetyDays,totalDays,start,finish:totalDays?addWorkingDays(start,totalDays,workDays):start, capacityDay,
    workDays, workers,hoursDay,efficiency,safetyPct, summary:budgetSummary, methodology:'Sequencial conservador. Antes da contratação, valide equipe por profissão, restrições e atividades paralelas.'};
}