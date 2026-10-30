/* CIVOLTEN — Etapa 3: prévia de cronograma segura para dados verificados.
 * Endpoint somente leitura; não escreve datas e não emite prazos contratuais.
 */
import {buildWorkSchedule} from './schedule-engine.mjs';
import {inspectCriticalChain} from './schedule-critical-chain.mjs';

const validUUID=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const reviewed=s=>['revisado','aprovado','validado'].includes(String(s||'').toLowerCase());
export async function handleStage3({req,res,sql,parts,method,send}){
 const [resource,id,sub]=parts;
 if(resource!=='budgets'||sub!=='schedule-preview')return false;
 const done=(status,payload)=>{send(res,status,payload);return true};
 if(method!=='GET')return done(405,{error:'Prévia de cronograma é somente leitura'});
 if(!validUUID(id))return done(400,{error:'Identificador do orçamento inválido'});
 const p=new URL(req.url,'https://civolten-gj91.vercel.app').searchParams;
 const start=p.get('start_date');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start||''))return done(400,{error:'Informe start_date=AAAA-MM-DD'});
 const week=p.has('work_days_week')?Number(p.get('work_days_week')):5;
 const safety=p.has('safety_pct')?Number(p.get('safety_pct')):0;
 if(![5,6].includes(week)||!Number.isFinite(safety)||safety<0||safety>100)
  return done(400,{error:'Calendário ou margem de segurança inválida'});
 const rawHolidays=p.get('holidays')||'';
 const holidays=rawHolidays?rawHolidays.split(',').map(x=>x.trim()):[];
 if(holidays.length>50||holidays.some(x=>!/^\d{4}-\d{2}-\d{2}$/.test(x)))
  return done(400,{error:'Feriados inválidos; máximo 50 datas AAAA-MM-DD'});
 const budgets=await sql.query("SELECT id,code,status,lock_version FROM budgets WHERE id=$1",[id]);
 if(!budgets.length)return done(404,{error:'Orçamento não encontrado'});
 const [crews,tasks,dependencies]=await Promise.all([
  sql.query(`SELECT c.id,c.title,c.workday_hours,c.efficiency,
    COALESCE(SUM(cr.workers),0)::integer AS workers
    FROM crews c LEFT JOIN crew_roles cr ON cr.crew_id=c.id
    WHERE c.budget_id=$1 AND c.archived_at IS NULL GROUP BY c.id ORDER BY c.title`,[id]),
  sql.query(`SELECT t.id,t.title,t.crew_id,t.days_estimated,t.duration_review_state,
    t.budget_item_id,bi.quantity,bi.direct_labor_hh_unit,bi.labor_review_state,bi.deleted_at
    FROM schedule_tasks t LEFT JOIN budget_items bi ON bi.id=t.budget_item_id
    WHERE t.budget_id=$1 AND t.archived_at IS NULL ORDER BY t.title,t.id`,[id]),
  sql.query(`SELECT d.predecessor_id,d.successor_id,d.dependency_type,d.lag_days
    FROM task_dependencies d JOIN schedule_tasks t ON t.id=d.successor_id JOIN schedule_tasks p ON p.id=d.predecessor_id
    WHERE t.budget_id=$1 AND t.archived_at IS NULL AND p.archived_at IS NULL ORDER BY d.successor_id,d.predecessor_id`,[id])
 ]);
 const issues=[];
 const deps=new Map(tasks.map(t=>[String(t.id),[]]));
 for(const d of dependencies){
  if(String(d.dependency_type).toUpperCase()!=='FS'||Number(d.lag_days)!==0)
   issues.push('Dependência de tipo ou defasagem não suportada na prévia de QA.');
  if(deps.has(String(d.successor_id)))deps.get(String(d.successor_id)).push(String(d.predecessor_id));
 }
 const assigned=new Set(crews.map(c=>String(c.id)));
 const teams=crews.map(c=>({id:String(c.id),workers:Number(c.workers),
  hours_day:Number(c.workday_hours),efficiency:Number(c.efficiency)}));
 const activity=tasks.map(t=>{
  const days=Number(t.days_estimated);
  if(!assigned.has(String(t.crew_id)))issues.push('Atividade sem equipe do orçamento: '+t.id);
  if(t.budget_item_id&&t.deleted_at)issues.push('Atividade vinculada a serviço arquivado: '+t.id);
  // Um coeficiente h-h direto parcial NÃO prova produtividade real. Prazo manual
  // depende obrigatoriamente de revisão humana individual da atividade.
  if(!reviewed(t.duration_review_state) || !Number.isSafeInteger(days)||days<=0)
    issues.push('Duração não revisada ou inválida: '+t.id);
  return {id:String(t.id),title:String(t.title),crew_id:String(t.crew_id||''),
   depends_on:deps.get(String(t.id))||[],duration_workdays:days,
   duration_reviewed:reviewed(t.duration_review_state)&&Number.isSafeInteger(days)&&days>0};
 });
 const calendar=issues.length?{ready:false,errors:issues,warnings:[],tasks:[],
   base_workdays:null,total_workdays:null,finish:null}:
   buildWorkSchedule({start_date:start,work_days_week:week,holidays,safety_pct:safety,
     teams,tasks:activity});
 const teamCapacity=new Map(teams.map(t=>[t.id,t.workers*t.hours_day*t.efficiency]));
 const productivity=tasks.map(t=>{
  const capacity=teamCapacity.get(String(t.crew_id));
  const qty=Number(t.quantity),hh=Number(t.direct_labor_hh_unit);
  const hasVerifiedHours=!!t.budget_item_id&&!t.deleted_at &&
   reviewed(t.labor_review_state) && Number.isFinite(qty)&&qty>0 &&
   t.direct_labor_hh_unit!=null&&Number.isFinite(hh)&&hh>0;
  const totalHH=hasVerifiedHours?qty*hh:null;
  const derived=hasVerifiedHours&&Number.isFinite(capacity)&&capacity>0?Math.ceil(totalHH/capacity):null;
  const planned=Number(t.days_estimated);
  return {task_id:t.id,linked_item_id:t.budget_item_id||null,
   projected_hh:totalHH===null?null:Number(totalHH.toFixed(4)),
   team_capacity_hh_per_day:capacity&&Number.isFinite(capacity)?Number(capacity.toFixed(4)):null,
   derived_workdays:derived,planned_workdays:Number.isFinite(planned)&&planned>0?planned:null,
   labor_reference_verified:hasVerifiedHours,
   notice:hasVerifiedHours?'Horas derivadas de coeficiente conferido; requer produtividade observada em obra.':'Sem coeficiente de hora-homem revisado; não inferir produtividade de fichas SIURB parciais.'};
 });
 const warnings=[...(calendar.warnings||[]),
  'Resultado preliminar. Conferir equipes por profissão, equipamentos, clima e rendimento real da obra.'];
 if(productivity.some(x=>x.derived_workdays!=null&&x.planned_workdays!=null&&x.derived_workdays>x.planned_workdays))
  warnings.push('Há atividades cujo prazo manual é inferior ao prazo calculado a partir de horas-homem conferidas. Justifique os recursos.');
 return done(200,{budget:{id:budgets[0].id,code:budgets[0].code,
   lock_version:budgets[0].lock_version,status:budgets[0].status},
   schedule:{...calendar,warnings},critical_chain:inspectCriticalChain(calendar),productivity,commercial_release:false,
   model:'duracoes_manuais_revisadas',preview_only:true,
   review_required:true});
}
