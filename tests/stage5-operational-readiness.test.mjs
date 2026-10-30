import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requiredTables,requiredColumns} from '../src/stage5-release-gates.mjs';
import {handleStage5Readiness} from '../src/stage5-readiness-api.mjs';

const invoke=async(role='administrador')=>{
 const queries=[];let status=null,body=null;
 const sql={async query(q,args){
  queries.push({q,args});
  if(q.includes('information_schema.tables'))return requiredTables.map(table_name=>({table_name}));
  if(q.includes('information_schema.columns'))return requiredColumns.map(([table_name,column_name])=>({table_name,column_name}));
  if(q.includes('administrators_pending_password_change'))
   return [{active_administrators:1,administrators_pending_password_change:1,budgets:1,reference_prices:6988,proposal_drafts:0}];
  throw Error('Unexpected SQL');
 }};
 await handleStage5Readiness({req:{},res:{},sql,user:{role},parts:['release-readiness'],method:'GET',
  send:(_res,s,v)=>{status=s;body=v;}});
 return {queries,status,body};
};

test('diagnóstico real apresenta contagens agregadas e informa troca de senha pendente',async()=>{
 const r=await invoke();
 assert.equal(r.status,200);
 assert.equal(r.body.operational.budget_records,1);
 assert.equal(r.body.operational.reference_price_records,6988);
 assert.equal(r.body.operational.proposal_draft_records,0);
 assert.equal(r.body.operational.account_setup.administrator_present,true);
 assert.equal(r.body.operational.account_setup.administrator_password_change_pending,true);
 assert.equal(r.body.operational.backup_automation_verified,false);
 assert.equal(r.body.operational.browser_desktop_mobile_verified,false);
 assert.equal(r.body.schema.ready,true);
 assert.equal(r.body.commercial_release,false);
 assert.equal(r.body.gates.commercial_release,false);
 assert.equal(r.queries.length,3);
 for(const {q} of r.queries)assert.match(q,/^SELECT/);
 assert.ok(!JSON.stringify(r.body).includes('password_hash'));
});

test('perfil não-administrador não obtém consultas nem contagens',async()=>{
 const r=await invoke('orcamentista');
 assert.equal(r.status,403);
 assert.equal(r.queries.length,0);
});

test('painel expõe dados operacionais sem transformar diagnóstico em liberação',()=>{
 const page=readFileSync(new URL('../public/secure.js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../src/stage5-readiness-api.mjs',import.meta.url),'utf8');
 assert.match(page,/Troca de senha inicial/);
 assert.match(page,/account\.administrator_password_change_pending/);
 assert.match(api,/commercial_release:false/);
 assert.doesNotMatch(api,/password_hash|tax_id|customer_name|client_name/);
});
