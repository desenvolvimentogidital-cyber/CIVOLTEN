'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHandler,validState}=require('../api/cloud-state.js');
const data=()=>({company:{name:'CIVOLTEN'},clients:[],quotes:[],workers:[],materials:[],services:[],expenses:[]});
function fakeRes() {
 return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this},
  status(v){this.statusCode=v;return this},
  json(v){this.body=v;return this}};
}
const auth=async token=>{if(token!=='ok')throw new Error('no');return 'test-user'};
const fn=(overrides={})=>createHandler({authenticate:auth,load:async()=>null,save:async()=>({revision:1,updated_at:'now'}),...overrides});
async function run(handler,method,body,headers={}) {
 const res=fakeRes();
 await handler({method,body,headers:{authorization:'Bearer ok','content-type':'application/json',...headers}},res);
 return res;
}
test('dados válidos exigem arrays e empresa',()=>{assert.equal(validState(data()),true);assert.equal(validState({}),false)});
test('sem token nenhuma consulta é permitida',async()=>{
 const r=await run(fn(),'GET',null,{authorization:''});assert.equal(r.statusCode,401);
});
test('token inválido não chega ao banco',async()=>{
 let queried=false;
 const r=await run(fn({load:async()=>{queried=true}}),'GET',null,{authorization:'Bearer invalid'});
 assert.equal(r.statusCode,401);assert.equal(queried,false);
});
test('GET vazio retorna revisão zero',async()=>{
 const r=await run(fn(),'GET');assert.deepEqual(r.body,{revision:0,data:null,updatedAt:null});
});
test('GET existente retorna somente dados do usuário autorizado',async()=>{
 const r=await run(fn({load:async user=>{assert.equal(user,'test-user');return {revision:3,data:data(),updated_at:'today'}}}),'GET');
 assert.equal(r.statusCode,200);assert.equal(r.body.revision,3);
});
test('PUT salva com revisão esperada',async()=>{
 const r=await run(fn({save:async(user,version,raw)=>{assert.equal(user,'test-user');assert.equal(version,0);assert.deepEqual(JSON.parse(raw),data());return {revision:1,updated_at:'now'}}}),'PUT',{expectedRevision:0,data:data()});
 assert.equal(r.statusCode,200);assert.equal(r.body.revision,1);
});
test('revisão concorrente causa conflito sem sobrescrever',async()=>{
 const r=await run(fn({save:async()=>null}),'PUT',{expectedRevision:1,data:data()});
 assert.equal(r.statusCode,409);
});
test('estrutura incompleta é rejeitada',async()=>{
 const r=await run(fn(),'PUT',{expectedRevision:0,data:{clients:[],quotes:[]}});assert.equal(r.statusCode,400);
});
test('revisão negativa ou fracionada é rejeitada',async()=>{
 for(const version of [-1,1.5,'1']){
  const r=await run(fn(),'PUT',{expectedRevision:version,data:data()});assert.equal(r.statusCode,400);
 }
});
test('backup grande bloqueado antes de escrever',async()=>{
 let called=false;const tooLarge={...data(),company:{name:'X'.repeat(3_500_010)}};
 const r=await run(fn({save:async()=>{called=true}}),'PUT',{expectedRevision:0,data:tooLarge});
 assert.equal(r.statusCode,413);assert.equal(called,false);
});
test('método desconhecido é rejeitado',async()=>{
 const r=await run(fn(),'DELETE');assert.equal(r.statusCode,405);
});
test('erro de conexão não apaga dados locais',async()=>{
 const r=await run(fn({save:async()=>{throw new Error('offline')}}),'PUT',{expectedRevision:0,data:data()});
 assert.equal(r.statusCode,503);assert.match(r.body.error,/dados locais não foram alterados/);
});
