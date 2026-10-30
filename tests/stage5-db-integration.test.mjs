import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {createApi} from '../api/index.mjs';
const url=process.env.CIVOLTEN_TEST_DATABASE_URL;
const allow=!!url&&/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:127\.0\.0\.1|localhost):5432\/civolten_test(?:\?.*)?$/.test(url);
if(!allow)test.skip('Readiness QA requer PostgreSQL localhost descartável',()=>{});
else{
 const pool=new pg.Pool({connectionString:url,max:2});
 const sql={query:async(s,a=[])=> (await pool.query(s,a)).rows};
 const api=createApi(sql);
 const ids=[randomUUID(),randomUUID()];
 const tokens=ids.map(()=>randomUUID().replaceAll('-','').repeat(2));
 async function call(index,method='GET'){
  const req=Readable.from([]);
  req.url='/api/v1/release-readiness';
  req.method=method;req.headers={host:'localhost:3000',...(index===null?{}:{cookie:'civolten_dev_session='+tokens[index]})};
  const res={statusCode:200,setHeader(){},end(v){this.body=JSON.parse(v)}};
  await api(req,res);return {status:res.statusCode,body:res.body};
 }
 test('Etapa 5: diagnóstico requer admin e nega publicação comercial mesmo com esquema QA completo',{timeout:20000},async()=>{
  try{
   for(let i=0;i<ids.length;i++){
    await sql.query("INSERT INTO app_users(id,login,password_hash,role,must_change_password) VALUES($1,$2,'ci-only',$3,false)",
     [ids[i],'stage5.qa.'+ids[i]+'@example.test',i===0?'administrador':'consulta']);
    await sql.query("INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '2 hours')",
     [createHash('sha256').update(tokens[i]).digest('hex'),ids[i]]);
   }
   assert.equal((await call(null)).status,401);
   assert.equal((await call(1)).status,403);
   const admin=await call(0);
   assert.equal(admin.status,200,JSON.stringify(admin.body));
   assert.equal(admin.body.schema.ready,true,JSON.stringify(admin.body.schema));
   assert.equal(admin.body.gates.commercial_release,false);
   assert.equal(admin.body.commercial_release,false);
   assert.ok(admin.body.gates.failed.some(x=>x.key==='tax_and_bdi_approved'));
   assert.equal((await call(0,'POST')).status,403);
  }finally{await pool.end()}
 });
}
