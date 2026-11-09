import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBudget,validateCommercial,priceBudget,budgetCsv} from '../src/budget.mjs';
import {printableBudget} from '../src/budget-print.mjs';
import {budgetServiceDialog,budgetServiceEstimate,budgetEditorView} from '../src/budget-ui.mjs';
import {catalogReady,catalogStats,catalogToBudgetItem} from '../src/service-catalog.mjs';
import {fresh} from '../src/calc.mjs';

const snapshot={monthlyCostCents:2115335,productiveHours:352,productiveDays:22,
 hoursPerDay:8,productivePeople:2,taxPct:6,marginPct:30,companyName:'CIVOLTEN',
 capturedOn:'2026-11-09'};
const service=(cost=0)=>({id:'00000000-0000-4000-8000-000000000001',source:'manual',
 description:'Instalação de eletrodutos',unit:'m²',quantity:150,laborHours:1.78,directCost:cost});
const budget=(laborOnly,cost=0)=>({id:'00000000-0000-4000-8000-000000000002',
 title:'Serviço de instalação',customer:'Cliente',project:'Obra Centro',
 demo:false,items:[service(cost)],pricing:snapshot,commercial:{
 laborOnly,schedule:{goal:'crew',crew:2,pricingMode:'hours',startDate:'2026-11-09'}}});

test('novo escopo somente mao de obra: HH e preco corretos, sem material',()=>{
 const b=validateBudget(budget(true));
 const p=priceBudget(b);
 assert.equal(b.commercial.laborOnly,true);
 assert.equal(p.totalHours,267);
 assert.equal(p.totalCost,1604530);
 assert.equal(p.totalSale,2507079);
 assert.equal(p.totalTax+p.profit+p.totalCost,p.totalSale);
 assert.equal(p.rows[0].materials,0);
 const csv=budgetCsv(b);
 assert.match(csv,/Fornecimento exclusivo de mão de obra/);
 assert.match(csv,/25070\.79/);
 assert.doesNotMatch(csv,/Materiais\/equipamentos adicionais por unidade/);
 const pdf=printableBudget(b);
 assert.match(pdf,/PROPOSTA EXCLUSIVAMENTE DE MÃO DE OBRA/);
 assert.match(pdf,/fornecimento do contratante/);
 assert.match(pdf,/25\.070,79/);
});
test('orçamentos novos rejeitam materiais adicionais, históricos preservam preço de materiais',()=>{
 assert.throws(()=>validateBudget(budget(true,30)),/não pode incluir materiais/);
 assert.throws(()=>priceBudget(budget(true,30)),/não pode cobrar adicionais/);
 const old=validateBudget(budget(false,30));
 assert.equal(old.commercial.laborOnly,false);
 assert.equal(priceBudget(old).rows[0].materials,450000);
 assert.equal(priceBudget(old).totalCost,2054530);
 assert.match(budgetCsv(old),/Materiais\/equipamentos adicionais por unidade/);
 assert.doesNotMatch(printableBudget(old),/EXCLUSIVAMENTE DE MÃO DE OBRA/);
 const legacy=validateBudget({...budget(false,30),commercial:{schedule:{goal:'crew',crew:2}}});
 assert.equal(legacy.commercial.laborOnly,false);
});
test('modal e lista de serviços ocultam custos diretos somente nas novas propostas',()=>{
 const serviceForm=budgetServiceDialog(service(200),false,snapshot,'hours',true);
 assert.doesNotMatch(serviceForm,/name="directCost"/);
 assert.match(serviceForm,/não inclui fornecimento de materiais/);
 const estimate=budgetServiceEstimate(service(200),snapshot,'hours',true);
 assert.match(estimate,/R\$ 25\.070,79/);
 assert.doesNotMatch(estimate,/Materiais\/equipamentos totais/);
 assert.match(budgetServiceDialog(service(200),true,snapshot,'hours',false),/name="directCost"/);
 const state=fresh();
 const html=budgetEditorView(state,budget(true));
 assert.match(html,/Somente mão de obra/);
 assert.match(html,/materiais e insumos serão fornecidos/i);
 assert.match(html,/somente mão de obra/);
});
test('SIURB sem preço de material fica pronta se coeficientes HH estão informados',()=>{
 const row={id:'1',code:'SIURB:100',source:'siurb',description:'Pintura',
 unit:'m²',roles:[{role:'Pintor',hours:1.78}],directCost:null};
 assert.equal(catalogReady(row),true);
 assert.deepEqual(catalogStats([row]),{total:1,ready:1,pending:0});
 assert.equal(catalogToBudgetItem(row,'novo-1').directCost,null);
 assert.equal(catalogReady({...row,roles:[]}),false);
});
