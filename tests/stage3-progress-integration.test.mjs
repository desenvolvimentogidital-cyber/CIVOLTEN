import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {createApi} from '../api/index.mjs';

const db=process.env.CIVOLTEN_TEST_DATABASE_URL;
const allowed=!!db&&/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:127\.0\.0\.1|localhost):5432\/civolten_test(?:\?.*)?$/.test(db);
if(!allowed)test.skip('Etapa 3 medições só com PostgreSQL descartável da CI',()=>{});
else{
 const pool=new pg.Pool({connectionString:db,max:3});
 const sql={query:async(s,args=[])=> (await pool.query(s,args)).rows};
 const api=createApi(sql);
 const admin=randomUUID(),writer=randomUUID(),reviewer=randomUUID(),viewer=randomUUID();
 const client=randomUUID(),project=randomUUID(),budget=randomUUID(),crew=randomUUID(),task=randomUUID();
 const roles=['administrador','orcamentista','revisor','consulta'],users=[admin,writer,reviewer,viewer];
 const tokens=roles.map(()=>randomUUID().replaceAll('-','').repeat(2));
 async function call(index,path,method='GET',payload){
  const req=Readable.from(payload===undefined?[]:[Buffer.from(JSON.stringify(payload))]);
  req.method=method;req.url='/api/v1/'+path;
  req.headers={host:'localhost:3000',cookie:'civolten_dev_session='+tokens[index],
   ...(method!=='GET'?{'x-civolten-request':'1'}:{}),
   ...(payload===undefined?{}:{'content-type':'application/json'})};
  const res={statusCode:200,setHeader(){},end(body){this.body=JSON.parse(body)}};
  await api(req,res);
  return {status:res.statusCode,body:res.body};
 }
 const must=(x,expected)=>{assert.equal(x.status,expected,JSON.stringify(x.body));return x.body};
 test('Etapa 3: medição real pendente, validação por revisor, rejeição e produtividade sem fictícios', {timeout:35000},async()=>{
  try{
   for(let i=0;i<4;i++){
    await sql.query("INSERT INTO app_users(id,login,password_hash,role,must_change_password) VALUES($1,$2,'qa-only',$3,false)",
     [users[i],'qa-progress-'+users[i]+'@example.test',roles[i]]);
    await sql.query("INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '2 hours')",
     [createHash('sha256').update(tokens[i]).digest('hex'),users[i]]);
   }
   await sql.query("INSERT INTO clients(id,name) VALUES($1,'CLIENTE DE TESTES EXECUÇÃO 2026')",[client]);
   await sql.query("INSERT INTO projects(id,client_id,title) VALUES($1,$2,'Obra fictícia execução')",[project,client]);
   await sql.query("INSERT INTO budgets(id,code,client_id,project_id,title,reference_month,regime,bdi_pct,created_by) VALUES($1,$2,$3,$4,'Diário de obra QA','2026-07','Sem desoneração',0,$5)",
    [budget,'QA-PROG-'+budget.slice(0,7),client,project,admin]);
   await sql.query("INSERT INTO crews(id,budget_id,title,workday_hours,efficiency) VALUES($1,$2,'Equipe Civil 2',8,0.8)",[crew,budget]);
   await sql.query("INSERT INTO schedule_tasks(id,budget_id,crew_id,title,days_estimated,duration_review_state) VALUES($1,$2,$3,'Aplicação de revestimento QA',5,'revisado')",[task,budget,crew]);
   const route='budgets/'+budget+'/schedule-progress';
   must(await call(3,route,'POST',{lock_version:0,task_id:task}),403);
   const payload={lock_version:0,task_id:task,worked_on:'2026-10-28',
    completed_quantity:'12.5000',workers:2,hours_per_worker:'7.5000',
    evidence_ref:'DIARIO-TESTE-2026-28',evidence_notes:'Medição de execução inteiramente fictícia, em QA'};
   must(await call(1,route,'POST',{...payload,worked_on:'2026-11-29'}),409);
   must(await call(1,route,'POST',{...payload,hours_per_worker:'13'}),400);
   const a=must(await call(1,route,'POST',payload),201);
   assert.equal(a.review_status,'pendente');
   assert.equal(Number(a.actual_person_hours),15);
   must(await call(1,route,'POST',payload),409);
   let report=must(await call(3,route),200);
   assert.equal(report.summaries[0].validated_person_hours,0);
   assert.equal(report.summaries[0].completed_quantity,0);
   assert.equal(report.summaries[0].pending_evidence_count,1);
   must(await call(1,route+'/'+a.id,'PUT',{lock_version:1,review_status:'validado',
     review_notes:'Técnico em QA confirmou os valores e diário.'}),403);
   must(await call(2,route+'/'+a.id,'PUT',{lock_version:0,review_status:'validado',
     review_notes:'Aprovação fictícia com versão errada'}),409);
   must(await call(2,route+'/'+a.id,'PUT',{lock_version:1,review_status:'validado',
     review_notes:'Revisão de produtividade fictícia por responsável em QA'}),200);
   report=must(await call(3,route),200);
   assert.equal(report.summaries[0].validated_person_hours,15);
   assert.equal(report.summaries[0].completed_quantity,12.5);
   assert.equal(report.summaries[0].observed_hh_per_unit,1.2);
   assert.equal(report.summaries[0].pending_evidence_count,0);
   must(await call(2,route+'/'+a.id,'PUT',{lock_version:2,review_status:'rejeitado',
     review_notes:'Não aceitar revisão repetida mesmo por responsável'}),409);
   const b=must(await call(1,route,'POST',{...payload,lock_version:2,worked_on:'2026-10-27',
     completed_quantity:'8',evidence_ref:'DIARIO-TESTE-2026-27'}),201);
   must(await call(2,route+'/'+b.id,'PUT',{lock_version:3,review_status:'rejeitado',
     review_notes:'Registro de teste rejeitado por inconsistência de evidência'}),200);
   report=must(await call(0,route),200);
   assert.equal(report.measurements.length,2);
   assert.equal(report.summaries[0].completed_quantity,12.5);
   assert.equal(report.summaries[0].validated_person_hours,15);
   assert.equal(report.commercial_release,false);
   const records=await sql.query("SELECT action FROM audit_events WHERE entity_type='schedule_progress_measurements' AND entity_id IN ($1,$2)",[a.id,b.id]);
   assert.equal(records.length,4);
   // A listagem exibe somente os 200 registros recentes; o total não pode perder
   // nem um dos registros mais antigos (prevenção de truncamento silencioso).
   await sql.query(`INSERT INTO schedule_progress_measurements
      (id,budget_id,task_id,worked_on,completed_quantity,workers,hours_per_worker,
       evidence_ref,evidence_notes,review_status,created_by,reviewed_by,reviewed_at,review_notes)
      SELECT gen_random_uuid(),$1,$2,DATE '2025-01-01'+n,1,1,1,
       'QA-2025-REGISTRO-'||n,
       'Medição sintética gerada apenas para testar paginação',
       'validado',$3,$4,now(),'Aprovação sintética de volume em ambiente de teste'
      FROM generate_series(1,205) AS n`,[budget,task,writer,reviewer]);
   report=must(await call(3,route),200);
   assert.equal(report.measurements.length,200);
   assert.equal(report.totals_include_full_history,true);
   assert.equal(report.summaries[0].completed_quantity,217.5);
   assert.equal(report.summaries[0].validated_person_hours,220);
  }finally{await pool.end()}
 });
}
