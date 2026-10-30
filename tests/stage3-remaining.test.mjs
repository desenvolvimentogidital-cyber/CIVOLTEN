import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastRemainingWork} from '../src/schedule-remaining.mjs';
const taskA={id:'A',title:'Pintura',crew_id:'civil',budget_item_id:'ITEM-A',planned_quantity:'100',
 validated_quantity:'40',validated_person_hours:'80',labor_review_state:'pendente'};
const taskB={id:'B',title:'Piso',crew_id:'acabamento',budget_item_id:'ITEM-B',planned_quantity:'20',
 validated_quantity:'10',validated_person_hours:'10',labor_review_state:'pendente'};
const teams=[{id:'civil',workers:2,hours_day:8,efficiency:0.8},
 {id:'acabamento',workers:1,hours_day:8,efficiency:1}];
const base=()=>({tasks:[{...taskA},{...taskB}],teams,dependencies:[{predecessor_id:'A',successor_id:'B',dependency_type:'FS',lag_days:0}],
 start_date:'2026-11-02',holidays:['2026-11-02'],work_days_week:5,safety_pct:0});
test('Etapa 3: desconta medição validada e planeja prazo restante com equipes',()=>{
 const output=forecastRemainingWork(base());
 assert.equal(output.ready,true,JSON.stringify(output.errors));
 assert.equal(output.items[0].observed_hh_per_unit,2);
 assert.equal(output.items[0].estimated_remaining_workdays,10);
 assert.equal(output.items[1].estimated_remaining_workdays,2);
 assert.equal(output.schedule.base_workdays,12);
 assert.equal(output.schedule.total_workdays,12);
 assert.ok(output.critical_chain.critical_task_ids.includes('A'));
 assert.equal(output.commercial_release,false);
});
test('Etapa 3: não calcula prazo sem produção real nem coeficiente revisado',()=>{
 const options=base();options.tasks[0].validated_person_hours='0';options.tasks[0].validated_quantity='0';
 const x=forecastRemainingWork(options);
 assert.equal(x.ready,false);assert.equal(x.schedule,null);
 assert.ok(x.errors.some(e=>e.includes('Produtividade sem evidência')));
});
test('Etapa 3: usa hh revisada somente se não existe produção observada',()=>{
 const options=base(); options.tasks[0].validated_quantity='0';options.tasks[0].validated_person_hours='0';
 options.tasks[0].labor_review_state='revisado';options.tasks[0].direct_labor_hh_unit='1.5';
 const x=forecastRemainingWork(options);
 assert.equal(x.ready,true);
 assert.equal(x.items[0].coefficient_source,'coeficiente_hh_revisado');
 assert.equal(x.items[0].estimated_remaining_workdays,12);
 assert.ok(x.warnings.some(w=>w.includes('Sem produtividade observada')));
});
test('Etapa 3: recusa serviço atribuído a duas tarefas para não duplicar quantidade',()=>{
 const options=base();options.tasks[1].budget_item_id='ITEM-A';
 const x=forecastRemainingWork(options);
 assert.equal(x.ready,false);
 assert.ok(x.errors.some(e=>e.includes('mais de uma atividade')));
});
test('Etapa 3: atividade sem vínculo ou produção excessiva impede previsão',()=>{
 const options=base();options.tasks[0].budget_item_id=null;options.tasks[1].validated_quantity='200';
 const x=forecastRemainingWork(options);
 assert.equal(x.ready,false);
 assert.ok(x.errors.some(e=>e.includes('sem quantidade')));
 assert.ok(x.errors.some(e=>e.includes('excede')));
});
test('Etapa 3: todos serviços concluídos produzem zero dias restantes',()=>{
 const options=base();
 for(const t of options.tasks)t.validated_quantity=t.planned_quantity;
 const x=forecastRemainingWork(options);
 assert.equal(x.ready,true);
 assert.equal(x.completed,true);
 assert.equal(x.schedule.total_workdays,0);
 assert.equal(x.schedule.finish,null);
});
