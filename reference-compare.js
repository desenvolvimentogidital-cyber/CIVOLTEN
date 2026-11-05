/* CIVOLTEN — comparação auditável SIURB × SINAPI.
   Sem conversão automática de serviços diferentes nem invenção de coeficientes.
   Coeficientes oficiais devem ser conferidos antes de ativar o cálculo.
*/
(function(){
'use strict';
const num=x=>{const v=Number(String(x??'0').replace(',','.'));return Number.isFinite(v)&&v>=0?v:0};
const money=x=>cash(num(x));
const round=x=>Math.round((Number(x)||0)*10000)/10000;
const unit=x=>String(x??'').toUpperCase().replace(/\s/g,'').replace(/M²/g,'M2').replace(/M³/g,'M3').replace(/\^/g,'').replace(/METROS?QUADRADOS?/g,'M2');
const renderOption=(value,label,active)=>'<option value="'+value+'"'+(active?' selected':'')+'>'+label+'</option>';
function evaluate(fields){
 const slots=fields.slots.filter(s=>s.workerId);
 const enabled=fields.confirmed;
 const hasS=slots.some(s=>s.siurb>0),hasN=slots.some(s=>s.sinapi>0);
 const completeS=hasS&&slots.every(s=>s.siurb>0);
 const completeN=hasN&&slots.every(s=>s.sinapi>0);
 const unitsOk=(!hasS||unit(fields.siurbUnit)===unit(fields.serviceUnit))&&(!hasN||unit(fields.sinapiUnit)===unit(fields.serviceUnit));
 const codesOk=(!hasS||!!fields.siurbCode.trim())&&(!hasN||!!fields.sinapiCode.trim());
 const sourceDatesOk=(!hasS||!!fields.siurbDate.trim())&&(!hasN||!!fields.sinapiDate.trim());
 const totalS=slots.reduce((a,s)=>a+s.siurb,0),totalN=slots.reduce((a,s)=>a+s.sinapi,0);
 const divergent=completeS&&completeN&&Math.abs(totalS-totalN)/Math.max(totalS,totalN)>0.25;
 const valid=enabled&&slots.length>0&&unitsOk&&codesOk&&sourceDatesOk&&(!hasS||completeS)&&(!hasN||completeN)&&(completeS||completeN)&&(!divergent||fields.divergenceReviewed);
 const selected=fields.policy==='siurb'&&completeS?'siurb':
                fields.policy==='sinapi'&&completeN?'sinapi':
                completeS&&completeN?'conservative':completeS?'siurb':completeN?'sinapi':'none';
 const chosen=slots.map(s=>{
  const hh=selected==='siurb'?s.siurb:selected==='sinapi'?s.sinapi:Math.max(s.siurb,s.sinapi);
  return {...s,hoursManPerUnit:round(hh),hoursPerPerson:round(hh/Math.max(1,s.count))};
 });
 const refLaborS=num(fields.siurbLabor),refLaborN=num(fields.sinapiLabor);
 const preferredLaborCost=valid?Math.max(completeS?refLaborS:0,completeN?refLaborN:0):0;
 let problem='';
 if(enabled&&!slots.length)problem='Selecione uma equipe padrão antes de conferir as produtividades.';
 else if(enabled&&!hasS&&!hasN)problem='Preencha a produtividade de ao menos uma fonte.';
 else if(enabled&&!unitsOk)problem='As unidades SIURB/SINAPI devem corresponder à unidade do serviço.';
 else if(enabled&&!codesOk)problem='Informe o código de cada composição utilizada.';
 else if(enabled&&!sourceDatesOk)problem='Informe a competência ou data-base de cada fonte.';
 else if(enabled&&(hasS&&!completeS||hasN&&!completeN))problem='Preencha as horas-homem de todos os profissionais da equipe em cada fonte utilizada.';
 else if(enabled&&divergent&&!fields.divergenceReviewed)problem='As produtividades divergem mais de 25%. Confira as composições e confirme a revisão.';
 return {valid,selected,chosen,hasS,hasN,completeS,completeN,unitsOk,divergent,totalS:round(totalS),totalN:round(totalN),preferredLaborCost,problem};
}
function savedRefs(service){return service?.referenceComparison||{}}
function panel(service){
 const refs=savedRefs(service),codes=refs.sources||{},slots=refs.slots||[];
 const verified=refs.status==='verified';
 const currentUnit=service?.unit||'m²';
 const isSinapi=service?.origin==='SINAPI';
 const siurbCode=codes.siurb?.code||(isSinapi?'':service?.sourceCode||'');
 const sinapiCode=codes.sinapi?.code||(isSinapi?service?.sourceCode||'':'');
 const siurbUnit=codes.siurb?.unit||currentUnit;
 const sinapiUnit=codes.sinapi?.unit||currentUnit;
 const siurbDate=codes.siurb?.date||(isSinapi?'':service?.sourceDate||'07/2026');
 const sinapiDate=codes.sinapi?.date||(isSinapi?service?.sourceDate||'':'');
 const hoursRows=Array.from({length:3},(_,i)=>{
  const slot=slots[i]||{};
  return '<div class="bc-grid-row"><strong>Profissional '+(i+1)+'</strong>'+
   '<label>SIURB (hh/un)<input class="input" type="number" min="0" step="0.0001" name="bcSiurb'+i+'" value="'+esc(slot.siurb??'')+'" placeholder="Conferir composição"></label>'+
   '<label>SINAPI (hh/un)<input class="input" type="number" min="0" step="0.0001" name="bcSinapi'+i+'" value="'+esc(slot.sinapi??'')+'" placeholder="Conferir composição"></label></div>';
 }).join('');
 return '<section class="bc-compare"><h3>Comparação SIURB × SINAPI</h3>'+
  '<p class="bc-note">SIURB é a referência principal de São Paulo. Compare com SINAPI-SP somente se o serviço, unidade, regime e escopo forem equivalentes. Os valores devem vir das composições analíticas, não de um custo unitário global.</p>'+
  '<div class="bc-grid-row">'+
  '<label>Código SIURB<input name="bcSiurbCode" class="input" value="'+esc(siurbCode)+'" placeholder="Código oficial"></label>'+
  '<label>Código SINAPI<input name="bcSinapiCode" class="input" value="'+esc(sinapiCode)+'" placeholder="Código oficial"></label></div>'+
  '<div class="bc-grid-row">'+
  '<label>Unidade SIURB<input name="bcSiurbUnit" class="input" value="'+esc(siurbUnit)+'" placeholder="m²"></label>'+
  '<label>Unidade SINAPI<input name="bcSinapiUnit" class="input" value="'+esc(sinapiUnit)+'" placeholder="m²"></label></div>'+
  '<div class="bc-grid-row">'+
  '<label>Data-base SIURB<input name="bcSiurbDate" class="input" value="'+esc(siurbDate)+'" placeholder="07/2026"></label>'+
  '<label>Competência SINAPI<input name="bcSinapiDate" class="input" value="'+esc(sinapiDate)+'" placeholder="MM/AAAA"></label></div>'+
  '<p class="bc-note">Horas-homem necessárias para executar UMA unidade do serviço. As três linhas correspondem aos três profissionais escolhidos acima.</p>'+
  hoursRows+
  '<div class="bc-grid-row">'+
  '<label>Mão de obra SIURB com encargos por unidade (R$), se conferida<input name="bcSiurbLabor" class="input" type="number" min="0" step="0.01" value="'+esc(codes.siurb?.laborCost??'')+'"></label>'+
  '<label>Mão de obra SINAPI com encargos por unidade (R$), se conferida<input name="bcSinapiLabor" class="input" type="number" min="0" step="0.01" value="'+esc(codes.sinapi?.laborCost??'')+'"></label></div>'+
  '<label class="label">Política de produtividade</label><select class="input" name="bcPolicy">'+
  renderOption('conservative','Automático: coeficiente conservador para cada função',!refs.policy||refs.policy==='conservative')+
  renderOption('siurb','Usar produtividade SIURB conferida',refs.policy==='siurb')+
  renderOption('sinapi','Usar produtividade SINAPI conferida',refs.policy==='sinapi')+'</select>'+
  '<label class="bc-check"><input type="checkbox" name="bcConfirmed"'+(verified?' checked':'')+'> Conferi descrição, espessura, materiais, unidade, regime e coeficientes da(s) composição(ões)</label>'+
  '<label class="bc-check"><input type="checkbox" name="bcDivergenceReviewed"'+(refs.divergenceReviewed?' checked':'')+'> Revisei divergências superiores a 25%</label>'+
  '<div id="bc-preview" class="bc-preview">'+(verified?'Produtividade validada e salva.':'A comparação permanece inativa até você validar os coeficientes.')+'</div>'+
  '<p class="bc-note">Atenção: o custo da equipe continua sendo calculado com os salários reais da CIVOLTEN. Referência pública maior pode aumentar o preço sugerido, não substituir o custo da empresa.</p>'+
 '</section>';
}
function extract(form){
 const fields={
  serviceUnit:form.elements.unit?.value||'',
  siurbCode:form.elements.bcSiurbCode?.value||'',
  sinapiCode:form.elements.bcSinapiCode?.value||'',
  siurbUnit:form.elements.bcSiurbUnit?.value||'',
  sinapiUnit:form.elements.bcSinapiUnit?.value||'',
  siurbDate:form.elements.bcSiurbDate?.value||'',
  sinapiDate:form.elements.bcSinapiDate?.value||'',
  siurbLabor:form.elements.bcSiurbLabor?.value||'',
  sinapiLabor:form.elements.bcSinapiLabor?.value||'',
  policy:form.elements.bcPolicy?.value||'conservative',
  confirmed:!!form.elements.bcConfirmed?.checked,
  divergenceReviewed:!!form.elements.bcDivergenceReviewed?.checked,
  slots:[0,1,2].map(i=>({
   workerId:form.elements['qaWorker'+i]?.value||'',
   count:Math.max(1,num(form.elements['qaCount'+i]?.value)||1),
   siurb:num(form.elements['bcSiurb'+i]?.value),
   sinapi:num(form.elements['bcSinapi'+i]?.value)
  }))
 };
 return fields;
}
function updatePreview(form){
 if(!form?.elements?.bcConfirmed)return;
 const f=extract(form),res=evaluate(f),el=document.getElementById('bc-preview');
 if(!el)return;
 const left=res.completeS?'SIURB: '+round(res.totalS)+' hh/un':'SIURB: pendente';
 const right=res.completeN?'SINAPI: '+round(res.totalN)+' hh/un':'SINAPI: pendente';
 el.innerHTML='<div class="bc-compare-line"><span>'+left+'</span><span>'+right+'</span></div>'+
  (res.valid?'<strong>Critério aplicado: '+(res.selected==='conservative'?'maior coeficiente conferido em cada função':res.selected.toUpperCase())+'</strong>':
    '<small class="bc-warning">'+esc(res.problem||'Comparação ainda não validada. Os custos cadastrados continuam preservados.')+'</small>')+
  (res.valid?'<p class="bc-note">A equipe real será calculada pelas horas selecionadas e salários/encargos cadastrados. Diferença de referência no preço: '+money(res.preferredLaborCost)+' de mão de obra/un se informada e conferida.</p>':'');
}
const oldModal=modalUI;
modalUI=function(){
 let html=oldModal();
 if(s.modal==='addservice'){
  const at=html.lastIndexOf('<div class="form-actions">');
  if(at>=0)html=html.slice(0,at)+panel(s.edit||{})+html.slice(at);
 }
 if(s.modal==='additem'){
  const existing=s.edit?.referenceComparisonSnapshot;
  if(existing?.status==='verified'){
   const at='<div id="qa-item-suggestion"';
   const note='<div class="bc-preview"><strong>Composição de produtividade conferida</strong><p class="bc-note">Critério: '+esc(existing.selected||'SIURB')+
   ' · SIURB '+esc(existing.sources?.siurb?.code||'não informada')+' · SINAPI '+esc(existing.sources?.sinapi?.code||'não informado')+
   '. As horas e custos foram registrados no item desta proposta.</p></div>';
   html=html.replace(at,note+at);
  }
 }
 return html;
};
const oldSubmit=modalSubmit;
modalSubmit=function(form){
 if(s.modal!=='addservice')return oldSubmit(form);
 const originalId=s.edit?.id,previous=db.services.length;
 const fields=extract(form),evaluated=evaluate(fields);
 if(fields.confirmed&&!evaluated.valid){
  toast(evaluated.problem||'Confira as composições antes de ativar a comparação.');return;
 }
 // Só modifica horas padrão quando fontes verificadas e todas as funções foram mapeadas.
 if(evaluated.valid){
  evaluated.chosen.forEach((slot,i)=>{
   const el=form.elements['qaHours'+i];if(el&&slot.workerId)el.value=slot.hoursPerPerson;
  });
 }
 const comparison=(fields.confirmed||fields.slots.some(x=>x.siurb||x.sinapi))?{
  status:evaluated.valid?'verified':'pending',
  policy:fields.policy,selected:evaluated.selected,
  divergenceReviewed:fields.divergenceReviewed,
  totalSiurbHours:evaluated.totalS,totalSinapiHours:evaluated.totalN,
  preferredLaborCost:evaluated.preferredLaborCost,
  sources:{
   siurb:{code:fields.siurbCode.trim(),unit:fields.siurbUnit,date:fields.siurbDate,laborCost:evaluated.valid&&evaluated.completeS?num(fields.siurbLabor):0},
   sinapi:{code:fields.sinapiCode.trim(),unit:fields.sinapiUnit,date:fields.sinapiDate,laborCost:evaluated.valid&&evaluated.completeN?num(fields.sinapiLabor):0}
  },
  slots:fields.slots.map(({workerId,count,siurb,sinapi})=>({workerId,count,siurb,sinapi})),
  confirmedAt:evaluated.valid?new Date().toISOString():null
 }:null;
 oldSubmit(form);
 const service=originalId?db.services.find(x=>x.id===originalId):
  db.services.length>previous?db.services.at(-1):null;
 if(!service)return;
 if(comparison)service.referenceComparison=comparison;
 else delete service.referenceComparison; // Desativar comparação apagada mesmo em serviço já existente.
 if(!save())toast('Não foi possível armazenar a comparação. Faça um backup.');
 render();
};
document.addEventListener('input',event=>{
 if(s.modal==='addservice'&&event.target.closest('#modal-form')&&
  (event.target.name?.startsWith('bc')||event.target.name?.startsWith('qa')||event.target.name==='unit'))
    updatePreview(document.getElementById('modal-form'));
},true);
document.addEventListener('change',event=>{
 if(s.modal==='addservice'&&event.target.closest('#modal-form')&&
  (event.target.name?.startsWith('bc')||event.target.name?.startsWith('qa')||event.target.name==='unit'))
    updatePreview(document.getElementById('modal-form'));
},true);
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-action="dw-pick-service"]');
 if(!el||s.modal!=='additem')return;
 const service=db.services.find(x=>x.id===el.dataset.id),notes=document.getElementById('bc-item-note');
 if(!service?.referenceComparison||!notes)return;
 const cmp=service.referenceComparison;
 if(cmp.status==='verified'){
  notes.hidden=false;
  notes.textContent='Comparação conferida: SIURB '+(cmp.sources?.siurb?.code||'não registrada')+
  ' | SINAPI '+(cmp.sources?.sinapi?.code||'não registrado')+
  ' | escolha '+(cmp.selected==='conservative'?'conservadora':cmp.selected)+'.';
 } else notes.hidden=true;
},true);
const oldModal2=modalUI;
modalUI=function(){
 let html=oldModal2();
 if(s.modal==='additem'){
  const at='<div id="qa-item-suggestion"';
  html=html.replace(at,'<div id="bc-item-note" class="bc-preview" hidden></div>'+at);
 }
 return html;
};
const style=document.createElement('style');
style.textContent='.bc-compare{border:1px solid #e4c58a;background:#fff9ee;border-radius:15px;padding:13px;margin:13px 0}.bc-compare h3{margin:5px 0 10px;font-size:15px}.bc-note{font-size:11px;line-height:1.5;color:#695e4a;margin:8px 0}.bc-grid-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:9px 0}.bc-grid-row strong{font-size:12px;grid-column:1/-1}.bc-grid-row label{display:block;font-size:11px;color:#58544b}.bc-grid-row input{margin-top:5px}.bc-check{display:flex;gap:8px;align-items:flex-start;font-size:12px;margin:11px 0}.bc-check input{margin-top:2px;min-width:19px;min-height:19px;accent-color:#a87c27}.bc-preview{background:#fff1cc;padding:11px;border-radius:12px;margin:8px 0;font-size:12px;line-height:1.4}.bc-compare-line{display:flex;justify-content:space-between;gap:9px;margin-bottom:8px}.bc-warning{color:#974e1a}.bc-preview[hidden]{display:none}';
document.head.append(style);
window.CIVOLTENCompare={evaluate};
})();