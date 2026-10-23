import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import signup from '../api/signup.mjs';
import session from '../api/session.mjs';
import {calculateBudget} from '../lib/civolten-calc.mjs';
import {financeOverview} from '../lib/civolten-finance.mjs';
const domain='https://civolten.example.test';
const jwt='A'.repeat(100);
const body={email:'usuario@example.com',password:'senha-bem-forte-1234'};
const req=(path,b)=>new Request(domain+path,{method:'POST',headers:{origin:domain,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify(b)});
async function withMock(fn,run){
 const old=globalThis.fetch;globalThis.fetch=fn;
 try{return await run()}finally{globalThis.fetch=old}
}
const quote=(status,price)=>({status,price_cents:price,cost_cents:Math.round(price*.7),content:{pricing:{tax_pct:10}}});

test('cadastro sem confirmacao entra diretamente e usa cookie seguro HttpOnly',async()=>{
 await withMock(async url=>{
  assert.match(String(url),/\/auth\/v1\/signup/);
  return Response.json({access_token:jwt,expires_in:3600});
 },async()=>{
  const r=await signup.fetch(req('/api/signup',body));
  assert.equal(r.status,200);
  assert.equal((await r.json()).authenticated,true);
  assert.match(r.headers.get('set-cookie'),/HttpOnly/);
  assert.match(r.headers.get('set-cookie'),/SameSite=Strict/);
 });
});
test('com confirmacao de e-mail ligada nao falsifica login nem pede aprovacao',async()=>{
 await withMock(async()=>Response.json({user:{id:'550e8400-e29b-41d4-a716-446655440000'},session:null}),async()=>{
  const r=await signup.fetch(req('/api/signup',body)),b=await r.json();
  assert.equal(b.authenticated,false);
  assert.equal(b.confirmation_required,true);
  assert.match(b.message,/Nenhuma aprovação administrativa/);
  assert.equal(r.headers.get('set-cookie'),null);
 });
});
test('token vindo de confirmacao só é convertido em cookie depois de validar usuario',async()=>{
 await withMock(async (url,opts)=>{
  assert.match(String(url),/\/auth\/v1\/user$/);
  assert.equal(opts.headers.Authorization,'Bearer '+jwt);
  return Response.json({id:'550e8400-e29b-41d4-a716-446655440000',email:body.email});
 },async()=>{
  const r=await session.fetch(req('/api/session',{access_token:jwt}));
  assert.equal(r.status,200);
  assert.equal((await r.json()).authenticated,true);
  assert.match(r.headers.get('set-cookie'),/HttpOnly/);
 });
});
test('token falso nunca ativa uma sessao de outro usuario',async()=>{
 await withMock(async()=>Response.json({error:'no'}, {status:401}),async()=>{
  const r=await session.fetch(req('/api/session',{access_token:jwt}));
  assert.equal(r.status,401);
  assert.equal(r.headers.get('set-cookie'),null);
 });
});
test('simulador desconto compara impostos, lucro e margem em tempo real',()=>{
 const base={days:5,staff:[{daily_cents:20000,days:5,charges_pct:0}],expenses:[],
  pricing:{fixed_monthly_cents:220000,billable_days_month:22,tax_pct:10,margin_pct:20}};
 const full=calculateBudget(base),discount=calculateBudget({...base,discount_pct:10});
 assert.equal(discount.price_before_discount_cents,full.price_cents);
 assert.equal(discount.discount_cents,Math.round(full.price_cents*.1));
 assert.equal(discount.price_cents,full.price_cents-discount.discount_cents);
 assert.equal(discount.tax_cents,Math.round(discount.price_cents*.1));
 assert.ok(discount.margin_pct_real<full.margin_pct_real);
 assert.ok(discount.profit_cents<full.profit_cents);
 assert.equal(calculateBudget({...base,discount_pct:100}).price_cents,0);
 assert.throws(()=>calculateBudget({...base,discount_pct:110}));
 assert.throws(()=>calculateBudget({...base,discount_pct:-1}));
});
test('desconto também vale para valor comercial definido manualmente e não duplica',()=>{
 const p={days:1,pricing:{billable_days_month:22,tax_pct:5,margin_pct:20},manual_price_cents:100000};
 const r=calculateBudget({...p,discount_pct:15});
 assert.equal(r.price_before_discount_cents,100000);
 assert.equal(r.discount_cents,15000);
 assert.equal(r.price_cents,85000);
 assert.equal(r.tax_cents,4250);
 assert.equal(calculateBudget(p).price_cents,100000);
});
test('dashboard separa abertas enviadas, fechadas aprovadas e rascunhos',()=>{
 const r=financeOverview([quote('enviado',100000),quote('aprovado',250000),
  quote('rascunho',30000),quote('recusado',50000)],[]);
 assert.equal(r.pipeline.open_cents,100000);
 assert.equal(r.pipeline.open_count,1);
 assert.equal(r.pipeline.closed_cents,250000);
 assert.equal(r.pipeline.closed_count,1);
 assert.equal(r.pipeline.draft_cents,30000);
 assert.equal(r.cash.balance_cents,0);
});
test('RLS isola 6 tabelas por owner_id e profissões são compartilhadas apenas como catálogo',()=>{
 const migration=fs.readFileSync(new URL('../supabase/migrations/20261023_cv_tenant_isolation_no_admin.sql',import.meta.url),'utf8');
 for(const table of ['cv_settings','cv_workers','cv_fixed_costs','cv_variable_costs','cv_budgets','cv_cash_entries'])
  assert.match(migration,new RegExp("'"+table+"'"));
 assert.match(migration,/owner_id = \(select auth\.uid\(\)\)/);
 assert.match(migration,/with check \(owner_id = \(select auth\.uid\(\)\)\)/);
 assert.match(migration,/owner_id is null or owner_id=\(select auth\.uid\(\)\)/);
 assert.match(migration,/b\.owner_id=\(select auth\.uid\(\)\)/);
 assert.match(migration,/drop table if exists public\.cv_access_requests/);
 assert.match(migration,/drop table if exists public\.admin_users/);
});
test('menu e API não exigem aprovação; PDF não expõe custos internos e imprime preço com desconto',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const voice=fs.readFileSync(new URL('../assets/voice.js',import.meta.url),'utf8');
 const security=fs.readFileSync(new URL('../lib/civolten-security.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(html,/pendingCard|data-view="access"|Solicitar aprovação/);
 assert.doesNotMatch(app,/showPending|accessList|approve-access/);
 assert.match(app,/Simulação de desconto/);
 assert.match(app,/data-discount-range/);
 assert.match(app,/data-discount-number/);
 assert.match(app,/Exportar Proposta Comercial \(PDF\)/);
 assert.match(app,/priceCents:r\.price_cents/);
 assert.match(app,/startVoiceFields/);
 assert.match(voice,/recognition.lang='pt-BR'/);
 assert.match(security,/\/auth\/v1\/user/);
 assert.doesNotMatch(security,/\?api=admin-me/);
});
