import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleBudgetProfessionRequirements,handleBudgetRequiredProfessions} from '../src/budget-required-professions-api.mjs';
const budgetId='11111111-1111-4111-8111-111111111111';
const item={id:'22222222-2222-4222-8222-222222222222',source_name:'Instalação QA',
 source_code:'QA100',quantity:'10',reference_price_id:'33333333-3333-4333-8333-333333333333',
 source_matches_budget:true,direct_labor_hh_unit:'1.5',labor_review_state:'revisado',
 labor:[{code:'2099',name:'SERVENTE',unit:'H',coef:'1'},
  {code:'1037',name:'ELETROTÉCNICO MONTADOR',unit:'H',coef:'0.5'},
  {code:'5000',name:'COMPRESSOR',unit:'HMAQ',coef:'0.7'}]};
test('lista profissões horistas e mensalistas sem incluir equipamento',()=>{
 const m=assembleBudgetProfessionRequirements([item],[{role_code:'2099',active_workers:2}]);
 assert.equal(m.professions.length,2);
 assert.deepEqual(m.professions.map(x=>x.code),['1037','2099']);
 assert.equal(m.professions.find(x=>x.code==='1037').estimated_hh,5);
 assert.equal(m.professions.find(x=>x.code==='2099').estimated_hh,10);
 assert.equal(m.professions.find(x=>x.code==='2099').active_workers,2);
 assert.equal(m.professions.find(x=>x.code==='1037').active_workers,0);
 assert.equal(m.summary.missing_active_professions,1);
 assert.equal(m.staffing_complete,false);
 assert.equal(m.commercial_release,false);
 assert.equal(JSON.stringify(m).includes('monthly_salary'),false);
});
test('rejeita tabela SIURB incompatível, não trata zero como trabalhador e não presume revisão',()=>{
 const x=assembleBudgetProfessionRequirements([
  {...item,source_matches_budget:false},
  {...item,labor_review_state:'pendente',source_name:'Outro serviço'}],
  [{role_code:'2099',active_workers:0}]);
 assert.equal(x.summary.items_without_composition,1);
 assert.equal(x.summary.services_pending_productivity_review,1);
 assert.equal(x.professions.every(r=>r.estimated_hh===null),true);
 assert.equal(x.professions.every(r=>r.hours_estimate_verified===false),true);
 assert.equal(x.staffing_complete,false);
});
test('não aceita papel de leitura, nem escrita no endpoint de levantamento',async()=>{
 const out=[],sql={async query(){throw Error('acesso não autorizado')}};
 const req={url:'/api/v1/budgets/'+budgetId+'/required-professions'};
 const ctx={req,res:{},sql,user:{role:'consulta'},parts:['budgets',budgetId,'required-professions'],
  send:(_r,status,data)=>out.push({status,data})};
 assert.equal(await handleBudgetRequiredProfessions({...ctx,method:'GET'}),true);
 assert.equal(out[0].status,403);
 assert.equal(await handleBudgetRequiredProfessions({...ctx,method:'POST'}),true);
 assert.equal(out[1].status,405);
});
test('consulta somente dados agregados do cadastro real e profissões do orçamento',async()=>{
 const queries=[],out=[];
 const sql={async query(q,args=[]){
  queries.push({q,args});
  if(q.startsWith('SELECT id,code,status'))return [{id:budgetId,code:'QA',status:'rascunho',
    reference_month:'2026-07',regime:'Sem desoneração'}];
  if(q.includes('FROM budget_items i'))return [item];
  if(q.includes('FROM company_workers'))return [{role_code:'2099',active_workers:1}];
  throw Error('SQL inesperado '+q.slice(0,100));
 }};
 const ok=await handleBudgetRequiredProfessions({req:{},res:{},sql,
  user:{role:'administrador'},parts:['budgets',budgetId,'required-professions'],
  method:'GET',send:(_r,status,payload)=>out.push({status,payload})});
 assert.equal(ok,true);
 assert.equal(out[0].status,200);
 assert.equal(out[0].payload.summary.required_professions,2);
 assert.equal(queries.length,3);
 assert.equal(queries.some(x=>/monthly_salary|monthly_employer_cost|display_name|password_hash/.test(x.q)),false);
 assert.equal(queries.some(x=>/^UPDATE|^INSERT|^DELETE/.test(x.q)),false);
});
