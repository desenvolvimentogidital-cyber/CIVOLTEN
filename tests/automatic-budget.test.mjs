import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assembleAutomaticBriefing,handleAutomaticBriefing} from '../src/automatic-budget-api.mjs';
import {automaticBudgetPanel} from '../public/secure-automatic.js';

const id='11111111-1111-4111-8111-111111111111';
const itemId='22222222-2222-4222-8222-222222222222';
const refId='33333333-3333-4333-8333-333333333333';
const budget={
 id,code:'QA-01',title:'Orçamento fictício',status:'rascunho',lock_version:2,
 reference_month:'2026-07',regime:'Sem desoneração',client_name:'Cliente teste',
 project_title:'Teste',project_address:'Local fictício',scope_assumptions:null,
 exclusions:null,payment_terms:null,validity_days:null
};
const costItem={
 id:itemId,position:1,source_name:'Alvenaria',source_code:'12345',unit:'m2',
 quantity:'10',direct_unit_cost:'50.0000',reference_price_id:refId,
 source:'SIURB',category:null,quantity_verified:false,composition_reviewed:false,
 supplier_quote_verified:false,supplier_name:null,quote_reference:null,
 quote_date:null,quote_unit_cost:null,loss_pct:'0',freight_unit_cost:'0',other_unit_cost:'0',
 official_unit_cost:'50.0000',official_code:'12345',official_unit:'m2',
 official_composition_available:true,official_month:'2026-07',official_regime:'Sem desoneração'
};
const workforceItem={
 id:itemId,position:1,source_name:'Alvenaria',source_code:'12345',unit:'m2',quantity:'10',
 reference_price_id:refId,direct_labor_hh_unit:null,labor_review_state:'pendente',
 workforce_hh_direct:'2.5',direct_hh_per_unit:'2.5',
 labor:[{code:'P',name:'Pedreiro',coef:1.5,unit:'H'},{code:'S',name:'Servente',coef:1,unit:'H'}],
 source_matches_budget:true
};
function makeSql(items=[costItem],staff=[workforceItem]){
 const queries=[];
 return {queries,async query(query,params){
  queries.push({query,params});
  if(query.includes('LEFT JOIN projects p ON p.id=b.project_id WHERE b.id=$1 LIMIT 1'))
   return [budget];
  if(query.startsWith('SELECT id,status,client_id,reference_month,regime,lock_version,bdi_pct FROM budgets'))return [budget];
  if(query.startsWith('SELECT i.id,i.position,i.source_code'))return items;
  if(query.startsWith('SELECT bdi_components,contingency_pct'))return [];
  if(query.startsWith('SELECT id,category,description,amount,included_in_unit_prices'))return [];
  if(query.startsWith('SELECT id,code,status,reference_month,regime,lock_version FROM budgets'))return [budget];
  if(query.startsWith('SELECT bi.id,bi.position,bi.source_code'))return staff;
  if(query.startsWith('SELECT budget_item_id,work_front,wait_workdays'))return [];
  if(query.startsWith('SELECT predecessor_item_id,successor_item_id,lag_workdays'))return [];
  throw Error('Consulta inesperada: '+query.slice(0,120));
 }};
}
async function request({sql=makeSql(),suffix='',method='GET'}={}){
 let status=null,data=null,pdfBuffer=null,headers={};
 const res={setHeader:(k,v)=>{headers[k]=v;},end:b=>{pdfBuffer=b},statusCode:null};
 const handled=await handleAutomaticBriefing({
  req:{url:'/api/v1/budgets/'+id+'/automatic-briefing'+suffix,method},
  res,sql,user:{id:'reader',role:'consulta'},
  parts:['budgets',id,'automatic-briefing',...(suffix?['pdf']:[])],
  method,send:(_res,code,payload)=>{status=code;data=payload}
 });
 return {handled,status,data,pdfBuffer,headers,sql};
}
test('serviço SIURB produz automaticamente custo, funções e sequência sem cadastros adicionais',async()=>{
 const result=await request();
 assert.equal(result.handled,true);
 assert.equal(result.status,200);
 const a=result.data;
 assert.equal(a.cost.direct_reais,500);
 assert.equal(a.cost.price_approved,false);
 assert.equal(a.workforce.total_hh,25);
 assert.equal(a.workforce.services.length,1);
 assert.equal(a.workforce.services[0].roles.length,2);
 assert.equal(a.schedule.tasks.length,1);
 assert.equal(a.schedule.ready,true);
 assert.equal(a.schedule.workdays>0,true);
 assert.equal(a.proposal_preview.issued,false);
 assert.equal(a.commercial_release,false);
 assert.ok(a.issues.some(x=>/BDI/.test(x)));
 assert.ok(result.sql.queries.every(x=>/^SELECT/.test(x.query)));
});
test('sem serviços não inventa orçamento, profissionais nem PDF',async()=>{
 const sql=makeSql([],[]);
 const x=await request({sql});
 assert.equal(x.status,200);
 assert.equal(x.data.workforce.services.length,0);
 assert.ok(x.data.issues.some(s=>s.includes('Adicione um serviço')));
 const pdf=await request({sql:makeSql([],[]),suffix:'/pdf'});
 assert.equal(pdf.status,409);
 assert.equal(pdf.pdfBuffer,null);
});
test('PDF automático usa orçamento persistido e sempre contém aviso de rascunho',async()=>{
 const r=await request({suffix:'/pdf'});
 assert.equal(r.handled,true);
 assert.equal(r.headers['Content-Type'],'application/pdf');
 assert.match(r.headers['Content-Disposition'],/previa-automatica/);
 assert.equal(r.pdfBuffer.subarray(0,5).toString(),'%PDF-');
 assert.equal(r.headers['Cache-Control'],'private, no-store');
 assert.ok(r.sql.queries.every(x=>/^SELECT/.test(x.query)));
});
test('módulo automático bloqueia escrita e identificadores inválidos',async()=>{
 const write=await request({method:'POST'});
 assert.equal(write.status,405);assert.equal(write.sql.queries.length,0);
 const res={};let status;
 const handled=await handleAutomaticBriefing({
  req:{url:'/api/v1/budgets/not-valid/automatic-briefing'},res,
  sql:makeSql(),user:{role:'consulta'},parts:['budgets','not-valid','automatic-briefing'],
  method:'GET',send:(_res,code)=>{status=code}
 });
 assert.equal(handled,true);assert.equal(status,400);
});
test('serviço incompleto mantém pendências e não inventa produtividade',()=>{
 const b=assembleAutomaticBriefing(budget,{items:[costItem],estimate:{
  direct_cost_reais:500,total_reais:500,errors:[{message:'BDI pendente'}]
 }},{services:[{item_id:itemId,workers:null,roles:[]}],summary:{
  total_hh:0,estimated_services:0,without_productivity:1,partial_estimate:true
 },has_unestimated_services:true,resource_schedule:{ready:false,tasks:[],workdays:null,missing:[]}});
 assert.equal(b.schedule.ready,false);
 assert.equal(b.schedule.workdays,null);
 assert.equal(b.workforce.unestimated_services,1);
 assert.ok(b.issues.some(x=>/não foram inventadas/.test(x)));
 assert.equal(b.commercial_release,false);
});
test('interface recarrega em adição, edição, exclusão e entrada no orçamento',()=>{
 const js=readFileSync(new URL('../public/secure.js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/index.mjs',import.meta.url),'utf8');
 assert.match(js,/refreshAutomaticBriefing/);
 assert.match(js,/catalog-item-form','catalog-edit-form','item-form/);
 assert.match(js,/if\(act==='remove-item'\)/);
 assert.match(js,/if\(act==='detail-budget'\)/);
 assert.match(api,/handleAutomaticBriefing/);
 const html=automaticBudgetPanel({budget:{id},cost:{direct_reais:500,total_preliminary_reais:500},
  workforce:{services:[],total_hh:0},schedule:{ready:false,tasks:[]},
  proposal_preview:{download_url:'/api/v1/budgets/'+id+'/automatic-briefing/pdf'},
  issues:[]},v=>String(v),{budgetId:id});
 assert.match(html,/Baixar prévia PDF automática/);
 assert.match(html,/Não calculado|500,00/);
});
