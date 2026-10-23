import {calculateBudget} from '/lib/civolten-calc.mjs';
import {companyRates,payrollSummary} from '/lib/civolten-capacity.mjs';
import {startVoiceFields} from '/assets/voice.js';
import {createBudgetStaff,staffAlreadyAdded} from '/lib/civolten-team.mjs';
import {financialDashboard,projectResults} from '/assets/dashboard.js';
import {buildProposalHtml,normalizeScopeItems} from '/lib/civolten-proposal.mjs';
import {contractDefaults,defaultContractCompany,contractFromBudget,buildContractHtml} from '/lib/civolten-contract.mjs';
import {contractList,contractEditor,contractProfilePanel} from '/assets/contracts.js';
import {validBrazilDocument} from '/lib/civolten-contract.mjs';
import {budgetIssues,contractIssues,taxMarginIssues} from '/lib/civolten-validation.mjs';
import {attachFormValidation,validateArea,revalidateField} from '/assets/field-validation.js';

const $=q=>document.querySelector(q);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=x=>(Number(x||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const money=x=>Math.round(Math.max(0,Number(String(x??0).replace(',','.'))||0)*100);
const dec=x=>String(Number(x||0)/100);
const num=x=>Number(String(x??0).replace(',','.'))||0;
const total=xs=>xs.reduce((n,x)=>n+Number(x||0),0);
const state={view:'home',data:{settings:[],workers:[],professions:[],fixed:[],variable:[],budgets:[],cash:[],contracts:[],contract_profiles:[]},accountEmail:'',edit:null,draft:null,draftId:null,contractDraft:null,contractId:null,dashboardSearch:'',dashboardStatus:'todos'};
const sections={home:'Visão geral',budgets:'Orçamentos',contracts:'Contratos',workers:'Funcionários',fixed:'Custos fixos',variable:'Custos variáveis',settings:'Configurações'};
const fields={
 workers:[['name','Nome completo','text'],['profession','Profissão / função','text'],['daily_cents','Valor da diária (R$)','money'],['charges_pct','Encargos adicionais (%) — opcional','number'],['days_month','Dias trabalhados previstos no mês','number'],['cost_mode','Forma de custo','select'],['active','Profissional ativo','checkbox']],
 fixed:[['name','Despesa fixa','text'],['category','Categoria','text'],['monthly_cents','Valor mensal (R$)','money'],['active','Despesa ativa','checkbox']],
 variable:[['name','Nome do gasto','text'],['category','Categoria','text'],['unit','Unidade (un, m², diária...)','text'],['unit_cents','Custo por unidade (R$)','money']]
};
async function request(path,method='GET',record){
 const res=await fetch(path,{method,credentials:'same-origin',headers:record?{'Content-Type':'application/json'}:{},body:record?JSON.stringify(record):undefined,cache:'no-store'});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error||'Falha no servidor');
 return data;
}
const route=(entity,id)=>'/api/data?entity='+entity+(id?'&id='+encodeURIComponent(id):'');
let timer;
let lastValidationMode='';
function budgetValidation(forPdf=false){
 lastValidationMode=forPdf?'budget-pdf':'budget-save';
 return validateArea(document.querySelector('.budget-simple-editor'),{issues:budgetIssues(state.draft,{forPdf}),checkRequired:false});
}
function contractValidation(forExport=false){
 lastValidationMode=forExport?'contract-pdf':'contract-save';
 return validateArea(document.querySelector('.contract-editor'),{issues:contractIssues(state.contractDraft,{forExport}),checkRequired:false});
}
function flash(message){const el=$('#flash');el.textContent=message;el.hidden=false;clearTimeout(timer);timer=setTimeout(()=>el.hidden=true,4500)}
async function loadBrand(){
 // A logo oficial enviada pelo administrador e local e nao pode ser substituida
 // pela identidade antiga retornada pelo servico legado.
 document.querySelectorAll('.brand-logo').forEach(img=>{
  img.src='/assets/civolten-logo.png';
  img.hidden=false;
 });
 try{
  const r=await request('/api/site-branding');const b=r.branding||{};
  if(/^#[a-f0-9]{6}$/i.test(b.color_primary||''))document.documentElement.style.setProperty('--navy',b.color_primary);
  if(/^#[a-f0-9]{6}$/i.test(b.color_accent||''))document.documentElement.style.setProperty('--gold',b.color_accent);
 }catch{/* Paleta visual padrao permanece disponivel. */}
}
async function reload(){
 // Uma unica resposta autenticada substitui cinco requisicoes e cinco verificacoes.
 const data=(await request('/api/bootstrap')).data;
 const names=Object.keys(state.data);
 if(!data||names.some(n=>!Array.isArray(data[n])))throw Error('Dados do painel incompletos. Atualize e tente novamente.');
 names.forEach(n=>state.data[n]=data[n]);
}
async function showApp(){
 // A sessao ja foi validada no servidor. Exibe feedback imediato durante o
 // carregamento dos dados reais, sem exibir valores vazios ou liberar a navegacao.
 const auth=$('#auth'),app=$('#app');
 auth.hidden=true;app.hidden=false;app.inert=true;
 $('#content').innerHTML='<section class="card" role="status" aria-live="polite"><h2>Abrindo seu painel...</h2><p>Carregando os dados da CIVOLTEN com segurança.</p></section>';
 try{
  await reload();
  render();
 }catch(error){
  app.hidden=true;auth.hidden=false;
  throw error;
 }finally{app.inert=false}
}
function authMode(mode){
 $('#loginCard').hidden=false;
 $('#login').hidden=mode!=='login';
 for(const [name,id] of [['signup','signupForm'],['recover','recoverForm'],['password','passwordForm']])$('#'+id).hidden=mode!==name;
 document.querySelector('.auth-links').hidden=mode!=='login';
 $('#authNotice').textContent='';
}
let recoveryToken=null;
function title(name,subtitle,button){
 return '<div class="heading"><div><span class="eyebrow">CIVOLTEN / PAINEL PRIVADO</span><h1>'+esc(name)+'</h1><p>'+esc(subtitle)+'</p></div>'+(button||'')+'</div>';
}
function empty(message){return '<div class="empty">'+esc(message)+'</div>'}
function notice(){return '<div class="warning">Nenhum preço de referência externa é usado. Os valores são definidos por você e não garantem resultado sem a revisão dos custos reais da obra.</div>'}
function dashboard(){
 return financialDashboard({data:state.data,search:state.dashboardSearch,status:state.dashboardStatus,
 esc,brl,title,companyRates,notice});
}

function refreshDashboardProjects(){
 const el=$('#dashboardProjectResults');
 if(el&&state.view==='home')el.innerHTML=projectResults(state.data,state.dashboardSearch,state.dashboardStatus,esc,brl);
}
async function saveDashboardMargin(form){
 const margin=Number(form.elements.namedItem('margin_pct').value);
 const tax=Number(form.elements.namedItem('tax_pct').value);
 if(!Number.isFinite(margin)||!Number.isFinite(tax)||margin<0||margin>99||tax<0||tax>99||margin+tax>=100)
  throw Error('Impostos e margem devem ser positivos, até 99%, e somar menos de 100%.');
 const current=state.data.settings[0];
 const record=current?{tax_pct:tax,margin_pct:margin}:{workdays_month:22,billable_days_month:22,
  hours_day:8,tax_pct:tax,margin_pct:margin};
 await request(route('settings',current?.id),current?'PATCH':'POST',{record});
 await reload();render();flash('Margem e impostos atualizados para os próximos orçamentos.');
}
async function saveCashMovement(form){
 const raw=String(form.elements.namedItem('amount').value).trim().replace(',','.');
 const value=Number(raw);
 if(!Number.isFinite(value)||value<=0||value>1e9||Math.round(value*100)<=0)
  throw Error('Informe o valor recebido ou pago corretamente.');
 const record={
  kind:form.elements.namedItem('kind').value,
  amount_cents:Math.round(value*100),
  occurred_on:form.elements.namedItem('occurred_on').value,
  category:form.elements.namedItem('category').value,
  description:form.elements.namedItem('description').value.trim(),
  budget_id:form.elements.namedItem('budget_id').value||null
 };
 await request(route('cash'),'POST',{record});
 await reload();render();flash('Movimentação registrada no caixa.');
}

// Catalogo persistido no Supabase; a lista tambem inclui funcoes de funcionarios
// ja cadastrados, mesmo que tenham sido criados antes do catalogo.
const normalizeProfession=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
function professionNames(){
 const names=new Map();
 for(const row of [...state.data.professions,...state.data.workers]){
  const name=(row.profession||row.name||'').trim();
  if(name&&!names.has(normalizeProfession(name)))names.set(normalizeProfession(name),name);
 }
 return [...names.values()].sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
function showProfessionOptions(input){
 const list=$('#professionSuggestions');if(!list)return;
 const query=normalizeProfession(input.value.trim());
 const items=professionNames().filter(name=>normalizeProfession(name).includes(query));
 list.innerHTML=items.length?items.map(name=>
  '<button type="button" role="option" class="profession-option" data-profession-option="'+esc(name)+'">'+esc(name)+'</button>'
 ).join(''):'<p class="hint profession-empty">Nenhuma profissão encontrada. Você pode digitar uma nova para salvá-la.</p>';
 list.hidden=false;input.setAttribute('aria-expanded','true');
}
function closeProfessionOptions(){
 const list=$('#professionSuggestions');if(list)list.hidden=true;
 const input=$('#workerProfession');if(input)input.setAttribute('aria-expanded','false');
}
function updateWorkerChoices(){
 const input=$('#workerSearch'),select=$('#workerSelect');if(!input||!select)return;
 const selected=select.value,filter=normalizeProfession(input.value.trim());
 const workers=state.data.workers.filter(x=>x.active)
  .filter(x=>normalizeProfession(x.name+' '+x.profession).includes(filter))
  .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 select.innerHTML='<option value="">'+(workers.length?'Escolha um profissional':'Nenhum profissional encontrado')+'</option>'+
  workerOptions(workers);
 if(workers.some(x=>x.id===selected))select.value=selected;
}
function workerOptions(workers){
 const modes=[['monthly','Equipe fixa mensal'],['project','Profissionais por obra']];
 return modes.map(([mode,label])=>{
  const group=workers.filter(x=>(x.cost_mode??'monthly')===mode);
  return group.length?'<optgroup label="'+label+'">'+group.map(x=>
   '<option value="'+esc(x.id)+'">'+esc(x.name)+' — '+esc(x.profession)+(mode==='monthly'?' · já incluído no custo fixo':' · '+brl(x.daily_cents)+'/dia')+'</option>'
  ).join('')+'</optgroup>':'';
 }).join('');
}

function inputField(f,v){
 const [k,label,type]=f,raw=v?.[k];
 if(type==='checkbox')return '<label><span>'+esc(label)+'</span><input type="checkbox" name="'+k+'" '+(v==null||raw?'checked':'')+' style="width:22px;height:22px"></label>';
 if(k==='cost_mode')return '<label>'+esc(label)+'<select name="cost_mode">'+
  '<option value="monthly" '+((raw??'monthly')==='monthly'?'selected':'')+'>Fixo mensal — entra automaticamente nos orçamentos</option>'+
  '<option value="project" '+(raw==='project'?'selected':'')+'>Por obra — adicionar só quando necessário</option>'+
  '</select></label>';
 if(k==='profession')return '<div class="profession-picker"><label for="workerProfession">'+esc(label)+'</label>'+
  '<input id="workerProfession" name="profession" type="text" value="'+esc(raw??'')+'" maxlength="100" required autocomplete="off" placeholder="Toque para ver a lista ou digite para buscar" aria-autocomplete="list" aria-expanded="false" aria-controls="professionSuggestions">'+
  '<div id="professionSuggestions" class="profession-suggestions" role="listbox" aria-label="Profissões disponíveis" hidden></div>'+
  '<small class="hint">Selecione uma função da lista ou digite outra para salvar no catálogo.</small></div>';
 const val=type==='money'?dec(raw):k==='charges_pct'?(raw==null||Number(raw)===0?'':raw):raw??'';
 const attrs=k==='charges_pct'?'min="0" max="200" step="0.01"':type==='money'||type==='number'?'min="0" step="0.01"':'maxlength="120"';
 return '<label>'+esc(label)+'<input name="'+k+'" type="'+(type==='money'?'number':type)+'" '+attrs+' value="'+esc(val)+'" '+(k==='charges_pct'?'':'required')+'></label>';
}
function entryLabel(entity,r){
 if(entity==='workers')return esc(r.profession)+' · '+brl(r.daily_cents)+'/dia · '+num(r.days_month??22)+' dias/mês · Encargos '+num(r.charges_pct)+'% · Projeção mensal '+brl(Math.round(r.daily_cents*num(r.days_month??22)*(1+num(r.charges_pct)/100)))+' · '+((r.cost_mode??'monthly')==='monthly'?'Folha fixa':'Somente por obra')+(!r.active?' · Inativo':'');
 if(entity==='fixed')return esc(r.category)+' · '+brl(r.monthly_cents)+'/mês'+(!r.active?' · Inativo':'');
 return esc(r.category)+' · '+brl(r.unit_cents)+' / '+esc(r.unit);
}
function generic(entity){
 const label=sections[entity],items=state.data[entity],editing=items.find(x=>x.id===state.edit);
 const rates=entity==='fixed'?companyRates(items,state.data.settings[0]||{},state.data.workers):null;
 const payroll=entity==='workers'?payrollSummary(items):null;
 const workerFooter=payroll?'<div class="worker-totalbar" role="status" aria-live="polite">'+
  '<div><small>Folha fixa mensal · '+payroll.monthly_count+' funcionário(s)</small><strong>'+brl(payroll.monthly_cents)+'</strong></div>'+
  '<div class="worker-totalmeta">'+payroll.project_count+' por obra · encargos incluídos</div></div>':'';
 const fixedOverview=rates?'<section class="card financial-rates"><h2>Custo da estrutura da empresa</h2><div class="financial-rate-grid"><div><small>Despesas ativas</small><strong>'+brl(rates.fixed_expenses_cents)+'</strong></div><div><small>Folha fixa mensal</small><strong>'+brl(rates.payroll_cents)+'</strong></div><div><small>Total mensal da empresa</small><strong>'+brl(rates.monthly_cents)+'</strong></div><div><small>Por dia faturável</small><strong>'+brl(rates.daily_cents)+'</strong></div><div><small>Por hora faturável</small><strong>'+brl(rates.hourly_cents)+'</strong></div></div><p class="hint">Base: '+rates.billable_days_month+' dias faturáveis por mês × '+rates.hours_day+' horas por dia. Somente despesas ativas entram no rateio. Uma despesa com valor R$ 0 continua ativa sem aumentar o custo. <button type="button" class="subtle" data-view="settings">Ajustar capacidade</button></p><p class="hint">Funcionários com forma de custo "Fixo mensal" entram automaticamente na folha; os de "Por obra" só entram se adicionados ao orçamento. Não repita salários da equipe também na lista de despesas fixas.</p></section>':'';
 return title(label,entity==='workers'?'Equipe da empresa: funcionários fixos entram automaticamente no rateio mensal; profissionais por obra só quando adicionados.':entity==='fixed'?'Contas da operação que precisam ser cobertas pelas obras.':'Custos reais que você usa como atalhos ao montar cada orçamento.')+
 fixedOverview+
 '<div class="cols"><section class="card"><h2>'+ (editing?'Editar registro':'Cadastrar '+label.toLowerCase())+'</h2>'+
 '<form id="entityForm" data-entity="'+entity+'"><div class="grid">'+fields[entity].map(f=>inputField(f,editing)).join('')+'</div>'+
 '<div class="buttons"><button class="primary" type="submit">'+(editing?'Salvar alterações':'+ Adicionar')+'</button>'+
 (editing?'<button type="button" class="subtle" data-action="cancel-edit">Cancelar</button>':'')+'</div></form></section>'+
 '<section class="card '+(entity==='workers'?'worker-ledger':'')+'"><h2>Registros ('+items.length+')</h2>'+
 '<div class="'+(entity==='workers'?'worker-scroll':'')+'">'+(items.length?items.map(x=>
 '<div class="entry"><div><strong>'+esc(x.name)+'</strong><small>'+entryLabel(entity,x)+'</small></div><div class="actions"><button class="subtle small" data-action="edit-item" data-id="'+esc(x.id)+'">Editar</button><button class="danger small" data-action="delete-item" data-id="'+esc(x.id)+'">Excluir</button></div></div>').join(''):empty('Nada cadastrado ainda.'))+'</div>'+workerFooter+'</section></div>';
}
function settings(){
 const c=state.data.settings[0]||{workdays_month:22,billable_days_month:22,hours_day:8,tax_pct:0,margin_pct:0};
 const rates=companyRates(state.data.fixed,c,state.data.workers);
 return title('Configurações financeiras','Defina os parâmetros reais da sua operação. Nada é imposto por uma tabela.')+
 '<section class="card" style="max-width:810px"><form id="settingsForm"><div class="grid">'+
 '<label>Dias úteis do mês<input name="workdays_month" type="number" min="1" max="31" step="1" value="'+esc(c.workdays_month)+'" required></label>'+
 '<label>Dias-equipe faturáveis por mês<input name="billable_days_month" type="number" min=".01" max="1000" step=".01" value="'+esc(c.billable_days_month)+'" required></label>'+ 
 '<label>Horas de trabalho por dia<input name="hours_day" type="number" min=".25" max="24" step=".25" value="'+esc(c.hours_day??8)+'" required></label>'+
 '<label>Impostos estimados sobre venda (%)<input name="tax_pct" type="number" min="0" max="99" step=".01" value="'+esc(c.tax_pct)+'" required></label>'+
 '<label>Margem de lucro desejada sobre venda (%)<input name="margin_pct" type="number" min="0" max="99" step=".01" value="'+esc(c.margin_pct)+'" required></label></div>'+
 '<p class="hint">Os custos fixos do mês são divididos pelos dias-equipe faturáveis para obter o custo/dia, e depois pelas horas/dia para obter o custo/hora. 22 dias e 8 horas são valores iniciais editáveis. Se houver várias equipes simultâneas, informe a capacidade faturável total. Impostos e margem são adicionados na formação do preço de venda; confirme a tributação com seu contador.</p>'+
 '<div class="buttons"><button class="primary">Salvar parâmetros</button></div></form></section>'+
 '<section class="card budget-settings-overview"><h2>Custos aplicados automaticamente nos novos orçamentos</h2>'+
 '<div class="financial-rate-grid"><div><small>Despesas fixas da empresa</small><strong>'+brl(rates.fixed_expenses_cents)+'</strong></div>'+
 '<div><small>Folha mensal dos funcionários</small><strong>'+brl(rates.payroll_cents)+'</strong></div>'+
 '<div><small>Custo fixo total por mês</small><strong>'+brl(rates.monthly_cents)+'</strong></div></div>'+
 '<p class="hint">Impostos, margem e dias faturáveis são editados acima. Diárias e encargos individuais são definidos no cadastro de Funcionários; despesas operacionais são editadas em Custos fixos. Esses valores já alimentam os novos orçamentos automaticamente.</p>'+
 '<div class="buttons"><button type="button" class="subtle" data-view="workers">Ajustar funcionários e encargos</button>'+
 '<button type="button" class="subtle" data-view="fixed">Ajustar despesas fixas</button></div></section>'+
 contractProfilePanel(state.data.contract_profiles[0],esc)+
 '<section class="card account-settings"><h2>Minha conta</h2>'+
 '<p>Seu acesso é individual. Nenhuma aprovação administrativa é necessária para utilizar seus próprios dados.</p>'+
 '<p class="hint">E-mail da conta: <strong>'+esc(state.accountEmail||'Conta autenticada')+'</strong></p>'+
 '<button type="button" class="subtle" data-action="account-reset-password">Receber link para alterar senha</button></section>'+notice();
}
function budgetList(){
 const rows=state.data.budgets;
 return title('Orçamentos','Nenhuma referência de preços. Cada proposta nasce dos custos desta obra.','<button class="primary" data-action="new-budget">+ Novo orçamento</button>')+
 '<section class="card"><h2>Histórico de propostas</h2>'+
 (rows.length?rows.map(b=>'<div class="entry"><div><strong>'+esc(b.title)+'</strong><small>'+esc(b.customer||'Cliente não informado')+' · '+new Date(b.created_at).toLocaleDateString('pt-BR')+'</small><small class="status '+esc(b.status)+'">'+esc(b.status)+'</small></div>'+
 '<div class="actions"><span class="price">'+brl(b.price_cents)+'</span><button class="subtle small" data-action="open-budget" data-id="'+esc(b.id)+'">Abrir</button><button class="subtle small" data-action="create-contract-from-budget" data-id="'+esc(b.id)+'">Gerar contrato</button><button class="danger small" data-action="delete-budget" data-id="'+esc(b.id)+'">Excluir</button></div></div>').join(''):empty('Nenhum orçamento salvo ainda.'))+'</section>';
}
function defaultPricing(){
 const c=state.data.settings[0]||{},rates=companyRates(state.data.fixed,c,state.data.workers);
 return {tax_pct:num(c.tax_pct),margin_pct:num(c.margin_pct),billable_days_month:num(c.billable_days_month)||22,
  fixed_monthly_cents:rates.monthly_cents,fixed_expenses_cents:rates.fixed_expenses_cents,payroll_cents:rates.payroll_cents};
}
function startBudget(row){
 state.draftId=row?.id||null;
 state.draft=row?structuredClone(row.content):{title:'',customer:'',address:'',services:'',notes:'',days:1,status:'rascunho',staff:[],expenses:[],scope_items:[],manual_price_cents:null,discount_pct:0,pricing:defaultPricing()};
 if(!Array.isArray(state.draft.scope_items))state.draft.scope_items=[];
 if(state.draft.discount_pct==null)state.draft.discount_pct=0;
 state.view='editor';render();
}
function editor(){
 const b=state.draft||{};
 const workers=state.data.workers.filter(x=>x.active);
 const variables=state.data.variable;
 const staffLines=(b.staff||[]).map((x,i)=>{
  const monthly=x.cost_mode==='monthly',dailyRef=x.daily_reference_cents??x.daily_cents;
  const amount=Math.round(x.daily_cents*x.days*(1+num(x.charges_pct)/100));
  return '<div class="budget-team-entry"><div class="budget-team-person"><strong>'+esc(x.name)+'</strong>'+
   '<small>'+esc(x.profession)+'</small>'+
   '<span class="budget-team-tag '+(monthly?'budget-team-monthly':'budget-team-project')+'">'+
   (monthly?'Equipe fixa · já coberta pela folha mensal':(x.cost_mode==='project'?'Por obra':'Cadastro anterior')+' · '+brl(dailyRef)+'/dia')+'</span>'+
   (!monthly&&num(x.charges_pct)>0?'<small>Encargos do cadastro: '+num(x.charges_pct)+'%</small>':'')+
   '</div><label>Dia(s) na obra<input data-staff-days="'+i+'" required type="number" min=".5" max="10000" step=".5" value="'+esc(x.days)+'"></label>'+
   '<div class="budget-team-cost"><small>'+ (monthly?'Incluso no custo mensal':'Custo adicional') +'</small><strong data-staff-cost="'+i+'">'+(monthly?'Já considerado':brl(amount))+'</strong></div>'+
   '<button type="button" class="danger small" data-action="remove-staff" data-index="'+i+'" aria-label="Remover '+esc(x.name)+' da obra">Remover</button></div>';
 }).join('');
 const expenseLines=(b.expenses||[]).map((x,i)=>'<div class="line"><div><strong>'+esc(x.name)+'</strong><small>'+brl(x.unit_cents)+' / '+esc(x.unit||'un')+'</small></div><label class="line-label">Qtd.<input data-expense-qty="'+i+'" required type="number" min="0" step=".01" value="'+esc(x.qty)+'"></label><span class="price">'+brl(Math.round(x.unit_cents*x.qty))+'</span><button class="danger" data-action="remove-expense" data-index="'+i+'" aria-label="Remover">×</button></div>').join('');
 const scopeUnits=['m²','m','m³','un','ponto','serviço'];
 const scopeLines=(b.scope_items||[]).map((item,i)=>'<div class="scope-entry">'+
  '<label>Serviço <input data-scope-description="'+i+'" required maxlength="180" value="'+esc(item.description||'')+'" placeholder="Ex.: Execução de parede em drywall"></label>'+
  '<label>Unidade <select data-scope-unit="'+i+'">'+scopeUnits.map(u=>'<option value="'+esc(u)+'" '+((item.unit||'m²')===u?'selected':'')+'>'+esc(u)+'</option>').join('')+'</select></label>'+
  '<label>Quantidade <input data-scope-quantity="'+i+'" required type="number" min="0.01" max="1000000" step="0.01" value="'+esc(item.quantity??1)+'"></label>'+
  '<button type="button" class="danger scope-remove" data-action="remove-scope" data-index="'+i+'" aria-label="Remover serviço '+(i+1)+'">Remover</button></div>').join('');
 return title(state.draftId?'Editar orçamento':'Novo orçamento','Selecione a equipe, descreva o serviço e inclua materiais só quando necessário. Os custos e percentuais vêm das configurações.','<button class="subtle" data-view="budgets">← Voltar</button>')+
 '<div class="editor budget-simple-editor"><div class="stack"><section class="card budget-step-card"><div class="budget-step-title"><span class="budget-step-number">1</span><div><h2>Dados da obra</h2><p>Informe o serviço e a duração prevista.</p></div></div><div class="grid">'+
 '<label>Nome da obra / orçamento<input data-draft="title" required maxlength="150" value="'+esc(b.title)+'" placeholder="Ex.: Reforma de banheiro"></label>'+
 '<label>Cliente<input data-draft="customer" required maxlength="150" value="'+esc(b.customer)+'" placeholder="Nome do cliente"></label>'+
 '<label>Local da obra<input data-draft="address" required maxlength="250" value="'+esc(b.address)+'"></label>'+
 '<label>Dias previstos de execução<input data-draft="days" required type="number" min=".5" step=".5" value="'+esc(b.days)+'"></label>'+
 '<label>Situação<select data-draft="status">'+['rascunho','enviado','aprovado','recusado'].map(x=>'<option value="'+x+'" '+(b.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
 '<label class="wide">Serviços que serão executados<textarea data-draft="services" placeholder="Descreva os serviços e quantidades reais, sem preços externos">'+esc(b.services)+'</textarea></label>'+
 '</div><details class="budget-more-details" '+(b.notes?'open':'')+'><summary>Condições, observações e prazo (opcional)</summary>'+
 '<label>Informações para a proposta<textarea data-draft="notes">'+esc(b.notes)+'</textarea></label></details></section>'+
 '<section class="card budget-step-card"><div class="budget-step-title"><span class="budget-step-number">2</span><div><h2>Escolha os profissionais da obra</h2><p>Todos os funcionários ativos aparecem, inclusive os fixos.</p></div></div>'+
 '<label class="worker-search-label">Buscar profissional ou profissão<input id="workerSearch" type="search" placeholder="Ex.: eletricista, pedreiro, nome" autocomplete="off"></label>'+
 '<div class="pick"><select id="workerSelect" aria-label="Lista de todos os profissionais cadastrados"><option value="">Selecione um profissional</option>'+workerOptions(workers.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')))+'</select>'+
 '<button type="button" class="secondary" data-action="add-worker">+ Adicionar</button></div>'+
 '<p class="caption">Equipe fixa: a diária já faz parte da folha mensal rateada, sem cobrança em duplicidade. Profissionais por obra: o valor da diária e os encargos cadastrados entram conforme os dias utilizados. Altere diárias e encargos em Funcionários.</p>'+
 '<div class="budget-team-list">'+(staffLines||empty('Selecione acima os profissionais que executarão este serviço.'))+'</div></section>'+
 '<section class="card budget-step-card"><div class="budget-step-title"><span class="budget-step-number">3</span><div><h2>Serviços e quantidades</h2><p>Itens que serão apresentados ao cliente no PDF.</p></div></div>'+
 '<p class="caption">Liste o que será executado para o cliente: metragem de parede, piso, forro, drywall, pontos elétricos e outros. Estes itens serão apresentados no PDF sem preço unitário ou custos internos.</p>'+
 '<div class="scope-list">'+(scopeLines||empty('Adicione os serviços e suas quantidades para detalhar a proposta.'))+'</div>'+
 '<div class="buttons"><button type="button" class="secondary" data-action="add-scope">+ Adicionar serviço</button></div></section>'+
 '<section class="card budget-step-card"><div class="budget-step-title"><span class="budget-step-number">4</span><div><h2>Materiais e outras despesas (opcional)</h2><p>Adicione somente o que a CIVOLTEN vai fornecer.</p></div></div><div class="pick"><select id="variableSelect"><option value="">Escolha uma despesa cadastrada</option>'+variables.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+' — '+brl(x.unit_cents)+'/'+esc(x.unit)+'</option>').join('')+'</select><button class="secondary" data-action="add-variable">Adicionar</button></div>'+
 '<p class="caption">Esses itens não entram automaticamente no orçamento. Se o cliente fornecer materiais, não os adicione. Quando a CIVOLTEN fornecer materiais ou assumir transporte/locação, adicione os itens e quantidades efetivos abaixo.</p>'+
 '<div class="grid" style="margin:15px 0"><label>Nova despesa<input id="customExpenseName" maxlength="120" placeholder="Ex.: Material de acabamento"></label><label>Valor total (R$)<input id="customExpenseValue" type="number" min="0" step=".01"></label></div><button class="subtle" data-action="add-expense">+ Despesa avulsa</button>'+
 '<div style="margin-top:15px">'+(expenseLines||empty('Nenhuma despesa variável.'))+'</div></section>'+
 '<section class="card budget-setup-note"><div class="budget-setup-icon" aria-hidden="true">⚙</div><div><h2>Cálculo automático</h2><p>Custos fixos e folha, capacidade mensal, impostos e margem são aplicados a partir de <strong>Configurações financeiras</strong>. Você não precisa preencher porcentagens neste orçamento.</p>'+
 '<p class="hint">Parâmetros deste orçamento: imposto '+num(b.pricing?.tax_pct)+'% · margem '+num(b.pricing?.margin_pct)+'% · '+num(b.pricing?.billable_days_month)+' dias faturáveis/mês. Valores preservados no orçamento após salvar.</p>'+
 '<details class="budget-price-details" '+(b.manual_price_cents!=null?'open':'')+'><summary>Ajustar preço final desta obra (opcional)</summary>'+
 '<label>Preço de venda manual (R$)<input data-draft="manual_price" type="number" min="0" step=".01" value="'+(b.manual_price_cents==null?'':dec(b.manual_price_cents))+'" placeholder="Vazio = preço sugerido automaticamente"></label>'+
 '<p class="hint">Caso informe um preço manual, confira o lucro no resumo antes de salvar.</p></details></div></section></div>'+
 '<aside class="summary"><h2>Fechamento da obra</h2>'+
 '<div class="discount-simulator"><div class="discount-head"><h3>Simulação de desconto</h3><span>Antes de fechar</span></div>'+
 '<p class="hint">Veja como o desconto muda o preço, o lucro e a margem líquida. Só será aplicado à proposta quando ela for salva.</p>'+
 '<div class="discount-controls"><input type="range" min="0" max="50" step="0.5" data-discount-range value="'+esc(b.discount_pct??0)+'" aria-label="Desconto percentual">'+
 '<label>Desconto (%)<input type="number" min="0" max="100" step="0.5" data-discount-number value="'+esc(b.discount_pct??0)+'"></label></div></div>'+
 '<div id="budgetSummary"></div><div class="buttons"><button class="primary" data-action="save-budget">Salvar orçamento</button>'+
 '<button class="subtle" data-action="print-budget">Exportar Proposta Comercial (PDF)</button></div>'+
 '<p class="hint">O PDF contém somente o escopo, prazos e preço global. Custos, impostos, diárias e lucro continuam sigilosos.</p></aside></div>';
}
function summary(){
 const el=$('#budgetSummary');if(!el||!state.draft)return;
 try{
  const b=state.draft,r=calculateBudget(b);
  el.innerHTML='<div class="sumrow"><span>Equipe extra por obra</span><strong>'+brl(r.labor_cents)+'</strong></div>'+
   '<div class="sumrow"><span>Despesas variáveis</span><strong>'+brl(r.variable_cents)+'</strong></div>'+
   '<div class="sumrow"><span>Rateio mensal (despesas fixas + folha)</span><strong>'+brl(r.fixed_cents)+'</strong></div>'+
   '<div class="sumrow"><span>Subtotal de custos (fixos rateados + equipe + variáveis)</span><strong>'+brl(r.cost_cents)+'</strong></div>'+
   '<div class="sumrow"><span>Impostos estimados sobre o preço final</span><strong>'+brl(r.tax_cents)+'</strong></div>'+
   '<div class="sumrow"><span>Preço antes do desconto</span><strong>'+brl(r.price_before_discount_cents)+'</strong></div>'+
   '<div class="sumrow"><span>Desconto ('+r.discount_pct.toFixed(1)+'%)</span><strong>− '+brl(r.discount_cents)+'</strong></div>'+
   '<div class="sumrow sumtotal"><span>Preço final ao cliente</span><strong>'+brl(r.price_cents)+'</strong></div>'+
   '<div class="sumrow"><span>Resultado estimado</span><strong class="'+(r.profit_cents<0?'bad':'good')+'">'+brl(r.profit_cents)+'</strong></div>'+
   '<div class="sumrow"><span>Margem líquida estimada</span><strong class="'+(r.margin_pct_real<0?'bad':'good')+'">'+r.margin_pct_real.toFixed(2)+'%</strong></div>'+
   '<div class="discount-margin-impact"><span>Margem sem desconto</span><strong>'+calculateBudget({...b,discount_pct:0}).margin_pct_real.toFixed(2)+'%</strong><span>Impacto do desconto</span><strong class="'+(r.discount_pct>0?'bad':'')+'">'+(r.margin_pct_real-calculateBudget({...b,discount_pct:0}).margin_pct_real).toFixed(2)+' pontos percentuais</strong></div>'+
   ((num(b.pricing?.tax_pct)===0||num(b.pricing?.margin_pct)===0)?'<div class="warning">Revise impostos e margem: pelo menos um está em 0%. Não assuma que a tributação é zero sem confirmação.</div>':'')+
   (r.profit_cents<0?'<div class="warning">Atenção: o preço escolhido resulta em prejuízo estimado.</div>':'')+
   '<p class="hint">Estimativa interna baseada nos seus lançamentos. Custos imprevistos e tributos reais podem alterar o resultado.</p>';
 }catch(error){el.innerHTML='<div class="warning">'+esc(error.message)+'</div>'}
}
function contractCompany(){return {...defaultContractCompany(),...(state.data.contract_profiles[0]||{})}}
function startContract(row=null,budget=null){
 state.contractId=row?.id||null;
 state.contractDraft=row?{...contractDefaults(),...structuredClone(row.content),status:row.status,budget_id:row.budget_id,_locked:row.status!=='rascunho'}:
  budget?{...contractFromBudget(budget,contractCompany()),status:'rascunho'}:
  {...contractDefaults(),company:contractCompany(),status:'rascunho',budget_id:null};
 state.view='contract-editor';render();
}
function reviseContract(row){
 if(!row)throw Error('Contrato original não encontrado.');
 state.contractId=null;
 state.contractDraft={...contractDefaults(),...structuredClone(row.content),status:'rascunho',revision_of:row.id,revision_reason:'',_locked:false};
 state.view='contract-editor';render();flash('Nova revisão iniciada como rascunho; o contrato original foi preservado.');
}
async function saveContract(){
 const c=state.contractDraft;
 if(!c)throw Error('Abra um contrato para salvar.');
 if(!contractValidation(c.status==='emitido'||c.status==='assinado'))return;
 const record={title:String(c.title||'').trim(),counterparty:String(c.counterparty_name||'').trim(),
  status:c.status||'rascunho',content:c,budget_id:c.budget_id||null};
 const reply=await request(route('contracts',state.contractId),state.contractId?'PATCH':'POST',{record});
 const saved=reply.rows?.[0];if(!saved?.id)throw Error('O banco não confirmou o contrato.');
 state.contractId=saved.id;
 state.contractDraft={...contractDefaults(),...structuredClone(saved.content),status:saved.status,budget_id:saved.budget_id,_locked:saved.status!=='rascunho'};
 await reload();render();flash('Contrato salvo com segurança.');
}
async function printContract(){
 const c=state.contractDraft;if(!c)throw Error('Abra um contrato antes de imprimir.');
 if(!contractValidation(true))return;
 const div=$('#printArea');div.innerHTML=buildContractHtml(c,{id:state.contractId});
 try{await Promise.all([...div.querySelectorAll('img')].map(img=>img.decode()))}
 catch{throw Error('Não foi possível carregar a logo para o contrato. Atualize a página.')}
 window.print();
}
async function saveContractProfile(form){
 const record={};
 for(const key of ['company_name','company_document','company_address','company_representative','company_phone','company_email','city'])
  record[key]=String(form.elements.namedItem(key)?.value||'').trim();
 if(!record.company_name||!record.company_document)throw Error('Informe nome legal e CPF/CNPJ da empresa.');
 const current=state.data.contract_profiles[0];
 await request(route('contract_profiles',current?.id),current?'PATCH':'POST',{record});
 await reload();render();flash('Dados da empresa salvos para os próximos contratos.');
}
function render(){
 document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===state.view));
 lastValidationMode='';
 $('#content').innerHTML=state.view==='home'?dashboard():state.view==='settings'?settings():state.view==='budgets'?budgetList():state.view==='contracts'?contractList(state.data.contracts,esc,brl,title,state.data.budgets):state.view==='contract-editor'?contractEditor(state.contractDraft,state.contractId,state.data.contract_profiles[0],state.data.budgets,esc,brl,title):state.view==='editor'?editor():generic(state.view);
 attachFormValidation();
 if(state.view==='editor')summary();
}
async function saveEntity(entity,form){
 const record={},def=fields[entity];
 for(const [k,,type] of def){
  const e=form.elements.namedItem(k);
  record[k]=type==='checkbox'?e.checked:type==='money'?money(e.value):type==='number'?num(e.value):e.value.trim();
 }
 if(entity==='workers'){
  if(!Number.isFinite(record.charges_pct)||record.charges_pct<0||record.charges_pct>200)
   throw Error('Encargos do profissional devem estar entre 0% e 200%');
  if(!['monthly','project'].includes(record.cost_mode))throw Error('Escolha a forma de custo do funcionário');
 }
 const id=state.edit,method=id?'PATCH':'POST';
 await request(route(entity,id),method,{record});
 let catalogWarning='';
 // Salvar no catalogo so depois de a pessoa ter sido cadastrada com sucesso.
 // A falha eventual do catalogo nao desfaz um funcionario ja salvo.
 if(entity==='workers'&&!state.data.professions.some(p=>normalizeProfession(p.name)===normalizeProfession(record.profession))){
  try{await request(route('professions'),'POST',{record:{name:record.profession}})}
  catch{catalogWarning=' O funcionário foi salvo, mas a profissão não entrou no catálogo. Tente novamente depois.'}
 }
 state.edit=null;await reload();render();flash('Cadastro salvo.'+catalogWarning);
}
async function saveSettings(form){
 const record={};
 for(const k of ['workdays_month','billable_days_month','hours_day','tax_pct','margin_pct'])record[k]=num(form.elements.namedItem(k).value);
 if(!(record.hours_day>0&&record.hours_day<=24))throw Error('Informe a jornada diária de até 24 horas');
 if(record.tax_pct+record.margin_pct>=100)throw Error('Impostos e margem devem somar menos de 100%');
 const id=state.data.settings[0]?.id;
 await request(route('settings',id),id?'PATCH':'POST',{record});
 await reload();render();flash('Parâmetros financeiros salvos.');
}
async function saveBudget(){
 const b=state.draft;
 if(!budgetValidation(false))return;
 if(!b.title?.trim())throw Error('Informe o título da obra');
 calculateBudget(b);
 normalizeScopeItems(b.scope_items||[]);
 const record={title:b.title.trim(),customer:(b.customer||'').trim(),status:b.status||'rascunho',content:b};
 await request(route('budgets',state.draftId),state.draftId?'PATCH':'POST',{record});
 state.draft=null;state.draftId=null;state.view='budgets';await reload();render();flash('Orçamento salvo com análise de custos.');
}
async function printBudget(){
 const b=state.draft;
 if(!budgetValidation(true))return;
 const r=calculateBudget(b);
 if(!(r.price_cents>0)){
  validateArea(document.querySelector('.budget-simple-editor'),{checkRequired:false,issues:[{selector:'[data-draft="manual_price"]',message:'A proposta precisa ter preço final acima de R$ 0,00. Revise os custos ou informe um preço manual.'}]});
  return;
 }
 // O valor e apenas comercial. As duas artes sao recursos oficiais locais e obrigatorios.
 // Nunca omitir a logo por uma condicao de carregamento da tela de login.
 const html=buildProposalHtml(b,{
  priceCents:r.price_cents,
  id:state.draftId,
  date:new Date(),
  logoDataUrl:'/assets/civolten-logo.png',
  headerArtUrl:'/assets/civolten-proposal-header.png'
 });
 const div=$('#printArea');
 div.innerHTML=html;
 // Aguarda o carregamento das DUAS imagens antes de abrir a impressao no celular.
 try{
  await Promise.all([...div.querySelectorAll('img')].map(img=>img.decode()));
 }catch{
  throw Error('Nao foi possivel carregar as imagens CIVOLTEN para o PDF. Atualize a pagina e tente novamente.');
 }
 window.print();
}
document.addEventListener('submit',async ev=>{
 if(!['login','entityForm','settingsForm','signupForm','recoverForm','passwordForm','cashEntryForm','dashboardMarginForm','contractProfileForm'].includes(ev.target.id))return;
 ev.preventDefault();const f=ev.target,button=f.querySelector('button[type=submit],button.primary');
 const extra=f.id==='dashboardMarginForm'||f.id==='settingsForm'?taxMarginIssues(f.elements.namedItem('tax_pct').value,f.elements.namedItem('margin_pct').value):
  f.id==='contractProfileForm'&&!validBrazilDocument(f.elements.namedItem('company_document').value)?[{selector:'[name="company_document"]',message:'Informe um CPF ou CNPJ válido.'}]:
  f.id==='passwordForm'&&f.elements.namedItem('password').value!==f.elements.namedItem('confirm').value?[{selector:'[name="confirm"]',message:'As duas senhas devem ser iguais.'}]:[];
 if(!validateArea(f,{issues:extra}))return;
 const originalLabel=button?.textContent;
 if(button){button.disabled=true;if(f.id==='login')button.textContent='Verificando acesso...'}
 try{
  if(f.id==='login'){
   const form=new FormData(f);
   const result=await request('/api/session','POST',{email:form.get('email'),password:form.get('password')});
   if(result.authenticated){state.accountEmail=String(form.get('email')||'');await showApp();f.reset()}
  }else if(f.id==='signupForm'){
   const data=new FormData(f);
   const r=await request('/api/signup','POST',{email:data.get('email'),password:data.get('password')});
   if(r.authenticated){state.accountEmail=String(data.get('email')||'');await showApp();f.reset()}
   else{authMode('login');$('#authNotice').textContent=r.message||'Confirme o e-mail para entrar sem aprovação.'}
  }else if(f.id==='recoverForm'){
   const data=new FormData(f);
   const r=await request('/api/recovery','POST',{action:'request',email:data.get('email')});
   authMode('login');$('#authNotice').textContent=r.message||'Se a conta existir, enviaremos instruções por e-mail.';
  }else if(f.id==='passwordForm'){
   const data=new FormData(f),password=data.get('password');
   if(password!==data.get('confirm'))throw Error('As duas senhas precisam ser iguais.');
   await request('/api/recovery','POST',{action:'update',access_token:recoveryToken,password});
   recoveryToken=null;f.reset();authMode('login');$('#authNotice').textContent='Senha atualizada! Agora entre com seu e-mail e a nova senha.';
  }else if(f.id==='entityForm')await saveEntity(f.dataset.entity,f);
  else if(f.id==='cashEntryForm')await saveCashMovement(f);
  else if(f.id==='dashboardMarginForm')await saveDashboardMargin(f);
  else if(f.id==='contractProfileForm')await saveContractProfile(f);
  else await saveSettings(f);
 }catch(error){flash(error.message)}finally{if(button){button.disabled=false;button.textContent=originalLabel}}
});
document.addEventListener('change',ev=>{
 if(ev.target.id==='contractStatus'&&state.contractDraft)state.contractDraft.status=ev.target.value;
});
document.addEventListener('focusin',ev=>{
 if(ev.target.id==='workerProfession')showProfessionOptions(ev.target);
});
document.addEventListener('keydown',ev=>{
 if(ev.target.id==='workerProfession'&&ev.key==='Escape')closeProfessionOptions();
});
document.addEventListener('input',ev=>{
 const e=ev.target;
 if(e.id==='workerProfession'){showProfessionOptions(e);return}
 if(e.id==='workerSearch'){updateWorkerChoices();return}
 if(e.id==='dashboardProjectSearch'){state.dashboardSearch=e.value;refreshDashboardProjects();return}
 if(e.dataset.contract!==undefined){
  if(!state.contractDraft)return;
  const key=e.dataset.contract;
  if(key==='value_reais')state.contractDraft.value_cents=money(e.value);
  else state.contractDraft[key]=e.value;
  const c=state.contractDraft;
  const party=$('#contractSummaryParty'),value=$('#contractSummaryValue'),dates=$('#contractSummaryDates');
  if(party)party.textContent=c.counterparty_name||'A preencher';
  if(value)value.textContent=brl(c.value_cents);
  if(dates)dates.textContent=(c.start_on||'—')+' até '+(c.end_on||'—');
  return;
 }
 if(e.dataset.discountRange!==undefined||e.dataset.discountNumber!==undefined){
  if(!state.draft)return;
  const val=Number(e.value);
  if(!Number.isFinite(val)||val<0||val>100){flash('Desconto deve estar entre 0% e 100%.');return}
  state.draft.discount_pct=val;
  const mirror=document.querySelector(e.dataset.discountRange!==undefined?'[data-discount-number]':'[data-discount-range]');
  if(mirror)mirror.value=String(Math.min(50,val));
  if(e.dataset.discountRange!==undefined&&mirror)mirror.value=String(val);
  summary();return;
 }
 const b=state.draft;if(!b)return;
 if(e.dataset.draft){
  const k=e.dataset.draft;
  if(k==='days')b.days=num(e.value);
  else if(k==='manual_price')b.manual_price_cents=e.value===''?null:money(e.value);
  else b[k]=e.value;
  summary();
 }
 if(e.dataset.pricing){
  const k=e.dataset.pricing;
  if(k==='fixed_monthly_reais')b.pricing.fixed_monthly_cents=money(e.value);
  else b.pricing[k]=num(e.value);
  summary();
 }
 if(e.dataset.scopeDescription!==undefined){b.scope_items[Number(e.dataset.scopeDescription)].description=e.value}
 if(e.dataset.scopeUnit!==undefined){b.scope_items[Number(e.dataset.scopeUnit)].unit=e.value}
 if(e.dataset.scopeQuantity!==undefined){b.scope_items[Number(e.dataset.scopeQuantity)].quantity=e.value===''?0:Number(e.value)}
 if(e.dataset.staffDays!==undefined){
  const i=Number(e.dataset.staffDays);
  b.staff[i].days=num(e.value);
  const cost=document.querySelector('[data-staff-cost="'+i+'"]');
  if(cost)cost.textContent=b.staff[i].cost_mode==='monthly'?'Já considerado':brl(Math.round(b.staff[i].daily_cents*b.staff[i].days*(1+num(b.staff[i].charges_pct)/100)));
  summary()
 }
 if(e.dataset.staffCharges!==undefined){
  const i=Number(e.dataset.staffCharges),pct=e.value.trim()===''?0:Number(e.value);
  b.staff[i].charges_pct=pct;
  const cost=document.querySelector('[data-staff-cost="'+i+'"]');
  if(cost)cost.textContent=Number.isFinite(pct)&&pct>=0&&pct<=200?
   brl(Math.round(b.staff[i].daily_cents*b.staff[i].days*(1+pct/100))):'Verifique os encargos';
  summary()
 }
 if(e.dataset.expenseQty!==undefined){b.expenses[Number(e.dataset.expenseQty)].qty=num(e.value);summary()}
});
document.addEventListener('change',ev=>{
 const e=ev.target;
 if(e.id==='dashboardProjectStatus'){state.dashboardStatus=e.value;refreshDashboardProjects();return}
 if(e.dataset.draft&&state.draft){state.draft[e.dataset.draft]=e.value;summary()}
 if(e.dataset.scopeUnit!==undefined&&state.draft)state.draft.scope_items[Number(e.dataset.scopeUnit)].unit=e.value;
});
document.addEventListener('click',async ev=>{
 const option=ev.target.closest('[data-profession-option]');
 if(option){
  ev.preventDefault();
  const input=$('#workerProfession');
  if(input){input.value=option.dataset.professionOption;closeProfessionOptions();input.focus({preventScroll:true})}
  return;
 }
 if(!ev.target.closest('.profession-picker'))closeProfessionOptions();
 const mode=ev.target.closest('[data-auth-mode]');
 if(mode){authMode(mode.dataset.authMode);return}
 const tab=ev.target.closest('[data-view]');
 if(tab){
  state.view=tab.dataset.view;state.edit=null;state.draft=null;state.contractDraft=null;state.contractId=null;
  render();return
 }
 const el=ev.target.closest('[data-action]');if(!el)return;
 const action=el.dataset.action,id=el.dataset.id,b=state.draft;
 try{
  if(action==='account-reset-password'){
   if(!state.accountEmail)throw Error('Entre novamente na conta antes de solicitar a alteração de senha.');
   await request('/api/recovery','POST',{action:'request',email:state.accountEmail});
   flash('Verifique seu e-mail para alterar sua senha.');
  }
  else if(action==='delete-cash'){
   if(!window.confirm('Excluir esta movimentação do caixa?'))return;
   await request(route('cash',id),'DELETE');
   await reload();render();flash('Movimentação excluída.');
  }
  else if(action==='new-contract')startContract();
  else if(action==='open-contract')startContract(state.data.contracts.find(x=>x.id===id));
  else if(action==='revise-contract')reviseContract(state.data.contracts.find(x=>x.id===id));
  else if(action==='revise-open-contract')reviseContract(state.data.contracts.find(x=>x.id===state.contractId));
  else if(action==='create-contract-from-budget')startContract(null,state.data.budgets.find(x=>x.id===id));
  else if(action==='contract-from-selected-budget'){
   const budget=state.data.budgets.find(x=>x.id===$('#contractFromBudgetSelect')?.value);
   if(!budget){validateArea(document.querySelector('#content'),{issues:[{selector:'#contractFromBudgetSelect',message:'Selecione o orçamento de origem.'}],checkRequired:false});return}
   startContract(null,budget);
  }
  else if(action==='delete-contract'){
   if(!window.confirm('Excluir este contrato? A operação não pode ser desfeita.'))return;
   await request(route('contracts',id),'DELETE');await reload();render();flash('Contrato excluído.');
  }
  else if(action==='save-contract')await saveContract();
  else if(action==='print-contract')await printContract();
  else if(action==='new-budget')startBudget();
  else if(action==='add-scope'){
   if(!b||b.scope_items.length>=100)throw Error('Limite de 100 serviços por proposta');
   b.scope_items.push({description:'',unit:'m²',quantity:1});render();
  }
  else if(action==='remove-scope'){if(b?.scope_items){b.scope_items.splice(Number(el.dataset.index),1);render()}}
  else if(action==='open-budget')startBudget(state.data.budgets.find(x=>x.id===id));
  else if(action==='edit-item'){state.edit=id;render()}
  else if(action==='cancel-edit'){state.edit=null;render()}
  else if(action==='delete-item'||action==='delete-budget'){
   if(!window.confirm('Excluir este registro? A operação não pode ser desfeita.'))return;
   await request(route(action==='delete-budget'?'budgets':state.view,id),'DELETE');
   await reload();render();flash('Registro excluído.');
  }
  else if(action==='add-worker'){
   const x=state.data.workers.find(x=>x.id===$('#workerSelect').value);
   if(!x){validateArea(document.querySelector('.budget-simple-editor'),{issues:[{selector:'#workerSelect',message:'Selecione um profissional antes de adicionar.'}],checkRequired:false});return}
   if(staffAlreadyAdded(b.staff,x.id))throw Error('Este profissional já está selecionado para a obra.');
   b.staff.push(createBudgetStaff(x,b.days));render();
  }
  else if(action==='add-variable'){
   const x=state.data.variable.find(x=>x.id===$('#variableSelect').value);
   if(!x){validateArea(document.querySelector('.budget-simple-editor'),{issues:[{selector:'#variableSelect',message:'Selecione uma despesa antes de adicionar.'}],checkRequired:false});return}
   b.expenses.push({name:x.name,unit:x.unit,unit_cents:x.unit_cents,qty:1});render();
  }
  else if(action==='add-expense'){
   const name=$('#customExpenseName').value.trim(),value=$('#customExpenseValue').value;
   const amount=Number(String(value).replace(',','.'));
   const missing=[];
   if(!name)missing.push({selector:'#customExpenseName',message:'Informe a descrição da despesa.'});
   if(!value||!Number.isFinite(amount)||amount<=0)missing.push({selector:'#customExpenseValue',message:'Informe um valor maior que zero.'});
   if(missing.length){validateArea(document.querySelector('.budget-simple-editor'),{issues:missing,checkRequired:false});return}
   b.expenses.push({name,unit:'total',unit_cents:money(value),qty:1});render();
  }
  else if(action==='remove-staff'){b.staff.splice(Number(el.dataset.index),1);render()}
  else if(action==='remove-expense'){b.expenses.splice(Number(el.dataset.index),1);render()}
  else if(action==='save-budget')await saveBudget();
  else if(action==='print-budget')await printBudget();
 }catch(error){flash(error.message)}
});
async function logout(){
 try{await request('/api/session','DELETE')}catch{}
 state.accountEmail='';
 state.view='home';state.draft=null;$('#app').hidden=true;$('#auth').hidden=false;authMode('login');$('#login').reset();
}
$('#logout').addEventListener('click',logout);
// Microfones de ditado também acompanham campos criados dinamicamente em cada tela.
// O texto entra pelo mesmo evento 'input' utilizado nos orçamentos e cadastros.
startVoiceFields({notify:flash});
// Validação delegada: cobre também os formulários que são criados ao mudar de aba.
attachFormValidation();
function activeValidationIssues(){
 if(state.view==='editor'&&state.draft)return budgetIssues(state.draft,{forPdf:lastValidationMode==='budget-pdf'});
 if(state.view==='contract-editor'&&state.contractDraft)return contractIssues(state.contractDraft,{forExport:lastValidationMode==='contract-pdf'||['emitido','assinado'].includes(state.contractDraft.status)});
 if(state.view==='settings'){
  const form=document.querySelector('#contractProfileForm');
  if(form&&!validBrazilDocument(form.elements.namedItem('company_document').value))return [{selector:'[name="company_document"]',message:'Informe um CPF ou CNPJ válido.'}];
 }
 return [];
}
function inspectEditedField(field,blur=false){
 if(!field.matches?.('input,textarea,select'))return;
 const draft=state.view==='editor'&&field.hasAttribute('data-draft');
 const contractDraft=state.view==='contract-editor'&&field.hasAttribute('data-contract')&&state.contractDraft?.status==='rascunho'&&lastValidationMode!=='contract-pdf';
 revalidateField(field,activeValidationIssues(),{checkRequired:!(draft||contractDraft),blur});
}
document.addEventListener('focusout',event=>inspectEditedField(event.target,true),true);
document.addEventListener('input',event=>inspectEditedField(event.target));
document.addEventListener('change',event=>inspectEditedField(event.target));
// A consulta opcional de cores nao deve bloquear o inicio da sessao.
void loadBrand();
const fragment=new URLSearchParams(window.location.hash.replace(/^#/,''));
const fragmentToken=fragment.get('access_token');
if(fragment.get('type')==='recovery'&&fragmentToken)recoveryToken=fragmentToken;
if(fragment.has('access_token')||fragment.has('error'))history.replaceState(null,'',location.pathname+location.search);
if(recoveryToken)authMode('password');
else{
 try{
  // O Supabase pode encaminhar diretamente ao CIVOLTEN após confirmação.
  // O token é validado no servidor e convertido em cookie HttpOnly.
  const confirmation=fragmentToken&&fragment.get('type')!=='recovery';
  const r=confirmation?await request('/api/session','POST',{access_token:fragmentToken}):await request('/api/session');
  if(r.authenticated){state.accountEmail=r.email||'';await showApp()}
  else if(confirmation){authMode('login');$('#authNotice').textContent='E-mail confirmado. Entre com sua senha.'}
 }catch{authMode('login');if(fragmentToken)$('#authNotice').textContent='Não foi possível abrir a sessão. Entre com seu e-mail e senha.'}
}
