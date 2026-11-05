/* CIVOLTEN — Resumo técnico COMERCIAL da proposta.
 * Mostra quantidade, equipe, duração e preço global.
 * Nunca revela salários, custos de funcionários ou encargos ao cliente.
 * Usa somente produtividade confirmada; dados ficam congelados na proposta salva.
 */
(function(){
'use strict';
const clean=v=>String(v??'');
const n=v=>{const x=Number(String(v??0).replace(',','.'));return Number.isFinite(x)&&x>0?x:0};
const decimal=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
const toISO=d=>d instanceof Date&&!isNaN(d.getTime())?d.toISOString().slice(0,10):'';
const fmtDateBR=iso=>/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4):'A definir';
const fmtStaff=a=>a.map(x=>x.count+' '+x.role).join(' · ');

function fingerprint(q){
 const sch=q.schedule||{};
 return JSON.stringify({
  items:(q.items||[]).map(i=>({
   id:i.id,service:i.service,qty:i.qty,unit:i.unit,workerId:i.workerId,
   hoursUnit:i.hoursUnit,workersCount:i.workersCount,productivity:i.productivity
  })),
  schedule:{startDate:sch.startDate,targetDays:sch.targetDays,
   productiveHoursDay:sch.productiveHoursDay,paidHoursDay:sch.paidHoursDay,
   mode:sch.mode,staffOverrides:sch.staffOverrides}
 });
}
function build(q){
 const api=window.CIVOLTENSchedule;
 if(!api||typeof api.calculate!=='function')return null;
 if(!q?.schedule?.confirmed||!(q.items||[]).length)return null;
 const f=api.calculate(q);
 if(f.missing||!f.staffing.length||!f.projectDays||f.projectDays>f.days)return null;
 const team=f.staffing.map(r=>({role:r.name,count:r.assigned})).filter(r=>r.count>0);
 if(!team.length)return null;
 const services=f.lines.map(row=>{
  if(row.missing||!row.duration)return null;
  const roles=row.roles.map(r=>{
   const allocated=f.staffing.find(x=>x.key===r.key);
   return {role:r.role,count:allocated?.assigned||r.baseCount||1};
  });
  return {
   id:row.item?.id||'',service:clean(row.item?.service||'Serviço'),
   quantity:n(row.item?.qty),unit:clean(row.item?.unit||'un'),
   hours:row.roles.reduce((sum,r)=>sum+n(r.hours),0),
   workingDays:row.duration,startDate:toISO(row.start),endDate:toISO(row.end),
   staffing:roles
  };
 }).filter(Boolean);
 if(services.length!==q.items.length)return null;
 return {
  version:1,
  fingerprint:fingerprint(q),
  source:'Produtividade cadastrada e cronograma conferido na CIVOLTEN',
  totalHours:f.staffing.reduce((sum,role)=>sum+n(role.hours),0),
  estimatedDays:f.projectDays,
  desiredDays:f.days,
  startDate:toISO(f.begin),endDate:toISO(f.last),
  productiveHoursDay:f.productive,
  staffing:team,services
 };
}
const previousPersist=persistWizard;
persistWizard=function(){
 const q=s.wizard;
 if(q){
  const proposed=build(q);
  // Se o cronograma ainda não foi validado, não divulgar estimativas como
  // números confirmados na proposta do cliente.
  if(proposed)q.clientExecutionSummary=
   q.clientExecutionSummary?.fingerprint===proposed.fingerprint
    ?q.clientExecutionSummary:proposed;
  else q.clientExecutionSummary=null;
 }
 return previousPersist();
};
function summaryHTML(summary){
 if(!summary?.services?.length)return '';
 const lines=summary.services.map(item=>
  '<tr><td><strong>'+esc(item.service)+'</strong><small>'+decimal(item.quantity)+' '+esc(item.unit)+'</small></td>'+
  '<td><small>'+esc(fmtStaff(item.staffing))+'</small></td>'+
  '<td><small>'+decimal(item.hours)+' h-homem</small></td>'+
  '<td><small>'+item.workingDays+' dia(s) útil(eis)</small></td></tr>'
 ).join('');
 return '<section class="comm-panel"><h3>Planejamento estimado da execução</h3>'+
  '<p class="comm-note">Equipe prevista: <strong>'+esc(fmtStaff(summary.staffing))+'</strong></p>'+
  '<p class="comm-note">Carga de trabalho: <strong>'+decimal(summary.totalHours)+' horas-homem</strong> · '+
  'Duração prevista: <strong>'+summary.estimatedDays+' dias úteis</strong></p>'+
  '<p class="comm-note">Período previsto: <strong>'+fmtDateBR(summary.startDate)+' a '+fmtDateBR(summary.endDate)+'</strong></p>'+
  '<table class="comm-table"><thead><tr><th>Serviço / quantidade</th><th>Equipe</th><th>Horas de execução</th><th>Prazo</th></tr></thead>'+
  '<tbody>'+lines+'</tbody></table>'+
  '<p class="comm-note">Previsão técnica sujeita às condições da obra, clima, acesso, materiais e ajustes de cronograma. Não constitui uma promessa de prazo sem confirmação contratual.</p>'+
  '</section>';
}
const previousPreview=preview;
preview=function(){
 const html=previousPreview();
 const q=db.quotes.find(x=>x.id===s.detail);
 if(!q)return html;
 const summary=q.clientExecutionSummary;
 if(!summary)return html;
 const section=summaryHTML(summary);
 // Esta seção fica dentro da página de impressão e também aparece no PDF.
 const anchor='<div class="print-total">';
 if(!html.includes(anchor))return html;
 return html.replace(anchor,section+anchor);
};
const css=document.createElement('style');
css.textContent='.comm-panel{padding:14px 0;margin:12px 0;border-top:1px solid #d8d8d8;border-bottom:1px solid #d8d8d8;break-inside:avoid-page;page-break-inside:avoid}.comm-panel h3{font-size:14px;margin:0 0 8px}.comm-note{font-size:11px;line-height:1.45;margin:4px 0 7px}.comm-table{width:100%;border-collapse:collapse;margin:8px 0}.comm-table th,.comm-table td{font-size:10px;text-align:left;padding:8px 4px;vertical-align:top;border-bottom:1px solid #d4d4d4}.comm-table small{display:block;line-height:1.35;color:#454545}@media print{.comm-panel{break-inside:avoid-page}.comm-table th,.comm-table td{font-size:9px}}';
document.head.append(css);
window.CIVOLTENCommercialProposal={build};
})();