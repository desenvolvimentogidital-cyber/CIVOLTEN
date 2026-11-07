/* CIVOLTEN — Interface nova: início, custos da empresa e funcionários.
 * Mantém o armazenamento legado intocado para permitir recuperação futura.
 */
(function(){
'use strict';
const engine=window.CIVOLTENCore;
if(!engine)throw new Error('Motor de custos CIVOLTEN indisponível');
const store=engine.createStore(localStorage);
let data=store.load(),page='home',companyTab='fixed',editing=null,notice='';
const moneyCents=v=>v==null?'Pendente':(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const money=v=>v==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const plain=v=>v==null?'':String(v);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateBR=s=>s?new Date(s).toLocaleDateString('pt-BR'):'';
const pct=v=>v==null?'':plain(v);
const el=document.getElementById('app');
const icons={
 home:'⌂',config:'⚙',employees:'♙',plus:'+',back:'‹',close:'×'
};
const status=p=>p?'':'';
function restore(){
 try{data=store.load();return true}
 catch{flash('Não foi possível ler os dados atuais.');return false}
}
function persist(next){
 try{
  const saved=store.commit(next);data=saved;
  window.dispatchEvent(new CustomEvent('civolten:core-saved',{detail:{key:store.key}}));
  return true;
 }catch(e){flash('Falha ao salvar neste aparelho: '+(e?.message||'armazenamento cheio')+'. Seus dados anteriores foram mantidos.');return false}
}
function flash(message){
 notice=message;const node=document.querySelector('#cv-message');
 if(node){node.textContent=message;node.hidden=false}
}
function button(label,action,variant='secondary',extra=''){
 return '<button type="button" class="cv-btn cv-'+variant+'" data-action="'+action+'" '+extra+'>'+label+'</button>';
}
function head(title,subtitle){
 return '<header class="cv-section-head"><div><p class="cv-eyebrow">CIVOLTEN • Base nova</p><h1>'+title+'</h1><p class="cv-subtitle">'+subtitle+'</p></div></header>';
}
function field(label,name,value='',options={}){
 const type=options.type||'text';
 const required=options.required?'required':'';
 const info=options.info?'<small>'+escape(options.info)+'</small>':'';
 const min=type==='number'?' min="0" step="any" inputmode="decimal"':'';
 return '<label class="cv-field"><span>'+escape(label)+'</span><input name="'+name+'" type="'+type+'" value="'+escape(value)+'" '+min+' '+required+' placeholder="'+escape(options.placeholder||'')+'">'+info+'</label>';
}
function select(label,name,value,opts){
 return '<label class="cv-field"><span>'+escape(label)+'</span><select name="'+name+'">'+opts.map(([v,n])=>'<option value="'+escape(v)+'" '+(String(v)===String(value)?'selected':'')+'>'+escape(n)+'</option>').join('')+'</select></label>';
}
const countText=(n,singular,plural)=>n+' '+(n===1?singular:plural);
function home(){
 const o=engine.overview(data);
 return head('Painel principal','Sua empresa, seus custos e sua equipe. Vamos reconstruir por etapas.')+
 '<section class="cv-welcome"><img src="/icons/civolten-simbolo.png" alt="" aria-hidden="true"><div><strong>Estrutura inicial pronta</strong>'+
 '<p>Por enquanto, apenas os custos da empresa e dos funcionários. Os outros módulos serão criados depois, um por vez.</p></div></section>'+
 '<div class="cv-stats">'+
 metric('Custos fixos / mês',moneyCents(o.fixedMonthly),countText(o.counts.fixed,'lançamento','lançamentos'))+
 metric('Custos variáveis previstos',moneyCents(o.variableMonthly),countText(o.counts.variable,'lançamento','lançamentos'))+
 metric('Equipe / mês',moneyCents(o.employeeMonthly),countText(o.counts.employees,'funcionário','funcionários'))+
 '</div>'+
 '<section class="cv-panel"><div class="cv-panel-head"><h2>Previsão mensal consolidada</h2><span>Estimativa</span></div>'+
 '<p class="cv-big-value">'+moneyCents(o.forecastMonthly)+'</p>'+
 '<p class="cv-muted">Soma dos custos fixos, variáveis com quantidade mensal informada e custos da equipe com previsão mensal. Valores não cadastrados ficam fora da soma.</p>'+
 (o.completeness?'<div class="cv-good">Cadastros com dados suficientes para estimar este total.</div>':
  '<div class="cv-warning">Atenção: ainda existem '+(o.fixedMissing+o.variableMissing+o.employeeMissing)+
  ' item(ns) com custo ou previsão pendente. Este total não representa necessariamente todo o gasto da empresa.</div>')+
 '<div class="cv-grid-two">'+button('Configurar custos','config','gold')+button('Cadastrar equipe','employees','secondary')+'</div></section>'+
 '<section class="cv-panel"><h2>Como será daqui para frente</h2>'+
 '<p class="cv-muted">Primeiro estruturamos os custos reais e a equipe. Depois construiremos orçamento, produtividade, cronograma e execução sobre essas informações, sem depender das telas antigas.</p>'+
 '</section>';
}
function metric(label,value,subtitle){
 return '<article class="cv-metric"><span>'+label+'</span><strong>'+value+'</strong><small>'+subtitle+'</small></article>';
}
function company(){
 const o=engine.overview(data);
 const fixed=companyTab==='fixed';
 let list=fixed?data.fixed:data.variable;
 return head('Custos da empresa','Cadastre seus gastos uma vez e mantenha os valores organizados.')+
 '<section class="cv-panel"><div class="cv-panel-head"><h2>Capacidade produtiva mensal</h2></div>'+
 '<p class="cv-muted">Opcional: horas produtivas totais da empresa no mês. Serve para calcular o rateio dos custos fixos por hora.</p>'+
 '<form id="cv-capacity-form" class="cv-inline-form">'+field('Horas produtivas da empresa / mês','productiveHoursMonth',data.settings.productiveHoursMonth??'',{type:'number',placeholder:'Ex.: 300'})+
 '<button type="submit" class="cv-btn cv-gold">Salvar capacidade</button></form>'+
 '<div class="cv-line"><span>Custo fixo médio por hora</span><strong>'+moneyCents(o.fixedHour)+'</strong></div>'+
 '</section>'+
 '<div class="cv-tabs" role="tablist" aria-label="Tipo de custo">'+
 '<button role="tab" aria-selected="'+fixed+'" class="'+(fixed?'active':'')+'" data-tab="fixed">Fixos</button>'+
 '<button role="tab" aria-selected="'+!fixed+'" class="'+(!fixed?'active':'')+'" data-tab="variable">Variáveis</button></div>'+
 '<section class="cv-panel"><div class="cv-panel-head"><div><h2>'+(fixed?'Custos fixos':'Custos variáveis')+'</h2>'+
 '<p class="cv-muted">'+(fixed?'Aluguel, internet, contador, sistemas, telefone e outros gastos recorrentes.':
 'Combustível, alimentação, deslocamento, material de consumo e outros gastos conforme utilização.')+'</p></div>'+
 button('+ Adicionar','add-'+(fixed?'fixed':'variable'),'gold')+'</div>'+
 (list.length?list.map(item=>costRow(item,fixed?'fixed':'variable')).join(''):'<div class="cv-empty">Nenhum custo cadastrado ainda.</div>')+
 '<div class="cv-total-line"><span>'+(fixed?'Total fixo mensal':'Total variável previsto no mês')+'</span><strong>'+
 moneyCents(fixed?o.fixedMonthly:o.variableMonthly)+'</strong></div>'+
 (!fixed&&o.variableMissing?'<p class="cv-warning">'+o.variableMissing+' custo(s) variável(is) sem quantidade mensal estimada. O valor unitário continua salvo; não foi incluído no total previsto.</p>':'')+
 '</section>';
}
function costRow(item,kind){
 const isFixed=kind==='fixed',result=isFixed?engine.fixedCost(item):engine.variableCost(item);
 const val=isFixed?result.monthly:result.monthly;
 const description=isFixed?(item.frequency==='year'?'Cobrado por ano':'Cobrado por mês')+
  (item.category?' • '+item.category:''):'R$ '+money(item.rate).replace('R$\u00a0','')+'/'+
  ({service:'serviço',day:'dia',km:'km',hour:'hora',unit:'unidade'}[item.unit]||'unidade')+
  (item.monthlyQty==null?' • quantidade mensal não informada':' • '+item.monthlyQty+' por mês');
 return '<article class="cv-entry"><div class="cv-entry-main"><strong>'+escape(item.name)+'</strong><small>'+escape(description)+'</small></div>'+
 '<div class="cv-entry-side"><b>'+moneyCents(val)+'</b><div class="cv-actions">'+
 button('Editar','edit-'+kind,'plain','data-id="'+escape(item.id)+'"')+
 button('Excluir','delete-'+kind,'danger','data-id="'+escape(item.id)+'"')+
 '</div></div></article>';
}
function employees(){
 const o=engine.overview(data);
 return head('Funcionários','Custo de cada funcionário calculado a partir dos dados cadastrados.')+
 '<section class="cv-stats">'+metric('Equipe prevista / mês',moneyCents(o.employeeMonthly),countText(o.counts.employees,'profissional','profissionais'))+
 metric('Pendências',String(o.employeeMissing),'dados salariais, encargos ou horas a informar')+'</section>'+
 '<section class="cv-panel"><div class="cv-panel-head"><h2>Funcionários e prestadores</h2>'+button('+ Adicionar','add-employees','gold')+'</div>'+
 (data.employees.length?data.employees.map(employeeRow).join(''):'<div class="cv-empty">Nenhum funcionário cadastrado ainda.</div>')+
 '<p class="cv-muted">CLT: cálculo mensal com provisão de 13º, adicional de férias, FGTS e encargos patronais informados. Terceirizados: valor do contrato e quantidade prevista. A folha e as alíquotas devem ser conferidas conforme o regime da empresa.</p>'+
 '</section>';
}
function employeeRow(item){
 const v=engine.employeeCost(item);
 return '<article class="cv-entry"><div class="cv-entry-main"><strong>'+escape(item.name)+'</strong><small>'+
 escape(item.role||'Função não informada')+' • '+(item.type==='contractor'?'Prestador / terceirizado':'CLT')+
 (v.status!=='ready'?'<span class="cv-pending"> • Estimativa parcial</span>':'')+'</small>'+
 '<small>Custo por hora: '+moneyCents(v.hourly)+' · Custo mensal: '+moneyCents(v.monthly)+'</small></div>'+
 '<div class="cv-entry-side">'+button('Detalhes','details-employees','plain','data-id="'+escape(item.id)+'"')+
 '<div class="cv-actions">'+button('Editar','edit-employees','plain','data-id="'+escape(item.id)+'"')+
 button('Excluir','delete-employees','danger','data-id="'+escape(item.id)+'"')+'</div></div></article>';
}
function employeeDetails(item){
 const x=engine.employeeCost(item),p=x.parts||{};
 const name=escape(item.name);
 return '<div class="cv-dialog-heading"><h2>'+name+'</h2>'+button('×','close-dialog','plain')+'</div>'+
 '<p class="cv-muted">'+escape(item.role||'Funcionário')+'</p>'+
 '<div class="cv-line"><span>Vínculo</span><b>'+(x.type==='clt'?'CLT':'Prestador / terceirizado')+'</b></div>'+
 (x.type==='clt'?[
 ['Salário mensal',p.salary],['Provisão de 13º',p.thirteenth],
 ['1/3 de férias (provisão)',p.vacationThird],['FGTS estimado',p.fgts],
 ['Encargos patronais',p.employer],['Benefícios',p.benefits],['Outros gastos mensais',p.extra]
 ].map(([label,amount])=>'<div class="cv-line"><span>'+label+'</span><b>'+moneyCents(amount)+'</b></div>').join(''):
 '<div class="cv-line"><span>Valor contratado</span><b>'+moneyCents(x.rate)+'</b></div>')+
 '<div class="cv-total-line"><span>Custo mensal estimado</span><strong>'+moneyCents(x.monthly)+'</strong></div>'+
 '<div class="cv-total-line"><span>Custo por hora</span><strong>'+moneyCents(x.hourly)+'</strong></div>'+
 (x.status!=='ready'?'<p class="cv-warning">Cálculo parcial: '+escape(x.missing?.join(', ')||'informações de horas ou quantidade contratada pendentes')+'.</p>':'')+
 '<p class="cv-muted">Estimativa gerencial. Não substitui folha, convenção coletiva, encargos legais ou avaliação contábil.</p>';
}
function modalFields(kind,obj={}){
 if(kind==='fixed')return field('Descrição do custo','name',obj.name||'',{required:true,placeholder:'Ex.: Aluguel'})+
  field('Valor (R$)','amount',obj.amount??'',{type:'number',required:true})+
  select('Periodicidade','frequency',obj.frequency||'month',[['month','Mensal'],['year','Anual']])+
  field('Categoria (opcional)','category',obj.category||'',{placeholder:'Ex.: Estrutura'});
 if(kind==='variable')return field('Descrição do custo','name',obj.name||'',{required:true,placeholder:'Ex.: Combustível'})+
  field('Valor por unidade (R$)','rate',obj.rate??'',{type:'number',required:true})+
  select('Unidade do custo','unit',obj.unit||'unit',[['unit','Unidade'],['service','Serviço'],['day','Dia'],['km','Quilômetro'],['hour','Hora']])+
  field('Quantidade prevista por mês (opcional)','monthlyQty',obj.monthlyQty??'',{type:'number',
   info:'Em branco: guardar somente o valor unitário, sem estimar um total mensal.'});
 const type=obj.type||'clt';
 return field('Nome do funcionário','name',obj.name||'',{required:true,placeholder:'Nome completo'})+
 field('Função','role',obj.role||'',{placeholder:'Ex.: Pedreiro'})+
 select('Vínculo','type',type,[['clt','Funcionário CLT'],['contractor','Prestador / terceirizado']])+
 '<div data-employee-fields="clt" '+(type!=='clt'?'hidden':'')+'>'+
 field('Salário-base mensal (R$)','salary',obj.salary??'',{type:'number'})+
 field('Horas produtivas no mês','productiveHours',obj.productiveHours??'',{type:'number',info:'Usadas para calcular o custo por hora.'})+
 field('FGTS (%)','fgtsPct',pct(obj.fgtsPct),{type:'number',info:'Informe a alíquota aplicável ao vínculo. Não é preenchida automaticamente.'})+
 field('Encargos patronais (%)','employerPct',pct(obj.employerPct),{type:'number',info:'Conforme regime tributário e obrigações da empresa.'})+
 field('Benefícios mensais (R$)','benefits',obj.benefits??'',{type:'number'})+
 field('Outros custos mensais (R$)','extras',obj.extras??'',{type:'number'})+'</div>'+
 '<div data-employee-fields="contractor" '+(type!=='contractor'?'hidden':'')+'>'+
 field('Valor do contrato (R$)','rate',obj.rate??'',{type:'number'})+
 select('Cobrado por','rateUnit',obj.rateUnit||'hour',[['hour','Hora'],['day','Dia'],['month','Mês']])+
 field('Quantidade contratada no mês (se por hora ou dia)','monthlyQty',obj.monthlyQty??'',{type:'number'})+
 field('Horas por dia trabalhado (se diária)','hoursDay',obj.hoursDay??'',{type:'number'})+
 field('Horas produtivas no mês (se mensal)','hoursMonth',obj.hoursMonth??'',{type:'number'})+'</div>'+
 '<p class="cv-muted">Você pode salvar sem preencher todos os encargos ou horas. Nesse caso o custo ficará identificado como parcial, sem inventar percentuais.</p>';
}
function openModal(kind,id){
 editing={kind,id:id||null};
 const list=data[kind]||[];
 const found=id?list.find(x=>x.id===id):null;
 const dialog=document.getElementById('cv-dialog');
 const titles={fixed:'Custo fixo',variable:'Custo variável',employees:'Funcionário'};
 dialog.innerHTML='<div class="cv-dialog-heading"><h2>'+(id?'Editar ':'Adicionar ')+titles[kind]+'</h2>'+
 button('×','close-dialog','plain')+'</div>'+
 '<form id="cv-record-form" novalidate><div class="cv-form-fields">'+modalFields(kind,found||{})+'</div>'+
 '<p id="cv-form-error" class="cv-error" hidden role="alert"></p>'+
 '<div class="cv-form-actions"><button type="submit" class="cv-btn cv-gold">Salvar</button>'+
 button('Cancelar','close-dialog','secondary')+'</div></form>';
 dialog.showModal();
}
function showDetails(id){
 const item=data.employees.find(x=>x.id===id);if(!item)return;
 const dialog=document.getElementById('cv-dialog');
 dialog.innerHTML=employeeDetails(item);dialog.showModal();
}
function view(){
 const body=page==='config'?company():page==='employees'?employees():home();
 el.innerHTML='<div class="cv-shell"><div class="cv-brand"><img src="/assets/civolten-logo.png" alt="CIVOLTEN">'+
 button('Minha conta','account','outline')+'</div><main class="cv-content" id="cv-main">'+body+'</main>'+
 '<nav class="cv-nav" aria-label="Navegação principal">'+
 [['home','Início','⌂'],['config','Configurações','⚙'],['employees','Funcionários','♙']].map(([id,label,icon])=>
 '<button type="button" class="'+(id===page?'active':'')+'" data-page="'+id+'" aria-current="'+(id===page?'page':'false')+'"><span aria-hidden="true">'+icon+'</span>'+label+'</button>').join('')+
 '</nav><div id="cv-message" class="cv-message" role="status" '+(!notice?'hidden':'')+'>'+escape(notice)+'</div></div>';
}
function record(kind,input){
 const id=editing?.id||'cv_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
 const row=engine.itemInput(kind,input,id);
 const next=structuredClone(data),list=next[kind];
 if(!list)throw Error('Cadastro não encontrado.');
 const i=list.findIndex(x=>x.id===id);
 if(i>=0)list[i]=row;else list.push(row);
 if(!persist(next))return false;
 return true;
}
function submit(event){
 event.preventDefault();
 if(event.target.id==='cv-capacity-form'){
  const input=new FormData(event.target).get('productiveHoursMonth');
  const n=engine.decimal(input);
  if(n!==null&&n<=0){flash('Informe uma quantidade de horas maior que zero ou deixe em branco.');return;}
  const next=structuredClone(data);next.settings.productiveHoursMonth=n;
  if(persist(next)){notice='Capacidade produtiva salva.';view()}
  return;
 }
 if(event.target.id!=='cv-record-form'||!editing)return;
 const form=event.target,values=Object.fromEntries(new FormData(form));
 try{
  if(record(editing.kind,values)){
   document.getElementById('cv-dialog').close();
   notice='Cadastro salvo com sucesso.';editing=null;view();
  }
 }catch(err){
  const node=form.querySelector('#cv-form-error');
  if(node){node.textContent=err.message||'Confira os campos.';node.hidden=false}
 }
}
function action(event){
 const pageBtn=event.target.closest('[data-page]');
 if(pageBtn){page=pageBtn.dataset.page;editing=null;notice='';view();return;}
 const tab=event.target.closest('[data-tab]');
 if(tab){companyTab=tab.dataset.tab;view();return;}
 const a=event.target.closest('[data-action]');if(!a)return;
 const name=a.dataset.action,id=a.dataset.id;
 if(name==='account'){window.dispatchEvent(new Event('civolten:open-account'));return;}
 if(name==='close-dialog'){document.getElementById('cv-dialog').close();editing=null;return;}
 if(name.startsWith('add-')){openModal(name.slice(4));return;}
 if(name.startsWith('edit-')){openModal(name.slice(5),id);return;}
 if(name==='details-employees'){showDetails(id);return;}
 if(name.startsWith('delete-')){
  const kind=name.slice(7),existing=data[kind]?.find(x=>x.id===id);if(!existing)return;
  if(!confirm('Excluir "'+existing.name+'"? O cadastro será removido somente da nova base de custos.'))return;
  const next=structuredClone(data);next[kind]=next[kind].filter(x=>x.id!==id);
  if(persist(next)){notice='Cadastro excluído.';view()}
  return;
 }
 if(name==='config'){page='config';companyTab='fixed';view();return;}
 if(name==='employees'){page='employees';view();return;}
}
function update(event){
 if(event.target.name==='type'&&event.target.closest('#cv-record-form')){
  const form=event.target.form;
  for(const fieldset of form.querySelectorAll('[data-employee-fields]')){
   fieldset.hidden=fieldset.dataset.employeeFields!==event.target.value;
  }
 }
}
el.addEventListener('click',action);
el.addEventListener('submit',submit);
document.getElementById('cv-dialog').addEventListener('click',action);
document.getElementById('cv-dialog').addEventListener('submit',submit);
document.getElementById('cv-dialog').addEventListener('change',update);
window.addEventListener('storage',event=>{if(event.key===store.key){restore();view();}});
view();
window.CIVOLTENNewApp={get state(){return structuredClone(data)},get page(){return page},go(p){page=p;view()},get summary(){return engine.overview(data)}};
})();
