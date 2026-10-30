import test from 'node:test';
import assert from 'node:assert/strict';
import {marginOnSale,reconcileCostSources} from '../src/company-pricing-engine.mjs';
test('margem alvo de 30 por cento sobre venda não equivale a markup de 30',()=>{
 const p=marginOnSale({cost_base:7000,margin_pct:30,taxes_on_revenue_pct:0});
 assert.equal(p.sale_price,10000);assert.equal(p.profit_before_income_tax,3000);
 assert.equal(p.margin_pct,30);
});
test('tributos sobre receita entram no denominador e não são presumidos',()=>{
 const p=marginOnSale({cost_base:6000,margin_pct:30,taxes_on_revenue_pct:10});
 assert.equal(p.sale_price,10000);assert.equal(p.profit_before_income_tax,3000);
 const incomplete=marginOnSale({cost_base:6000,margin_pct:30});
 assert.equal(incomplete.ready,false);assert.equal(incomplete.sale_price,null);
});
test('soma de margem e impostos maior que 100 é recusada',()=>{
 assert.throws(()=>marginOnSale({cost_base:10000,margin_pct:60,taxes_on_revenue_pct:40}),/denominador|espaço/);
 assert.throws(()=>marginOnSale({cost_base:10000,margin_pct:81,taxes_on_revenue_pct:0}),/inválida|inválido/);
});
test('modo SIURB impede duplicar pessoal, encargos e administração',()=>{
 const p=reconcileCostSources({source_mode:'reference',reference_direct_cost:20000,
  internal_labor_cost:6000,owner_prolabore_allocation:450,other_overhead_allocation:500});
 assert.equal(p.base_direct_cost,20000);assert.equal(p.combined_cost,null);
 assert.equal(p.ready_for_sale,false);assert.equal(p.duplicate_risks.length,2);
});
test('custo próprio precisa indicar material, equipamentos e rateios explicitamente',()=>{
 const partial=reconcileCostSources({source_mode:'own_cost',internal_labor_cost:6000,
  owner_prolabore_allocation:500,other_overhead_allocation:200});
 assert.equal(partial.combined_cost,null);
 assert.ok(partial.missing_categories.includes('materiais'));
 const full=reconcileCostSources({source_mode:'own_cost',internal_labor_cost:6000,
  owner_prolabore_allocation:500,other_overhead_allocation:200,
  material_cost:2000,equipment_cost:500,other_direct_cost:100,approval:true});
 assert.equal(full.combined_cost,9300);assert.equal(full.ready_for_sale,true);
});
