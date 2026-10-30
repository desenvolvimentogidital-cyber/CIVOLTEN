import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {createApi} from '../api/index.mjs';
const connection=process.env.CIVOLTEN_TEST_DATABASE_URL;
const allowed=!!connection&&/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:localhost|127\.0\.0\.1):5432\/civolten_test(?:\?.*)?$/.test(connection);
if(!allowed)test.skip('Etapa 4: fechamento exige PostgreSQL efêmero localhost da CI',()=>{});
else{
 const pool=new pg.Pool({connectionString:connection,max:3});
 const sql={query:async(q,p=[])=> (await pool.query(q,p)).rows},api=createApi(sql);
 const users=Array.from({length:4},()=>randomUUID()),roles=['administrador','orcamentista','revisor','consulta'],
  tokens=users.map(()=>randomUUID().replaceAll('-','').repeat(2));
 const client=randomUUID(),project=randomUUID(),budget=randomUUID();
 async function call(index,path,method='GET',payload){
  const req=Readable.from(payload===undefined?[]:[Buffer.from(JSON.stringify(payload))]);
  req.url='/api/v1/'+path;req.method=method;
  req.headers={host:'localhost:3000',...(index===null?{}:{cookie:'civolten_dev_session='+tokens[index]}),
   ...(method!=='GET'?{'x-civolten-request':'1'}:{}),
   ...(payload===undefined?{}:{'content-type':'application/json'})};
  const res={statusCode:200,setHeader(){},end(t){this.body=JSON.parse(t)}};
  await api(req,res);return {status:res.statusCode,body:res.body};
 }
 const must=(r,status)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body};
 test('Etapa 4: recebimentos reais simulados, ETC revisto e margem hipotética segregada', {timeout:35000},async()=>{
  try{
   for(let i=0;i<4;i++){
    await sql.query("INSERT INTO app_users(id,login,password_hash,role,must_change_password) VALUES($1,$2,'qa-only',$3,false)",
     [users[i],'qa-closeout.'+users[i]+'@example.test',roles[i]]);
    await sql.query("INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '2 hours')",
     [createHash('sha256').update(tokens[i]).digest('hex'),users[i]]);
   }
   await sql.query("INSERT INTO clients(id,name) VALUES($1,'Cliente fictício fechamento QA')",[client]);
   await sql.query("INSERT INTO projects(id,client_id,title) VALUES($1,$2,'Reforma fictícia fechamento')",[project,client]);
   await sql.query("INSERT INTO budgets(id,code,client_id,project_id,title,reference_month,regime,bdi_pct,created_by) VALUES($1,$2,$3,$4,'Orçamento fechado QA','2026-07','Sem desoneração',0,$5)",
    [budget,'QA4-CLOSE-'+budget.slice(0,6),client,project,users[0]]);
   await sql.query("INSERT INTO budget_items(budget_id,position,source_code,source_name,unit,quantity,direct_unit_cost) VALUES($1,1,'QA-PINT','Pintura simulação','M2',20,50)",[budget]);
   const root='budgets/'+budget;
   must(await call(null,root+'/financial-closeout'),401);
   let x=must(await call(3,root+'/financial-closeout'),200);
   assert.equal(x.metrics.budget_direct_reais,1000);
   assert.equal(x.metrics.actual_net_profit_reais,null);
   assert.equal(x.metrics.approved_remaining_cost_reais,null);
   assert.equal(x.metrics.hypothetical_contribution_at_estimated_price_reais,null);
   const readiness=must(await call(0,root+'/commercial-readiness'),200);
   assert.equal(readiness.ready,false);
   assert.ok(readiness.blocked_actions.includes('accept'));
   const receipt={lock_version:0,amount:'500.00',received_on:'2026-10-28',
    method:'pix',payer_name:'Pagador fictício de teste',
    evidence_ref:'COMPROVANTE-QA-500',evidence_notes:'Transferência fictícia de teste, sem transação bancária real'};
   must(await call(3,root+'/financial-receipts','POST',receipt),403);
   must(await call(1,root+'/financial-receipts','POST',{...receipt,received_on:'2026-02-30'}),400);
   must(await call(1,root+'/financial-receipts','POST',{...receipt,amount:'0'}),400);
   const a=must(await call(1,root+'/financial-receipts','POST',receipt),201);
   assert.equal(a.status,'pendente');
   must(await call(1,root+'/financial-receipts','POST',{...receipt,lock_version:1}),409);
   x=must(await call(0,root+'/financial-closeout'),200);
   assert.equal(x.metrics.receipt_validated_reais,0);
   assert.equal(x.metrics.receipt_pending_reais,500);
   must(await call(1,root+'/financial-receipts/'+a.id,'PUT',{
    lock_version:1,status:'validado',review_notes:'Operador não tem permissão para validar pagamento'}),403);
   must(await call(2,root+'/financial-receipts/'+a.id,'PUT',{
    lock_version:1,status:'validado',review_notes:'Comprovante fictício conferido por pessoa distinta'}),200);
   x=must(await call(0,root+'/financial-closeout'),200);
   assert.equal(x.metrics.receipt_validated_reais,500);
   assert.equal(x.metrics.observed_receipts_less_incurred_costs_reais,500);
   const forecast={lock_version:2,expected_remaining_cost:'600.00',as_of:'2026-10-28',
    evidence_ref:'PREV-QA-CUSTO-600',
    assumptions:'Custo ainda a incorrer revisado com equipe e quantitativos fictícios.',
    includes_pending_costs:true};
   const f=must(await call(1,root+'/financial-forecasts','POST',forecast),201);
   assert.equal(f.status,'pendente');
   x=must(await call(0,root+'/financial-closeout'),200);
   assert.equal(x.metrics.approved_remaining_cost_reais,null);
   must(await call(2,root+'/financial-forecasts/'+f.id,'PUT',{
    lock_version:3,status:'validado',review_notes:'Previsão de conclusão revisada no ambiente descartável'}),200);
   x=must(await call(0,root+'/financial-closeout'),200);
   assert.equal(x.metrics.approved_remaining_cost_reais,600);
   assert.equal(x.metrics.projected_cost_at_completion_reais,600);
   assert.equal(x.metrics.hypothetical_contribution_at_estimated_price_reais,400);
   assert.equal(x.metrics.actual_net_profit_margin_pct,null);
   const list=must(await call(0,root+'/financial-forecasts'),200);
   assert.equal(list.records.length,1);
   must(await call(2,root+'/financial-forecasts/'+f.id,'PUT',{
     lock_version:4,status:'rejeitado',review_notes:'Não permitir alterar uma revisão concluída'}),409);
   const cost=must(await call(1,root+'/financial-actuals','POST',{
    lock_version:4,category:'material',description:'Tinta fictícia controlada',
    amount:'200.50',incurred_on:'2026-10-28',
    evidence_ref:'NOTA-QA-MAT-200',
    evidence_notes:'Custo realizado fictício, comprovante simulado sem nota fiscal real'}),201);
   must(await call(2,root+'/financial-actuals/'+cost.id,'PUT',{
    lock_version:5,status:'validado',review_notes:'Conferência de material por revisor fictício'}),200);
   x=must(await call(0,root+'/financial-closeout'),200);
   assert.equal(x.metrics.actual_cost_validated_reais,200.5);
   assert.equal(x.metrics.projected_cost_at_completion_reais,800.5);
   assert.equal(x.metrics.hypothetical_contribution_at_estimated_price_reais,199.5);
   assert.equal(x.metrics.observed_receipts_less_incurred_costs_reais,299.5);
   assert.equal(x.needs_forecast_refresh,true);
   assert.equal(x.commercial_release,false);
   assert.equal((await sql.query('SELECT COUNT(*)::int AS n FROM proposals WHERE budget_id=$1',[budget]))[0].n,0);
   const audit=await sql.query("SELECT COUNT(*)::int AS n FROM audit_events WHERE entity_type IN ('budget_cash_receipts','budget_completion_forecasts') AND actor_id=ANY($1)",[users]);
   assert.equal(audit[0].n,4);
  }finally{await pool.end()}
 });
}
