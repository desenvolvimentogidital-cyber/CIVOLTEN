import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../api/index.mjs';
import {Readable} from 'node:stream';
const token='a'.repeat(64);
const me={id:'c80c7b18-a2d1-4c62-938e-00a388c027b6',login:'fake@example.test',role:'consulta'};
function request(route,{method='GET',user=null,body=null,headers={}}={}){
 const stream=Readable.from(body? [Buffer.from(JSON.stringify(body))]:[]);
 stream.url='/api/v1/'+route;
 stream.method=method;
 stream.headers={host:'civolten-gj91.vercel.app',cookie:user?'civolten_dev_session='+token:'',...(body?{'content-type':'application/json'}:{}),...(method!=='GET'?{'x-civolten-request':'1'}:{}),...headers};
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v},end(value){this.json=JSON.parse(value)}};
 const statements=[];
 const sql={async query(statement,args){
   statements.push({statement,args});
   if(statement.includes('FROM app_sessions s'))return [user];
   if(statement.includes('SELECT id,login,role,is_active,must_change_password,created_at,last_login_at FROM app_users'))return [];
   throw Error('Unexpected query in isolated route test: '+statement);
 }};
 return createApi(sql)(stream,res).then(()=>({status:res.statusCode,json:res.json,statements}));
}
test('Non-admin cannot list users',async()=>{
 const r=await request('users',{user:me});
 assert.equal(r.status,403);
 assert.equal(r.statements.length,1);
});
test('Non-admin cannot create users or promote roles',async()=>{
 const r=await request('users',{method:'POST',user:me,body:{login:'attack',role:'administrador',password:'abcdefghijklmnop'}});
 assert.equal(r.status,403);
 assert.equal(r.statements.length,1);
});
test('Anonymous cannot inspect users or run admin routes',async()=>{
 const r=await request('users');
 assert.equal(r.status,401);
});
test('Admin lists users without password hashes',async()=>{
 const r=await request('users',{user:{...me,role:'administrador'}});
 assert.equal(r.status,200);
 assert.deepEqual(r.json,[]);
 assert.equal(r.statements.length,2);
});
test('Admin cannot deactivate own account or change own role',async()=>{
 const r=await request('users/'+me.id,{method:'PUT',user:{...me,role:'administrador'},body:{role:'consulta',is_active:false}});
 assert.equal(r.status,409);
});
test('Admin cannot elevate newly created user directly',async()=>{
 const r=await request('users',{method:'POST',user:{...me,role:'administrador'},body:{login:'other@example.com',role:'administrador',password:'abcdefghijklmnop'}});
 assert.equal(r.status,400);
});
