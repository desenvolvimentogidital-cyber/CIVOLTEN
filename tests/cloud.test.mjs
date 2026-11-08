import test from 'node:test';
import assert from 'node:assert/strict';
import {createE2EClient} from '../src/e2e-client.mjs';
import {fetchRemote,putRemote,deleteRemote,putCompanyRemote,TABLES} from '../src/cloud.mjs';
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
 assert.deepEqual(Object.keys(TABLES),['fixed','variable','employees','ledger','budgets']);
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

test('configurações da empresa e tema persistem sem tocar nos custos existentes',async()=>{
 const c=createE2EClient();
 await c.auth.signInWithPassword({email:'teste@example.com',password:'senha-forte'});
 const id=userId;
 const config={companyName:'CIVOLTEN Elétrica',taxRegime:'simples',annex:'IV',
  taxPct:11.5,marginPct:20,productiveDays:20,hoursPerDay:8,productivePeople:2,
  theme:'blue',reviewed:true};
 await putCompanyRemote(c,id,config);
 const loaded=await fetchRemote(c,id);
 assert.equal(loaded.company.companyName,'CIVOLTEN Elétrica');
 assert.equal(loaded.company.taxPct,11.5);
 assert.equal(loaded.company.theme,'blue');
 assert.equal(loaded.company.productivePeople,2);
 const newTheme={...loaded.company,theme:'emerald'};
 await putCompanyRemote(c,id,newTheme);
 assert.equal((await fetchRemote(c,id)).company.marginPct,20);
 assert.equal((await fetchRemote(c,id)).company.theme,'emerald');
 const other='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 await assert.rejects(putCompanyRemote(c,other,config),/RLS/);
 assert.equal((await fetchRemote(c,other)).company.reviewed,false);
});

test('orçamentos demonstrativos são salvos, atualizados e excluídos via Supabase simulado',async()=>{
 const c=createE2EClient();
 await c.auth.signInWithPassword({email:'teste@example.com',password:'senha-forte'});
 const id='66666666-6666-4666-8666-666666666666';
 const item={id:'item-1',source:'demo',sourceCode:'DEMO-E01',
  description:'Ponto elétrico demonstrativo',unit:'un',quantity:2,laborHours:2.5,directCost:35};
 const budget={id,title:'Teste de instalação',customer:'Cliente',
  project:'Teste',location:'Obra demonstrativa',expiresOn:'2026-12-20',
  notes:'',items:[item],status:'draft',demo:true,
  pricing:{monthlyCostCents:100000,productiveHours:160,taxPct:10,marginPct:20,
   companyName:'CIVOLTEN',capturedOn:'2026-11-07'}};
 await putRemote(c,userId,'budgets',budget);
 let saved=(await fetchRemote(c,userId)).budgets;
 assert.equal(saved.length,1);
 assert.equal(saved[0].customer,'Cliente');
 assert.equal(saved[0].items[0].sourceCode,'DEMO-E01');
 assert.equal(saved[0].pricing.taxPct,10);
 await putRemote(c,userId,'budgets',{...budget,items:[{...item,quantity:3}]});
 saved=(await fetchRemote(c,userId)).budgets;
 assert.equal(saved[0].items[0].quantity,3);
 const someone='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 await assert.rejects(putRemote(c,someone,'budgets',budget),/RLS/);
 assert.deepEqual((await fetchRemote(c,someone)).budgets,[]);
 await deleteRemote(c,userId,'budgets',id);
 assert.equal((await fetchRemote(c,userId)).budgets.length,0);
});
