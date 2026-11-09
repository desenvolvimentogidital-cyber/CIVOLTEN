import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createWorkOrder,createWorkLog,createMeasurement,roleMatch,
 workProgress,workCsv,canComplete,billingReference} from '../src/operations.mjs';
import {priceBudget} from '../src/budget.mjs';
import {createE2EClient} from '../src/e2e-client.mjs';
import {fetchRemote,fetchOperationsRemote,putRemote,billMeasurementRemote} from '../src/cloud.mjs';
import {fresh} from '../src/calc.mjs';

const uid='00000000-0000-4000-8000-000000000001';
const snapshot={monthlyCostCents:2115335,productiveHours:352,
 productiveDays:22,hoursPerDay:8,productivePeople:2,
 taxPct:6,marginPct:30,companyName:'CIVOLTEN',capturedOn:'2026-11-09'};
const id1=randomUUID(),id2=randomUUID(),budgetId=randomUUID(),employeeId=randomUUID();
function budget(){
 return {id:budgetId,demo:false,title:'Serviços elétricos',
 customer:'Cliente final',project:'Reforma',location:'São Paulo',notes:'',
 items:[{id:id1,source:'manual',description:'Pintura',unit:'m²',
   quantity:150,laborHours:1.78,directCost:0,roles:[{role:'Pintor',hours:1.78}]},
  {id:id2,source:'manual',description:'Pontos elétricos',unit:'un',
   quantity:20,laborHours:2,directCost:0,roles:[{role:'Eletricista',hours:2}]}],
 commercial:{laborOnly:true,schedule:{goal:'crew',crew:2,pricingMode:'hours'}},
 pricing:snapshot,status:'draft',createdAt:'2026-11-09T12:00:00Z'};
}
const employee={id:employeeId,name:'Profissional A',role:'Pintor',
 active:true,contractType:'clt',salary:2800};
const fields={contractRef:'OS-2026-001',acceptanceRef:'Aceite por e-mail confirmado',
 approvedOn:'2026-11-09',startOn:'2026-11-10'};
const makeOrder=()=>createWorkOrder(budget(),fields,randomUUID());

