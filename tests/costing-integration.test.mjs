import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {createApi} from '../api/index.mjs';

const db=process.env.CIVOLTEN_TEST_DATABASE_URL;
if(!db||!/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:127\.0\.0\.1|localhost):5432\/civolten_test(?:\?.*)?$/.test(db)){
  test.skip('stage2 needs disposable localhost PostgreSQL',()=>{});
}else{
const pool=new pg.Pool({connectionString:db,max:3});
const sql={async query(text,args=[]){return (await pool.query(text,args)).rows}};
const handler=createApi(sql);
const token='c'.repeat(64);
const admin=randomUUID();
const client=randomUUID(),project=randomUUID(),budget=randomUUID(),price=randomUUID(),version=randomUUID();
const session='civolten_dev_session='+token;
async function call(route,method='GET',payload){
 const r=Readable.from(payload===undefined?[]:[Buffer.from(JSON.stringify(payload))]);
 r.url='/api/v1/'+route;r.method=method;
 r.headers={host:'localhost:3000',cookie:session, ...(method==='GET'?{}:{'x-civolten-request':'1'}), ...(payload===undefined?{}:{'content-type':'application/json'})};
 const res={statusCode:200,setHeader(){},end(x){this.body=JSON.parse(x)}};
 await handler(r,res);
 return {status:res.statusCode,body:res.body};
}
function expect(v,status){assert.equal(v.status,status,JSON.stringify(v.body));return v.body}
const bdi={administracaoCentral:4,seguro:1,garantia:.5,risco:1,despesasFinanceiras:1,lucro:5,tributosSobreReceita:7};
test('Etapa 2: SIURB canônica, custo auditado, BDI parametrizado, extras e riscos', {timeout:30000},async()=>{
 try{
  await sql.query("INSERT INTO app_users(id,login,password_hash,role,must_change_password) VALUES($1,'qa.cost-admin','ci-only-password-hash-not-for-login','administrador',false)",[admin]);
  await sql.query("INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '2 hours')",[createHash('sha256').update(token).digest('hex'),admin]);
  await sql.query("INSERT INTO clients(id,name) VALUES($1,'Cliente fictício da etapa 2')",[client]);
  await sql.query("INSERT INTO projects(id,client_id,title) VALUES($1,$2,'Obra QA de custos')",[project,client]);
  await sql.query("INSERT INTO budgets(id,code,client_id,project_id,title,reference_month,regime,bdi_pct,created_by) VALUES($1,'QA-ETAPA2-001',$2,$3,'Orçamento de homologação SIURB','2026-07','Sem desoneração',0,$4)",[budget,client,project,admin]);
  await sql.query("INSERT INTO reference_price_versions(id,source,reference_month,regime,scope,source_url,sha256) VALUES($1,'SIURB','2026-07','Sem desoneração','Edificações','https://prefeitura.sp.gov.br/web/obras/w/tabelas_de_custos/355179',$2)",[version,'a'.repeat(64)]);
  await sql.query("INSERT INTO reference_prices(id,version_id,code,description,unit,unit_cost) VALUES($1,$2,'QA-102','Serviço oficial fictício de validação','M2',100.0000)",[price,version]);
  await sql.query("INSERT INTO reference_composition_details(reference_price_id,labor,other,direct_hh_per_unit,validation) VALUES($1,'[{\"code\":\"QA-TRABALHO\",\"name\":\"Mão de obra fictícia\",\"coef\":\"0.25\"}]'::jsonb,'[]'::jsonb,0.25,'dados diretos parciais')",[price]);
  const composition=expect(await call('siurb/'+price+'/composition'),200);
  assert.equal(composition.composition_available,true);
  assert.equal(composition.labor[0].code,'QA-TRABALHO');
  const found=expect(await call('siurb/search?q=QA-102&regime='+encodeURIComponent('Sem desoneração')),200);
  assert.equal(found.length,1);assert.equal(found[0].id,price);
  const nonexistent=expect(await call('siurb/search?q=QA-102&regime='+encodeURIComponent('Com desoneração')),200);
  assert.equal(nonexistent.length,0);
  expect(await call('budgets/'+budget+'/siurb-items','POST',{lock_version:0,reference_price_id:randomUUID(),position:1,quantity:'2'}),400);
  const item=expect(await call('budgets/'+budget+'/siurb-items','POST',{lock_version:0,reference_price_id:price,position:1,quantity:'2'}),201);
  assert.equal(item.reference_price_id,price);
  expect(await call('budgets/'+budget+'/siurb-items','POST',{lock_version:0,reference_price_id:price,position:2,quantity:'3'}),409);
  let costs=expect(await call('budgets/'+budget+'/costs'),200);
  assert.equal(costs.estimate.ready,false);
  assert.equal(costs.estimate.direct_cost_reais,200);
  assert.ok(costs.estimate.errors.some(e=>e.code==='MEASUREMENTS'));
  await expect(await call('budgets/'+budget+'/cost-review/'+item.id,'PUT',{
    lock_version:costs.budget.lock_version,source:'SIURB',reference_price_id:price,
    quantity_verified:true,composition_reviewed:true,loss_pct:10,freight_unit_cost:'2.5000',other_unit_cost:'0.0000'
  }),200);
  costs=expect(await call('budgets/'+budget+'/costs'),200);
  assert.equal(costs.estimate.direct_cost_reais,225);
  const settings={lock_version:costs.budget.lock_version,bdi,contingency_pct:5,
    bdi_reviewed:true,technical_reviewed:true,commercial_reviewed:true,
    review_notes:'Revisão QA com preços, quantitativos e tributos fictícios'};
  expect(await call('budgets/'+budget+'/cost-settings','PUT',settings),200);
  expect(await call('budgets/'+budget+'/cost-settings','PUT',settings),409);
  costs=expect(await call('budgets/'+budget+'/costs'),200);
  assert.equal(costs.estimate.ready,false,'Composição oficial sem insumos precificados não pode ser aprovada');
  assert.ok(costs.estimate.errors.some(e=>e.code==='SIURB_INPUTS_UNPRICED'));
  assert.ok(costs.estimate.total_reais>costs.estimate.direct_cost_reais);
  assert.ok(costs.estimate.bdi_effective_pct>0);
  expect(await call('budgets/'+budget+'/extra-costs','POST',{
    lock_version:costs.budget.lock_version,category:'mobilizacao',description:'Mobilização não prevista no item',
    amount:'50.00',quote_reference:'QA - memória de cálculo interna',supplier_name:'CIVOLTEN'
  }),201);
  costs=expect(await call('budgets/'+budget+'/costs'),200);
  assert.equal(costs.estimate.direct_cost_reais,275);
  assert.equal(costs.estimate.ready,false,'Alteração financeira deve invalidar revisões anteriores');
  const newSettings={...settings,lock_version:costs.budget.lock_version};
  expect(await call('budgets/'+budget+'/cost-settings','PUT',newSettings),200);
  costs=expect(await call('budgets/'+budget+'/costs'),200);
  assert.equal(costs.estimate.ready,false,'Composição oficial sem insumos precificados não pode ser aprovada');
  assert.ok(costs.estimate.errors.some(e=>e.code==='SIURB_INPUTS_UNPRICED'));
  // Uma edição de quantidade deve revogar a evidência técnica e a aprovação financeira anterior.
  expect(await call('budgets/'+budget+'/items/'+item.id,'PUT',{
    position:1,source_code:'QA-102',source_name:'Serviço oficial fictício de validação',
    unit:'M2',quantity:3,direct_unit_cost:100
  }),200);
  costs=expect(await call('budgets/'+budget+'/costs'),200);
  assert.equal(costs.estimate.ready,false);
  assert.equal(costs.config.technical_reviewed,false);
  assert.ok(costs.estimate.errors.some(e=>e.code==='MEASUREMENTS'));
  // Um preço sem composição deve permanecer bloqueado; nunca marcar verificação inexistente.
  const priceMissing=randomUUID();
  await sql.query("INSERT INTO reference_prices(id,version_id,code,description,unit,unit_cost) VALUES($1,$2,'QA-103','Serviço sem composição QA','UN',15.0000)",[priceMissing,version]);
  const itemMissing=expect(await call('budgets/'+budget+'/siurb-items','POST',{
    lock_version:costs.budget.lock_version,reference_price_id:priceMissing,position:2,quantity:1
  }),201);
  costs=expect(await call('budgets/'+budget+'/costs'),200);
  assert.ok(costs.estimate.errors.some(e=>e.code==='UNAVAILABLE_COMPOSITION'));
  expect(await call('budgets/'+budget+'/cost-review/'+itemMissing.id,'PUT',{
    lock_version:costs.budget.lock_version,source:'SIURB',reference_price_id:priceMissing,
    quantity_verified:true,composition_reviewed:true,loss_pct:0
  }),400);
  const audit=await sql.query("SELECT action FROM audit_events WHERE entity_type IN ('budgets','budget_items','budget_extra_direct_costs') AND (entity_id=$1 OR entity_id=$2)",[budget,item.id]);
  assert.ok(audit.length>=2);
  const c=await sql.query('SELECT count(*)::int AS rows FROM budget_costing_profiles WHERE budget_id=$1',[budget]);
  assert.equal(c[0].rows,1);
 }finally{await pool.end()}
});
}
