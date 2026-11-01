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
   return [{active_administrators:1,administrators_pending_password_change:1,
    budgets:1,reference_prices:6988,reference_compositions:6926,proposal_drafts:0,active_budget_items:2,
    items_pending_cost_review:2,items_pending_productivity_review:2,
    budgets_pending_cost_approval:1,company_hourly_rates:0,
    company_overhead_profiles:0,active_company_workers:0,issued_proposals:0}];
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
 assert.equal(r.body.operational.reference_composition_records,6926);
 assert.equal(r.body.operational.phases.length,7);
 assert.equal(r.body.operational.all_seven_phases_approved,false);
 assert.equal(r.body.operational.phases[0].status,'pendente');
 assert.equal(r.body.operational.phases[1].checks[0].complete,true);
 assert.equal(r.body.operational.phases[1].checks[1].complete,true);
 assert.equal(r.body.operational.proposal_draft_records,0);
 assert.equal(r.body.operational.account_setup.administrator_present,true);
 assert.equal(r.body.operational.account_setup.administrator_password_change_pending,true);
 assert.equal(r.body.operational.active_budget_items,2);
 assert.equal(r.body.operational.items_pending_cost_review,2);
 assert.equal(r.body.operational.items_pending_productivity_review,2);
 assert.equal(r.body.operational.budgets_pending_cost_approval,1);
 assert.equal(r.body.operational.company_hourly_rates,0);
 assert.equal(r.body.operational.company_overhead_profiles,0);
 assert.equal(r.body.operational.issued_proposal_records,0);
 assert.ok(r.body.operational.preparation.some(x=>x.key==='productivity_reviews'&&!x.complete));
 assert.ok(r.body.operational.preparation.some(x=>x.key==='encrypted_backup'&&!x.complete));
 assert.equal(r.body.operational.preparation.length,9);
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
 assert.match(page,/As sete fases da implantação/);
 assert.match(page,/account\.administrator_password_change_pending/);
 assert.match(api,/commercial_release:false/);
 assert.doesNotMatch(api,/password_hash|tax_id|customer_name|client_name/);
});
