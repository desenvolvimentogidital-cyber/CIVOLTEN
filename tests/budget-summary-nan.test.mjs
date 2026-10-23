import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculateBudget} from '../lib/civolten-calc.mjs';
const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const summary=app.slice(app.indexOf('function summary(){'),app.indexOf('function contractCompany(){'));
const valid=()=>({days:7,pricing:{fixed_monthly_cents:150000,billable_days_month:22,tax_pct:8,margin_pct:20},staff:[],expenses:[],discount_pct:0});
test('formatação monetária da interface não exibe NaN, mesmo em registros defeituosos',()=>{
 const format=app.slice(app.indexOf('const brl=x=>'),app.indexOf('const money=x=>'));
 assert.match(format,/Number\.isFinite\(n\)/);
 assert.match(format,/Valor indisponível/);
 assert.ok(!format.includes('Number(x||0)'));
});
test('fechamento valida cálculos e mantém preço final e margem sem inventar valores',()=>{
 assert.match(summary,/calculateBudget\(b\)/);
 assert.match(summary,/const initial=calculateBudget\(\{\.\.\.b,discount_pct:0\}\)/);
 assert.match(summary,/Number\.isFinite\(r\[k\]\)/);
 assert.match(summary,/Fechamento da obra ainda não calculado/);
 assert.match(summary,/Configurações financeiras/);
 const r=calculateBudget(valid());
 assert.equal(r.discount_pct,0);
 assert.ok(Number.isFinite(r.price_cents));
 assert.ok(Number.isFinite(r.margin_pct_real));
});
test('não mascara valores financeiros inválidos como preços reais',()=>{
 assert.throws(()=>calculateBudget({...valid(),pricing:{...valid().pricing,fixed_monthly_cents:'NaN'}}),/Custo fixo mensal inválido/);
 assert.throws(()=>calculateBudget({...valid(),staff:[{days:1,daily_cents:NaN,charges_pct:10}]}),/Valor da diária inválido/);
 assert.throws(()=>calculateBudget({...valid(),discount_pct:Infinity}),/Desconto percentual inválido/);
});
test('campos do orçamento, impressão e contratos não são alterados',()=>{
 assert.match(app,/data-action="save-budget"/);
 assert.match(app,/data-action="print-budget"/);
 assert.match(app,/function printBudget\(\)/);
 assert.match(app,/function printContract\(\)/);
 assert.match(app,/budget-workflow-head/);
});
