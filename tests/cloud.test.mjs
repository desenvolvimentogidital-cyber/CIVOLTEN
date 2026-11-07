import test from 'node:test';
import assert from 'node:assert/strict';
import {createE2EClient} from '../src/e2e-client.mjs';
import {fetchRemote,putRemote,deleteRemote,TABLES} from '../src/cloud.mjs';
const userId='00000000-0000-4000-8000-000000000001';
test('dados financeiros são escritos no banco e lidos com valores reais',async()=>{
 const rows=new Map();
 globalThis.localStorage={getItem:key=>rows.get(key)||null,setItem:(key,value)=>rows.set(key,value)};
 const client=createE2EClient();
 await client.auth.signInWithPassword({email:'teste@example.com',password:'senha-forte'});
 const item={id:'11111111-1111-4111-8111-111111111111',
  name:'Aluguel',category:'Infraestrutura',amount:1200,frequency:'monthly'};
 await putRemote(client,userId,'fixed',item);
 let data=await fetchRemote(client,userId);
 assert.equal(data.fixed[0].name,'Aluguel');
 assert.equal(data.fixed[0].amount,1200);
 assert.deepEqual(data.variable,[]);
 assert.deepEqual(data.employees,[]);
 await putRemote(client,userId,'fixed',{...item,amount:1500});
 data=await fetchRemote(client,userId);
 assert.equal(data.fixed.length,1);
 assert.equal(data.fixed[0].amount,1500);
 await deleteRemote(client,userId,'fixed',item.id);
 assert.equal((await fetchRemote(client,userId)).fixed.length,0);
});
test('custos variáveis e funcionários preservam campos e status',async()=>{
 const c=createE2EClient();
 await c.auth.signInWithPassword({email:'teste@example.com'});
 const cost={id:'22222222-2222-4222-8222-222222222222',
  name:'Combustível',category:'Transporte',unit:'km',unitCost:1.5,monthQty:null};
 const worker={id:'33333333-3333-4333-8333-333333333333',
  name:'João',role:'Eletricista',contractType:'clt',active:true,
  salary:3200,hours:160,fgtsPct:8,employerPct:20,benefits:200,extras:0};
 await putRemote(c,userId,'variable',cost);
 await putRemote(c,userId,'employees',worker);
 const data=await fetchRemote(c,userId);
 assert.equal(data.variable[0].monthQty,null);
 assert.equal(data.variable[0].unitCost,1.5);
 assert.equal(data.employees[0].salary,3200);
 assert.equal(data.employees[0].fgtsPct,8);
});
test('outro usuário não consegue salvar, excluir ou ler registros alheios',async()=>{
 const c=createE2EClient();
 await c.auth.signInWithPassword({email:'teste@example.com'});
 const someone='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 await assert.rejects(putRemote(c,someone,'fixed',{
  id:'44444444-4444-4444-8444-444444444444',
  name:'Invasão',amount:1,frequency:'monthly'}),/RLS/);
 await assert.rejects(deleteRemote(c,someone,'fixed',
  '22222222-2222-4222-8222-222222222222'),/não confirmou/);
 assert.deepEqual((await fetchRemote(c,someone)).fixed,[]);
});
test('não existe tabela pública sem mapeamento',()=>{
 assert.deepEqual(Object.keys(TABLES),['fixed','variable','employees','ledger']);
});

test('lançamentos de faturamento são persistidos e isolados por usuário',async()=>{
 const c=createE2EClient();await c.auth.signInWithPassword({email:'teste@example.com'});
 const invoice={id:'55555555-5555-4555-8555-555555555555',kind:'income',title:'Contrato',
  amount:500,party:'Cliente',project:'Obra 1',category:'Serviço',dueDate:'2026-11-30',
  paidDate:null,reference:'FAT-1',notes:''};
 await putRemote(c,userId,'ledger',invoice);
 const fetched=await fetchRemote(c,userId);
 assert.equal(fetched.ledger[0].amount,500);
 assert.equal(fetched.ledger[0].paidDate,null);
 await putRemote(c,userId,'ledger',{...invoice,paidDate:'2026-11-10'});
 assert.equal((await fetchRemote(c,userId)).ledger[0].paidDate,'2026-11-10');
 await deleteRemote(c,userId,'ledger',invoice.id);
 assert.equal((await fetchRemote(c,userId)).ledger.length,0);
});
