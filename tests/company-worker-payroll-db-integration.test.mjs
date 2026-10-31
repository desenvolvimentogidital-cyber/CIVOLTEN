import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {handleCompanyCosts,readCompanyCosts} from '../src/company-costs-api.mjs';
import {summarizeWorkforce} from '../src/workforce-costing.mjs';

const uri=process.env.CIVOLTEN_TEST_DATABASE_URL;
const localOnly=!!uri&&/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:127\.0\.0\.1|localhost):5432\/civolten_test(?:\?.*)?$/.test(uri);
if(!localOnly)test.skip('Folha de pagamento QA exige PostgreSQL local descartável',()=>{});
else test('Salário real informado, jornada e tarifa de pessoal persistem no PostgreSQL de integração',{timeout:20000},async()=>{
 const pool=new pg.Pool({connectionString:uri,max:1});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const admin=randomUUID();
  await client.query("INSERT INTO app_users(id,login,password_hash,role,must_change_password) VALUES($1,$2,'ci-hash','administrador',false)",
   [admin,'payroll.'+admin+'@example.invalid']);
  const sql={query:async(q,args=[])=> (await client.query(q,args)).rows};
  let status,payload;
  const send=(_res,s,data)=>{status=s;payload=data};
  const req={};
  const base={display_name:'ELETRICISTA QA',role_code:'ELE_QA',role_name:'Eletricista',
   monthly_salary:'4000.00',monthly_additional_cost:'600.00',
   workdays_per_month:'20',hours_per_day:'8'};
  await handleCompanyCosts({req,res:{},sql,user:{id:admin,role:'administrador'},
   parts:['company-costs','workers'],method:'POST',readBody:async()=>base,send});
  assert.equal(status,201,JSON.stringify(payload));
  assert.equal(Number(payload.monthly_employer_cost),4600);
  const rows=await sql.query('SELECT * FROM company_workers WHERE id=$1',[payload.id]);
  assert.equal(rows.length,1);
  assert.equal(Number(rows[0].monthly_salary),4000);
  assert.equal(Number(rows[0].monthly_additional_cost),600);
  assert.equal(rows[0].workdays_per_month,20);
  assert.equal(Number(rows[0].hours_per_day),8);
  const registry=await readCompanyCosts(sql);
  assert.equal(registry.workers.some(x=>x.id===payload.id),true);
  const model={settings:{hours_day:8,target_days:10},services:[{
   id:'a',title:'Instalação elétrica',workers:1,days_at_suggested_staff:2,
   roles:[{code:'ELE_QA',name:'Eletricista',workers:1,projected_hh:16}]
  }]};
  let estimate=summarizeWorkforce(model,registry);
  assert.equal(estimate.roles[0].hourly_cost,28.75);
  await handleCompanyCosts({req,res:{},sql,user:{id:admin,role:'administrador'},
   parts:['company-costs','workers',payload.id],method:'PUT',
   readBody:async()=>({...base,monthly_salary:'5000',monthly_additional_cost:'1000',
    workdays_per_month:'24',hours_per_day:'10',active:true}),send});
  assert.equal(status,200);
  estimate=summarizeWorkforce(model,await readCompanyCosts(sql));
  assert.equal(estimate.roles[0].hourly_cost,25);
  const logs=await sql.query("SELECT count(*)::int AS n FROM audit_events WHERE actor_id=$1 AND entity_type='company_workers'",[admin]);
  assert.ok(logs[0].n>=2);
 }finally{
  try{await client.query('ROLLBACK')}finally{client.release();await pool.end()}
 }
});
