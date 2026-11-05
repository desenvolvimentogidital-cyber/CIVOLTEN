/* CIVOLTEN — Automatização segura de composições, produtividade e orçamentos
 * Usa sempre a base de custo real da CIVOLTEN; referência SIURB não é custo de mão de obra.
 * Não altera orçamentos emitidos nem registros anteriores. */
(function () {
 'use strict';
 const oldModal=modalUI, oldSubmit=modalSubmit, oldStep2=wizardStep2;
 const n=v=>{const x=Number(String(v??0).replace(',','.'));return Number.isFinite(x)&&x>0?x:0};
 const money=v=>cash(n(v));
 const round=v=>Math.round((Number(v)||0)*100)/100;
 const opt=(id,label,selected)=>'<option value="'+esc(id)+'"'+(selected?' selected':'')+'>'+esc(label)+'</option>';
 const workerOptions=id=>opt('','Selecione o profissional',!id)+db.workers.map(w=>opt(w.id,w.name+(w.role?' — '+w.role:''),w.id===id)).join('');
 function realWorkerRate(w){return window.CIVOLTENPayroll.hourly(w)}
 function crewValid(crew){
  return (Array.isArray(crew)?crew:[]).filter(c=>c&&c.workerId&&n(c.hours)>0&&n(c.count)>0);
 }
 function crewTotals(crew){
  const entries=crewValid(crew).map(c=>{
   const w=db.workers.find(x=>x.id===c.workerId);
   const hours=n(c.hours),count=n(c.count),rate=realWorkerRate(w);
   return {workerId:c.workerId,name:w?.name||'Profissional não localizado',hours,count,rate,hh:hours*count,cost:hours*count*rate};
  });
  return {entries,hours:entries.reduce((t,x)=>t+x.hh,0),cost:entries.reduce((t,x)=>t+x.cost,0)};
 }
 function templateFor(service){return service?.productivity&&typeof service.productivity==='object'?service.productivity:{}}
 function extraConfigHTML(service){
  const p=templateFor(service),crew=Array.isArray(p.crew)?p.crew:[];
  const member=(i)=>{
   const row=crew[i]||{};
   return '<div class="qa-crew-row"><strong>Profissional '+(i+1)+'</strong>'+
    '<label class="label">Selecionar funcionário cadastrado</label><select class="input" name="qaWorker'+i+'">'+workerOptions(row.workerId)+'</select>'+
    '<div class="grid-duo"><label class="label">Horas por unidade<input type="number" class="input" name="qaHours'+i+'" min="0" step="0.01" value="'+esc(row.hours??'')+'" placeholder="Ex.: 0,8"></label>'+
    '<label class="label">Quantidade de pessoas<input type="number" class="input" name="qaCount'+i+'" min="1" max="20" step="1" value="'+esc(row.count||1)+'"></label></div></div>';
  };
  return '<section class="qa-template"><h3>Produtividade e equipe padrão</h3>'+
   '<p class="small-desc">Preencha uma vez. As horas informadas são para executar <b>uma unidade</b> do serviço (m, m², m³ ou un). O custo será atualizado automaticamente a partir da equipe cadastrada.</p>'+
   member(0)+member(1)+member(2)+
   '<p class="qa-note">Se não houver coeficiente confirmado, deixe as horas em branco. A composição oficial da SIURB ainda precisa ser validada para importação automática de produtividade.</p>'+
   '<h3>Material padrão (opcional)</h3>'+
   '<label class="label">Material cadastrado</label><select class="input" name="qaMaterial">'+
   opt('','Sem material padrão',!p.materialId)+db.materials.map(m=>opt(m.id,m.name+' · '+money(m.cost)+'/'+esc(m.unit),p.materialId===m.id)).join('')+'</select>'+
   '<label class="label">Quantidade do material por unidade do serviço<input type="number" class="input" name="qaMaterialQty" min="0" step="0.01" value="'+esc(p.materialQty||1)+'"></label>'+
   '<p class="qa-note">Materiais fornecidos pelo cliente aparecem como referência, mas ficam fora do custo cobrado no modo Somente mão de obra.</p>'+
   '<div class="qa-live" id="qa-service-preview">Informe os profissionais e a produtividade para calcular automaticamente.</div>'+
   '</section>';
 }
 modalUI=function(){
  let html=oldModal();
  if(s.modal==='addservice'){
   const element=extraConfigHTML(s.edit||{});
   const pos=html.lastIndexOf('<div class="form-actions">');
   if(pos>=0)html=html.slice(0,pos)+element+html.slice(pos);
  }
  if(s.modal==='additem'){
   const anchor='<div id="dw-line-total"';
   if(html.includes(anchor))html=html.replace(anchor,
    '<div class="qa-live" id="qa-item-suggestion">Ao selecionar um serviço com produtividade cadastrada, a equipe e o custo por unidade são calculados automaticamente.</div>'+anchor);
  }
  return html;
 };
 function captureTemplate(form){
  const crew=[];
  for(let i=0;i<3;i++){
   const workerId=form.elements['qaWorker'+i]?.value;
   const hours=n(form.elements['qaHours'+i]?.value);
   const count=n(form.elements['qaCount'+i]?.value)||1;
   if(workerId&&hours>0)crew.push({workerId,hours,count});
  }
  return {crew,materialId:form.elements.qaMaterial?.value||'',materialQty:n(form.elements.qaMaterialQty?.value)||1,updatedAt:new Date().toISOString(),productivitySource:'CIVOLTEN - configuração conferida manualmente'};
 }
 function updateServicePreview(){
  if(s.modal!=='addservice')return;
  const f=document.getElementById('modal-form'),v=document.getElementById('qa-service-preview');
  if(!f||!v)return;
  const t=captureTemplate(f),sum=crewTotals(t.crew);
  const mat=db.materials.find(m=>m.id===t.materialId);
  const materialCost=mat?n(mat.cost)*t.materialQty:0;
  if(!sum.entries.length&&!mat){v.textContent='Configure equipe e horas por unidade para ativar o preenchimento automático.';return}
  const missing=sum.entries.some(x=>!x.rate);
  v.innerHTML='<b>Custo real previsto por unidade</b>'+
  '<div class="qa-compare"><span>Mão de obra da equipe ('+round(sum.hours)+' h-homem)</span><strong>'+money(sum.cost)+'</strong></div>'+
  '<div class="qa-compare"><span>Material cadastrado</span><strong>'+money(materialCost)+'</strong></div>'+
  '<div class="qa-compare"><span>Subtotal estimado</span><strong>'+money(sum.cost+materialCost)+'</strong></div>'+
  (missing?'<p class="qa-warning">Há profissional sem valor/hora. Confira o cadastro para evitar subestimar a mão de obra.</p>':'');
 }
 modalSubmit=function(form){
  if(s.modal!=='addservice')return oldSubmit(form);
  const id=s.edit?.id,oldLength=db.services.length,vals=captureTemplate(form),sum=crewTotals(vals.crew);
  if(sum.entries.some(e=>e.rate<=0)){toast('Confira os custos dos profissionais antes de salvar a produtividade.');return}
  oldSubmit(form);
  let service=id?db.services.find(x=>x.id===id):db.services.length>oldLength?db.services[db.services.length-1]:null;
  if(!service)return;
  service.productivity=vals;
  const isSiurb=service.origin==='SIURB'&&service.costSplitConfirmed;
  if(isSiurb){
   // A divisão oficial conferida nunca deve ser sobrescrita pelo custo da empresa.
   if(service.referenceLabor===undefined)service.referenceLabor=round(n(service.labor));
   if(service.referenceMaterial===undefined)service.referenceMaterial=round(n(service.material));
  }
  if(sum.entries.length){
   service.labor=round(isSiurb?sum.cost:Math.max(n(service.labor),sum.cost));
  }
  const mat=db.materials.find(m=>m.id===vals.materialId);
  if(mat)service.material=round(isSiurb?n(mat.cost)*vals.materialQty:Math.max(n(service.material),n(mat.cost)*vals.materialQty));
  save();render();
 };
 const workerValue=w=>realWorkerRate(w);
 function locateService(id,kind){
  return kind==='catalog'?db.services.find(x=>x.id===id):null;
 }
 function updateItemTemplate(service){
  if(!service||!s.modal||s.modal!=='additem')return;
  const f=document.getElementById('modal-form'),hint=document.getElementById('qa-item-suggestion');
  if(!f)return;
  const template=templateFor(service);
  const crew=crewTotals(template.crew);
  const siurb=service.origin==='SIURB';
  const siurbLabor=siurb&&service.costSplitConfirmed?n(service.referenceLabor??service.labor):0;
  const registeredLabor=n(service.labor);
  // Floor for SAME labor scope; never equate full SIURB to labor alone.
  const costLabor=crew.entries.length
    ? (siurb?crew.cost:Math.max(crew.cost,registeredLabor))
    : registeredLabor;
  const material=db.materials.find(m=>m.id===template.materialId);
  const companyMaterial=material?n(material.cost)*n(template.materialQty):0;
  const savedMaterial=n(service.material);
  const materialValue=material?companyMaterial:savedMaterial;
  if(crew.entries.length){
   f.elements.labor.value=round(costLabor);
   const first=crew.entries[0];
   if(f.elements.workerId)f.elements.workerId.value=first.workerId;
   if(f.elements.hoursUnit)f.elements.hoursUnit.value=first.hours;
   if(f.elements.workersCount)f.elements.workersCount.value=first.count;
   if(f.elements.useWorkerRate)f.elements.useWorkerRate.checked=false; // multi-professional team already priced
  }
  if(material){
   if(f.elements.materialId)f.elements.materialId.value=material.id;
   if(f.elements.materialQty)f.elements.materialQty.value=template.materialQty||1;
   f.elements.material.value=round(materialValue);
  }
  if(hint){
   const ref=siurb? n(service.referenceCost):0;
   const labels=crew.entries.map(x=>esc(x.name)+' ('+round(x.hh)+' hh)').join(', ');
   hint.innerHTML='<strong>Preenchimento automático CIVOLTEN</strong>'+
    '<div class="qa-compare"><span>Custo real da equipe</span><b>'+money(crew.cost)+'</b></div>'+
    (siurbLabor?'<div class="qa-compare"><span>Referência SIURB de mão de obra (conferida)</span><b>'+money(siurbLabor)+'</b></div>':'')+
    '<div class="qa-compare"><span>Custo usado no orçamento/un</span><b>'+money(costLabor)+'</b></div>'+
    (siurbLabor&&siurbLabor>costLabor?'<p class="qa-note">A referência SIURB maior será considerada no preço sugerido, sem ser tratada como custo real da CIVOLTEN.</p>':'')+
    (material?'<div class="qa-compare"><span>Material da empresa ou referência</span><b>'+money(materialValue)+'</b></div>':'')+
    (ref?'<p class="qa-note">Custo SIURB total: '+money(ref)+' — não foi somado à mão de obra.</p>':'')+
    (labels?'<p class="qa-note">Equipe: '+labels+'.</p>':'')+
    (!crew.entries.length?'<p class="qa-warning">Produtividade ainda não cadastrada: informe as horas ou configure a equipe em Mais → Serviços.</p>':'');
  }
  const total=document.getElementById('dw-line-total');
  if(total){const labor=n(f.elements.labor?.value),mat=n(f.elements.material?.value),other=n(f.elements.extra?.value);total.innerHTML='Custo direto por unidade: <b>'+money(labor+(f.elements.owner?.value==='empresa'?mat:0)+other)+'</b>'}
 }
 const oldItemSubmit=modalSubmit;
 modalSubmit=function(form){
  if(s.modal!=='additem')return oldItemSubmit(form);
  const id=s.edit?.id,itemsBefore=s.wizard?.items?.length||0;
  const previous=s.edit?structuredClone(s.edit):null;
  const serviceId=form.elements.serviceId?.value,svc=db.services.find(x=>x.id===serviceId);
  // Coeficientes de mão de obra SINAPI não representam o custo dos materiais.
  // No orçamento completo, exigir materiais reais antes de emitir preço.
  const hasSinapiMaterials=svc?.origin==='SINAPI'&&
    (svc.analyticItems||[]).some(x=>x.type==='INSUMO'||(x.type==='COMPOSICAO'&&x.unit!=='H'));
  if(hasSinapiMaterials&&(s.wizard?.type==='Completo'||s.wizard?.type==='Misto'&&form.elements.owner?.value==='empresa')&&
    n(form.elements.material?.value)<=0&&n(form.elements.extra?.value)<=0){
    toast('Composição SINAPI inclui materiais ou subcomposições. Informe o custo real de materiais/equipamentos antes de salvar o serviço completo.');
    return;
  }
  // Confere os mínimos reais cadastrados mesmo após ajuste manual no item.
  if(svc?.productivity){
   const minimum=crewTotals(svc.productivity.crew).cost;
   if(minimum>0&&n(form.elements.labor?.value)<minimum)form.elements.labor.value=round(minimum);
   const material=db.materials.find(x=>x.id===svc.productivity.materialId);
   if(material){
    const floor=n(material.cost)*n(svc.productivity.materialQty);
    if(floor>0&&n(form.elements.material?.value)<floor)form.elements.material.value=round(floor);
   }
  }
  if(!svc&&previous?.productivity?.crew?.length){
   const preservedMinimum=previous.productivity.crew.reduce((total,member)=>total+n(member.cost),0);
   if(preservedMinimum>0&&n(form.elements.labor?.value)<preservedMinimum)form.elements.labor.value=round(preservedMinimum);
  }
  const isSiurb=svc?.origin==='SIURB'&&svc.costSplitConfirmed;
  const cmp=svc?.referenceComparison?.status==='verified'?svc.referenceComparison:null;
  const comparableLabor=cmp?n(cmp.preferredLaborCost):0;
  const refLabor=Math.max(isSiurb?n(svc.referenceLabor??svc.labor):0,comparableLabor);
  const refMaterial=isSiurb?n(svc.referenceMaterial??svc.material):0;
  const productivity=svc?.productivity;
  const snapshot=productivity?crewTotals(productivity.crew):null;
  oldItemSubmit(form);
  if(!s.wizard||s.modal==='additem')return;
  const item=id?s.wizard.items.find(x=>x.id===id):s.wizard.items[itemsBefore];
  if(item&&!svc&&previous){
   // Na edição de um orçamento antigo, manter fotografia de horas/taxas e referência.
   if(previous.catalogServiceId)item.catalogServiceId=previous.catalogServiceId;
   if(previous.productivity)item.productivity=previous.productivity;
   if(previous.referenceLabor!==undefined)item.referenceLabor=previous.referenceLabor;
   if(previous.referenceMaterial!==undefined)item.referenceMaterial=previous.referenceMaterial;
   if(previous.referenceCompared!==undefined)item.referenceCompared=previous.referenceCompared;
   if(previous.referenceComparisonSnapshot)item.referenceComparisonSnapshot=previous.referenceComparisonSnapshot;
   keepTemp();
  }
  if(item&&svc){
   item.catalogServiceId=svc.id;
   // Referência verificável fica SEPARADA do custo real; só entra no preço sugerido.
   item.referenceLabor=refLabor;
   item.referenceMaterial=refMaterial;
   item.referenceCompared=!!(cmp&&comparableLabor>0);
   if(cmp)item.referenceComparisonSnapshot={
    status:cmp.status,policy:cmp.policy,selected:cmp.selected,
    totalSiurbHours:cmp.totalSiurbHours,totalSinapiHours:cmp.totalSinapiHours,
    sources:structuredClone(cmp.sources),confirmedAt:cmp.confirmedAt
   };
   else delete item.referenceComparisonSnapshot;
   if(snapshot?.entries.length){
    item.productivity={source:productivity.productivitySource||'CIVOLTEN',hoursPerUnit:snapshot.hours,
     crew:snapshot.entries.map(e=>({workerId:e.workerId,workerName:e.name,perUnitHours:e.hours,count:e.count,rate:e.rate,cost:e.cost}))};
   }
   keepTemp();
  }
 };
 function hoursForecast(){
  const items=s.wizard?.items||[];
  const hours=items.reduce((v,x)=>{
   const q=n(x.qty),auto=n(x.productivity?.hoursPerUnit);
   return v+q*(auto||n(x.hoursUnit)*(n(x.workersCount)||1));
  },0);
  return {hours,personDays:hours/8,hasData:hours>0};
 }
 wizardStep2=function(){
  let html=oldStep2();
  const forecast=hoursForecast();
  const expenses=(db.expenses||[]).filter(x=>!s.wizard.expenseItems?.some(e=>e.expenseId===x.id)).slice(0,8);
  const panel='<section class="form-card qa-forecast"><h3 class="card-title">Produtividade e custos sugeridos</h3>'+
   (forecast.hasData?'<div class="qa-compare"><span>Horas-homem previstas</span><b>'+round(forecast.hours)+' hh</b></div>'+
   '<div class="qa-compare"><span>Equivalente em jornadas de 8 horas</span><b>'+round(forecast.personDays)+' dias-pessoa</b></div>'+
   '<p class="qa-note">Isso não equivale necessariamente a dias corridos; depende da equipe, paralelismo e condições da obra.</p>':
   '<p class="qa-warning">Nenhuma produtividade cadastrada para os itens. Configure horas por unidade em Mais → Serviços para estimar automaticamente.</p>')+
   '<h4>Despesas cadastradas para adicionar com um toque</h4>'+
   '<p class="qa-note">Selecione apenas as aplicáveis. Confira dias, pessoas, quilômetros e alimentação antes da proposta.</p>'+
   '<div class="qa-suggested-expenses">'+expenses.map(x=>'<button type="button" class="qa-suggest-btn" data-action="qa-apply-expense" data-id="'+esc(x.id)+'"><span>'+esc(x.name)+'</span><b>+ '+money(x.cost)+'</b></button>').join('')+
   (!expenses.length?'<p class="qa-note">Nenhuma despesa adicional cadastrada. Use Mais → Despesas para criar.</p>':'')+'</div></section>';
  const last=html.lastIndexOf('<div class="form-actions">');
  if(last>=0)html=html.slice(0,last)+panel+html.slice(last);
  return html;
 };
 const oldPriceReview=wizardStep3;
 wizardStep3=function(){
  let html=oldPriceReview();
  if(!s.wizard)return html;
  const view=calc(s.wizard);
  if(n(view.referencePremium)>0){
   const advisory='<div class="form-card qa-price-check">'+
    '<h3 class="card-title">Comparação CIVOLTEN × SIURB</h3>'+
    '<div class="qa-compare"><span>Custo real previsto da CIVOLTEN</span><strong>'+money(view.cost)+'</strong></div>'+
    '<div class="qa-compare"><span>Base comercial considerando referência maior</span><strong>'+money(view.pricingBasis)+'</strong></div>'+
    '<p class="qa-note">O preço sugerido considera somente componentes SIURB conferidos e equivalentes ao seu fornecimento. O lucro continua calculado sobre o custo real da empresa. Você pode editar o preço, mas confira a margem final.</p></div>';
   const anchor='<div class="price-card">';
   if(html.includes(anchor))html=html.replace(anchor,advisory+anchor);
   else html=advisory+html;
  }
  return html;
 };
 const style=document.createElement('style');
 style.textContent='.qa-template{border:1px solid #e6c575;background:#fff9eb;border-radius:15px;padding:14px;margin:15px 0}.qa-template h3{font-size:15px;margin:10px 0}.qa-crew-row{padding:11px 0;border-bottom:1px solid #f1deba}.qa-crew-row strong{font-size:12px}.qa-crew-row .label{font-size:12px}.qa-note{font-size:11px;line-height:1.5;color:#80683b;margin:7px 0}.qa-live{background:#fff5d9;border-radius:12px;padding:13px;margin:11px 0;font-size:12px}.qa-compare{display:flex;justify-content:space-between;gap:12px;margin:7px 0;align-items:center;font-size:12px}.qa-compare span{flex:1}.qa-warning{color:#a45119;font-size:12px;line-height:1.45}.qa-suggested-expenses{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:9px 0}.qa-suggest-btn{border:1px solid #e7cb83;border-radius:11px;padding:11px 9px;background:#fff8e9;color:#33291e;text-align:left;display:flex;flex-direction:column;gap:6px}.qa-suggest-btn span{font-size:12px}.qa-suggest-btn b{font-size:12px;color:#a36a1a}.qa-forecast{margin-top:12px}';
 document.head.append(style);
 document.addEventListener('change',e=>{
  if(s.modal==='addservice'&&e.target.closest('#modal-form')&&(/^qa(?:Worker|Hours|Count)/.test(e.target.name)||e.target.name==='qaMaterial'||e.target.name==='qaMaterialQty'))updateServicePreview();
 },true);
 document.addEventListener('input',e=>{
  if(s.modal==='addservice'&&e.target.closest('#modal-form')&&(/^qa(?:Hours|Count)/.test(e.target.name)||e.target.name==='qaMaterialQty'))updateServicePreview();
 },true);
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  if(b.dataset.action==='dw-pick-service'){
   const service=locateService(b.dataset.id,b.dataset.kind);
   if(service)updateItemTemplate(service);
  }
  if(b.dataset.action==='qa-apply-expense'){
   e.preventDefault();e.stopPropagation();
   const exp=db.expenses.find(x=>x.id===b.dataset.id);
   if(!exp||!s.wizard)return;
   s.wizard.expenseItems??=[];
   if(s.wizard.expenseItems.some(x=>x.expenseId===exp.id))return;
   const obj={id:'qe'+Math.random().toString(36).slice(2),expenseId:exp.id,name:exp.name,
    unitCost:n(exp.cost),qty:1,people:1,days:1};
   s.wizard.expenseItems.push(obj);
   // Recalculate existing expense bucket without discarding manual costs.
   const total=s.wizard.expenseItems.reduce((sum,x)=>sum+n(x.unitCost)*(n(x.qty)||1)*(n(x.people)||1)*(n(x.days)||1),0);
   if(s.wizard.manualExtraCost===undefined)s.wizard.manualExtraCost=Math.max(0,n(s.wizard.extraCost)-(total-n(exp.cost)));
   s.wizard.extraCost=round(n(s.wizard.manualExtraCost)+total);
   keepTemp();render();
  }
 },true);
})();