import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareProposalScope,proposalModes} from '../src/proposal-scope-mode.mjs';
import {summarizeSevenPhases} from '../src/operational-phases.mjs';

const items=[{id:'x',source_code:'20260001',source_name:'Instalacao',unit:'UN',quantity:2,direct_unit_cost:'500'}];
const workforce={roles:[{code:'E',hourly_cost:30}],
 services:[{item_id:'x',reviewed:true,workers:1,roles:[{code:'E',projected_hh:10}]}],
 costs:{available:true,total_sequential:460,labor_estimated:300,overhead_sequential:160}};
test('preço de venda SOMENTE mão de obra vem de pagamento e despesas reais, com tributo e margem expressos',()=>{
 const out=prepareProposalScope(proposalModes.labor,{budgetItems:items,workforce,
  saleInputs:{target_margin_pct:'30',service_tax_pct:'6',owner_allocation_reais:'40'}});
 assert.equal(out.items[0].unit_cost,null);
 assert.equal(out.labor_cost_reference_reais,300);
 assert.equal(out.sale_scenario.base_company_cost_reais,500);
 assert.equal(out.sale_scenario.indicative_sale_reais,781.25);
 assert.equal(out.sale_scenario.ready,true);
 assert.equal(out.sale_scenario.includes_materials,false);
 assert.equal(out.sale_scenario.tax_accountant_approved,false);
 assert.equal(out.sale_scenario.commercial_release,false);
 assert.equal(out.price_final_reais,null);
});
test('separação impede somar o custo técnico e a folha paga como duas despesas',()=>{
 const out=prepareProposalScope(proposalModes.labor,{budgetItems:items,workforce,
  saleInputs:{target_margin_pct:30,service_tax_pct:6,owner_allocation_reais:0}});
 assert.equal(out.labor_cost_reference_reais,300);
 assert.equal(out.sale_scenario.base_company_cost_reais,460);
 assert.equal(out.sale_scenario.indicative_sale_reais,718.75);
});
test('dados financeiros incompletos ou produtividade não revisada nunca geram preço',()=>{
 const cases=[
  {...workforce,costs:{...workforce.costs,available:false}},
  {...workforce,costs:{...workforce.costs,total_sequential:null}},
  {...workforce,services:[{...workforce.services[0],reviewed:false}]}
 ];
 for(const w of cases){
  const out=prepareProposalScope(proposalModes.labor,{budgetItems:items,workforce:w,
   saleInputs:{target_margin_pct:30,service_tax_pct:6,owner_allocation_reais:0}});
  assert.equal(out.sale_scenario.ready,false);
  assert.equal(out.sale_scenario.indicative_sale_reais,null);
  assert.equal(out.price_final_reais,null);
 }
});
test('sem imposto e pró-labore conhecidos não presume percentual ou zero',()=>{
 const out=prepareProposalScope(proposalModes.labor,{budgetItems:items,workforce,
  saleInputs:{target_margin_pct:30,service_tax_pct:null,owner_allocation_reais:null}});
 assert.equal(out.sale_scenario.ready,false);
 assert.equal(out.sale_scenario.indicative_sale_reais,null);
 assert.deepEqual(out.sale_scenario.missing.slice(0,2),
  ['Tributação efetiva de serviços não informada','Pró-labore alocado à obra não informado']);
});
test('sete fases só concluem com evidências, e não com registros parciais',()=>{
 const counts={budgets:1,active_budget_items:2,reference_prices:6988,reference_compositions:6926,
  items_pending_cost_review:2,items_pending_productivity_review:2,
  budgets_pending_cost_approval:1,company_hourly_rates:0,active_company_workers:0,
  company_overhead_profiles:0};
 const phases=summarizeSevenPhases({schema:{ready:true},counts,
  account:{administrator_present:true,administrator_password_change_pending:true}});
 assert.equal(phases.length,7);
 assert.equal(phases[0].checks[0].complete,true);
 assert.equal(phases[0].checks[1].complete,false);
 assert.equal(phases[1].checks[0].complete,true);
 assert.equal(phases[1].checks[1].complete,true);
 assert.equal(phases[1].status,'pendente');
 assert.equal(phases[5].status,'pendente');
 assert.equal(phases[6].status,'pendente');
 assert.ok(phases.every(p=>p.passed<p.total));
});
