import test from 'node:test';
import assert from 'node:assert/strict';
import {createE2EClient} from '../src/e2e-client.mjs';
import {putRemote,fetchOperationsRemote,fetchRemote} from '../src/cloud.mjs';
import {fieldRows,fieldSummary,validateFieldUpdate} from '../src/field-progress.mjs';
import {fieldProgressView,fieldListHtml,fieldEditDialog} from '../src/field-progress-ui.mjs';
import {randomUUID} from 'node:crypto';
const uid='00000000-0000-4000-8000-000000000001';
const aid=randomUUID(),bid=randomUUID();
const makeWork=()=>({id:randomUUID(),budgetId:randomUUID(),customer:'Cliente CIVOLTEN',
 project:'Obra Alphaville',contractRef:'OS-2026-CIVOLTEN',acceptanceRef:'Aceite conferido',
 approvedOn:'2026-11-09',startOn:'2026-11-09',status:'in_progress',contractValue:30000,
 budgetSnapshot:{items:[
  {id:aid,description:'Alvenaria em bloco comum',unit:'m²',quantity:150,laborHours:1.78},
  {id:bid,description:'Montagem de eletrodutos',unit:'m',quantity:20,laborHours:0.4}
 ],pricing:{productiveHours:352,productiveDays:22,hoursPerDay:8,productivePeople:2}},
 pricedRows:[{id:aid,cost:100,selling:100000,hours:267},{id:bid,cost:20,selling:40000,hours:8}]
});
const sample=(w,itemId,props={})=>({
 itemId,status:'in_progress',executedQuantity:15,employeeId:'',
 observedOn:'2026-11-09',notes:'Bloco A pronto',photoPaths:[],...props
});
test('Progresso é baseado em HH proporcionais, não soma unidades incompatíveis',()=>{
 const w=makeWork(),data={fieldProgress:[
  {id:randomUUID(),workOrderId:w.id,itemId:aid,status:'in_progress',executedQuantity:75},
  {id:randomUUID(),workOrderId:w.id,itemId:bid,status:'done',executedQuantity:20}
 ]};
 const result=fieldSummary(w,data);
 assert.equal(result.total,2);
 assert.equal(result.done,1);
 assert.equal(result.active,1);
 assert.equal(result.totalHours,275);
 assert.equal(result.equivalentHours,141.5);
 assert.equal(result.percentage,51.5);
 assert.equal(fieldRows(w,data)[0].percentage,50);
});
test('Regras: pendente zera, concluído recebe total, bloqueado preserva parcial',()=>{
 const w=makeWork(),data={employees:[]};
 assert.equal(validateFieldUpdate(w,data,sample(w,aid,{status:'pending'}),randomUUID()).executedQuantity,0);
 assert.equal(validateFieldUpdate(w,data,sample(w,aid,{status:'done'}),randomUUID()).executedQuantity,150);
 assert.equal(validateFieldUpdate(w,data,sample(w,aid,{status:'blocked'}),randomUUID()).executedQuantity,15);
 assert.throws(()=>validateFieldUpdate(w,data,sample(w,aid,{executedQuantity:151}),randomUUID()),/maior que/);
 assert.throws(()=>validateFieldUpdate(w,data,sample(w,aid,{executedQuantity:12.1234}),randomUUID()),/três casas/);
 assert.throws(()=>validateFieldUpdate(w,data,sample(w,'id-desconhecido'),randomUUID()),/não pertence/);
 assert.throws(()=>validateFieldUpdate({...w,status:'approved'},data,sample(w,aid),randomUUID()),/Inicie a obra/);
 assert.throws(()=>validateFieldUpdate({...w,status:'completed'},data,sample(w,aid),randomUUID()),/Inicie a obra/);
 assert.throws(()=>validateFieldUpdate(w,data,sample(w,aid,{notes:'x'.repeat(1201)}),randomUUID()),/1.200/);
 assert.throws(()=>validateFieldUpdate(w,data,sample(w,aid,{photoPaths:['a','b','c','d']}),randomUUID()),/3 fotos/);
});
test('Interface tem controles por serviço e não expõe custos/preços',()=>{
 const w=makeWork(),data={works:[w],fieldProgress:[],employees:[],measurements:[],workLogs:[]};
 const html=fieldProgressView(data,w.id);
 assert.match(html,/Diário de campo/);
 assert.match(html,/Acompanhamento físico/);
 assert.match(html,/data-action="field-edit"/);
 assert.match(html,/Paralisados/);
 assert.match(html,/Alvenaria em bloco comum/);
 assert.doesNotMatch(html,/R\$|Valor contratado|Margem de lucro/);
 assert.equal((html.match(/field-progress-card pending/g)||[]).length,2);
 const filtered=fieldListHtml(w,data,'all','eletrodutos');
 assert.match(filtered,/Montagem de eletrodutos/);
 assert.doesNotMatch(filtered,/Alvenaria em bloco/);
 const dialog=fieldEditDialog(w,data,aid);
 assert.match(dialog,/name="executedQuantity"/);
 assert.match(dialog,/name="photos"/);
 assert.match(dialog,/name="observedOn"/);
});
test('Registro fica no Supabase simulado e não altera medição, preço nem HH real',async()=>{
 const old=globalThis.localStorage,store=new Map();
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 try{
  const client=createE2EClient();
  await client.auth.signInWithPassword({email:'campo@civolten.local',password:'qualquer'});
  const w=makeWork();
  const db=JSON.parse(store.get('cv_e2e_supabase_v1')||'{}');
  db.cv_work_orders_v1=[{id:w.id,user_id:uid,work_order_id:w.id,
   budget_id:w.budgetId,customer:w.customer,project:w.project,contract_ref:w.contractRef,
   acceptance_ref:w.acceptanceRef,approved_on:w.approvedOn,start_on:w.startOn,status:w.status,
   contract_value:w.contractValue,budget_snapshot:w.budgetSnapshot,priced_rows:w.pricedRows,
   created_at:new Date().toISOString()}];
  store.set('cv_e2e_supabase_v1',JSON.stringify(db));
  const entry=validateFieldUpdate(w,{employees:[]},sample(w,aid),randomUUID());
  await putRemote(client,uid,'fieldProgress',entry);
  const original=await fetchRemote(client,uid);
  assert.equal(original.fieldProgress.length,1);
  assert.equal(original.fieldProgress[0].executedQuantity,15);
  assert.equal(original.measurements.length,0);
  assert.equal(original.workLogs.length,0);
  assert.equal(original.works[0].contractValue,w.contractValue);
  const now=validateFieldUpdate(w,{employees:[]},sample(w,aid,{status:'done'}),entry.id);
  await putRemote(client,uid,'fieldProgress',now);
  const after=await fetchOperationsRemote(client,uid,original);
  assert.equal(after.fieldProgress.length,1);
  assert.equal(after.fieldProgress[0].executedQuantity,150);
  assert.equal(after.fieldProgress[0].status,'done');
  assert.equal(after.works[0].contractValue,w.contractValue);
  assert.equal(after.ledger.length,0);
  const disallowed=await client.from('cv_field_progress_v1').upsert({
   id:randomUUID(),user_id:uid,work_order_id:w.id,item_id:'invalid',
   status:'done',executed_quantity:5}).select('id').single();
  assert.ok(disallowed.error,'banco deve rejeitar serviço fora da OS');
 }finally{globalThis.localStorage=old;}
});
