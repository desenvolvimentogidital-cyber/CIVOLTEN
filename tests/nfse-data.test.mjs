import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupCnpj,lookupCep,clientFromDraft,clientToDraft,saveNfseCloud,loadNfseRecords,saveNfseClient,deleteNfseCloud} from '../src/nfse-data.mjs';
import {nfseNewDraft} from '../src/nfse-ui.mjs';

const owner='00000000-0000-4000-8000-000000000001';
const complete=()=>({...nfseNewDraft({companyName:'CIVOLTEN',taxRegime:'mei'}),
 issuerCnpj:'67.138.121/0001-75',clientCnpj:'71.731.707/0001-16',
 clientName:'Ativa Construções Ltda',description:'Instalação elétrica',
 amount:'4000',cep:'11060-300',city:'Santos',uf:'SP',street:'Av. Floriano',number:'74',
 serviceCode:'07.02.02',nbs:'1.0106.11.00',serviceCity:'Santos',
 issRetention:'nao',ibsCbs:'nao'});
test('consulta pública por CNPJ mapeia nome e endereço sem sugerir tributação',async()=>{
 let called='';
 const data=await lookupCnpj('71.731.707/0001-16',async url=>{
  called=url;return {ok:true,json:async()=>({razao_social:'Ativa Construções Ltda',
   logradouro:'Rua Xavier',numero:'608',municipio:'São Paulo',uf:'SP',
   cep:'04211001',descricao_situacao_cadastral:'ATIVA'})};
 });
 assert.match(called,/brasilapi/);
 assert.equal(data.clientName,'Ativa Construções Ltda');
 assert.equal(data.clientStreet,'Rua Xavier');
 assert.equal(data.active,true);
 assert.equal(data.issRetention,undefined);
 await assert.rejects(()=>lookupCnpj('00000000000000',async()=>{throw Error('no');}),/CNPJ válido/);
});
test('CEP reconhece falha e mantém a possibilidade de preenchimento manual',async()=>{
 const fake=async()=>({ok:true,json:async()=>({cep:'11060-300',
  logradouro:'Av. Marechal Floriano Peixoto',bairro:'Gonzaga',localidade:'Santos',uf:'SP'})});
 const d=await lookupCep('11060-300',fake);
 assert.equal(d.city,'Santos');
 assert.equal(d.street,'Av. Marechal Floriano Peixoto');
 await assert.rejects(()=>lookupCep('11060-300',async()=>({ok:true,json:async()=>({erro:true})})),/não localizado/);
 await assert.rejects(()=>lookupCep('999',fake),/oito dígitos/);
});
test('client mapping só cadastra quando há CNPJ válido',()=>{
 const d=complete();
 assert.equal(clientFromDraft(d).cnpj,'71731707000116');
 assert.equal(clientFromDraft({...d,clientCnpj:'111'}),null);
 assert.equal(clientToDraft({cnpj:'71731707000116',legal_name:'ATIVA',address:{city:'Santos'}}).clientCity,'Santos');
});
test('grava somente rascunhos/ready e histórico nunca equivale a nota emitida',async()=>{
 const db={cv_nfse_drafts_v1:[],cv_nfse_clients_v1:[]};
 const client={from(table){
  return {
   upsert(row){
    const exec=async()=>{
     const ix=db[table].findIndex(x=>x.id===row.id);
     const saved={...row,created_at:new Date().toISOString()};
     if(ix===-1)db[table].push(saved);else db[table][ix]=saved;
     return {data:[{id:row.id}],error:null};
    };
    return {select:()=>({then:(resolve,reject)=>exec().then(resolve,reject)})};
   },
   select(){
    return {eq:()=>({order:()=>({range:async()=>({data:db[table],error:null})})})};
   },
   delete(){
    const where={};
    const query={eq:(key,value)=>{where[key]=value;return query},
      select:async()=>{
       const removed=db[table].filter(x=>x.id===where.id&&x.user_id===where.user_id);
       db[table]=db[table].filter(x=>!removed.includes(x));
       return {data:removed,error:null};
      }};
    return query;
   }
  };
 }};
 const draft=complete();
 const saved=await saveNfseCloud(client,owner,null,draft);
 assert.equal(saved.status,'ready');
 assert.equal(db.cv_nfse_drafts_v1[0].status,'ready');
 assert.equal(db.cv_nfse_drafts_v1[0].payload.xml,undefined);
 const loaded=await loadNfseRecords(client,owner);
 assert.equal(loaded.drafts.length,1);
 assert.equal(loaded.drafts[0].status,'ready');
 await saveNfseClient(client,owner,draft);
 assert.equal(db.cv_nfse_clients_v1.length,1);
 assert.equal(await deleteNfseCloud(client,owner,saved.id),true);
 assert.equal(db.cv_nfse_drafts_v1.length,0);
});
