import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildWorkforceEstimate} from '../src/workforce-estimate.mjs';
import {summarizeWorkforce} from '../src/workforce-costing.mjs';
import {workforcePanel} from '../public/secure-workforce.js';
const items=[
 {id:'1',source_code:'4001070',source_name:'ALVENARIA EM BLOCO',unit:'M2',quantity:100,
  reference_price_id:'a',source_matches_budget:true,direct_hh_per_unit:2.5,
  labor:[{code:'2020',name:'PEDREIRO',unit:'H',coef:1.4},{code:'2099',name:'SERVENTE',unit:'H',coef:1.1}]},
 {id:'2',source_code:'11002013',source_name:'REBOCO',unit:'M2',quantity:200,
  reference_price_id:'b',source_matches_budget:true,direct_hh_per_unit:.62,
  labor:[{code:'2020',name:'PEDREIRO',unit:'H',coef:.34},{code:'2099',name:'SERVENTE',unit:'H',coef:.28}]}
];
const estimate=()=>buildWorkforceEstimate(items);
const example=()=>summarizeWorkforce(estimate());
test('soma por profissão sem contar os mesmos trabalhadores duas vezes na sequência',()=>{
 const x=example();const ped=x.roles.find(r=>r.code==='2020'),serv=x.roles.find(r=>r.code==='2099');
 assert.equal(ped.parallel_workers,4);assert.equal(ped.sequential_workers,3);
 assert.equal(serv.parallel_workers,3);assert.equal(serv.sequential_workers,2);
 assert.equal(x.role_totals.parallel_workers,7);
 assert.equal(x.role_totals.sequential_workers,5);
 assert.equal(x.duration.parallel_workdays,10);
 assert.equal(x.duration.sequential_workdays,19);
 assert.equal(x.duration.complete,true);
});
test('sem custo da empresa informado não inventa valores monetários',()=>{
 const x=example();
 assert.equal(x.costs.labor_estimated,null);assert.equal(x.costs.total_sequential,null);
 assert.equal(x.costs.total_parallel,null);
 assert.ok(x.costs.missing_rates.includes('PEDREIRO'));
});
test('custo da equipe por horas pagas e despesas fixas mensais proporcionais ao prazo',()=>{
 const x=summarizeWorkforce(estimate(),{rates:[
  {role_code:'2020',hourly_employer_cost:'30'},
  {role_code:'2099',hourly_employer_cost:'20'}],
  overhead:{monthly_overhead:'22000',workdays_per_month:22}});
 assert.equal(x.costs.labor_estimated,13360);
 assert.equal(x.costs.overhead_sequential,19000);
 assert.equal(x.costs.overhead_parallel,10000);
 assert.equal(x.costs.total_sequential,32360);
 assert.equal(x.costs.total_parallel,23360);
 assert.equal(x.costs.available,true);
});
test('cadastro de funcionário pode fornecer média de custo-hora caso não exista tarifa explícita',()=>{
 const x=summarizeWorkforce(estimate(),{
  workers:[{role_code:'2020',monthly_employer_cost:'6600',active:true},
   {role_code:'2020',monthly_employer_cost:'99999',active:false},
   {role_code:'2099',monthly_employer_cost:'3520',active:true}],
  overhead:{monthly_overhead:0,workdays_per_month:22}});
 assert.equal(x.roles.find(r=>r.code==='2020').hourly_cost,37.5);
 assert.equal(x.roles.find(r=>r.code==='2099').hourly_cost,20);
 assert.equal(x.active_workers_in_registry,2);
});
test('serviço sem profissão gera estimativa parcial, nunca custo interno fechado',()=>{
 const model=buildWorkforceEstimate([...items,{id:'3',source_name:'Serviço sem composição',unit:'UN',quantity:3,direct_hh_per_unit:2,
  labor:[],source_matches_budget:true}]);
 const x=summarizeWorkforce(model,{rates:[
  {role_code:'2020',hourly_employer_cost:'30'}, {role_code:'2099',hourly_employer_cost:'20'}],
  overhead:{monthly_overhead:1000,workdays_per_month:22}});
 assert.equal(x.role_totals.unclassified_services,1);
 assert.equal(x.costs.total_parallel,null);
});
test('tela exibe total por função, prazo geral, custos não configurados e ação de cadastro',()=>{
 const x={...estimate(),...example(),budget:{code:'ORC-QA'}};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const html=workforcePanel(x,esc);
 for(const t of ['Resumo final da mão de obra','PEDREIRO','Ajudante','19 dias úteis','10 dias úteis',
  'Custo interno estimado','Cadastrar custos e profissionais','Aguardando custos-hora'])
  assert.ok(html.includes(t),t);
 assert.ok(!html.includes('data-action="schedule-add-crew"'));
 assert.ok(!html.includes('R$ 0,00'));
 const secure=readFileSync(new URL('../public/secure.js',import.meta.url),'utf8');
 assert.ok(secure.includes('companyCostsDialog'));
 assert.ok(secure.includes('companyCostsSubmit'));
});
