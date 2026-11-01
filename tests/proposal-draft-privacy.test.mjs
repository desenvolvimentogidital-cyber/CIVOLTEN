import test from 'node:test';
import assert from 'node:assert/strict';
import {handleStage4} from '../src/stage4-finance-api.mjs';

const id='11111111-1111-4111-8111-111111111111';
const draft='22222222-2222-4222-8222-222222222222';
async function request(parts,role='consulta'){
 let queries=0,status=null,payload=null;
 const supported=await handleStage4({
  req:{url:'/api/v1/'+parts.join('/')},res:{},
  sql:{async query(){queries++;throw Error('Queries prohibited to read-only viewer')}},
  user:{id:'33333333-3333-4333-8333-333333333333',role},
  parts,method:'GET',send:(_res,s,p)=>{status=s;payload=p}
 });
 return {supported,status,payload,queries};
}
test('perfil consulta não acessa snapshot financeiro com salário e margem próprios',async()=>{
 const r=await request(['budgets',id,'proposal-drafts',draft]);
 assert.equal(r.supported,true);
 assert.equal(r.status,403);
 assert.equal(r.queries,0);
 assert.match(r.payload.error,/Detalhes financeiros/);
});
test('perfil consulta não baixa PDF interno nem obtém salários pelo mesmo endpoint',async()=>{
 const r=await request(['budgets',id,'proposal-drafts',draft,'pdf']);
 assert.equal(r.status,403);
 assert.equal(r.queries,0);
});
