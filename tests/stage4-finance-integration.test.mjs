import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {createApi} from '../api/index.mjs';

const db=process.env.CIVOLTEN_TEST_DATABASE_URL;
const allowed=!!db&&/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:127\.0\.0\.1|localhost):5432\/civolten_test(?:\?.*)?$/.test(db);
if(!allowed)test.skip('Etapa 4 requer PostgreSQL descartável da CI',()=>{});
else {
 const pool=new pg.Pool({connectionString:db,max:3});
 const sql={query:async(q,p=[])=> (await pool.query(q,p)).rows};
 const api=createApi(sql),ids=[randomUUID(),randomUUID(),randomUUID()],roles=['administrador','orcamentista','revisor'],
  tokens=ids.map(()=>randomUUID().replaceAll('-','').repeat(2)),client=randomUUID(),project=randomUUID(),budget=randomUUID();
 async function call(index,route,method='GET',body){
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
  req.url='/api/v1/'+route;req.method=method;
  req.headers={host:'localhost:3000',cookie:'civolten_dev_session='+tokens[index],
   ...(method!=='GET'?{'x-civolten-request':'1'}:{}),
   ...(body===undefined?{}:{'content-type':'application/json'})};
  const res={statusCode:200,setHeader(){},end(x){this.body=JSON.parse(x)}};
  await api(req,res);return {status:res.statusCode,body:res.body};
 }
 const must=(v,status)=>{assert.equal(v.status,status,JSON.stringify(v.body));return v.body};
 test('Etapa 4: proposta interna versionada e custos validados sem emissão comercial', {timeout:35000},async()=>{
  try{
   for(let i=0;i<ids.length;i++){
    await sql.query("INSERT INTO app_users(id,login,password_hash,role,must_change_password) VALUES($1,$2,'ci-only',$3,false)",
     [ids[i],'stage4-qa.'+ids[i]+'@example.test',roles[i]]);
    await sql.query("INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '2 hours')",
     [createHash('sha256').update(tokens[i]).digest('hex'),ids[i]]);
   }
   await sql.query("INSERT INTO clients(id,name) VALUES($1,'CLIENTE FICTÍCIO PROPOSTA')",[client]);
   await sql.query("INSERT INTO projects(id,client_id,title,address) VALUES($1,$2,'Projeto de teste financeiro','Local fictício de obra')",[project,client]);
   await sql.query("INSERT INTO budgets(id,code,client_id,project_id,title,reference_month,regime,bdi_pct,created_by) VALUES($1,$2,$3,$4,'Orçamento teste de propostas','2026-07','Sem desoneração',0,$5)",
    [budget,'QA4-'+budget.slice(0,8),client,project,ids[0]]);
   await sql.query("INSERT INTO budget_items(budget_id,position,source_code,source_name,unit,quantity,direct_unit_cost) VALUES($1,1,'QA-01','Pintura de teste','M2',10,50)",[budget]);
   const base='budgets/'+budget;
   let report=must(await call(0,base+'/financial-summary'),200);
   assert.equal(report.comparison.budget_direct_reais,500);
   assert.equal(report.comparison.final_profit_reais,null);
   assert.equal(report.estimate.ready,false);
   const draftBody={lock_version:0,scope:'Pintura fictícia de alvenaria em área de testes',
    exclusions:'Instalações especiais e reparos estruturais fora do serviço',
    payment_terms:'Metade no início, saldo após medição aprovada',validity_days:20};
   must(await call(1,base+'/proposal-drafts','POST',{...draftBody,lock_version:99}),409);
   const draft=must(await call(1,base+'/proposal-drafts','POST',draftBody),201);
   assert.equal(draft.version,1);
   assert.match(draft.snapshot_sha256,/^[a-f0-9]{64}$/);
   assert.equal(draft.cost_estimate_ready,false);
   assert.equal(draft.commercial_release,false);
   let drafts=must(await call(0,base+'/proposal-drafts'),200);
   assert.equal(drafts.drafts[0].stale,false);
   const full=must(await call(0,base+'/proposal-drafts/'+draft.id),200);
   assert.equal(full.snapshot.issued,false);
   assert.equal(full.snapshot.commercial_release,false);
   assert.equal(full.snapshot.costs.direct_reais,500);
   const input={lock_version:1,category:'material',description:'Tintas e massas fictícias',
    amount:'150.50',incurred_on:'2026-10-28',evidence_ref:'NOTA-QA-2026-A',
    evidence_notes:'Custo de material fictício usado apenas em teste'};
   must(await call(1,base+'/financial-actuals','POST',{...input,amount:'-10'}),400);
   const actual=must(await call(1,base+'/financial-actuals','POST',input),201);
   assert.equal(actual.status,'pendente');
   must(await call(1,base+'/financial-actuals','POST',{...input,lock_version:2}),409);
   report=must(await call(0,base+'/financial-summary'),200);
   assert.equal(report.actuals.pending_reais,150.5);
   assert.equal(report.actuals.validated_reais,0);
   must(await call(1,base+'/financial-actuals/'+actual.id,'PUT',{
    lock_version:2,status:'validado',review_notes:'Aprovação simulada por quem criou'}),403);
   must(await call(2,base+'/financial-actuals/'+actual.id,'PUT',{
    lock_version:2,status:'validado',review_notes:'Aprovação de nota fictícia por revisor distinto'}),200);
   report=must(await call(0,base+'/financial-summary'),200);
   assert.equal(report.actuals.validated_reais,150.5);
   assert.equal(report.comparison.actual_spend_pct_of_direct_baseline,30.1);
   assert.equal(report.comparison.final_profit_margin_pct,null);
   must(await call(2,base+'/financial-actuals/'+actual.id,'PUT',{
    lock_version:3,status:'rejeitado',review_notes:'Não reabrir documento já validado'}),409);
   drafts=must(await call(0,base+'/proposal-drafts'),200);
   assert.equal(drafts.drafts[0].stale,true);
   const draft2=must(await call(1,base+'/proposal-drafts','POST',{...draftBody,lock_version:3}),201);
   assert.equal(draft2.version,2);
   drafts=must(await call(0,base+'/proposal-drafts'),200);
   assert.equal(drafts.drafts[0].stale,false);
   assert.equal(drafts.drafts[1].stale,true);
   // A rota PDF usa autenticação obrigatória e entrega somente rascunho não emitido.
   const pdfReq=Readable.from([]);
   pdfReq.url='/api/v1/'+base+'/proposal-drafts/'+draft2.id+'/pdf';
   pdfReq.method='GET';
   pdfReq.headers={host:'localhost:3000',cookie:'civolten_dev_session='+tokens[0]};
   const pdfRes={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(bytes){this.bytes=bytes}};
   await api(pdfReq,pdfRes);
   assert.equal(pdfRes.statusCode,200);
   assert.equal(pdfRes.headers['Content-Type'],'application/pdf');
   assert.equal(pdfRes.headers['Cache-Control'],'private, no-store');
   assert.equal(pdfRes.bytes.subarray(0,5).toString(),'%PDF-');
   assert.equal((await sql.query('SELECT COUNT(*)::int AS c FROM proposals WHERE budget_id=$1',[budget]))[0].c,0,
     'Não produzir emissão comercial automaticamente');
   const audit=await sql.query("SELECT COUNT(*)::int AS c FROM audit_events WHERE entity_type IN ('proposal_draft_snapshots','budget_actual_costs') AND actor_id=ANY($1)",[ids]);
   assert.ok(audit[0].c>=4);
  }finally{await pool.end();}
 });
}
