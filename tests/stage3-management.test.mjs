import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {createApi} from '../api/index.mjs';
const url=process.env.CIVOLTEN_TEST_DATABASE_URL;
const allowed=url&&/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:127\.0\.0\.1|localhost):5432\/civolten_test(?:\?.*)?$/.test(url);
if(!allowed){test.skip('Etapa 3 CRUD requer banco descartável da CI',()=>{})}
else{
const pool=new pg.Pool({connectionString:url,max:2});
const sql={query:async(s,args=[])=> (await pool.query(s,args)).rows};
const handler=createApi(sql);
const adminId=randomUUID(),plannerId=randomUUID(),reviewerId=randomUUID();
const clientId=randomUUID(),projectId=randomUUID(),budgetId=randomUUID();
const tokens=[randomUUID().replaceAll('-','').repeat(2),randomUUID().replaceAll('-','').repeat(2),randomUUID().replaceAll('-','').repeat(2)];
async function request(roleIndex,route,method='GET',payload){
 const req=Readable.from(payload===undefined?[]:[Buffer.from(JSON.stringify(payload))]);
 req.method=method;req.url='/api/v1/'+route;
 req.headers={host:'localhost:3000',cookie:'civolten_dev_session='+tokens[roleIndex],
  ...(method!=='GET'?{'x-civolten-request':'1'}:{}),
  ...(payload===undefined?{}:{'content-type':'application/json'})};
 const res={statusCode:200,setHeader(){},end(text){this.body=JSON.parse(text)}};
 await handler(req,res);return {status:res.statusCode,body:res.body};
}
const must=(x,status)=>{assert.equal(x.status,status,JSON.stringify(x.body));return x.body};
test('Etapa 3: CRUD seguro, equipes, revisão de duração, ciclos e versões', {timeout:30000},async()=>{
 try{
  for(const [i,userId,role] of [[0,adminId,'administrador'],[1,plannerId,'orcamentista'],[2,reviewerId,'revisor']]){
   await sql.query("INSERT INTO app_users(id,login,password_hash,role,must_change_password) VALUES($1,$2,'ci-placeholder',$3,false)",
    [userId,'stage3-'+userId+'@example.test',role]);
   await sql.query("INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [createHash('sha256').update(tokens[i]).digest('hex'),userId]);
  }
  await sql.query("INSERT INTO clients(id,name) VALUES($1,'Cliente 100% fictício cronograma QA')",[clientId]);
  await sql.query("INSERT INTO projects(id,client_id,title) VALUES($1,$2,'Obra QA Etapa 3')",[projectId,clientId]);
  await sql.query("INSERT INTO budgets(id,code,client_id,project_id,title,reference_month,regime,bdi_pct,created_by) VALUES($1,$2,$3,$4,'QA cronograma operável','2026-07','Sem desoneração',0,$5)",
   [budgetId,'QA3-'+budgetId.slice(0,8),clientId,projectId,adminId]);
  const base='budgets/'+budgetId+'/';
  let plan=must(await request(0,base+'schedule-plan'),200);
  assert.equal(plan.crews.length,0);
  assert.equal(plan.budget.lock_version,0);
  const first=must(await request(1,base+'schedule-crews','POST',{lock_version:0,title:'Civil',
    workday_hours:8,efficiency:0.8,role_code:'pedreiro',role_name:'Pedreiro',workers:2}),201);
  must(await request(1,base+'schedule-crews','POST',{lock_version:0,title:'Duplicação',
    workday_hours:8,efficiency:0.9,role_code:'pintor',role_name:'Pintor',workers:2}),409);
  const second=must(await request(1,base+'schedule-crews','POST',{lock_version:1,title:'Elétrica',
    workday_hours:8,efficiency:0.9,role_code:'eletricista',role_name:'Eletricista',workers:2}),201);
  plan=must(await request(0,base+'schedule-plan'),200);
  assert.equal(plan.crews.length,2);
  assert.equal(plan.crews[0].roles.length,1);
  const a=must(await request(1,base+'schedule-tasks','POST',{lock_version:2,title:'Pintura',
    crew_id:first.id,duration_workdays:2}),201);
  const b=must(await request(1,base+'schedule-tasks','POST',{lock_version:3,title:'Instalação elétrica',
    crew_id:second.id,duration_workdays:3}),201);
  const c=must(await request(1,base+'schedule-tasks','POST',{lock_version:4,title:'Acabamento',
    crew_id:first.id,duration_workdays:1}),201);
  assert.equal(a.duration_review_state,'pendente');
  must(await request(1,base+'schedule-tasks/'+a.id,'PUT',{
    lock_version:5,duration_workdays:2,review_note:'Premissas testadas, totalmente fictícias'}),403);
  must(await request(2,base+'schedule-tasks/'+a.id,'PUT',{
    lock_version:5,duration_workdays:2,review_note:'Equipe validada em QA por revisor fictício'}),200);
  must(await request(2,base+'schedule-tasks/'+b.id,'PUT',{
    lock_version:6,duration_workdays:3,review_note:'Jornada e recursos testados em ambiente QA'}),200);
  must(await request(2,base+'schedule-tasks/'+c.id,'PUT',{
    lock_version:7,duration_workdays:1,review_note:'Duração manual de teste verificada em QA'}),200);
  const edge=must(await request(1,base+'schedule-dependencies','POST',{
    lock_version:8,predecessor_id:a.id,successor_id:c.id}),201);
  assert.equal(edge.dependency_type,'FS');
  must(await request(1,base+'schedule-dependencies','POST',{
    lock_version:9,predecessor_id:c.id,successor_id:a.id}),409);
  const s=must(await request(0,base+'schedule-preview?start_date=2026-11-02&holidays=2026-11-02&safety_pct=25'),200);
  assert.equal(s.schedule.ready,true,JSON.stringify(s.schedule.errors));
  assert.equal(s.schedule.parallel_tasks_possible,true);
  assert.equal(s.schedule.finish,'2026-11-06');
  assert.equal(s.commercial_release,false);
  const final=must(await request(0,base+'schedule-plan'),200);
  assert.equal(final.budget.lock_version,9);
  assert.equal(final.tasks.length,3);
  assert.equal(final.dependencies.length,1);
  const audit=await sql.query("SELECT count(*)::int AS count FROM audit_events WHERE actor_id IN ($1,$2,$3) AND entity_type IN ('crews','schedule_tasks','task_dependencies')",[adminId,plannerId,reviewerId]);
  assert.ok(audit[0].count>=9);
  // Edição só em rascunho, revogação de duração revisada e arquivamento lógico.
  must(await request(1,base+'schedule-tasks/'+a.id,'DELETE',{lock_version:9}),409);
  must(await request(1,base+'schedule-dependencies/'+a.id,'DELETE',{
    lock_version:9,successor_id:c.id}),200);
  must(await request(1,base+'schedule-tasks/'+c.id,'PUT',{
    lock_version:10,action:'edit',title:'Acabamento revisado',
    crew_id:first.id,duration_workdays:2}),200);
  let after=must(await request(0,base+'schedule-plan'),200);
  assert.equal(after.tasks.find(x=>x.id===c.id).duration_review_state,'pendente');
  must(await request(2,base+'schedule-tasks/'+c.id,'PUT',{
    lock_version:11,duration_workdays:2,review_note:'Revisão de prazo em ambiente QA fictício'}),200);
  must(await request(1,base+'schedule-tasks/'+c.id,'DELETE',{lock_version:12}),200);
  must(await request(1,base+'schedule-tasks/'+a.id,'DELETE',{lock_version:13}),200);
  must(await request(1,base+'schedule-crews/'+first.id,'DELETE',{lock_version:14}),200);
  must(await request(1,base+'schedule-crews/'+second.id,'PUT',{
    lock_version:15,title:'Equipe elétrica nova',workday_hours:8,efficiency:0.85}),200);
  must(await request(1,base+'schedule-tasks/'+b.id,'PUT',{
    lock_version:16,action:'edit',title:'Instalação elétrica revisada',
    crew_id:second.id,duration_workdays:3}),200);
  after=must(await request(0,base+'schedule-plan'),200);
  assert.equal(after.budget.lock_version,17);
  assert.equal(after.crews.length,1);
  assert.equal(after.tasks.length,1);
  assert.equal(after.dependencies.length,0);
  assert.equal(after.tasks[0].duration_review_state,'pendente');
  const pending=must(await request(0,base+'schedule-preview?start_date=2026-11-02'),200);
  assert.equal(pending.schedule.ready,false);
  must(await request(2,base+'schedule-tasks/'+b.id,'PUT',{
    lock_version:17,duration_workdays:3,review_note:'Nova revisão de duração após alteração de atividade'}),200);
  const resumed=must(await request(0,base+'schedule-preview?start_date=2026-11-02'),200);
  assert.equal(resumed.schedule.ready,true);
  assert.equal(resumed.schedule.total_workdays,3);
 }finally{await pool.end()}
});
}
