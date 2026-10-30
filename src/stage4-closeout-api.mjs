/* Etapa 4: recebimentos, custo a completar e prontidão comercial.
 * Sem confundir pagamento registrado com faturamento/nota fiscal.
 */
import {randomUUID} from 'node:crypto';
import {readCostEstimate} from './stage4-finance-api.mjs';
import {financialProgress} from './stage4-financial-metrics.mjs';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const error=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const text=(v,field,min,max)=>{
 if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)error(field+' inválido');
 return v.trim();
};
const amount=(v,{zero=false}={})=>{
 if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(v)))error('Valor monetário inválido');
 const n=Number(v);if(!Number.isFinite(n)||(zero?n<0:n<=0)||n>100000000)
  error('Valor fora dos limites');
 return String(v);
};
const day=(v)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'')||!Number.isFinite(Date.parse(v+'T12:00:00Z'))||
  new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)error('Data inválida');
 return v;
};
const permitWrite=user=>['administrador','orcamentista'].includes(user.role);
const permitReview=user=>['administrador','revisor'].includes(user.role);
const version=b=>{
 if(!Number.isSafeInteger(b?.lock_version)||b.lock_version<0)error('Versão do orçamento obrigatória');
 return b.lock_version;
};
const kinds={
 'financial-receipts':{
  table:'budget_cash_receipts',date:'received_on',
  fields:'amount,received_on,method,payer_name,evidence_ref,evidence_notes',
  title:'Recebimento',
  values:(b)=>({
   amount:amount(b.amount),
   received_on:day(b.received_on),
   method:['pix','transferencia','boleto','cartao','dinheiro','outro'].includes(b.method)?
    b.method:error('Meio de pagamento inválido'),
   payer_name:text(b.payer_name,'Pagador',3,180),
   evidence_ref:text(b.evidence_ref,'Referência',6,180),
   evidence_notes:text(b.evidence_notes,'Comprovante',15,1500)
  })
 },
 'financial-forecasts':{
  table:'budget_completion_forecasts',date:'as_of',
  fields:'expected_remaining_cost,as_of,evidence_ref,assumptions,includes_pending_costs',
  title:'Custo restante',
  values:(b)=>({
   expected_remaining_cost:amount(b.expected_remaining_cost,{zero:true}),
   as_of:day(b.as_of),
   evidence_ref:text(b.evidence_ref,'Referência',6,180),
   assumptions:text(b.assumptions,'Premissas',20,3000),
   includes_pending_costs:b.includes_pending_costs===true
  })
 }
};
export async function handleStage4Closeout(ctx){
 const {req,res,sql,user,parts,method,send,readBody}=ctx;
 const [resource,id,sub,fourth]=parts;
 if(resource!=='budgets'||!(sub in kinds||sub==='financial-closeout'||sub==='commercial-readiness'))return false;
 const done=(status,payload)=>{send(res,status,payload);return true};
 if(!uuid(id))return done(400,{error:'Orçamento inválido'});
 const budgetRows=await sql.query('SELECT id,code,status,lock_version FROM budgets WHERE id=$1',[id]);
 if(!budgetRows.length)return done(404,{error:'Orçamento não encontrado'});
 const budget=budgetRows[0];
 if(sub==='commercial-readiness'&&method==='GET'){
  const costing=await readCostEstimate(ctx,id);
  const drafts=await sql.query(`SELECT version,budget_lock_version,snapshot_sha256
    FROM proposal_draft_snapshots WHERE budget_id=$1 ORDER BY version DESC LIMIT 1`,[id]);
  const reasons=[];
  if(!costing.estimate.ready)reasons.push('Custos, cotações, BDI ou tributos sem validação integral');
  if(!drafts.length)reasons.push('Não existe versão de proposta documentada');
  if(drafts.length&&Number(drafts[0].budget_lock_version)!==Number(budget.lock_version))
   reasons.push('Snapshot da proposta desatualizado');
  reasons.push('Emissão profissional, assinatura e aceite do cliente não homologados');
  reasons.push('Revisão tributária e prova de identidade do aceitante pendentes');
  return done(200,{ready:false,commercial_release:false,blocked_actions:['issue','send','accept','sign'],
   cost_engine_ready:costing.estimate.ready,latest_draft_version:drafts[0]?.version||null,reasons,
   note:'Não registrar como aceite do cliente um clique interno ou um PDF rascunho.'});
 }
 if(sub==='financial-closeout'&&method==='GET'){
  const [costing,costs,receipts,forecasts]=await Promise.all([
   readCostEstimate(ctx,id),
   sql.query(`SELECT status,SUM(amount)::text AS amount
     FROM budget_actual_costs WHERE budget_id=$1 GROUP BY status`,[id]),
   sql.query(`SELECT status,SUM(amount)::text AS amount
     FROM budget_cash_receipts WHERE budget_id=$1 GROUP BY status`,[id]),
   sql.query(`SELECT id,expected_remaining_cost::text,reviewed_at,created_at,
      includes_pending_costs,assumptions,as_of,status FROM budget_completion_forecasts
     WHERE budget_id=$1 AND status='validado' ORDER BY reviewed_at DESC,id DESC LIMIT 1`,[id])
  ]);
  const financial=financialProgress({budgetDirect:String(costing.estimate.direct_cost_reais),
    indicativePrice:String(costing.estimate.total_reais),
    actualCosts:costs,receipts,forecasts});
  const forecast=forecasts[0]||null;
  const latestCost=await sql.query(`SELECT MAX(reviewed_at) AS reviewed_at
    FROM budget_actual_costs WHERE budget_id=$1 AND status='validado'`,[id]);
  const needsRefresh=!!(forecast&&latestCost[0]?.reviewed_at &&
   new Date(latestCost[0].reviewed_at)>new Date(forecast.reviewed_at));
  return done(200,{budget,metrics:financial,
   verified_forecast:forecast,needs_forecast_refresh:needsRefresh,
   commercial_release:false,
   notice:'Resumo preliminar: sem assinatura comercial nem receitas tributáveis confirmadas. Revisar o custo a completar quando houver gastos novos.'});
 }
 const kind=kinds[sub];
 if(!kind)return done(405,{error:'Método não permitido'});
 if(method==='GET'&&!fourth){
  const list=await sql.query(`SELECT * FROM ${kind.table} WHERE budget_id=$1
    ORDER BY created_at DESC,id DESC LIMIT 250`,[id]);
  return done(200,{budget,records:list,shown_latest:list.length,
   note:'Listagem recente; totais completos no resumo de fechamento.',commercial_release:false});
 }
 if(method==='GET'&&fourth)return done(405,{error:'Consulta detalhada indisponível'});
 if(!['POST','PUT'].includes(method))return done(405,{error:'Método não permitido'});
 if(budget.status!=='rascunho')return done(409,{error:'Alteração permitida apenas no orçamento rascunho'});
 const b=await readBody(req),lock=version(b);
 if(method==='POST'&&!fourth){
  if(!permitWrite(user))return done(403,{error:'Perfil não autorizado'});
  const v=kind.values(b);
  const rowId=randomUUID(),values=Object.values(v),cols=Object.keys(v);
  const dateIndex=cols.indexOf(kind.date)+4;
  const refIndex=cols.indexOf('evidence_ref')+4;
  const sqlValues=cols.map((_,i)=>'$'+(i+4)).join(',');
  const saved=await sql.query(`
   WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
      WHERE id=$1 AND lock_version=$2 AND status='rascunho'
      AND $${dateIndex}::date<=CURRENT_DATE
      AND NOT EXISTS (SELECT 1 FROM ${kind.table}
        WHERE budget_id=$1 AND evidence_ref=$${refIndex})
      RETURNING id),
   created AS (INSERT INTO ${kind.table}
      (id,budget_id,${cols.join(',')},created_by)
      SELECT $3,guard.id,${sqlValues},$${cols.length+4} FROM guard RETURNING *),
   audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
      SELECT $${cols.length+4},'${kind.table}',created.id,'create' FROM created RETURNING id)
   SELECT created.* FROM created JOIN audit ON true`,
   [id,lock,rowId,...values,user.id]);
  if(!saved.length)return done(409,{error:'Versão, data ou referência repetida'});
  return done(201,saved[0]);
 }
 if(method==='PUT'&&fourth){
  if(!permitReview(user))return done(403,{error:'Revisão exige administrador ou revisor'});
  if(!uuid(fourth))return done(400,{error:'Registro inválido'});
  const state=b.status;
  if(!['validado','rejeitado'].includes(state))return done(400,{error:'Informe validado ou rejeitado'});
  const notes=text(b.review_notes,'Justificativa da revisão',15,1500);
  const saved=await sql.query(`
    WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
      WHERE id=$1 AND lock_version=$2 AND status='rascunho'
       AND EXISTS (SELECT 1 FROM ${kind.table}
         WHERE id=$3 AND budget_id=$1 AND status='pendente' AND created_by<>$6)
      RETURNING id),
    reviewed AS (UPDATE ${kind.table} SET status=$4,review_notes=$5,reviewed_by=$6,
      reviewed_at=now() WHERE id=$3 AND budget_id=$1 AND status='pendente'
       AND EXISTS (SELECT 1 FROM guard) RETURNING *),
    audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action,metadata)
      SELECT $6,'${kind.table}',reviewed.id,'review',
       jsonb_build_object('result',$4::text) FROM reviewed RETURNING id)
    SELECT reviewed.* FROM reviewed JOIN audit ON true`,
   [id,lock,fourth,state,notes,user.id]);
  if(!saved.length)return done(409,{error:'Registro não pendente, criador igual ao revisor ou versão alterada'});
  return done(200,saved[0]);
 }
 return done(405,{error:'Operação indisponível'});
}
