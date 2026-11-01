import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSiurbDirectLabor} from '../src/siurb-direct-labor-prices.mjs';
import {handleStage2} from '../src/costing-api.mjs';
import {costHandleClick} from '../public/secure-costing.js';

const regime='Sem desoneração',month='2026-07',
 hash='ecba70b7a8fae694'+'a'.repeat(48);
const tariff={code:'2099',kind:'horista',variant:'com_encargos',unit:'H',
 unit_cost:'27.1200',regime,reference_month:month,source_sha256:hash};
const labor=[{code:'2099',name:'SERVENTE (SGSP)',unit:'H',coef:.45}];

test('Tarifa horista SIURB calcula apenas a mao de obra direta por unidade',()=>{
 const r=compareSiurbDirectLabor({labor,tariffs:[tariff],regime,reference_month:month});
 assert.equal(r.direct_labor_cost_reais_per_service_unit,12.204);
 assert.equal(r.components[0].hourly_tariff_with_charges_reais,27.12);
 assert.equal(r.components[0].source_sha256,hash);
 assert.equal(r.direct_labor_rates_complete,true);
 assert.equal(r.full_service_composition_reconciled,false);
 assert.equal(r.commercially_approved,false);
});
test('Mao de obra sem tarifa, coeficiente valido ou regime correspondente nao usa zero e nao apresenta total',()=>{
 for(const [tariffs,part] of [
  [[],labor],
  [[{...tariff,regime:'Com desoneração'}],labor],
  [[tariff],[{...labor[0],coef:null}]],
  [[tariff],[{...labor[0],unit:'UN'}]],
  [[tariff,tariff],labor]
 ]){
  const r=compareSiurbDirectLabor({labor:part,tariffs,regime,reference_month:month});
  assert.equal(r.direct_labor_rates_complete,false);
  assert.equal(r.direct_labor_cost_reais_per_service_unit,null);
  assert.equal(r.missing.length,1);
 }
});
test('Endpoint da composicao inclui tarifas oficiais por codigo e regime, sem modificar preco SIURB',async()=>{
 const id='11111111-1111-4111-8111-111111111111',version='22222222-2222-4222-8222-222222222222';
 const root={id,version_id:version,code:'4001070',description:'Serviço QA',unit:'M2',unit_cost:'80.00',
  category:'Edificações',regime,reference_month:month,labor,other:[],direct_hh_per_unit:'0.45',
  validation:{},source_url:'https://prefeitura.sp.gov.br/',sha256:hash};
 let status=null,response=null,queries=[];
 const sql={async query(q,args){queries.push({q,args});
  if(q.includes('FROM reference_prices p JOIN reference_price_versions v'))return [root];
  if(q.includes('FROM siurb_supplement_prices p JOIN siurb_supplement_sources s'))return [tariff];
  throw Error('Unexpected SQL: '+q.slice(0,70));
 }};
 const handled=await handleStage2({req:{url:'/api/v1/siurb/'+id+'/composition'},res:{},
  sql,user:{role:'consulta'},parts:['siurb',id,'composition'],method:'GET',
  send:(_res,s,data)=>{status=s;response=data}});
 assert.equal(handled,true);assert.equal(status,200);
 assert.equal(response.unit_cost,'80.00');
 assert.equal(response.siurb_direct_labor_reference.direct_labor_cost_reais_per_service_unit,12.204);
 assert.equal(response.siurb_direct_labor_reference.commercially_approved,false);
 assert.equal(queries.length,2);
 assert.deepEqual(queries[1].args,[month,regime,['2099']]);
});
test('Interface diferencia tarifa horista direta do preco de servico com materiais',async()=>{
 const supplement=compareSiurbDirectLabor({labor,tariffs:[tariff],regime,reference_month:month});
 let html=null;
 const result=await costHandleClick({dataset:{action:'cost-composition',id:'a'}},{
  api:async()=>({code:'4001070',description:'Serviço',unit:'M2',labor,other:[],direct_hh_per_unit:'0.45',
   inspection:{nodes:[]},siurb_direct_labor_reference:supplement}),
  dialog:(_title,body)=>{html=body},esc:x=>String(x??'')});
 assert.equal(result,true);
 assert.match(html,/Tarifas horistas SIURB oficiais/);
 assert.match(html,/27,12/);
 assert.match(html,/12,20/);
 assert.match(html,/Não somar ao preço integral SIURB/);
});
