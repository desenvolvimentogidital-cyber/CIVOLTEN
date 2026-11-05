/* CIVOLTEN • Fluxo diário de orçamento, salários CLT e pesquisa SIURB
   Sem percentuais inventados para decompor custos públicos. */
(function(){
'use strict';
const baseModal=modalUI,baseSubmit=modalSubmit,baseStep2=wizardStep2,baseStep3=wizardStep3,baseClick=click;
const baseWorkerRoute=ROUTES.workers,baseExpenseRoute=ROUTES.expenses;
const EMPLOYER_MEI=3,FGTS=8;
const BRL=n=>cash(Number(n)||0), number=v=>Math.max(0,Number(String(v??'0').replace(',','.'))||0);
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const pretty=n=>Number(number(n).toFixed(2));
const option=(v,label,selected=false)=>'<option value="'+esc(v)+'" '+(selected?'selected':'')+'>'+esc(label)+'</option>';
let selected=null,modalIdentity=null,dqSearch='',chosenMaterialRef=null;
if(!Array.isArray(db.siurbMaterials))db.siurbMaterials=[];
if(!Array.isArray(db.siurbLabor))db.siurbLabor=[];
if(!db.dailyCostRules)db.dailyCostRules={monthlyHours:160};
const laborRoles=/pedreiro|eletricista|ajudante|servente|pintor|encanador|mestre|carpinteiro|armador|azulejista|gesseiro|soldador|tecnico|operador|montador|marceneiro|instalador|aplicador|meio oficial|oficial|almoxarife|vigia|porteiro/;
const materialRoles=/cabo|tubo|eletroduto|disjuntor|argamassa|cimento|areia|brita|tijolo|bloco|fio|tomada|conector|interruptor|tinta|forro|luminaria|piso|placa|parafuso|caixa|eletrocalha|concreto|massa|janela|porta|vergalhao|fita|rejunte|manta|chapa|perfil|telha/;
function cltCost(w){
 const wage=number(w.salary), fgts=number(w.fgts??FGTS),inss=number(w.employerInss??EMPLOYER_MEI);
 const others=number(w.employerExtraPercent);
 const thirteenth=wage/12, vacationThird=wage/36;
 const basis=wage+thirteenth+vacationThird;
 const charges=basis*(fgts+inss+others)/100;
 const meals=number(w.mealBenefit),transport=number(w.transportBenefit),benefits=number(w.otherBenefit);
 const monthlyReserve=number(w.monthlyReserve);
 const total=basis+charges+meals+transport+benefits+monthlyReserve;
 const hours=number(w.productiveHours)||160;
 return {wage,thirteenth,vacationThird,charges,meals,transport,benefits,monthlyReserve,total,hours,hourly:total/hours};
}
function workerHour(w){
 if(!w)return 0;
 if(w.link==='Empregado'||w.employmentType==='CLT')return number(w.salary)>0?cltCost(w).hourly:number(w.cost)/(number(w.productiveHours)||160);
 const rate=number(w.cost);
 if(w.unit==='mês')return rate/(number(w.productiveHours)||160);
 if(w.unit==='diária')return rate/(number(w.dailyHours)||8);
 return rate;
}
function allServices(){
 const catalog=db.services.map(x=>({kind:'catalog',data:x,id:x.id,label:x.name,code:x.sourceCode||'',unit:x.unit||'un',source:x.origin||'manual'}));
 const imported=(db.siurbItems||[]).map(x=>({kind:'siurb',data:x,id:x.id,label:x.name,code:x.code||'',unit:x.unit||'un',source:'SIURB'}));
 const ids=new Set(catalog.filter(x=>x.source==='SIURB').map(x=>(x.data.sourceGroup||'')+':'+x.code));
 return catalog.concat(imported.filter(x=>!ids.has(x.data.group+':'+x.code)));
}
function matchingServices(q){
 const n=norm(q),all=allServices();
 return all.filter(x=>!n||norm(x.label+' '+x.code+' '+x.unit).includes(n))
 .sort((a,b)=>{const an=norm(a.label),bn=norm(b.label);return ((norm(a.code)===n&&n)?-100:0)+(an.startsWith(n)?-20:0)-( ((norm(b.code)===n&&n)?-100:0)+(bn.startsWith(n)?-20:0))})
 .slice(0,30);
}
function serviceHits(q){
 const rows=matchingServices(q);
 return rows.map(x=>'<button type="button" class="dw-hit" data-action="dw-pick-service" data-kind="'+x.kind+'" data-id="'+esc(x.id)+'">'+
 '<span><strong>'+esc(x.label)+'</strong><small>'+esc(x.source==='SIURB'?'SIURB '+x.code+' • '+x.unit:'Meu catálogo • '+x.unit)+'</small></span>'+
 '<b>'+BRL(x.source==='SIURB'?x.data.referenceCost??x.data.cost:(number(x.data.labor)+number(x.data.material)+number(x.data.equipment)))+'</b></button>').join('')+
 (!rows.length?'<div class="dw-no-results">Nenhum serviço encontrado. Você pode escrever a descrição manualmente.</div>':'');
}
function selectedMaterial(){const v=db.materials||[];return v.map(x=>option(x.id,x.name+' • '+BRL(x.cost)+'/'+x.unit,false)).join('')}
function selectedWorker(){return (db.workers||[]).map(x=>option(x.id,x.name+' — '+x.role+' ('+BRL(workerHour(x))+'/h)',false)).join('')}
function modalWrapper(title,inner){return '<div class="overlay" id="overlay"><div class="modal dw-modal" role="dialog" aria-modal="true"><div class="modal-header"><h2>'+title+'</h2><button class="icon-btn" data-action="closemodal" type="button" aria-label="Fechar">'+I('close')+'</button></div><form id="modal-form">'+inner+'<div class="form-actions"><button type="button" class="btn btn-light" data-action="closemodal">Cancelar</button><button type="submit" class="btn btn-gold">Salvar</button></div></form></div></div>'}
function selectedSourceInfo(){const d=selected?.data||s.edit||{};const ref=number(d.referenceCost??d.cost);return ref}
function addItemHTML(){
 const e=s.edit||{},key='additem:'+(e.id||'new');
 if(modalIdentity!==key){selected=null;chosenMaterialRef=null;modalIdentity=key;dqSearch=e.service||'';}
 const source=selected?.data||e;const siurb=source?.origin==='SIURB'||source?.group||e.source==='SIURB';
 const verified=!!(source.costSplitConfirmed||source.splitConfirmed);
 const labor=selected?verified?number(source.labor):0:number(e.labor);
 const material=selected?verified?number(source.material):0:number(e.material);
 const extra=selected?verified?number(source.equipment??source.extra):0:number(e.extra);
 const owner=e.owner||(s.wizard?.type==='Mão de obra'?'cliente':'empresa');
 const ref=number(source.referenceCost??source.cost??e.referenceCost);
 const html='<label class="label">Buscar serviço na SIURB ou nos cadastrados</label>'+
 '<div class="dw-search-wrap"><input class="input" name="service" id="dw-service-search" required placeholder="Digite código ou nome do serviço..." autocomplete="off" value="'+esc(dqSearch)+'">'+
 '<div id="dw-service-hits" class="dw-hits" hidden></div></div>'+
 '<p class="dw-help">Selecione um resultado para preencher a descrição, a unidade e os custos que estiverem confirmados. Você também pode digitar um serviço manualmente.</p>'+
 '<p class="dw-help">A descrição é o próprio campo de pesquisa. Ao escolher um serviço, a unidade e os valores disponíveis são preenchidos automaticamente.</p>'+
 '<div class="grid-duo">'+field('Unidade','unit','m, m², m³, ponto, un',selected?.unit||e.unit||'un')+field('Quantidade','qty','1',e.qty||1,'number',true)+'</div>'+
 '<label class="label">Material cadastrado (opcional)</label><select class="input" name="materialId">'+option('','Selecionar material')+selectedMaterial()+'</select>'+
 field('Quantidade de material por unidade de serviço','materialQty','1',e.materialQty||1,'number')+
 '<label class="label">Profissional cadastrado (opcional)</label><select class="input" name="workerId">'+option('','Selecionar profissional')+selectedWorker()+'</select>'+
 '<div class="grid-duo">'+field('Horas por unidade','hoursUnit','Ex.: 1,5',e.hoursUnit||'','number')+field('Número de profissionais','workersCount','1',e.workersCount||1,'number')+'</div>'+
 '<label class="dw-check"><input type="checkbox" name="useWorkerRate" '+(e.workerId?'checked':'')+'> Usar custo real por hora do profissional selecionado</label>'+
 '<div id="dw-worker-hint" class="dw-help">A mão de obra do profissional é calculada conforme o custo mensal e as horas produtivas. Não some novamente a mesma mão de obra da composição SIURB.</div>'+
 '<div class="grid-duo">'+field('Mão de obra / unidade (R$)','labor','0',labor,'number')+field('Materiais / unidade (R$)','material','0',material,'number')+field('Equipamentos / unidade (R$)','extra','0',extra,'number')+'</div>'+
 '<label class="label">Quem fornece os materiais?</label><select name="owner" class="input">'+option('cliente','Cliente',owner==='cliente')+option('empresa','CIVOLTEN',owner==='empresa')+'</select>'+
 '<div class="dw-siurb-note" id="dw-siurb-note" '+(siurb?'':'hidden')+'>'+
 '<strong>Referência SIURB · julho/2026</strong><div class="dw-ref">Total unitário público: <b id="dw-siurb-total">'+BRL(ref)+'</b></div>'+
 '<p>Este é o custo completo de referência, e não o valor de mão de obra. Separe componentes antes de usar como custo real.</p>'+
 '<label class="dw-check"><input type="checkbox" name="siurbChecked" '+(verified?'checked':'')+'> Conferi a composição do serviço</label>'+
 '<label class="dw-check"><input type="checkbox" name="siurbSaveLibrary"> Guardar os custos separados na minha biblioteca</label></div>'+
 '<input type="hidden" name="serviceId" value="'+esc(selected?.kind==='catalog'?selected.id:'')+'">'+
 '<input type="hidden" name="sourceId" value="'+esc(selected?.kind==='siurb'?selected.id:e.sourceId||'')+'">'+
 '<input type="hidden" name="siurbReference" value="'+ref+'">'+
 '<div id="dw-line-total" class="dw-total">Custo direto por unidade: <b>'+BRL(labor+(owner==='empresa'?material:0)+extra)+'</b></div>';
 return modalWrapper(e.id?'Editar item':'Adicionar item',html);
}
function workerHTML(){
 const w=s.edit||{},isClt=w.link==='Empregado'||w.employmentType==='CLT';
 const hours=number(w.productiveHours)||160;
 const html=field('Nome do profissional','name','Nome do trabalhador',w.name||'','text',true)+
 field('Função','role','Pedreiro, eletricista, ajudante...',w.role||'')+
 '<label class="label">Vínculo / modelo de custo</label><select class="input" name="link">'+
 option('Empregado','Empregado CLT',isClt)+option('Terceirizado','Terceirizado',w.link==='Terceirizado'||!w.link)+
 option('Próprio','Trabalho próprio / pró-labore',w.link==='Próprio')+option('Referência SIURB','Referência de custo SIURB',w.link==='Referência SIURB')+'</select>'+
 '<div id="dw-clt-fields" '+(isClt?'':'hidden')+'>'+
 '<div class="dw-info">Provisão anualizada estimada, ajustável. Para MEI, a contribuição patronal padrão é 3%; FGTS de 8%. Confirme piso, adicionais e convenção coletiva antes de contratar.</div>'+
 '<div class="grid-duo">'+field('Salário-base mensal (R$)','salary','2800',w.salary||0,'number')+
 field('Horas produtivas/mês','productiveHours','160',hours,'number')+
 field('FGTS empregador (%)','fgts','8',w.fgts??8,'number')+
 field('INSS patronal (%)','employerInss','3 MEI',w.employerInss??3,'number')+
 field('Outros encargos (%)','employerExtraPercent','0',w.employerExtraPercent||0,'number')+
 field('Alimentação mensal (R$)','mealBenefit','0',w.mealBenefit||0,'number')+
 field('Transporte mensal (R$)','transportBenefit','0',w.transportBenefit||0,'number')+
 field('Benefícios extras (R$)','otherBenefit','0',w.otherBenefit||0,'number')+
 field('Reserva adicional (R$)','monthlyReserve','0',w.monthlyReserve||0,'number')+'</div>'+
 '<div class="dw-total" id="dw-clt-result">Custo mensal estimado: <b>'+BRL(cltCost(w).total)+'</b></div></div>'+
 '<div id="dw-nonclt-fields" '+(isClt?'hidden':'')+'>'+
 field('Custo contratado / taxa de referência (R$)','cost','0',!isClt?w.cost||0:0,'number')+
 '<label class="label">Unidade de cobrança</label><select class="input" name="unit">'+
 ['hora','diária','mês'].map(v=>option(v,v,w.unit===v)).join('')+'</select></div>'+
 '<div class="dw-siurb-note"><strong>Mão de obra SIURB (referência)</strong><p>As planilhas de mensalistas e horistas não substituem o salário real da pessoa. Importe a tabela para consultar valores.</p>'+
 '<button class="btn btn-outline block" type="button" data-action="dw-import-labor">Importar XLS de mão de obra</button>'+
 '<div class="grid-duo"><button class="btn btn-outline" type="button" data-action="dw-fetch-mensalista">Atualizar mensalistas</button><button class="btn btn-outline" type="button" data-action="dw-fetch-horista">Atualizar horistas</button></div>'+
 '<input type="file" accept=".xls,.xlsx,.csv" id="dw-labor-file" hidden>'+
 '<div class="dw-help" id="dw-labor-count">'+db.siurbLabor.length+' referências SIURB disponíveis</div>'+
 '<select class="input" name="siurbWorkerRef">'+option('','Consultar referência SIURB')+
 db.siurbLabor.slice(0,700).map(x=>option(x.id,x.name+' • '+(x.costWithoutCharges!=null?BRL(x.costWithoutCharges)+' sem enc. / '+x.unit:BRL(x.cost)+' (referência) / '+x.unit),w.siurbWorkerRef===x.id)).join('')+'</select></div>';
 return modalWrapper(w.id?'Editar profissional':'Novo profissional',html);
}
function expenseCatalogHTML(){
 const d=s.edit||{};
 return modalWrapper(d.id?'Editar despesa':'Nova despesa',field('Descrição','name','Almoço, deslocamento, pedágio...',d.name||'','text',true)+
 field('Categoria','category','Alimentação, transporte, aluguel...',d.category||'')+
 field('Custo unitário (R$)','cost','0',d.cost||0,'number')+
 '<label class="label">Unidade</label><select class="input" name="unit">'+
 ['fixo','refeição','diária','km','viagem','unidade','mês'].map(x=>option(x,x,d.unit===x)).join('')+'</select>'+
 '<p class="dw-help">Cadastre aqui despesas reutilizáveis. O valor só entra no orçamento quando você escolher adicioná-la àquela obra.</p>');
}
function expenseQuoteHTML(){
 const d=s.editExpense||{};
 return modalWrapper('Despesa da obra','<label class="label">Selecionar despesa cadastrada (opcional)</label><select class="input" name="expenseId">'+
 option('','Despesa manual')+db.expenses.map(x=>option(x.id,x.name+' • '+BRL(x.cost)+' / '+(x.unit||'un'),d.expenseId===x.id)).join('')+'</select>'+
 field('Descrição','name','Almoço, combustível, pedágio...',d.name||'','text',true)+
 '<div class="grid-duo">'+field('Custo por unidade (R$)','unitCost','0',d.unitCost||0,'number')+
 field('Quantidade','qty','1',d.qty||1,'number',true)+
 field('Pessoas (se aplicável)','people','1',d.people||1,'number')+
 field('Dias (se aplicável)','days','1',d.days||1,'number')+'</div>'+
 '<p class="dw-help">Total = valor × quantidade × pessoas × dias. Para refeição, use quantidade 1, pessoas e dias. Para transporte, indique viagens ou quilômetros.</p>'+
 '<div id="dw-expense-total" class="dw-total">Total da despesa: <b>'+BRL(number(d.unitCost)*number(d.qty||1)*number(d.people||1)*number(d.days||1))+'</b></div>');
}
modalUI=function(){
 if(s.modal==='additem')return addItemHTML();
 if(s.modal==='addworker')return workerHTML();
 if(s.modal==='addexpense')return expenseCatalogHTML();
 if(s.modal==='dw-expense')return expenseQuoteHTML();
 modalIdentity=null;
 return baseModal();
};
function syncExpenseTotal(){
 if(!s.wizard)return;
 if(!Array.isArray(s.wizard.expenseItems))s.wizard.expenseItems=[];
 const total=s.wizard.expenseItems.reduce((sum,x)=>sum+number(x.unitCost)*number(x.qty)*number(x.people||1)*number(x.days||1),0);
 // Preserva os custos de orçamentos anteriores.
 if(s.wizard.manualExtraCost===undefined)s.wizard.manualExtraCost=pretty(Math.max(0,number(s.wizard.extraCost)-total));
 s.wizard.extraCost=pretty(number(s.wizard.manualExtraCost)+total);
 keepTemp();
}
function quotaExpenses(){return (s.wizard?.expenseItems||[]).reduce((sum,x)=>sum+number(x.unitCost)*number(x.qty)*number(x.people||1)*number(x.days||1),0)}
function updateLineTotal(form){
 const labor=number(form.elements.labor?.value),material=number(form.elements.material?.value),equip=number(form.elements.extra?.value),owner=form.elements.owner?.value;
 const el=document.getElementById('dw-line-total');
 if(el)el.innerHTML='Custo direto por unidade: <b>'+BRL(labor+(owner==='empresa'?material:0)+equip)+'</b>';
}
function fillWorker(form){
 const w=db.workers.find(x=>x.id===form.elements.workerId?.value);
 if(!w)return;
 const hours=number(form.elements.hoursUnit?.value),count=number(form.elements.workersCount?.value)||1;
 const rate=workerHour(w),calcLabor=hours*count*rate;
 const hint=document.getElementById('dw-worker-hint');
 if(hint)hint.textContent='Custo de '+w.name+': '+BRL(rate)+'/h × '+hours+' h × '+count+' profissional(is) = '+BRL(calcLabor)+' por unidade.';
 if(form.elements.useWorkerRate?.checked && hours>0)form.elements.labor.value=pretty(calcLabor);
 updateLineTotal(form);
}
function chooseService(ref){
 const opt=allServices().find(x=>x.id===ref.id&&x.kind===ref.kind);
 if(!opt)return;
 selected=opt;dqSearch=opt.label;const form=document.getElementById('modal-form');if(!form)return;
 const svc=opt.data,isSiurb=opt.source==='SIURB',isConfirmed=!!svc.costSplitConfirmed;
 form.elements.service.value=svc.name||opt.label;form.elements.unit.value=svc.unit||'un';
 form.elements.serviceId.value=opt.kind==='catalog'?opt.id:'';
 form.elements.sourceId.value=opt.kind==='siurb'?opt.id:'';
 form.elements.labor.value=isSiurb?(isConfirmed?number(svc.labor):0):number(svc.labor);
 form.elements.material.value=isSiurb?(isConfirmed?number(svc.material):0):number(svc.material);
 form.elements.extra.value=isSiurb?(isConfirmed?number(svc.equipment):0):number(svc.equipment||0);
 form.elements.siurbReference.value=isSiurb?number(svc.referenceCost??svc.cost):0;
 const note=document.getElementById('dw-siurb-note');
 if(note)note.hidden=!isSiurb;
 const total=document.getElementById('dw-siurb-total');
 if(total)total.textContent=BRL(svc.referenceCost??svc.cost);
 form.elements.siurbChecked.checked=isSiurb&&isConfirmed;
 document.getElementById('dw-service-search').value=opt.label;
 document.getElementById('dw-service-hits').hidden=true;
 if(s.wizard?.type==='Mão de obra')form.elements.owner.value='cliente';
 if(s.wizard?.type==='Completo')form.elements.owner.value='empresa';
 updateLineTotal(form);
}
function saveItem(form){
 if(!s.wizard)return;
 const x=Object.fromEntries(new FormData(form).entries());
 const qty=number(x.qty),labor=number(x.labor),material=number(x.material),extra=number(x.extra);
 if(!x.service?.trim()){toast('Informe ou selecione a descrição do serviço.');return}
 if(qty<=0){toast('A quantidade deve ser maior que zero.');return}
 const source=selected?.source==='SIURB'?selected.data:(selected?.data?.origin==='SIURB'?selected.data:(s.edit?.source==='SIURB'&&!selected?s.edit:null));
 // Usar custo real com produtividade cadastrada não exige fingir uma divisão oficial da SIURB.
 const companyProductivity=!!(labor>0&&(selected?.data?.productivity?.crew?.length||(!selected&&s.edit?.companyProductivityConfirmed)));
 if(source){
  if(!form.elements.siurbChecked.checked&&!companyProductivity){toast('Informe e confira a composição ou cadastre a produtividade real da CIVOLTEN antes de incluir.');return}
  if(s.wizard.type==='Mão de obra'&&labor<=0){toast('Informe o custo de mão de obra por unidade. O total SIURB não representa somente mão de obra.');return}
  if(labor+material+extra<=0){toast('O serviço SIURB precisa de custos separados.');return}
 }
 let owner=x.owner;
 if(s.wizard.type==='Mão de obra')owner='cliente';
 if(s.wizard.type==='Completo')owner='empresa';
 const w=db.workers.find(v=>v.id===x.workerId);
 const item={id:s.edit?.id||uid('it'),service:x.service.trim(),unit:x.unit?.trim()||'un',qty:pretty(qty),
 owner,labor:pretty(labor),material:pretty(material),extra:pretty(extra),
 workerId:w?.id||'',hoursUnit:number(x.hoursUnit),workersCount:number(x.workersCount)||1,
 materialId:x.materialId||'',materialQty:number(x.materialQty)||1,materialSourceCode:chosenMaterialRef?.code||'',source:source?'SIURB':'',sourceCode:source?.sourceCode||source?.code||'',
 sourceGroup:source?.sourceGroup||source?.group||'',sourceDate:source?.sourceDate||'07/2026',
 referenceCost:source?number(source.referenceCost??source.cost):0,splitConfirmed:!!form.elements.siurbChecked?.checked,companyProductivityConfirmed:companyProductivity};
 if(source&&form.elements.siurbSaveLibrary?.checked&&form.elements.siurbChecked?.checked){
  let service=db.services.find(v=>v.origin==='SIURB'&&v.sourceCode===item.sourceCode&&v.sourceGroup===item.sourceGroup);
  if(!service){
   service={id:uid('sv'),origin:'SIURB',name:item.service,unit:item.unit,sourceCode:item.sourceCode,sourceGroup:item.sourceGroup,sourceDate:item.sourceDate,referenceCost:item.referenceCost,sourceRegime:db.siurbMeta?.regime};
   db.services.push(service);
  }
  Object.assign(service,{labor:item.labor,material:item.material,equipment:item.extra,costSplitConfirmed:true});
 }
 if(s.edit?.id){
  const index=s.wizard.items.findIndex(v=>v.id===s.edit.id);
  if(index>=0)s.wizard.items[index]=item;else s.wizard.items.push(item);
 } else s.wizard.items.push(item);
 selected=null;chosenMaterialRef=null;modalIdentity=null;s.edit=null;s.modal=null;keepTemp();save();render();
}
function saveWorker(form){
 const v=Object.fromEntries(new FormData(form).entries());if(!v.name?.trim()){toast('Informe o nome do profissional.');return}
 const isClt=v.link==='Empregado';let obj={...s.edit,...v,employmentType:isClt?'CLT':'Outro'};
 for(const k of ['salary','fgts','employerInss','employerExtraPercent','mealBenefit','transportBenefit','otherBenefit','monthlyReserve','productiveHours','cost'])obj[k]=number(v[k]);
 if(isClt){
  if(!obj.salary){toast('Informe o salário mensal do empregado.');return}
  if(!obj.productiveHours){toast('Horas produtivas devem ser maiores que zero.');return}
  const c=cltCost(obj);obj.cost=pretty(c.total);obj.unit='mês';obj.costPerHour=pretty(c.hourly);
 }else{obj.unit=v.unit||'hora';obj.costPerHour=pretty(workerHour(obj))}
 obj.name=obj.name.trim();obj.id=s.edit?.id||uid('wk');
 const i=db.workers.findIndex(w=>w.id===obj.id);if(i>=0)db.workers[i]=obj;else db.workers.push(obj);
 if(!save())return;
 s.modal=null;s.edit=null;render();toast('Profissional salvo com cálculo de custo atualizado.');
}
function saveExpenseCatalog(form){
 const v=Object.fromEntries(new FormData(form).entries());if(!v.name?.trim()){toast('Informe a despesa.');return}
 const obj={...s.edit,...v,cost:pretty(v.cost),unit:v.unit||'fixo',id:s.edit?.id||uid('ex')};
 const i=db.expenses.findIndex(x=>x.id===obj.id);if(i>=0)db.expenses[i]=obj;else db.expenses.push(obj);
 if(!save())return;s.modal=null;s.edit=null;render();toast('Despesa cadastrada.');
}
function saveQuoteExpense(form){
 const v=Object.fromEntries(new FormData(form).entries());
 if(!v.name?.trim()){toast('Informe a descrição da despesa.');return}
 const obj={id:s.editExpense?.id||uid('qe'),expenseId:v.expenseId||'',name:v.name.trim(),
 unitCost:pretty(v.unitCost),qty:number(v.qty),people:number(v.people)||1,days:number(v.days)||1};
 if(obj.qty<=0){toast('Quantidade deve ser maior que zero.');return}
 if(!s.wizard.expenseItems)s.wizard.expenseItems=[];
 if(s.wizard.manualExtraCost===undefined)s.wizard.manualExtraCost=pretty(Math.max(0,number(s.wizard.extraCost)-quotaExpenses()));
 const i=s.wizard.expenseItems.findIndex(x=>x.id===obj.id);if(i>=0)s.wizard.expenseItems[i]=obj;else s.wizard.expenseItems.push(obj);
 s.modal=null;s.editExpense=null;syncExpenseTotal();render();
}
modalSubmit=function(form){
 if(s.modal==='additem')return saveItem(form);
 if(s.modal==='addworker')return saveWorker(form);
 if(s.modal==='addexpense')return saveExpenseCatalog(form);
 if(s.modal==='dw-expense')return saveQuoteExpense(form);
 return baseSubmit(form);
};
wizardStep2=function(){
 let html=baseStep2();
 const list=(s.wizard?.expenseItems||[]).map(x=>'<div class="dw-expense-row"><span><b>'+esc(x.name)+'</b><small>'+number(x.qty)+' un × '+number(x.people||1)+' pessoa(s) × '+number(x.days||1)+' dia(s)</small></span><strong>'+BRL(number(x.unitCost)*number(x.qty)*number(x.people||1)*number(x.days||1))+'</strong><button type="button" data-action="dw-editexpense" data-id="'+esc(x.id)+'">'+I('edit')+'</button><button type="button" data-action="dw-removeexpense" data-id="'+esc(x.id)+'">'+I('trash')+'</button></div>').join('');
 const panel='<div class="form-card dw-expenses-card"><h3 class="card-title">'+I('wallet')+' Despesas desta obra</h3>'+
 '<p class="small-desc">Almoço, deslocamento, pedágio, hospedagem e outras despesas previstas. Esses valores entram no custo do orçamento <b>uma única vez</b>, conforme suas quantidades.</p>'+
 (list||'<div class="empty">Nenhuma despesa específica adicionada.</div>')+
 '<button type="button" class="btn btn-outline block" data-action="dw-addexpense">'+I('plus')+' Adicionar despesa</button>'+
 '<div class="dw-total">Despesas da obra: <b>'+BRL(quotaExpenses())+'</b></div></div>';
 const boundary='<div class="form-actions">';
 const idx=html.lastIndexOf(boundary);
 if(idx>=0)html=html.slice(0,idx)+panel+html.slice(idx);
 return html;
};
wizardStep3=function(){
 syncExpenseTotal();
 let html=baseStep3();
 // A despesa adicional manual é separada das despesas cadastradas, sem dupla contagem.
 const label='Custo adicional (R$)';
 if(html.includes(label)){
   html=html.replace(label,'Outras despesas manuais (R$)');
   const target='name="extraCost"';
   const index=html.indexOf(target);
   if(index>=0){
     const segment=html.slice(index,index+260);
     const replacement=segment.replace(target,'name="manualExtraCost"').replace('value="'+esc(s.wizard.extraCost||0)+'"','value="'+esc(s.wizard.manualExtraCost||0)+'"');
     html=html.slice(0,index)+replacement+html.slice(index+segment.length);
   }
 }
 const expenseSummary='<div class="form-card dw-expenses-card"><h3 class="card-title">Despesas do orçamento</h3>'+
 (s.wizard?.expenseItems||[]).map(x=>'<div class="summary-row"><span>'+esc(x.name)+'</span><b>'+BRL(number(x.unitCost)*number(x.qty)*number(x.people||1)*number(x.days||1))+'</b></div>').join('')+
 '<div class="summary-row"><span>Despesas cadastradas</span><strong>'+BRL(quotaExpenses())+'</strong></div>'+
 '<div class="summary-row"><span>Outras despesas</span><strong>'+BRL(number(s.wizard?.manualExtraCost))+'</strong></div>'+
 '<p class="small-desc">O custo da equipe está no valor de mão de obra. Benefícios mensais incluídos no custo CLT não devem ser repetidos aqui.</p></div>';
 const pos=html.indexOf('<div class="form-actions">');
 if(pos>=0)html=html.slice(0,pos)+expenseSummary+html.slice(pos);
 return html;
};
function onAction(action,el){
 if(action==='dw-pick-service'){chooseService({id:el.dataset.id,kind:el.dataset.kind});return true}
 if(action==='dw-addexpense'){s.editExpense=null;s.modal='dw-expense';render();return true}
 if(action==='dw-removeexpense'){
  if(confirm('Remover esta despesa do orçamento?')){s.wizard.expenseItems=s.wizard.expenseItems.filter(x=>x.id!==el.dataset.id);syncExpenseTotal();render()}return true;
 }
 if(action==='dw-editexpense'){s.editExpense=s.wizard.expenseItems.find(x=>x.id===el.dataset.id)||null;s.modal='dw-expense';render();return true}
 if(action==='dw-import-labor'){document.getElementById('dw-labor-file')?.click();return true}
 return false;
}
click=function(action,el){
 if(onAction(action,el))return;
 if(action==='additem'){selected=null;chosenMaterialRef=null;modalIdentity=null;dqSearch='';}
 if(action==='edititem'){selected=null;chosenMaterialRef=null;modalIdentity=null;}
 if(action==='finish'||action==='draft')syncExpenseTotal();
 if(action==='recalc'){
  const el=document.querySelector('[name="manualExtraCost"]');
  if(el&&s.wizard)s.wizard.manualExtraCost=number(el.value);
  syncExpenseTotal();
 }
 return baseClick(action,el);
};
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-action]');if(!btn)return;
 if(btn.dataset.action.startsWith('dw-')){e.preventDefault();e.stopPropagation();click(btn.dataset.action,btn)}
},true);
document.addEventListener('input',e=>{
 const form=document.getElementById('modal-form');
 if(e.target.id==='dw-service-search'){
  dqSearch=e.target.value;
  if(selected&&norm(selected.label)!==norm(dqSearch)){
   selected=null;
   const form=document.getElementById('modal-form');
   if(form){form.elements.sourceId.value='';form.elements.serviceId.value='';form.elements.siurbReference.value=0;form.elements.siurbChecked.checked=false;}
   const p=document.getElementById('dw-siurb-note');if(p)p.hidden=true;
  }
  const hits=document.getElementById('dw-service-hits');
  if(hits){hits.innerHTML=serviceHits(dqSearch);hits.hidden=false}
 }
 if(form&&s.modal==='additem'&&form.contains(e.target)){
  if(['hoursUnit','workersCount'].includes(e.target.name))fillWorker(form);
  if(e.target.name==='materialQty'&&chosenMaterialRef){form.elements.material.value=pretty(number(chosenMaterialRef.cost)*number(form.elements.materialQty.value));updateLineTotal(form);}
  if(['labor','material','extra'].includes(e.target.name))updateLineTotal(form);
 }
 if(form&&s.modal==='addworker'&&form.contains(e.target)&&form.elements.link?.value==='Empregado'){
  const vals=Object.fromEntries(new FormData(form).entries());const m=cltCost(vals);
  const result=document.getElementById('dw-clt-result');if(result)result.innerHTML='Custo mensal estimado: <b>'+BRL(m.total)+'</b> · '+BRL(m.hourly)+'/hora produtiva (base '+m.hours+' h)';
 }
 if(form&&s.modal==='dw-expense'&&form.contains(e.target)){
  const vals=Object.fromEntries(new FormData(form).entries());const p=number(vals.unitCost)*number(vals.qty)*number(vals.people||1)*number(vals.days||1);
  const result=document.getElementById('dw-expense-total');if(result)result.innerHTML='Total da despesa: <b>'+BRL(p)+'</b>';
 }
 if(s.page==='newquote'&&e.target.name==='manualExtraCost'){s.wizard.manualExtraCost=number(e.target.value);syncExpenseTotal();}
},true);
document.addEventListener('focusin',e=>{
 if(e.target.id==='dw-service-search'){
  const h=document.getElementById('dw-service-hits');
  if(h){h.innerHTML=serviceHits(e.target.value||'');h.hidden=false;}
 }
},true);
document.addEventListener('change',e=>{
 const form=document.getElementById('modal-form');
 if(form&&s.modal==='additem'&&form.contains(e.target)){
  if(['serviceId','materialId','workerId','expenseId'].includes(e.target.name))e.stopImmediatePropagation();
  if(e.target.name==='workerId'||e.target.name==='useWorkerRate')fillWorker(form);
  if(e.target.name==='owner')updateLineTotal(form);
  if(e.target.name==='materialId'){
   const m=db.materials.find(v=>v.id===e.target.value);
   if(m){chosenMaterialRef=m;form.elements.material.value=pretty(number(m.cost)*(number(form.elements.materialQty?.value)||1));if(!form.elements.service.value)form.elements.service.value=m.name;if(!selected&&!s.edit?.service)form.elements.unit.value=m.unit||'un';updateLineTotal(form);}
  }
 }
 if(form&&s.modal==='addworker'&&e.target.name==='link'){
  const clt=e.target.value==='Empregado';
  document.getElementById('dw-clt-fields').hidden=!clt;
  document.getElementById('dw-nonclt-fields').hidden=clt;
 }
 if(form&&s.modal==='dw-expense'&&e.target.name==='expenseId'){
  const d=db.expenses.find(v=>v.id===e.target.value);
  if(d){form.elements.name.value=d.name;form.elements.unitCost.value=number(d.cost);form.elements.qty.value=1;}
 }
 if(e.target.id==='dw-labor-file')importLaborFile(e.target.files?.[0]);
},true);
function workerRoute(){
 const html=baseWorkerRoute();return html.replace('<main class="sheet full">','<main class="sheet full">'+
 '<div class="dw-info">CLT: custo mensal inclui salário, provisão de 13º, adicional de férias, FGTS e INSS patronal configurados, além dos benefícios informados. A hora usa as horas produtivas cadastradas.</div>'+
 '<button class="btn btn-outline block" data-action="dw-open-labor-ref">Consultar tabela mensalista SIURB</button>');
}
ROUTES.workers=workerRoute;
ROUTES.expenses=function(){
 const html=baseExpenseRoute();
 return html.replace('<main class="sheet full">','<main class="sheet full"><div class="dw-info">Cadastre valores de almoço, transporte, combustível, pedágio, hospedagem, locação e outras despesas. Depois selecione apenas as despesas pertinentes em cada orçamento.</div>');
};
const styles=document.createElement('style');
styles.textContent='.dw-modal .input{margin-bottom:10px}.dw-help{font-size:12px;color:#67696e;line-height:1.45;margin:4px 0 10px}.dw-search-wrap{position:relative}.dw-hits{position:relative;max-height:275px;overflow:auto;border:1px solid #e6bd60;border-radius:14px;background:#fff9ec;margin:6px 0 10px;box-shadow:0 5px 22px #0001}.dw-hit{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;text-align:left;background:#fff;border:0;border-bottom:1px solid #e6e6e6;padding:12px;color:#222}.dw-hit strong{display:block;font-size:13px}.dw-hit small{display:block;color:#7c6a48;font-size:10px}.dw-hit b{font-size:11px;color:#b77c20;white-space:nowrap}.dw-no-results{padding:14px;color:#666}.dw-check{display:flex;align-items:center;gap:9px;margin:9px 0;color:#303035;font-size:12px}.dw-check input{width:19px;height:19px;accent-color:#dfa026}.dw-siurb-note{border:1px solid #efbd56;background:#fff8e8;border-radius:13px;padding:12px;margin:12px 0;color:#67502c;font-size:12px;line-height:1.5}.dw-siurb-note[hidden],#dw-clt-fields[hidden],#dw-nonclt-fields[hidden]{display:none}.dw-ref{margin-top:8px}.dw-total{background:#fff1c7;border-radius:12px;padding:12px;margin:12px 0;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px}.dw-info{padding:12px;background:#fff9e9;border-left:3px solid #e9a526;border-radius:8px;font-size:12px;line-height:1.5;margin:12px 0}.dw-expense-row{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #ddd}.dw-expense-row span{flex:1;min-width:0}.dw-expense-row b{display:block;font-size:12px}.dw-expense-row small{display:block;font-size:10px;color:#777}.dw-expense-row strong{white-space:nowrap;font-size:12px}.dw-expense-row button{border:0;background:#eee;border-radius:8px;padding:6px;min-width:27px}.dw-expenses-card{margin:10px 0 16px}';
document.head.append(styles);

