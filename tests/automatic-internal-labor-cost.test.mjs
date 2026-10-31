import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleAutomaticBriefing} from '../src/automatic-budget-api.mjs';
import {automaticBudgetPanel} from '../public/secure-automatic.js';

const id='11111111-1111-4111-8111-111111111111';
const budget={id,code:'QA-BUDGET',title:'QA',status:'rascunho',lock_version:1};
const costs={items:[{id:'item',source_name:'Instalacao',direct_unit_cost:500}],
 estimate:{direct_cost_reais:500,total_reais:500,errors:[]}};
const workforce={services:[{item_id:'item',workers:1,roles:[],reviewed:true}],
 summary:{partial_estimate:false},
 resource_schedule:{ready:true,workdays:2,tasks:[],missing:[]}};

test('resumo automatico exibe custo real da equipe como componente separado sem duplicar SIURB',()=>{
 const estimate=assembleAutomaticBriefing(budget,costs,{...workforce,
  costs:{labor_estimated:300,overhead_sequential:100,total_sequential:null,
   available:false,missing_rates:['Eletricista']}});
 assert.equal(estimate.cost.direct_reais,500);
 assert.equal(estimate.company_costs.labor_estimated_reais,300);
 assert.equal(estimate.company_costs.company_overhead_estimated_reais,100);
 assert.equal(estimate.company_costs.combined_estimated_reais,null);
 assert.equal(estimate.company_costs.not_added_to_siurb,true);
 assert.equal(estimate.commercial_release,false);
 const html=automaticBudgetPanel(estimate,String,{budgetId:id});
 assert.match(html,/Custo da equipe com dados da sua empresa/);
 assert.match(html,/300,00/);
 assert.match(html,/preços SIURB/);
 assert.match(html,/Aguardando revisão/);
});
test('perfil sem permissao financeira nao recebe custo da empresa',()=>{
 const estimate=assembleAutomaticBriefing(budget,costs,{...workforce,costs:null});
 assert.equal(estimate.company_costs,null);
 const html=automaticBudgetPanel(estimate,String,{budgetId:id});
 assert.doesNotMatch(html,/Custo da equipe com dados da sua empresa/);
});
