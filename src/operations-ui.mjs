// Telas operacionais CIVOLTEN: aceite, ordem de serviço, HH reais, medição e recebimento.
import {e,icon} from './views.mjs';
import {brl} from './calc.mjs';
import {localToday} from './finance.mjs';
import {workProgress,statusLabel,measuredStatus,numberBR,billingReference,canComplete,roleMatch} from './operations.mjs';
import {fieldSummary} from './field-progress.mjs';
const money=n=>brl(Number(n)||0);
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'—';
const head=(title,back='works')=>'<div class="page-heading"><button class="small-square" data-go="'+back+'" type="button" aria-label="Voltar">'+
 icon('back',24)+'</button><h1>'+e(title)+'</h1><span class="small-square is-empty"></span></div>';
const metric=(title,value)=>'<div class="work-kpi"><small>'+title+'</small><strong>'+value+'</strong></div>';
const button=(action,label,ic='check',attrs='')=>'<button type="button" class="outlined-button work-button" data-action="'+action+'" '+attrs+'>'+
 icon(ic,17)+' '+label+'</button>';
const fld=(label,name,value='',type='text',extra='')=>
 '<label class="modal-field"><span>'+label+'</span><input type="'+type+'" name="'+name+'" value="'+e(value)+'" '+extra+'></label>';
const select=(label,name,options)=>'<label class="modal-field"><span>'+label+'</span><select name="'+name+'">'+options.join('')+'</select></label>';
const opt=(value,title)=>'<option value="'+e(value)+'">'+e(title)+'</option>';
const editor=(title,fields,submitLabel)=>'<div class="modal-inner work-editor"><div class="modal-heading"><h2>'+title+'</h2>'+
 '<button type="button" class="small-square" data-action="close-modal" aria-label="Fechar">×</button></div>'+
 '<form id="work-form"><div class="modal-fields">'+fields+'</div>'+
 '<p class="form-error" id="work-form-error" role="alert" hidden></p>'+
 '<div class="modal-buttons"><button type="button" class="outlined-button" data-action="close-modal">Cancelar</button>'+
 '<button type="submit" class="gold-button">'+icon('check',17)+' '+submitLabel+'</button></div></form></div>';
