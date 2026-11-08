import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SERVICES,createService,validateBudget,priceBudget,createPricingSnapshot,budgetCsv} from '../src/budget.mjs';
const company={companyName:'Construtora Teste',taxRegime:'simples',annex:'IV',taxPct:10,marginPct:20,
 productiveDays:20,hoursPerDay:8,productivePeople:2,reviewed:true};
const priced={monthlyCostCents:1600000,productiveHours:320,
 taxPct:10,marginPct:20,companyName:'Construtora Teste',capturedOn:'2026-11-07'};
const raw=(override={})=>({id:'11111111-1111-4111-8111-111111111111',
 title:'Proposta de teste',customer:'Cliente A',project:'Obra A',location:'São Paulo',
 notes:'Demonstração',expiresOn:'2026-12-20',items:[createService('DEMO-E01','i1')],pricing:priced,...override});
test('catálogo é inteiramente fictício e pode ser editado sem alterar a fonte',()=>{
 assert.equal(DEMO_SERVICES.length,8);
 assert.ok(DEMO_SERVICES.every(s=>s.code.startsWith('DEMO-')));
 const item=createService('DEMO-E01','i1');item.description='Outro texto';
 assert.notEqual(DEMO_SERVICES[0].description,item.description);
});
test('fórmula usa custo total/hora + custo direto; tributo e lucro sobre preço final',()=>{
 const b=validateBudget(raw({items:[{...createService('DEMO-E01','i1'),quantity:2,laborHours:2,
 directCost:30}]}));
 const p=priceBudget(b);
 assert.equal(p.totalHours,4);
 assert.equal(p.rows[0].labor,20000);
 assert.equal(p.rows[0].materials,6000);
 assert.equal(p.totalCost,26000);
 assert.equal(p.totalSale,37143);
 assert.equal(p.totalCost+p.totalTax+p.profit,p.totalSale);
});
test('dois itens com quantidades diferentes compõem total sem perdas',()=>{
 const items=[createService('DEMO-E02','i2'),createService('DEMO-C02','i3')];
 const p=priceBudget(validateBudget(raw({items})));
 assert.equal(p.rows.length,2);
 assert.equal(p.totalSale,p.rows[0].selling+p.rows[1].selling);
 assert.equal(p.totalCost,p.rows[0].cost+p.rows[1].cost);
});
test('snapshot antigo permanece imutável após mudança de custo/empresa',()=>{
 const budget=validateBudget(raw());
 const value=priceBudget(budget).totalSale;
 const data={fixed:[{name:'aluguel',amount:1000,frequency:'monthly'}],variable:[],employees:[],
  company:{...company,taxPct:17,marginPct:25}};
 const newer=createPricingSnapshot(data);
 assert.equal(newer.monthlyCostCents,100000);
 assert.notEqual(newer.taxPct,budget.pricing.taxPct);
 assert.equal(priceBudget(budget).totalSale,value);
});
test('sem configuração ou valores completos pode salvar rascunho sem preço',()=>{
 const item=createService('manual','i3');
 const b=validateBudget(raw({pricing:null,items:[item]}));
 assert.equal(priceBudget(b),null);
 assert.equal(createPricingSnapshot({fixed:[],variable:[],employees:[],company:{reviewed:false}}),null);
});
test('invalida quantidades, horas, datas, duplicatas, limites e nomes',()=>{
 const base=createService('DEMO-C01','i1');
 assert.throws(()=>validateBudget(raw({items:[]})),/ao menos um/);
 assert.throws(()=>validateBudget(raw({items:[{...base,quantity:0}]})),/quantidade/);
 assert.throws(()=>validateBudget(raw({items:[{...base,directCost:-1}]})),/Custo direto/);
 assert.throws(()=>validateBudget(raw({items:[{...base,laborHours:-1}]})),/horas/);
 assert.throws(()=>validateBudget(raw({items:[base,base]})),/duplicados/);
 assert.throws(()=>validateBudget(raw({expiresOn:'2026-02-31'})),/validade/);
 assert.throws(()=>validateBudget(raw({customer:''})),/cliente/);
});
test('exportação CSV protege campos inseridos pelo usuário contra fórmulas',()=>{
 const b=validateBudget(raw({title:'=2+2',items:[{...createService('DEMO-E01','i1'),description:'@cmd'}]}));
 const csv=budgetCsv(b);assert.match(csv,/'=2\+2/);assert.match(csv,/'@cmd/);
});
