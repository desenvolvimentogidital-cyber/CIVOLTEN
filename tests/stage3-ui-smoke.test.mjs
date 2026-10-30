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
 schedulePreview:null,scheduleSettings:null
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
 assert.ok(css.includes('@media(max-width:800px)'));
 assert.ok(css.includes('.dark'));
});
