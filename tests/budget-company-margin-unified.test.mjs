import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assembleAutomaticBriefing} from '../src/automatic-budget-api.mjs';
import {automaticBudgetPanel} from '../public/secure-automatic.js';
import {marginOnSale,reconcileCostSources} from '../src/company-pricing-engine.mjs';

const id='11111111-1111-4111-8111-111111111111';
const budget={id,code:'QA-1',title:'Obra fictícia',status:'rascunho',lock_version:1,
 reference_month:'2026-07',regime:'Sem desoneração',scope_assumptions:null,
 exclusions:null,payment_terms:null};
function preview(company_pricing){
 return assembleAutomaticBriefing(budget,{items:[{id:'item',source_name:'Serviço teste'}],
  estimate:{direct_cost_reais:1000,bdi_amount_reais:0,total_reais:1000,
   contingency_reais:0,errors:[]}},{company_pricing,
  services:[{item_id:'item',title:'Serviço teste',quantity:1,unit:'m2',
   estimated_hh:10,workers:1,roles:[],reviewed:false}],
  summary:{partial_estimate:true,total_hh:10},
  resource_schedule:{ready:false,tasks:[],missing:[]}});
}
const esc=x=>String(x).replaceAll('<','&lt;').replaceAll('>','&gt;');

test('meta percentual cadastrada vai para resumo sem virar um segundo BDI nem preço autorizado',()=>{
 const report=preview({target_margin_pct:30,owner_prolabore_monthly:10000,
  overhead_configured:false,tax_rate_confirmed:false});
 assert.equal(report.company_pricing.target_margin_pct,30);
 assert.equal(report.company_pricing.sale_price_reais,null);
 assert.equal(report.company_pricing.price_ready,false);
 assert.equal(report.company_pricing.bdi_independent,true);
 assert.equal(report.commercial_release,false);
 const html=automaticBudgetPanel(report,esc,{budgetId:id});
 assert.match(html,/30% sobre o faturamento/);
 assert.match(html,/Editar margem e custos operacionais/);
 assert.match(html,/não será gerado automaticamente/);
});
test('meta é realmente editável, sem assumir permanentemente 30% para todos os clientes',()=>{
 const report=preview({target_margin_pct:22.5,owner_prolabore_monthly:0,overhead_configured:true});
 const html=automaticBudgetPanel(report,esc,{budgetId:id});
 assert.match(html,/22.5% sobre o faturamento/);
 assert.doesNotMatch(html,/30% sobre o faturamento/);
});
test('perfil sem dados financeiros não recebe a margem interna nem pró-labore',()=>{
 const report=preview(null);
 assert.equal(report.company_pricing,null);
 const html=automaticBudgetPanel(report,esc,{budgetId:id});
 assert.doesNotMatch(html,/Meta de margem de lucro da empresa/);
 assert.doesNotMatch(html,/Pró-labore mensal/);
});
test('mesmo motor monetário no detalhe e resumo: remove fórmula obsoleta de BDI simples',()=>{
 const ui=readFileSync(new URL('../public/secure.js',import.meta.url),'utf8');
 assert.match(ui,/state\.autoBriefing\?\.budget\?\.id===b\.id/);
 assert.match(ui,/BDI analítico \(não é lucro de 30%\)/);
 assert.match(ui,/summary\?\.total_preliminary_reais/);
 assert.doesNotMatch(ui,/sum\*\(1\+Number\(b\.bdi_pct\)\/100\)/);
 assert.match(ui,/BDI legado \(%\)/);
});
test('simulação exige alíquota informada, sem 6% ou 4,5% assumidos',()=>{
 const ui=readFileSync(new URL('../public/secure-company-costs.js',import.meta.url),'utf8');
 assert.match(ui,/Não presumir impostos/);
 assert.doesNotMatch(ui,/Alíquotas provisórias informadas por você/);
 assert.match(ui,/tax_service_pct','',/);
});
test('margem sobre faturamento não é acréscimo simples de 30% nem inclui imposto presumido',()=>{
 const withoutTax=marginOnSale({cost_base:10000,margin_pct:30});
 assert.equal(withoutTax.ready,false);
 assert.equal(withoutTax.sale_price,null);
 const withTax=marginOnSale({cost_base:10000,margin_pct:30,taxes_on_revenue_pct:0});
 assert.equal(withTax.sale_price,14285.71);
 assert.equal(marginOnSale({cost_base:10000,margin_pct:20,taxes_on_revenue_pct:0}).sale_price,12500);
 const source=reconcileCostSources({source_mode:'reference',reference_direct_cost:10000,internal_labor_cost:2000});
 assert.equal(source.combined_cost,null,'não incluir mão de obra de novo na SIURB');
});


test('rascunho de proposta reutiliza premissas do orçamento sem inventar dados contratuais',()=>{
 const ui=readFileSync(new URL('../public/secure-finance.js',import.meta.url),'utf8');
 assert.match(ui,/esc\(state\.detail\?\.scope_assumptions\|\|''\)/);
 assert.match(ui,/esc\(state\.detail\?\.exclusions\|\|''\)/);
 assert.match(ui,/esc\(state\.detail\?\.payment_terms\|\|''\)/);
 assert.doesNotMatch(ui,/placeholder="Ex\.: 6"/);
 assert.match(ui,/nunca gera aprovação contratual automaticamente/);
});


test('cadastro de despesas operacionais explica separação da folha e pró-labore',()=>{
 const ui=readFileSync(new URL('../public/secure-company-costs.js',import.meta.url),'utf8');
 assert.match(ui,/Despesas fixas e operacionais/);
 assert.match(ui,/exceto folha e pró-labore/);
 assert.match(ui,/Não inclua salários, encargos de funcionários nem pró-labore/);
});
