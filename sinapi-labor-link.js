/* CIVOLTEN: vínculo assistido das horas-homem SINAPI com equipe da empresa.
 * Não ativa produtividade no orçamento sem conferência humana.
 * Não afirma que a mão de obra direta contempla todas as subcomposições.
 */
(function(){
'use strict';
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const num=x=>{const v=Number(String(x??0).replace(',','.'));return Number.isFinite(v)&&v>=0?v:0};
const positive=x=>num(x)>0;
const closeRole=(a,b)=>{
 const role=norm(a),worker=norm(b);
 if(role==='ajudante')return /ajudante|servente|auxiliar/.test(worker);
 if(role==='eletricista')return /eletricista/.test(worker)&&!/ajudante|auxiliar/.test(worker);
 if(role==='pedreiro')return /pedreiro/.test(worker)&&!/ajudante|auxiliar/.test(worker);
 return role&&worker.includes(role);
};
function summarize(service){
 const children=Array.isArray(service?.analyticItems)?service.analyticItems:[];
 const labor=Array.isArray(service?.analyticLabor)?service.analyticLabor:[];
 const grouped=new Map();
 for(const item of labor){
  const role=String(item.role||'').trim();
  if(!role||!positive(item.hoursPerUnit))continue;
  grouped.set(role,(grouped.get(role)||0)+num(item.hoursPerUnit));
 }
 const missing=children.filter(x=>x.unit==='H'&&x.type==='COMPOSICAO'&&positive(x.coefficient)&&
   !labor.some(y=>y.code===x.code&&y.role&&positive(y.hoursPerUnit)));
 const entries=[...grouped].map(([role,hours])=>{
  const matches=(db.workers||[]).filter(w=>closeRole(role,w.role)&&num(window.CIVOLTENPayroll?.hourly(w))>0);
  // Para orçamento, usar taxa mais alta entre profissionais equivalentes evita reduzir
  // custos por escolher por acaso o exemplo mais barato.
  matches.sort((a,b)=>num(window.CIVOLTENPayroll?.hourly(b))-num(window.CIVOLTENPayroll?.hourly(a)));
  return {role,hours:Math.round(hours*1e7)/1e7,workerId:matches[0]?.id||'',worker:matches[0]||null};
 });
 return {entries,unmapped:missing,indirect:children.some(x=>x.type==='COMPOSICAO'&&x.unit!=='H'),
   tooMany:entries.length>3,noRoles:!entries.length,
   unlinked:entries.filter(x=>!x.workerId)};
}
function panel(service){
 if(!service?.analytical)return '';
 const view=summarize(service);
 const html=view.entries.map(e=>'<div class="sl-row"><span><b>'+esc(e.role)+'</b><small>'+e.hours.toLocaleString('pt-BR',{maximumFractionDigits:7})+' hh/'+esc(service.unit)+' · '+(e.worker?esc(e.worker.name):'profissional não cadastrado')+'</small></span></div>').join('');
 return '<section class="sl-panel"><h3>Produtividade analítica SINAPI</h3>'+
  '<p class="sl-sub">Composição '+esc(service.sourceCode)+' · SP · '+esc(service.sourceDate)+
  ' · '+esc(service.unit)+'. Profissionais diretos identificados no Excel:</p>'+
  (html||'<p class="sl-alert">Nenhuma função com coeficiente direto identificada.</p>')+
  (view.indirect?'<p class="sl-alert">Há subcomposições. As horas abaixo não incluem necessariamente os profissionais internos dessas subcomposições.</p>':'')+
  (view.unmapped.length?'<p class="sl-alert">'+view.unmapped.length+' linha(s) horista(s) sem função reconhecida. Revise a composição.</p>':'')+
  (view.tooMany?'<p class="sl-alert">Mais de três funções: configure a equipe manualmente e não use preenchimento parcial.</p>':'')+
  (view.unlinked.length?'<p class="sl-alert">Sem profissional com custo/hora cadastrado para: '+view.unlinked.map(x=>esc(x.role)).join(', ')+'.</p>':'')+
  '<button type="button" class="btn btn-outline block" data-action="sl-fill"'+
  (view.tooMany||view.noRoles||view.indirect||view.unmapped.length||view.unlinked.length?' disabled':'')+
  '>Preencher equipe e horas do SINAPI</button>'+
  '<input name="slProposed" type="hidden" value="">'+
  '<div id="sl-status" class="sl-sub">A CIVOLTEN aplica automaticamente coeficientes oficiais diretos e custos/hora cadastrados quando a composição é completa. As pendências ficam registradas, sem exigir confirmação manual para salvar o serviço.</div>'+
  '</section>';
}
const oldModal=modalUI;
modalUI=function(){
 let html=oldModal();
 if(s.modal!=='addservice'||!s.edit?.analytical)return html;
 const anchor='<div class="form-actions">';
 const ix=html.lastIndexOf(anchor);
 return ix>=0?html.slice(0,ix)+panel(s.edit)+html.slice(ix):html;
};
const oldSubmit=modalSubmit;
modalSubmit=function(form){
 if(s.modal!=='addservice'||!s.edit?.analytical)return oldSubmit(form);
 let didSuggest=form.elements.slProposed?.value==='yes';
 const status=window.CIVOLTENAutoProductivity?.analyze(
  s.edit,db.workers,w=>window.CIVOLTENPayroll?.hourly?.(w)||0);
 const traceable=!!(s.edit?.origin==='SINAPI'&&s.edit.sourceCode&&
  s.edit.sourceDate&&((s.edit.sourceUF==='SP'&&s.edit.sourceFile)||
   (s.edit.uf==='SP'&&s.edit.verifiedUF===true)));
 const complete=!!(traceable&&status?.status==='ready'&&status.rows.length<=3);
 const hasOwnTemplate=Array.from({length:3},(_,i)=>
  !!form.elements['qaWorker'+i]?.value&&num(form.elements['qaHours'+i]?.value)>0
 ).some(Boolean);
 // Apenas no serviço sem equipe própria configurada: aplicar os coeficientes
 // oficiais automaticamente, sem depender de outro clique ou checkbox.
 if(complete&&!didSuggest&&!hasOwnTemplate){
  status.rows.forEach((row,i)=>{
   if(form.elements['qaWorker'+i])form.elements['qaWorker'+i].value=row.workerId;
   if(form.elements['qaHours'+i])form.elements['qaHours'+i].value=row.perUnitHours;
   if(form.elements['qaCount'+i])form.elements['qaCount'+i].value=1;
  });
  if(form.elements.slProposed)form.elements.slProposed.value='yes';
  didSuggest=true;
 }
 const oldId=s.edit.id;
 const previous=structuredClone(s.edit.productivity||{});
 oldSubmit(form);
 const service=db.services.find(x=>x.id===oldId);
 if(!service||!didSuggest)return;
 if(!complete){
  service.analyticalReviewNeeded=true;
  save();render();return;
 }
 const entries=(service.productivity?.crew||[]);
 if(!entries.length){
  service.productivity=previous;save();toast('Equipe incompleta; produtividade anterior preservada.');return;
 }
 // Coeficientes oficiais diretos associados automaticamente. Não declarar
 // conferência humana que não ocorreu; orçamentos anteriores seguem intactos.
 service.productivity.productivitySource='SINAPI - associação automática de coeficientes diretos';
 service.productivity.automaticMappedAt=new Date().toISOString();
 service.productivity.referenceCode=service.sourceCode;
 service.productivity.referenceDate=service.sourceDate;
 service.productivity.indirectReviewConfirmed=false;
 service.analyticalReviewNeeded=false;
 save();render();
};
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action="sl-fill"]');
 if(!button||s.modal!=='addservice'||!s.edit?.analytical)return;
 event.preventDefault();event.stopPropagation();
 const result=summarize(s.edit);
 const safe=window.CIVOLTENAutoProductivity?.analyze(
  s.edit,db.workers,w=>window.CIVOLTENPayroll?.hourly?.(w)||0);
 const traceable=s.edit?.origin==='SINAPI'&&s.edit.sourceCode&&s.edit.sourceDate&&
  ((s.edit.sourceUF==='SP'&&s.edit.sourceFile)||(s.edit.uf==='SP'&&s.edit.verifiedUF===true));
 if(!traceable||result.tooMany||result.noRoles||result.indirect||result.unmapped.length||
    result.unlinked.length||safe?.status!=='ready'){
  toast('Composição analítica incompleta. O serviço pode ser salvo com pendência; sem produtividade inventada.');return;
 }
 const form=document.getElementById('modal-form');if(!form)return;
 for(let i=0;i<3;i++){
  const row=result.entries[i];
  if(form.elements['qaWorker'+i])form.elements['qaWorker'+i].value=row?.workerId||'';
  if(form.elements['qaHours'+i])form.elements['qaHours'+i].value=row?.hours||'';
  if(form.elements['qaCount'+i])form.elements['qaCount'+i].value=1;
 }
 if(form.elements.slProposed)form.elements.slProposed.value='yes';
 const status=document.getElementById('sl-status');
 if(status)status.textContent='Equipe e coeficientes SINAPI preenchidos automaticamente. Agora toque em Salvar.';
 toast('Produtividade oficial preenchida; salve o serviço.');
},true);
const css=document.createElement('style');
css.textContent='.sl-panel{padding:14px;border:1px solid #bfd3e4;background:#f5fafe;border-radius:14px;margin:12px 0}.sl-panel h3{font-size:15px;margin:0 0 8px}.sl-sub{font-size:11px;color:#465c70;line-height:1.5;margin:8px 0}.sl-row{border-bottom:1px solid #dfe6ec;padding:8px 0}.sl-row b{display:block;font-size:12px}.sl-row small{font-size:11px;color:#567}.sl-alert{background:#fff1dd;color:#8b461a;padding:8px;border-radius:9px;font-size:11px;line-height:1.4}.sl-check{display:flex;gap:8px;font-size:12px;line-height:1.45;margin:12px 0}.sl-check input{min-width:18px;min-height:18px}';
document.head.append(css);
window.CIVOLTENLaborLink={summarize};
})();