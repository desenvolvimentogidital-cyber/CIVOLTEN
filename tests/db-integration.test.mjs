import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import pg from 'pg';
import {createApi} from '../api/index.mjs';

// This runs only against the disposable postgres:17 CI service. NEVER the Neon database.
// Database URL is restricted to localhost and a fixed test database.
const url=process.env.CIVOLTEN_TEST_DATABASE_URL;
const allowed=url&&/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:127\.0\.0\.1|localhost):5432\/civolten_test(?:\?.*)?$/.test(url);
if(!allowed){
 test.skip('integration requires disposable localhost PostgreSQL database',()=>{});
}else{
const pool=new pg.Pool({connectionString:url,max:4});
const sql={async query(statement,params=[]){return (await pool.query(statement,params)).rows}};
const bootSecret='CI-INTEGRATION-ONLY-secret-do-not-use-in-real-accounts';
const handler=createApi(sql,{bootstrapSecret:bootSecret});
const login='ci.admin@civolten.test';
const originalPassword='ci-test-password-ONLY-use-in-ephemeral-postgres';
const nextPassword='ci-test-ROTATED-password-not-for-real-accounts';
const finalPassword='ci-test-FINAL-password-only';
const viewerPassword='ci-test-viewer-personal-password';
function makeRequest(route,{method='GET',payload,session,headers={}}={}){
 const req=Readable.from(payload===undefined?[]:[Buffer.from(JSON.stringify(payload))]);
 req.url='/api/v1/'+route;
 req.method=method;
 req.headers={
  host:'localhost:3000',
  ...(session?{cookie:session}:{}),
  ...(payload!==undefined?{'content-type':'application/json'}:{}),
  ...(method!=='GET'?{'x-civolten-request':'1'}:{}),
  ...headers
 };
 const response={statusCode:200,headers:{},
  setHeader(name,value){this.headers[name.toLowerCase()]=value},
  end(content){this.json=JSON.parse(content)}};
 return handler(req,response).then(()=>({status:response.statusCode,body:response.json,headers:response.headers}));
}
function expectStatus(result,status){assert.equal(result.status,status,'Unexpected HTTP: '+JSON.stringify(result.body));return result.body}
function cookieFrom(result){
 const header=result.headers['set-cookie'];
 assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);
 assert.match(header,/Secure/);
 return header.split(';')[0];
}
test('end-to-end PostgreSQL: identity, CRUD, roles, version control, archive, password rotation', {timeout:30000}, async()=>{
 try{
  const health=await makeRequest('health');assert.equal(expectStatus(health,200).ok,true);
  expectStatus(await makeRequest('clients'),401);
  expectStatus(await makeRequest('clients',{method:'POST',payload:{name:'Should not create'},headers:{'x-civolten-request':''}}),403);
  const registered=await makeRequest('auth/bootstrap',{method:'POST',payload:{bootstrap_secret:bootSecret,login,password:originalPassword}});
  expectStatus(registered,201);
  expectStatus(await makeRequest('auth/bootstrap',{method:'POST',payload:{bootstrap_secret:bootSecret,login:'second.admin',password:originalPassword}}),409);
  expectStatus(await makeRequest('auth/login',{method:'POST',payload:{login,password:'bad-password'}}),401);
  const first=await makeRequest('auth/login',{method:'POST',payload:{login,password:originalPassword}});
  const adminCookie=cookieFrom(first);assert.equal(expectStatus(first,200).user.role,'administrador');
  assert.equal(first.body.user.must_change_password,true);
  const second=await makeRequest('auth/login',{method:'POST',payload:{login,password:originalPassword}});
  const secondaryCookie=cookieFrom(second);
  assert.equal(expectStatus(await makeRequest('auth/status',{session:adminCookie}),200).authenticated,true);
  expectStatus(await makeRequest('clients',{session:adminCookie}),403);
  expectStatus(await makeRequest('auth/change-password',{method:'POST',session:adminCookie,payload:{
    current_password:originalPassword,new_password:nextPassword
  }}),200);
  expectStatus(await makeRequest('clients',{session:secondaryCookie}),401);
  assert.equal(expectStatus(await makeRequest('auth/status',{session:adminCookie}),200).user.must_change_password,false);
  const client=expectStatus(await makeRequest('clients',{method:'POST',session:adminCookie,payload:{
    name:'QA - Pessoa jurídica fictícia',tax_id:'11.222.333/0001-81',
    phone:'11900000000',email:'qa@example.test',address:'Rua fictícia, 100'
  }}),201);
  assert.ok(client.id);
  assert.equal(client.tax_id,'11222333000181');
  const updated=expectStatus(await makeRequest('clients/'+client.id,{method:'PUT',session:adminCookie,payload:{...client,name:'QA - Cliente revisado'}}),200);
  assert.equal(updated.name,'QA - Cliente revisado');
  assert.equal(expectStatus(await makeRequest('clients',{session:adminCookie}),200).length,1);
  const project=expectStatus(await makeRequest('projects',{method:'POST',session:adminCookie,payload:{
    client_id:client.id,title:'Obra fictícia de integração',address:'Rua de QA, 50'
  }}),201);
  assert.equal(project.client_id,client.id);
  const editedProject=expectStatus(await makeRequest('projects/'+project.id,{method:'PUT',session:adminCookie,payload:{
    client_id:client.id,title:'Obra QA revisada',address:'Rua QA, 200'
  }}),200);
  assert.equal(editedProject.title,'Obra QA revisada');
  const budget=expectStatus(await makeRequest('budgets',{method:'POST',session:adminCookie,payload:{
    client_id:client.id,project_id:project.id,title:'Orçamento fictício 001',
    reference_month:'2026-07',regime:'Sem desoneração',bdi_pct:25
  }}),201);
  assert.match(budget.code,/ORC-/);
  const item=expectStatus(await makeRequest('budgets/'+budget.id+'/items',{method:'POST',session:adminCookie,payload:{
    position:1,source_name:'Serviço fictício testado',source_code:'QA-1',unit:'m²',quantity:10,direct_unit_cost:30.25
  }}),201);
  assert.ok(item.id);
  let detail=expectStatus(await makeRequest('budgets/'+budget.id,{session:adminCookie}),200);
  assert.equal(detail.items.length,1);assert.equal(Number(detail.items[0].quantity),10);
  const oldVersion=detail.lock_version;
  const changes={...detail,client_id:client.id,project_id:project.id,title:'Orçamento fictício revisado',
    reference_month:'2026-07',regime:'Sem desoneração',bdi_pct:24,lock_version:oldVersion};
  const revised=expectStatus(await makeRequest('budgets/'+budget.id,{method:'PUT',session:adminCookie,payload:changes}),200);
  assert.equal(revised.lock_version,oldVersion+1);
  expectStatus(await makeRequest('budgets/'+budget.id,{method:'PUT',session:adminCookie,payload:changes}),409);
  const editedItem=expectStatus(await makeRequest('budgets/'+budget.id+'/items/'+item.id,{method:'PUT',session:adminCookie,payload:{
    position:1,source_name:'Serviço QA atualizado',source_code:'QA-1',unit:'m²',quantity:12,direct_unit_cost:30.25
  }}),200);
  assert.equal(Number(editedItem.quantity),12);
  const removed=expectStatus(await makeRequest('budgets/'+budget.id+'/items/'+item.id,{method:'DELETE',session:adminCookie}),200);
  assert.equal(removed.ok,true);
  detail=expectStatus(await makeRequest('budgets/'+budget.id,{session:adminCookie}),200);
  const archivedDatabaseState=await pool.query('SELECT id,deleted_at IS NOT NULL AS archived FROM budget_items');
  assert.equal(detail.items.length,0,JSON.stringify({rows:detail.items.map(x=>({id:x.id,deleted_at:x.deleted_at})),db:archivedDatabaseState.rows}));
  assert.equal(detail.status,'rascunho','Remover item não deve cancelar orçamento');
  assert.equal(archivedDatabaseState.rows[0]?.archived,true);
  const staff=expectStatus(await makeRequest('users',{method:'POST',session:adminCookie,payload:{
    login:'ci.viewer@civolten.test',role:'consulta',password:originalPassword
  }}),201);
  assert.equal(staff.role,'consulta');
  const staffLogin=await makeRequest('auth/login',{method:'POST',payload:{
    login:'ci.viewer@civolten.test',password:originalPassword
  }});
  const viewerCookie=cookieFrom(staffLogin);
  assert.equal(expectStatus(staffLogin,200).user.must_change_password,true);
  expectStatus(await makeRequest('clients',{session:viewerCookie}),403);
  expectStatus(await makeRequest('auth/change-password',{method:'POST',session:viewerCookie,payload:{
    current_password:originalPassword,new_password:viewerPassword
  }}),200);
  expectStatus(await makeRequest('clients',{session:viewerCookie}),200);
  expectStatus(await makeRequest('clients',{session:viewerCookie,method:'POST',payload:{name:'blocked'}}),403);
  expectStatus(await makeRequest('users',{session:viewerCookie}),403);
  expectStatus(await makeRequest('users/'+staff.id,{session:adminCookie,method:'PUT',payload:{role:'consulta',is_active:false}}),200);
  expectStatus(await makeRequest('clients',{session:viewerCookie}),401);
  const secondAdmin=await makeRequest('auth/login',{method:'POST',payload:{login,password:nextPassword}});
  const activeSecondaryCookie=cookieFrom(secondAdmin);
  const changedPass=expectStatus(await makeRequest('auth/change-password',{method:'POST',session:adminCookie,payload:{
    current_password:nextPassword,new_password:finalPassword
  }}),200);
  assert.equal(changedPass.ok,true);
  expectStatus(await makeRequest('clients',{session:activeSecondaryCookie}),401);
  expectStatus(await makeRequest('clients',{session:adminCookie}),200);
  expectStatus(await makeRequest('auth/login',{method:'POST',payload:{login,password:nextPassword}}),401);
  const renewed=await makeRequest('auth/login',{method:'POST',payload:{login,password:finalPassword}});
  const newCookie=cookieFrom(renewed);
  expectStatus(await makeRequest('budgets/'+budget.id,{method:'DELETE',session:newCookie}),200);
  expectStatus(await makeRequest('auth/logout',{method:'POST',session:newCookie,payload:{}}),200);
  expectStatus(await makeRequest('clients',{session:newCookie}),401);
  const audit=await pool.query("SELECT entity_type, action FROM audit_events WHERE entity_type IN ('clients','projects','budgets','budget_items','app_users') ORDER BY created_at");
  assert.ok(audit.rows.length>=13,'Expected write audit trail');
  const counts=await pool.query("SELECT (SELECT count(*)::int FROM clients) clients,(SELECT count(*)::int FROM projects) projects,(SELECT count(*)::int FROM budgets) budgets,(SELECT count(*)::int FROM budget_items) items");
  assert.deepEqual(counts.rows[0],{clients:1,projects:1,budgets:1,items:1});
 }finally{
  await pool.end();
 }
});
}
