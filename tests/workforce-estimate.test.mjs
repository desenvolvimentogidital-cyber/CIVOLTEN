import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildWorkforceEstimate} from '../src/workforce-estimate.mjs';
import {handleWorkforceEstimate} from '../src/workforce-estimate-api.mjs';
import {workforcePanel} from '../public/secure-workforce.js';

const a='00000000-0000-4000-8000-000000000001';
const bid='00000000-0000-4000-8000-000000000002';
const items=[
 {id:a,source_code:'4001070',source_name:'ALVENARIA EM BLOCO',unit:'M2',quantity:'100',
  direct_hh_per_unit:'2.5',reference_price_id:a,source_matches_budget:true,
  labor_review_state:'pendente',labor:[{code:'2020',name:'PEDREIRO',unit:'H',coef:1.4},
   {code:'2099',name:'SERVENTE',unit:'H',coef:1.1}]},
 {id:'00000000-0000-4000-8000-000000000003',source_code:'11002013',source_name:'REBOCO INTERNO',
  unit:'M2',quantity:'200',direct_hh_per_unit:'.62',reference_price_id:a,
  source_matches_budget:true,labor_review_state:'pendente',
  labor:[{code:'2020',name:'PEDREIRO',unit:'H',coef:.34},{code:'2099',name:'SERVENTE',unit:'H',coef:.28}]}
];
test('puxa todos os serviços do orçamento sem precisar de equipes cadastradas',()=>{
 const p=buildWorkforceEstimate(items);
 assert.equal(p.summary.total_services,2);
 assert.equal(p.summary.estimated_services,2);
 assert.equal(p.summary.without_productivity,0);
 assert.equal(p.services[0].estimated_hh,250);
 assert.equal(p.services[0].workers,5);
 assert.equal(p.services[0].crews,2);
 assert.deepEqual(p.services[0].roles.map(r=>r.workers),[3,2]);
 assert.equal(p.services[1].estimated_hh,124);
 assert.equal(p.services[1].workers,2);
 assert.equal(p.services[1].crews,1);
 assert.equal(p.summary.simultaneous_crews,3);
 assert.equal(p.summary.simultaneous_workers,7);
 assert.equal(p.summary.sequential_peak_crews,2);
 assert.equal(p.summary.partial_estimate,true);
 assert.equal(p.commercial_release,false);
});
test('prazo menor exige mais pessoas e são cenários não aprovados',()=>{
 const fast=buildWorkforceEstimate(items,{target_days:5,hours_day:8,efficiency_pct:85,crew_size:4});
 const slow=buildWorkforceEstimate(items,{target_days:20,hours_day:8,efficiency_pct:85,crew_size:4});
 assert.ok(fast.services[0].workers>slow.services[0].workers);
 assert.ok(fast.summary.simultaneous_crews>slow.summary.simultaneous_crews);
});
test('serviço manual não revisado e ausência de coeficiente jamais inventam pessoal',()=>{
 const x=buildWorkforceEstimate([
  {id:a,source_name:'Pintura própria',quantity:300,unit:'M2',direct_labor_hh_unit:null},
  {...items[0],id:'00000000-0000-4000-8000-000000000004',source_matches_budget:false}
 ]);
 assert.equal(x.summary.total_services,2);assert.equal(x.summary.estimated_services,0);
 assert.equal(x.services[0].workers,null);assert.equal(x.services[1].crews,null);
 assert.equal(x.summary.without_productivity,2);
});
test('coeficiente revisado próprio é válido, mas profissões divergentes não são inventadas',()=>{
 const x=buildWorkforceEstimate([{id:a,source_name:'Especialidade própria',unit:'UN',quantity:8,
  direct_labor_hh_unit:'3',labor_review_state:'revisado',
  labor:[{code:'r',name:'Revisor',unit:'H',coef:0.5}]}]);
 assert.equal(x.services[0].status,'coeficiente_revisado');
 assert.equal(x.services[0].estimated_hh,24);
 assert.equal(x.services[0].workers,1);
 assert.deepEqual(x.services[0].roles,[]);
});
test('ignora horas de equipamentos para composição profissional',()=>{
 const x=buildWorkforceEstimate([{...items[0],labor:[
  {code:'2020',name:'PEDREIRO',unit:'H',coef:1.4},
  {code:'2099',name:'SERVENTE',unit:'H',coef:1.1},
  {code:'machine',name:'ESCAVADEIRA',unit:'H-E',coef:20}]}]);
 assert.equal(x.services[0].roles.length,2);
});
test('não estima prazo e equipe quando cenário inválido',()=>{
 for(const settings of [{target_days:0},{target_days:366},{crew_size:0},
  {efficiency_pct:20},{hours_day:13},{target_days:'abc'}])
  assert.throws(()=>buildWorkforceEstimate(items,settings),e=>e.status===400);
});
test('API é somente leitura, exige UUID válido e lê itens incluindo LEFT JOIN das tabelas SIURB',async()=>{
 let queries=[];
 const sql={query:async(query,args)=>{
  queries.push({query,args});
  if(query.includes('FROM budgets WHERE'))return [{id:bid,code:'QA',status:'rascunho',reference_month:'2026-07',regime:'Sem desoneração'}];
  if(query.includes('FROM budget_items bi'))return items;
  throw Error('SQL inesperado');
 }};
 const send=(res,status,data)=>{res.status=status;res.body=data};
 async function call(method,url,parts=['budgets',bid,'workforce-estimate']){
  const res={};const handled=await handleWorkforceEstimate({req:{url},res,sql,parts,method,send});
  return {res,handled};
 }
 assert.equal((await call('POST','/api/v1/budgets/'+bid+'/workforce-estimate')).res.status,405);
 assert.equal((await call('GET','/api/v1/budgets/nao-uuid/workforce-estimate',['budgets','nao-uuid','workforce-estimate'])).res.status,400);
 assert.equal((await call('GET','/api/v1/budgets/'+bid+'/workforce-estimate?target_days=0')).res.status,400);
 assert.equal(queries.length,0);
 const ok=await call('GET','/api/v1/budgets/'+bid+'/workforce-estimate?target_days=10');
 assert.equal(ok.res.status,200);assert.equal(ok.res.body.services.length,2);
 assert.equal(ok.res.body.summary.simultaneous_crews,3);
 assert.ok(queries[1].query.includes('bi.deleted_at IS NULL'));
 assert.ok(queries[1].query.includes('reference_price_versions'));
 assert.deepEqual(queries[1].args,[bid]);
});
test('Tela usa dados de orçamento e aponta hipótese, revisão e equipes não cadastradas',()=>{
 const estimate=buildWorkforceEstimate(items);
 estimate.budget={code:'ORC-TESTE'};
 const escape=v=>String(v??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
 const html=workforcePanel(estimate,escape);
 assert.match(html,/ALVENARIA EM BLOCO/);
 assert.match(html,/REBOCO INTERNO/);
 assert.match(html,/PEDREIRO/);assert.match(html,/Ajudante/);
 assert.match(html,/workforce-settings-form/);
 assert.match(html,/Recalcular equipes/);
 assert.match(html,/Estimativa, não escala de trabalho/);
 assert.match(html,/Equipes necessárias/);
 const secure=readFileSync(new URL('../public/secure.js',import.meta.url),'utf8');
 const schedule=readFileSync(new URL('../public/secure-schedule.js',import.meta.url),'utf8');
 assert.match(secure,/workforce-estimate/);
 assert.match(schedule,/workforcePanel\(state\.scheduleWorkforce,esc\)/);
});
test('não permite HTML injetado no nome do serviço',()=>{
 const x=buildWorkforceEstimate([{...items[0],source_name:'<svg onload=alert(1)>'}]);
 const esc=v=>String(v??'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const html=workforcePanel(x,esc);
 assert.doesNotMatch(html,/<svg onload/);
 assert.match(html,/&lt;svg/);
});
