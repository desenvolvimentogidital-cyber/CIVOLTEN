import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReviewedAutoplan} from '../src/reviewed-autoplan.mjs';
import {handleReviewedAutoplan} from '../src/reviewed-autoplan-api.mjs';
const budget='11111111-1111-4111-8111-111111111111';
const item={id:'22222222-2222-4222-8222-222222222222',position:1,
 source_code:'QA-600',source_name:'Instalação elétrica QA',quantity:'10',
 labor_review_state:'revisado',direct_labor_hh_unit:'1.5',
 source_matches_budget:true,reference_price_id:'33333333-3333-4333-8333-333333333333',
 labor:[{code:'2099',name:'Servente',unit:'H',coef:1},{code:'2020',name:'Pedreiro',unit:'H',coef:.5}]};
const workers=[{role_code:'2099',role_name:'Servente',active:true},
 {role_code:'2099',role_name:'Servente',active:true},
 {role_code:'2020',role_name:'Pedreiro',active:true}];
const args={items:[item],workers,hours_day:'8',efficiency_pct:'80'};
test('revisa competência e cargos reais antes de gerar duração por função',()=>{
 const p=buildReviewedAutoplan(args);
 assert.equal(p.ready,true);assert.equal(p.tasks.length,1);
 assert.equal(p.roles.length,2);assert.equal(p.planned_headcount,3);
 assert.equal(p.tasks[0].duration_workdays,1);
 assert.equal(p.assigns_real_workers,false);
 assert.equal(p.commercial_release,false);
});
test('sem trabalhador, produtividade revisada, categoria ou hora-homem não gera tarefas',()=>{
 for(const input of [
  {...args,workers:[]},
  {...args,workers:workers.filter(x=>x.role_code==='2099')},
  {...args,items:[{...item,labor_review_state:'pendente'}]},
  {...args,items:[{...item,direct_labor_hh_unit:'0'}]},
  {...args,items:[{...item,direct_labor_hh_unit:'2'}]},
  {...args,items:[{...item,source_matches_budget:false}]},
  {...args,hours_day:''},
  {...args,efficiency_pct:''}
 ]){
  const p=buildReviewedAutoplan(input);
  assert.equal(p.ready,false);
  assert.equal(p.tasks.length,0);
  assert.ok(p.issues.length>0);
 }
});
test('duração considera gargalo de profissão, nunca apenas total da equipe',()=>{
 const plan=buildReviewedAutoplan({...args,items:[{...item,quantity:'40'}]});
 assert.equal(plan.tasks[0].duration_workdays,4);
});
test('somente usuário interno com escrita acessa geração antes de qualquer leitura do banco',async()=>{
 let sent=null,queries=0;
 const done=await handleReviewedAutoplan({req:{},res:{},user:{role:'consulta'},method:'POST',
  parts:['budgets',budget,'schedule-autogenerate'],readBody:async()=>args,
  sql:{async query(){queries++}},send:(_res,status,data)=>{sent={status,data}}});
 assert.equal(done,true);assert.equal(sent.status,403);assert.equal(queries,0);
});
test('não aceita método GET no endpoint de gravação',async()=>{
 let s=null;
 await handleReviewedAutoplan({req:{},res:{},user:{role:'administrador'},method:'GET',
  parts:['budgets',budget,'schedule-autogenerate'],sql:{async query(){throw Error('unexpected')}},
  send:(_res,status)=>{s=status}});
 assert.equal(s,405);
});
