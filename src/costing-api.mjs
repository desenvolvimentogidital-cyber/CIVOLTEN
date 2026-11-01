/* CIVOLTEN — etapa 2: custos verificados, SIURB e auditoria.
 * Apenas rotas autenticadas. Não emite proposta nem certifica orçamentos.
 */
import {randomUUID} from 'node:crypto';
import {estimateBudget} from './estimate-engine.mjs';
import {inspectSiurbComposition} from './siurb-composition-audit.mjs';
import {compareSiurbDirectLabor} from './siurb-direct-labor-prices.mjs';

const bdiKeys=['administracaoCentral','seguro','garantia','risco','despesasFinanceiras','lucro','tributosSobreReceita'];
const validUUID=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const decimal=(x,name,max=100,places=2)=>{
 if(x===null||x===undefined||x==='')throw Object.assign(new Error(name+' obrigatório'),{status:400});
 const value=String(x).trim().replace(',','.');
 if(!new RegExp('^\\d+(?:\\.\\d{1,'+places+'})?$').test(value))throw Object.assign(new Error(name+' precisa de número positivo com até '+places+' decimais'),{status:400});
 const n=Number(value);
 if(!Number.isFinite(n)||n<0||n>max)throw Object.assign(new Error(name+' fora dos limites'),{status:400});
 return value;
};
const clean=(x,name,max=500,required=false)=>{
 if(x==null||String(x).trim()===''){if(required)throw Object.assign(new Error(name+' obrigatório'),{status:400});return null}
 const s=String(x).trim();if(s.length>max)throw Object.assign(new Error(name+' excedeu '+max+' caracteres'),{status:400});return s;
};
const allowed=['mobilizacao','frete','equipamento','descarte','indireto_local','outro'];
const canWrite=user=>['administrador','orcamentista'].includes(user.role);
const canApprove=user=>['administrador','revisor'].includes(user.role);
function parseQuery(req){return new URL(req.url,'https://civolten-gj91.vercel.app').searchParams}
async function sourceItem(sql,referenceId,budget){
 if(!validUUID(referenceId))return null;
 const rows=await sql.query("SELECT p.id,p.code,p.description,p.unit,p.unit_cost,(d.reference_price_id IS NOT NULL) AS has_composition,v.scope,v.regime,v.reference_month,v.source_url,v.sha256 FROM reference_prices p LEFT JOIN reference_composition_details d ON d.reference_price_id=p.id JOIN reference_price_versions v ON v.id=p.version_id WHERE p.id=$1 AND v.source='SIURB' AND v.reference_month=$2 AND v.regime=$3 LIMIT 1",
   [referenceId,budget.reference_month,budget.regime]);
 return rows[0]||null;
}
const scopeMatch=(budget,b)=>budget.status==='rascunho'&&budget.lock_version===Number(b.lock_version)&&Number.isSafeInteger(Number(b.lock_version))&&Number(b.lock_version)>=0;
export async function handleStage2(ctx){
 const {req,res,sql,user,parts,method,send,readBody}=ctx;
 const done=(response,status,payload)=>{send(response,status,payload);return true;};
 const [resource,id,sub,fourth]=parts;
 if(resource==='siurb'&&validUUID(id)&&sub==='composition'&&method==='GET'){
   const rows=await sql.query("SELECT p.id,p.version_id,p.code,p.description,p.unit,p.unit_cost,p.productivity_status,v.scope AS category,v.regime,v.reference_month,v.source_url,v.sha256,d.labor,d.other,d.direct_hh_per_unit,d.validation FROM reference_prices p JOIN reference_price_versions v ON v.id=p.version_id LEFT JOIN reference_composition_details d ON d.reference_price_id=p.id WHERE p.id=$1 AND v.source='SIURB'",[id]);
   if(!rows.length)return done(res,404,{error:'Preço de referência não encontrado'});
   const root=rows[0];
   const inspection=await inspectSiurbComposition({
     root,maxNodes:80,maxDepth:6,
     lookup:async(code,version)=>{
       const found=await sql.query("SELECT p.id,p.code,p.unit,p.unit_cost,d.labor,d.other FROM reference_prices p LEFT JOIN reference_composition_details d ON d.reference_price_id=p.id WHERE p.version_id=$1 AND p.code=$2 LIMIT 1",[version,code]);
       return found[0]||null;
     }
   });
   const codes=[...new Set((Array.isArray(root.labor)?root.labor:[])
     .map(x=>String(x?.code||'').trim()).filter(x=>/^[0-9]{3,9}$/.test(x)))].slice(0,100);
   let tariffs=[],supplementalSourcesAvailable=true;
   if(codes.length){
    try{
     tariffs=await sql.query(
      "SELECT p.code,p.kind,p.variant,p.unit,p.unit_cost,s.regime,s.reference_month,s.sha256 AS source_sha256 FROM siurb_supplement_prices p JOIN siurb_supplement_sources s ON s.id=p.source_id WHERE s.reference_month=$1 AND s.regime=$2 AND s.kind='horista' AND p.kind='horista' AND p.variant='com_encargos' AND upper(p.unit)='H' AND p.code=ANY($3::text[])",
      [root.reference_month,root.regime,codes]);
    }catch(error){
     if(error?.code!=='42P01')throw error;
     supplementalSourcesAvailable=false; // Explicit legacy QA databases only.
    }
   }
   const laborReference=compareSiurbDirectLabor({labor:root.labor,tariffs,
    regime:root.regime,reference_month:root.reference_month});
   return done(res,200,{...root,composition_available:root.labor!==null,
     inspection,siurb_direct_labor_reference:laborReference,
     siurb_supplemental_sources_available:supplementalSourcesAvailable,
     notice:'Tarifas horistas complementares oficiais conferidas por código e regime. O custo direto de mão de obra é parcial e não substitui a composição integral nem homologação técnica.'});
 }
 if(resource==='siurb'&&id==='search'&&method==='GET'){
   const q=parseQuery(req),term=String(q.get('q')||'').trim().slice(0,80);
   const regime=q.get('regime'),category=q.get('category');
   if(term.length<2)return done(res,200,[]);
   if(regime&&!['Com desoneração','Sem desoneração'].includes(regime))return done(res,400,{error:'Regime inválido'});
   if(category&&!['Edificações','Infraestrutura'].includes(category))return done(res,400,{error:'Categoria inválida'});
   const rows=await sql.query("SELECT p.id,p.code,p.description,p.unit,p.unit_cost,p.workforce_hh_direct,p.productivity_status,(d.reference_price_id IS NOT NULL) AS composition_available,v.reference_month,v.regime,v.scope AS category,v.source_url,v.sha256 FROM reference_prices p LEFT JOIN reference_composition_details d ON d.reference_price_id=p.id JOIN reference_price_versions v ON v.id=p.version_id WHERE v.source='SIURB' AND v.reference_month='2026-07' AND ($1::text IS NULL OR v.regime=$1) AND ($2::text IS NULL OR v.scope=$2) AND (p.code ILIKE $3 OR p.description ILIKE $3) ORDER BY CASE WHEN p.code=$4 THEN 0 ELSE 1 END,p.code LIMIT 40",
     [regime||null,category||null,'%'+term.replace(/[\\%_]/g,'')+'%',term]);
   return done(res,200,rows);
 }
 if(resource!=='budgets'||!id||!validUUID(id)||!['costs','cost-settings','cost-review','extra-costs','siurb-items'].includes(sub))return false;
 const bRows=await sql.query("SELECT id,status,client_id,reference_month,regime,lock_version,bdi_pct FROM budgets WHERE id=$1",[id]);
 if(!bRows.length)return done(res,404,{error:'Orçamento não encontrado'});
 const budget=bRows[0],draft=budget.status==='rascunho';
 if(sub==='costs'&&method==='GET'){
  const [items,profile,extra]=await Promise.all([
   sql.query("SELECT i.id,i.position,i.source_code,i.source_name,i.unit,i.quantity,i.direct_unit_cost,i.reference_price_id,r.source,r.category,r.quantity_verified,r.composition_reviewed,r.supplier_quote_verified,r.supplier_name,r.quote_reference,r.quote_date,r.quote_unit_cost,r.loss_pct,r.freight_unit_cost,r.other_unit_cost,r.notes,p.unit_cost AS official_unit_cost,p.code AS official_code,p.unit AS official_unit,(d.reference_price_id IS NOT NULL) AS official_composition_available,v.reference_month AS official_month,v.regime AS official_regime,v.scope AS official_category FROM budget_items i LEFT JOIN budget_item_cost_reviews r ON r.budget_item_id=i.id LEFT JOIN reference_prices p ON p.id=i.reference_price_id LEFT JOIN reference_composition_details d ON d.reference_price_id=p.id LEFT JOIN reference_price_versions v ON v.id=p.version_id WHERE i.budget_id=$1 AND i.deleted_at IS NULL ORDER BY i.position",
     [id]),
   sql.query("SELECT bdi_components,contingency_pct,bdi_reviewed,technical_reviewed,commercial_reviewed,review_notes,updated_at FROM budget_costing_profiles WHERE budget_id=$1",[id]),
   sql.query("SELECT id,category,description,amount,included_in_unit_prices,supplier_name,quote_reference,quote_date FROM budget_extra_direct_costs WHERE budget_id=$1 ORDER BY created_at,id",[id])
  ]);
  const config=profile[0]||{bdi_components:{},contingency_pct:0,bdi_reviewed:false,technical_reviewed:false,commercial_reviewed:false};
  const mapped=items.map(x=>{
    const from=x.source||'MANUAL';
    const officialMismatch=from==='SIURB'&&(!x.reference_price_id||x.official_month!==budget.reference_month||x.official_regime!==budget.regime||Number(x.official_unit_cost)!==Number(x.direct_unit_cost)||x.official_code!==x.source_code||x.official_unit!==x.unit);
    const quoteMismatch=from!=='SIURB'&&x.supplier_quote_verified&&x.quote_unit_cost!=null&&Number(x.quote_unit_cost)!==Number(x.direct_unit_cost);
    return {code:x.source_code,description:x.source_name,unit:x.unit,quantity:String(x.quantity),unit_cost:String(x.direct_unit_cost),
     source:from,reference_price_id:x.reference_price_id,reference_month:x.official_month||null,regime:x.official_regime||null,
     category:x.category,quantity_verified:!!x.quantity_verified,composition_reviewed:!!x.composition_reviewed,
     supplier_quote_verified:!!x.supplier_quote_verified,supplier_name:x.supplier_name,quote_reference:x.quote_reference,
     quote_date:x.quote_date,source_price_mismatch:officialMismatch,quote_mismatch:quoteMismatch,
     loss_pct:String(x.loss_pct||0),freight_unit_cost:String(x.freight_unit_cost||0),other_unit_cost:String(x.other_unit_cost||0),
     composition_available:!!x.official_composition_available,
     auxiliaries_unexpanded:from==='SIURB',
    };
  });
  const estimate=estimateBudget({
    reference_month:budget.reference_month,regime:budget.regime,items:mapped,
    bdi:config.bdi_components||{},contingency_pct:config.contingency_pct,
    bdi_reviewed:!!config.bdi_reviewed,technical_reviewed:!!config.technical_reviewed,
    commercial_reviewed:!!config.commercial_reviewed,
    extra_direct_costs:extra.map(e=>({description:e.description,amount:String(e.amount),included_in_unit_prices:e.included_in_unit_prices}))
  });
  if(mapped.some(x=>x.quote_mismatch))estimate.errors.push({code:'QUOTE_PRICE_MISMATCH',message:'Um custo unitário difere da cotação confirmada.'});
  estimate.ready=estimate.errors.length===0;
  return done(res,200,{budget:{id:budget.id,status:budget.status,reference_month:budget.reference_month,regime:budget.regime,lock_version:budget.lock_version},config,items,extra,estimate,
    commercial_release:false,disclaimer:'Cálculo em homologação; emissão comercial exige revisão dos tributos, quantidades, composições auxiliares, cronograma e backups.'});
 }
 if(sub==='siurb-items'&&method==='POST'){
   if(!canWrite(user))return done(res,403,{error:'Sem permissão de orçamento'});
   if(!draft)return done(res,409,{error:'Somente rascunhos'});
   const body=await readBody(req);
   if(!scopeMatch(budget,body))return done(res,409,{error:'Versão do orçamento desatualizada'});
   const price=await sourceItem(sql,body.reference_price_id,budget);
   if(!price)return done(res,400,{error:'Preço SIURB não pertence à data-base e regime do orçamento'});
   const position=Number(body.position);
   if(!Number.isSafeInteger(position)||position<1||position>10000)return done(res,400,{error:'Posição inválida'});
   const quantity=decimal(body.quantity,'Quantidade',1e10,6),newId=randomUUID();
   const created=await sql.query("WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now() WHERE id=$2 AND lock_version=$9 AND status='rascunho' RETURNING id), created AS (INSERT INTO budget_items(id,budget_id,position,source_code,source_name,unit,quantity,direct_unit_cost,reference_price_id) SELECT $1,guard.id,$3,$4,$5,$6,$7,$8,$10 FROM guard RETURNING *), reviewed AS (INSERT INTO budget_item_cost_reviews(budget_item_id,source,reference_price_id,category) SELECT created.id,'SIURB',$10,$11 FROM created RETURNING budget_item_id), audited AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $12,'budget_items',created.id,'siurb_price_selected' FROM created RETURNING id), invalidated AS (UPDATE budget_costing_profiles SET technical_reviewed=false,commercial_reviewed=false,bdi_reviewed=false,updated_at=now() WHERE budget_id=$2 AND EXISTS(SELECT 1 FROM created) RETURNING budget_id) SELECT created.* FROM created JOIN reviewed ON reviewed.budget_item_id=created.id JOIN audited ON true",
    [newId,id,position,price.code,price.description,price.unit,quantity,price.unit_cost,body.lock_version,price.id,price.scope,user.id]);
   if(!created.length)return done(res,409,{error:'Orçamento modificado; recarregue'});
   return done(res,201,created[0]);
 }
 if(sub==='siurb-items'&&method==='PUT'&&fourth){
   if(!canWrite(user))return done(res,403,{error:'Sem permissão de orçamento'});
   if(!draft)return done(res,409,{error:'Somente rascunhos'});
   if(!validUUID(fourth))return done(res,400,{error:'Identificador do serviço inválido'});
   const body=await readBody(req);
   if(!scopeMatch(budget,body))return done(res,409,{error:'Orçamento alterado; recarregue antes de editar'});
   const position=Number(body.position);
   if(!Number.isSafeInteger(position)||position<1||position>10000)return done(res,400,{error:'Posição inválida'});
   const quantity=decimal(body.quantity,'Quantidade',1e10,6);
   const changed=await sql.query("WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now() WHERE id=$2 AND lock_version=$4 AND status='rascunho' AND EXISTS(SELECT 1 FROM budget_items i JOIN budget_item_cost_reviews r ON r.budget_item_id=i.id JOIN reference_prices p ON p.id=i.reference_price_id JOIN reference_price_versions v ON v.id=p.version_id WHERE i.id=$1 AND i.budget_id=$2 AND i.deleted_at IS NULL AND r.source='SIURB' AND v.source='SIURB' AND v.reference_month=$6 AND v.regime=$7) RETURNING id), updated AS (UPDATE budget_items SET position=$3,quantity=$5 WHERE id=$1 AND budget_id=$2 AND deleted_at IS NULL AND reference_price_id IS NOT NULL AND EXISTS(SELECT 1 FROM guard) RETURNING *), reviewed AS (UPDATE budget_item_cost_reviews SET quantity_verified=false,composition_reviewed=false WHERE budget_item_id=$1 AND EXISTS(SELECT 1 FROM updated) RETURNING budget_item_id), audited AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $8,'budget_items',updated.id,'update_siurb_measurement' FROM updated RETURNING id), invalidated AS (UPDATE budget_costing_profiles SET technical_reviewed=false,commercial_reviewed=false,bdi_reviewed=false,updated_at=now() WHERE budget_id=$2 AND EXISTS(SELECT 1 FROM updated) RETURNING budget_id) SELECT updated.* FROM updated JOIN reviewed ON reviewed.budget_item_id=updated.id JOIN audited ON true",
    [fourth,id,position,body.lock_version,quantity,budget.reference_month,budget.regime,user.id]);
   if(!changed.length)return done(res,409,{error:'Serviço oficial não disponível; recarregue orçamento'});
   return done(res,200,changed[0]);
 }
 if(sub==='cost-settings'&&method==='PUT'){
   if(!canWrite(user)&&!canApprove(user))return done(res,403,{error:'Sem permissão'});
   if(!draft)return done(res,409,{error:'Só rascunhos permitem revisão'});
   const body=await readBody(req);
   if(!scopeMatch(budget,body))return done(res,409,{error:'Orçamento alterado; atualize a página'});
   const bdi={};
   for(const key of bdiKeys)bdi[key]=decimal(body.bdi?.[key],key,99.99,2);
   const contingency=decimal(body.contingency_pct??0,'Contingência',100,2);
   const value=k=>Number(bdi[k])/100;
   const effective=100*((1+value('administracaoCentral')+value('seguro')+value('garantia')+value('risco'))*
     (1+value('despesasFinanceiras'))*(1+value('lucro'))/(1-value('tributosSobreReceita'))-1);
   if(!Number.isFinite(effective)||effective<0||effective>100)return done(res,400,{error:'BDI resultante fora de 0 a 100%. Confira os componentes.'});
   const effectiveRounded=String(Math.round(effective*10000)/10000);

   const approve=['bdi_reviewed','technical_reviewed','commercial_reviewed'].some(k=>body[k]===true);
   if(approve&&!canApprove(user))return done(res,403,{error:'Somente administrador ou revisor pode aprovar custos'});
   const notes=clean(body.review_notes,'Observações',2000,false);
   if(approve&&!notes)return done(res,400,{error:'Aprovações precisam de justificativa e identificação da revisão'});
   const checked=['bdi_reviewed','technical_reviewed','commercial_reviewed'].map(k=>body[k]===true);
   const result=await sql.query("WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now(),bdi_pct=$3,contingency_pct=$4 WHERE id=$1 AND lock_version=$2 AND status='rascunho' RETURNING id), revised AS (INSERT INTO budget_costing_profiles(budget_id,bdi_components,contingency_pct,bdi_reviewed,technical_reviewed,commercial_reviewed,review_notes,reviewed_by,updated_by,updated_at) SELECT guard.id,$5::jsonb,$4,$6,$7,$8,$9,$10,$10,now() FROM guard ON CONFLICT(budget_id) DO UPDATE SET bdi_components=excluded.bdi_components,contingency_pct=excluded.contingency_pct,bdi_reviewed=excluded.bdi_reviewed,technical_reviewed=excluded.technical_reviewed,commercial_reviewed=excluded.commercial_reviewed,review_notes=excluded.review_notes,reviewed_by=excluded.reviewed_by,updated_by=excluded.updated_by,updated_at=now() RETURNING budget_id), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $10,'budgets',revised.budget_id,'cost_profile_updated' FROM revised RETURNING id) SELECT revised.budget_id FROM revised JOIN logged ON true",
    [id,body.lock_version,effectiveRounded,contingency,JSON.stringify(bdi),...checked,notes,user.id]);
   if(!result.length)return done(res,409,{error:'Versão alterada; atualize a página'});
   return done(res,200,{ok:true});
 }
 if(sub==='cost-review'&&fourth&&method==='PUT'){
   if(!canWrite(user)&&!canApprove(user))return done(res,403,{error:'Sem permissão'});
   if(!draft)return done(res,409,{error:'Orçamento bloqueado'});
   const body=await readBody(req);
   if(!scopeMatch(budget,body))return done(res,409,{error:'Versão desatualizada'});
   const existing=await sql.query("SELECT id,source_code,direct_unit_cost,reference_price_id FROM budget_items WHERE id=$1 AND budget_id=$2 AND deleted_at IS NULL",[fourth,id]);
   if(!existing.length)return done(res,404,{error:'Serviço não encontrado'});
   const source=body.source;
   if(!['SIURB','MANUAL','COTACAO'].includes(source))return done(res,400,{error:'Fonte inválida'});
   let officialId=null,category=null;
   if(source==='SIURB'){
     const price=await sourceItem(sql,body.reference_price_id,budget);
     if(!price||price.code!==existing[0].source_code||Number(price.unit_cost)!==Number(existing[0].direct_unit_cost))
       return done(res,400,{error:'Preço SIURB deve corresponder ao código e custo do catálogo oficial'});
     if(body.composition_reviewed===true&&!price.has_composition)return done(res,400,{error:'Ficha de composição ausente na SIURB; não é possível marcar como revisada'});
     officialId=price.id;category=price.scope;
   }
   const quantityVerified=body.quantity_verified===true,compositionReviewed=body.composition_reviewed===true,quoteVerified=body.supplier_quote_verified===true;
   const supplierName=clean(body.supplier_name,'Fornecedor',180),quoteReference=clean(body.quote_reference,'Identificador da cotação',250);
   const quoteDate=clean(body.quote_date,'Data da cotação',10),quotePrice=body.quote_unit_cost==null?null:decimal(body.quote_unit_cost,'Preço cotado',1e9,4);
   if(source!=='SIURB'&&quoteVerified&&(!supplierName||!quoteReference||!/^\d{4}-\d{2}-\d{2}$/.test(quoteDate||'')||quotePrice===null||Number(quotePrice)!==Number(existing[0].direct_unit_cost)))
      return done(res,400,{error:'Cotação verificada exige fornecedor, referência, data e preço igual ao lançado'});
   const loss=decimal(body.loss_pct??0,'Perdas',100,2);
   const freight=decimal(body.freight_unit_cost??0,'Frete unitário',1e9,4);
   const other=decimal(body.other_unit_cost??0,'Outros custos unitários',1e9,4);
   const notes=clean(body.notes,'Justificativa',2000);
   const result=await sql.query("WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now() WHERE id=$2 AND lock_version=$16 AND status='rascunho' RETURNING id), attached AS (UPDATE budget_items SET reference_price_id=$4 WHERE id=$1 AND budget_id=$2 AND EXISTS(SELECT 1 FROM guard) RETURNING id), revised AS (INSERT INTO budget_item_cost_reviews(budget_item_id,source,reference_price_id,category,quantity_verified,composition_reviewed,supplier_quote_verified,supplier_name,quote_reference,quote_date,quote_unit_cost,loss_pct,freight_unit_cost,other_unit_cost,notes,reviewed_by) SELECT attached.id,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13,$14,$15,$17,$18 FROM attached ON CONFLICT(budget_item_id) DO UPDATE SET source=excluded.source,reference_price_id=excluded.reference_price_id,category=excluded.category,quantity_verified=excluded.quantity_verified,composition_reviewed=excluded.composition_reviewed,supplier_quote_verified=excluded.supplier_quote_verified,supplier_name=excluded.supplier_name,quote_reference=excluded.quote_reference,quote_date=excluded.quote_date,quote_unit_cost=excluded.quote_unit_cost,loss_pct=excluded.loss_pct,freight_unit_cost=excluded.freight_unit_cost,other_unit_cost=excluded.other_unit_cost,notes=excluded.notes,reviewed_by=excluded.reviewed_by,updated_at=now() RETURNING budget_item_id), invalidated AS (UPDATE budget_costing_profiles SET technical_reviewed=false,commercial_reviewed=false,bdi_reviewed=false,updated_at=now() WHERE budget_id=$2 AND EXISTS (SELECT 1 FROM revised) RETURNING budget_id), logged AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $18,'budget_items',revised.budget_item_id,'cost_evidence_updated' FROM revised RETURNING id) SELECT revised.budget_item_id FROM revised JOIN logged ON true",
    [fourth,id,source,officialId,category,quantityVerified,compositionReviewed,quoteVerified,supplierName,quoteReference,quoteDate||null,quotePrice,loss,freight,other,body.lock_version,notes,user.id]);
   if(!result.length)return done(res,409,{error:'Versão alterada; recarregue'});
   return done(res,200,{ok:true});
 }
 if(sub==='extra-costs'){
   if(!canWrite(user))return done(res,403,{error:'Sem permissão'});
   if(!draft)return done(res,409,{error:'Só rascunhos'});
   if(method==='POST'){
     const body=await readBody(req);
     if(!scopeMatch(budget,body))return done(res,409,{error:'Versão desatualizada'});
     const category=body.category;if(!allowed.includes(category))return done(res,400,{error:'Categoria inválida'});
     const description=clean(body.description,'Descrição',250,true),amount=decimal(body.amount,'Custo direto extra',1e9,2),newId=randomUUID();
     const supplier=clean(body.supplier_name,'Fornecedor',180),ref=clean(body.quote_reference,'Cotação',250),date=clean(body.quote_date,'Data',10);
     if(!ref)return done(res,400,{error:'Informe memória de cálculo ou identificação da cotação para o custo adicional'});
     const result=await sql.query("WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now() WHERE id=$2 AND lock_version=$11 AND status='rascunho' RETURNING id), created AS (INSERT INTO budget_extra_direct_costs(id,budget_id,description,category,amount,included_in_unit_prices,supplier_name,quote_reference,quote_date,created_by) SELECT $1,guard.id,$3,$4,$5,$6,$7,$8,$9::date,$10 FROM guard RETURNING *), audited AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $10,'budget_extra_direct_costs',created.id,'create' FROM created RETURNING id), invalidated AS (UPDATE budget_costing_profiles SET technical_reviewed=false,commercial_reviewed=false,bdi_reviewed=false,updated_at=now() WHERE budget_id=$2 AND EXISTS(SELECT 1 FROM created) RETURNING budget_id) SELECT created.* FROM created JOIN audited ON true",
       [newId,id,description,category,amount,body.included_in_unit_prices===true,supplier,ref,date||null,user.id,body.lock_version]);
     if(!result.length)return done(res,409,{error:'Versão desatualizada'});
     return done(res,201,result[0]);
   }
   if(method==='DELETE'&&fourth){
     if(!validUUID(fourth))return done(res,400,{error:'Identificador inválido'});
     const body=await readBody(req);
     if(!scopeMatch(budget,body))return done(res,409,{error:'Versão desatualizada'});
     const result=await sql.query("WITH guard AS (UPDATE budgets SET lock_version=lock_version+1,updated_at=now() WHERE id=$2 AND lock_version=$4 AND status='rascunho' AND EXISTS(SELECT 1 FROM budget_extra_direct_costs WHERE id=$1 AND budget_id=$2) RETURNING id), removed AS (DELETE FROM budget_extra_direct_costs WHERE id=$1 AND budget_id=$2 AND EXISTS(SELECT 1 FROM guard) RETURNING id), audited AS (INSERT INTO audit_events(actor_id,entity_type,entity_id,action) SELECT $3,'budget_extra_direct_costs',removed.id,'remove' FROM removed RETURNING id), invalidated AS (UPDATE budget_costing_profiles SET technical_reviewed=false,commercial_reviewed=false,bdi_reviewed=false,updated_at=now() WHERE budget_id=$2 AND EXISTS(SELECT 1 FROM removed) RETURNING budget_id) SELECT removed.id FROM removed JOIN audited ON true",
       [fourth,id,user.id,body.lock_version]);
     if(!result.length)return done(res,409,{error:'Custo extra indisponível ou versão alterada'});
     return done(res,200,{ok:true});
   }
 }
 return false;
}
