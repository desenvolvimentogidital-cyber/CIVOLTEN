/* CIVOLTEN — frentes e dependências sem registro de equipe.
 * GET lista configuração, PUT define frente/espera de serviço,
 * POST/DELETE altera precedência com detecção de ciclo e lock_version.
 */
import {planResourceSchedule} from './budget-resource-scheduler.mjs';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const canWrite=u=>['administrador','orcamentista'].includes(u?.role);
const number=(x,name,lo,hi)=>{const v=Number(x);if(!Number.isSafeInteger(v)||v<lo||v>hi)throw Object.assign(new Error(name+' inválido'),{status:400});return v};
async function readConfig(sql,id){
 const [fronts,dependencies]=await Promise.all([
  sql.query('SELECT budget_item_id,budget_id,work_front,wait_workdays FROM budget_service_planning WHERE budget_id=$1 ORDER BY work_front,budget_item_id',[id]),
  sql.query('SELECT predecessor_item_id,successor_item_id,lag_workdays FROM budget_service_dependencies WHERE budget_id=$1 ORDER BY predecessor_item_id,successor_item_id',[id])
 ]);
 return {fronts,dependencies};
}
export async function handleBudgetPlanning({req,res,sql,user,parts,method,send,readBody}){
 if(parts[0]!=='budgets'||parts[2]!=='planning-config')return false;
 const done=(status,body)=>{send(res,status,body);return true};
 if(parts.length!==3||!uuid(parts[1]))return done(400,{error:'Orçamento inválido'});
 const id=parts[1];
 const budgets=await sql.query('SELECT id,status,lock_version FROM budgets WHERE id=$1 LIMIT 1',[id]);
 if(!budgets.length)return done(404,{error:'Orçamento não encontrado'});
 if(method==='GET')return done(200,{...await readConfig(sql,id),budget:budgets[0]});
 if(!['PUT','POST','DELETE'].includes(method))return done(405,{error:'Método não permitido'});
 if(!canWrite(user))return done(403,{error:'Permissão insuficiente para editar planejamento'});
 if(budgets[0].status!=='rascunho')return done(409,{error:'Só orçamentos em rascunho podem mudar o plano'});
 const b=await readBody(req),lock=number(b.lock_version,'Versão',0,1e9);
 if(method==='PUT'){
  if(!uuid(b.budget_item_id))return done(400,{error:'Serviço inválido'});
  const front=String(b.work_front||'').trim();
  if(!front||front.length>80)return done(400,{error:'Frente precisa de 1 a 80 caracteres'});
  const wait=number(b.wait_workdays??0,'Espera técnica',0,60);
  // Só aceitar item ativo deste orçamento; a atualização do lock impede edição conflitante.
  const rows=await sql.query(
    "WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now() WHERE id=$1 AND lock_version=$2 AND status='rascunho' AND EXISTS (SELECT 1 FROM budget_items WHERE id=$3 AND budget_id=$1 AND deleted_at IS NULL) RETURNING id), changed AS (INSERT INTO budget_service_planning(budget_id,budget_item_id,work_front,wait_workdays,updated_by) SELECT $1,$3,$4,$5,$6 FROM guard ON CONFLICT (budget_item_id) DO UPDATE SET work_front=EXCLUDED.work_front,wait_workdays=EXCLUDED.wait_workdays,updated_by=EXCLUDED.updated_by,updated_at=now() WHERE budget_service_planning.budget_id=EXCLUDED.budget_id RETURNING *), audited AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action,metadata) SELECT $6,'budget_service_planning',$3,'update',jsonb_build_object('front',$4,'wait_days',$5) FROM changed RETURNING id), invalid AS (UPDATE budget_costing_profiles SET technical_reviewed=false,commercial_reviewed=false,updated_at=now() WHERE budget_id=$1 AND EXISTS(SELECT 1 FROM changed) RETURNING budget_id) SELECT changed.* FROM changed JOIN audited ON true",
    [id,lock,b.budget_item_id,front,wait,user.id]);
  return rows.length?done(200,rows[0]):done(409,{error:'Orçamento alterado; recarregue antes de editar a frente'});
 }
 const predecessor=String(b.predecessor_item_id||''),successor=String(b.successor_item_id||'');
 if(!uuid(predecessor)||!uuid(successor)||predecessor===successor)
  return done(400,{error:'Escolha dois serviços diferentes do orçamento'});
 const items=await sql.query('SELECT id,source_name FROM budget_items WHERE budget_id=$1 AND deleted_at IS NULL ORDER BY position,id',[id]);
 if(!items.some(x=>x.id===predecessor)||!items.some(x=>x.id===successor))
  return done(400,{error:'Os serviços devem pertencer a este orçamento'});
 const lag=number(b.lag_workdays??0,'Espera entre serviços',0,60);
 if(method==='POST'){
  const current=await readConfig(sql,id),next=current.dependencies.filter(d=>!(d.predecessor_item_id===predecessor&&d.successor_item_id===successor))
   .concat([{predecessor_item_id:predecessor,successor_item_id:successor,lag_workdays:lag}]);
  const check=planResourceSchedule(items.map(x=>({id:x.id,title:x.source_name,workers:1,days_at_suggested_staff:1})),{fronts:current.fronts,dependencies:next,available_workers:100});
  if(check.reason==='Ciclo nas dependências')return done(409,{error:'Dependência circular: esta atividade impediria a execução da obra'});
  const rows=await sql.query(
   "WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now() WHERE id=$1 AND lock_version=$2 AND status='rascunho' RETURNING id), changed AS (INSERT INTO budget_service_dependencies(budget_id,predecessor_item_id,successor_item_id,lag_workdays,created_by) SELECT $1,$3,$4,$5,$6 FROM guard ON CONFLICT (predecessor_item_id,successor_item_id) DO UPDATE SET lag_workdays=EXCLUDED.lag_workdays,created_by=EXCLUDED.created_by WHERE budget_service_dependencies.budget_id=EXCLUDED.budget_id RETURNING *), audited AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action,metadata) SELECT $6,'budget_service_dependencies',$4,'upsert',jsonb_build_object('predecessor',$3::text,'lag_workdays',$5) FROM changed RETURNING id), invalid AS (UPDATE budget_costing_profiles SET technical_reviewed=false,commercial_reviewed=false,updated_at=now() WHERE budget_id=$1 AND EXISTS(SELECT 1 FROM changed) RETURNING budget_id) SELECT changed.* FROM changed JOIN audited ON true",
   [id,lock,predecessor,successor,lag,user.id]);
  return rows.length?done(200,rows[0]):done(409,{error:'Conflito na alteração de dependências'});
 }
 const rows=await sql.query(
  "WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now() WHERE id=$1 AND lock_version=$2 AND status='rascunho' AND EXISTS(SELECT 1 FROM budget_service_dependencies WHERE budget_id=$1 AND predecessor_item_id=$3 AND successor_item_id=$4) RETURNING id), removed AS (DELETE FROM budget_service_dependencies WHERE budget_id=$1 AND predecessor_item_id=$3 AND successor_item_id=$4 AND EXISTS(SELECT 1 FROM guard) RETURNING *), audited AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $5,'budget_service_dependencies',$4,'delete' FROM removed RETURNING id), invalid AS (UPDATE budget_costing_profiles SET technical_reviewed=false,commercial_reviewed=false,updated_at=now() WHERE budget_id=$1 AND EXISTS(SELECT 1 FROM removed) RETURNING budget_id) SELECT removed.* FROM removed JOIN audited ON true",
  [id,lock,predecessor,successor,user.id]);
 return rows.length?done(200,{removed:true}):done(409,{error:'Dependência já removida ou orçamento alterado'});
}
