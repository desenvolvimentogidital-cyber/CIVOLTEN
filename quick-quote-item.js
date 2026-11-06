/* CIVOLTEN — Orçamento rápido: serviço + quantidade.
 * A configuração avançada permanece íntegra, porém oculta num acordeão.
 * Não confundir custo de referência público com custo próprio nem inventar materiais.
 */
(function(){
'use strict';
const n=v=>{const x=Number(String(v??0).replace(',','.'));return Number.isFinite(x)&&x>0?x:0};
const fmt=v=>cash(Number(v)||0);
const escText=v=>esc(String(v??''));
function selectedData(form){
 const serviceId=form?.elements?.serviceId?.value||'';
 const id=form?.elements?.sourceId?.value||'';
 const saved=db.services.find(x=>x.id===serviceId);
 if(saved)return {entry:saved,kind:'catalog'};
 if(id){
  const sinapi=window.CIVOLTENSINAPI?.getRecords?.().find(x=>x.id===id);
  if(sinapi)return {entry:sinapi,kind:'sinapi'};
  const siurb=(db.siurbItems||[]).find(x=>x.id===id);
  if(siurb)return {entry:siurb,kind:'siurb'};
 }
 return {entry:null,kind:'manual'};
}
function totals(form){
 if(!form?.elements)return null;
 const elements=form.elements;
 const selected=selectedData(form),entry=selected.entry;
 const qty=n(elements.qty?.value);
 const unit=elements.unit?.value||'un';
 const labor=n(elements.labor?.value),material=n(elements.material?.value),extra=n(elements.extra?.value);
 const owner=elements.owner?.value||'empresa';
 const unitDirect=labor+(owner==='empresa'?material:0)+extra;
 const direct=unitDirect*qty;
 const approvedCrew=entry?.productivity?.crew||[];
 const analyticLabor=entry?.analyticLabor||[];
 const officialHours=n(form.dataset.cvAutoHours);
 const hoursUnit=officialHours>0?officialHours:approvedCrew.length
   ?approvedCrew.reduce((sum,r)=>sum+n(r.hours)*Math.max(1,n(r.count)||1),0)
   :analyticLabor.length?analyticLabor.reduce((sum,r)=>sum+n(r.hoursPerUnit),0)
   :n(elements.hoursUnit?.value)*Math.max(1,n(elements.workersCount?.value)||1);
 const hasParts=(entry?.analyticItems||[]).some(x=>x.type==='INSUMO'||x.type==='COMPOSICAO'&&x.unit!=='H');
 const incompleteMaterial=owner==='empresa'&&hasParts&&material+extra<=0;
 const knownReference=n(entry?.referenceCost??entry?.cost);
 return {selected,qty,unit,labor,material,extra,owner,unitDirect,direct,hoursUnit,
  knownReference,incompleteMaterial,hasParts,
  noCost:!unitDirect,autoStatus:form.dataset.cvAutoStatus,
  unverified:(selected.kind==='sinapi'||selected.kind==='siurb')};
}
function summary(form){
 const value=totals(form);
 if(!value)return '<span>Escolha um serviço e informe a quantidade.</span>';
 const {selected,qty,unit,unitDirect,direct,hoursUnit,knownReference,unverified,incompleteMaterial,noCost,autoStatus}=value;
 const lines=[];
 if(selected.entry)lines.push('<b>'+escText(selected.entry.name)+'</b>');
 lines.push('<div class="qi-line"><span>Quantidade</span><strong>'+qty.toLocaleString('pt-BR',{maximumFractionDigits:2})+' '+escText(unit)+'</strong></div>');
 if(hoursUnit>0&&qty>0)lines.push('<div class="qi-line"><span>Horas-homem estimadas'+(autoStatus&&autoStatus!=='ready'?' (prévia oficial)':'')+'</span><strong>'+
 (qty*hoursUnit).toLocaleString('pt-BR',{maximumFractionDigits:1})+' h</strong></div>');
 if(knownReference)lines.push('<div class="qi-line"><span>Referência pública unitária (não é preço de venda)</span><strong>'+fmt(knownReference)+'</strong></div>');
 if(unitDirect>0&&qty>0){
  lines.push('<div class="qi-line qi-cost"><span>Custo direto interno estimado</span><strong>'+fmt(direct)+'</strong></div>');
  lines.push('<p class="qi-muted">Preço final de venda, encargos indiretos, tributos e margem aparecem na revisão do orçamento.</p>');
 }
 if(unverified)lines.push('<p class="qi-warning">Composição pública ainda não validada na sua biblioteca. Os coeficientes mostrados podem ser apenas diretos; confira equipe, custos e subcomposições antes de emitir uma proposta.</p>');
 if(incompleteMaterial)lines.push('<p class="qi-warning">A composição prevê materiais/subcomposições, mas não há custo interno de fornecimento. Abra Detalhes avançados para completar.</p>');
 else if(noCost)lines.push('<p class="qi-warning">A referência ainda não contém custo interno confiável para precificação. O item pode ser salvo como pendente no rascunho; não será liberado para envio sem custos válidos.</p>');
 return lines.join('');
}
function refresh(){
 if(s.modal!=='additem')return;
 const form=document.getElementById('modal-form'),box=document.getElementById('qi-status');
 if(!form||!box)return;
 box.innerHTML=summary(form);
 const unit=document.getElementById('qi-unit');
 if(unit)unit.textContent=form.elements.unit?.value||'un';
}
const oldModal=modalUI;
modalUI=function(){
 let html=oldModal();
 if(s.modal!=='additem')return html;
 const start=html.indexOf('<div class="grid-duo">',html.indexOf('id="dw-service-hits"'));
 const end=html.lastIndexOf('<div class="form-actions">');
 if(start<0||end<start)return html;
 let advanced=html.slice(start,end);
 const qtyPattern=/<label class="label">Quantidade[\s\S]*?<\/label>\s*<input[^>]*name="qty"[^>]*>/;
 if(!qtyPattern.test(advanced))return html; // não suprimir a quantidade se layout mudar.
 advanced=advanced.replace(qtyPattern,'');
 // Manter todos os campos do fluxo original sem alterar nomes, validações e cálculos.
 const before=html.slice(0,start).replace(
  /<p class="dw-help">Selecione um resultado[\s\S]*?<\/p>\s*<p class="dw-help">A descrição[\s\S]*?<\/p>/,
  '<p class="qi-muted">Escolha uma composição e informe a quantidade. Horas, equipe e custos são preenchidos automaticamente quando as bases oficiais e os cadastros permitem. O realizado é lançado durante a obra.</p>');
 const old=s.edit||{};
 const qty=field('Quantidade a executar','qty','Ex.: 300',old.qty||1,'number',true)
  .replace('name="qty"','name="qty" id="qi-qty" inputmode="decimal"');
 const quick='<div class="qi-quick">'+qty+
  '<p class="qi-muted">Unidade: <b id="qi-unit">'+escText(old.unit||'un')+'</b></p>'+
  '<div id="qi-status" class="qi-summary" aria-live="polite">'+
  (old.service?'Resumo do serviço selecionado.':'Digite o nome ou código do serviço. A seleção será automática quando houver uma correspondência única.')+'</div></div>';
 const details='<details class="qi-details" id="qi-details"><summary>Detalhes avançados <small>Equipe, materiais, horas e valores editáveis</small></summary>'+
  '<div class="qi-inner">'+advanced+'</div></details>';
 return before+quick+details+html.slice(end);
};
document.addEventListener('click',event=>{
 if(s.modal!=='additem')return;
 const target=event.target?.closest?.('[data-action]');
 if(target?.dataset?.action==='dw-pick-service'){
  // Listener de captura registrado após os módulos de seleção e produtividade:
  // lê os valores atualizados sem disparar uma segunda seleção.
  refresh();
 }
},true);
document.addEventListener('input',event=>{
 if(s.modal!=='additem')return;
 const form=document.getElementById('modal-form');
 if(form?.contains(event.target)&&event.target?.id!=='dw-service-search')refresh();
},true);
document.addEventListener('change',event=>{
 if(s.modal!=='additem')return;
 const form=document.getElementById('modal-form');
 if(form?.contains(event.target))refresh();
},true);
const css=document.createElement('style');
css.textContent='.qi-quick{margin:12px 0}.qi-quick>.label{font-size:14px;font-weight:700}.qi-quick>input{font-size:21px;font-weight:700;padding:14px}.qi-summary{border:1px solid #e4dbca;border-radius:12px;padding:13px;margin:12px 0;background:#fcfaf5;line-height:1.45;font-size:12px}.qi-summary>b{display:block;margin-bottom:8px}.qi-line{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:6px 0}.qi-line strong{text-align:right}.qi-cost{border-top:1px solid #ded2bb;padding-top:9px}.qi-muted{font-size:12px;color:#746b5c;line-height:1.5;margin:8px 0}.qi-warning{font-size:11px;color:#8a4a18;background:#fff0dc;padding:10px;border-radius:9px;margin:8px 0}.qi-details{border:1px solid #ddd6c9;border-radius:12px;margin:12px 0;background:white}.qi-details>summary{cursor:pointer;padding:14px;font-size:13px;font-weight:700}.qi-details>summary small{display:block;font-weight:400;color:#686056;margin-top:3px}.qi-inner{padding:12px;border-top:1px solid #e8e4dc}.qi-inner .grid-duo{grid-template-columns:1fr 1fr}';
document.head.append(css);
})();