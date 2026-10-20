import test from 'node:test';import assert from 'node:assert/strict';import {calculateBudget} from '../lib/civolten-calc.mjs';
const input={days:5,staff:[{daily_cents:20000,days:5,charges_pct:0}],expenses:[{unit_cents:50000,qty:1}],pricing:{fixed_monthly_cents:220000,billable_days_month:22,tax_pct:10,margin_pct:20}};
test('custos próprios, rateio e preço por margem sobre receita',()=>{const r=calculateBudget(input);assert.equal(r.cost_cents,200000);assert.equal(r.labor_cents,100000);assert.equal(r.fixed_cents,50000);assert.equal(r.calculated_price_cents,285715);assert.ok(r.margin_pct_real>=19.99)});
test('encargos opcionais por funcionário',()=>assert.equal(calculateBudget({days:2,staff:[{daily_cents:12000,days:2,charges_pct:25}],pricing:{billable_days_month:22}}).labor_cents,30000));
test('preço manual evidencia prejuízo',()=>assert.equal(calculateBudget({...input,manual_price_cents:100000}).profit_cents,-110000));
test('sem preços de tabelas',()=>assert.equal(calculateBudget({days:1,pricing:{billable_days_month:22}}).cost_cents,0));
test('margem mais imposto inviáveis bloqueados',()=>assert.throws(()=>calculateBudget({days:1,pricing:{billable_days_month:22,tax_pct:40,margin_pct:60}})));
