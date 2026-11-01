import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planResourceSchedule} from '../src/budget-resource-scheduler.mjs';
const a={item_id:'a',title:'Pintura hall',workers:5,days_at_suggested_staff:4,roles:[]};
const b={item_id:'b',title:'Instalação elétrica quadro',workers:5,days_at_suggested_staff:4,roles:[]};
const fronts=[{budget_item_id:'a',work_front:'Sala A'},{budget_item_id:'b',work_front:'Sala B'}];
test('Equipe única: duas frentes independentes utilizam as MESMAS cinco pessoas sem sobreposição',()=>{
 const p=planResourceSchedule([a,b],{fronts,available_workers:10,execution_mode:'single_team'});
 assert.equal(p.ready,true);assert.equal(p.execution_mode,'single_team');
 assert.equal(p.workdays,8);assert.equal(p.peak_workers,5);
 assert.equal(p.tasks[0].start_workday,0);assert.equal(p.tasks[1].start_workday,4);
});
test('Duas equipes distintas podem trabalhar em paralelo, respeitando limite global',()=>{
 const p=planResourceSchedule([a,b],{fronts,available_workers:10,execution_mode:'separate_teams'});
 assert.equal(p.workdays,4);assert.equal(p.peak_workers,10);
 assert.equal(p.tasks[0].start_workday,0);assert.equal(p.tasks[1].start_workday,0);
 const limited=planResourceSchedule([a,b],{fronts,available_workers:5,execution_mode:'separate_teams'});
 assert.equal(limited.workdays,8);assert.equal(limited.peak_workers,5);
});
test('Equipe única mantém alvenaria, chapisco e reboco em sequência com 5 pessoas',()=>{
 const walls={item_id:'w',title:'Alvenaria',workers:5,days_at_suggested_staff:5};
 const coat={item_id:'c',title:'Chapisco',workers:2,days_at_suggested_staff:2};
 const render={item_id:'r',title:'Reboco',workers:3,days_at_suggested_staff:3};
 const p=planResourceSchedule([render,coat,walls],{execution_mode:'single_team',available_workers:5});
 assert.equal(p.ready,true);assert.equal(p.workdays,10);assert.equal(p.peak_workers,5);
 assert.deepEqual(p.tasks.map(t=>t.stage),['alvenaria','chapisco','reboco']);
 assert.deepEqual(p.tasks.map(t=>t.start_workday),[0,5,7]);
});
test('Equipes separadas não iniciam reboco antes da etapa anterior na MESMA frente',()=>{
 const p=planResourceSchedule([
  {item_id:'w1',title:'Alvenaria parede 1',workers:3,days_at_suggested_staff:3},
  {item_id:'w2',title:'Alvenaria parede 2',workers:3,days_at_suggested_staff:3},
  {item_id:'c1',title:'Chapisco parede 1',workers:2,days_at_suggested_staff:1},
  {item_id:'r1',title:'Reboco parede 1',workers:2,days_at_suggested_staff:2}
 ],{fronts:[
  {budget_item_id:'w1',work_front:'Parede 1'},
  {budget_item_id:'w2',work_front:'Parede 2'},
  {budget_item_id:'c1',work_front:'Parede 1'},
  {budget_item_id:'r1',work_front:'Parede 1'}],
  available_workers:6,execution_mode:'separate_teams'});
 assert.equal(p.ready,true);
 assert.equal(p.tasks.find(t=>t.id==='w1').start_workday,0);
 assert.equal(p.tasks.find(t=>t.id==='w2').start_workday,0);
 assert.equal(p.tasks.find(t=>t.id==='r1').start_workday,4);
 assert.equal(p.peak_workers,6);
});
test('Não aceita modo inválido nem disponibilidades globais inexistentes',()=>{
 assert.throws(()=>planResourceSchedule([a],{execution_mode:'unlimited'}),/Modo de execução inválido/);
 assert.throws(()=>planResourceSchedule([a],{execution_mode:'separate_teams',available_workers:0}),/Disponibilidade global inválida/);
});
test('Duas frentes independentes simultâneas com 10 pessoas terminam em 4 dias',()=>{
 const p=planResourceSchedule([a,b],{fronts,available_workers:10});
 assert.equal(p.workdays,4);assert.equal(p.ready,true);
 assert.equal(p.tasks[0].start_workday,0);assert.equal(p.tasks[1].start_workday,0);
 assert.equal(p.capacity_source,'informado');
});
test('As mesmas frentes com apenas 5 pessoas não duplicam funcionários',()=>{
 const p=planResourceSchedule([a,b],{fronts,available_workers:5});
 assert.equal(p.workdays,8);assert.equal(p.tasks[0].start_workday,0);
 assert.equal(p.tasks[1].start_workday,4);
});
test('Dois serviços na mesma frente não se sobrepõem mesmo com 10 pessoas',()=>{
 const p=planResourceSchedule([a,b],{available_workers:10});
 assert.equal(p.ready,true);assert.equal(p.workdays,8);
 assert.equal(p.tasks[1].start_workday,4);
});
test('Dependência entre frentes e espera tecnológica é considerada em dias úteis',()=>{
 const p=planResourceSchedule([a,b],{fronts,available_workers:10,dependencies:[
  {predecessor_item_id:'a',successor_item_id:'b',lag_workdays:2}]});
 assert.equal(p.workdays,10);assert.equal(p.tasks[1].start_workday,6);
 assert.deepEqual(p.critical_chain_dependency_only,['a','b']);
 assert.equal(p.dependency_only_workdays,10);
});
test('Espera declarada depois da atividade é considerada sem mudar seu custo de mão de obra',()=>{
 const p=planResourceSchedule([a,b],{fronts:[{budget_item_id:'a',work_front:'Sala A',wait_workdays:3},fronts[1]],
  dependencies:[{predecessor_item_id:'a',successor_item_id:'b',lag_workdays:2}],available_workers:10});
 assert.equal(p.workdays,13);assert.equal(p.tasks[1].start_workday,9);
 assert.equal(p.tasks[0].duration,4);
});
test('Grafo circular e item inexistente são rejeitados',()=>{
 const cyc=planResourceSchedule([a,b],{fronts,dependencies:[
  {predecessor_item_id:'a',successor_item_id:'b'},
  {predecessor_item_id:'b',successor_item_id:'a'}],available_workers:10});
 assert.equal(cyc.ready,false);assert.equal(cyc.reason,'Ciclo nas dependências');assert.equal(cyc.workdays,null);
 assert.throws(()=>planResourceSchedule([a,b],{dependencies:[{predecessor_item_id:'a',successor_item_id:'x'}]}),/inexistente/);
});
test('Capacidade insuficiente para um serviço bloqueia prazo da obra',()=>{
 const p=planResourceSchedule([a,b],{available_workers:4});
 assert.equal(p.ready,false);assert.equal(p.workdays,null);
 assert.match(p.errors[0],/não cobre/);
});
test('Chapisco ausente na frente de alvenaria e reboco impede fechar o prazo',()=>{
 const walls={item_id:'a',title:'ALVENARIA',workers:3,days_at_suggested_staff:8};
 const render={item_id:'b',title:'REBOCO',workers:2,days_at_suggested_staff:4};
 const p=planResourceSchedule([render,walls],{available_workers:5});
 assert.equal(p.workdays,12);assert.equal(p.ready,false);assert.equal(p.missing[0].code,'missing_chapisco');
 assert.equal(p.tasks[0].id,'a');assert.equal(p.tasks[1].id,'b');
});
test('Chapisco incluído corrige sequência sem inserir serviço no orçamento',()=>{
 const walls={item_id:'a',title:'ALVENARIA',workers:3,days_at_suggested_staff:8};
 const render={item_id:'b',title:'REBOCO',workers:2,days_at_suggested_staff:4};
 const coat={item_id:'c',title:'CHAPISCO',workers:2,days_at_suggested_staff:2};
 const p=planResourceSchedule([render,coat,walls],{available_workers:5});
 assert.equal(p.ready,true);assert.equal(p.workdays,14);
 assert.deepEqual(p.tasks.map(x=>x.stage),['alvenaria','chapisco','reboco']);
});
test('Não vincula alvenaria e reboco de frentes diferentes por suposição',()=>{
 const p=planResourceSchedule([{item_id:'a',title:'ALVENARIA',workers:3,days_at_suggested_staff:8},
  {item_id:'b',title:'REBOCO',workers:2,days_at_suggested_staff:4}],
  {fronts:[{budget_item_id:'a',work_front:'Casa'},{budget_item_id:'b',work_front:'Galpão'}],available_workers:5});
 assert.equal(p.missing.length,0);assert.equal(p.workdays,8);
});
test('Composição sem tempo de atividade não inventa cronograma final',()=>{
 const p=planResourceSchedule([a,{...b,workers:null,days_at_suggested_staff:null}],{fronts,available_workers:10});
 assert.equal(p.ready,false);assert.equal(p.workdays,null);assert.equal(p.unestimated_services,1);
});
test('UI tem frentes editáveis e API preserva bloqueio comercial',()=>{
 const ui=readFileSync(new URL('../public/secure-planning-ui.js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/index.mjs',import.meta.url),'utf8');
 const estimate=readFileSync(new URL('../src/workforce-estimate-api.mjs',import.meta.url),'utf8');
 assert.match(ui,/planning-link-form/);assert.match(ui,/planning-front-form/);
 assert.match(api,/handleBudgetPlanning/);assert.match(estimate,/planResourceSchedule/);
});
