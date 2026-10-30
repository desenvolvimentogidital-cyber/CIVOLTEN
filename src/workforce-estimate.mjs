/* Planejamento de recursos SEM cadastro de equipes e sem escrita no banco.
 * Base: serviços do orçamento + horas-homem DIRETAS SIURB (PARCIAIS).
 * Não presume que esses coeficientes sejam rendimento real validado.
 * Para estimativa, assumir execução paralela; dependências não foram informadas.
 */
const valid=(n,lo,hi)=>Number.isFinite(Number(n))&&Number(n)>=lo&&Number(n)<=hi;
const round=(n,places=2)=>Number(n.toFixed(places));
export function buildWorkforceEstimate(items,settings={}){
 const days=Number(settings.target_days??10),
  hours=Number(settings.hours_day??8),
  efficiencyPct=Number(settings.efficiency_pct??85),
  crewSize=Number(settings.crew_size??4),
  availableWorkers=settings.available_workers===undefined||settings.available_workers===null||settings.available_workers===''?null:Number(settings.available_workers);
 if(!Number.isSafeInteger(days)||!valid(days,1,365)||!valid(hours,4,12)||
    !Number.isSafeInteger(efficiencyPct)||!valid(efficiencyPct,50,100)||
    !Number.isSafeInteger(crewSize)||!valid(crewSize,1,20)||
    (availableWorkers!==null&&(!Number.isSafeInteger(availableWorkers)||!valid(availableWorkers,1,100))))
  throw Object.assign(new Error('Prazo, jornada, eficiência ou tamanho da equipe inválidos'),{status:400});
 const daily=hours*efficiencyPct/100,capacity=days*daily;
 const proposals=(items||[]).map(item=>{
  const quantity=Number(item.quantity);
  const approved=String(item.labor_review_state||'').toLowerCase();
  const checked=['revisado','aprovado','validado'].includes(approved);
  const validChecked=checked&&valid(item.direct_labor_hh_unit,0.000001,1e9);
  const validDirect=valid(item.direct_hh_per_unit,0.000001,1e9)&&item.direct_hh_per_unit!==null;
  const eligible=valid(quantity,0.000001,1e10)&&
   (validChecked||validDirect)&&(!item.reference_price_id||item.source_matches_budget===true);
  const hhUnit=validChecked?Number(item.direct_labor_hh_unit):(validDirect?Number(item.direct_hh_per_unit):null);
  const base={item_id:item.id,position:item.position,code:item.source_code,
    title:item.source_name,unit:item.unit,quantity:item.quantity,
    reference_price_id:item.reference_price_id||null,
    status:eligible?(validChecked?'coeficiente_revisado':'referencia_parcial'):'sem_coeficiente',
    reviewed:!!validChecked,source:validChecked?'orçamento_revisado':validDirect?'SIURB_direta_parcial':'sem_fonte'};
  if(!eligible)return {...base,estimated_hh:null,hh_per_unit:hhUnit,workers:null,crews:null,
    roles:[],person_workdays:null,warning:item.reference_price_id&&item.source_matches_budget===false?
     'Preço do serviço não corresponde à data-base e ao regime do orçamento.':
     'Sem coeficiente de horas-homem utilizável. Informe ou revise a produtividade; nenhum efetivo foi inventado.'};
  const personHours=quantity*hhUnit;
  if(!Number.isFinite(personHours)||personHours>1e12)return {...base,status:'sem_coeficiente',
    estimated_hh:null,hh_per_unit:hhUnit,workers:null,crews:null,roles:[],person_workdays:null,
    warning:'Carga calculada fora dos limites.'};
  // Empregam-se somente coeficientes de mão de obra (H), nunca horas de equipamentos.
  const rawRoles=Array.isArray(item.labor)?item.labor:[];
  const byRole=new Map();
  for(const entry of rawRoles){
   const coef=Number(entry.coef);
   if(!valid(coef,0.00000001,1e6)||String(entry.unit||'').toUpperCase()!=='H')continue;
   const name=String(entry.name||'').trim().slice(0,140);
   if(!name)continue;
   const code=String(entry.code||'').slice(0,35);
   const key=code||name.toUpperCase();
   const cur=byRole.get(key)||{code,name,hh_unit:0};
   cur.hh_unit+=coef;
   byRole.set(key,cur);
  }
  const laborSum=[...byRole.values()].reduce((s,r)=>s+r.hh_unit,0);
  const consistent=byRole.size>0&&hhUnit>0&&Math.abs(laborSum-hhUnit)/hhUnit<=0.05;
  // If approved total differs from SIURB components, omit role split rather than misallocate.
  const roles=consistent?[...byRole.values()].map(r=>{
   const roleHH=quantity*r.hh_unit;
   return {code:r.code,name:r.name,hh_per_unit:round(r.hh_unit,5),
     projected_hh:round(roleHH,3),workers:Math.max(1,Math.ceil(roleHH/capacity))};
  }):[];
  // Cenário opcional por capacidade: N trabalhadores disponíveis para ESTA frente,
  // além do proprietário. Nunca pressupor que 1 ajudante possa substituir um pedreiro.
  if(availableWorkers!==null&&roles.length>availableWorkers){
   return {...base,status:'capacidade_insuficiente',hh_per_unit:round(hhUnit,6),
    estimated_hh:round(personHours,3),workers:null,crews:null,roles,person_workdays:round(personHours/daily,2),
    warning:'Equipe disponível de '+availableWorkers+' pessoa(s) não cobre as '+roles.length+
      ' profissões diferentes exigidas para esta atividade. Ajuste a equipe ou revise o método de execução.'};
  }
  let workers;
  if(availableWorkers!==null&&roles.length){
   const allocated=roles.map(()=>1);
   // Alocar cada profissional extra à profissão que mais limita o prazo.
   // Parar em 1 dia de produção (adicionar mais gente não reduz dias inteiros).
   for(let count=roles.length;count<availableWorkers;count++){
    const estimates=roles.map((r,i)=>r.projected_hh/(allocated[i]*daily));
    const worst=Math.max(...estimates);
    if(worst<=1)break;
    const at=estimates.indexOf(worst);
    allocated[at]++;
   }
   roles.forEach((role,i)=>{role.workers=allocated[i]});
   workers=allocated.reduce((a,b)=>a+b,0);
  }else if(availableWorkers!==null){
   workers=Math.min(availableWorkers,Math.max(1,Math.ceil(personHours/daily)));
  }else workers=roles.length?roles.reduce((total,r)=>total+r.workers,0):
   Math.max(1,Math.ceil(personHours/capacity));
  const crews=Math.ceil(workers/crewSize);
  // A função mais lenta limita a conclusão: não basta dividir o total de h-h pelo efetivo geral.
  const daysAtStaff=roles.length?Math.max(...roles.map(r=>Math.ceil(r.projected_hh/(r.workers*daily))),1):
   Math.max(1,Math.ceil(personHours/(workers*daily)));
  const notes=['Referência de horas-homem diretas: possíveis auxiliares, mobilização e perdas não computados.'];
  if(!validChecked)notes.push('Coeficiente SIURB parcial, ainda não revisado para esta obra.');
  if(!consistent)notes.push('Distribuição por profissão indisponível ou divergente; dimensionamento somente total.');
  if(workers>100)notes.push('Efetivo elevado: verificar prazo e frentes de trabalho antes de contratar.');
  return {...base,hh_per_unit:round(hhUnit,6),estimated_hh:round(personHours,3),
   person_workdays:round(personHours/daily,2),workers,crews,roles,
   days_at_suggested_staff:daysAtStaff,warning:notes.join(' ')};
 });
 const ready=proposals.filter(x=>x.workers!==null);
 const pending=proposals.filter(x=>x.workers===null);
 // O total simultâneo representa um cenário pessimista de todos os serviços no mesmo período.
 return {settings:{target_days:days,hours_day:hours,efficiency_pct:efficiencyPct,crew_size:crewSize,
   effective_hours_per_worker_day:round(daily,3),available_workers:availableWorkers,
   excludes_owner:true},
  summary:{total_services:proposals.length,estimated_services:ready.length,without_productivity:pending.length,
   simultaneous_workers:ready.reduce((s,x)=>s+x.workers,0),
   simultaneous_crews:ready.reduce((s,x)=>s+x.crews,0),
   sequential_peak_workers:ready.length?Math.max(...ready.map(x=>x.workers)):0,
   sequential_peak_crews:ready.length?Math.max(...ready.map(x=>x.crews)):0,
   partial_estimate:pending.length>0||ready.some(x=>!x.reviewed),
   total_hh:round(ready.reduce((s,x)=>s+x.estimated_hh,0),2)},
  services:proposals,has_unestimated_services:pending.length>0,
  model:availableWorkers===null?'dimensionamento_inicial_por_horas_homem':'capacidade_de_pessoal_por_frente',
  assumptions:availableWorkers===null?'O prazo por atividade é uma hipótese de dimensionamento inicial; frentes e dependências devem ser conferidas.':
   'O efetivo informado é um limite por frente de serviço, sem contar o proprietário. A obra respeita a sequência técnica proposta; atividades independentes podem exigir avaliação de simultaneidade.',
  notice:'Estimativa de pessoal e de quantidade de equipes, não cadastro, reserva, escala ou cronograma contratual. Coeficientes SIURB de mão de obra direta são parciais; confirmar produtividades, sequência, segurança, frentes de serviço e composição antes da contratação.',
  commercial_release:false,preview_only:true};
}
