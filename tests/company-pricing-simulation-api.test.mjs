import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleCompanyCosts} from '../src/company-costs-api.mjs';

const costs={
 internal_labor_cost:'6000',material_cost:'2000',equipment_cost:'500',
 other_direct_cost:'100',owner_prolabore_allocation:'500',
 other_overhead_allocation:'200',taxes_on_revenue_pct:'10'
};
const run=async({role='administrador',body=costs,dbRows=[
 {target_margin_pct:'30.00',owner_prolabore_monthly:'10000.00'}
]}={})=>{
 const calls=[];
 const sql={async query(query,params){
  calls.push({query,params});
  if(query.startsWith('SELECT target_margin_pct,owner_prolabore_monthly FROM company_pricing_config'))
   return dbRows;
  throw new Error('Unexpected SQL: simulator must never mutate or query customer data');
 }};
 let status=null,result=null;
 await handleCompanyCosts({
  req:{},res:{},sql,user:{id:'admin-fixture',role},
  parts:['company-costs','pricing','simulate'],method:'POST',
  readBody:async()=>body,
  send:(_res,code,data)=>{status=code;result=data;}
 });
 return {status,result,calls};
};

test('calcula valor indicativo usando somente custos próprios completos e tributos confirmados',async()=>{
 const {status,result,calls}=await run();
 assert.equal(status,200);
 assert.equal(result.complete_cost_reais,9300);
 assert.equal(result.price.sale_price,15500);
 assert.equal(result.price.margin_pct,30);
 assert.equal(result.taxes_on_revenue_pct,10);
 assert.equal(result.price.profit_before_income_tax,4650);
 assert.equal(Number(result.owner_prolabore_monthly_configured),10000);
 assert.equal(result.reference_siurb_added,false);
 assert.equal(result.bdi_added,false);
 assert.equal(result.stored,false);
 assert.equal(result.can_issue,false);
 assert.equal(result.commercial_release,false);
 assert.equal(calls.length,1);
 assert.ok(calls[0].query.startsWith('SELECT'));
});

test('impede orçamento comercial com tributos não informados ou categorias omitidas',async()=>{
 for(const [field,missing] of [['taxes_on_revenue_pct',undefined],['owner_prolabore_allocation',null],['material_cost','']]){
  const invalid={...costs,[field]:missing};
  await assert.rejects(()=>run({body:invalid}),/obrigatório/);
 }
});

test('não converte custo zero em preço comercial',async()=>{
 const zeros=Object.fromEntries(Object.keys(costs).map(key=>[key,'0']));
 const out=await run({body:zeros});
 assert.equal(out.status,400);assert.match(out.result.error,/custo real positivo/);
});

test('taxa e margem impossíveis são recusadas e não alteram dados',async()=>{
 await assert.rejects(()=>run({body:{...costs,taxes_on_revenue_pct:'bad'}}),/inválido/);
 await assert.rejects(()=>run({
  body:{...costs,taxes_on_revenue_pct:'60'},
  dbRows:[{target_margin_pct:'50',owner_prolabore_monthly:'10000'}]
 }),/não deixam espaço/);
});

test('somente administrador acessa dados sensíveis da simulação',async()=>{
 for(const role of ['orcamentista','revisor','consulta']){
  const r=await run({role});
  assert.equal(r.status,403);
  assert.equal(r.calls.length,0);
 }
});

test('sem configuração comercial não finge cálculo automático',async()=>{
 const r=await run({dbRows:[]});
 assert.equal(r.status,409);
 assert.equal(r.result.commercial_release,undefined);
});

test('interface do orçamento oferece campos próprios e resultado sem emitir contrato',()=>{
 const panel=readFileSync(new URL('../public/secure-company-costs.js',import.meta.url),'utf8');
 const secure=readFileSync(new URL('../public/secure.js',import.meta.url),'utf8');
 assert.match(panel,/company-simulate-sale/);
 assert.match(panel,/company-simulate-form/);
 assert.match(panel,/taxes_on_revenue_pct/);
 assert.match(panel,/owner_prolabore_allocation/);
 assert.match(panel,/company-costs\/pricing\/simulate/);
 assert.match(panel,/scenario\.can_issue!==false/);
 assert.match(secure,/companyCostsSubmit\(form,\{state,api,toast,dialog,esc/);
 assert.doesNotMatch(panel,/localStorage\.setItem/);
});
