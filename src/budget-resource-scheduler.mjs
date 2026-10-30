/* Cronograma automático CIVOLTEN: dependências por frente e limite global de pessoas.
 * Previsão em dias úteis abstratos (0-based). Não inventa data de início, feriados
 * ou duração de cura/secagem. A sequência inferida precisa de conferência técnica.
 */
import {constructionStage} from './workforce-sequence.mjs';
export function planResourceSchedule(services=[],options={}){
 const staff=options.available_workers==null?null:Number(options.available_workers);
 if(staff!==null&&(!Number.isSafeInteger(staff)||staff<1||staff>100))
  throw Object.assign(new Error('Disponibilidade global inválida'),{status:400});
 const metadata=new Map((options.fronts||[]).map(x=>[String(x.budget_item_id),x]));
 const steps=services.map((service,i)=>{
  const id=String(service.item_id||service.id),meta=metadata.get(id)||{};
  const front=String(meta.work_front||'Geral').trim().slice(0,80)||'Geral';
  const workers=service.workers==null?null:Number(service.workers);
  const duration=service.days_at_suggested_staff==null?null:Number(service.days_at_suggested_staff);
  return {id,title:String(service.title||service.source_name||''),position:i,front,
   stage:constructionStage(service)?.key||null,
   workers,duration,
   wait_workdays:Number(meta.wait_workdays||0),
   roles:service.roles||[]};
 });
 if(steps.some(x=>!Number.isSafeInteger(x.wait_workdays)||x.wait_workdays<0||x.wait_workdays>60))
  throw Object.assign(new Error('Espera técnica inválida'),{status:400});
 if(steps.length>500)throw Object.assign(new Error('Máximo de 500 atividades'),{status:400});
 const byId=new Map(steps.map(x=>[x.id,x]));
 if(byId.size!==steps.length)throw Object.assign(new Error('Serviço duplicado'),{status:400});
 const missing=[],relations=new Map();
 const insert=(from,to,lag,source)=>{
  if(from===to)throw Object.assign(new Error('Dependência do próprio serviço'),{status:400});
  if(!byId.has(from)||!byId.has(to))throw Object.assign(new Error('Dependência aponta para serviço inexistente ou arquivado'),{status:400});
  const key=from+'|'+to,entry=relations.get(key);
  if(!entry||lag>entry.lag)relations.set(key,{predecessor_id:from,successor_id:to,lag,source});
 };
 const stagesByFront=new Map();
 for(const x of steps){
  if(!stagesByFront.has(x.front))stagesByFront.set(x.front,new Map());
  if(x.stage){
   const set=stagesByFront.get(x.front);
   if(!set.has(x.stage))set.set(x.stage,[]);
   set.get(x.stage).push(x);
  }
 }
 for(const [front,stages] of stagesByFront){
  const walls=stages.get('alvenaria')||[],coats=stages.get('chapisco')||[],renders=stages.get('reboco')||[];
  for(const a of walls)for(const c of coats)insert(a.id,c.id,0,'precedencia_sugerida');
  for(const c of coats)for(const r of renders)insert(c.id,r.id,0,'precedencia_sugerida');
  if(!coats.length)for(const a of walls)for(const r of renders)insert(a.id,r.id,0,'precedencia_sugerida_sem_chapisco');
  if(walls.length&&renders.length&&!coats.length)missing.push({
   code:'missing_chapisco',front,title:'Chapisco não encontrado na frente '+front,
   message:'Confirme se o chapisco já está incluído numa composição. Se não estiver, acrescente-o ao orçamento. Nenhuma quantidade ou custo foi criado automaticamente.'
  });
 }
 for(const d of options.dependencies||[]){
  const lag=Number(d.lag_workdays||0);
  if(!Number.isSafeInteger(lag)||lag<0||lag>60)
   throw Object.assign(new Error('Defasagem entre serviços inválida'),{status:400});
  insert(String(d.predecessor_item_id),String(d.successor_item_id),lag,'dependencia_manual');
 }
 // O tempo técnico de espera é após cada atividade, não um dia de mão de obra.
 for(const e of relations.values())e.lag+=byId.get(e.predecessor_id).wait_workdays;
 const edges=[...relations.values()];
 const predecessors=new Map(steps.map(x=>[x.id,[]])),successors=new Map(steps.map(x=>[x.id,[]]));
 for(const e of edges){predecessors.get(e.successor_id).push(e);successors.get(e.predecessor_id).push(e)}
 const indegree=new Map(steps.map(x=>[x.id,predecessors.get(x.id).length]));
 let ready=steps.filter(x=>!indegree.get(x.id)).sort((a,b)=>a.position-b.position),visited=[];
 while(ready.length){const x=ready.shift();visited.push(x);
  for(const e of successors.get(x.id)){indegree.set(e.successor_id,indegree.get(e.successor_id)-1);
   if(!indegree.get(e.successor_id)){ready.push(byId.get(e.successor_id));ready.sort((a,b)=>a.position-b.position)}}
 }
 if(visited.length!==steps.length)return {ready:false,reason:'Ciclo nas dependências',errors:['Os serviços têm dependências circulares. Revise a ordem.'],tasks:[],missing,dependencies:edges,workdays:null};
 const incomplete=steps.some(x=>x.workers===null||!Number.isSafeInteger(x.workers)||x.workers<1||
  !Number.isSafeInteger(x.duration)||x.duration<1);
 const maxWorkers=Math.max(0,...steps.map(x=>x.workers||0));
 const capacity=staff??maxWorkers;
 const tooMany=steps.filter(x=>x.workers!==null&&x.workers>capacity);
 if(tooMany.length)return {ready:false,reason:'Equipe global insuficiente',
  errors:['A quantidade de profissionais disponíveis não cobre uma atividade: '+tooMany.map(x=>x.title).join(', ')],
  tasks:[],missing,dependencies:edges,workdays:null,available_workers:capacity};
 // Compute unconstrained dependency-only early/late schedule (not a resource-constrained critical path).
 const early=new Map(),longest=new Map();
 for(const step of visited){
  const prev=predecessors.get(step.id);
  const start=Math.max(0,...prev.map(e=>((early.get(e.predecessor_id)?.end)||0)+e.lag));
  const end=start+(step.duration||0);
  early.set(step.id,{start,end});
  const best=prev.slice().sort((a,b)=>((early.get(b.predecessor_id)?.end||0)+b.lag)-((early.get(a.predecessor_id)?.end||0)+a.lag))[0];
  longest.set(step.id,best?.predecessor_id||null);
 }
 const theoreticalFinish=Math.max(0,...[...early.values()].map(x=>x.end));
 let theoreticalEnd=visited.find(x=>early.get(x.id)?.end===theoreticalFinish),critical=[];
 while(theoreticalEnd){critical.unshift(theoreticalEnd.id);theoreticalEnd=byId.get(longest.get(theoreticalEnd.id))}
 // Serial schedule generation: start all ready tasks that fit capacity; keep them nonpreemptive.
 // Same front also cannot execute two tasks simultaneously by default.
 const started=new Map(),finished=new Set();
 let clock=0,deadlock=false;
 if(!incomplete)while(finished.size<steps.length&&clock<=200000){
  const active=steps.filter(x=>started.has(x.id)&&started.get(x.id).end>clock);
  for(const x of steps.filter(x=>started.has(x.id)&&started.get(x.id).end<=clock))finished.add(x.id);
  if(finished.size===steps.length)break;
  let running=active.reduce((sum,x)=>sum+x.workers,0),busyFronts=new Set(active.map(x=>x.front));
  for(const x of visited){
   if(started.has(x.id)||busyFronts.has(x.front)||running+x.workers>capacity)continue;
   const prev=predecessors.get(x.id);
   if(!prev.every(d=>started.has(d.predecessor_id)&&started.get(d.predecessor_id).end+d.lag<=clock))continue;
   started.set(x.id,{start:clock,end:clock+x.duration});running+=x.workers;busyFronts.add(x.front);
  }
  const future=[...started.values()].filter(x=>x.end>clock).map(x=>x.end);
  const blockedUntil=edges.filter(e=>started.has(e.predecessor_id)&&!started.has(e.successor_id))
   .map(e=>started.get(e.predecessor_id).end+e.lag).filter(t=>t>clock);
  if(!future.length&&!blockedUntil.length){deadlock=true;break}
  clock=Math.min(...future,...blockedUntil);
 }
 const scheduled=steps.map(x=>({...x,start_workday:started.get(x.id)?.start??null,
  finish_workday:started.get(x.id)?.end??null,
  dependency_only_start:early.get(x.id)?.start??null,
  dependency_only_finish:early.get(x.id)?.end??null,
  dependency_critical:critical.includes(x.id)}))
  .sort((a,b)=>(a.start_workday??Infinity)-(b.start_workday??Infinity)||a.position-b.position);
 const days=started.size===steps.length?Math.max(0,...[...started.values()].map(x=>x.end)):null;
 return {ready:!incomplete&&!deadlock&&missing.length===0,partial:incomplete||missing.length>0||deadlock,
  tasks:scheduled,dependencies:edges,missing,available_workers:capacity,capacity_source:staff===null?'estimativa_por_servico':'informado',
  workdays:days,minimum_known_workdays:days,critical_chain_dependency_only:critical,
  dependency_only_workdays:theoreticalFinish,unestimated_services:steps.filter(x=>x.duration===null).length,
  notes:['Prazos em dias úteis sem data e sem feriados; não há aprovação contratual.',
   'Não há dois serviços simultâneos na mesma frente. Entre frentes, a soma do pessoal nunca ultrapassa o limite.',
   'Cura/secagem só entram quando declaradas; serviços ausentes bloqueiam o prazo final.'],
  commercial_release:false};
}
