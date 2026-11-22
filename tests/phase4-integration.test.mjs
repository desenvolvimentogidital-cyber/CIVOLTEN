import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateBudget,priceBudget} from '../src/budget.mjs';
import {auditBudgetFinancials,auditWorkBilling,auditMonthlyCosts} from '../src/financial-audit.mjs';
import {createWorkOrder,createMeasurement,billingReference} from '../src/operations.mjs';

const uuid=()=>randomUUID();
const base=()=>({
 id:uuid(),title:'Homologação ponta a ponta',customer:'Cliente CPF/CNPJ',
 project:'Obra piloto',location:'São Paulo',demo:false,
 items:[{id:uuid(),source:'manual',description:'Instalação elétrica',unit:'un',
 quantity:10,laborHours:2,directCost:0,roles:[{role:'Eletricista',hours:2}]}],
 commercial:{laborOnly:true,schedule:{goal:'crew',crew:2,pricingMode:'hours'}},
 pricing:{monthlyCostCents:2200000,productiveHours:352,productiveDays:22,
 productivePeople:2,hoursPerDay:8,taxPct:8,marginPct:20,
 companyName:'CIVOLTEN',capturedOn:'2026-11-22'}
});
test('fase 4: orçamento -> contrato -> medição -> recebível reconciliados',()=>{
 const budget=validateBudget(base());
 budget.id=uuid();
 const price=priceBudget(budget);
 const audited=auditBudgetFinancials(budget);
 assert.equal(audited.ok,true,audited.errors.join('; '));
 assert.equal(audited.totals.sale,price.totalSale);
 const order=createWorkOrder(budget,{
  contractRef:'OS-HOMOLOG-001',acceptanceRef:'Aceite confirmado pelo cliente',
  approvedOn:'2026-11-22',startOn:'2026-11-23'
 },uuid());
 assert.equal(Math.round(order.contractValue*100),price.totalSale);
 const started={...order,status:'in_progress'};
 const measurement=createMeasurement(started,[],{
  itemId:budget.items[0].id,quantity:10,measuredOn:'2026-11-23'
 },uuid());
 const approved={...measurement,status:'approved',approvedAt:'2026-11-23T15:00:00Z'};
 const ledger=[{reference:billingReference(approved),kind:'income',amount:approved.amount}];
 const bill=auditWorkBilling(started,[approved],ledger);
 assert.equal(bill.ok,true,bill.errors.join('; '));
 assert.equal(bill.totals.pending,0);
 assert.equal(bill.totals.billed,price.totalSale);
});
test('fase 4: medição não aprovada não pode ter recebível válido',()=>{
 const budget=validateBudget(base());budget.id=uuid();
 const order=createWorkOrder(budget,{
  contractRef:'OS-HOMOLOG-002',acceptanceRef:'Aceite confirmado',
  approvedOn:'2026-11-22',startOn:'2026-11-23'
 },uuid());
 const started={...order,status:'in_progress'};
 const m=createMeasurement(started,[],{itemId:budget.items[0].id,quantity:2},uuid());
 const result=auditWorkBilling(started,[m],[{reference:billingReference(m),amount:m.amount}]);
 assert.equal(result.ok,false);
 assert.match(result.errors.join(' '),/não aprovada/);
});
test('fase 4: custos mensais vazios não geram valores fictícios',()=>{
 const result=auditMonthlyCosts({fixed:[],variable:[],employees:[]});
 assert.equal(result.ok,true);
 assert.equal(result.totals.monthly,0);
});
