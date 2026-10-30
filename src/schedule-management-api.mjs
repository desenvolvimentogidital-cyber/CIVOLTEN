/**
 * CIVOLTEN — Etapa 3: cadastros de equipes/atividades/dependências.
 * Modificações exclusivamente em orçamentos em rascunho e com lock_version.
 * Duração criada é pendente. Só administrador/revisor pode validá-la.
 */
import {randomUUID} from 'node:crypto';

const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const str=(x,name,limit=180)=>{
 if(typeof x!=='string'||!x.trim()||x.trim().length>limit)fail(name+' inválido');
 return x.trim()
};
const num=(x,name,lo,hi)=>{
 if(x===null||x===undefined||x==='')fail(name+' obrigatório');
 const n=Number(x);if(!Number.isFinite(n)||n<lo||n>hi)fail(name+' inválido');
 return n;
};
const canWrite=user=>['administrador','orcamentista'].includes(user.role);
const canReview=user=>['administrador','revisor'].includes(user.role);
const version=b=>{
 if(!Number.isSafeInteger(b?.lock_version)||b.lock_version<0)fail('Versão do orçamento obrigatória');
 return b.lock_version;
};
const metadata=(note)=>JSON.stringify({review_note:note});

export async function handleScheduleManagement({req,res,sql,user,parts,method,send,readBody}){
 const [resource,id,sub,fourth]=parts;
 if(resource!=='budgets'||!['schedule-plan','schedule-crews','schedule-tasks','schedule-dependencies'].includes(sub))return false;
 const done=(status,body)=>{send(res,status,body);return true};
 if(!uuid(id))return done(400,{error:'Orçamento inválido'});
 const budgets=await sql.query('SELECT id,status,lock_version FROM budgets WHERE id=$1',[id]);
 if(!budgets.length)return done(404,{error:'Orçamento não encontrado'});
 const isDraft=budgets[0].status==='rascunho';
 if(sub==='schedule-plan'&&method==='GET'){
  const [crews,tasks,dependencies]=await Promise.all([
   sql.query(`SELECT c.id,c.budget_id,c.title,c.workday_hours,c.efficiency,
     COALESCE(SUM(cr.workers),0)::integer AS workers,
     COALESCE(jsonb_agg(jsonb_build_object('id',cr.id,'role_code',cr.role_code,'role_name',cr.role_name,'workers',cr.workers)) FILTER(WHERE cr.id IS NOT NULL),'[]'::jsonb) AS roles
     FROM crews c LEFT JOIN crew_roles cr ON cr.crew_id=c.id
     WHERE c.budget_id=$1 AND c.archived_at IS NULL GROUP BY c.id ORDER BY c.title`,[id]),
   sql.query(`SELECT t.id,t.title,t.crew_id,t.budget_item_id,t.days_estimated,t.duration_review_state,
       bi.source_name AS budget_service, bi.deleted_at
     FROM schedule_tasks t LEFT JOIN budget_items bi ON bi.id=t.budget_item_id
     WHERE t.budget_id=$1 AND t.archived_at IS NULL ORDER BY t.title,t.id`,[id]),
   sql.query(`SELECT d.predecessor_id,d.successor_id,d.dependency_type,d.lag_days
     FROM task_dependencies d JOIN schedule_tasks t ON t.id=d.successor_id JOIN schedule_tasks p ON p.id=d.predecessor_id
     WHERE t.budget_id=$1 AND t.archived_at IS NULL AND p.archived_at IS NULL ORDER BY d.successor_id,d.predecessor_id`,[id])
  ]);
  return done(200,{budget:budgets[0],crews,tasks,dependencies,commercial_release:false});
 }
 if(!['POST','PUT','DELETE'].includes(method))return done(405,{error:'Método não permitido'});
 if(!isDraft)return done(409,{error:'Somente orçamento em rascunho permite edição de cronograma'});
 const b=await readBody(req),lock=version(b);
 if(sub==='schedule-crews'&&method==='PUT'&&fourth){
  if(!canWrite(user))return done(403,{error:'Permissão insuficiente'});
  if(!uuid(fourth))return done(400,{error:'Equipe inválida'});
  const title=str(b.title,'Equipe',160),hours=num(b.workday_hours,'Jornada',1,12),
   efficiency=num(b.efficiency,'Eficiência',0.01,1);
  // Uma medição já realizada preserva os parâmetros de pessoal e jornada históricos.
  const rows=await sql.query(`
   WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
     WHERE id=$1 AND lock_version=$2 AND status='rascunho'
       AND EXISTS(SELECT 1 FROM crews WHERE id=$3 AND budget_id=$1 AND archived_at IS NULL)
       AND NOT EXISTS(SELECT 1 FROM schedule_progress_measurements m
         JOIN schedule_tasks t ON t.id=m.task_id WHERE t.crew_id=$3 AND t.budget_id=$1)
     RETURNING id),
   changed AS (UPDATE crews SET title=$4,workday_hours=$5,efficiency=$6
     WHERE id=$3 AND budget_id=$1 AND archived_at IS NULL
       AND EXISTS(SELECT 1 FROM guard) RETURNING *),
   audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
     SELECT $7,'crews',changed.id,'update' FROM changed RETURNING id)
   SELECT changed.* FROM changed JOIN audit ON true`,
   [id,lock,fourth,title,hours,efficiency,user.id]);
  if(!rows.length)return done(409,{error:'Equipe não editável: versão ou medições anteriores'});
  return done(200,rows[0]);
 }
 if(sub==='schedule-crews'&&method==='DELETE'&&fourth){
  if(!canWrite(user))return done(403,{error:'Permissão insuficiente'});
  if(!uuid(fourth))return done(400,{error:'Equipe inválida'});
  const rows=await sql.query(`
   WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
     WHERE id=$1 AND lock_version=$2 AND status='rascunho'
       AND EXISTS(SELECT 1 FROM crews WHERE id=$3 AND budget_id=$1 AND archived_at IS NULL)
       AND NOT EXISTS(SELECT 1 FROM schedule_tasks
         WHERE crew_id=$3 AND budget_id=$1 AND archived_at IS NULL)
     RETURNING id),
   archived AS (UPDATE crews SET archived_at=now()
     WHERE id=$3 AND budget_id=$1 AND archived_at IS NULL
       AND EXISTS(SELECT 1 FROM guard) RETURNING *),
   audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
     SELECT $4,'crews',archived.id,'archive' FROM archived RETURNING id)
   SELECT archived.* FROM archived JOIN audit ON true`,
   [id,lock,fourth,user.id]);
  if(!rows.length)return done(409,{error:'Equipe não pode ser arquivada com atividades ativas'});
  return done(200,{...rows[0],archived:true});
 }
 if(sub==='schedule-tasks'&&method==='PUT'&&fourth&&b.action==='edit'){
  if(!canWrite(user))return done(403,{error:'Permissão insuficiente'});
  if(!uuid(fourth)||!uuid(b.crew_id))return done(400,{error:'Atividade ou equipe inválida'});
  const title=str(b.title,'Atividade',200);
  const days=num(b.duration_workdays,'Duração',1,9000);
  if(!Number.isSafeInteger(days))return done(400,{error:'Duração deve ser inteira'});
  const itemId=b.budget_item_id||null;
  if(itemId!==null&&!uuid(itemId))return done(400,{error:'Serviço inválido'});
  const rows=await sql.query(`
   WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
      WHERE id=$1 AND lock_version=$2 AND status='rascunho'
       AND EXISTS(SELECT 1 FROM schedule_tasks WHERE id=$3 AND budget_id=$1 AND archived_at IS NULL)
       AND EXISTS(SELECT 1 FROM crews WHERE id=$4 AND budget_id=$1 AND archived_at IS NULL)
       AND ($5::uuid IS NULL OR EXISTS(SELECT 1 FROM budget_items
         WHERE id=$5 AND budget_id=$1 AND deleted_at IS NULL))
       AND NOT EXISTS(SELECT 1 FROM schedule_progress_measurements WHERE task_id=$3)
      RETURNING id),
   changed AS (UPDATE schedule_tasks SET title=$6,crew_id=$4,budget_item_id=$5,
      days_estimated=$7,duration_review_state='pendente'
      WHERE id=$3 AND budget_id=$1 AND archived_at IS NULL
        AND EXISTS(SELECT 1 FROM guard) RETURNING *),
   audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
     SELECT $8,'schedule_tasks',changed.id,'update' FROM changed RETURNING id)
   SELECT changed.* FROM changed JOIN audit ON true`,
   [id,lock,fourth,b.crew_id,itemId,title,days,user.id]);
  if(!rows.length)return done(409,{error:'Atividade não editável: versão, equipe ou medição existente'});
  return done(200,rows[0]);
 }
 if(sub==='schedule-tasks'&&method==='DELETE'&&fourth){
  if(!canWrite(user))return done(403,{error:'Permissão insuficiente'});
  if(!uuid(fourth))return done(400,{error:'Atividade inválida'});
  const rows=await sql.query(`
   WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
     WHERE id=$1 AND lock_version=$2 AND status='rascunho'
       AND EXISTS(SELECT 1 FROM schedule_tasks WHERE id=$3 AND budget_id=$1 AND archived_at IS NULL)
       AND NOT EXISTS(SELECT 1 FROM schedule_progress_measurements WHERE task_id=$3)
       AND NOT EXISTS(SELECT 1 FROM task_dependencies
         WHERE predecessor_id=$3 OR successor_id=$3)
     RETURNING id),
   archived AS (UPDATE schedule_tasks SET archived_at=now(),duration_review_state='pendente'
     WHERE id=$3 AND budget_id=$1 AND archived_at IS NULL AND EXISTS(SELECT 1 FROM guard)
      RETURNING *),
   audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
     SELECT $4,'schedule_tasks',archived.id,'archive' FROM archived RETURNING id)
   SELECT archived.* FROM archived JOIN audit ON true`,
   [id,lock,fourth,user.id]);
  if(!rows.length)return done(409,{error:'Atividade não pode ser arquivada com medições ou dependências'});
  return done(200,{...rows[0],archived:true});
 }
 if(sub==='schedule-dependencies'&&method==='DELETE'&&fourth){
  if(!canWrite(user))return done(403,{error:'Permissão insuficiente'});
  if(!uuid(fourth)||!uuid(b.successor_id))return done(400,{error:'Dependência inválida'});
  const rows=await sql.query(`
   WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
     WHERE id=$1 AND lock_version=$2 AND status='rascunho'
       AND EXISTS(SELECT 1 FROM task_dependencies d
        JOIN schedule_tasks t ON t.id=d.successor_id
        JOIN schedule_tasks p ON p.id=d.predecessor_id
        WHERE d.predecessor_id=$3 AND d.successor_id=$4
        AND t.budget_id=$1 AND p.budget_id=$1)
     RETURNING id),
   removed AS (DELETE FROM task_dependencies
      WHERE predecessor_id=$3 AND successor_id=$4
       AND EXISTS(SELECT 1 FROM guard) RETURNING *),
   audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action,metadata)
     SELECT $5,'task_dependencies',removed.successor_id,'delete',
       jsonb_build_object('predecessor_id',$3::uuid)
     FROM removed RETURNING id)
   SELECT removed.* FROM removed JOIN audit ON true`,
   [id,lock,fourth,b.successor_id,user.id]);
  if(!rows.length)return done(409,{error:'Dependência não encontrada ou versão desatualizada'});
  return done(200,{removed:true});
 }
 if(sub==='schedule-crews'&&method==='POST'&&!fourth){
  if(!canWrite(user))return done(403,{error:'Permissão insuficiente'});
  const title=str(b.title,'Equipe',160);
  const hours=num(b.workday_hours,'Jornada',1,12);
  const efficiency=num(b.efficiency,'Eficiência',0.01,1);
  const workers=num(b.workers,'Número de profissionais',1,100);
  if(!Number.isInteger(workers))return done(400,{error:'Número de profissionais deve ser inteiro'});
  const roleCode=str(b.role_code,'Código da profissão',45);
  if(!/^[a-z0-9_-]{2,45}$/.test(roleCode))return done(400,{error:'Código da profissão inválido'});
  const roleName=str(b.role_name,'Nome da profissão',160),crewId=randomUUID(),roleId=randomUUID();
  const inserted=await sql.query(`
    WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
        WHERE id=$1 AND lock_version=$2 AND status='rascunho' RETURNING id),
    crew AS (INSERT INTO crews(id,budget_id,title,workday_hours,efficiency)
        SELECT $3,guard.id,$4,$5,$6 FROM guard RETURNING *),
    role AS (INSERT INTO crew_roles(id,crew_id,role_code,role_name,workers)
        SELECT $7,crew.id,$8,$9,$10 FROM crew RETURNING id),
    audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
        SELECT $11,'crews',crew.id,'create' FROM crew RETURNING id)
    SELECT crew.* FROM crew JOIN role ON true JOIN audit ON true`,
    [id,lock,crewId,title,hours,efficiency,roleId,roleCode,roleName,workers,user.id]);
  if(!inserted.length)return done(409,{error:'Orçamento alterado; atualize o cronograma'});
  return done(201,{...inserted[0],workers,role_name:roleName});
 }
 if(sub==='schedule-tasks'&&method==='POST'&&!fourth){
  if(!canWrite(user))return done(403,{error:'Permissão insuficiente'});
  const title=str(b.title,'Atividade',200),crewId=b.crew_id;
  if(!uuid(crewId))return done(400,{error:'Equipe inválida'});
  const days=num(b.duration_workdays,'Dias úteis previstos',1,9000);
  if(!Number.isSafeInteger(days))return done(400,{error:'Duração em dias úteis inteiros obrigatória'});
  const itemId=b.budget_item_id||null;
  if(itemId!==null&&!uuid(itemId))return done(400,{error:'Serviço vinculado inválido'});
  const createdId=randomUUID();
  const rows=await sql.query(`
    WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
        WHERE id=$1 AND lock_version=$2 AND status='rascunho'
        AND EXISTS(SELECT 1 FROM crews WHERE id=$4 AND budget_id=$1 AND archived_at IS NULL)
        AND ($5::uuid IS NULL OR EXISTS(SELECT 1 FROM budget_items
           WHERE id=$5 AND budget_id=$1 AND deleted_at IS NULL)) RETURNING id),
    task AS (INSERT INTO schedule_tasks(id,budget_id,crew_id,budget_item_id,title,days_estimated,duration_review_state)
        SELECT $3,guard.id,$4,$5,$6,$7,'pendente' FROM guard RETURNING *),
    audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
        SELECT $8,'schedule_tasks',task.id,'create' FROM task RETURNING id)
    SELECT task.* FROM task JOIN audit ON true`,
    [id,lock,createdId,crewId,itemId,title,days,user.id]);
  if(!rows.length)return done(409,{error:'Orçamento alterado, equipe ou serviço incompatível'});
  return done(201,rows[0]);
 }
 if(sub==='schedule-tasks'&&method==='PUT'&&fourth){
  if(!canReview(user))return done(403,{error:'Somente administrador ou revisor pode validar durações'});
  if(!uuid(fourth))return done(400,{error:'Atividade inválida'});
  const note=str(b.review_note,'Justificativa técnica da duração',1500);
  if(note.length<12)return done(400,{error:'Justificativa técnica deve ter pelo menos 12 caracteres'});
  const days=num(b.duration_workdays,'Dias úteis revisados',1,9000);
  if(!Number.isSafeInteger(days))return done(400,{error:'Duração inteira obrigatória'});
  const rows=await sql.query(`
    WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
      WHERE id=$1 AND lock_version=$2 AND status='rascunho'
        AND EXISTS(SELECT 1 FROM schedule_tasks WHERE id=$3 AND budget_id=$1 AND archived_at IS NULL) RETURNING id),
    task AS (UPDATE schedule_tasks SET days_estimated=$4,duration_review_state='revisado'
      WHERE id=$3 AND budget_id=$1 AND archived_at IS NULL AND EXISTS(SELECT 1 FROM guard) RETURNING *),
    audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action,metadata)
      SELECT $5,'schedule_tasks',task.id,'duration_reviewed',$6::jsonb FROM task RETURNING id)
    SELECT task.* FROM task JOIN audit ON true`,[id,lock,fourth,days,user.id,metadata(note)]);
  if(!rows.length)return done(409,{error:'Atividade inexistente ou orçamento alterado'});
  return done(200,rows[0]);
 }
 if(sub==='schedule-dependencies'&&method==='POST'&&!fourth){
  if(!canWrite(user))return done(403,{error:'Permissão insuficiente'});
  const from=b.predecessor_id,to=b.successor_id;
  if(!uuid(from)||!uuid(to)||from===to)return done(400,{error:'Dependência inválida'});
  // Verificação de ciclo: caminho to->from existente impossibilita nova aresta from->to.
  const circular=await sql.query(`WITH RECURSIVE paths(id) AS (
     SELECT $1::uuid UNION SELECT d.successor_id FROM task_dependencies d
     JOIN paths p ON p.id=d.predecessor_id JOIN schedule_tasks t ON t.id=d.successor_id
     WHERE t.budget_id=$3
     ) SELECT EXISTS(SELECT 1 FROM paths WHERE id=$2::uuid) AS found`,[to,from,id]);
  if(circular[0]?.found)return done(409,{error:'Dependência cria ciclo no cronograma'});
  const rows=await sql.query(`
    WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
      WHERE id=$1 AND lock_version=$2 AND status='rascunho'
        AND (SELECT count(*) FROM schedule_tasks WHERE budget_id=$1 AND archived_at IS NULL AND id IN ($3,$4))=2
        AND NOT EXISTS(SELECT 1 FROM task_dependencies WHERE predecessor_id=$3 AND successor_id=$4)
      RETURNING id),
    edge AS (INSERT INTO task_dependencies(predecessor_id,successor_id,dependency_type,lag_days)
      SELECT $3,$4,'FS',0 FROM guard RETURNING *),
    audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action,metadata)
      SELECT $5,'task_dependencies',edge.successor_id,'create',
        jsonb_build_object('predecessor_id',$3::uuid) FROM edge RETURNING id)
    SELECT edge.* FROM edge JOIN audit ON true`,[id,lock,from,to,user.id]);
  if(!rows.length)return done(409,{error:'Versão alterada, tarefas incompatíveis ou dependência duplicada'});
  return done(201,rows[0]);
 }
 return done(405,{error:'Rota de cronograma não permitida'});
}