/* Tabelas complementares oficiais: referência de mão de obra, insumos e materiais */
let insumoCatalog=[],insumoSearch='',importBusy=false,importMessage='';
function xlsCost(x){
 if(typeof x==='number')return Number.isFinite(x)?x:NaN;
 const raw=String(x??'').replace(/R\$/g,'').replace(/\s/g,'').trim();
 if(!/^\d[\d.,]*$/.test(raw))return NaN;
 if(raw.includes(',')&&raw.includes('.'))return Number(raw.replace(/\./g,'').replace(',','.'));
 if(raw.includes(','))return Number(raw.replace(',','.'));
 return Number(raw);
}
function parseAuxSheet(buffer,kind){
 const XLSX=window.XLSX;
 if(!XLSX)throw new Error('Leitor de planilhas não carregado');
 const wb=XLSX.read(new Uint8Array(buffer),{type:'array',cellDates:false});
 const out=new Map();let seen=0;
 for(const name of wb.SheetNames){
  const ws=wb.Sheets[name];if(!ws||!ws['!ref'])continue;
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:'',blankrows:false});
  const headerText=norm(rows.slice(0,45).map(row=>Array.isArray(row)?row.join(' '):'').join(' '));
  const hasWithout=/sem\s+encargos/.test(headerText),hasWith=/(?:^|\s)com\s+encargos/.test(headerText);
  const hourlyTable=/custo\s+horario|valor\s+hora|por\s+hora/.test(headerText);
  const monthlyTable=!hourlyTable&&/custo\s+mensal|valor\s+mensal/.test(headerText);
  for(const row of rows){
   const cells=(Array.isArray(row)?row:[]).map(x=>String(x??'').trim());
   if(!cells.some(Boolean))continue;seen++;
   const joined=norm(cells.join(' '));
   if(/(tabela de custo|encargos sociais|composic|referencia|total geral|bdi|insumos? de obra)/.test(joined))continue;
   let descIdx=-1;
   for(let i=0;i<cells.length;i++){
    if(cells[i].length<6||cells[i].length>210||/^\d[\d.,/-]*$/.test(cells[i]))continue;
    if(kind==='insumos'&&materialRoles.test(norm(cells[i]))){descIdx=i;break;}
    if(kind!=='insumos'&&laborRoles.test(norm(cells[i]))){descIdx=i;break;}
   }
   if(descIdx<0)continue;
   const nameText=cells[descIdx].replace(/\s+/g,' ').trim();
   if(nameText.length<6||nameText.length>210)continue;
   const rest=cells.slice(descIdx+1);
   const valids=rest.map(xlsCost).filter(x=>Number.isFinite(x)&&x>0&&x<100000000);
   if(!valids.length)continue;
   const price=pretty(valids[valids.length-1]);
   const code=cells.slice(0,descIdx).find(x=>/\d/.test(x)&&x.length<=30)||'';
   const unitMatch=rest.find(v=>/^(UN|UND|PC|PÇ|M|M2|M3|M²|M³|KG|T|L|H|HR|MES|MÊS|CJ|PTO|KM|MIL|CEM)$/i.test(v));
   // Mensalista define o VÍNCULO, não a UNIDADE do preço. Pode ser custo por hora.
   const unit=kind==='insumos'?(unitMatch||'un'):
      hourlyTable||kind==='horista'?'hora':monthlyTable?'mês':unitMatch||'não identificado';
   const canSplit=kind!=='insumos'&&hasWithout&&hasWith&&valids.length>=2;
   const costWithoutCharges=canSplit?pretty(valids[valids.length-2]):null;
   const costWithCharges=canSplit?price:null;
   const id=kind+':'+(code||norm(nameText).slice(0,45));
   if(!out.has(id))out.set(id,{id,code,name:nameText,cost:price,unit,kind,source:'SIURB',sourceDate:'07/2026',
      costWithoutCharges,costWithCharges,costType:canSplit?'separado':'não conferido',
      // Nunca interpretar custo horário SIURB como salário-base CLT mensal.
      isCltSalaryBase:false});
  }
 }
 if(out.size===0)throw new Error('Não foi possível identificar insumos de '+kind+' neste arquivo ('+seen+' linhas lidas). Confira se é a planilha adequada.');
 return [...out.values()];
}
function idbOpen(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(new Error('IndexedDB indisponível neste navegador'));
  const r=indexedDB.open('civolten_siurb_cache_v1',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('tabelas',{keyPath:'key'});
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });
}
async function cacheInsumos(list){
 const idb=await idbOpen();
 return new Promise((resolve,reject)=>{const tx=idb.transaction('tabelas','readwrite');tx.objectStore('tabelas').put({key:'insumos',items:list,date:'07/2026'});tx.oncomplete=()=>{idb.close();resolve()};tx.onerror=()=>{idb.close();reject(tx.error)}});
}
async function restoreInsumos(){
 try{const idb=await idbOpen();const data=await new Promise((resolve,reject)=>{const tx=idb.transaction('tabelas','readonly');const req=tx.objectStore('tabelas').get('insumos');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});idb.close();insumoCatalog=data?.items||[];if(s.page==='materials')render();}catch(e){console.warn('Cache SIURB insumos indisponível:',e.message)}
}
function insumoHits(q){
 const n=norm(q).trim();return insumoCatalog.filter(x=>!n||norm(x.name+' '+x.code).includes(n)).slice(0,25)
 .map(x=>'<button type="button" class="dw-hit" data-action="dw-pick-material" data-id="'+esc(x.id)+'"><span><strong>'+esc(x.name)+'</strong><small>SIURB insumos '+esc(x.code)+' / '+esc(x.unit)+'</small></span><b>'+BRL(x.cost)+'</b></button>').join('')||'<div class="dw-no-results">Nenhum material encontrado nesta consulta.</div>';
}
function materialPanel(){
 return '<div class="form-card"><h3 class="card-title">Insumos SIURB • Julho/2026</h3><p class="small-desc">Tabela de materiais e insumos com custos de referência. Consulte e adicione apenas os itens necessários ao catálogo da CIVOLTEN.</p>'+
 '<button class="btn btn-outline block" data-action="dw-import-material">Carregar insumos oficiais da SIURB</button>'+
 '<label class="label">Ou importar a planilha XLS/XLSX</label><input type="file" class="input" id="dw-insumo-file" accept=".xls,.xlsx,.csv">'+
 '<div class="dw-help">'+esc(importMessage||insumoCatalog.length+' insumos em cache no dispositivo')+'</div>'+
 '<input class="input" id="dw-insumo-search" placeholder="Buscar insumo, código, material..." value="'+esc(insumoSearch)+'">'+
 '<div class="dw-hits" id="dw-insumo-hits">'+insumoHits(insumoSearch)+'</div></div>';
}
const originalMaterialRoute=ROUTES.materials;
ROUTES.materials=function(){const html=originalMaterialRoute();return html.replace('<main class="sheet full">','<main class="sheet full">'+materialPanel())};
const originalAddItemHTML=addItemHTML;
addItemHTML=function(){
 let html=originalAddItemHTML();
 const anchor='<label class="label">Profissional cadastrado (opcional)</label>';
 html=html.replace(anchor,'<label class="label">Ou buscar material na SIURB (opcional)</label>'+
 '<input id="dw-material-search" class="input" placeholder="Nome ou código do insumo" autocomplete="off">'+
 '<div class="dw-hits" id="dw-material-hits" hidden></div>'+anchor);
 return html;
};
function importExplain(kind,list){
 if(kind==='insumos'){insumoCatalog=list;cacheInsumos(list).catch(e=>console.warn('Falha IndexedDB',e));importMessage=list.length+' insumos encontrados; custos de referência SIURB.';}
 else {const old=db.siurbLabor.filter(x=>x.kind!==kind);db.siurbLabor=old.concat(list);if(!save())throw new Error('Falha ao armazenar referências de mão de obra');}
}
async function parseAuxBuffer(buffer,kind){
 await siurbXLSX();
 return parseAuxSheet(buffer,kind);
}
async function importLaborFile(file){
 if(!file)return;const kind=/horist/i.test(file.name)?'horista':'mensalista';
 try{const list=await parseAuxBuffer(await file.arrayBuffer(),kind);importExplain(kind,list);s.modal=null;render();toast(list.length+' registros da SIURB ('+kind+') carregados.');}
 catch(e){toast('Falha na tabela de mão de obra: '+e.message)}
}
async function importSIURBType(kind){
 if(importBusy)return;importBusy=true;
 const regime=db.siurbMeta?.regime||'onerada';
 try{
  const response=await fetch('/api/siurb?tipo='+encodeURIComponent(kind)+'&regime='+encodeURIComponent(regime),{cache:'no-store'});
  if(!response.ok){const err=await response.json().catch(()=>({}));throw new Error(err.erro||'Arquivo oficial indisponível ('+response.status+')')}
  const list=await parseAuxBuffer(await response.arrayBuffer(),kind);
  importExplain(kind,list);render();toast(list.length+' '+(kind==='insumos'?'insumos':'profissionais')+' de referência SIURB importados.');
 }catch(e){importMessage='Importação oficial indisponível: '+e.message+'. Use o Excel manual.';render();toast(importMessage)}
 finally{importBusy=false}
}
function fillWorkerRef(form){
 const id=form.elements.siurbWorkerRef?.value||'';
 const ref=db.siurbLabor.find(x=>x.id===id);
 if(!ref)return;
 const role=form.elements.role;
 if(role&&!role.value)role.value=ref.name;
 const link=form.elements.link;
 if(link?.value==='Referência SIURB'){
   if(form.elements.cost)form.elements.cost.value=number(ref.cost);
   if(form.elements.unit)form.elements.unit.value=ref.unit;
 }
 const count=document.getElementById('dw-labor-count');
 if(count)count.textContent='Referência '+ref.name+': '+(ref.costWithoutCharges!=null?'sem encargos '+BRL(ref.costWithoutCharges)+' / '+ref.unit+'; com encargos '+BRL(ref.costWithCharges)+' / '+ref.unit:'custo não classificado '+BRL(ref.cost)+' / '+ref.unit)+'. Não é salário-base CLT mensal: confira a carga horária e o piso legal.';
}
const baseOnAction=onAction;
onAction=function(action,el){
 if(action==='dw-import-material'){importSIURBType('insumos');return true}
 if(action==='dw-fetch-mensalista'){importSIURBType('mensalista');return true}
 if(action==='dw-fetch-horista'){importSIURBType('horista');return true}
 if(action==='dw-open-labor-ref'){s.edit=null;s.modal='addworker';render();return true}
 if(action==='dw-pick-material'){
  const m=insumoCatalog.find(x=>x.id===el.dataset.id);if(!m)return true;
  if(s.modal==='additem'){
    const form=document.getElementById('modal-form');
    if(form){chosenMaterialRef=m;form.elements.material.value=pretty(number(m.cost)*(number(form.elements.materialQty?.value)||1));if(!form.elements.service.value)form.elements.service.value=m.name;if(!selected&&!s.edit?.unit)form.elements.unit.value=m.unit;updateLineTotal(form);}
    const hits=document.getElementById('dw-material-hits');if(hits)hits.hidden=true;
    const search=document.getElementById('dw-material-search');if(search)search.value=m.name;
  }else{
    if(!db.materials.some(x=>x.origin==='SIURB'&&x.sourceCode===m.code&&x.name===m.name)){
      db.materials.push({id:uid('m'),name:m.name,unit:m.unit,cost:m.cost,origin:'SIURB',sourceCode:m.code,sourceDate:m.sourceDate});save();
    }render();toast('Insumo SIURB incluído em Materiais.');
  }
  return true;
 }
 return baseOnAction(action,el);
};
document.addEventListener('change',e=>{
 if(e.target.id==='dw-insumo-file'){
  const file=e.target.files?.[0];if(!file)return;
  file.arrayBuffer().then(b=>parseAuxBuffer(b,'insumos')).then(list=>{importExplain('insumos',list);render();toast(list.length+' insumos carregados.');}).catch(err=>toast('Erro no Excel: '+err.message));
 }
 if(s.modal==='addworker'&&e.target.name==='siurbWorkerRef')fillWorkerRef(document.getElementById('modal-form'));
 if(s.modal==='additem'&&e.target.name==='owner'&&s.wizard?.type==='Mão de obra'){e.target.value='cliente';const f=document.getElementById('modal-form');if(f)updateLineTotal(f);}
},true);
document.addEventListener('input',e=>{
 if(e.target.id==='dw-material-search'||e.target.id==='dw-insumo-search'){
  const hits=document.getElementById(e.target.id==='dw-material-search'?'dw-material-hits':'dw-insumo-hits');
  if(e.target.id==='dw-insumo-search')insumoSearch=e.target.value;
  if(hits){hits.hidden=false;hits.innerHTML=insumoHits(e.target.value);}
 }
},true);
restoreInsumos();

})();
