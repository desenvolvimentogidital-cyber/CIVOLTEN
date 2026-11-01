import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import pg from 'pg';
import {createApi} from '../api/index.mjs';
const uri=process.env.CIVOLTEN_TEST_DATABASE_URL;
if(!uri||!/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:127\.0\.0\.1|localhost):5432\/civolten_test(?:\?.*)?$/.test(uri)){
 test.skip('Account verification QA only runs against isolated PostgreSQL local test service',()=>{});
}else{
 const owner=new pg.Pool({connectionString:uri,max:2});
 function scoped(pool){
  return {
   query(statement,args=[]){
    // neon() returns deferred query promises; simulate that behaviour exactly
    // so transaction([query(...),query(...)]) stays on a single connection.
    return {statement,args,
     then(resolve,reject){return pool.query(statement,args).then(result=>resolve(result.rows),reject)}};
   },
   async transaction(queries){
    const conn=await pool.connect(),results=[];
    try{
     await conn.query('BEGIN');
     for(const q of queries)results.push((await conn.query(q.statement,q.args)).rows);
     await conn.query('COMMIT');return results;
    }catch(e){await conn.query('ROLLBACK');throw e}
    finally{conn.release()}
   }
  };
 }
 function http(db,route,method='GET',data=null,cookie='',mail){
  const req=Readable.from(data?[Buffer.from(JSON.stringify(data))]:[]);
  req.url='/api/v1/'+route;req.method=method;
  req.headers={host:'localhost:3000',...(cookie?{cookie}:{ }),
   ...(method!=='GET'?{'x-civolten-request':'1'}:{}),
   ...(data?{'content-type':'application/json'}:{})};
  const res={statusCode:200,headers:{},setHeader(key,value){this.headers[key.toLowerCase()]=value},
   end(body){this.body=JSON.parse(body)}};
  return createApi(db,{multiTenant:true,signupEnabled:true,sendAccountEmail:mail})(req,res)
    .then(()=>({status:res.statusCode,body:res.body,headers:res.headers}));
 }
 test('signup A/B -> verifica email -> login -> orçamento isolado -> recuperação -> sessão revogada', {timeout:45000},async()=>{
  const role='civolten_email_qa',password='only-ci-disposable-qa';
  let pool;
  const emails=[];
  const deliver=async ({to,kind,token})=>{emails.push({to,kind,token});return {accepted:true}};
  try{
   await owner.query("CREATE ROLE civolten_email_qa LOGIN PASSWORD 'only-ci-disposable-qa' NOBYPASSRLS");
   await owner.query('GRANT CONNECT ON DATABASE civolten_test TO civolten_email_qa');
   await owner.query('GRANT USAGE ON SCHEMA public TO civolten_email_qa');
   await owner.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO civolten_email_qa');
   await owner.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO civolten_email_qa');
   const restricted=new URL(uri);restricted.username=role;restricted.password=password;
   pool=new pg.Pool({connectionString:restricted.href,max:3});
   const db=scoped(pool);
   const loginA='conta-a-qa@example.test',loginB='conta-b-qa@example.test';
   const passA='senha-forte-qa-A-123',passB='senha-forte-qa-B-123';
   const signupA=await http(db,'auth/signup','POST',{organization_name:'Empresa A QA',login:loginA,password:passA},'',deliver);
   assert.equal(signupA.status,202,JSON.stringify(signupA.body));
   assert.equal(signupA.body.verification_required,true);
   assert.equal(emails.length,1);
   assert.equal(emails[0].kind,'verify');
   assert.equal(JSON.stringify(signupA.body).includes(emails[0].token),false);
   let before=await http(db,'auth/login','POST',{login:loginA,password:passA},'',deliver);
   assert.equal(before.status,401,'Cadastro pendente não pode entrar');
   assert.equal((await http(db,'auth/verify-email','POST',{token:'0'.repeat(64)},'',deliver)).status,400);
   let verified=await http(db,'auth/verify-email','POST',{token:emails[0].token},'',deliver);
   assert.equal(verified.status,200,JSON.stringify(verified.body));
   assert.equal((await http(db,'auth/verify-email','POST',{token:emails[0].token},'',deliver)).status,400,'token de uso único');
   const logged=await http(db,'auth/login','POST',{login:loginA,password:passA},'',deliver);
   assert.equal(logged.status,200,JSON.stringify(logged.body));
   const sessionA=logged.headers['set-cookie'];
   assert.match(sessionA,/HttpOnly/);
   assert.equal(logged.body.user.role,'administrador');
   const signupB=await http(db,'auth/signup','POST',{organization_name:'Empresa B QA',login:loginB,password:passB},'',deliver);
   assert.equal(signupB.status,202);
   assert.equal((await http(db,'auth/verify-email','POST',{token:emails[1].token},'',deliver)).status,200);
   const loginBResponse=await http(db,'auth/login','POST',{login:loginB,password:passB},'',deliver);
   assert.equal(loginBResponse.status,200);
   const sessionB=loginBResponse.headers['set-cookie'];
   const clientsA=await http(db,'clients','POST',{name:'Cliente exclusivamente A'},sessionA,deliver);
   assert.equal(clientsA.status,201,JSON.stringify(clientsA.body));
   const cross=await http(db,'clients/'+clientsA.body.id,'GET',null,sessionB,deliver);
   assert.equal(cross.status,404,'empresa B não pode consultar cliente A por UUID');
   const onlyB=await http(db,'clients','GET',null,sessionB,deliver);
   assert.deepEqual(onlyB.body,[]);
   const resetStart=await http(db,'auth/request-reset','POST',{login:loginA},'',deliver);
   assert.equal(resetStart.status,202);
   assert.equal(emails[2].kind,'reset');
   const reset=await http(db,'auth/reset-password','POST',{token:emails[2].token,new_password:'nova-senha-QA-a-987'},'',deliver);
   assert.equal(reset.status,200,JSON.stringify(reset.body));
   assert.equal((await http(db,'auth/reset-password','POST',{token:emails[2].token,new_password:'otra-senha-qa-A-987'},'',deliver)).status,400);
   assert.equal((await http(db,'auth/login','POST',{login:loginA,password:passA},'',deliver)).status,401);
   assert.equal((await http(db,'clients','GET',null,sessionA,deliver)).status,401,'sessões antigas revogadas');
   assert.equal((await http(db,'auth/login','POST',{login:loginA,password:'nova-senha-QA-a-987'},'',deliver)).status,200);
  }finally{
   await pool?.end();
   await owner.end();
  }
 });
}
