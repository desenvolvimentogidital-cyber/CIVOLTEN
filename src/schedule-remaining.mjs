/* Etapa 3 — projeção do trabalho restante apenas com medição validada.
 * Nenhum dado pendente/rejeitado entra na produtividade; sem coeficiente provado,
 * a resposta deixa o prazo indeterminado em vez de inventar datas.
 */
import {buildWorkSchedule} from './schedule-engine.mjs';
import {inspectCriticalChain} from './schedule-critical-chain.mjs';

const positive=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>0;
const round4=x=>Math.round((x+Number.EPSILON)*10000)/10000;
const checked=x=>['revisado','validado','aprovado'].includes(String(x||'').toLowerCase());
export function forecastRemainingWork({tasks,teams,dependencies=[],start_date,work_days_week=5,holidays=[],safety_pct=0}){
 const errors=[],warnings=[],inputs=[],byTeam=new Map(teams.map(c=>[String(c.id),c]));
 const mapped=new Map(tasks.map(x=>[String(x.id),x]));
 const linked=new Set();
 for(const t of tasks){
  const label=String(t.title||t.id);
  const quantity=Number(t.planned_quantity);
  const done=Number(t.validated_quantity||0);
  const measuredHH=Number(t.validated_person_hours||0);
  const team=byTeam.get(String(t.crew_id));
  const capacity=team?Number(team.workers)*Number(team.hours_day)*Number(team.efficiency):NaN;
  const hasQuantity=!!t.budget_item_id && positive(t.planned_quantity);
  const remaining=hasQuantity?Math.max(0,quantity-done):null;
  if(t.budget_item_id){
   if(linked.has(t.budget_item_id))errors.push('Serviço orçado atribuído a mais de uma atividade: '+label);
   linked.add(t.budget_item_id);
  }
  let perUnit=null,origin=null;
  if(done>0&&measuredHH>0){
   perUnit=measuredHH/done;origin='producao_observada_validada';
   if(done<1)warnings.push('Amostra de medição pequena para '+label);
  }else if(checked(t.labor_review_state)&&positive(t.direct_labor_hh_unit)){
   perUnit=Number(t.direct_labor_hh_unit);origin='coeficiente_hh_revisado';
   warnings.push('Sem produtividade observada; usando coeficiente técnico revisado: '+label);
  }
  if(!hasQuantity)errors.push('Atividade sem quantidade planejada vinculada a serviço: '+label);
  if(!Number.isFinite(done)||done<0||!Number.isFinite(measuredHH)||measuredHH<0)
   errors.push('Medição inconsistente: '+label);
  if(remaining!=null && remaining>0 && !(perUnit>0))
   errors.push('Produtividade sem evidência válida: '+label);
  if(remaining!=null && remaining>0 && !(capacity>0))
   errors.push('Equipe sem capacidade conferida: '+label);
  if(hasQuantity && done>quantity){
   errors.push('Quantidade executada excede quantidade orçada: '+label);
  }
  const workdays=remaining===0?0:remaining!=null&&perUnit>0&&capacity>0?
   Math.ceil(remaining*perUnit/capacity):null;
  inputs.push({id:String(t.id),title:label,crew_id:String(t.crew_id||''),
   budget_item_id:t.budget_item_id||null,planned_quantity:hasQuantity?quantity:null,
   validated_quantity:round4(done),remaining_quantity:remaining===null?null:round4(remaining),
   observed_hh_per_unit:origin==='producao_observada_validada'?round4(perUnit):null,
   applied_hh_per_unit:perUnit===null?null:round4(perUnit),coefficient_source:origin,
   team_capacity_hh_day:Number.isFinite(capacity)?round4(capacity):null,
   estimated_remaining_workdays:workdays});
 }
 if(tasks.length===0)errors.push('Nenhuma atividade cadastrada');
 if(errors.length)return {ready:false,errors,warnings,items:inputs,schedule:null,critical_chain:null,
   commercial_release:false};
 const active=inputs.filter(x=>x.estimated_remaining_workdays>0);
 if(!active.length)return {ready:true,completed:true,errors:[],warnings,items:inputs,
  schedule:{ready:true,tasks:[],start:start_date,finish:null,total_workdays:0,
   warnings:['Todas as quantidades vinculadas foram integralmente validadas.']},
  critical_chain:{ready:true,critical_task_ids:[],activities:[],project_workdays:0},
  commercial_release:false};
 const activeIds=new Set(active.map(x=>x.id));
 const relevant=dependencies.filter(d=>activeIds.has(String(d.predecessor_id))&&activeIds.has(String(d.successor_id)));
 for(const d of relevant){
  if(String(d.dependency_type).toUpperCase()!=='FS'||Number(d.lag_days)!==0)
   errors.push('Dependência não suportada para previsão: '+d.predecessor_id+' → '+d.successor_id);
 }
 if(errors.length)return {ready:false,errors,warnings,items:inputs,schedule:null,critical_chain:null,
   commercial_release:false};
 const model=active.map(x=>({
  id:x.id,title:x.title,crew_id:x.crew_id,
  duration_workdays:x.estimated_remaining_workdays,duration_reviewed:true,
  depends_on:relevant.filter(d=>String(d.successor_id)===x.id).map(d=>String(d.predecessor_id))
 }));
 const schedule=buildWorkSchedule({tasks:model,teams,start_date,work_days_week,holidays,safety_pct});
 return {ready:schedule.ready,completed:false,errors:schedule.errors,
  warnings:[...warnings,...schedule.warnings],items:inputs,schedule,
  critical_chain:inspectCriticalChain(schedule),commercial_release:false,
  note:'Projeção operacional; medir periodicamente, revisar equipe e conferir cronograma contratual.'};
}
