import test from 'node:test';
import assert from 'node:assert/strict';
import session from '../api/session.mjs';
import admin from '../api/admin.mjs';
import {cookieToken} from '../lib/civolten-security.mjs';

const ORIGIN='https://civolten.vercel.app';
const JWT='a'.repeat(120);
const originalFetch=globalThis.fetch;
function request(path,method='GET',body,origin=ORIGIN,extra={}){
 return new Request(ORIGIN+path,{method,headers:{
  origin,'content-type':'application/json','sec-fetch-site':'same-origin',...extra
 },body:body===undefined?undefined:JSON.stringify(body)});
}

test('bloqueia leitura administrativa sem login',async()=>{
 const r=await admin.fetch(request('/api/admin?action=admin-list'));
 assert.equal(r.status,401);
 assert.match(r.headers.get('Cache-Control'),/no-store/);
});
test('nega tentativa cross-site de login',async()=>{
 const r=await session.fetch(request('/api/session','POST',{email:'admin@example.com',password:'Abcdefgh123456'},'https://ataque.example'));
 assert.equal(r.status,403);
 assert.equal(r.headers.get('set-cookie'),null);
});
test('não aceita cookies com formato malicioso',()=>{
 assert.equal(cookieToken(request('/api/admin','GET',undefined,ORIGIN,{cookie:'__Host-civolten_session=..notjwt; x=1'})),null);
});
test('login não devolve JWT: guarda HttpOnly Secure SameSite Strict',async()=>{
 const seen=[];
 globalThis.fetch=async(url,opts)=>{
  seen.push(url);
  if(String(url).includes('/auth/v1/token'))return Response.json({access_token:JWT,expires_in:3600});
  if(String(url).includes('api=admin-me'))return Response.json({authenticated:true});
  throw Error('Requisição inesperada');
 };
 try{
  const r=await session.fetch(request('/api/session','POST',{email:'admin@example.com',password:'SenhaForte1234'}));
  assert.equal(r.status,200);
  assert.equal((await r.json()).access_token,undefined);
  const cookie=r.headers.get('set-cookie');
  assert.match(cookie,/__Host-civolten_session=/);
  assert.match(cookie,/HttpOnly/);
  assert.match(cookie,/Secure/);
  assert.match(cookie,/SameSite=Strict/);
  assert.match(cookie,/Max-Age=3300/);
  assert.equal(seen.length,2);
 }finally{globalThis.fetch=originalFetch}
});
test('proxy encaminha autorização somente ao backend e bloqueia métodos desconhecidos',async()=>{
 globalThis.fetch=async(url,opts)=>{
  assert.match(String(url),/api=admin-list/);
  assert.equal(opts.headers.Authorization,'Bearer '+JWT);
  return Response.json({pedidos:[]});
 };
 try{
  const r=await admin.fetch(request('/api/admin?action=admin-list','GET',undefined,ORIGIN,{cookie:'__Host-civolten_session='+JWT}));
  assert.equal(r.status,200);
  assert.deepEqual((await r.json()).pedidos,[]);
  const invalid=await admin.fetch(request('/api/admin?action=admin-users'));
  assert.equal(invalid.status,404);
 }finally{globalThis.fetch=originalFetch}
});