export function worksView(data){
 const orders=(data.works||[]).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
 const counts={approved:0,in_progress:0,completed:0,cancelled:0};
 for(const w of orders)counts[w.status]=(counts[w.status]||0)+1;
 return '<section class="fin-screen work-screen">'+head('Obras e execução','home')+
 '<p class="fin-intro">Do aceite da proposta à execução da mão de obra, medição e recebimento. Todos os registros ficam vinculados à obra e salvos no Supabase.</p>'+
 '<div class="work-kpis">'+metric('Obras em execução',counts.in_progress)+metric('Aguardando início',counts.approved)+
 metric('Concluídas',counts.completed)+'</div>'+
 (orders.length?'<div class="work-order-list">'+orders.map(w=>{
 const p=workProgress(w,data.workLogs,data.measurements);
 const physical=fieldSummary(w,data);
 return '<button type="button" class="work-order-row" data-action="work-open" data-id="'+e(w.id)+'">'+
 '<small>'+e(w.contractRef)+' · '+(statusLabel[w.status]||w.status)+'</small><strong>'+e(w.project||w.customer)+'</strong>'+
 '<span>'+e(w.customer)+' · Contrato '+money(Math.round(w.contractValue*100))+'</span>'+
 '<span>Medido '+money(p.approvedCents)+' · '+numberBR(p.percent)+'% do valor contratado</span>'+
 '<span>Campo digital: '+numberBR(physical.percentage)+'% de avanço físico · '+
  physical.done+'/'+physical.total+' serviços concluídos</span>'+
 '</button>';
 }).join('')+'</div>':
 '<p class="fin-empty">Nenhuma obra aprovada. Abra um orçamento comercial salvo e registre o aceite real do cliente para criar a ordem de serviço.</p>')+
 '<div class="fin-link-row"><button type="button" data-go="budgets">Abrir orçamentos '+icon('chevron',17)+'</button></div>'+
 '<p class="fin-helper">O registro do aceite não é uma assinatura eletrônica. Guarde o contrato ou autorização do cliente também nos seus arquivos.</p></section>';
}
export function workDetailView(data,id){
 const w=(data.works||[]).find(x=>x.id===id);
 if(!w)return '<section class="fin-screen">'+head('Obra não encontrada')+'<p class="fin-empty">Sincronize os registros.</p></section>';
 const logs=(data.workLogs||[]).filter(x=>x.workOrderId===id).sort((a,b)=>b.workDate.localeCompare(a.workDate));
 const measures=(data.measurements||[]).filter(x=>x.workOrderId===id)
  .sort((a,b)=>b.measuredOn.localeCompare(a.measuredOn));
 const progress=workProgress(w,logs,measures);
 const physical=fieldSummary(w,data);
 const due=measures.filter(m=>m.status==='approved'&&!data.ledger.some(x=>x.reference===billingReference(m)));
 const income=measures.reduce((n,m)=>{
  const e=data.ledger.find(x=>x.reference===billingReference(m));
  return n+(e?.paidDate?Math.round(e.amount*100):0);
 },0);
 return '<section class="fin-screen work-screen">'+head('Execução da obra')+
 '<div class="work-header"><span>'+e(w.contractRef)+' · '+e(statusLabel[w.status]||w.status)+'</span>'+
 '<h2>'+e(w.project||w.customer)+'</h2><p>'+e(w.customer)+'</p>'+
 '<small>Aceite: '+date(w.approvedOn)+' · Referência: '+e(w.acceptanceRef)+'</small></div>'+
 '<div class="work-kpis">'+metric('Valor contratado',money(progress.contractCents))+
 metric('Medição aprovada',money(progress.approvedCents))+
 metric('Saldo a medir',money(progress.balanceCents))+
 metric('Recebido',money(income))+
 metric('HH planejadas',numberBR(progress.plannedHH))+
 metric('HH realizadas',numberBR(progress.actualHH))+
 metric('Custo gerencial das HH reais',money(progress.actualCostCents))+'</div>'+
 '<p class="fin-helper">Custo realizado estimado = HH apontadas × custo por HH da proposta aprovada. Despesas extras e mudanças salariais não são lançadas automaticamente.</p>'+
 '<div class="work-progress"><div style="width:'+Math.max(0,Math.min(100,progress.percent))+'%"></div></div>'+
 '<p class="fin-helper">'+numberBR(progress.percent)+'% do valor contratado aprovado em medições. Medições em conferência não são faturadas.</p>'+
 '<div class="work-actions">'+
 (w.status==='approved'?button('work-start','Iniciar execução','check')+
 button('work-cancel','Cancelar OS não iniciada','trash'):'')+
 (w.status==='in_progress'?button('work-log-new','Apontar horas trabalhadas','clock')+
  button('work-measure-new','Registrar medição','clipboard')+
  button('work-complete','Concluir obra','check',
   (canComplete(w,logs,measures)?'':'disabled title="Conclua as medições e registre as horas reais"')):'')+
 button('work-export','Exportar relatório CSV','file')+
 button('work-contract-print','Visualizar / PDF da OS','file')+
 button('work-schedule-print','Cronograma para campo / PDF','calendar')+
 button('work-field-open','Acompanhamento digital do cronograma','clipboard')+'</div>'+
 '<div class="work-field-summary"><strong>Avanço físico no campo: '+numberBR(physical.percentage)+'%</strong>'+
 '<p>'+physical.done+' de '+physical.total+' serviço(s) concluído(s), '+
  physical.active+' em execução e '+physical.blocked+' paralisado(s).</p>'+
 '<div class="field-progress-bar"><span style="width:'+Math.min(100,Math.max(0,physical.percentage))+'%"></span></div>'+
 '<small>Separado dos '+numberBR(progress.percent)+'% aprovados em medições.</small></div>'+
 (w.status==='approved'?'<p class="fin-helper">Após conferir o aceite, inicie a obra para registrar a equipe, horas e medições.</p>':'')+
 '<div class="fin-section-title"><h2>Serviços contratados</h2></div>'+
 '<div class="work-lines">'+progress.items.map(x=>{
 const roles=(x.roles||[]).map(r=>r.role).join(', ');
 return '<div class="work-line"><strong>'+e(x.description)+'</strong><small>'+
 numberBR(x.target)+' '+e(x.unit)+' contratados · '+numberBR(x.plannedHH)+' HH previstas'+
 (roles?' · Funções: '+e(roles):'')+'</small>'+
 '<span>'+numberBR(x.measuredQty)+' medidos e aprovados · '+numberBR(x.remaining)+' disponíveis para novas medições</span>'+
 '<span>HH realizadas: '+numberBR(x.hours)+' · Medido: '+money(x.measuredCents)+'</span></div>';
 }).join('')+'</div>'+
 '<div class="fin-section-title"><h2>Medições ('+measures.length+')</h2></div>'+
 (measures.length?'<div class="work-lines">'+measures.map(m=>{
 const x=progress.items.find(z=>z.id===m.itemId);
 const billed=data.ledger.find(l=>l.reference===billingReference(m));
 return '<div class="work-line"><strong>'+e(x?.description||'Serviço')+'</strong>'+
 '<small>'+date(m.measuredOn)+' · '+numberBR(m.quantity)+' '+e(x?.unit||'')+' · '+money(Math.round(m.amount*100))+'</small>'+
 '<span>'+e(measuredStatus[m.status]||m.status)+(billed?' · Cobrança registrada'+(billed.paidDate?' e recebida':' e aberta'):'')+'</span>'+
 (m.status==='draft'&&w.status==='in_progress'?button('work-measure-approve','Aprovar medição','check','data-id="'+e(m.id)+'"'):'')+
 (m.status==='draft'&&w.status==='in_progress'?button('work-measure-delete','Excluir medição incorreta','trash','data-id="'+e(m.id)+'"'):'')+
 (m.status==='approved'&&!billed?button('work-measure-bill','Lançar a receber','coins','data-id="'+e(m.id)+'"'):'')+
 '</div>';
 }).join('')+'</div>':'<p class="fin-empty">Nenhuma medição registrada.</p>')+
 (due.length?'<p class="fin-helper">'+due.length+' medição(ões) aprovadas ainda sem lançamento no Financeiro.</p>':'')+
 '<div class="fin-section-title"><h2>Apontamentos de horas ('+logs.length+')</h2></div>'+
 (logs.length?'<div class="work-lines">'+logs.map(l=>{
 const employee=data.employees.find(x=>x.id===l.employeeId);
 const item=progress.items.find(x=>x.id===l.itemId);
 return '<div class="work-line"><strong>'+e(employee?.name||'Funcionário cadastrado')+'</strong>'+
 '<small>'+date(l.workDate)+' · '+numberBR(l.hours)+' HH · '+e(item?.description||'Serviço')+'</small>'+
 (l.notes?'<span>'+e(l.notes)+'</span>':'')+
 (w.status==='in_progress'?button('work-log-delete','Excluir apontamento incorreto','trash',
  'data-id="'+e(l.id)+'"'):'')+'</div>';
 }).join('')+'</div>':'<p class="fin-empty">Nenhuma hora real apontada.</p>')+
 '<div class="fin-link-row"><button type="button" data-go="finance">Abrir Financeiro '+icon('chevron',17)+'</button></div>'+
 '<p class="fin-helper">Medição e contas a receber são controles gerenciais. A nota fiscal oficial, os documentos assinados e as obrigações legais continuam externos ao sistema.</p></section>';
}
export function workApprovalDialog(budget,invitation=null){
 const accepted=invitation?.status==='accepted';
 const electronicEvidence=accepted?
  ('Aceite eletrônico CIVOLTEN nº '+invitation.id+' por '+
   invitation.respondentName+' ('+invitation.respondentEmail+')').slice(0,240):'';
 const number='OS-'+new Date().getFullYear()+'-'+String(budget.id||'').slice(0,8).toUpperCase();
 const inputs=fld('Número da ordem de serviço','contractRef',number,'text','maxlength="80" required')+
 fld('Referência do aceite real do cliente','acceptanceRef',electronicEvidence,'text',
  'maxlength="240" required '+(accepted?'readonly':
   'placeholder="Ex.: contrato assinado, e-mail ou WhatsApp"'))+
 fld('Data do aceite','approvedOn',accepted?invitation.respondedAt.slice(0,10):localToday(),
   'date','required '+(accepted?'readonly':''))+
 fld('Início planejado (opcional)','startOn','','date')+
 (accepted?'<p class="fin-helper">Aceite recebido diretamente no link do PDF, declarado por '+
 e(invitation.respondentName)+' · '+e(invitation.respondentEmail)+
 '. Confira a identificação do responsável antes de abrir a obra.</p>':'')+
 '<label class="work-check"><input type="checkbox" name="acceptanceConfirmed" required>'+
 'Confirmo que conferi a autorização do cliente, o escopo e as condições antes de abrir a obra.</label>'+
 '<p class="fin-helper">O preço, itens, HH e condições da proposta ficam congelados nesta OS. A referência não substitui o documento assinado.</p>';
 return editor('Abrir obra a partir da proposta',inputs,'Registrar aceite e criar obra');
}
export function workLogDialog(order,employees){
 const options=(employees||[]).filter(x=>x.active!==false).map(e=>opt(e.id,e.name+' · '+e.role));
 if(!options.length)return editor('Apontar horas','<p class="fin-empty">Cadastre um profissional ativo antes de registrar horas.</p>','Salvar');
 const inputs=select('Serviço executado','itemId',order.budgetSnapshot.items.map(i=>opt(i.id,i.description)))+
 select('Profissional que trabalhou','employeeId',options)+
 fld('Data da execução','workDate',localToday(),'date','required')+
 fld('Horas reais trabalhadas','hours','8','number','min="0.01" max="24" step="0.01" required')+
 '<label class="work-check"><input type="checkbox" name="qualificationConfirmed">'+
 'Confirmo a qualificação do profissional para este serviço se sua função for diferente da composição SIURB.</label>'+
 '<label class="modal-field"><span>Observações do dia</span><textarea name="notes" rows="2" maxlength="900"></textarea></label>'+
 '<p class="fin-helper">O apontamento identifica a pessoa, o serviço e a data. Não altera horas previstas nem folha de pagamento.</p>';
 return editor('Apontar mão de obra executada',inputs,'Salvar horas reais');
}
export function workMeasurementDialog(order,measurements=[]){
 const p=workProgress(order,[],measurements);
 const available=p.items.filter(x=>x.remaining>0);
 if(!available.length)return editor('Medição','<p class="fin-empty">Todos os quantitativos previstos já foram medidos.</p>','Salvar');
 const inputs=select('Serviço executado','itemId',available.map(i=>opt(i.id,
  i.description+' · saldo '+numberBR(i.remaining)+' '+i.unit)))+
 fld('Data da medição','measuredOn',localToday(),'date','required')+
 fld('Quantidade executada (não HH)','quantity','','number','step="0.001" min="0.001" required')+
 '<label class="modal-field"><span>Observações / evidência</span><textarea name="notes" rows="2" maxlength="900"></textarea></label>'+
 '<p class="fin-helper">O valor é proporcional à linha da proposta aprovada, calculado pelo banco. Uma segunda ação sua aprova a medição; só então pode gerar contas a receber.</p>';
 return editor('Registrar medição de serviço',inputs,'Salvar medição para conferência');
}
export function workBillingDialog(measurement){
 const inputs='<p class="fin-helper">Medição aprovada de '+numberBR(measurement.quantity)+
 ' unidade(s). O valor já foi validado no contrato.</p>'+
 fld('Vencimento do valor a receber','dueDate',localToday(),'date','required')+
 '<p class="fin-helper">Cria uma conta a receber no Financeiro, sem registrar pagamento e sem emitir nota fiscal. Operação idempotente: não gera duplicidade.</p>';
 return editor('Lançar medição no Financeiro',inputs,'Registrar a receber');
}
// Mantém a interface pública utilizada pelo app e pelos testes.
export {workPrintable} from './work-order-print.mjs';
