import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createE2EClient} from '../src/e2e-client.mjs';
import {putRemote,transitionWorkStatusRemote,fetchRemote} from '../src/cloud.mjs';

const userId='00000000-0000-4000-8000-000000000001';
const day='2026-11-09';
const id=()=>randomUUID();
const work=()=>({
 id:id(),budgetId:id(),customer:'Cliente real',project:'Obra de mão de obra',
 contractRef:'OS-2026-CIVOLTEN',acceptanceRef:'Aceite eletrônico registrado e conferido',
 budgetSnapshot:{items:[{id:'item-1',quantity:10,description:'Serviço',unit:'m²'}],
  pricing:{monthlyCostCents:2115335,productiveHours:352},commercial:{laborOnly:true}},
 pricedRows:[{id:'item-1',hours:17.8,cost:106900,selling:160000}],
 contractValue:1600,status:'approved',approvedOn:day,startOn:null,finishOn:null
});
async function clientWithStore(){
 const memory=new Map();
 globalThis.localStorage={getItem:key=>memory.get(key)||null,
  setItem:(key,value)=>memory.set(key,value)};
 const client=createE2EClient();
 await client.auth.signInWithPassword({email:'teste@civolten.local',password:'senha'});
 return client;
}
test('regressão: UPSERT executava BEFORE INSERT em OS existente; UPDATE passa',async()=>{
 const old=globalThis.localStorage;
 try{
  const client=await clientWithStore(),initial=work();
  await putRemote(client,userId,'works',initial);
  const failedInsert=await client.from('cv_work_orders_v1')
   .insert({id:initial.id,user_id:userId,status:'in_progress'}).select('id').single();
  assert.match(failedInsert.error.message,/inicia com aceite aprovado/);
  const started=await transitionWorkStatusRemote(client,userId,initial,'in_progress',{startOn:day});
  assert.equal(started.status,'in_progress');
  assert.equal(started.startOn,day);
  const remote=await fetchRemote(client,userId);
  assert.equal(remote.works.length,1,'não cria outra OS');
  assert.equal(remote.works[0].status,'in_progress');
  assert.equal(remote.works[0].budgetId,initial.budgetId);
  assert.equal(remote.works[0].contractValue,initial.contractValue);
  assert.deepEqual(remote.works[0].budgetSnapshot,initial.budgetSnapshot);
  await assert.rejects(
   transitionWorkStatusRemote(client,userId,initial,'cancelled',{}),
   /situação da obra mudou/i
  );
  await assert.rejects(
   transitionWorkStatusRemote(client,userId,started,'completed',{finishOn:day}),
   /Registre horas e aprove todas as medições/i
  );
  const pending=await fetchRemote(client,userId);
  assert.equal(pending.works[0].status,'in_progress');
 }finally{globalThis.localStorage=old;}
});
test('cancelar OS aprovada não altera preço e impede iniciar depois',async()=>{
 const old=globalThis.localStorage;
 try{
  const client=await clientWithStore(),initial=work();
  await putRemote(client,userId,'works',initial);
  const cancelled=await transitionWorkStatusRemote(client,userId,initial,'cancelled');
  assert.equal(cancelled.status,'cancelled');
  const loaded=await fetchRemote(client,userId);
  assert.equal(loaded.works[0].status,'cancelled');
  assert.equal(loaded.works[0].contractValue,initial.contractValue);
  await assert.rejects(
   transitionWorkStatusRemote(client,userId,cancelled,'in_progress',{startOn:day}),
   /Mudança de estado inválida/
  );
 }finally{globalThis.localStorage=old;}
});
test('concluir só com horas e todas as medições aprovadas, preservando contrato',async()=>{
 const old=globalThis.localStorage;
 try{
  const client=await clientWithStore(),initial=work();
  await putRemote(client,userId,'works',initial);
  const started=await transitionWorkStatusRemote(client,userId,initial,'in_progress',{startOn:day});
  await putRemote(client,userId,'workLogs',{
   id:id(),workOrderId:initial.id,employeeId:id(),itemId:'item-1',workDate:day,
   hours:8,qualificationConfirmed:true,notes:'Execução registrada'
  });
  await putRemote(client,userId,'measurements',{
   id:id(),workOrderId:initial.id,itemId:'item-1',measuredOn:day,
   quantity:10,amount:1600,status:'approved',approvedAt:new Date().toISOString(),notes:''
  });
  const done=await transitionWorkStatusRemote(client,userId,started,'completed',{finishOn:day});
  assert.equal(done.status,'completed');
  assert.equal(done.finishOn,day);
  const loaded=await fetchRemote(client,userId);
  assert.equal(loaded.works.length,1);
  assert.equal(loaded.works[0].contractValue,1600);
  assert.equal(loaded.workLogs.length,1);
  assert.equal(loaded.measurements.length,1);
  await assert.rejects(
   transitionWorkStatusRemote(client,userId,done,'cancelled'),
   /Mudança de estado inválida/
  );
 }finally{globalThis.localStorage=old;}
});
