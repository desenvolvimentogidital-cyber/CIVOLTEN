import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {createApi} from '../api/index.mjs';

const db=process.env.CIVOLTEN_TEST_DATABASE_URL;
if(!db||!/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:127\.0\.0\.1|localhost):5432\/civolten_test(?:\?.*)?$/.test(db)){
 test.skip('Stage3 PostgreSQL verification only runs on disposable localhost CI',()=>{});
}else{
 const pool=new pg.Pool({connectionString:db,max:3});
 const sql={async query(query,args=[]){return (await pool.query(query,args)).rows}};
 const token=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');
 const actor=randomUUID(),client=randomUUID(),project=randomUUID(),budget=randomUUID();
 const civil=randomUUID(),electric=randomUUID(),a=randomUUID(),b=randomUUID(),c=randomUUID();
 const api=createApi(sql);
 async function request(route,auth=true){
  const req=Readable.from([]);
  req.url='/api/v1/'+route;req.method='GET';
  req.headers={host:'localhost:3000',...(auth?{cookie:'civolten_dev_session='+token}:{})};
  const res={statusCode:200,setHeader(){},end(s){this.body=JSON.parse(s)}};
  await api(req,res);return {status:res.statusCode,body:res.body};
 }
 test('Etapa 3 PostgreSQL: obra fictícia com equipes paralelas, feriado, alteração e bloqueio', {timeout:30000},async()=>{
  try{
   await sql.query("INSERT INTO app_users(id,login,password_hash,role,must_change_password) VALUES($1,$2,'qa-placeholder','administrador',false)",
    [actor,'stage3.qa.'+actor+'@example.test']);
   await sql.query("INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [createHash('sha256').update(token).digest('hex'),actor]);
   await sql.query("INSERT INTO clients(id,name) VALUES($1,'CLIENTE FICTÍCIO ETAPA 3')",[client]);
   await sql.query("INSERT INTO projects(id,client_id,title) VALUES($1,$2,'Obra fictícia de cronograma')",[project,client]);
   await sql.query("INSERT INTO budgets(id,code,client_id,project_id,title,reference_month,regime,bdi_pct,created_by) VALUES($1,$2,$3,$4,'Orçamento fictício para cronograma','2026-07','Sem desoneração',0,$5)",
     [budget,'QA3-'+budget.slice(0,8),client,project,actor]);
   await sql.query("INSERT INTO crews(id,budget_id,title,workday_hours,efficiency) VALUES ($1,$3,'Equipe civil QA',8,0.9),($2,$3,'Equipe elétrica QA',8,0.85)",[civil,electric,budget]);
   await sql.query("INSERT INTO crew_roles(crew_id,role_code,role_name,workers) VALUES ($1,'pintor','Pintor fictício',2),($2,'eletricista','Eletricista fictício',2)",[civil,electric]);
   await sql.query("INSERT INTO schedule_tasks(id,budget_id,crew_id,title,days_estimated,duration_review_state) VALUES ($1,$4,$5,'Pintura QA',2,'revisado'),($2,$4,$6,'Elétrica QA',3,'validado'),($3,$4,$5,'Acabamento QA',1,'revisado')",
      [a,b,c,budget,civil,electric]);
   await sql.query("INSERT INTO task_dependencies(predecessor_id,successor_id,dependency_type,lag_days) VALUES ($1,$2,'FS',0)",[a,c]);
   assert.equal((await request('budgets/'+budget+'/schedule-preview?start_date=2026-11-02',false)).status,401);
   const path='budgets/'+budget+'/schedule-preview?start_date=2026-11-02&holidays=2026-11-02&safety_pct=25';
   let response=await request(path);
   assert.equal(response.status,200,JSON.stringify(response.body));
   assert.equal(response.body.schedule.ready,true,JSON.stringify(response.body.schedule.errors));
   assert.equal(response.body.schedule.parallel_tasks_possible,true);
   assert.equal(response.body.schedule.total_workdays,4);
   assert.equal(response.body.schedule.finish,'2026-11-06');
   assert.equal(response.body.commercial_release,false);
   await sql.query("UPDATE schedule_tasks SET duration_review_state='pendente' WHERE id=$1",[a]);
   response=await request(path);
   assert.equal(response.body.schedule.ready,false);
   assert.equal(response.body.schedule.finish,null);
   await sql.query("UPDATE schedule_tasks SET duration_review_state='revisado' WHERE id=$1",[a]);
   await sql.query("UPDATE task_dependencies SET lag_days=1 WHERE predecessor_id=$1 AND successor_id=$2",[a,c]);
   response=await request(path);
   assert.equal(response.body.schedule.ready,false,'Lag sem suporte não pode calcular prazo contratual');
  }finally{await pool.end()}
 });
}
