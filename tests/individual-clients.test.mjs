import test from 'node:test';
import assert from 'node:assert/strict';
import {validCpf,digits,saveIndividualClient,deleteIndividualClient} from '../src/individual-clients.mjs';
const owner='00000000-0000-4000-8000-000000000001';
test('CPF valida digitos verificadores e rejeita sequencias',()=>{
 assert.equal(validCpf('529.982.247-25'),true);
 assert.equal(validCpf('529.982.247-26'),false);
 assert.equal(validCpf('111.111.111-11'),false);
 assert.equal(digits('529.982.247-25'),'52998224725');
});
test('salvar e excluir cliente CPF exigem confirmacao e titularidade',async()=>{
 const rowId='00000000-0000-4000-8000-000000000010';
 let stored=null;
 const db={from(name){
  assert.equal(name,'cv_individual_clients_v1');
  return {upsert(row){stored=row;return {select:async()=>({data:[{id:row.id}],error:null})};},
   delete(){const where={};const q={eq(k,v){where[k]=v;return q;},async select(){
    return {data:where.id===rowId&&where.user_id===owner?[{id:rowId}]:[],error:null};
   }};return q;}};
 }};
 await saveIndividualClient(db,owner,{id:rowId,cpf:'529.982.247-25',legal_name:'Cliente Teste',email:'teste@example.com'});
 assert.equal(stored.user_id,owner);
 assert.equal(stored.cpf,'52998224725');
 assert.equal(await deleteIndividualClient(db,owner,rowId),true);
 await assert.rejects(()=>deleteIndividualClient(db,'00000000-0000-4000-8000-000000000002',rowId),/não confirmou/);
});
