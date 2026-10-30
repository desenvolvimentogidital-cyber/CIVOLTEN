/* CIVOLTEN - leitura unificada do orçamento: apenas serviços cadastrados.
 * Aproveita os motores de custos, horas-homem e cronograma existentes.
 * Não cria tarefas, equipes, preços finais, propostas comerciais ou registros.
 */
import {createHash} from 'node:crypto';
import {handleStage2} from './costing-api.mjs';
import {handleWorkforceEstimate} from './workforce-estimate-api.mjs';
import {renderProposalDraftPdf} from './proposal-draft-pdf.mjs';

const uuid=value=>typeof value==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const number=value=>value===null||value===undefined?null:Number(value);
const safeString=(value,placeholder)=>typeof value==='string'&&value.trim()?value.trim():placeholder;

export function assembleAutomaticBriefing(budget,costs,workforce){
 const services=costs.items||[];
 const estimate=costs.estimate||{};
 const plan=workforce.resource_schedule||{};
 const suggestions=workforce.services||[];
 const issues=[];
 if(!services.length)issues.push('Adicione um serviço para gerar o resumo automático.');
 if(workforce.has_unestimated_services)
  issues.push('Há serviços sem coeficiente utilizável de horas-homem; equipe e duração não foram inventadas.');
 if(workforce.summary?.partial_estimate)
  issues.push('Horas-homem SIURB podem ser parciais e precisam de conferência técnica.');
 if(!plan.ready)issues.push('Cronograma incompleto: faltam composições, dependências ou serviços complementares.');
 for(const missing of plan.missing||[])issues.push(missing.message||missing.title);
 if(!budget.payment_terms||!budget.scope_assumptions||!budget.exclusions)
  issues.push('Escopo, exclusões e/ou condições de pagamento precisam de revisão antes de uma proposta comercial.');
 if((estimate.errors||[]).length)
  issues.push('BDI, custos e documentação de referência ainda contêm pendências de aprovação comercial.');
 const deduped=[...new Set(issues)];
 const bdiMissing=(estimate.errors||[]).some(x=>x.code==='BDI_INPUT'||x.code==='BDI_TAX');
 const scheduleReady=services.length>0&&!!plan.ready;
 return {
  budget:{id:budget.id,code:budget.code,title:budget.title,status:budget.status,
   lock_version:budget.lock_version,reference_month:budget.reference_month,regime:budget.regime},
  source:'servicos_persistidos_no_orcamento',
  mode:'calculo_automatico_sem_cadastro_de_equipes',
  cost:{
   direct_reais:number(estimate.direct_cost_reais),
   bdi_reais:bdiMissing?null:number(estimate.bdi_amount_reais),
   contingency_reais:number(estimate.contingency_reais),
   total_preliminary_reais:bdiMissing?null:number(estimate.total_reais),
   price_approved:false,
   blocking_errors:(estimate.errors||[]).map(x=>x.message||String(x)).slice(0,35)
  },
  workforce:{
   services:suggestions.map(s=>({
    item_id:s.item_id,code:s.code,title:s.title,
    quantity:s.quantity,unit:s.unit,status:s.status,
    estimated_hh:s.estimated_hh,workers:s.workers,
    days_at_suggested_staff:s.days_at_suggested_staff,
    roles:s.roles||[],warning:s.warning
   })),
   total_hh:workforce.summary?.total_hh??null,
   estimated_services:workforce.summary?.estimated_services??0,
   unestimated_services:workforce.summary?.without_productivity??0,
   assumptions:workforce.assumptions
  },
  schedule:{
   ready:scheduleReady,
   workdays:scheduleReady?plan.workdays:null,
   tentative_workdays:services.length?plan.workdays??null:null,
   peak_workers:scheduleReady?plan.peak_workers:null,
   peak_roles:scheduleReady?plan.peak_roles:[],
   tasks:plan.tasks||[],dependencies:plan.dependencies||[],
   missing:plan.missing||[],errors:plan.errors||[],
   start_date:null,finish_date:null,
   note:'Dias úteis relativos; sem data de início, calendário de feriados ou aprovação contratual.'
  },
  proposal_preview:{
   generated_from_services:true,download_url:'/api/v1/budgets/'+budget.id+'/automatic-briefing/pdf',
   stored:false,issued:false,commercial_release:false
  },
  issues:deduped,preview_only:true,commercial_release:false,
  note:'Cálculo automático interno; não equivale a cotação aprovada, contratação de equipe, cronograma executivo ou proposta comercial.'
 };
}

