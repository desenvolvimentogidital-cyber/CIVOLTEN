import test from 'node:test';
import assert from 'node:assert/strict';
import access from '../api/access.mjs';
import signup from '../api/signup.mjs';
import recovery from '../api/recovery.mjs';
import session from '../api/session.mjs';
const root='https://civolten.example.test';
function make(method,path,body,origin=root){
 return new Request(root+path,{method,headers:{origin,'content-type':'application/json','sec-fetch-site':'same-origin'},body:method==='GET'?undefined:JSON.stringify(body||{})});
}
test('fluxo de aprovacao removido retorna 410',async()=>{
 const r=await access.fetch(make('POST','/api/access?action=approve',{user_id:'2f8e7050-f56e-4d31-973d-b53295960819'}));
 assert.equal(r.status,410);
});
test('lista de aprovacoes antigas retorna 410',async()=>{
 const r=await access.fetch(make('GET','/api/access?action=list'));
 assert.equal(r.status,410);
});
test('cadastro não aceita requisição de origem externa',async()=>{
 const r=await signup.fetch(make('POST','/api/signup',{email:'qualquer@example.com',password:'senha-muito-comprida'},'https://site-falso.example'));
 assert.equal(r.status,403);
});
test('cadastro rejeita senha fraca antes de chamar o provedor',async()=>{
 const r=await signup.fetch(make('POST','/api/signup',{email:'teste@example.com',password:'curta'}));
 assert.equal(r.status,400);
});
test('recuperação não aceita token aleatório nem senha curta',async()=>{
 const r=await recovery.fetch(make('POST','/api/recovery',{action:'update',access_token:'invalido',password:'curta'}));
 assert.equal(r.status,400);
});
test('login inválido é rejeitado antes de enviar ao Supabase',async()=>{
 const r=await session.fetch(make('POST','/api/session',{email:'teste@example.com',password:'curta'}));
 assert.equal(r.status,400);
});
