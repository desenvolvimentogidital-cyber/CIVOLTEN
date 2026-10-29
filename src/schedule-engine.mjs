/* CIVOLTEN — Cronograma preliminar com restrições de recursos e precedência.
 * Não gera prazo se há atividade sem equipe/produtividade conferida.
 */
const fail=(msg)=>{throw new Error(msg)};
const dateUTC=v=>{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))fail('Data inválida, use AAAA-MM-DD');
 const date=new Date(v+'T12:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==v)fail('Data inexistente');
 return date;
};
function calendar(start,workingWeek,holidays){
 const day=dateUTC(start);const blocked=new Set(holidays||[]);
 const cache=[],date=new Date(day.getTime());
 const max=10000;
 function holiday(d){
   const dow=d.getUTCDay(),iso=d.toISOString().slice(0,10);
   return dow===0||(workingWeek===5&&dow===6)||blocked.has(iso);
 }
 for(let n=0;cache.length<max;n++){
   if(n>15000)fail('Calendário excedeu limite');
   if(!holiday(date))cache.push(date.toISOString().slice(0,10));
   date.setUTCDate(date.getUTCDate()+1);
 }
 return idx=>{if(idx<0||idx>=cache.length)fail('Prazo excedeu limite do calendário');return cache[idx]};
}
function duration(task,team){
 if(Number.isInteger(task.duration_workdays)&&task.duration_workdays>0)
   return task.duration_workdays;
 const qty=Number(task.quantity),hh=Number(task.hh_per_unit);
 if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(hh)||hh<=0)return null;
 const people=Number(team?.workers),hours=Number(team?.hours_day),eff=Number(team?.efficiency);
 if(!Number.isFinite(people)||people<=0||!Number.isFinite(hours)||hours<=0||hours>12||!Number.isFinite(eff)||eff<=0||eff>1)return null;
 return Math.ceil((qty*hh)/(people*hours*eff));
}
const overlaps=(a,b)=>a.startIndex<b.endExclusive&&b.startIndex<a.endExclusive;
/** Precedência FS com lag em dias úteis. Indices de calendários são dias úteis, não dias corridos. */
export function buildWorkSchedule(options){
 const errors=[],warnings=[];
 const tasks=Array.isArray(options?.tasks)?options.tasks:[];
 const teamMap=new Map((options?.teams||[]).map(c=>[String(c.id),c]));
 const active=new Map(),edges=new Map(),indegree=new Map(),occupied=new Map();
 const workWeek=Number(options?.work_days_week??5);
 if(![5,6].includes(workWeek))errors.push('Dias de trabalho por semana devem ser 5 ou 6.');
 let calendarDate=null;
 try{calendarDate=calendar(options?.start_date,workWeek,options?.holidays||[])}catch(e){errors.push(e.message)}
 if(!tasks.length)errors.push('Nenhuma atividade cadastrada.');
 for(const t of tasks){
   const id=String(t.id||'');
   if(!id||active.has(id))errors.push('Código de tarefa vazio ou duplicado: '+id);
   active.set(id,t);edges.set(id,[]);indegree.set(id,0);
   if(!t.title?.trim())errors.push('Atividade '+id+' sem descrição.');
   if(!teamMap.has(String(t.crew_id)))errors.push('Atividade '+id+' sem equipe definida.');
   if(duration(t,teamMap.get(String(t.crew_id)))==null)errors.push('Atividade '+id+' sem duração ou produtividade comprovada.');
 }
 for(const t of tasks){
   const deps=Array.isArray(t.depends_on)?t.depends_on:[];
   if(new Set(deps.map(String)).size!==deps.length)errors.push('Dependências repetidas em '+String(t.id));
   for(const dependency of deps){
     const from=String(dependency),to=String(t.id);
     if(!active.has(from)||from===to)errors.push('Dependência inválida: '+from+' → '+to);
     else{edges.get(from).push(to);indegree.set(to,(indegree.get(to)||0)+1)}
   }
 }
 if(!Array.isArray(options?.holidays)||!options.holidays.length)warnings.push('Calendário sem feriados locais informados. Confirmar datas antes de aprovar prazo.');
 if(errors.length)return {ready:false,errors,warnings,tasks:[],base_workdays:null,total_workdays:null,finish:null};
 const queue=tasks.map(t=>String(t.id)).filter(id=>indegree.get(id)===0);
 const output=[],ending=new Map();
 while(queue.length){
   const id=queue.shift(),task=active.get(id),team=teamMap.get(String(task.crew_id));
   const days=duration(task,team);
   if(days>9000){errors.push('Duração acima do limite para '+id);break}
   const predecessors=(task.depends_on||[]).map(String);
   const earliest=predecessors.length?Math.max(...predecessors.map(p=>ending.get(p)||0)):0;
   let startIndex=earliest;
   const crewId=String(task.crew_id),slots=occupied.get(crewId)||[];
   let attempts=0;
   while(slots.some(s=>overlaps({startIndex,endExclusive:startIndex+days},s))){
      startIndex=Math.max(startIndex+1,...slots.filter(s=>overlaps({startIndex,endExclusive:startIndex+days},s)).map(s=>s.endExclusive));
      if(++attempts>10000){errors.push('Equipe sem disponibilidade calculável: '+crewId);break}
   }
   if(errors.length)break;
   const endExclusive=startIndex+days;
   try{const start=calendarDate(startIndex),finish=calendarDate(endExclusive-1);
     const row={id,title:task.title,crew_id:crewId,depends_on:predecessors,start,finish,
       duration_workdays:days,startIndex,endExclusive};
     output.push(row);slots.push(row);occupied.set(crewId,slots);ending.set(id,endExclusive);
   }catch(e){errors.push(e.message);break}
   for(const next of edges.get(id)){indegree.set(next,indegree.get(next)-1);if(indegree.get(next)===0)queue.push(next)}
 }
 if(output.length!==tasks.length)errors.push('Cronograma contém ciclo de dependências ou atividade sem recursos.');
 if(errors.length)return {ready:false,errors,warnings,tasks:[],base_workdays:null,total_workdays:null,finish:null};
 const base=Math.max(...output.map(x=>x.endExclusive));
 const safetyPct=Number(options?.safety_pct??0);
 if(!Number.isFinite(safetyPct)||safetyPct<0||safetyPct>100)return {ready:false,errors:['Margem de segurança de prazo inválida.'],warnings,tasks:[],base_workdays:null,total_workdays:null,finish:null};
 const safety=Math.ceil(base*safetyPct/100),total=base+safety;
 if(options?.contract_deadline&&calendarDate(options.contract_deadline)<dateUTC(calendarDate(total-1)))warnings.push('Prazo calculado ultrapassa a data contratual.');
 warnings.push('Cronograma preliminar: validar dimensionamento por profissão, equipamento, frentes, restrições de acesso e produtividade observada.');
 return {ready:true,errors,warnings,tasks:output,base_workdays:base,safety_workdays:safety,total_workdays:total,
  start:calendarDate(0),finish:calendarDate(total-1),parallel_tasks_possible:output.some((a,i)=>output.some((b,j)=>j>i&&a.crew_id!==b.crew_id&&overlaps(a,b)))};
}
