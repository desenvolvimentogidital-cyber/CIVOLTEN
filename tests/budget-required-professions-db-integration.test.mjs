import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {createApi} from '../api/index.mjs';
const db=process.env.CIVOLTEN_TEST_DATABASE_URL;
if(!db||!/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:127\.0\.0\.1|localhost):5432\/civolten_test(?:\?.*)?$/.test(db)){
 test.skip('Professions QA only runs against disposable local PostgreSQL',()=>{});
}else{
 const pool=new pg.Pool({connectionString:db,max:2});
 const sql={async query(q,args=[]){return (await pool.query(q,args)).rows}};
 const api=createApi(sql);
 async function get(token,path){
  const req=Readable.from([]);
  req.url='/api/v1/'+path;req.method='GET';
  req.headers={host:'localhost:3000',cookie:'civolten_dev_session='+token};
  const res={statusCode:200,setHeader(){},end(s){this.body=JSON.parse(s)}};
  await api(req,res);return {status:res.statusCode,body:res.body};
 }
 test('profissões reais da composição SIURB e funcionários ativos: leitura sem salários', {timeout:30000},async()=>{
  const actor=randomUUID(),client=randomUUID(),budget=randomUUID(),version=randomUUID(),
    price=randomUUID(),worker=randomUUID(),token=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');
  const code='QA_PROF_'+price.slice(0,6);
  try{
   await sql.query("INSERT INTO app_users(id,login,password_hash,role,must_change_password) VALUES($1,$2,'qa-placeholder','administrador',false)",
    [actor,'professions.qa.'+actor+'@example.test']);
   await sql.query("INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [createHash('sha256').update(token).digest('hex'),actor]);
   await sql.query("INSERT INTO clients(id,name) VALUES($1,'Cliente fictício de profissões QA')",[client]);
   await sql.query("INSERT INTO budgets(id,code,client_id,title,reference_month,regime,bdi_pct,created_by) VALUES($1,$2,$3,'Orçamento profissões QA','2025-07','Sem desoneração',0,$4)",
    [budget,'QA-PROF-'+budget.slice(0,8),client,actor]);
   await sql.query("INSERT INTO reference_price_versions(id,source,reference_month,regime,scope) VALUES($1,'SIURB','2025-07','Sem desoneração','Edificações')",[version]);
   await sql.query("INSERT INTO reference_prices(id,version_id,code,description,unit,unit_cost) VALUES($1,$2,$3,'Serviço profissões QA','UN',100)",
    [price,version,'QA-P-'+price.slice(0,8)]);
   await sql.query("INSERT INTO reference_composition_details(reference_price_id,labor,other,direct_hh_per_unit) VALUES($1,$2::jsonb,'[]'::jsonb,0.5)",
    [price,JSON.stringify([{code,name:'Instalador QA',unit:'H',coef:'0.5'},
      {code:'88MAQ',name:'Equipamento QA',unit:'HMAQ',coef:'3'}])]);
   await sql.query("INSERT INTO budget_items(budget_id,position,source_name,unit,quantity,direct_unit_cost,reference_price_id,direct_labor_hh_unit,labor_review_state) VALUES($1,1,'Instalação QA','UN',8,100,$2,0.5,'revisado')",
    [budget,price]);
   let first=await get(token,'budgets/'+budget+'/required-professions');
   assert.equal(first.status,200,JSON.stringify(first.body));
   assert.equal(first.body.summary.required_professions,1);
   assert.equal(first.body.professions[0].code,code);
   assert.equal(first.body.professions[0].estimated_hh,4);
   assert.equal(first.body.summary.missing_active_professions,1);
   assert.equal(JSON.stringify(first.body).includes('monthly_employer_cost'),false);
   await sql.query("INSERT INTO company_workers(id,display_name,role_code,role_name,monthly_employer_cost) VALUES($1,'QA Funcionário', $2,'Instalador QA',4000)",[worker,code]);
   const second=await get(token,'budgets/'+budget+'/required-professions');
   assert.equal(second.status,200,JSON.stringify(second.body));
   assert.equal(second.body.summary.missing_active_professions,0);
   assert.equal(second.body.professions[0].active_workers,1);
   assert.equal(second.body.staffing_complete,true);
   assert.equal(second.body.commercial_release,false);
   await sql.query('UPDATE company_workers SET active=false WHERE id=$1',[worker]);
   const third=await get(token,'budgets/'+budget+'/required-professions');
   assert.equal(third.body.summary.missing_active_professions,1);
  }finally{await pool.end()}
 });
}
