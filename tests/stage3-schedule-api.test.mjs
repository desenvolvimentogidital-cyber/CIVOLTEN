import test from 'node:test';
import assert from 'node:assert/strict';
import {handleStage3} from '../src/schedule-api.mjs';
const id='00000000-0000-4000-8000-000000000001';
const crew1='00000000-0000-4000-8000-000000000010',crew2='00000000-0000-4000-8000-000000000011';
const a='00000000-0000-4000-8000-000000000020',b='00000000-0000-4000-8000-000000000021',c='00000000-0000-4000-8000-000000000022';
const fixture=()=>({
 budget:[{id,code:'ORC-TESTE-FASE3',status:'rascunho',lock_version:4}],
 crews:[{id:crew1,title:'Equipe civil',workers:2,workday_hours:'8',efficiency:'0.85'},
        {id:crew2,title:'Equipe elétrica',workers:2,workday_hours:'8',efficiency:'0.9'}],
 tasks:[{id:a,title:'Pintura revisada',crew_id:crew1,days_estimated:2,duration_review_state:'revisado',budget_item_id:null},
        {id:b,title:'Elétrica revisada',crew_id:crew2,days_estimated:3,duration_review_state:'revisado',budget_item_id:null},
        {id:c,title:'Acabamento revisado',crew_id:crew1,days_estimated:1,duration_review_state:'validado',budget_item_id:null}],
 dependencies:[{predecessor_id:a,successor_id:c,dependency_type:'FS',lag_days:0}]
});
const preview=async(query='start_date=2026-11-02&holidays=2026-11-02&safety_pct=25',fixtureData=fixture(),method='GET')=>{
 const req={url:'/api/v1/budgets/'+id+'/schedule-preview?'+query};
 const res={};
 const sql={query:async statement=>{
  if(statement.includes('SELECT id,code,status'))return fixtureData.budget;
  if(statement.includes('FROM crews c'))return fixtureData.crews;
  if(statement.includes('FROM schedule_tasks t'))return fixtureData.tasks;
  if(statement.includes('FROM task_dependencies d'))return fixtureData.dependencies;
  throw Error('SQL inesperada: '+statement);
 }};
 const send=(response,status,payload)=>{response.status=status;response.body=payload;};
 const handled=await handleStage3({req,res,sql,parts:['budgets',id,'schedule-preview'],method,send});
 assert.equal(handled,true);
 return res;
};
test('Etapa 3: duas equipes paralelas e dependência FS com feriado e folga',async()=>{
 const r=await preview();
 assert.equal(r.status,200);
 assert.equal(r.body.schedule.ready,true,JSON.stringify(r.body.schedule.errors));
 assert.equal(r.body.schedule.parallel_tasks_possible,true);
 assert.equal(r.body.schedule.base_workdays,3);
 assert.equal(r.body.schedule.safety_workdays,1);
 assert.equal(r.body.schedule.finish,'2026-11-06');
 assert.equal(r.body.commercial_release,false);
 assert.equal(r.body.preview_only,true);
});
test('Etapa 3: atividade sem duração revisada bloqueia prazo',async()=>{
 const data=fixture();data.tasks[0].duration_review_state='pendente';
 const r=await preview(undefined,data);
 assert.equal(r.body.schedule.ready,false);
 assert.equal(r.body.schedule.finish,null);
 assert.ok(r.body.schedule.errors.some(x=>x.includes('não revisada')));
});
test('Etapa 3: dependência com lag não suportado bloqueia sem inventar datas',async()=>{
 const data=fixture();data.dependencies[0].lag_days=3;
 const r=await preview(undefined,data);
 assert.equal(r.body.schedule.ready,false);
});
test('Etapa 3: equipes de fora do orçamento não podem ser usadas',async()=>{
 const data=fixture();data.tasks[0].crew_id='00000000-0000-4000-8000-000000000099';
 const r=await preview(undefined,data);
 assert.equal(r.body.schedule.ready,false);
 assert.equal(r.body.schedule.finish,null);
});
test('Etapa 3: datas, método e feriados inválidos são rejeitados',async()=>{
 assert.equal((await preview('start_date=2026-13-01')).body.schedule.ready,false);
 assert.equal((await preview('start_date=2026-11-02&work_days_week=7')).status,400);
 assert.equal((await preview('start_date=2026-11-02&holidays=xx')).status,400);
 assert.equal((await preview(undefined,fixture(),'POST')).status,405);
});

test('Etapa 3: produtividade usa somente h-h revisada e alerta sobre prazo subestimado',async()=>{
 const data=fixture();
 data.tasks[0].budget_item_id='00000000-0000-4000-8000-000000000123';
 data.tasks[0].quantity='100';
 data.tasks[0].direct_labor_hh_unit='1.0000';
 data.tasks[0].labor_review_state='revisado';
 const response=await preview(undefined,data);
 assert.equal(response.body.schedule.ready,true);
 const item=response.body.productivity.find(x=>x.task_id===a);
 assert.equal(item.projected_hh,100);
 assert.equal(item.derived_workdays,8);
 assert.equal(item.labor_reference_verified,true);
 assert.ok(response.body.schedule.warnings.some(x=>x.includes('prazo manual')));
 data.tasks[0].labor_review_state='direta_parcial';
 const second=await preview(undefined,data);
 assert.equal(second.body.productivity.find(x=>x.task_id===a).projected_hh,null);
 assert.equal(second.body.productivity.find(x=>x.task_id===a).derived_workdays,null);
});
