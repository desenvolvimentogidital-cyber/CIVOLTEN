import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readCompanyCosts,handleCompanyCosts} from '../src/company-costs-api.mjs';

const configured={target_margin_pct:'30.00',owner_prolabore_monthly:'10000.00'};
const sqlFake=(present=true)=>{
 const calls=[];
 return {calls,async query(query,values){
  calls.push({query,values});
  if(query.includes('FROM company_labor_rates'))return [];
  if(query.includes('FROM company_workers'))return [];
  if(query.includes('FROM company_overhead_config'))return [];
  if(query.includes('FROM company_pricing_config')){
   if(!present)throw Object.assign(new Error('relation not found'),{code:'42P01'});
   return [configured];
  }
  if(query.includes('INSERT INTO company_pricing_config'))
   return [{...configured,updated_at:'2026-10-30T00:00:00Z'}];
  throw Error('Unexpected test SQL');
 }};
};
const run=async ({user,method='GET',parts=['company-costs'],body={},sql=sqlFake()})=>{
 let status=null,data=null;
 await handleCompanyCosts({req:{},res:{},sql,user,parts,method,readBody:async()=>body,
  send:(_res,code,obj)=>{status=code;data=obj;}});
 return {status,data,sql};
};
test('configuração da empresa retorna 30% e R$10 mil, sem liberar venda',async()=>{
 const a=await run({user:{id:'admin-test',role:'administrador'}});
 assert.equal(a.status,200);
 assert.equal(Number(a.data.pricing.target_margin_pct),30);
 assert.equal(Number(a.data.pricing.owner_prolabore_monthly),10000);
 assert.equal(a.data.commercial_release,false);
});
test('migração ainda ausente não derruba leitura nem presume valores',async()=>{
 const a=await run({user:{id:'admin-test',role:'administrador'},sql:sqlFake(false)});
 assert.equal(a.status,200);
 assert.equal(a.data.pricing,null);
 assert.equal(a.data.pricing_setup_required,true);
});
test('dados internos e configuração não são expostos para usuário não autorizado',async()=>{
 const a=await run({user:{id:'externo-test',role:'visualizador'}});
 assert.equal(a.status,403);assert.equal(a.sql.calls.length,0);
});
test('somente administrador altera margem e pró-labore',async()=>{
 const a=await run({user:{id:'orcamentista-test',role:'orcamentista'},method:'PUT',
  parts:['company-costs','pricing'],body:configured});
 assert.equal(a.status,403);assert.equal(a.sql.calls.length,0);
});
test('administrador atualiza configuração com SQL parametrizado e trilha de auditoria',async()=>{
 const sql=sqlFake(),a=await run({user:{id:'admin-test',role:'administrador'},method:'PUT',
  parts:['company-costs','pricing'],body:configured,sql});
 assert.equal(a.status,200);
 assert.equal(a.data.commercial_release,false);
 const write=sql.calls.find(c=>c.query.includes('INSERT INTO company_pricing_config'));
 assert.ok(write);
 assert.deepEqual(write.values,['30.00','10000.00','admin-test']);
 assert.match(write.query,/INSERT INTO audit_events/);
 assert.doesNotMatch(write.query,/UPDATE budgets|UPDATE budget_items|UPDATE reference_prices/);
});
test('rejeita margens inválidas sem consultar nem alterar o banco',async()=>{
 const sql=sqlFake();
 await assert.rejects(()=>run({user:{id:'admin-test',role:'administrador'},method:'PUT',
  parts:['company-costs','pricing'],body:{target_margin_pct:'81',owner_prolabore_monthly:'10000'},sql}),/inválid/);
 assert.equal(sql.calls.length,0);
});
test('interface mantém margem e pró-labore separados do BDI',()=>{
 const ui=readFileSync(new URL('../public/secure-company-costs.js',import.meta.url),'utf8');
 assert.match(ui,/company-edit-pricing/);
 assert.match(ui,/company-pricing-form/);
 assert.match(ui,/state\.user\?\.role==='administrador'/);
 assert.match(ui,/Não somar automaticamente ao BDI/);
});
