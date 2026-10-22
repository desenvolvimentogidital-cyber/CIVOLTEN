import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {companyRates} from '../lib/civolten-capacity.mjs';
import {calculateBudget} from '../lib/civolten-calc.mjs';

const rows=[
 {name:'Contabilidade',monthly_cents:70000,active:true},
 {name:'Aluguel de escritório',monthly_cents:0,active:true},
 {name:'Pró-labore',monthly_cents:400000,active:true},
 {name:'Desativado',monthly_cents:120000,active:false}
];
test('custo fixo da empresa mensal, por dia e por hora com 22 dias e 8 horas',()=>{
 const r=companyRates(rows,{billable_days_month:22,hours_day:8});
 assert.equal(r.monthly_cents,470000);
 assert.equal(r.daily_cents,21364);
 assert.equal(r.hourly_cents,2670);
 assert.equal(r.billable_days_month,22);
});
test('despesa ativa com R$ 0 nao encarece orcamentos e inativas nao contam',()=>{
 const r=companyRates(rows,{billable_days_month:20,hours_day:10});
 assert.equal(r.monthly_cents,470000);
 assert.equal(r.daily_cents,23500);
 assert.equal(r.hourly_cents,2350);
});
test('sem configuracao registrada usa 22 dias e 8 horas apenas como estimativa visual',()=>{
 const r=companyRates(rows);
 assert.equal(r.daily_cents,Math.round(470000/22));
 assert.equal(r.hourly_cents,Math.round(470000/176));
});
test('parametros invalidos nao resultam em taxa artificial',()=>{
 for(const cfg of [{hours_day:0},{hours_day:-1},{hours_day:25},{billable_days_month:0},{billable_days_month:-22}])
  assert.throws(()=>companyRates(rows,cfg));
 assert.throws(()=>companyRates([{monthly_cents:-300,active:true}]));
});
test('imposto incidente sobre preco de venda, custos fixos rateados e equipe somada',()=>{
 const budget={days:5,staff:[{daily_cents:20000,days:5,charges_pct:0}],expenses:[],
  pricing:{fixed_monthly_cents:470000,billable_days_month:22,tax_pct:10,margin_pct:20}};
 const result=calculateBudget(budget);
 assert.equal(result.fixed_cents,Math.round(470000*5/22));
 assert.equal(result.labor_cents,100000);
 assert.equal(result.variable_cents,0);
 assert.equal(result.cost_cents,result.fixed_cents+result.labor_cents);
 assert.equal(result.calculated_price_cents,Math.ceil(result.cost_cents/.7-1e-9));
 assert.equal(result.tax_cents,Math.round(result.price_cents*.1));
 const materials=calculateBudget({...budget,expenses:[{unit_cents:3500,qty:10}]});
 assert.equal(materials.variable_cents,35000);
 assert.equal(materials.cost_cents,result.cost_cents+35000);
 assert.ok(materials.calculated_price_cents>result.calculated_price_cents);
});
test('interface mostra custos mensais/diarios/horarios, ajuste de horas e materiais opcionais',()=>{
 const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const api=fs.readFileSync(new URL('../api/data.mjs',import.meta.url),'utf8');
 const migration=fs.readFileSync(new URL('../supabase/migrations/20261022_cv_settings_hours_day.sql',import.meta.url),'utf8');
 const dashboard=fs.readFileSync(new URL('../assets/dashboard.js',import.meta.url),'utf8');
 assert.match(app,/import \{companyRates,payrollSummary\} from '\/lib\/civolten-capacity\.mjs'/);
 assert.match(dashboard,/companyRates\(data\.fixed,cfg\|\|\{\},data\.workers\)/);
 assert.match(dashboard,/Custo por dia/);
 assert.match(dashboard,/Custo por hora/);
 assert.match(app,/name="hours_day"/);
 assert.match(app,/Somente despesas ativas entram no rateio/);
 assert.match(app,/Esses itens não entram automaticamente no orçamento/);
 assert.match(app,/const variables=state\.data\.variable/);
 assert.match(app,/b\.expenses\.push\(\{name:x\.name/);
 assert.match(api,/settings:\['cv_settings','workdays_month','billable_days_month','hours_day'/);
 assert.match(migration,/add column if not exists hours_day/);
});
