/* CIVOLTEN – resumo das profissões e estimativa GERENCIAL de custos.
 * Pessoas simultâneas somam necessidades; em sequência, é o pico de cada profissão.
 * Prazo com serviços em paralelo = maior duração; sequencial = soma.
 * Custo de pessoal = equipe estimada x dias estimados x horas/dia x custo-hora.
 * Não soma automaticamente sobre preço SIURB para evitar cobrança dupla.
 */
const money=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const round=(n,p=2)=>Number(n.toFixed(p));
export function summarizeWorkforce(model,{rates=[],workers=[],overhead=null}={}){
 const items=(model.services||[]).filter(s=>s.workers!==null);
 const all=model.services||[],group=new Map();
 const named=(r)=>String(r.code||r.name||'').trim();
 for(const item of items){
  for(const r of item.roles||[]){
   const key=named(r);if(!key)continue;
   const row=group.get(key)||{code:key,name:r.name,parallel_workers:0,sequential_workers:0,estimated_hh:0,worker_days:0};
   row.parallel_workers+=Number(r.workers)||0;
   row.sequential_workers=Math.max(row.sequential_workers,Number(r.workers)||0);
   row.estimated_hh+=Number(r.projected_hh)||0;
   row.worker_days+=(Number(r.workers)||0)*(Number(item.days_at_suggested_staff)||0);
   group.set(key,row);
  }
 }
 const noRoles=items.filter(i=>!i.roles?.length);
 const roles=[...group.values()].map(r=>({...r,estimated_hh:round(r.estimated_hh,3),worker_days:round(r.worker_days,2)}))
  .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const parallelDays=items.length?Math.max(...items.map(x=>Number(x.days_at_suggested_staff)||0)):0;
 const sequentialDays=items.reduce((s,x)=>s+(Number(x.days_at_suggested_staff)||0),0);
 const cfg=model.settings||{};
 const days=Number(cfg.target_days)||10,hrs=Number(cfg.hours_day)||8;
 const costMap=new Map((rates||[]).map(x=>[String(x.role_code),Number(x.hourly_employer_cost)]));
 const active=(workers||[]).filter(x=>x.active===true);
 const roster=new Map();
 for(const w of active){const key=String(w.role_code),row=roster.get(key)||{count:0,total:0};
  row.count++;row.total+=Number(w.monthly_employer_cost)||0;roster.set(key,row)}
 const workingDays=Number(overhead?.workdays_per_month)||22,monthlyOverhead=overhead?Number(overhead.monthly_overhead):null;
 const roleCosts=roles.map(r=>{
  let rate=costMap.get(r.code),source='valor_configurado';
  if(rate===undefined){
   const local=roster.get(r.code);
   if(local?.count){rate=money(local.total/local.count/workingDays/hrs);source='media_do_cadastro'}
   else{rate=null;source='nao_configurado'}
  }
  return {...r,active_registered:roster.get(r.code)?.count||0,
    hourly_cost:rate,cost_source:source,
    estimated_cost:rate===null?null:money(r.worker_days*hrs*rate)};
 });
 const unclassified=noRoles.length;
 const laborKnown=roleCosts.length>0&&roleCosts.every(x=>x.estimated_cost!==null)&&unclassified===0&&all.length===items.length;
 const laborCost=roleCosts.reduce((s,r)=>s+(r.estimated_cost||0),0);
 const overheadParallel=monthlyOverhead===null?null:money(monthlyOverhead*parallelDays/workingDays);
 const overheadSequential=monthlyOverhead===null?null:money(monthlyOverhead*sequentialDays/workingDays);
 const canTotal=laborKnown&&overhead!==null;
 const costs={
  labor_estimated:laborKnown?money(laborCost):null,
  overhead_parallel:overheadParallel,
  overhead_sequential:overheadSequential,
  total_parallel:canTotal?money(laborCost+overheadParallel):null,
  total_sequential:canTotal?money(laborCost+overheadSequential):null,
  missing_rates:roleCosts.filter(r=>r.hourly_cost===null).map(r=>r.name),
  unclassified_services:unclassified,
  available:canTotal,
  currency:'BRL',note:'Estimativa interna de desembolso de pessoal e rateio da empresa; não é preço de venda nem parcela automaticamente adicionada ao SIURB. Valores requerem conferência contábil e operacional.'};
 return {
  roles:roleCosts,
  duration:{parallel_workdays:parallelDays,sequential_workdays:sequentialDays,
    complete:all.length>0&&all.length===items.length,
    mode:'cenarios_sem_dependencias',note:'Prazo hipotético: serviços simultâneos usam a maior duração; serviços sequenciais somam durações. O caminho crítico real depende da ordem e de dependências.'},
  role_totals:{
   parallel_workers:roleCosts.reduce((s,r)=>s+r.parallel_workers,0),
   sequential_workers:roleCosts.reduce((s,r)=>s+r.sequential_workers,0),
   unclassified_services:unclassified,
   has_incomplete_scope:all.length!==items.length||unclassified>0},
  costs,
  active_workers_in_registry:active.length
 };
}
