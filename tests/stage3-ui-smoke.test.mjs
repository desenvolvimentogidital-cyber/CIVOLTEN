import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {schedulePage,scheduleDialog} from '../public/secure-schedule.js';
const a='00000000-0000-4000-8000-000000000001',c='00000000-0000-4000-8000-000000000002';
const esc=s=>String(s??'').replace(/[&<>"']/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]));
const state=()=>({
 user:{role:'administrador'},
 detail:{code:'ORC-2026-QA',id:a,items:[{id:c,source_name:'Serviço QA'}]},
 schedulePlan:{budget:{status:'rascunho',lock_version:3},
  crews:[{id:a,title:'Civil',workday_hours:8,efficiency:0.85,workers:2,roles:[{role_name:'Pedreiro',workers:2}]}],
  tasks:[{id:c,title:'Piso QA',crew_id:a,duration_review_state:'revisado',days_estimated:4}],
  dependencies:[]},
 scheduleProgress:{measurements:[{id:a,task_id:c,task_title:'Piso QA',review_status:'pendente',
  worked_on:'2026-10-29',completed_quantity:8,actual_person_hours:16,
  evidence_ref:'DOC-QA-0001',evidence_notes:'Evidência fictícia de horas e área'}],
  summaries:[{task_id:c,title:'Piso QA',completed_quantity:0,validated_person_hours:0,
   observed_hh_per_unit:null,progress_pct:null}]},
 scheduleRemaining:{ready:false,errors:['Sem produtividade observada aprovada'],
  items:[{id:c,title:'Piso QA',remaining_quantity:100,estimated_remaining_workdays:null}]},
 schedulePreview:null,scheduleSettings:null,scheduleAdvanced:true
});
test('cronograma inicial mostra serviços automaticamente e não exige cadastrar equipe',()=>{
 const x=state();
 x.scheduleAdvanced=false;
 x.scheduleWorkforce={
  budget:{code:'ORC-2026-QA'},settings:{target_days:10,hours_day:8,efficiency_pct:85,crew_size:4},
  summary:{total_services:1,simultaneous_workers:3,simultaneous_crews:1,sequential_peak_crews:1,without_productivity:0},
  services:[{id:c,code:'QA-102',title:'ALVENARIA DE BLOCO',quantity:'100',unit:'M2',workers:3,crews:1,
   estimated_hh:200,hh_per_unit:2,days_at_suggested_staff:10,roles:[{name:'Pedreiro',workers:2},{name:'Servente',workers:1}],
   reviewed:false}],
  notice:'Hipótese de dimensionamento',assumptions:'Prazo não confirmado'
 };
 const s=schedulePage({state:x,esc,writeable:()=>true});
 assert.match(s,/ALVENARIA DE BLOCO/);
 assert.match(s,/Pedreiro/);
 assert.match(s,/Ajudante \/ servente/);
 assert.match(s,/Equipes · paralelo/);
 assert.match(s,/data-action="schedule-back"/);
 assert.doesNotMatch(s,/data-action="schedule-add-crew"/);
 assert.doesNotMatch(s,/data-action="schedule-add-task"/);
 assert.doesNotMatch(s,/Equipes cadastradas/);
 assert.doesNotMatch(s,/Cadastre uma equipe antes/);
 assert.match(s,/data-action="schedule-advanced-open"/);
});

test('painel exibe todas as operações, restrições e previsão bloqueada',()=>{
 const s=schedulePage({state:state(),esc,writeable:()=>true});
 for(const action of ['schedule-edit-crew','schedule-archive-crew','schedule-edit-task',
  'schedule-archive-task','schedule-review-task','schedule-add-progress',
  'schedule-review-progress','schedule-run-remaining'])
  assert.ok(s.includes('data-action="'+action+'"'),action);
 assert.ok(s.includes('Sem produtividade observada aprovada'));
 assert.ok(s.includes('DOC-QA-0001'));
 assert.ok(s.includes('Diário de execução'));
 assert.ok(s.includes('Previsão operacional'));
});
test('perfil consulta não recebe controles de escrita ou aprovação',()=>{
 const x=state();x.user.role='consulta';
 const s=schedulePage({state:x,esc,writeable:()=>false});
 for(const action of ['schedule-edit-crew','schedule-archive-crew',
  'schedule-edit-task','schedule-archive-task','schedule-review-task',
  'schedule-add-progress','schedule-review-progress'])
  assert.ok(!s.includes('data-action="'+action+'"'),action);
 assert.ok(s.includes('DOC-QA-0001'));
});
test('edição de equipe/atividade exige explicação sobre medição e revogação de duração',()=>{
 const x=state(),dialogs=[];
 const dialog=(title,body)=>dialogs.push({title,body});
 const field=(label,name,type,required,value='')=>'<input name="'+name+'" value="'+esc(value)+'">';
 const params={state:x,dialog,field,esc};
 x.scheduleTaskId=a;assert.equal(scheduleDialog('schedule-edit-crew',params),true);
 x.scheduleTaskId=c;assert.equal(scheduleDialog('schedule-edit-task',params),true);
 assert.ok(dialogs[0].body.includes('schedule-crew-edit-form'));
 assert.ok(dialogs[1].body.includes('schedule-task-edit-form'));
 assert.ok(dialogs[1].body.includes('revoga a revisão'));
});
test('layout mantém modo claro/escuro e Gantt para celular',async()=>{
 const css=await readFile(new URL('../public/secure.css',import.meta.url),'utf8');
 assert.ok(css.includes('.schedule-gantt-row'));
 assert.ok(css.includes('@media(max-width:900px)'));
 assert.ok(css.includes("@import url('/style.css')"));
 const html=await readFile(new URL('../public/secure.html',import.meta.url),'utf8');
 assert.ok(html.includes('document.documentElement.dataset.theme'));
});
