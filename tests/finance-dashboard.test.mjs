import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {financeOverview,financeMonths,budgetFinancials} from '../lib/civolten-finance.mjs';
import cashApi from '../api/data.mjs';
import {SUPABASE} from '../lib/civolten-security.mjs';
const budget=(status='aprovado',date='2026-10-15')=>({
 id:'b1',title:'Obra de exemplo',customer:'Cliente',status,created_at:date,
 price_cents:200000,cost_cents:120000,content:{pricing:{tax_pct:10}}
});
test('lucro previsto separa custo imposto e margem reais do orcamento',()=>{
 const b=budgetFinancials(budget());
 assert.equal(b.tax_cents,20000);
 assert.equal(b.profit_cents,60000);
 assert.equal(b.margin_pct,30);
});
test('orçamento enviado ou rascunho nunca conta como lucro de venda aprovada',()=>{
 const m=financeOverview([budget(),budget('rascunho'),budget('enviado')],[]);
 assert.equal(m.approved.count,1);
 assert.equal(m.approved.profit_cents,60000);
 assert.equal(m.byStatus.rascunho,1);
 assert.equal(m.byStatus.enviado,1);
});
test('propostas aprovadas nao criam dinheiro em caixa sem recebimento real registrado',()=>{
 const m=financeOverview([budget(),budget()],[]);
 assert.equal(m.cash.balance_cents,0);
 assert.equal(m.cash.income_cents,0);
 assert.equal(m.approved.price_cents,400000);
});
test('caixa considera entradas e saidas por transacao registrada',()=>{
 const m=financeOverview([budget()],[
  {kind:'entrada',amount_cents:100000},{kind:'saida',amount_cents:35000},
  {kind:'saida',amount_cents:25000}
 ]);
 assert.equal(m.cash.income_cents,100000);
 assert.equal(m.cash.expense_cents,60000);
 assert.equal(m.cash.balance_cents,40000);
});
test('resultado negativo e margem negativa permanecem visiveis',()=>{
 const r=budgetFinancials({...budget(),price_cents:90000,cost_cents:120000});
 assert.equal(r.tax_cents,9000);
 assert.equal(r.profit_cents,-39000);
 assert.ok(r.margin_pct<0);
});
test('grafico mensal usa data de cadastro de obra aprovada e data da movimentacao',()=>{
 const series=financeMonths([budget(),budget('enviado')],[{kind:'entrada',amount_cents:12300,occurred_on:'2026-10-22'},{kind:'saida',amount_cents:3000,occurred_on:'2026-10-22'}],new Date('2026-10-22T14:00:00Z'));
 assert.equal(series.length,6);
 assert.equal(series[5].key,'2026-10');
 assert.equal(series[5].price_cents,200000);
 assert.equal(series[5].cost_cents,120000);
 assert.equal(series[5].income_cents,12300);
 assert.equal(series[5].expense_cents,3000);
});
test('valor inseguro e tipo de movimentacao invalido nao sao aceitos',()=>{
 assert.throws(()=>financeOverview([], [{kind:'saida',amount_cents:-1}]));
 assert.throws(()=>financeOverview([], [{kind:'outro',amount_cents:100}]));
 assert.throws(()=>budgetFinancials({...budget(),content:{pricing:{tax_pct:120}}}));
});
test('UI do painel tem filtros por obra, fluxo de caixa manual, graficos e margem editavel',()=>{
 const view=fs.readFileSync(new URL('../assets/dashboard.js',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 assert.match(view,/chartMonths\(months/);
 assert.match(view,/projectResults\(data,search,status,esc,brl\)/);
 assert.match(view,/id="cashEntryForm"/);
 assert.match(view,/id="dashboardMarginForm"/);
 assert.match(view,/id="dashboardProjectSearch"/);
 assert.match(view,/id="dashboardProjectStatus"/);
 assert.match(view,/Não é dinheiro recebido/);
 assert.match(view,/Não é extrato bancário/);
 assert.match(app,/saveCashMovement\(f\)/);
 assert.match(app,/saveDashboardMargin\(f\)/);
 assert.match(app,/state\.dashboardSearch=e\.value;refreshDashboardProjects\(\)/);
});
test('a API nao expõe caixa sem sessão e só aceita centavos inteiros e tipos validos',async()=>{
 const src=fs.readFileSync(new URL('../api/data.mjs',import.meta.url),'utf8');
 const migration=fs.readFileSync(new URL('../supabase/migrations/20261022_cv_cash_entries.sql',import.meta.url),'utf8');
 assert.match(src,/cash:\['cv_cash_entries','kind','amount_cents'/);
 assert.match(src,/Number\.isSafeInteger\(data\.amount_cents\)/);
 assert.match(src,/Movimentações do caixa não podem ser editadas/);
 assert.match(migration,/enable row level security/);
 const tenant=fs.readFileSync(new URL('../supabase/migrations/20261023_cv_tenant_isolation_no_admin.sql',import.meta.url),'utf8');
 assert.match(tenant,/owner_id=\(select auth\.uid\(\)\)/);
 assert.match(migration,/b\.owner_id=\(select auth\.uid\(\)\)/);
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('Nao pode acessar sem JWT')};
 try{
  const res=await cashApi.fetch(new Request('https://civolten.example.test/api/data?entity=cash',
   {headers:{'sec-fetch-site':'same-origin'}}));
  assert.equal(res.status,401);assert.equal(calls,0);
 }finally{globalThis.fetch=original}
});
