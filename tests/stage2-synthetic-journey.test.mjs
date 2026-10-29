/**
 * Homologação sintética ponta a ponta da ETAPA 2: ZERO dados de cliente real.
 * Banco permitido: PostgreSQL 17 efêmero da CI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {createApi} from '../api/index.mjs';

const db=process.env.CIVOLTEN_TEST_DATABASE_URL;
const allowed=!!db&&/^postgres(?:ql)?:\/\/postgres:[^@]+@(?:127\.0\.0\.1|localhost):5432\/civolten_test(?:\?.*)?$/.test(db);
if(!allowed){
 test.skip('orçamento fictício: exige PostgreSQL localhost descartável',()=>{});
}else{
 const pool=new pg.Pool({connectionString:db,max:3});
 const sql={async query(statement,args=[]){return (await pool.query(statement,args)).rows}};
 const handler=createApi(sql);
 const token=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');
 const userId=randomUUID(), cookie='civolten_dev_session='+token;
 const safeLogin='qa.stage2.'+userId+'@example.test';
 async function req(path,method='GET',body,withAuth=true){
  const input=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
  input.url='/api/v1/'+path;input.method=method;
  input.headers={host:'localhost:3000',...(withAuth?{cookie}:{}),
    ...(method!=='GET'?{'x-civolten-request':'1'}:{}),
    ...(body===undefined?{}:{'content-type':'application/json'})};
  const output={statusCode:200,setHeader(){},end(text){this.body=JSON.parse(text)}};
  await handler(input,output);
  return {status:output.statusCode,body:output.body};
 }
 const expect=(response,status)=>{
  assert.equal(response.status,status,JSON.stringify(response.body));
  return response.body;
 };
 const bdi={administracaoCentral:4,seguro:1,garantia:0.5,risco:1,
  despesasFinanceiras:1,lucro:5,tributosSobreReceita:7};
 test('ETAPA 2 real via API: cliente fictício → obra → cotação → BDI → risco → alterações', {timeout:30000},async()=>{
  try{
   await sql.query("INSERT INTO app_users(id,login,password_hash,role,must_change_password) VALUES($1,$2,'ci-only-placeholder-no-login','administrador',false)",[userId,safeLogin]);
   await sql.query("INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
     [createHash('sha256').update(token).digest('hex'),userId]);
   expect(await req('clients','GET',undefined,false),401);
   const client=expect(await req('clients','POST',{
     name:'CLIENTE TOTALMENTE FICTÍCIO QA 2026',email:'noreply@example.test'
   }),201);
   const obra=expect(await req('projects','POST',{
     client_id:client.id,title:'Reforma fictícia de teste - Sem clientes reais',
     address:'Endereço simulado, sem localização de pessoa real'
   }),201);
   const budget=expect(await req('budgets','POST',{
     client_id:client.id,project_id:obra.id,title:'QA orçamento sintético - pintura + revestimento',
     reference_month:'2026-07',regime:'Sem desoneração',bdi_pct:0
   }),201);
   assert.ok(budget.id && /^ORC-/.test(budget.code));
   const paint=expect(await req('budgets/'+budget.id+'/items','POST',{
     position:1,source_code:'QA-PINTURA',source_name:'Pintura simulada m²',unit:'M2',
     quantity:100,direct_unit_cost:50
   }),201);
   const tile=expect(await req('budgets/'+budget.id+'/items','POST',{
     position:2,source_code:'QA-PISO',source_name:'Piso simulado m²',unit:'M2',
     quantity:30,direct_unit_cost:80
   }),201);
   assert.ok(paint.id && tile.id);
   let costs=expect(await req('budgets/'+budget.id+'/costs'),200);
   assert.equal(costs.estimate.ready,false);
   assert.equal(costs.estimate.direct_cost_reais,7400);
   assert.ok(costs.estimate.errors.some(e=>e.code==='UNQUOTED'));
   const quote=(item,price,version,reference)=>({
      lock_version:version,source:'COTACAO',quantity_verified:true,
      supplier_quote_verified:true,supplier_name:'Fornecedor QA sem existência real',
      quote_reference:reference,quote_date:'2026-10-29',quote_unit_cost:price,
      loss_pct:0,freight_unit_cost:0,other_unit_cost:0
   });
   expect(await req('budgets/'+budget.id+'/cost-review/'+paint.id,'PUT',
     quote(paint,'50.0000',costs.budget.lock_version,'QA-PINTURA-001')),200);
   costs=expect(await req('budgets/'+budget.id+'/costs'),200);
   expect(await req('budgets/'+budget.id+'/cost-review/'+tile.id,'PUT',
     quote(tile,'80.0000',costs.budget.lock_version,'QA-PISO-001')),200);
   costs=expect(await req('budgets/'+budget.id+'/costs'),200);
   assert.ok(costs.estimate.errors.some(e=>e.code==='BDI_NOT_REVIEWED'));
   const config={lock_version:costs.budget.lock_version,bdi,contingency_pct:5,
     bdi_reviewed:true,technical_reviewed:true,commercial_reviewed:true,
     review_notes:'Somente dados fictícios de QA; taxas hipotéticas não representam legislação.'};
   expect(await req('budgets/'+budget.id+'/cost-settings','PUT',config),200);
   expect(await req('budgets/'+budget.id+'/cost-settings','PUT',config),409);
   costs=expect(await req('budgets/'+budget.id+'/costs'),200);
   assert.equal(costs.estimate.direct_cost_reais,7400);
   assert.equal(costs.estimate.ready,true,'Cotações sintéticas rastreáveis devem permitir conclusão técnica em QA');
   assert.equal(costs.commercial_release,false,'Nunca emitir proposta real automaticamente');
   assert.equal(costs.estimate.scenarios.length,3);
   assert.ok(costs.estimate.total_reais>costs.estimate.direct_cost_reais);
   assert.ok(costs.estimate.contingency_reais>0);
   const extra=expect(await req('budgets/'+budget.id+'/extra-costs','POST',{
     lock_version:costs.budget.lock_version,
     category:'mobilizacao',description:'Transporte e mobilização QA',
     amount:'200.00',quote_reference:'MEMORIA-QA-2026'
   }),201);
   assert.ok(extra.id);
   costs=expect(await req('budgets/'+budget.id+'/costs'),200);
   assert.equal(costs.estimate.direct_cost_reais,7600);
   assert.equal(costs.estimate.ready,false,'Novo custo deve revogar aprovação');
   assert.equal(costs.config.technical_reviewed,false);
   expect(await req('budgets/'+budget.id+'/extra-costs/'+extra.id,'DELETE',
      {lock_version:costs.budget.lock_version}),200);
   costs=expect(await req('budgets/'+budget.id+'/costs'),200);
   assert.equal(costs.estimate.direct_cost_reais,7400);
   // Corrida de versões: alterações com versão vencida são rejeitadas.
   const stale=costs.budget.lock_version;
   expect(await req('budgets/'+budget.id+'/cost-review/'+paint.id,'PUT',
      quote(paint,'50.0000',stale,'QA-PINTURA-REVISADA')),200);
   expect(await req('budgets/'+budget.id+'/cost-review/'+tile.id,'PUT',
      quote(tile,'80.0000',stale,'QA-PISO-ANTIGA')),409);
   costs=expect(await req('budgets/'+budget.id+'/costs'),200);
   assert.equal(costs.estimate.ready,false);
   const events=await sql.query("SELECT count(*)::int AS total FROM audit_events WHERE actor_id=$1",[userId]);
   assert.ok(events[0].total>=7,'Cliente, obra, orçamento, itens, custos e revisões devem ser auditados');
   const counts=await sql.query("SELECT count(*)::int AS n FROM clients WHERE id=$1",[client.id]);
   assert.equal(counts[0].n,1,'Dados fictícios preservados apenas no banco de QA');
   console.log(JSON.stringify({scenario:'reforma-ficticia-etapa2',direct_reais:7400,
      price_estimate_reais:costs.estimate.total_reais,commercial_release:false,
      events:events[0].total,passed:true}));
  }finally{
   await pool.end();
  }
 });
}
