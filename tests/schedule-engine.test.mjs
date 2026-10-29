import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkSchedule} from '../src/schedule-engine.mjs';
const base=()=>({
 start_date:'2026-11-02',work_days_week:5,holidays:['2026-11-02'],safety_pct:25,
 teams:[{id:'equipe-eletrica',workers:2,hours_day:8,efficiency:1},{id:'equipe-civil',workers:2,hours_day:8,efficiency:1}],
 tasks:[
  {id:'A',title:'Infraestrutura elétrica',crew_id:'equipe-eletrica',quantity:32,hh_per_unit:1,depends_on:[]},
  {id:'B',title:'Assentamento de tubulações',crew_id:'equipe-civil',quantity:48,hh_per_unit:1,depends_on:[]},
  {id:'C',title:'Ligação do quadro',crew_id:'equipe-eletrica',quantity:16,hh_per_unit:1,depends_on:['A']}
 ]
});
test('frentes independentes executam atividades simultâneas',()=>{
 const s=buildWorkSchedule(base());
 assert.equal(s.ready,true);
 assert.equal(s.parallel_tasks_possible,true);
 assert.equal(s.base_workdays,3);
 assert.equal(s.safety_workdays,1);
 assert.equal(s.total_workdays,4);
 assert.equal(s.start,'2026-11-03');
 assert.equal(s.finish,'2026-11-06');
 assert.equal(s.tasks.find(x=>x.id==='A').start,s.tasks.find(x=>x.id==='B').start);
 assert.equal(s.tasks.find(x=>x.id==='C').start,'2026-11-05');
});
test('mesma equipe não executa frentes sobrepostas',()=>{
 const x=base();
 x.tasks=[{id:'A',title:'Etapa 1',crew_id:'equipe-eletrica',duration_workdays:2,duration_reviewed:true},
          {id:'B',title:'Etapa 2',crew_id:'equipe-eletrica',duration_workdays:3,duration_reviewed:true}];
 x.safety_pct=0;
 const s=buildWorkSchedule(x);
 assert.equal(s.ready,true);
 assert.equal(s.tasks[1].start,'2026-11-05');
 assert.equal(s.finish,'2026-11-09');
 assert.equal(s.parallel_tasks_possible,false);
});
test('coeficiente h-h ausente impede prazo, sem datas inventadas',()=>{
 const x=base();x.tasks[0].hh_per_unit=null;
 const s=buildWorkSchedule(x);
 assert.equal(s.ready,false);
 assert.equal(s.finish,null);
 assert.ok(s.errors.some(x=>x.includes('produtividade')));
});
test('duração manual não revisada também não autoriza prazo',()=>{
 const x=base();x.tasks=[{id:'X',title:'Manual',crew_id:'equipe-civil',duration_workdays:2}];
 const s=buildWorkSchedule(x);
 assert.equal(s.ready,false);
});
test('ciclo de dependências bloqueia cronograma',()=>{
 const x=base();x.tasks[0].depends_on=['C'];
 const s=buildWorkSchedule(x);
 assert.equal(s.ready,false);
 assert.ok(s.errors.some(x=>x.includes('ciclo')));
});
test('equipe inexistente e referências quebradas bloqueiam',()=>{
 const x=base();x.tasks[0].crew_id='nenhuma';x.tasks[1].depends_on=['desconhecida'];
 const s=buildWorkSchedule(x);
 assert.equal(s.ready,false);
 assert.equal(s.finish,null);
});
test('feriados e prazo contratual são respeitados no alerta',()=>{
 const x=base();x.contract_deadline='2026-11-04';
 const s=buildWorkSchedule(x);
 assert.equal(s.ready,true);
 assert.ok(s.warnings.some(x=>x.includes('contratual')));
});
