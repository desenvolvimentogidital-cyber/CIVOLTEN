import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import bootstrap from '../api/bootstrap.mjs';
import {SUPABASE} from '../lib/civolten-security.mjs';

const root='https://civolten.example.test';
const jwt='A'.repeat(100);
const tables={
 settings:'cv_settings',
 workers:'cv_workers',
 professions:'cv_professions',
 fixed:'cv_fixed_costs',
 variable:'cv_variable_costs',
 budgets:'cv_budgets',
 cash:'cv_cash_entries'
};
const request=(cookie=true,site='same-origin')=>new Request(root+'/api/bootstrap',{
 headers:{'sec-fetch-site':site,...(cookie?{cookie:'__Host-civolten_session='+jwt}:{})}
});
function mockFetch(fn){
 const original=globalThis.fetch;
 globalThis.fetch=fn;
 return ()=>{globalThis.fetch=original};
}

test('bootstrap exige autenticação antes de consultar qualquer dado financeiro',async()=>{
 const calls=[];
 const restore=mockFetch(async url=>{
  calls.push(String(url));
  return Response.json({authenticated:false});
 });
 try{
  const res=await bootstrap.fetch(request());
  assert.equal(res.status,401);
  assert.equal(calls.length,1);
  assert.ok(calls[0].startsWith(SUPABASE+'/auth/v1/user'));
  assert.equal(res.headers.get('cache-control'),'no-store, private');
 }finally{restore()}
});

test('bootstrap exige cookie valido e rejeita requisições cross-site',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error('não deveria consultar nenhum serviço')};
 try{
  assert.equal((await bootstrap.fetch(request(false))).status,401);
  assert.equal((await bootstrap.fetch(request(false,'cross-site'))).status,403);
 }finally{globalThis.fetch=original}
});

test('bootstrap verifica identidade uma vez e faz sete consultas RLS em paralelo',async()=>{
 const calls=[],restCalls=[];
 const restore=mockFetch(async (url,opts={})=>{
  const endpoint=String(url);calls.push(endpoint);
  if(endpoint.startsWith(SUPABASE+'/auth/v1/user')){
   assert.equal(opts.headers.Authorization,'Bearer '+jwt);
   return Response.json({id:'550e8400-e29b-41d4-a716-446655440000'});
  }
  assert.ok(endpoint.startsWith(SUPABASE+'/rest/v1/'));
  const u=new URL(endpoint),table=u.pathname.split('/').pop();
  const key=Object.keys(tables).find(k=>tables[k]===table);
  assert.ok(key,'tabela desconhecida');
  assert.equal(opts.headers.Authorization,'Bearer '+jwt,'RLS usa sessão da pessoa autenticada');
  assert.equal(u.searchParams.get('select'),'*');
  assert.equal(u.searchParams.get('limit'),'250');
  assert.equal(u.searchParams.get('order'),key==='settings'?null:key==='cash'?'occurred_on.desc,created_at.desc,id.desc':'created_at.desc,id.desc');
  restCalls.push(key);
  // Força uma barreira: nenhum pedido pode terminar até todos iniciarem.
  if(restCalls.length===7)release();
  await allStarted;
  return Response.json([{name:key}]);
 });
 let release;
 const allStarted=new Promise(resolve=>{release=resolve});
 try{
  const res=await bootstrap.fetch(request());
  assert.equal(res.status,200);
  const payload=await res.json();
  assert.deepEqual(Object.keys(payload.data).sort(),Object.keys(tables).sort());
  for(const name of Object.keys(tables))assert.deepEqual(payload.data[name],[{name}]);
  assert.equal(calls.length,8,'uma identidade validada e sete consultas em paralelo');
  assert.equal(calls.filter(x=>x.startsWith(SUPABASE+'/auth/v1/user')).length,1);
  assert.equal(restCalls.length,7);
 }finally{restore()}
});

test('falhas parciais retornam erro seguro sem expor dados incompletos',async()=>{
 const restore=mockFetch(async url=>{
  const endpoint=String(url);
  if(endpoint.startsWith(SUPABASE+'/auth/v1/user'))return Response.json({id:'550e8400-e29b-41d4-a716-446655440000'});
  if(endpoint.includes('/cv_budgets?'))return Response.json({error:'erro privado interno'}, {status:500});
  return Response.json([]);
 });
 try{
  const res=await bootstrap.fetch(request());
  assert.equal(res.status,502);
  const data=await res.json();
  assert.match(data.error,/Não foi possível carregar os dados/);
  assert.ok(!JSON.stringify(data).includes('erro privado interno'));
  assert.equal(data.data,undefined);
 }finally{restore()}
});

test('painel não bloqueia pela paleta e a lista de acesso carrega sob demanda',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 assert.match(app,/void loadBrand\(\);/);
 assert.doesNotMatch(app,/await loadBrand\(\)/);
 assert.match(app,/request\('\/api\/bootstrap'\)/);
 const showApp=app.slice(app.indexOf('async function showApp()'),app.indexOf('function authMode(mode)'));
 assert.match(showApp,/await reload\(\)/);
 assert.doesNotMatch(showApp,/api\/access/);
 assert.match(showApp,/app\.inert=true/);
 assert.match(showApp,/app\.hidden=true;auth\.hidden=false/);
 assert.doesNotMatch(app,/if\(state\.view==='access'\)/);
 assert.doesNotMatch(app,/\/api\/access\?action=list/);
 assert.match(app,/Verificando acesso\.\.\./);
});
