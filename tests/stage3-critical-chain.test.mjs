import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkSchedule} from '../src/schedule-engine.mjs';
import {inspectCriticalChain} from '../src/schedule-critical-chain.mjs';
const base=()=>({start_date:'2026-11-02',work_days_week:5,holidays:['2026-11-02'],safety_pct:0,
 teams:[{id:'civil',workers:2,hours_day:8,efficiency:0.85},{id:'eletrica',workers:2,hours_day:8,efficiency:0.9}],
 tasks:[
  {id:'A',title:'Pintura',crew_id:'civil',duration_workdays:2,duration_reviewed:true,depends_on:[]},
  {id:'B',title:'Elétrica',crew_id:'eletrica',duration_workdays:3,duration_reviewed:true,depends_on:[]},
  {id:'C',title:'Acabamento',crew_id:'civil',duration_workdays:1,duration_reviewed:true,depends_on:['A']}
 ]});
test('cadeia crítica inclui equipes paralelas que determinam o prazo',()=>{
 const x=inspectCriticalChain(buildWorkSchedule(base()));
 assert.equal(x.ready,true);
 assert.equal(x.project_workdays,3);
 assert.deepEqual(x.critical_task_ids.sort(),['A','B','C']);
 assert.equal(x.commercial_release,false);
});
test('equipe com prazo menor que outra mantém folga positiva',()=>{
 const b=base();b.tasks[1].duration_workdays=5;
 const x=inspectCriticalChain(buildWorkSchedule(b));
 assert.equal(x.ready,true);
 assert.equal(x.project_workdays,5);
 assert.deepEqual(x.critical_task_ids,['B']);
 assert.equal(x.activities.find(t=>t.id==='A').total_float_workdays,2);
 assert.equal(x.activities.find(t=>t.id==='C').total_float_workdays,2);
});
test('duas tarefas sequenciais da mesma equipe formam cadeia crítica de recursos',()=>{
 const b=base();b.tasks=b.tasks.filter(x=>x.crew_id==='civil');
 b.tasks[1].depends_on=[];
 const x=inspectCriticalChain(buildWorkSchedule(b));
 assert.equal(x.ready,true);
 assert.equal(x.project_workdays,3);
 assert.equal(x.critical_task_ids.length,2);
});
test('sem duração homologada não publica datas nem cadeia crítica',()=>{
 const b=base();b.tasks[0].duration_reviewed=false;
 const x=inspectCriticalChain(buildWorkSchedule(b));
 assert.equal(x.ready,false);assert.equal(x.project_workdays,null);
});
