/* CIVOLTEN — fornecimento e composição por serviço.
   O custo unitário SIURB é uma REFERÊNCIA GLOBAL. Não presumir que seja mão de obra.
   Este módulo mantém as três modalidades e exige conferência da divisão SIURB. */
(function(){
  'use strict';
  const originalModal=modalUI;
  const originalSubmit=modalSubmit;
  const originalClick=click;
  const originalStepTwo=wizardStep2;
  const originalSiurbPanel=typeof siurbPanel==='function'?siurbPanel:null;

  function siurbSource(service, editing){
    if(service?.origin==='SIURB')return service;
    if(editing?.source==='SIURB')return editing;
    return null;
  }
  function getCost(n){const v=Number(String(n??0).replace(',','.'));return Number.isFinite(v)&&v>=0?v:0}
  function refCost(source){return getCost(source?.referenceCost??source?.cost)}
  function sourceName(source){return source?.sourceCode||source?.code||''}

  modalUI=function(){
    let html=originalModal();
    const edit=s.edit||{};
    if(s.modal==='additem'){
      const ref=edit.source==='SIURB'?refCost(edit):0;
      html=html.replace('Outros custos / custo SIURB global por unidade (R$)','Equipamentos e outros custos por unidade (R$)');
      const panel='<div class="split-panel" id="siurb-split-panel" '+(edit.source==='SIURB'?'':'hidden')+'>'+
       '<strong>Separação de custos SIURB</strong>'+
       '<p>O total da SIURB é apenas referência. Preencha a mão de obra, os materiais e equipamentos após conferir a composição oficial. O aplicativo não inventa percentuais.</p>'+
       '<label class="label">Custo unitário total da SIURB (somente referência)</label>'+
       '<input class="input" id="siurb-reference" name="siurbReference" type="number" readonly min="0" step="0.01" value="'+esc(ref)+'">'+
       '<label class="split-check"><input type="checkbox" id="siurb-checked" name="siurbChecked" '+(edit.splitConfirmed?'checked':'')+'> Conferi a divisão dos custos do serviço</label>'+
       '<label class="split-check"><input type="checkbox" id="siurb-save-library" name="siurbSaveLibrary"> Guardar esta divisão também em Meus serviços</label>'+
       '<p class="split-warning" id="siurb-guidance">Se o cliente fornece os materiais, eles não entram no valor cobrado. Equipamentos e despesas por sua conta continuam incluídos.</p>'+
       '</div>';
      html=html.replace('<div class="form-actions">',panel+'<div class="form-actions">');
      html=html.replace('Os custos SIURB são globais (mão de obra + materiais + equipamentos conforme a composição); para orçamento somente de mão de obra, edite e separe os custos antes de salvar.',
       'Na SIURB, o valor unitário normalmente engloba custos diretos. Informe a divisão real; em Somente mão de obra os materiais do cliente não entram no seu custo.');
      if(s.wizard?.type==='Mão de obra')
        html=html.replace('Material fornecido por','Material fornecido por (somente mão de obra: cliente)');
    }
    if(s.modal==='addservice'&&edit.origin==='SIURB'){
      const panel='<div class="split-panel"><strong>Composição manual do serviço SIURB</strong><p>A referência total não deve ser somada aos componentes. Separe a mão de obra, materiais e equipamentos com base na composição oficial.</p>'+
         field('Equipamentos e outros custos por unidade (R$)','equipment','0',edit.equipment||0,'number')+
         '<label class="split-check"><input name="catalogSplitChecked" type="checkbox" '+(edit.costSplitConfirmed?'checked':'')+'> Divisão conferida na composição oficial</label></div>';
      html=html.replace('<div class="form-actions">',panel+'<div class="form-actions">');
    }
    return html;
  };

  modalSubmit=function(form){
    if(s.modal==='additem'){
      const vals=new FormData(form);
      const selected=db.services.find(v=>v.id===vals.get('serviceId'));
      const editing=s.edit||null, source=siurbSource(selected,editing);
      if(s.wizard?.type==='Mão de obra')form.elements.owner.value='cliente';
      if(s.wizard?.type==='Completo')form.elements.owner.value='empresa';
      if(source){
        if(!form.elements.siurbChecked?.checked){
          toast('SIURB: confirme primeiro os custos de mão de obra, materiais e equipamentos.');return;
        }
        if(s.wizard?.type==='Mão de obra'&&getCost(form.elements.labor?.value)<=0){
          toast('Informe o custo de mão de obra por unidade antes de continuar.');return;
        }
        const total=getCost(form.elements.labor?.value)+getCost(form.elements.material?.value)+getCost(form.elements.extra?.value);
        if(total<=0){toast('Informe os custos separados. O total SIURB não é somente mão de obra.');return;}
        if(getCost(form.elements.siurbReference?.value)>0 && total > getCost(form.elements.siurbReference?.value)*2.5){
          if(!confirm('A soma dos custos informados está muito acima do custo de referência SIURB. Conferiu os valores?'))return;
        }
      }
      const prevCount=s.wizard?.items?.length||0;
      const editingId=editing?.id;
      originalSubmit(form);
      if(!s.wizard || s.modal==='additem')return;
      const saved=editingId?s.wizard.items.find(v=>v.id===editingId):s.wizard.items[prevCount];
      if(!saved)return;
      if(source){
        saved.source='SIURB';
        saved.sourceCode=source.sourceCode||source.code||saved.sourceCode;
        saved.sourceGroup=source.sourceGroup||source.group||saved.sourceGroup;
        saved.sourceDate=source.sourceDate||'07/2026';
        saved.referenceCost=refCost(source);
        saved.splitConfirmed=true;
        // O valor global de referência NUNCA entra como um custo adicional.
        // O campo extra contém somente equipamento e outras despesas informadas.
        saved.extra=getCost(form.elements.extra?.value);
        const base=db.services.find(v=>v.id===selected?.id)||db.services.find(v=>v.origin==='SIURB'&&v.sourceCode===saved.sourceCode&&v.sourceGroup===saved.sourceGroup);
        if(base&&form.elements.siurbSaveLibrary?.checked){
          base.labor=getCost(saved.labor);
          base.material=getCost(saved.material);
          base.equipment=getCost(saved.extra);
          base.costSplitConfirmed=true;
          save();
        }
      }
      keepTemp();render();
      return;
    }
    if(s.modal==='addservice'&&s.edit?.origin==='SIURB'){
      const id=s.edit.id, equipment=getCost(form.elements.equipment?.value),confirmed=!!form.elements.catalogSplitChecked?.checked;
      originalSubmit(form);
      const item=db.services.find(v=>v.id===id);
      if(item){
        item.equipment=equipment;
        item.costSplitConfirmed=confirmed;
        save();render();
      }
      return;
    }
    originalSubmit(form);
  };

  document.addEventListener('change',function(event){
    if(s.modal!=='additem'||event.target?.name!=='serviceId')return;
    const service=db.services.find(v=>v.id===event.target.value);
    const panel=document.getElementById('siurb-split-panel');
    const isSiurb=service?.origin==='SIURB';
    if(panel)panel.hidden=!isSiurb;
    const extra=document.querySelector('#modal-form [name="extra"]');
    // O preenchimento legado colocava todo o custo SIURB em extra.
    // Corrige a pré-seleção: apenas equipamento efetivamente conferido vai em extra.
    if(extra)extra.value=isSiurb?(service.costSplitConfirmed?getCost(service.equipment):0):0;
    if(isSiurb){
      const labor=document.querySelector('#modal-form [name="labor"]');
      const material=document.querySelector('#modal-form [name="material"]');
      if(labor)labor.value=service.costSplitConfirmed?getCost(service.labor):0;
      if(material)material.value=service.costSplitConfirmed?getCost(service.material):0;
      const reference=document.getElementById('siurb-reference');
      if(reference)reference.value=refCost(service);
      const check=document.getElementById('siurb-checked');
      if(check)check.checked=!!service.costSplitConfirmed;
    }
  });

  wizardStep2=function(){
    let html=originalStepTwo();
    const note='<p class="split-quote-hint"><strong>'+(s.wizard.type==='Mão de obra'?'Somente mão de obra':s.wizard.type==='Completo'?'Serviço completo':'Fornecimento misto')+'</strong> — '+(s.wizard.type==='Mão de obra'?'Materiais comprados pelo cliente não entram na sua cobrança.':'Confira quem fornece o material em cada item.')+'</p>';
    html=html.replace('<p class="small-desc">Adicione serviços do catálogo.',note+'<p class="small-desc">Adicione serviços do catálogo.');
    const pending=(s.wizard?.items||[]).filter(i=>i.source==='SIURB'&&!i.splitConfirmed);
    if(pending.length)html=html.replace('<div class="form-actions">','<div class="info-box warn">'+pending.length+' item(ns) SIURB ainda precisam de separação de custos. Toque no lápis de cada item para conferir.</div><div class="form-actions">');
    return html;
  };

  click=function(action,element){
    if(s.page==='newquote'&&['next','finish','draft'].includes(action)){
      const pending=(s.wizard?.items||[]).filter(i=>i.source==='SIURB'&&!i.splitConfirmed);
      if(pending.length&&(s.step>=2||action==='finish')){
        toast('Abra o item SIURB e confirme mão de obra, materiais e equipamentos antes de salvar.');return;
      }
    }
    return originalClick(action,element);
  };

  if(originalSiurbPanel){
    siurbPanel=function(){
      const html=originalSiurbPanel();
      const url='https://prefeitura.sp.gov.br/documents/d/obras/onerada-sem-des-comp-custos-unit-edif-julho-2026-2-xls';
      return html.replace('<div class="siurb-sources">',
       '<p class="split-composition-link"><a href="'+url+'" target="_blank" rel="noopener noreferrer">Consultar composições oficiais de Edificações (XLS) ↗</a><br><small>Use as composições para conferir os componentes de mão de obra, materiais e equipamentos.</small></p><div class="siurb-sources">');
    };
  }
})();
