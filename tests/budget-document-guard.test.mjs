import test from 'node:test';
import assert from 'node:assert/strict';
import {proposalReference,assertSavedBudgetForPdf,laborOnlyScopeWarnings}
 from '../src/budget-document-guard.mjs';

const saved=()=>({
 id:'990075cf-1111-4111-8111-111111111111',
 createdAt:'2026-11-14T13:03:00.000Z',demo:false,title:'Proposta CIVOLTEN',
 customer:'Larissa',project:'Construção',location:'Centro Santo Amaro',
 notes:'',expiresOn:'2026-11-16',
 items:[{id:'a',description:'Instalação de ar-condicionado',unit:'un',quantity:2,
  laborHours:4,directCost:0,roles:[{role:'Técnico',hours:4}]}],
 commercial:{laborOnly:true,paymentTerms:'50% na entrada',schedule:{
  crew:2,goal:'crew',startDate:'2026-11-16',pricingMode:'hours'}},
 pricing:{monthlyCostCents:1000000,productiveHours:352,taxPct:5,marginPct:15}
});
test('proposta e cronograma podem usar a mesma referência PC do orçamento salvo',()=>{
 const b=saved();
 assert.equal(proposalReference(b),'PC-2026-990075CF');
 assert.equal(assertSavedBudgetForPdf(structuredClone(b),b),proposalReference(b));
});
test('não gera PDF definitivo de orçamento sem ID ou sem persistência',()=>{
 const draft=saved();
 assert.throws(()=>assertSavedBudgetForPdf({...draft,id:null},null),/Salve o orçamento/);
 assert.throws(()=>assertSavedBudgetForPdf(draft,null),/Salve o orçamento/);
 assert.throws(()=>assertSavedBudgetForPdf({...draft,demo:true},draft),/Revise/);
 assert.throws(()=>assertSavedBudgetForPdf({...draft,items:[{...draft.items[0],source:'demo'}]},draft),/Revise/);
});
test('impede imprimir mudanças não salvas no preço, quantidade, cronograma e cliente',()=>{
 const original=saved();
 const scenarios=[
  {...original,customer:'Outro cliente'},
  {...original,items:[{...original.items[0],quantity:3}]},
  {...original,commercial:{...original.commercial,schedule:{
   ...original.commercial.schedule,crew:4}}},
  {...original,pricing:{...original.pricing,marginPct:25}},
 ];
 for(const d of scenarios)
  assert.throws(()=>assertSavedBudgetForPdf(d,original),/alterações não salvas/);
});
test('comparação ignora a ordem das chaves JSON e não modifica os orçamentos',()=>{
 const b=saved(),original=JSON.stringify(b);
 const d={...structuredClone(b),commercial:{
  schedule:{...b.commercial.schedule},paymentTerms:b.commercial.paymentTerms,laborOnly:true}};
 assert.equal(assertSavedBudgetForPdf(d,b),'PC-2026-990075CF');
 assert.equal(JSON.stringify(b),original);
});
test('fornecimento de equipamentos em proposta de mão de obra exige conferência',()=>{
 const d=saved();
 d.items.push({id:'b',description:'FORNECIMENTO DE AR CONDICIONADO A FRIO'});
 assert.deepEqual(laborOnlyScopeWarnings(d),['FORNECIMENTO DE AR CONDICIONADO A FRIO']);
 assert.deepEqual(laborOnlyScopeWarnings({...d,commercial:{laborOnly:false}}),[]);
 assert.deepEqual(laborOnlyScopeWarnings(saved()),[]);
});
