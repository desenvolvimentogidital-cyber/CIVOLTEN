// CIVOLTEN · Cronograma de Campo em PDF A4, preenchimento manual.
// Somente estimativas operacionais, sem preços nem mudanças nos dados salvos.
import {e} from './views.mjs';
import {schedulePlan,dateBR} from './budget-schedule.mjs';
import {numberBR} from './operations.mjs';

const logo='/assets/civolten-logo.png';
const symbol='/assets/civolten-simbolo.png';
const value=(text,empty='Não informado')=>e(String(text??'').trim()||empty);
const formatDate=value=>dateBR(value)||'A definir';
const workingDays=(start,end)=>{
 if(!start)return '—';
 return start===end?'Dia '+start:'Dias '+start+'–'+end;
};
export function workSchedulePlan(order){
 if(!order?.budgetSnapshot?.items?.length)
  throw Error('A ordem de serviço não possui serviços para o cronograma.');
 const b=order.budgetSnapshot;
 const schedule={...(b.commercial?.schedule||{})};
 // Recalcula as datas a partir do início registrado na OS, sem alterar a proposta.
 if(/^\d{4}-\d{2}-\d{2}$/.test(order.startOn||''))
  schedule.startDate=order.startOn;
 const p=schedulePlan(b.items,schedule,b.pricing||{});
 if(!p?.rows?.length||!p.days||!p.totalHours)
  throw Error('A obra precisa de HH e capacidade produtiva para gerar o cronograma.');
 return p;
}
export function paginateFieldSchedule(rows){
 const source=Array.isArray(rows)?rows:[];
 if(!source.length)return [[]];
 if(source.length<=5)return [source.slice()];
 const left=source.slice(),pages=[];
 pages.push(left.splice(0,5));
 while(left.length>5)pages.push(left.splice(0,Math.min(7,left.length-5)));
 if(left.length)pages.push(left);
 return pages;
}
const brand=()=>'<header class="field-schedule-header">'+
 '<div class="field-schedule-brand">'+
 '<img class="field-schedule-icon" src="'+symbol+'" alt="Símbolo CIVOLTEN">'+
 '<span class="field-schedule-brand-divider"></span>'+
 '<img class="field-schedule-logo" src="'+logo+'" alt="CIVOLTEN — Elétrica & Construção Civil">'+
 '</div><span class="field-schedule-header-accent"></span></header>';
const intro=(context,continued)=>'<div class="field-schedule-title">'+
 '<div><span class="field-schedule-eyebrow">PLANEJAMENTO OPERACIONAL · SOMENTE MÃO DE OBRA</span>'+
 '<h1>CRONOGRAMA DE CAMPO</h1>'+
 '<p>'+(continued?'Continuação dos serviços previstos':'Acompanhamento de execução e conferência diária')+'</p></div>'+
 '<strong class="field-schedule-stamp">PARA CONFERÊNCIA</strong></div>'+
 '<div class="field-schedule-context">'+
 '<span><b>OBRA</b>'+value(context.project||context.title)+'</span>'+
 '<span><b>CLIENTE</b>'+value(context.customer)+'</span>'+
 '<span><b>REFERÊNCIA</b>'+value(context.ref||'Cronograma preliminar')+'</span>'+
 '</div>';
const summary=plan=>'<div class="field-schedule-summary">'+
 '<div><span>PRAZO ESTIMADO</span><strong>'+numberBR(plan.days)+' dias úteis</strong></div>'+
 '<div><span>EQUIPE PREVISTA</span><strong>'+numberBR(plan.crew)+' profissionais</strong></div>'+
 '<div><span>HH PLANEJADAS</span><strong>'+numberBR(plan.totalHours)+' HH</strong></div>'+
 '</div>'+
 '<p class="field-schedule-dates">Período estimado: <b>'+formatDate(plan.startDate)+
 '</b> até <b>'+formatDate(plan.endDate)+'</b> · '+numberBR(plan.hoursPerDay)+' h por profissional/dia</p>';
const checkbox=(label)=>'<span class="field-schedule-check"><i aria-hidden="true"></i> '+label+'</span>';
const serviceTable=(rows,items)=>'<section class="field-schedule-list" aria-label="Serviços e marcações de campo">'+
 '<table><thead><tr><th>ATIVIDADE / SERVIÇO</th><th>QUANTIDADE</th>'+
 '<th>PREVISÃO</th><th>MARCAÇÃO EM CAMPO</th></tr></thead><tbody>'+
 rows.map(row=>{
  const original=items?.find(x=>x.id===row.id);
  const roles=(original?.roles||[]).map(x=>x.role).filter(Boolean).slice(0,3).join(' · ');
  return '<tr>'+
   '<td><strong>'+value(row.description)+'</strong>'+
   '<small>'+numberBR(row.hours)+' HH previstas'+(roles?' · '+value(roles):'')+'</small></td>'+
   '<td class="field-schedule-qty"><b>'+numberBR(row.quantity)+'</b><small>'+value(row.unit,'un')+'</small></td>'+
   '<td class="field-schedule-period"><b>'+workingDays(row.startDay,row.endDay)+'</b>'+
   '<small>'+formatDate(row.startDate)+'</small>'+
   '<small>até '+formatDate(row.endDate)+'</small></td>'+
   '<td class="field-schedule-mark">'+
   checkbox('Pendente')+checkbox('Em execução')+checkbox('Concluído')+
   '<small>Data: ____ / ____</small></td></tr>';
 }).join('')+'</tbody></table></section>';
const signoff=()=>'<section class="field-schedule-checkout">'+
 '<div class="field-schedule-notes"><b>REGISTRO DE CAMPO / OCORRÊNCIAS</b>'+
 '<div class="field-schedule-writing-line"></div><div class="field-schedule-writing-line"></div>'+
 '<div class="field-schedule-writing-line"></div></div>'+
 '<div class="field-schedule-validation">'+
 '<div>Data da conferência: ____ / ____ / ______</div>'+
 '<div>Profissional responsável: ___________________________</div>'+
 '<div>Assinatura / visto: ________________________________</div></div>'+
 '</section>';
const foot=(n,total)=>'<footer class="field-schedule-footer">'+
 '<p>Estimativa baseada em HH. Dias úteis de segunda a sexta, sem feriados, clima, interferências ou dependências técnicas.'+
 ' Marcação manual não substitui os apontamentos e medições no CIVOLTEN.</p>'+
 '<span>CRONOGRAMA · '+n+' / '+total+'</span><i aria-hidden="true"></i></footer>';
export function printableFieldSchedule(plan,context={}){
 if(!plan?.rows?.length||!plan?.days||!plan?.totalHours)
  throw Error('Preencha serviços, HH e equipe antes de imprimir o cronograma.');
 const pages=paginateFieldSchedule(plan.rows),total=pages.length;
 return '<section class="field-schedule-document" aria-label="Cronograma operacional CIVOLTEN para campo">'+
 pages.map((rows,index)=>'<article class="field-schedule-page" data-field-schedule-page="'+(index+1)+'">'+
  brand()+'<div class="field-schedule-body">'+
  intro(context,index>0)+
  (index===0?summary(plan):'')+
  serviceTable(rows,context.items||[])+
  (index===total-1?signoff():'')+
  '</div>'+foot(index+1,total)+'</article>').join('')+'</section>';
}
