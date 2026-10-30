/* CIVOLTEN – previsão de prazo restante por medições validadas; somente leitura. */
import {forecastRemainingWork} from './schedule-remaining.mjs';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[89ab0-9a-f]{12}$/i.test(x);
export async function handleRemainingSchedule({req,res,sql,parts,method,send}){
 const [resource,id,sub]=parts;
 if(resource!=='budgets'||sub!=='schedule-remaining')return false;
 const done=(code,data)=>{send(res,code,data);return true};
 if(method!=='GET')return done(405,{error:'Previsão somente leitura'});
 if(!uuid(id))return done(400,{error:'Orçamento inválido'});
 const p=new URL(req.url,'https://civolten.vercel.app').searchParams;
 const start=p.get('start_date');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start||''))return done(400,{error:'Informe start_date=AAAA-MM-DD'});
 const week=p.has('work_days_week')?Number(p.get('work_days_week')):5;
 const safety=p.has('safety_pct')?Number(p.get('safety_pct')):0;
 const holidays=p.get('holidays')?p.get('holidays').split(',').map(x=>x.trim()):[];
 if(![5,6].includes(week)||!Number.isFinite(safety)||safety<0||safety>100||
    holidays.length>50||holidays.some(x=>!/^\d{4}-\d{2}-\d{2}$/.test(x)))
  return done(400,{error:'Calendário, feriados ou margem inválidos'});
 const budgets=await sql.query('SELECT id,code,status,lock_version FROM budgets WHERE id=$1',[id]);
 if(!budgets.length)return done(404,{error:'Orçamento não encontrado'});
 const [crews,tasks,edges]=await Promise.all([
  sql.query(`SELECT c.id,c.workday_hours,c.efficiency,COALESCE(SUM(r.workers),0)::int AS workers
   FROM crews c LEFT JOIN crew_roles r ON r.crew_id=c.id
   WHERE c.budget_id=$1 AND c.archived_at IS NULL
   GROUP BY c.id ORDER BY c.id`,[id]),
  sql.query(`SELECT t.id,t.title,t.crew_id,t.budget_item_id,
    bi.quantity AS planned_quantity,bi.direct_labor_hh_unit,bi.labor_review_state,
    COALESCE(SUM(m.completed_quantity) FILTER(WHERE m.review_status='validado'),0)
       AS validated_quantity,
    COALESCE(SUM(m.actual_person_hours) FILTER(WHERE m.review_status='validado'),0)
       AS validated_person_hours
   FROM schedule_tasks t
   LEFT JOIN budget_items bi ON bi.id=t.budget_item_id AND bi.deleted_at IS NULL
   LEFT JOIN schedule_progress_measurements m ON m.task_id=t.id AND m.budget_id=$1
   WHERE t.budget_id=$1 AND t.archived_at IS NULL
   GROUP BY t.id,bi.id ORDER BY t.title,t.id`,[id]),
  sql.query(`SELECT d.predecessor_id,d.successor_id,d.dependency_type,d.lag_days
    FROM task_dependencies d
    JOIN schedule_tasks t ON t.id=d.successor_id
    JOIN schedule_tasks p ON p.id=d.predecessor_id
    WHERE t.budget_id=$1 AND p.budget_id=$1
      AND t.archived_at IS NULL AND p.archived_at IS NULL`,[id])
 ]);
 const result=forecastRemainingWork({
  tasks,teams:crews.map(c=>({id:c.id,workers:Number(c.workers),
   hours_day:Number(c.workday_hours),efficiency:Number(c.efficiency)})),
  dependencies:edges,start_date:start,work_days_week:week,holidays,safety_pct:safety
 });
 return done(200,{budget:budgets[0],...result,preview_only:true,review_required:true,
  commercial_release:false});
}
