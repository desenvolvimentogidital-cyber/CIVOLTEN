import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createApi} from '../api/index.mjs';
async function simulate(url,method='GET',headers={}){
 const req=new EventEmitter();
 req.method=method;req.url=url;req.headers={host:'civolten-gj91.vercel.app',...headers};
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v},end(v){this.output=JSON.parse(v)}};
 const queries=[];
 const sql={async query(statement,args){queries.push({statement,args});if(statement==='SELECT 1 AS connected')return [{connected:1}];throw Error('Não deveria consultar o banco nesta rota')}};
 await createApi(sql,{})(req,res);
 return {status:res.statusCode,body:res.output,headers:res.headers,queries};
}
test('API não permite consultar clientes anônimos',async()=>{
 const r=await simulate('/api/v1/clients');
 assert.equal(r.status,401);assert.equal(r.body.error,'Sessão necessária');assert.equal(r.queries.length,0);
});
test('API v1 health não divulga credenciais',async()=>{
 const r=await simulate('/api/v1/health');
 assert.equal(r.status,200);assert.equal(r.body.ok,true);
 assert.ok(!JSON.stringify(r.body).includes('DATABASE_URL'));
});
test('API v1 não aceita requisição de escrita sem proteção anti-CSRF',async()=>{
 const r=await simulate('/api/v1/clients','POST',{'content-type':'application/json'});
 assert.equal(r.status,403);
 assert.match(r.body.error,/CSRF/);
});
test('API v1 bloqueia origem externa',async()=>{
 const r=await simulate('/api/v1/auth/logout','POST',{'origin':'https://evil.example','x-civolten-request':'1'});
 assert.equal(r.status,403);assert.match(r.body.error,/Origem/);
});
test('API v1 não habilita bootstrap sem autorização explícita',async()=>{
 const r=await simulate('/api/v1/auth/bootstrap','POST',{'x-civolten-request':'1'});
 assert.equal(r.status,403);assert.match(r.body.error,/desativada/);
});