async function captured(handler,ctx,route){
 let result=null;
 const supported=await handler({
  ...ctx,parts:route,method:'GET',
  send:(_res,status,payload)=>{result={status,payload}}
 });
 if(!supported||!result)throw Object.assign(new Error('Módulo automático indisponível'),{status:503});
 if(result.status!==200)throw Object.assign(
  new Error(result.payload?.error||'Falha ao calcular orçamento automaticamente'),
  {status:result.status});
 return result.payload;
}

export async function handleAutomaticBriefing(ctx){
 const {req,res,sql,user,parts,method,send}=ctx;
 if(parts[0]!=='budgets'||parts[2]!=='automatic-briefing')return false;
 const done=(status,data)=>{send(res,status,data);return true};
 if(method!=='GET')return done(405,{error:'Cálculo automático é somente leitura'});
 if(parts.length!==3&&!(parts.length===4&&parts[3]==='pdf'))
  return done(404,{error:'Rota não encontrada'});
 const id=parts[1];
 if(!uuid(id))return done(400,{error:'Orçamento inválido'});
 const budgets=await sql.query(`SELECT b.id,b.code,b.title,b.status,b.lock_version,b.reference_month,b.regime,
   b.scope_assumptions,b.exclusions,b.payment_terms,b.validity_days,
   c.name AS client_name,p.title AS project_title,p.address AS project_address
   FROM budgets b JOIN clients c ON c.id=b.client_id
   LEFT JOIN projects p ON p.id=b.project_id WHERE b.id=$1 LIMIT 1`,[id]);
 if(!budgets.length)return done(404,{error:'Orçamento não encontrado'});
 const budget=budgets[0];
 // Reuse same tested calculations as their individual endpoints. No manual task
 // table or new schema is necessary; changes to budget items appear immediately.
 const costs=await captured(handleStage2,ctx,['budgets',id,'costs']);
 const workforce=await captured(handleWorkforceEstimate,ctx,['budgets',id,'workforce-estimate']);
 const briefing=assembleAutomaticBriefing(budget,costs,workforce);
 if(parts.length===3)return done(200,briefing);
 if(!costs.items?.length)return done(409,{error:'Adicione ao menos um serviço antes de gerar a prévia PDF'});
 const snapshot={
  model:'civolten-automatic-preview-not-issued',
  budget:{id:budget.id,code:budget.code,title:budget.title,lock_version:budget.lock_version},
  client:{name:budget.client_name},
  project:{title:budget.project_title,address:budget.project_address},
  items:costs.items.map(item=>({
   name:item.source_name,code:item.source_code,
   quantity:String(item.quantity),unit:item.unit,unit_cost:String(item.direct_unit_cost)
  })),
  scope:safeString(budget.scope_assumptions,'Escopo a revisar conforme serviços e quantitativos do orçamento.'),
  exclusions:safeString(budget.exclusions,'Exclusões não informadas; precisam de revisão.'),
  payment_terms:safeString(budget.payment_terms,'Condições de pagamento não informadas.'),
  validity_days:budget.validity_days??null,
  costs:{
   direct_reais:briefing.cost.direct_reais,
   bdi_reais:briefing.cost.bdi_reais,
   contingency_reais:briefing.cost.contingency_reais,
   total_reais:briefing.cost.total_preliminary_reais,
   ready:false,
   blocking_errors:briefing.issues.map(message=>({message}))
  },
  issued:false,commercial_release:false
 };
 const sha=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 const pdf=await renderProposalDraftPdf(snapshot,{version:1,sha256:sha});
 res.statusCode=200;
 res.setHeader('Content-Type','application/pdf');
 res.setHeader('Content-Disposition','attachment; filename="civolten-previa-automatica-'+
   String(budget.code||'orcamento').replace(/[^a-z0-9-]/gi,'_')+'.pdf"');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.end(pdf);
 return true;
}
