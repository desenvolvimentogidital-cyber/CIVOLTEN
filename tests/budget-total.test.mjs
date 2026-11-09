import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetQuantityEstimate,budgetUnitEstimate,priceBudget,validateBudgetItem,budgetCsv} from '../src/budget.mjs';
import {budgetServiceEstimate,budgetEditorView} from '../src/budget-ui.mjs';
import {schedulePlan} from '../src/budget-schedule.mjs';
const snap={
 monthlyCostCents:2115335,productiveHours:352,productiveDays:22,
 hoursPerDay:8,productivePeople:2,taxPct:6,marginPct:30,
 companyName:'CIVOLTEN',capturedOn:'2026-11-08'
};
const item=(quantity=150,directCost=0)=>({id:'linha-1',source:'manual',
 description:'Serviço em m²',unit:'M2',quantity,laborHours:1.78,directCost});
const draft=(items,mode='hours')=>({demo:false,title:'Proposta de obra',
 customer:'Cliente',items,pricing:snap,commercial:{schedule:{goal:'crew',crew:2,pricingMode:mode,startDate:'2026-11-09'}}});

test('imagem do cliente: 150 m² × 1,78 HH/m² = 267 HH, sem confundir unitário e total',()=>{
 const row=validateBudgetItem(item());
 const estimate=budgetQuantityEstimate(snap,row.laborHours,row.quantity,row.directCost);
 assert.equal(estimate.totalHours,267);
 assert.equal(estimate.monthly,2115335);
 assert.equal(estimate.hourly,2115335/352);
 assert.equal(estimate.labor,1604530);
 assert.equal(estimate.materials,0);
 assert.equal(estimate.cost,1604530);
 assert.equal(estimate.selling,2507079);
 assert.equal(estimate.cost+estimate.taxes+estimate.grossProfit,estimate.selling);
 assert.equal(estimate.perUnitSelling,2507079/150);
 const one=budgetUnitEstimate(snap,1.78,0);
 assert.equal(one.selling,16715);
 assert.notEqual(one.selling*150,estimate.selling,
  'Não multiplicar valor de UMA unidade arredondada antes do cálculo total');
 const full=priceBudget(draft([row]));
 assert.equal(full.totalHours,267);
 assert.equal(full.rows[0].labor,estimate.labor);
 assert.equal(full.rows[0].selling,estimate.selling);
 assert.equal(full.totalSale,2507079);
 assert.equal(full.totalCost+full.totalTax+full.profit,full.totalSale);
 const html=budgetServiceEstimate(row,snap);
 assert.match(html,/150 M2 × 1,78 HH\/M2 = 267 HH/);
 assert.match(html,/R\$ 16\.045,30/);
 assert.match(html,/R\$ 25\.070,79/);
 assert.match(html,/PREÇO TOTAL DOS 150 M2/);
 const csv=budgetCsv(draft([row]));
 assert.match(csv,/25070\.79/);
});
test('alterar a quantidade de 1 para 150 recalcula total no formulário e mantém o custo HH',()=>{
 const one=budgetQuantityEstimate(snap,1.78,1,0);
 const many=budgetQuantityEstimate(snap,1.78,150,0);
 assert.equal(one.totalHours,1.78);
 assert.equal(many.totalHours,267);
 const page1=budgetServiceEstimate(item(1),snap);
 const page150=budgetServiceEstimate(item(150),snap);
 assert.match(page1,/PREÇO TOTAL DOS 1 M2/);
 assert.match(page150,/PREÇO TOTAL DOS 150 M2/);
 assert.notEqual(one.selling,many.selling);
});
test('materiais por m² são multiplicados pela quantidade e taxa/margem uma vez',()=>{
 const row=validateBudgetItem(item(150,45));
 const value=budgetQuantityEstimate(snap,1.78,150,45);
 assert.equal(value.materials,675000,'R$ 45 por m² × 150 = R$ 6.750');
 assert.equal(value.labor,1604530);
 assert.equal(value.cost,2279530);
 assert.equal(value.selling,Math.ceil(value.cost/.64));
 const result=priceBudget(draft([row]));
 assert.equal(result.totalCost,value.cost);
 assert.equal(result.totalSale,value.selling);
 assert.equal(result.totalCost+result.totalTax+result.profit,result.totalSale);
});
test('composição de vários itens: somas, HH e total da proposta correspondem às linhas',()=>{
 const rows=[item(150,0),{...item(35,20),id:'linha-2',laborHours:2.5}];
 const result=priceBudget(draft(rows));
 assert.equal(result.rows.length,2);
 assert.equal(result.totalSale,result.rows.reduce((n,r)=>n+r.selling,0));
 assert.equal(result.totalHours,result.rows.reduce((n,r)=>n+r.hours,0));
 assert.equal(result.totalCost,result.rows.reduce((n,r)=>n+r.cost,0));
 assert.equal(result.profit+result.totalTax+result.totalCost,result.totalSale);
});
test('modo por dias é uma fórmula diferente: cronograma determina custo diário',()=>{
 const row=item(150,0),hourly=priceBudget(draft([row],'hours')),
  daily=priceBudget(draft([row],'days'));
 assert.equal(hourly.totalHours,267);
 assert.equal(daily.totalHours,267);
 assert.equal(daily.schedule.days,17);
 assert.equal(daily.totalLabor,Math.ceil(2115335*17/22));
 assert.notEqual(daily.totalSale,hourly.totalSale);
 const html=budgetServiceEstimate(row,snap,'days');
 assert.match(html,/precificação por HH/);
 assert.match(html,/por dias de execução/);
});
test('validação rejeita quantidade não numérica, HH inválida e custos negativos',()=>{
 for(const qty of ['',0,-1,'150.1234'])assert.equal(budgetQuantityEstimate(snap,1.78,qty,0),null);
 for(const hours of [null,0,-3,10001,'1.12345'])assert.equal(budgetQuantityEstimate(snap,hours,150,0),null);
 assert.equal(budgetQuantityEstimate(snap,1.78,150,-1),null);
});
