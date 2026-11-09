// Páginas móveis de acompanhamento físico por serviço, independentes do Financeiro.
import {e,icon} from './views.mjs';
import {numberBR} from './operations.mjs';
import {dateBR} from './budget-schedule.mjs';
import {fieldRows,fieldSummary,FIELD_STATES} from './field-progress.mjs';
import {workSchedulePlan} from './schedule-print.mjs';
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?dateBR(v):'A definir';
const prettyStatus=s=>FIELD_STATES[s]||'Pendente';
const options=[['all','Todos'],['pending','Pendentes'],['in_progress','Em execução'],
 ['blocked','Paralisados'],['done','Concluídos']];
const percent=n=>Math.round(n*10)/10;
export function fieldTrackingRows(work,data,filter='all',search=''){
 const term=String(search).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 return fieldRows(work,data).filter(row=>{
  if(filter!=='all'&&row.status!==filter)return false;
  const str=(String(row.item.description||'')+' '+String(row.item.sourceCode||'')) 
   .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return !term||str.includes(term);
 });
}
export function fieldListHtml(work,data,filter='all',search=''){
 const rows=fieldTrackingRows(work,data,filter,search);
 let timeline=new Map();
 try{timeline=new Map(workSchedulePlan(work).rows.map(r=>[r.id,r]));}
 catch{/* A ausência de cronograma não apaga o acompanhamento da obra. */}
 if(!rows.length)return '<p class="fin-empty">Nenhum serviço encontrado neste filtro.</p>';
 return rows.map(r=>{
  const plan=timeline.get(r.item.id);
  const employee=data.employees.find(p=>p.id===r.progress?.employeeId);
  const last=r.progress?.observedOn;
  return '<article class="field-progress-card '+e(r.status)+'">'+
   '<div class="field-progress-top"><span class="field-progress-state">'+
    e(prettyStatus(r.status))+'</span><b>'+percent(r.percentage)+'%</b></div>'+
   '<h3>'+e(r.item.description)+'</h3>'+
   '<p>'+numberBR(r.executed)+' de '+numberBR(r.target)+' '+e(r.item.unit||'un')+
    ' executados</p>'+
   '<div class="field-progress-bar" role="meter" aria-label="Avanço físico" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent(r.percentage)+'">'+
    '<span style="width:'+percent(r.percentage)+'%"></span></div>'+
   (plan?'<small>Previsão: '+date(plan.startDate)+' até '+date(plan.endDate)+'</small>':'')+
   (employee?'<small>Responsável: '+e(employee.name)+'</small>':'')+
   (last?'<small>Atualizado em '+date(last)+'</small>':'')+
   (r.progress?.notes?'<p class="field-progress-note">'+e(r.progress.notes)+'</p>':'')+
   (r.progress?.photoPaths?.length?'<span class="field-progress-photos">'+icon('camera',15)+
     ' '+r.progress.photoPaths.length+' foto(s) guardada(s)</span>':'')+
   (work.status==='in_progress'?
    '<button type="button" class="outlined-button field-progress-edit" data-action="field-edit" data-id="'+e(r.item.id)+'">'+
     icon('edit',17)+' Atualizar serviço</button>':'')+'</article>';
 }).join('');
}
export function fieldProgressView(data,workId,filter='all',search=''){
 const work=data.works.find(x=>x.id===workId);
 if(!work)return '<section class="fin-screen"><p class="fin-empty">Obra não encontrada.</p>'+
  '<button data-go="works" type="button">Voltar às obras</button></section>';
 const summary=fieldSummary(work,data);
 const tabs=options.map(([id,label])=>
  '<button type="button" class="field-progress-tab '+(filter===id?'active':'')+
  '" data-field-filter="'+id+'" aria-pressed="'+(filter===id)+'">'+e(label)+'</button>').join('');
 return '<section class="fin-screen field-progress-screen">'+
  '<div class="page-heading"><button class="small-square" data-go="work-detail" type="button" aria-label="Voltar à obra">'+
   icon('back',23)+'</button><h1>Diário de campo</h1><span class="small-square is-empty"></span></div>'+
  '<div class="field-progress-heading"><small>'+e(work.contractRef)+' · '+e(work.customer)+'</small>'+
   '<h2>'+e(work.project||work.customer)+'</h2>'+
   '<p>Acompanhamento físico do cronograma, sem valores financeiros.</p></div>'+
  '<div class="field-progress-stat"><strong>'+numberBR(summary.percentage)+'%</strong>'+
   '<span>Avanço físico estimado pelas HH dos serviços</span>'+
   '<div class="field-progress-bar"><span style="width:'+percent(summary.percentage)+'%"></span></div></div>'+
  '<div class="field-progress-kpis"><div><b>'+summary.done+'/'+summary.total+'</b><span>Concluídos</span></div>'+
   '<div><b>'+summary.active+'</b><span>Em execução</span></div>'+
   '<div><b>'+summary.blocked+'</b><span>Paralisados</span></div></div>'+
  (work.status!=='in_progress'?'<p class="fin-helper">A obra está '+e(work.status==='completed'?'concluída':
   work.status==='approved'?'aguardando início':'cancelada')+
   '. O registro digital fica disponível para consulta, mas só pode ser atualizado durante a execução.</p>':'')+
  '<label class="field-progress-search-label" for="field-search">Buscar serviço</label>'+
  '<input id="field-search" type="search" placeholder="Nome ou código do serviço" value="'+e(search)+'" aria-controls="field-result-list">'+
  '<div class="field-progress-tabs" role="group" aria-label="Filtrar andamento">'+tabs+'</div>'+
  '<div id="field-result-list">'+fieldListHtml(work,data,filter,search)+'</div>'+
  '<p class="fin-helper field-progress-warning">Marcar o serviço no campo não registra horas trabalhadas, não aprova medição e não emite cobrança. Lance as HH e medições separadamente na tela da obra.</p>'+
  '<button class="outlined-button" type="button" data-go="work-detail">'+icon('back',18)+' Voltar para a execução da obra</button>'+
 '</section>';
}
export function fieldEditDialog(work,data,itemId){
 const item=work.budgetSnapshot?.items?.find(x=>x.id===itemId);
 if(!item)throw Error('Serviço não encontrado.');
 const old=(data.fieldProgress||[]).find(x=>x.workOrderId===work.id&&x.itemId===item.id);
 const quantity=old?.executedQuantity??0;
 const on=old?.observedOn||new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const status=old?.status||'pending';
 const employees=(data.employees||[]).filter(x=>x.active!==false).map(x=>
  '<option value="'+e(x.id)+'"'+(old?.employeeId===x.id?' selected':'')+'>'+e(x.name)+' · '+e(x.role||'Equipe')+'</option>').join('');
 return '<div class="modal-inner field-editor"><div class="modal-heading"><h2>Atualizar serviço</h2>'+
  '<button type="button" class="small-square" data-action="close-modal" aria-label="Fechar">×</button></div>'+
  '<form id="field-progress-form" data-item-id="'+e(item.id)+'">'+
  '<p class="fin-helper">'+e(item.description)+'</p>'+
  '<p class="field-target">Contratado: <b>'+numberBR(Number(item.quantity))+' '+e(item.unit)+'</b></p>'+
  '<div class="modal-fields">'+
   '<label class="modal-field"><span>Situação atual</span><select name="status" required>'+
    Object.entries(FIELD_STATES).map(([key,label])=>
    '<option value="'+key+'"'+(status===key?' selected':'')+'>'+e(label)+'</option>').join('')+'</select></label>'+
   '<label class="modal-field"><span>Quantidade já executada ('+e(item.unit)+')</span>'+
    '<input type="number" name="executedQuantity" min="0" max="'+Number(item.quantity)+
    '" step=".001" inputmode="decimal" required value="'+e(quantity)+'"></label>'+
   '<label class="modal-field"><span>Profissional responsável</span><select name="employeeId">'+
    '<option value="">Não atribuído</option>'+employees+'</select></label>'+
   '<label class="modal-field"><span>Data da conferência em campo</span>'+
    '<input type="date" name="observedOn" value="'+e(on)+'" required></label>'+
   '<label class="modal-field"><span>Observações e ocorrências</span>'+
    '<textarea name="notes" rows="3" maxlength="1200" placeholder="Ex.: serviço executado no bloco A, falta liberar frente B">'+e(old?.notes||'')+'</textarea></label>'+
   '<label class="modal-field"><span>Fotos da execução (opcional, até 3 no total)</span>'+
    '<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple>'+
    '<small>Fotos ficam privadas na sua conta. O aplicativo reduz o tamanho antes de enviar.</small></label>'+
  '</div>'+
  '<div class="field-existing-photos" id="field-existing-photos">'+
   (old?.photoPaths?.length?'<strong>Fotos já registradas ('+old.photoPaths.length+')</strong><p>Carregando acesso privado...</p>':
    '<small>Nenhuma foto registrada.</small>')+'</div>'+
  '<p class="form-error" id="field-form-error" role="alert" hidden></p>'+
  '<div class="modal-buttons">'+
   '<button type="button" class="outlined-button" data-action="close-modal">Cancelar</button>'+
   '<button type="submit" class="gold-button">'+icon('check',18)+' Salvar andamento</button></div>'+
  '</form></div>';
}
