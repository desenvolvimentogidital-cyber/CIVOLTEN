import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {payrollSummary,companyRates} from '../lib/civolten-capacity.mjs';
import {calculateBudget} from '../lib/civolten-calc.mjs';

const team=[
 {id:'a',name:'Eletricista',daily_cents:20000,days_month:22,charges_pct:0,active:true,cost_mode:'monthly'},
 {id:'b',name:'Pedreiro',daily_cents:25000,days_month:22,charges_pct:20,active:true,cost_mode:'monthly'},
 {id:'c',name:'Autonomo',daily_cents:50000,days_month:12,charges_pct:0,active:true,cost_mode:'project'},
 {id:'d',name:'Ex-funcionario',daily_cents:10000,days_month:22,charges_pct:0,active:false,cost_mode:'monthly'}
];
const fixed=[{monthly_cents:1200000,active:true},{monthly_cents:50000,active:false}];

test('soma por funcionario conforme diaria, dias e encargos, exclui inativo e por obra',()=>{
 const r=payrollSummary(team);
 assert.equal(r.monthly_count,2);
 assert.equal(r.project_count,1);
 assert.equal(r.monthly_cents,1100000);
});
test('funcionario novo altera automaticamente custo mensal e custo por dia da empresa',()=>{
 const old=companyRates(fixed,{billable_days_month:22,hours_day:8},team);
 assert.equal(old.fixed_expenses_cents,1200000);
 assert.equal(old.payroll_cents,1100000);
 assert.equal(old.monthly_cents,2300000);
 const newTeam=[...team,{daily_cents:10000,days_month:22,charges_pct:0,active:true,cost_mode:'monthly'}];
 const now=companyRates(fixed,{billable_days_month:22,hours_day:8},newTeam);
 assert.equal(now.monthly_cents,2520000);
 assert.equal(now.daily_cents,Math.round(2520000/22));
 assert.equal(now.hourly_cents,Math.round(2520000/(22*8)));
});
test('sem modo explicito o funcionario legado e considerado mensal',()=>{
 assert.equal(payrollSummary([{daily_cents:20000,days_month:22,charges_pct:0,active:true}]).monthly_cents,440000);
});
test('contratado por obra pode entrar apenas como diaria, nunca no total mensal',()=>{
 const rates=companyRates(fixed,{billable_days_month:22,hours_day:8},team);
 const snap={days:4,pricing:{fixed_monthly_cents:rates.monthly_cents,billable_days_month:22,tax_pct:10,margin_pct:20},staff:[],expenses:[]};
 const without=calculateBudget(snap);
 assert.equal(without.labor_cents,0);
 assert.equal(without.fixed_cents,Math.round(2300000*4/22));
 const withProject=calculateBudget({...snap,staff:[{daily_cents:50000,days:4,charges_pct:0}]});
 assert.equal(withProject.labor_cents,200000);
 assert.equal(withProject.fixed_cents,without.fixed_cents);
 assert.equal(withProject.cost_cents,without.cost_cents+200000);
 assert.equal(withProject.tax_cents,Math.round(withProject.price_cents*.1));
});
test('mudanca para funcionario por obra retira valor da folha e mantem despesas fixas',()=>{
 const converted=team.map(x=>x.id==='a'?{...x,cost_mode:'project'}:x);
 const r=companyRates(fixed,{billable_days_month:22,hours_day:8},converted);
 assert.equal(r.payroll_cents,660000);
 assert.equal(r.monthly_cents,1860000);
});
test('valida dias e encargos da folha; valor invalido nunca reduz custos silenciosamente',()=>{
 for(const row of [
  {daily_cents:-1,days_month:22,charges_pct:0,active:true},
  {daily_cents:10000,days_month:32,charges_pct:0,active:true},
  {daily_cents:10000,days_month:0,charges_pct:0,active:true},
  {daily_cents:10000,days_month:22,charges_pct:201,active:true},
  {daily_cents:10000,days_month:22,charges_pct:0,active:true,cost_mode:'other'}
 ])assert.throws(()=>payrollSummary([row]));
});
test('barra de total fica fixa e a lista possui rolagem independente inclusive no celular',()=>{
 const css=fs.readFileSync(new URL('../assets/app.css',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 assert.match(css,/\.worker-totalbar\{\s*position:sticky;bottom:0/);
 assert.match(css,/\.worker-ledger \.worker-scroll\{[\s\S]*?overflow-y:auto/);
 assert.match(css,/@media\(max-width:680px\)\{\s*\.worker-ledger/);
 assert.match(app,/workerFooter/);
 assert.match(app,/Folha fixa mensal/);
 assert.match(app,/payrollSummary\(items\)/);
 assert.match(app,/worker-scroll/);
});
test('modalidade de custo salva no banco e qualquer funcionario ativo pode participar da obra sem duplicacao',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const api=fs.readFileSync(new URL('../api/data.mjs',import.meta.url),'utf8');
 const migration=fs.readFileSync(new URL('../supabase/migrations/20261022_cv_workers_cost_mode.sql',import.meta.url),'utf8');
 assert.match(api,/workers:\['cv_workers','name','profession','daily_cents','charges_pct','days_month','cost_mode','active'\]/);
 assert.match(migration,/default 'monthly'/);
 assert.match(migration,/check \(cost_mode in \('monthly','project'\)\)/);
 assert.match(app,/Fixo mensal — entra automaticamente nos orçamentos/);
 assert.match(app,/Por obra — adicionar só quando necessário/);
 assert.match(app,/const workers=state\.data\.workers\.filter\(x=>x\.active\)/);
 assert.match(app,/workerOptions\(workers\.sort/);
 assert.match(app,/b\.staff\.push\(createBudgetStaff\(x,b\.days\)\)/);
 assert.match(app,/staffAlreadyAdded\(b\.staff,x\.id\)/);
 assert.match(app,/fixed_monthly_cents:rates\.monthly_cents/);
});
test('nao altera orcamento salvo automaticamente; valor da folha e despesas copia para orcamento novo',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 assert.match(app,/state\.draft=row\?structuredClone\(row\.content\):/);
 assert.match(app,/pricing:defaultPricing\(\)/);
 assert.match(app,/payroll_cents:rates\.payroll_cents/);
});
