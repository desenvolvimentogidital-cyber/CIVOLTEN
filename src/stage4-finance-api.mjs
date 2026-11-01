/* CIVOLTEN Etapa 4: rascunhos versionados, custos realizados e margem INDICATIVA.
 * Nunca emite proposta comercial. Fonte de custos: motor autenticado da Etapa 2.
 */
import {randomUUID,createHash} from 'node:crypto';
import {handleStage2} from './costing-api.mjs';
import {handleWorkforceEstimate} from './workforce-estimate-api.mjs';
import {prepareProposalScope,proposalModes} from './proposal-scope-mode.mjs';
import {renderProposalDraftPdf} from './proposal-draft-pdf.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[89ab0-9a-f]{12}$/i.test(v);
const canWrite=user=>['administrador','orcamentista'].includes(user.role);
const canReview=user=>['administrador','revisor'].includes(user.role);
const fail=(m,status=400)=>{throw Object.assign(new Error(m),{status})};
const str=(x,n,min,max)=>{
 if(typeof x!=='string'||x.trim().length<min||x.trim().length>max)fail(n+' inválido');
 return x.trim();
};
const positiveMoney=(x)=>{
 if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(x||'')))fail('Valor monetário inválido');
 const n=Number(x);if(!Number.isFinite(n)||n<=0||n>100000000)fail('Valor fora do limite');
 return String(x);
};
const version=b=>{
 if(!Number.isSafeInteger(b?.lock_version)||b.lock_version<0)fail('lock_version obrigatório');
 return b.lock_version;
};
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value instanceof Date)return value.toISOString();
 if(value!==null&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 return value;
}
export async function readCostEstimate(ctx,budgetId){
 let status=500,data=null;
 const handled=await handleStage2({...ctx,parts:['budgets',budgetId,'costs'],
  method:'GET',send:(_res,s,p)=>{status=s;data=p}});
 if(!handled||status!==200)fail('Orçamento sem composição de custos acessível',409);
 return data;
}
const money=n=>Number(Math.round(Number(n)*100)/100);
export async function handleStage4(ctx){
 const {req,res,sql,user,parts,method,send,readBody}=ctx;
 const [resource,budgetId,sub,fourth,fifth]=parts;
 if(resource!=='budgets'||!['proposal-drafts','financial-actuals','financial-summary'].includes(sub))return false;
 const done=(code,data)=>{send(res,code,data);return true};
 if(!uuid(budgetId))return done(400,{error:'Orçamento inválido'});
 const rows=await sql.query(`SELECT b.id,b.code,b.title,b.status,b.lock_version,b.reference_month,b.regime,
   b.validity_days,b.payment_terms,b.scope_assumptions,b.exclusions,b.planned_start,
   c.name AS client_name,c.tax_id AS client_tax_id,
   p.title AS project_title,p.address AS project_address
   FROM budgets b JOIN clients c ON c.id=b.client_id
   LEFT JOIN projects p ON p.id=b.project_id WHERE b.id=$1`,[budgetId]);
 if(!rows.length)return done(404,{error:'Orçamento não encontrado'});
 const budget=rows[0],base='rascunho'===budget.status;
 if(sub==='financial-summary'&&method==='GET'){
  const estimate=await readCostEstimate(ctx,budgetId);
  const [status,actuals]=await Promise.all([
   sql.query(`SELECT status,COUNT(*)::int AS records,
    COALESCE(SUM(amount),0)::numeric(18,2) AS amount
    FROM budget_actual_costs WHERE budget_id=$1 GROUP BY status`,[budgetId]),
   sql.query(`SELECT category,
     COALESCE(SUM(amount),0)::numeric(18,2) AS validated_amount
     FROM budget_actual_costs WHERE budget_id=$1 AND status='validado'
     GROUP BY category ORDER BY category`,[budgetId])
  ]);
  const validated=money(status.find(r=>r.status==='validado')?.amount||0),
   pending=money(status.find(r=>r.status==='pendente')?.amount||0),
   baseline=money(estimate.estimate.direct_cost_reais),
   price=money(estimate.estimate.total_reais);
  return done(200,{budget:{id:budget.id,code:budget.code,lock_version:budget.lock_version,status:budget.status},
   estimate:{...estimate.estimate,ready:estimate.estimate.ready},
   actuals:{validated_reais:validated,pending_reais:pending,
    categories:actuals,counts:status},
   comparison:{budget_direct_reais:baseline,budget_sell_reais:price,
    budget_contribution_reais:money(price-baseline),
    indicative_budget_contribution_pct:price>0?money((price-baseline)/price*100):null,
    actual_spend_pct_of_direct_baseline:baseline>0?money(validated/baseline*100):null,
    difference_actual_to_direct_baseline_reais:money(baseline-validated),
    final_profit_reais:null,final_profit_margin_pct:null},
   note:'Medições de custo validadas não representam custo total final. Contribuição orçada não é lucro líquido e não desconta todos os tributos. Sem custo a completar e receitas realizadas, margem efetiva é indeterminada.',
   commercial_release:false});
 }
 if(sub==='financial-actuals'&&method==='GET'&&!fourth){
  const costs=await sql.query(`SELECT id,category,description,amount,incurred_on,evidence_ref,evidence_notes,
   status,created_by,created_at,reviewed_by,reviewed_at,review_notes
   FROM budget_actual_costs WHERE budget_id=$1 ORDER BY incurred_on DESC,created_at DESC LIMIT 300`,[budgetId]);
  return done(200,{budget:{id:budgetId,lock_version:budget.lock_version,status:budget.status},
    costs,commercial_release:false});
 }
 if(sub==='proposal-drafts'&&method==='GET'){
  if(fourth){
   if(!uuid(fourth))return done(400,{error:'Rascunho inválido'});
   const drafts=await sql.query(`SELECT id,version,budget_lock_version,snapshot,snapshot_sha256,
     status,created_at FROM proposal_draft_snapshots WHERE id=$1 AND budget_id=$2`,[fourth,budgetId]);
   if(!drafts.length)return done(404,{error:'Rascunho inexistente'});
   // Integridade do JSONB: canonicalizar e conferir o SHA-256 antes da leitura
   // e do PDF. A versão persistida não pode ser aceita se sofrer mutação.
   const expectedHash=createHash('sha256')
     .update(JSON.stringify(canonical(drafts[0].snapshot))).digest('hex');
   if(expectedHash!==String(drafts[0].snapshot_sha256).trim().toLowerCase())
    return done(409,{error:'Integridade da proposta não confirmada; snapshot divergente'});
   if(fifth==='pdf'){
    const pdf=await renderProposalDraftPdf(drafts[0].snapshot,{
      version:drafts[0].version,sha256:drafts[0].snapshot_sha256});
    res.statusCode=200;
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','attachment; filename="civolten-rascunho-v'+drafts[0].version+'.pdf"');
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.end(pdf);
    return true;
   }
   if(fifth)return done(404,{error:'Arquivo não encontrado'});
   return done(200,{...drafts[0],stale:budget.lock_version!==drafts[0].budget_lock_version,
    commercial_release:false});
  }
  const drafts=await sql.query(`SELECT id,version,budget_lock_version,snapshot_sha256,
    status,created_at FROM proposal_draft_snapshots WHERE budget_id=$1
    ORDER BY version DESC LIMIT 100`,[budgetId]);
  return done(200,{drafts:drafts.map(d=>({...d,stale:d.budget_lock_version!==budget.lock_version})),
   budget:{id:budget.id,lock_version:budget.lock_version},commercial_release:false});
 }
 if(!['POST','PUT'].includes(method))return done(405,{error:'Método não permitido'});
 if(!base)return done(409,{error:'Orçamento bloqueado para operações financeiras de homologação'});
 const b=await readBody(req),lock=version(b);
 if(sub==='proposal-drafts'&&method==='POST'&&!fourth){
  if(!canWrite(user))return done(403,{error:'Perfil não autorizado'});
  const scope=str(b.scope,'Escopo',15,5000),exclusions=str(b.exclusions,'Exclusões',10,3000),
    payment=str(b.payment_terms,'Condições de pagamento',10,1000);
  const validity=Number(b.validity_days??30);
  if(!Number.isSafeInteger(validity)||validity<1||validity>365)return done(400,{error:'Validade inválida'});
  const costing=await readCostEstimate(ctx,budgetId);
  const proposalMode=b.proposal_mode??proposalModes.full; // Compatibilidade de rascunhos antigos.
  if(!Object.values(proposalModes).includes(proposalMode))return done(400,{error:'Modalidade de proposta inválida'});
  const items=await sql.query(`SELECT id,position,source_code,source_name,unit,quantity,direct_unit_cost
    FROM budget_items WHERE budget_id=$1 AND deleted_at IS NULL ORDER BY position,id`,[budgetId]);
  if(!items.length)return done(409,{error:'Rascunho de proposta exige ao menos um serviço'});
  let workforce=null;
  if(proposalMode===proposalModes.labor){
   let status=503,payload=null;
   await handleWorkforceEstimate({...ctx,parts:['budgets',budgetId,'workforce-estimate'],
    method:'GET',send:(_r,code,data)=>{status=code;payload=data}});
   if(status!==200)return done(409,{error:payload?.error||'Produtividade SIURB indisponível'});
   workforce=payload;
  }
  let saleInputs=null;
  if(proposalMode===proposalModes.labor){
   // Preço apenas orientativo: exige tributos e rateio do proprietário
   // explicitamente informados. Nunca inferir uma alíquota "vigente".
   const supplied=b.service_tax_pct!==undefined&&b.service_tax_pct!==''||
    b.owner_allocation_reais!==undefined&&b.owner_allocation_reais!=='';
   if(supplied){
    const percent=x=>typeof x==='string'&&/^(?:0|[1-9][0-9]*)(?:[.][0-9]{1,2})?$/.test(x)&&Number(x)<=60;
    const money=x=>typeof x==='string'&&/^(?:0|[1-9][0-9]*)(?:[.][0-9]{1,2})?$/.test(x)&&Number(x)<=100000000;
    if(!percent(b.service_tax_pct)||!money(b.owner_allocation_reais))
     return done(400,{error:'Informe tributação de serviços e rateio de pró-labore explicitamente, sem valores presumidos'});
    const pricing=await sql.query(
     'SELECT target_margin_pct FROM company_pricing_config WHERE singleton=1',[]);
    saleInputs={service_tax_pct:b.service_tax_pct,
      owner_allocation_reais:b.owner_allocation_reais,
      target_margin_pct:pricing[0]?.target_margin_pct??null};
   }
  }
  const scopePricing=prepareProposalScope(proposalMode,{budgetItems:items,costing,workforce,saleInputs});
  const snapshot=canonical({model:'civolten-proposal-draft-v1',budget:{id:budget.id,code:budget.code,
   title:budget.title,reference_month:budget.reference_month,regime:budget.regime,
   lock_version:budget.lock_version+1},
   client:{name:budget.client_name,tax_id:budget.client_tax_id},
   project:{title:budget.project_title,address:budget.project_address},
   proposal_mode:proposalMode,scope_pricing:scopePricing,
   items:scopePricing.items,
   scope,exclusions,payment_terms:payment,validity_days:validity,
   costs:proposalMode===proposalModes.labor?{
    direct_reais:scopePricing.labor_cost_reference_reais,
    bdi_reais:null,contingency_reais:null,total_reais:null,ready:false,
    blocking_errors:scopePricing.issues.map(message=>({message}))
   }:{direct_reais:costing.estimate.direct_cost_reais,
    bdi_reais:costing.estimate.bdi_amount_reais,contingency_reais:costing.estimate.contingency_reais,
    total_reais:costing.estimate.total_reais,ready:costing.estimate.ready,
    blocking_errors:costing.estimate.errors},
   commercial_release:false,issued:false});
  const snapshotJson=JSON.stringify(snapshot),
   sha=createHash('sha256').update(snapshotJson).digest('hex'),draftId=randomUUID();
  const saved=await sql.query(`
   WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
      WHERE id=$1 AND lock_version=$2 AND status='rascunho' RETURNING id),
   created AS (INSERT INTO proposal_draft_snapshots
      (id,budget_id,version,budget_lock_version,snapshot,snapshot_sha256,created_by)
      SELECT $3,guard.id,COALESCE((SELECT MAX(version)+1 FROM proposal_draft_snapshots
          WHERE budget_id=$1),1),$2+1,$4::jsonb,$5,$6
      FROM guard RETURNING *),
   audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
      SELECT $6,'proposal_draft_snapshots',created.id,'create'
      FROM created RETURNING id)
   SELECT created.* FROM created JOIN audit ON true`,
   [budgetId,lock,draftId,snapshotJson,sha,user.id]);
  if(!saved.length)return done(409,{error:'Orçamento alterado; atualize antes de criar proposta'});
  return done(201,{id:draftId,version:saved[0].version,snapshot_sha256:sha,
   proposal_mode:proposalMode,scope_cost_complete:scopePricing.complete,
   cost_estimate_ready:proposalMode===proposalModes.full&&costing.estimate.ready,commercial_release:false,
   notice:'Rascunho interno versionado. Não enviar ao cliente como proposta comercial.'});
 }
 if(sub==='financial-actuals'&&method==='POST'&&!fourth){
  if(!canWrite(user))return done(403,{error:'Perfil não autorizado'});
  const categories=['mao_de_obra','material','equipamento','frete','servico_terceiro','outro'];
  if(!categories.includes(b.category))return done(400,{error:'Categoria inválida'});
  const description=str(b.description,'Descrição',5,250),amount=positiveMoney(b.amount),
    evidence=str(b.evidence_ref,'Referência',6,180),notes=str(b.evidence_notes,'Justificativa',15,1500),
    date=str(b.incurred_on,'Data do custo',10,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||
      new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)
    return done(400,{error:'Data inválida'});
  const actualId=randomUUID();
  const saved=await sql.query(`
    WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
       WHERE id=$1 AND lock_version=$2 AND status='rascunho'
         AND $3::date<=CURRENT_DATE
         AND NOT EXISTS(SELECT 1 FROM budget_actual_costs WHERE budget_id=$1 AND evidence_ref=$4)
       RETURNING id),
    created AS (INSERT INTO budget_actual_costs
       (id,budget_id,category,description,amount,incurred_on,evidence_ref,evidence_notes,created_by)
       SELECT $5,guard.id,$6,$7,$8,$3::date,$4,$9,$10 FROM guard RETURNING *),
    audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
       SELECT $10,'budget_actual_costs',created.id,'create' FROM created RETURNING id)
    SELECT created.* FROM created JOIN audit ON true`,
    [budgetId,lock,date,evidence,actualId,b.category,description,amount,notes,user.id]);
  if(!saved.length)return done(409,{error:'Versão, data ou referência duplicada'});
  return done(201,saved[0]);
 }
 if(sub==='financial-actuals'&&method==='PUT'&&fourth){
  if(!canReview(user))return done(403,{error:'Apenas administrador ou revisor pode validar custos'});
  if(!uuid(fourth))return done(400,{error:'Custo inválido'});
  if(!['validado','rejeitado'].includes(b.status))return done(400,{error:'Informe validado ou rejeitado'});
  const review=str(b.review_notes,'Revisão',15,1500);
  const saved=await sql.query(`
    WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now()
      WHERE id=$1 AND lock_version=$2 AND status='rascunho'
        AND EXISTS(SELECT 1 FROM budget_actual_costs
          WHERE id=$3 AND budget_id=$1 AND status='pendente' AND created_by<>$6)
      RETURNING id),
    reviewed AS (UPDATE budget_actual_costs SET status=$4,review_notes=$5,
       reviewed_by=$6,reviewed_at=now()
      WHERE id=$3 AND budget_id=$1 AND status='pendente'
        AND EXISTS(SELECT 1 FROM guard) RETURNING *),
    audit AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action)
      SELECT $6,'budget_actual_costs',reviewed.id,'review' FROM reviewed RETURNING id)
    SELECT reviewed.* FROM reviewed JOIN audit ON true`,
    [budgetId,lock,fourth,b.status,review,user.id]);
  if(!saved.length)return done(409,{error:'Custo não está pendente ou orçamento alterado'});
  return done(200,saved[0]);
 }
 return done(405,{error:'Operação indisponível'});
}
