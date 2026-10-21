import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import bootstrap from '../api/bootstrap.mjs';
import {SUPABASE,EDGE} from '../lib/civolten-security.mjs';

const root='https://civolten.example.test';
const jwt='A'.repeat(100);
const tables={
 settings:'cv_settings',
 workers:'cv_workers',
 fixed:'cv_fixed_costs',
 variable:'cv_variable_costs',
 budgets:'cv_budgets'
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
  assert.ok(calls[0].startsWith(EDGE));
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

test('bootstrap verifica admin uma vez e faz cinco consultas RLS em paralelo',async()=>{
 const calls=[],restCalls=[];
 const restore=mockFetch(async (url,opts={})=>{
  const endpoint=String(url);calls.push(endpoint);
  if(endpoint.startsWith(EDGE)){
   assert.equal(opts.headers.Authorization,'Bearer '+jwt);
   return Response.json({authenticated:true});
  }
  assert.ok(endpoint.startsWith(SUPABASE+'/rest/v1/'));
  const u=new URL(endpoint),table=u.pathname.split('/').pop();
  const key=Object.keys(tables).find(k=>tables[k]===table);
  assert.ok(key,'tabela desconhecida');
  assert.equal(opts.headers.Authorization,'Bearer '+jwt,'RLS usa sessão da pessoa autenticada');
  assert.equal(u.searchParams.get('select'),'*');
  assert.equal(u.searchParams.get('limit'),'250');
  assert.equal(u.searchParams.get('order'),key==='settings'?null:'created_at.desc');
  restCalls.push(key);
  // Força uma barreira: nenhum pedido pode terminar até todos iniciarem.
  if(restCalls.length===5)release();
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
  assert.equal(calls.length,6,'uma autorização e cinco consultas em paralelo');
  assert.equal(calls.filter(x=>x.startsWith(EDGE)).length,1);
  assert.equal(restCalls.length,5);
 }finally{restore()}
});

test('falhas parciais retornam erro seguro sem expor dados incompletos',async()=>{
 const restore=mockFetch(async url=>{
  const endpoint=String(url);
  if(endpoint.startsWith(EDGE))return Response.json({authenticated:true});
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
 const showApp=app.slice(app.indexOf('async function showApp()'),app.indexOf('async function showPending()'));
 assert.match(showApp,/await reload\(\)/);
 assert.doesNotMatch(showApp,/api\/access/);
 assert.match(showApp,/app\.inert=true/);
 assert.match(showApp,/app\.hidden=true;auth\.hidden=false/);
 assert.match(app,/if\(state\.view==='access'\)\{/);
 assert.match(app,/await request\('\/api\/access\?action=list'\)/);
 assert.match(app,/Verificando acesso\.\.\./);
});
