import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {probeTenantRuntime} from '../src/tenant-db-guard.mjs';
const uri=process.env.CIVOLTEN_TEST_DATABASE_URL;
if(!uri||!/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:127\.0\.0\.1|localhost):5432\/civolten_test(?:\?.*)?$/.test(uri)){
 test.skip('Security RLS tests only run on disposable postgres localhost with staged migration',()=>{});
}else{
 const pool=new pg.Pool({connectionString:uri,max:3});
 const qaRole='civolten_rls_qa';
 test('organizações A e B: RLS evita leitura/gravação cruzadas, inclusive com UUIDs conhecidos', {timeout:30000},async()=>{
  const A=randomUUID(),B=randomUUID(),u=randomUUID(),v=randomUUID(),clientA=randomUUID(),clientB=randomUUID(),budgetA=randomUUID(),budgetB=randomUUID();
  const query=(q,a=[])=>pool.query(q,a);
  const conn=await pool.connect();
  try{
   await query('CREATE ROLE civolten_rls_qa NOLOGIN');
   await query('GRANT USAGE ON SCHEMA public TO civolten_rls_qa');
   await query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO civolten_rls_qa');
   await query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO civolten_rls_qa');
   await query("INSERT INTO organizations(id,name) VALUES($1,'Organização A QA'),($2,'Organização B QA')",[A,B]);
   await query("INSERT INTO app_users(id,organization_id,login,password_hash,role,must_change_password) VALUES ($1,$2,$3,'qa','administrador',false),($4,$5,$6,'qa','administrador',false)",
    [u,A,'a-rls-'+u+'@example.test',v,B,'b-rls-'+v+'@example.test']);
   await query("INSERT INTO clients(id,organization_id,name,created_by) VALUES ($1,$2,'Cliente A', $3),($4,$5,'Cliente B',$6)",
    [clientA,A,u,clientB,B,v]);
   await query("INSERT INTO budgets(id,organization_id,client_id,code,title,reference_month,regime,bdi_pct,created_by) VALUES ($1,$2,$3,$4,'Obra A','2026-07','Sem desoneração',0,$5),($6,$7,$8,$9,'Obra B','2026-07','Sem desoneração',0,$10)",
    [budgetA,A,clientA,'RL-A-'+budgetA.slice(0,8),u,budgetB,B,clientB,'RL-B-'+budgetB.slice(0,8),v]);
   await query("INSERT INTO app_sessions(token_hash,user_id,organization_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour'),($4,$5,$6,now()+interval '1 hour')",['a'.repeat(64),u,A,'b'.repeat(64),v,B]);
   await query("INSERT INTO account_action_tokens(token_hash,user_id,organization_id,purpose,expires_at) VALUES($1,$2,$3,'verify',now()+interval '1 hour'),($4,$5,$6,'verify',now()+interval '1 hour')",['c'.repeat(64),u,A,'d'.repeat(64),v,B]);
   await conn.query('BEGIN');
   await conn.query('SET LOCAL ROLE civolten_rls_qa');
   await conn.query("SELECT set_config('civolten.organization_id',$1,true)",[A]);
   for(const [table,id] of [
    ['organizations',A],['app_users',u],['app_sessions','a'.repeat(64)],
    ['account_action_tokens','c'.repeat(64)]
   ]){
    const key=table==='organizations'||table==='app_users'?'id':'token_hash';
    const rows=(await conn.query('SELECT '+key+' FROM '+table)).rows;
    assert.equal(rows.length,1,table+' isolada');
    assert.equal(rows[0][key],id,table+' pertence à A');
   }
   let clients=(await conn.query('SELECT id,organization_id FROM clients ORDER BY name')).rows;
   assert.equal(clients.length,1);
   assert.equal(clients[0].id,clientA);
   let budgets=(await conn.query('SELECT id FROM budgets')).rows;
   assert.deepEqual(budgets.map(x=>x.id),[budgetA]);
   assert.equal((await conn.query("UPDATE clients SET name='TENTOU' WHERE id=$1 RETURNING id",[clientB])).rowCount,0);
   assert.equal((await conn.query('DELETE FROM budgets WHERE id=$1 RETURNING id',[budgetB])).rowCount,0);
   await conn.query('COMMIT');
   // A context set with SET LOCAL MUST NOT leak into the next transaction.
   await conn.query('BEGIN');
   await conn.query('SET LOCAL ROLE civolten_rls_qa');
   assert.equal((await conn.query('SELECT count(*)::int AS n FROM clients')).rows[0].n,0);
   await conn.query('ROLLBACK');
   // CHECK policy blocks creation of an explicitly B-owned row by organization A.
   await conn.query('BEGIN');
   await conn.query('SET LOCAL ROLE civolten_rls_qa');
   await conn.query("SELECT set_config('civolten.organization_id',$1,true)",[A]);
   await assert.rejects(()=>conn.query("INSERT INTO clients(organization_id,name) VALUES($1,'Cross-account client')",[B]),
    e=>e.code==='42501');
   await conn.query('ROLLBACK');
   // FK scoped by organization stops A-owned project referencing a B client.
   await conn.query('BEGIN');
   await conn.query('SET LOCAL ROLE civolten_rls_qa');
   await conn.query("SELECT set_config('civolten.organization_id',$1,true)",[A]);
   await assert.rejects(()=>conn.query("INSERT INTO projects(client_id,title) VALUES($1,'Cross-account project')",[clientB]),
    e=>e.code==='23503');
   await conn.query('ROLLBACK');
   // Same singleton key is allowed in separate organizations, with zero sharing.
   await query('INSERT INTO company_overhead_config(organization_id,singleton,monthly_overhead,workdays_per_month) VALUES($1,1,1000,22),($2,1,2000,22)',[A,B]);
   for(const [org,expected] of [[A,1000],[B,2000]]){
    await conn.query('BEGIN');
    await conn.query('SET LOCAL ROLE civolten_rls_qa');
    await conn.query("SELECT set_config('civolten.organization_id',$1,true)",[org]);
    const row=(await conn.query('SELECT monthly_overhead FROM company_overhead_config WHERE singleton=1')).rows;
    assert.equal(row.length,1);assert.equal(Number(row[0].monthly_overhead),expected);
    const check=await probeTenantRuntime({query:async(q,args)=> (await conn.query(q,args)).rows,transaction:async()=>{}});
    assert.equal(check.ready,true,JSON.stringify(check.reasons));
    await conn.query('COMMIT');
   }
  }finally{
   try{await conn.query('ROLLBACK')}catch{}
   conn.release();
   await pool.end();
  }
 });
}
