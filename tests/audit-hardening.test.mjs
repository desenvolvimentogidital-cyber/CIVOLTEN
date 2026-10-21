import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateBudget} from '../lib/civolten-calc.mjs';
import {listRows} from '../lib/civolten-pages.mjs';
import {readBody,EDGE,SUPABASE} from '../lib/civolten-security.mjs';
import dataApi from '../api/data.mjs';

const basis={days:5,staff:[{daily_cents:20000,days:5,charges_pct:0}],expenses:[{unit_cents:50000,qty:1}],pricing:{fixed_monthly_cents:220000,billable_days_month:22,tax_pct:10,margin_pct:20}};
const withStaff=(override)=>({...basis,staff:[{...basis.staff[0],...override}]});
const withExpense=(override)=>({...basis,expenses:[{...basis.expenses[0],...override}]});

test('auditoria: valores reais produzidos sem alteracao do calculo esperado',()=>{
 const v=calculateBudget(basis);
 assert.deepEqual([v.labor_cents,v.variable_cents,v.fixed_cents,v.cost_cents,v.calculated_price_cents],[100000,50000,50000,200000,285715]);
});

test('auditoria: nenhum custo invalido pode virar silenciosamente zero ou custo menor',()=>{
 const samples=[
  withStaff({daily_cents:-500}),
  withStaff({daily_cents:'valor errado'}),
  withStaff({daily_cents:1.2}),
  withStaff({days:-10}),
  withStaff({days:12000}),
  withExpense({qty:NaN}),
  withExpense({qty:-2}),
  withExpense({unit_cents:1e12}),
  {...basis,pricing:{...basis.pricing,tax_pct:Infinity}},
  {...basis,pricing:{...basis.pricing,margin_pct:-1}},
  {...basis,pricing:{...basis.pricing,fixed_monthly_cents:'invalido'}},
  {...basis,manual_price_cents:-5000}
 ];
 for(const budget of samples)assert.throws(()=>calculateBudget(budget));
});

test('auditoria: valores muito grandes nao podem perder centavos por falta de precisao',()=>{
 assert.throws(()=>calculateBudget({...basis,staff:Array.from({length:4},()=>({daily_cents:1e11,days:10000,charges_pct:200}))}),/limite seguro/);
 assert.throws(()=>calculateBudget({...basis,manual_price_cents:Number.MAX_SAFE_INTEGER+1}),/inválido|inteiros|limite/);
});

test('auditoria: zero de encargos e zero de despesas continuam permitidos',()=>{
 const v=calculateBudget({days:1,staff:[{daily_cents:10000,days:1,charges_pct:''}],pricing:{billable_days_month:22}});
 assert.equal(v.labor_cents,10000);
 assert.equal(v.price_cents,10000);
});

function withMock(fn,run){
 const previous=globalThis.fetch;globalThis.fetch=fn;
 return Promise.resolve().then(run).finally(()=>{globalThis.fetch=previous});
}

test('auditoria: pagina acima de 250 registros sem ocultar entradas antigas',async()=>{
 const urls=[];
 await withMock(async url=>{
  const u=new URL(url);urls.push(u);
  const offset=Number(u.searchParams.get('offset'));
  return Response.json(offset===0?Array.from({length:250},(_,i)=>({id:i})): [{id:250}]);
 },async()=>{
  const records=await listRows(new URL(SUPABASE+'/rest/v1/cv_budgets?select=*&order=created_at.desc,id.desc'),{Authorization:'Bearer fake'});
  assert.equal(records.length,251);
  assert.equal(records[250].id,250);
  assert.deepEqual(urls.map(x=>x.searchParams.get('offset')),['0','250']);
 });
});

test('auditoria: se banco falha na segunda pagina, nao retorna lista incompleta',async()=>{
 await withMock(async url=>{
  const offset=Number(new URL(url).searchParams.get('offset'));
  return offset===0?Response.json([{id:1},{id:2}]):Response.json({error:'db'}, {status:502});
 },async()=>{
  await assert.rejects(listRows(SUPABASE+'/rest/v1/cv_budgets',{}, {pageSize:2,maxRows:4}),/Falha na consulta/);
 });
});

test('auditoria: lista limitada avisa em vez de fingir ter todo o historico',async()=>{
 await withMock(async ()=>Response.json([{id:1},{id:2}]),async()=>{
  await assert.rejects(listRows(SUPABASE+'/rest/v1/cv_budgets',{}, {pageSize:2,maxRows:4}),/2.000 registros/);
 });
});

test('auditoria: API impede falso sucesso ao editar ou excluir id sem resultado',async()=>{
 const token='a'.repeat(96),uuid='2f8e7050-f56e-4d31-973d-b53295960819';
 await withMock(async url=>{
  const u=String(url);
  if(u.startsWith(EDGE))return Response.json({authenticated:true});
  if(u.startsWith(SUPABASE+'/rest/v1/cv_workers'))return Response.json([]);
  throw Error('Endpoint inesperado');
 },async()=>{
  for(const method of ['PATCH','DELETE']){
   const request=new Request('https://civolten.example.test/api/data?entity=workers&id='+uuid,{
    method,
    headers:{origin:'https://civolten.example.test','sec-fetch-site':'same-origin','content-type':'application/json',cookie:'__Host-civolten_session='+token},
    ...(method==='PATCH'?{body:JSON.stringify({record:{name:'Equipe teste'}})}:{})
   });
   const response=await dataApi.fetch(request);
   assert.equal(response.status,404);
   assert.match((await response.json()).error,/Registro não encontrado/);
  }
 });
});

test('auditoria: JSON tem limite de bytes mesmo sem cabeçalho content-length',async()=>{
 const req=new Request('https://civolten.example.test/api/data',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({record:{name:'x'.repeat(4000)}})
 });
 await assert.rejects(readBody(req,100),/Requisição grande demais/);
});

test('auditoria: JSON curto valido e aceito normalmente',async()=>{
 const req=new Request('https://civolten.example.test/api/data',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({record:{name:'Teste'}})
 });
 assert.equal((await readBody(req,100)).record.name,'Teste');
});
