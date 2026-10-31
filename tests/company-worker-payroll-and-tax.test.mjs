import test from 'node:test';
import assert from 'node:assert/strict';
import {handleCompanyCosts} from '../src/company-costs-api.mjs';
import {summarizeWorkforce} from '../src/workforce-costing.mjs';

const user={id:'11111111-1111-4111-8111-111111111111',role:'administrador'};
const salary={display_name:'Eletricista A',role_code:'2020',role_name:'Eletricista',
 monthly_salary:'4000',monthly_additional_cost:'600',workdays_per_month:'20',
 hours_per_day:'8'};
const values={internal_labor_cost:'6000',material_cost:'2000',equipment_cost:'500',
 other_direct_cost:'100',owner_prolabore_allocation:'500',other_overhead_allocation:'200',
 tax_service_pct:'6',tax_material_pct:'4.5',material_revenue_share_pct:'0',
 materials_separately_billed:'false'};

async function run(parts,method,body,role='administrador'){
 const queries=[];let status,bodyOut;
 const sql={async query(q,args=[]){
  queries.push({q,args});
  if(q.startsWith('SELECT target_margin_pct,owner_prolabore_monthly FROM company_pricing_config'))
   return [{target_margin_pct:'30',owner_prolabore_monthly:'10000'}];
  if(q.includes('INSERT INTO company_workers(')||q.includes('UPDATE company_workers SET'))
   return [{id:'22222222-2222-4222-8222-222222222222',monthly_employer_cost:args[3]??args[4]}];
  throw Error('Unexpected SQL '+q.slice(0,100));
 }};
 await handleCompanyCosts({req:{},res:{},sql,user:{...user,role},parts,method,
  readBody:async()=>body,send:(_r,s,out)=>{status=s;bodyOut=out}});
 return {queries,status,body:bodyOut};
}
test('cadastro real compõe salário mensal com adicionais informados, dias e horas sem valores fictícios',async()=>{
 const r=await run(['company-costs','workers'],'POST',salary);
 assert.equal(r.status,201);
 assert.equal(r.queries.length,1);
 const args=r.queries[0].args;
 assert.equal(args[3],'4600.00');
 assert.deepEqual(args.slice(5),['4000','600',20,'8']);
 assert.match(r.queries[0].q,/monthly_salary,monthly_additional_cost,workdays_per_month,hours_per_day/);
});
test('sem adicionais e jornada explícitos não aceita um salário como custo patronal completo',async()=>{
 for(const [field,value] of [['monthly_additional_cost',''],['workdays_per_month',''],['hours_per_day','']]){
  const body={...salary,[field]:value};
  if(field==='monthly_additional_cost')await assert.rejects(()=>run(['company-costs','workers'],'POST',body),/obrigatório/);
  else {
   const r=await run(['company-costs','workers'],'POST',body);
   assert.equal(r.status,400);
   assert.equal(r.queries.length,0);
  }
 }
});
test('salários legados preservam modo de custo completo sem inventar salário-base',async()=>{
 const body={display_name:'Colaborador legado',role_code:'ABC',role_name:'Profissão',
  monthly_employer_cost:'3700'};
 const r=await run(['company-costs','workers'],'POST',body);
 assert.equal(r.status,201);
 assert.equal(r.queries[0].args[3],'3700');
 assert.deepEqual(r.queries[0].args.slice(5),[null,null,null,null]);
});
test('hora própria usa dias e jornada do funcionário, não assume 22 dias',()=>{
 const model={settings:{hours_day:8,target_days:10},services:[{
  id:'1',title:'Instalação elétrica',workers:1,days_at_suggested_staff:2,
  roles:[{code:'ELE',name:'Eletricista',workers:1,projected_hh:16}]
 }]};
 const x=summarizeWorkforce(model,{workers:[{role_code:'ELE',monthly_employer_cost:'4600',
  workdays_per_month:20,hours_per_day:'8',active:true}]});
 assert.equal(x.roles[0].hourly_cost,28.75);
 assert.equal(x.roles[0].estimated_cost,460);
 assert.equal(x.roles[0].cost_source,'media_do_cadastro');
});
test('estimativa só de serviços usa 6% informado e não aplica 4,5% ao material incorporado',async()=>{
 const r=await run(['company-costs','pricing','simulate'],'POST',values);
 assert.equal(r.status,200);
 assert.equal(r.body.taxes_on_revenue_pct,6);
 assert.equal(r.body.tax_breakdown.material_revenue_share_pct,0);
 assert.equal(r.body.tax_breakdown.verified_by_accountant,false);
 assert.equal(r.body.commercial_release,false);
 assert.equal(r.queries.length,1);
 assert.ok(r.queries[0].q.startsWith('SELECT'));
});
test('venda separada de material só entra após declaração explícita',async()=>{
 const body={...values,material_revenue_share_pct:'25'};
 const invalid=await run(['company-costs','pricing','simulate'],'POST',body);
 assert.equal(invalid.status,400);
 assert.equal(invalid.queries.length,0);
 const good=await run(['company-costs','pricing','simulate'],'POST',{
  ...body,materials_separately_billed:'true'});
 assert.equal(good.status,200);
 assert.equal(good.body.taxes_on_revenue_pct,5.625);
 assert.equal(good.body.tax_breakdown.material_revenue_share_pct,25);
 assert.equal(good.body.reference_siurb_added,false);
 assert.equal(good.body.bdi_added,false);
 assert.equal(good.body.can_issue,false);
});
test('rejeita taxas inválidas e não permite previsão fiscal por perfil não administrador',async()=>{
 await assert.rejects(()=>run(['company-costs','pricing','simulate'],'POST',{
  ...values,tax_service_pct:'abc'}),/inválido/);
 const deny=await run(['company-costs','pricing','simulate'],'POST',values,'orcamentista');
 assert.equal(deny.status,403);
 assert.equal(deny.queries.length,0);
});