test('aprovação congela o orçamento, preço e termo de aceite sem registrar pagamento',()=>{
 const b=budget(),order=createWorkOrder(b,fields,randomUUID()),price=priceBudget(b);
 assert.equal(order.contractValue,price.totalSale/100);
 assert.equal(order.pricedRows.length,2);
 assert.equal(order.status,'approved');
 assert.equal(order.budgetSnapshot.commercial.laborOnly,true);
 b.items[0].quantity=1;
 assert.equal(order.budgetSnapshot.items[0].quantity,150,'orçamento antigo fica congelado');
 assert.equal(order.pricedRows[0].selling,2507079);
 assert.throws(()=>createWorkOrder({...budget(),commercial:{laborOnly:false}},fields,randomUUID()),/Somente propostas/);
 assert.throws(()=>createWorkOrder(budget(),{...fields,acceptanceRef:''},randomUUID()),/aceite real/);
});
test('HH realizadas por profissional e qualificação, sem confundir com HH previstas',()=>{
 const order={...makeOrder(),status:'in_progress'};
 assert.equal(roleMatch(employee,order.budgetSnapshot.items[0]),true);
 assert.equal(roleMatch(employee,order.budgetSnapshot.items[1]),false);
 const log=createWorkLog(order,{itemId:id1,employeeId,workDate:'2026-11-10',
  hours:8,notes:'Pintura executada'},[employee],randomUUID());
 assert.equal(log.hours,8);
 assert.throws(()=>createWorkLog(order,{itemId:id2,employeeId,workDate:'2026-11-10',hours:8},
  [employee],randomUUID()),/habilitação/);
 const overridden=createWorkLog(order,{itemId:id2,employeeId,workDate:'2026-11-10',hours:2,
  qualificationConfirmed:'on'},[employee],randomUUID());
 assert.equal(overridden.qualificationConfirmed,true);
 assert.throws(()=>createWorkLog(order,{...log,hours:25},[employee],randomUUID()),/entre 0,01 e 24/);
 assert.throws(()=>createWorkLog({...order,status:'completed'},
  {itemId:id1,employeeId,workDate:'2026-11-11',hours:8},[employee],randomUUID()),/Inicie a obra/);
 const p=workProgress(order,[log,overridden],[]);
 assert.equal(p.plannedHH,307);
 assert.equal(p.actualHH,10);
 assert.equal(p.hhVariance,-297);
 assert.equal(p.approvedCents,0);
 assert.equal(p.percent,0);
});
test('medição proporcional por serviço com saldo final exato e bloqueio de excesso',()=>{
 const order={...makeOrder(),status:'in_progress'};
 const a=createMeasurement(order,[],{itemId:id1,quantity:50,measuredOn:'2026-11-10'},randomUUID());
 assert.equal(a.quantity,50);
 assert.equal(a.amount,8356.93);
 const b=createMeasurement(order,[a],{itemId:id1,quantity:100,measuredOn:'2026-11-11'},randomUUID());
 assert.equal(b.amount,16713.86);
 assert.equal(Math.round((a.amount+b.amount)*100),order.pricedRows[0].selling);
 assert.throws(()=>createMeasurement(order,[a,b],
  {itemId:id1,quantity:0.001,measuredOn:'2026-11-12'},randomUUID()),/supera o contratado/);
 a.status='approved';b.status='approved';
 const progress=workProgress(order,[],[a,b]);
 assert.equal(progress.items[0].measuredQty,150);
 assert.equal(progress.items[1].measuredQty,0);
 assert.equal(progress.completed,false);
 assert.equal(canComplete(order,[],[a,b]),false);
 const c=createMeasurement(order,[a,b],{itemId:id2,quantity:20,measuredOn:'2026-11-12'},randomUUID());
 c.status='approved';
 assert.equal(workProgress(order,[],[a,b,c]).completed,true);
 assert.equal(canComplete(order,[{workOrderId:order.id,itemId:id1,hours:8}],[a,b,c]),true);
 assert.equal(workProgress(order,[],[a,b,c]).approvedCents,
  order.pricedRows.reduce((sum,r)=>sum+r.selling,0));
});
test('histórico da obra e medição exportados em CSV, sem fórmula de planilha',()=>{
 const order={...makeOrder(),status:'in_progress'};
 order.customer='=1+1';
 const m=createMeasurement(order,[],{itemId:id1,quantity:20,measuredOn:'2026-11-10'},randomUUID());
 m.status='approved';
 const out=workCsv(order,[],[m],[employee]);
 assert.match(out,/CIVOLTEN - relatório de execução/);
 assert.match(out,/HH previstas/);
 assert.match(out,/Medição/);
 assert.match(out,/MED:/);
 assert.match(out,/'=1\+1/);
 assert.equal(billingReference(m),'MED:'+m.id);
});
test('simulador Supabase salva obra, horas e medição e emite uma única conta a receber',async()=>{
 const old=globalThis.localStorage;
 const store=new Map();
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 try{
  const client=createE2EClient();
  await client.auth.signInWithPassword({email:'obra@teste.local',password:'senha'});
  const data=fresh(),b=budget(),w={...makeOrder(),status:'in_progress'};
  const log=createWorkLog(w,{itemId:id1,employeeId,workDate:'2026-11-10',
   hours:8},[employee],randomUUID());
  const m=createMeasurement(w,[],{itemId:id1,quantity:50,measuredOn:'2026-11-10'},randomUUID());
  m.status='approved';
  await putRemote(client,uid,'works',w);
  await putRemote(client,uid,'workLogs',log);
  await putRemote(client,uid,'measurements',m);
  const a=await billMeasurementRemote(client,uid,m.id,'2026-12-05');
  const b2=await billMeasurementRemote(client,uid,m.id,'2026-12-06');
  assert.equal(a,b2,'toque repetido não duplica cobrança');
  const loaded=await fetchRemote(client,uid);
  assert.equal(loaded.works.length,1);
  assert.equal(loaded.workLogs.length,1);
  assert.equal(loaded.measurements.length,1);
  assert.equal(loaded.ledger.length,1);
  assert.equal(loaded.ledger[0].paidDate,null);
  assert.equal(loaded.ledger[0].amount,m.amount);
  assert.equal(loaded.ledger[0].reference,'MED:'+m.id);
  assert.equal(loaded.ledger[0].dueDate,'2026-12-05');
  const originalCatalog=[{id:'local',code:'SIURB:123',roles:[{role:'Eletricista',hours:1.78}]}];
  const fast=await fetchOperationsRemote(client,uid,{...loaded,catalog:originalCatalog});
  assert.equal(fast.workLogs.length,1);
  assert.equal(fast.measurements.length,1);
  assert.deepEqual(fast.catalog,originalCatalog,'não baixa todo catálogo SIURB para atualizar obra');
 }finally{globalThis.localStorage=old;}
});
