import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createApi} from '../api/index.mjs';
import {protectedTables} from '../src/tenant-db-guard.mjs';
const orgA='11111111-1111-4111-8111-111111111111',orgB='22222222-2222-4222-8222-222222222222';
const userA={id:'33333333-3333-4333-8333-333333333333',login:'admin-a@example.test',
 organization_id:orgA,role:'administrador',must_change_password:false};
const other={id:'44444444-4444-4444-8444-444444444444',login:'admin-b@example.test',
 organization_id:orgB,role:'orcamentista',must_change_password:false};
const policies=protectedTables.map(table_name=>({table_name,rls_enabled:true,rls_forced:true,has_policy:true}));
function mock(role={rolsuper:false,rolbypassrls:false}){
 const queries=[],transactions=[],emails=[];
 const sql={
  async query(q,args=[]){
   queries.push({q,args});
   if(q.includes('FROM app_sessions s'))return [userA];
   if(q.includes('FROM pg_roles WHERE rolname=current_user'))return [role];
   if(q.includes('FROM pg_class c JOIN pg_namespace'))return policies;
   if(q.includes('FROM app_users WHERE organization_id=$1'))return args[0]===orgA?[userA]:[];
   if(q.includes("UPDATE app_users SET role="))return [];
   if(q.includes('FROM auth_signup_attempts'))return [{attempts:0}];
   if(q.includes('SELECT set_config'))return [{set_config:args[0]}];
   if(q.includes('INSERT INTO organizations'))return [{id:args[0]}];
   if(q.includes('INSERT INTO app_users'))return [{id:args[0]}];
   if(q.includes('INSERT INTO audit_events'))return [];
   if(q.includes('INSERT INTO auth_signup_attempts'))return [];
   return [];
  },
  async transaction(batch){transactions.push(batch);return Promise.all(batch);}
 };
 return {sql,queries,transactions,emails,sender:async args=>{emails.push(args);return {accepted:true}}};
}
async function request(db,route,method='GET',body=null,opts={}){
 const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);
 req.url='/api/v1/'+route;req.method=method;
 req.headers={host:'localhost:3000',
  ...(route!=='auth/signup'?{cookie:'civolten_dev_session='+'a'.repeat(64)}:{}),
  ...(body?{'content-type':'application/json'}:{}),
  ...(method!=='GET'?{'x-civolten-request':'1'}:{})};
 const res={statusCode:200,setHeader(){},end(text){this.json=JSON.parse(text)}};
 await createApi(db.sql,{...opts,sendAccountEmail:opts.sendAccountEmail||db.sender})(req,res);
 return {status:res.statusCode,body:res.json};
}
test('cadastro aberto fica INDISPONÍVEL por padrão, sem sequer consultar banco',async()=>{
 const db=mock(),r=await request(db,'auth/signup','POST',{organization_name:'Empresa A',login:'a@example.test',password:'abcdefghijkl'}, {multiTenant:false});
 assert.equal(r.status,503);assert.equal(r.body.code,'SIGNUP_NOT_RELEASED');
 assert.equal(db.transactions.length,0);
});
test('role PostgreSQL BYPASSRLS bloqueia qualquer cadastro mesmo com flags QA habilitadas',async()=>{
 const db=mock({rolsuper:false,rolbypassrls:true});
 const r=await request(db,'auth/signup','POST',{organization_name:'Empresa A',login:'a@example.test',password:'abcdefghijkl'},
  {multiTenant:true,signupEnabled:true});
 assert.equal(r.status,503);assert.equal(r.body.code,'TENANT_DB_NOT_ISOLATED');
 assert.equal(db.transactions.length,0);
});
test('administrador A vê usuários apenas de sua organização',async()=>{
 const db=mock();
 const r=await request(db,'users','GET',null,{multiTenant:true});
 assert.equal(r.status,200);
 assert.equal(r.body.length,1);
 assert.equal(r.body[0].organization_id,orgA);
 assert.equal(db.transactions.length,1);
 const q=db.queries.find(x=>x.q.includes('FROM app_users WHERE organization_id=$1'));
 assert.equal(q.args[0],orgA);
});
test('administrador A não pode alterar usuário B por identificador conhecido',async()=>{
 const db=mock();
 const r=await request(db,'users/'+other.id,'PUT',{role:'revisor',is_active:false},{multiTenant:true});
 assert.equal(r.status,404);
 assert.equal(db.queries.find(x=>x.q.includes('UPDATE app_users SET role=')).args.at(-1),orgA);
});
test('cadastro QA com flags exige organização, email, senha forte e transação de quatro operações',async()=>{
 const db=mock();
 const r=await request(db,'auth/signup','POST',{
  organization_name:'Empresa A',login:'contato@example.test',password:'senha-forte-de-qa-123'
 },{multiTenant:true,signupEnabled:true});
 assert.equal(r.status,202,JSON.stringify(r.body));
 assert.equal(r.body.verification_required,true);
 assert.equal(db.emails.length,1);
 assert.equal(db.emails[0].kind,'verify');
 assert.equal(db.emails[0].to,'contato@example.test');
 assert.doesNotMatch(JSON.stringify(r.body),/token|password_hash/);
 assert.equal(r.body.verification_required,true);
 assert.equal(r.body.account_created,undefined);
 assert.equal(db.transactions.length,1);
 assert.equal(db.transactions[0].length,5);
 const sqlTexts=db.queries.map(x=>x.q);
 assert.ok(sqlTexts.some(x=>x.includes('SELECT set_config')));
 assert.ok(sqlTexts.some(x=>x.includes('INSERT INTO organizations')));
 assert.ok(sqlTexts.some(x=>x.includes('INSERT INTO app_users')));
 assert.ok(sqlTexts.some(x=>x.includes('INSERT INTO audit_events')));
});
