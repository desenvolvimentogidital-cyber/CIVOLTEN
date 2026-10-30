/* CIVOLTEN Etapa 3 — diário de execução e produtividade validada.
   Evidências pendentes não compõem progresso oficial; rejeições permanecem auditadas. */
import {randomUUID} from 'node:crypto';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[89ab0-9a-f]{12}$/i.test(x);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const text=(value,name,min=1,max=1500)=>{
 if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)fail(name+' inválido');
 return value.trim();
};
const decimal=(value,name,min,max)=>{
 if(value===null||value===undefined||value==='')fail(name+' obrigatório');
 if(!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(String(value)))fail(name+' precisa de valor decimal positivo (até 4 casas)');
 const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)fail(name+' fora dos limites');
 return String(value);
};
const canWrite=user=>['administrador','orcamentista'].includes(user.role);
const canReview=user=>['administrador','revisor'].includes(user.role);
const lock=b=>{
 if(!Number.isSafeInteger(b?.lock_version)||b.lock_version<0)fail('lock_version obrigatório');
 return b.lock_version;
};
const round4=n=>Math.round((n+Number.EPSILON)*10000)/10000;
export async function handleScheduleProgress({req,res,sql,user,parts,method,send,readBody}){
 const [resource,budgetId,sub,measurementId]=parts;
 if(resource!=='budgets'||sub!=='schedule-progress')return false;
 const done=(status,body)=>{send(res,status,body);return true};
 if(!uuid(budgetId))return done(400,{error:'Orçamento inválido'});
 const budgets=await sql.query('SELECT id,lock_version,status FROM budgets WHERE id=$1',[budgetId]);
 if(!budgets.length)return done(404,{error:'Orçamento não encontrado'});
 if(method==='GET'&&!measurementId){
  const [measurements,tasks]=await Promise.all([
   sql.query(`SELECT m.id,m.task_id,t.title AS task_title,m.worked_on,m.completed_quantity,m.workers,
      m.hours_per_worker,m.actual_person_hours,m.evidence_ref,m.evidence_notes,m.review_status,
      m.reviewed_at,m.review_notes,m.created_at
      FROM schedule_progress_measurements m JOIN schedule_tasks t ON t.id=m.task_id
      WHERE m.budget_id=$1 ORDER BY m.worked_on DESC,m.created_at DESC LIMIT 1000`,[budgetId]),
   sql.query(`SELECT t.id,t.title,t.budget_item_id,bi.unit,bi.quantity AS planned_quantity,
      bi.direct_labor_hh_unit,bi.labor_review_state
      FROM schedule_tasks t LEFT JOIN budget_items bi ON bi.id=t.budget_item_id
      WHERE t.budget_id=$1 ORDER BY t.title`,[budgetId])
  ]);
  const summaries=tasks.map(t=>{
   const approved=measurements.filter(m=>m.task_id===t.id&&m.review_status==='validado');
   const pending=measurements.filter(m=>m.task_id===t.id&&m.review_status==='pendente');
   const doneQty=approved.reduce((sum,m)=>sum+Number(m.completed_quantity),0);
   const doneHH=approved.reduce((sum,m)=>sum+Number(m.actual_person_hours),0);
   const target=t.budget_item_id?Number(t.planned_quantity):null;
   const progress=target>0?round4(doneQty/target*100):null;
   return {task_id:t.id,title:t.title,completed_quantity:round4(doneQty),
    validated_person_hours:round4(doneHH),observed_hh_per_unit:doneQty>0?round4(doneHH/doneQty):null,
    planned_quantity:target,unit:t.unit||null,progress_pct:progress,
    pending_evidence_count:pending.length,
    exceeds_budget_quantity:progress!=null&&progress>100,
    official_labor_hh_per_unit:['revisado','validado','aprovado'].includes(t.labor_review_state)?
      Number(t.direct_labor_hh_unit)||null:null};
  });
  return done(200,{budget:budgets[0],measurements,summaries,
   note:'Somente medições validadas entram na produtividade; quantidades e horas não autorizam preço ou prazo contratual.',
   commercial_release:false});
 }
 if(!['POST','PUT'].includes(method))return done(405,{error:'Método não permitido'});
 if(budgets[0].status!=='rascunho')return done(409,{error:'Somente orçamento de homologação em rascunho é editável'});
 const b=await readBody(req),version=lock(b);
 if(method==='POST'&&!measurementId){
  if(!canWrite(user))return done(403,{error:'Permissão insuficiente'});
  if(!uuid(b.task_id))return done(400,{error:'Atividade inválida'});
  const date=text(b.worked_on,'Data de medição',10,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||
    new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)
   return done(400,{error:'Data de execução inválida'});
  const qty=decimal(b.completed_quantity,'Quantidade executada',0.0001,1000000);
  const workers=Number(b.workers);
  if(!Number.isInteger(workers)||workers<1||workers>100)return done(400,{error:'Profissionais inválidos'});
  const hours=decimal(b.hours_per_worker,'Horas por profissional',0.0001,12);
  const evidence=text(b.evidence_ref,'Referência da evidência',6,180);
  const notes=text(b.evidence_notes,'Descrição da medição',15,1500);
  const mid=randomUUID();
  const rows=await sql.query(`
   WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
     WHERE id=$1 AND lock_version=$2 AND status='rascunho'
       AND EXISTS(SELECT 1 FROM schedule_tasks t JOIN crews c ON c.id=t.crew_id
         WHERE t.id=$3 AND t.budget_id=$1 AND c.budget_id=$1)
       AND $4::date<=CURRENT_DATE
       AND NOT EXISTS(SELECT 1 FROM schedule_progress_measurements
          WHERE task_id=$3 AND worked_on=$4::date)
     RETURNING id),
   created AS (INSERT INTO schedule_progress_measurements
     (id,budget_id,task_id,worked_on,completed_quantity,workers,hours_per_worker,
      evidence_ref,evidence_notes,created_by)
     SELECT $5,guard.id,$3,$4::date,$6,$7,$8,$9,$10,$11 FROM guard RETURNING *),
   audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
     SELECT $11,'schedule_progress_measurements',created.id,'create' FROM created RETURNING id)
   SELECT created.* FROM created JOIN audit ON true`,
   [budgetId,version,b.task_id,date,mid,qty,workers,hours,evidence,notes,user.id]);
  if(!rows.length)return done(409,{error:'Versão, tarefa, data futura ou medição diária duplicada'});
  return done(201,rows[0]);
 }
 if(method==='PUT'&&measurementId){
  if(!canReview(user))return done(403,{error:'Apenas administrador ou revisor pode homologar medições'});
  if(!uuid(measurementId))return done(400,{error:'Medição inválida'});
  if(!['validado','rejeitado'].includes(b.review_status))
   return done(400,{error:'Informe validado ou rejeitado'});
  const notes=text(b.review_notes,'Justificativa da revisão',15,1500);
  const rows=await sql.query(`
   WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
     WHERE id=$1 AND lock_version=$2 AND status='rascunho'
       AND EXISTS(SELECT 1 FROM schedule_progress_measurements
          WHERE id=$3 AND budget_id=$1 AND review_status='pendente')
     RETURNING id),
   reviewed AS (UPDATE schedule_progress_measurements SET
     review_status=$4,review_notes=$5,reviewed_by=$6,reviewed_at=now()
     WHERE id=$3 AND budget_id=$1 AND review_status='pendente'
       AND EXISTS(SELECT 1 FROM guard) RETURNING *),
   audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action,metadata)
     SELECT $6,'schedule_progress_measurements',reviewed.id,'review',
       jsonb_build_object('status',$4::text) FROM reviewed RETURNING id)
   SELECT reviewed.* FROM reviewed JOIN audit ON true`,
   [budgetId,version,measurementId,b.review_status,notes,user.id]);
  if(!rows.length)return done(409,{error:'Medição não pendente ou orçamento desatualizado'});
  return done(200,rows[0]);
 }
 return done(405,{error:'Operação não permitida'});
}
