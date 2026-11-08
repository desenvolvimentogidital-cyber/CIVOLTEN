import {createClient} from '@supabase/supabase-js';
import {fetchRemote,putRemote,deleteRemote,putPayrollRemote,putCompanyRemote,putCostPresetsRemote,putCatalogBatchRemote} from './cloud.mjs';
import {prepareCostPresets} from './cost-presets.mjs';
import {payrollPreset,validatePayroll} from './payroll.mjs';
import {createE2EClient} from './e2e-client.mjs';
import {signupOutcome,authMessage,repeatedSignupMessage,pendingEmailMessage} from './auth-flow.mjs';
import {fresh,safeLoad,safeSave,validate,summary,employeeCost,variableMonthly,variableQuantity,brl} from './calc.mjs';
import {validateCompany,THEMES} from './pricing.mjs';
import {companyView,appearanceView,pricingPreview} from './settings-ui.mjs';
import {validateEntry,reportCsv,localToday,currentMonth} from './finance.mjs';
import {financeView,reportsView,ledgerEditorView} from './finance-ui.mjs';
import {createService,createPricingSnapshot,validateBudget,validateBudgetItem,budgetCsv,priceBudget} from './budget.mjs';
import {budgetsView,budgetEditorView,budgetPreview,budgetServiceDialog,budgetSchedulePreview,getBudgetSchedule} from './budget-ui.mjs';
import {scheduleCsv,suggestExecutionTerm} from './budget-schedule.mjs';
import {catalogByCode,catalogToBudgetItem,validateCatalogRecord} from './service-catalog.mjs';
import {readCatalogFile,suggestColumns,buildCatalogImport} from './catalog-import.mjs';
import {catalogView,catalogEditorDialog} from './catalog-ui.mjs';
import {authView,shell,homeView,costsView,teamView,moreView,editorView,payrollSettingsView,cltBreakdownHtml,e,icon} from './views.mjs';
const SUPABASE_URL=__CIVOLTEN_SUPABASE_URL__;
const SUPABASE_PUBLIC_KEY=__CIVOLTEN_SUPABASE_PUBLISHABLE_KEY__;
const E2E=__CIVOLTEN_E2E__===true&&['127.0.0.1','localhost'].includes(location.hostname);
const auth=E2E?createE2EClient():
 (SUPABASE_URL&&SUPABASE_PUBLIC_KEY?
 createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
 }):null);
const recoveryToken=new URLSearchParams(location.search).get('token');
const mount=document.getElementById('app');
const modal=document.getElementById('editor-dialog');
const toastNode=document.getElementById('toast');
const state={
 user:null,data:fresh(),view:'home',costTab:'fixed',finMonth:currentMonth(),finFilter:'all',quoteHours:'8',quoteExtra:'0',authMode:recoveryToken?'newpass':'login',
 cloudError:null,budgetDraft:null,budgetError:'',catalogCategory:'all',catalogBack:'budgets',catalogImport:null,catalogSearch:'',
 authBusy:false,authError:'',busy:false,editor:null,toastTimer:null,
 checkedSession:false
};
const delayToast=(text)=>{
 toastNode.textContent=text;toastNode.hidden=false;
 clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>{toastNode.hidden=true},4300);
};
function render(){
 document.documentElement.dataset.civoltenTheme=state.user?(state.data.company?.theme||'gold'):'gold';
 if(!state.checkedSession){mount.innerHTML='<div class="loading-stage"><img src="/assets/civolten-simbolo.png" alt=""><span>Preparando CIVOLTEN...</span></div>';return;}
 if(!state.user||state.authMode==='newpass'){
  mount.innerHTML=authView(state.authMode,state.authError,state.authBusy);
  return;
 }
 let html='';
 if(state.view==='home')html=homeView(state.data,state.user);
 else if(state.view==='costs')html=costsView(state.data,state.costTab);
 else if(state.view==='team')html=teamView(state.data);
 else if(state.view==='finance')html=financeView(state.data,state.finMonth,state.finFilter);
 else if(state.view==='reports')html=reportsView(state.data,state.finMonth);
 else if(state.view==='company')html=companyView(state.data,state.quoteHours,state.quoteExtra);
 else if(state.view==='appearance')html=appearanceView(state.data.company);
 else if(state.view==='budgets')html=budgetsView(state.data);
 else if(state.view==='catalog')html=catalogView(state.data,state.catalogCategory,state.catalogBack,state.catalogImport,state.catalogSearch);
 else if(state.view==='budget-edit')html=budgetEditorView(state.data,state.budgetDraft,state.budgetError);
 else html=moreView(state.user,state.data);
 mount.innerHTML=shell(state.view,html);
}
async function loadForUser(user){
 state.cloudError=null;
 try{
  state.data=await fetchRemote(auth,user.id);
  try{safeSave(localStorage,user.id,state.data)}catch{/* cache é opcional */}
 }catch(err){
  state.cloudError=String(err.message||'Banco de dados indisponível');
  state.data=safeLoad(localStorage,user.id);
  delayToast('Não foi possível sincronizar. Consulte o banco antes de editar: '+state.cloudError);
 }
}
async function session(){
 if(!auth){
  state.checkedSession=true;state.user=null;
  state.authError='Supabase Auth não configurado. Nenhum dado foi apagado.';
  render();return;
 }
 try{
  const saved=await auth.auth.getSession();
  if(saved.error)throw Error(saved.error.message||'Falha ao verificar sessão');
  const result=saved.data?.session?await auth.auth.getUser():{data:{user:null},error:null};
  if(result.error)throw Error(result.error.message||'Falha de sessão');
  state.user=result.data?.user||null;
  if(state.user)await loadForUser(state.user);
  else state.data=fresh();
 }catch(err){
  state.user=null;
  state.authError='Não foi possível verificar seu acesso: '+(err.message||'falha na conexão');
 }finally{state.checkedSession=true;render();}
}
async function submitLogin(form){
 const fields=Object.fromEntries(new FormData(form));
 state.authBusy=true;state.authError='';render();
 try{
  if(!auth)throw Error('Supabase Auth não configurado.');
  if(state.authMode==='newpass'){
   const result=await auth.auth.updateUser({password:fields.password});
   if(result.error)throw Error(result.error.message||'Falha ao alterar a senha');
   history.replaceState(null,'',location.pathname);
   state.authMode='login';
   await auth.auth.signOut();
   state.user=null;state.data=fresh();
   delayToast('Senha atualizada. Entre novamente com sua nova senha.');
  }else if(state.authMode==='reset'){
   const result=await auth.auth.resetPasswordForEmail(fields.email.trim(),{
    redirectTo:location.origin+'/'});
   if(result.error)throw Error(authMessage(result.error,'reset'));
   state.authMode='login';
   state.authError='Se houver uma conta neste e-mail, você receberá instruções de recuperação. Confira também o spam.';
  }else{
   const creating=state.authMode==='signup';
   const email=fields.email.trim();
   const result=creating?
    await auth.auth.signUp({email,password:fields.password,
     options:{data:{name:fields.name},emailRedirectTo:location.origin+'/'}}):
    await auth.auth.signInWithPassword({email,password:fields.password});
   if(result.error){
    // Quando o Supabase informa conta existente (Confirm Email desligado),
    // voltar ao login e permitir a recuperação da senha imediatamente.
    if(creating&&['user_already_exists','user_already_registered','email_exists']
       .includes(String(result.error.code||'').toLowerCase())){
     state.authMode='login';
    }
    throw Error(authMessage(result.error,creating?'signup':'login'));
   }
   if(creating){
    const outcome=signupOutcome(result);
    if(outcome==='repeated'){
     // O Supabase pode responder HTTP 200 para um cadastro repetido;
     // nenhuma identidade nova foi criada. Não declarar sucesso.
     state.authMode='login';
     state.authError=repeatedSignupMessage;
    }else if(outcome==='confirmation'){
     // Sem sessão: a pessoa precisa confirmar o e-mail antes de entrar.
     state.authMode='login';
     state.authError=pendingEmailMessage;
    }else if(outcome==='no-user'){
     throw Error('Não foi possível confirmar o cadastro. Tente novamente.');
    }else{
     const check=await auth.auth.getUser();
     if(check.error)throw Error(authMessage(check.error,'login'));
     const user=check.data?.user||null;
     if(!user)throw Error('A sessão não foi confirmada. Entre novamente.');
     state.user=user;await loadForUser(user);state.view='home';state.authMode='login';
     delayToast('Bem-vindo ao CIVOLTEN!');
    }
   }else{
    const check=await auth.auth.getUser();
    if(check.error)throw Error(authMessage(check.error,'login'));
    const user=check.data?.user||null;
    if(!user)throw Error('Não foi possível confirmar sua sessão. Tente entrar novamente.');
    state.user=user;await loadForUser(user);state.view='home';state.authMode='login';
    delayToast('Bem-vindo ao CIVOLTEN!');
   }
  }
 }catch(err){state.authError=String(err.message||'Falha de autenticação.');}
 finally{state.authBusy=false;render();}
}
async function signOut(){
 if(!auth)return;
 state.busy=true;delayToast('Saindo da sua conta...');
 try{
  const r=await auth.auth.signOut();if(r?.error)throw Error(r.error.message||'Falha ao sair');
  state.user=null;state.data=fresh();state.cloudError=null;state.budgetDraft=null;state.budgetError='';state.view='home';state.authMode='login';
  state.authError='';render();delayToast('Sessão encerrada. Seus dados locais foram preservados.');
 }catch(err){delayToast(err.message||'Não foi possível sair.');}
 finally{state.busy=false;}
}
function go(view){
 if(view==='soon'){delayToast('Este recurso será construído na próxima etapa.');return;}
 if(!['home','costs','team','more','finance','reports','company','appearance','budgets','budget-edit','catalog'].includes(view))return;
 if(view==='catalog')state.catalogBack=state.view==='budget-edit'?'budget-edit':'budgets';
 if(view==='budgets'){state.budgetDraft=null;state.budgetError='';}
 state.view=view;render();
 if(window.scrollY)window.scrollTo({top:0,behavior:'instant'});
}
function openEditor(kind,id=null,suggested='income'){
 if(!['fixed','variable','employees','payroll','ledger'].includes(kind))return;
 if(state.cloudError){delayToast('Banco indisponível: não é seguro editar antes de sincronizar.');return;}
 if(kind==='payroll'){
  state.editor={kind:'payroll'};
  modal.innerHTML=payrollSettingsView(state.data.payroll);
  modal.showModal();
  return;
 }
 const person=state.data[kind]?.find(x=>x.id===id)||{};
 state.editor={kind,id};
 modal.innerHTML=kind==='ledger'?ledgerEditorView(person,suggested):editorView(kind,person,state.data.payroll);
 modal.showModal();
 if(kind!=='ledger'){toggleContractFields();refreshCltPreview();refreshVariableCostPreview();}
}
function closeEditor(){
 modal.close();modal.innerHTML='';state.editor=null;
}
function refreshCltPreview(){
 const form=modal.querySelector('#record-form'),area=modal.querySelector('#clt-preview');
 if(!form||!area)return;
 const fields=Object.fromEntries(new FormData(form));
 area.innerHTML=cltBreakdownHtml({salary:fields.salary,
  benefits:fields.benefits,extras:fields.extras},state.data.payroll);
}
function refreshVariableCostPreview(){
 const form=modal.querySelector('#record-form'),area=modal.querySelector('#variable-cost-preview');
 if(!form||!area)return;
 const item=Object.fromEntries(new FormData(form)),value=variableMonthly(item);
 const quantity=variableQuantity(item);
 if(value===null){
  area.textContent='Informe um preço para calcular o total mensal.';
  return;
 }
 area.textContent='Total variável no mês: '+brl(value)+
  (item.monthQty===''&&quantity===1?' (1 unidade/mês como padrão)':'');
}
async function savePayrollSettings(form){
 if(!state.user||state.cloudError)return;
 const btn=form.querySelector('[type="submit"]');
 if(btn)btn.disabled=true;
 try{
  const fields=Object.fromEntries(new FormData(form));
  const rules=validatePayroll(fields);
  await putPayrollRemote(auth,state.user.id,rules);
  state.data={...state.data,payroll:rules};
  try{safeSave(localStorage,state.user.id,state.data)}catch{/* cache opcional */}
  closeEditor();render();
  delayToast('Encargos da empresa atualizados. Custos CLT recalculados.');
 }catch(err){
  const node=form.querySelector('#form-error');
  if(node){node.textContent=String(err.message||'Falha ao salvar');node.hidden=false;}
 }finally{if(btn)btn.disabled=false;}
}
async function saveCompanySettings(form){
 if(!state.user||state.cloudError||state.busy){delayToast('Não é possível salvar sem sincronizar o banco.');return;}
 const button=form.querySelector('[type="submit"]');
 if(button)button.disabled=true;
 try{
  const input=Object.fromEntries(new FormData(form));
  const next=validateCompany(input,state.data.company);
  await putCompanyRemote(auth,state.user.id,next);
  state.data={...state.data,company:next};
  try{safeSave(localStorage,state.user.id,state.data)}catch{/* cache opcional */}
  render();delayToast('Empresa, tributos, margem e capacidade salvos no Supabase.');
 }catch(err){
  const node=form.querySelector('#company-error');
  if(node){node.textContent=String(err.message||err);node.hidden=false;}
 }finally{if(button)button.disabled=false;}
}
async function chooseTheme(theme){
 if(!THEMES.includes(theme)||!state.user||state.cloudError||state.busy)return;
 if(state.data.company?.theme===theme)return;
 state.busy=true;
 try{
  const next={...state.data.company,theme};
  await putCompanyRemote(auth,state.user.id,next);
  state.data={...state.data,company:next};
  try{safeSave(localStorage,state.user.id,state.data)}catch{/* cache opcional */}
  render();delayToast('Cores do aplicativo atualizadas.');
 }catch(err){delayToast('Falha ao salvar tema: '+String(err.message||err));}
 finally{state.busy=false;}
}
function refreshPricingPreview(){
 const area=mount.querySelector('#pricing-preview');
 if(area)area.innerHTML=pricingPreview(state.data,state.quoteHours,state.quoteExtra);
}
function toggleContractFields(){
 const form=modal.querySelector('#record-form');
 if(!form)return;
 const type=form.elements.contractType?.value||'clt';
 for(const wrap of form.querySelectorAll('[data-contract]'))
  wrap.hidden=wrap.dataset.contract!==type;
}
async function importCostPresets(){
 if(!state.user||state.cloudError||state.busy){
  delayToast('Entre na conta com o banco sincronizado para salvar os custos.');
  return;
 }
 const prepared=prepareCostPresets(state.data,()=>crypto.randomUUID());
 const count=prepared.fixed.length+prepared.variable.length;
 if(!count){delayToast('Todos os modelos já estão cadastrados.');return;}
 const button=mount.querySelector('[data-action="import-cost-presets"]');
 if(button){button.disabled=true;button.textContent='Salvando custos no Supabase...';}
 state.busy=true;
 try{
  await putCostPresetsRemote(auth,state.user.id,'fixed',prepared.fixed);
  await putCostPresetsRemote(auth,state.user.id,'variable',prepared.variable);
  // Confirma o conteúdo persistido; preserva os outros cadastros e orçamentos.
  state.data=await fetchRemote(auth,state.user.id);
  try{safeSave(localStorage,state.user.id,state.data)}catch{/* cache opcional */}
  render();
  delayToast(count+' custos sugeridos salvos. Edite os valores reais e exclua o que não utilizar.');
 }catch(err){
  // Uma das duas importações pode ter sido confirmada no banco. A nova leitura
  // preserva o que já foi salvo e permite retentar apenas o que faltou.
  try{
   state.data=await fetchRemote(auth,state.user.id);
   safeSave(localStorage,state.user.id,state.data);
  }catch(fetchError){
   state.cloudError=String(fetchError.message||fetchError);
  }
  render();
  delayToast('Importação parcial ou indisponível: '+String(err.message||err));
 }finally{
  state.busy=false;
  if(button?.isConnected)button.disabled=false;
 }
}
async function saveRecord(form){
 if(!state.editor||!state.user)return;
 const {kind,id}=state.editor,input=Object.fromEntries(new FormData(form));
 if(kind==='employees'&&input.contractType==='contractor')input.hours=input.contractHours;
 const submit=form.querySelector('[type=submit]');
 if(submit)submit.disabled=true;
 try{
  const nextRecord=kind==='ledger'?validateEntry(input):validate(kind,input);
  nextRecord.id=id||crypto.randomUUID();
  await putRemote(auth,state.user.id,kind,nextRecord);
  const copy=structuredClone(state.data);
  const ix=copy[kind].findIndex(item=>item.id===id);
  if(ix>=0)copy[kind][ix]=nextRecord;else copy[kind].push(nextRecord);
  state.data=copy;
  try{safeSave(localStorage,state.user.id,copy)}catch{/* cache opcional */}
  closeEditor();render();delayToast('Salvo no Supabase com sucesso.');
 }catch(err){
  const node=form.querySelector('#form-error');
  node.textContent=err.message||'Confira os campos.';node.hidden=false;
 }finally{if(submit)submit.disabled=false;}
}
async function removeRecord(){
 if(!state.editor||!state.user)return;
 const {kind,id}=state.editor,item=state.data[kind].find(x=>x.id===id);
 if(!item)return;
 if(!confirm('Excluir "'+(item.title||item.name)+'"? Esta ação não pode ser desfeita.'))return;
 try{
  await deleteRemote(auth,state.user.id,kind,id);
  const copy=structuredClone(state.data);
  copy[kind]=copy[kind].filter(x=>x.id!==id);
  state.data=copy;
  try{safeSave(localStorage,state.user.id,copy)}catch{/* cache opcional */}
  closeEditor();render();delayToast('Excluído do Supabase.');
 }catch(err){delayToast('Não foi possível excluir: '+err.message);}
}
async function markPaid(id){
 if(state.busy||state.cloudError||!state.user)return;
 const item=state.data.ledger.find(x=>x.id===id);
 if(!item||item.paidDate)return;
 if(!confirm('Confirmar '+(item.kind==='income'?'recebimento':'pagamento')+' de '+item.title+' na data de hoje?'))return;
 state.busy=true;
 try{
  const next={...item,paidDate:localToday()};
  await putRemote(auth,state.user.id,'ledger',next);
  state.data={...state.data,ledger:state.data.ledger.map(e=>e.id===id?next:e)};
  try{safeSave(localStorage,state.user.id,state.data)}catch{/* cache opcional */}
  render();delayToast('Baixa financeira registrada no Supabase.');
 }catch(err){delayToast('Falha ao registrar baixa: '+String(err.message||err));}
 finally{state.busy=false;}
}

function newBudget(){
 if(state.cloudError){delayToast('Banco indisponível: não será criado rascunho offline.');return;}
 state.budgetDraft={id:null,title:'Proposta CIVOLTEN',customer:'',
  project:'',location:'',expiresOn:'',notes:'',items:[],
  commercial:{schedule:{goal:'crew',startDate:localToday(),pricingMode:'hours'}},
  pricing:createPricingSnapshot(state.data),status:'draft',demo:false,createdAt:null};
 state.budgetError='';go('budget-edit');
}
function openBudget(id){
 const found=state.data.budgets.find(x=>x.id===id);
 if(!found)return;
 state.budgetDraft=structuredClone(found);state.budgetError='';go('budget-edit');
}
function updateBudgetField(element){
 const draft=state.budgetDraft;
 if(!draft||state.view!=='budget-edit')return false;
 const scheduleKey=element.dataset.scheduleField;
 if(scheduleKey){
  draft.commercial={...(draft.commercial||{}),
   schedule:{...(draft.commercial?.schedule||{}),[scheduleKey]:element.value}};
  if(scheduleKey==='goal'||scheduleKey==='pricingMode'){render();return true;}
  const timeline=mount.querySelector('#budget-schedule-preview');
  if(timeline)timeline.innerHTML=budgetSchedulePreview(state.data,draft);
  const price=mount.querySelector('#budget-price-preview');
  if(price)price.innerHTML=budgetPreview(draft);
  let ready=false;try{ready=!!priceBudget(draft)}catch{/* formulário incompleto */}
  for(const btn of mount.querySelectorAll('[data-action="budget-print"],[data-action="budget-export"]'))
   btn.disabled=!ready;
  return true;
 }
 const key=element.dataset.budgetField;
 if(!key)return false;
 const container=element.closest('[data-budget-item]');
 if(container){
  const item=draft.items.find(x=>x.id===container.dataset.budgetItem);
  if(item&&['description','unit','quantity','laborHours','directCost'].includes(key))
   item[key]=element.value;
 }else if(['paymentTerms','executionTerm','warrantyTerms','scopeNotes','companyContact','companyDocument'].includes(key)){
  draft.commercial={...(draft.commercial||{}),[key]:element.value};
 }else if(['title','customer','project','location','expiresOn','notes'].includes(key))
  draft[key]=element.value;
 const node=mount.querySelector('#budget-price-preview');
 if(node)node.innerHTML=budgetPreview(draft);
 return true;
}
function openBudgetService(service,editing=false){
 if(!state.budgetDraft)return;
 state.editor={kind:'budget-service',id:editing?service.id:null,service:structuredClone(service)};
 modal.innerHTML=budgetServiceDialog(service,editing);
 modal.showModal();
 modal.querySelector('[name="description"]')?.focus();
}
function openCatalogItem(code){
 const template=catalogByCode(state.data.catalog,code);
 if(!template)return;
 const record=template;
 state.editor={kind:'catalog',code};
 modal.innerHTML=catalogEditorDialog(record);
 modal.showModal();
}
async function saveCatalogItem(form){
 if(state.editor?.kind!=='catalog'||!state.user||state.cloudError||state.busy)return;
 const error=form.querySelector('#catalog-form-error');
 const submit=form.querySelector('[type="submit"]');
 try{
  const base=catalogByCode(state.data.catalog,state.editor.code);
  const previous=(state.data.catalog||[]).find(x=>x.code===state.editor.code);
  const value=validateCatalogRecord(Object.fromEntries(new FormData(form)),base,previous?.id);
  value.id=value.id||crypto.randomUUID();
  state.busy=true;if(submit)submit.disabled=true;
  await putRemote(auth,state.user.id,'catalog',value);
  const copy=structuredClone(state.data);
  copy.catalog=[...(copy.catalog||[]).filter(x=>x.code!==value.code),value];
  state.data=copy;
  try{safeSave(localStorage,state.user.id,copy)}catch{/* cache opcional */}
  closeEditor();render();delayToast('Serviço e produtividade salvos no Supabase.');
 }catch(err){
  if(error){error.textContent=String(err.message||err);error.hidden=false;}
  else delayToast(String(err.message||err));
 }finally{state.busy=false;if(submit?.isConnected)submit.disabled=false;}
}
function bestHeader(rows){
 let best=0,score=0;
 for(let i=0;i<Math.min(rows.length,25);i++){
  const row=(rows[i]||[]).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const value=Number(/cod|codigo/.test(row))+Number(/descri|servico/.test(row))+Number(/unidade|unid/.test(row));
  if(value>score){best=i;score=value;}
 }
 return best;
}
async function loadCatalogImportFile(file){
 if(!file||!state.user||state.cloudError||state.busy)return;
 try{
  const sheets=await readCatalogFile(file);
  const selectedSheet=Math.max(0,sheets.findIndex(x=>x.rows.length>2));
  const headerIndex=bestHeader(sheets[selectedSheet].rows);
  state.catalogImport={fileName:file.name,sheets,selectedSheet,headerIndex,
   mapping:suggestColumns(sheets[selectedSheet].rows,headerIndex),
   source:state.catalogImport?.source||'siurb',month:state.catalogImport?.month||''};
  render();delayToast('Planilha aberta. Confira aba, colunas e competencia antes de importar.');
 }catch(err){delayToast('Erro ao abrir planilha: '+String(err.message||err));}
}
async function saveCatalogImport(){
 if(!state.user||state.cloudError||state.busy||!state.catalogImport){
  delayToast('Carregue a planilha com a conta sincronizada.');return;
 }
 const cfg=state.catalogImport;
 try{
  const sheet=cfg.sheets[cfg.selectedSheet];
  const result=buildCatalogImport(sheet.rows,{source:cfg.source,month:cfg.month,
   headerIndex:cfg.headerIndex,mapping:cfg.mapping,existing:state.data.catalog});
  if(result.items.length>20000)throw Error('Maximo de 20 mil servicos por importacao.');
  state.busy=true;
  const btn=mount.querySelector('[data-action="catalog-import-save"]');
  if(btn){btn.disabled=true;btn.textContent='Gravando servicos no Supabase...';}
  for(let i=0;i<result.items.length;i+=100){
   const part=result.items.slice(i,i+100).map(x=>({...x,id:x.id||crypto.randomUUID()}));
   await putCatalogBatchRemote(auth,state.user.id,part);
  }
  state.data=await fetchRemote(auth,state.user.id);
  try{safeSave(localStorage,state.user.id,state.data)}catch{}
  state.catalogImport=null;state.catalogCategory='all';render();
  delayToast(result.items.length+' servicos importados. '+result.loadedLabor+
    ' coeficientes HH lidos; '+result.skipped+' linhas ignoradas.');
 }catch(err){
  try{state.data=await fetchRemote(auth,state.user.id);
   safeSave(localStorage,state.user.id,state.data);}catch(loadErr){
    state.cloudError=String(loadErr.message||loadErr);
  }
  render();
  delayToast('Importacao interrompida: '+String(err.message||err));
 }finally{state.busy=false;}
}
function addBudgetItem(){
 if(!state.budgetDraft)return;
 if(state.budgetDraft.items.length>=100){delayToast('Maximo de 100 servicos por orcamento.');return;}
 const code=mount.querySelector('#budget-catalog')?.value;
 try{
  const id=crypto.randomUUID();
  if(!code||code==='manual'){openBudgetService(createService('manual',id));return;}
  const record=catalogByCode(state.data.catalog,code);
  if(!record)throw Error('Importe esse servico novamente no catalogo.');
  openBudgetService(catalogToBudgetItem(record,id));
 }catch(err){delayToast(String(err.message||err));}
}
function editBudgetItem(id){
 const service=state.budgetDraft?.items.find(item=>item.id===id);
 if(service)openBudgetService(service,true);
}
function saveBudgetService(form){
 if(state.editor?.kind!=='budget-service'||!state.budgetDraft)return;
 if(!form.reportValidity())return;
 const errorNode=form.querySelector('#budget-service-error');
 try{
  const input=Object.fromEntries(new FormData(form));
  const service=validateBudgetItem({...state.editor.service,...input});
  const index=state.budgetDraft.items.findIndex(item=>item.id===service.id);
  if(state.editor.id){
   if(index<0)throw Error('Serviço não encontrado no orçamento.');
   state.budgetDraft.items[index]=service;
  }else{
   if(index>=0)throw Error('Identificador de serviço duplicado.');
   if(state.budgetDraft.items.length>=100)throw Error('Máximo de 100 serviços por orçamento.');
   state.budgetDraft.items.push(service);
  }
  closeEditor();state.budgetError='';render();
  mount.querySelectorAll('[data-budget-item]').forEach(card=>{
   if(card.dataset.budgetItem===service.id)card.scrollIntoView({block:'center',behavior:'instant'});
  });
 }catch(err){
  if(errorNode){errorNode.textContent=String(err.message||err);errorNode.hidden=false;}
 }
}
function removeBudgetItem(id){
 if(!state.budgetDraft)return;
 state.budgetDraft.items=state.budgetDraft.items.filter(x=>x.id!==id);
 state.budgetError='';render();
}
function regularizeBudget(){
 const draft=state.budgetDraft;
 if(!draft||draft.demo===false&&!draft.items.some(item=>item.source==='demo'))return;
 if(!confirm('Os serviços e valores deste orçamento anterior precisam de revisão. Para uso comercial, confira cada item, informe as horas de trabalho e os custos reais e atualize a base de precificação. Continuar?'))return;
 draft.items=draft.items.map(item=>item.source==='demo'?{
  ...item,source:'manual',sourceCode:'',
  description:String(item.description||'').replace(/\s*\(exemplo\)\s*$/i,'').trim(),
  laborHours:'',directCost:''
 }:item);
 draft.demo=false;
 draft.pricing=null;
 state.budgetError='';
 render();
 delayToast('Revise cada serviço, preencha os custos e atualize a precificação antes de salvar ou emitir a proposta.');
}
function refreshBudgetPricing(){
 if(!state.budgetDraft)return;
 const base=createPricingSnapshot(state.data);
 if(!base){state.budgetError='Complete os custos e a configuração da empresa antes de atualizar o preço.';render();return;}
 state.budgetDraft.pricing=base;state.budgetError='';render();
 delayToast('Base de custo atualizada neste rascunho. Salve para confirmar.');
}
async function saveBudget(form){
 if(!state.user||!state.budgetDraft||state.busy||state.cloudError)return;
 const button=form.querySelector('[type=submit]');
 if(button)button.disabled=true;state.busy=true;
 try{
  const f=Object.fromEntries(new FormData(form));
  const draft={...state.budgetDraft};
  for(const key of ['title','customer','project','location','notes','expiresOn'])
   if(key in f)draft[key]=f[key];
  draft.commercial={...(draft.commercial||{})};
  for(const key of ['paymentTerms','executionTerm','warrantyTerms','scopeNotes','companyContact','companyDocument'])
   if(key in f)draft.commercial[key]=f[key];
  draft.pricing=draft.pricing||createPricingSnapshot(state.data);
  const valid=validateBudget(draft);
  valid.id=state.budgetDraft.id||crypto.randomUUID();
  valid.createdAt=state.budgetDraft.createdAt||new Date().toISOString();
  await putRemote(auth,state.user.id,'budgets',valid);
  const copy=structuredClone(state.data);
  const index=copy.budgets.findIndex(x=>x.id===valid.id);
  if(index>=0)copy.budgets[index]=valid;else copy.budgets.push(valid);
  state.data=copy;
  try{safeSave(localStorage,state.user.id,copy)}catch{/* cache opcional */}
  state.budgetDraft=null;state.budgetError='';go('budgets');
  delayToast('Orçamento CIVOLTEN salvo no Supabase.');
 }catch(err){
  state.budgetError=String(err.message||err);render();
 }finally{state.busy=false;if(button)button.disabled=false;}
}
async function removeBudget(){
 const item=state.budgetDraft;
 if(!item?.id||!state.user||state.busy||state.cloudError)return;
 if(!confirm('Excluir o orçamento "'+item.title+'"? A ação é irreversível.'))return;
 state.busy=true;
 try{
  await deleteRemote(auth,state.user.id,'budgets',item.id);
  const copy=structuredClone(state.data);
  copy.budgets=copy.budgets.filter(x=>x.id!==item.id);
  state.data=copy;
  try{safeSave(localStorage,state.user.id,copy)}catch{/* cache opcional */}
  state.budgetDraft=null;go('budgets');delayToast('Orçamento excluído.');
 }catch(err){delayToast('Falha ao excluir orçamento: '+String(err.message||err));}
 finally{state.busy=false;}
}
function applyScheduleTerm(){
 if(!state.budgetDraft)return;
 let plan;try{plan=getBudgetSchedule(state.data,state.budgetDraft)}catch(err){
  delayToast(String(err.message||err));return;
 }
 const term=suggestExecutionTerm(plan);
 if(!term){delayToast('Adicione serviços e defina um cronograma antes de aplicar o prazo.');return;}
 const existing=state.budgetDraft.commercial?.executionTerm||'';
 if(existing.trim()&&existing.trim()!==term&&!confirm('Substituir o prazo comercial atual pelo prazo estimado do cronograma?'))return;
 state.budgetDraft.commercial={...state.budgetDraft.commercial,executionTerm:term};
 render();delayToast('Prazo estimado aplicado à proposta. Salve o orçamento para confirmar.');
}
function exportSchedule(){
 if(!state.budgetDraft)return;
 try{
  const plan=getBudgetSchedule(state.data,state.budgetDraft);
  if(!plan?.days||!plan.totalHours)throw Error('Adicione serviços com horas antes de exportar o cronograma.');
  const blob=new Blob([scheduleCsv(plan)],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='civolten-cronograma-preliminar.csv';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(err){delayToast(String(err.message||err));}
}
function exportBudget(){
 if(!state.budgetDraft)return;
 try{
  const csv=budgetCsv(state.budgetDraft),blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='civolten-orcamento.csv';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(err){delayToast(String(err.message||err));}
}
async function printBudget(){
 try{
  if(!state.budgetDraft||!priceBudget(state.budgetDraft))
   throw Error('Configure e calcule os valores antes de gerar o PDF.');
  render();
  if(!mount.querySelector('.budget-pdf-v5 .proposal-page'))
   throw Error('Proposta Signature indisponível. Atualize o aplicativo e tente novamente.');
  // A arte enviada para o GitHub deve estar decodificada ANTES da prévia Android.
  // Caso contrário o Chrome pode gerar a página sem o fundo fotográfico.
  const cover=mount.querySelector('.proposal-cover-background');
  if(!cover)throw Error('Imagem de fundo da proposta não encontrada.');
  if((!cover.complete||!cover.naturalWidth)&&typeof cover.decode==='function')
   await cover.decode();
  if(!cover.naturalWidth)
   throw Error('Não foi possível carregar a imagem da capa. Verifique a conexão e tente novamente.');
  window.print();
 }catch(err){delayToast(String(err.message||err));}
}

function exportReport(){
 const csv=reportCsv(state.data,state.finMonth);
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 link.href=url;link.download='civolten-relatorio-'+state.finMonth+'.csv';
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
mount.addEventListener('change',event=>{
 if(event.target.id==='catalog-category'){state.catalogCategory=event.target.value;render();return;}
 if(event.target.id==='catalog-import-file'){void loadCatalogImportFile(event.target.files?.[0]);return;}
 if(state.catalogImport){
  const cfg=state.catalogImport,id=event.target.id;
  if(id==='catalog-import-source'){cfg.source=event.target.value;return;}
  if(id==='catalog-import-month'){cfg.month=event.target.value;return;}
  if(id==='catalog-import-sheet'){
   cfg.selectedSheet=Number(event.target.value);
   cfg.headerIndex=bestHeader(cfg.sheets[cfg.selectedSheet].rows);
   cfg.mapping=suggestColumns(cfg.sheets[cfg.selectedSheet].rows,cfg.headerIndex);
   render();return;
  }
  if(id==='catalog-import-header'){
   cfg.headerIndex=Math.max(0,Number(event.target.value)-1);
   cfg.mapping=suggestColumns(cfg.sheets[cfg.selectedSheet].rows,cfg.headerIndex);
   render();return;
  }
  if(event.target.dataset.catalogMap){
   cfg.mapping[event.target.dataset.catalogMap]=Number(event.target.value);return;
  }
 }
 if(event.target.matches('[data-period]')&&/^\d{4}-\d{2}$/.test(event.target.value)){
  state.finMonth=event.target.value;render();
 }
});
mount.addEventListener('click',async event=>{
 const b=event.target.closest('[data-go],[data-action],[data-tab],[data-fin-filter],[data-theme-choice]');
 if(!b)return;
 if(b.dataset.go){go(b.dataset.go);return;}
 if(b.dataset.tab){state.costTab=b.dataset.tab;render();return;}
 if(b.dataset.finFilter){state.finFilter=b.dataset.finFilter;render();return;}
 if(b.dataset.themeChoice){await chooseTheme(b.dataset.themeChoice);return;}
 const action=b.dataset.action;
 if(action==='auth-mode'){
  state.authMode=b.dataset.mode;state.authError='';render();
 }else if(action==='toggle-password'){
  const i=mount.querySelector('#password');if(i){
   i.type=i.type==='password'?'text':'password';
   b.innerHTML=icon(i.type==='text'?'eye-off':'eye',22);
  }
 }else if(action==='notifications'){
  delayToast(summary(state.data).missing?
   'Você tem cadastros pendentes. Confira custos e funcionários.':'Nenhuma pendência no momento.');
 }else if(action==='month-info'){
  delayToast('Exibindo os valores mensais cadastrados. Histórico por mês virá depois.');
 }else if(action==='soon'){delayToast('Esta função será construída após aprovarmos a base.');}
 else if(action==='budget-new'){newBudget();}
 else if(action==='budget-open'){openBudget(b.dataset.id);}
 else if(action==='budget-add-item'){addBudgetItem();}
 else if(action==='catalog-edit'){openCatalogItem(b.dataset.code);}
 else if(action==='catalog-import-save'){await saveCatalogImport();}
 else if(action==='budget-edit-item'){editBudgetItem(b.dataset.id);}
 else if(action==='budget-remove-item'){removeBudgetItem(b.dataset.id);}
 else if(action==='budget-regularize'){regularizeBudget();}
 else if(action==='budget-refresh-pricing'){refreshBudgetPricing();}
 else if(action==='budget-schedule-term'){applyScheduleTerm();}
 else if(action==='budget-schedule-export'){exportSchedule();}
 else if(action==='budget-export'){exportBudget();}
 else if(action==='budget-print'){await printBudget();}
 else if(action==='budget-delete'){await removeBudget();}
 else if(action==='new-income'){openEditor('ledger',null,'income');}
 else if(action==='new-expense'){openEditor('ledger',null,'expense');}
 else if(action==='mark-paid'){await markPaid(b.dataset.id);}
 else if(action==='export-csv'){exportReport();}
 else if(action==='print-report'){window.print();}
 else if(action==='import-cost-presets'){await importCostPresets();}
 else if(action==='new-cost'){openEditor(state.costTab);}
 else if(action==='new-employee'){openEditor('employees');}
 else if(action==='payroll-settings'){openEditor('payroll');}
 else if(action==='edit'){openEditor(b.dataset.kind,b.dataset.id);}
 else if(action==='signout'){await signOut();}
 else if(action==='search-people'){
  const box=mount.querySelector('#team-search');
  box.hidden=!box.hidden;
  if(!box.hidden)box.querySelector('input')?.focus();
 }
});
mount.addEventListener('input',event=>{
 if(event.target.id==='catalog-search'){
  state.catalogSearch=event.target.value;
  const cursor=event.target.selectionStart??state.catalogSearch.length;
  render();
  const input=mount.querySelector('#catalog-search');
  input?.focus();
  if(input?.setSelectionRange)input.setSelectionRange(cursor,cursor);
  return;
 }
 if(event.target.id==='cost-search'){
  const query=event.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  mount.querySelectorAll('.cost-row[data-cost-search]').forEach(row=>{
   row.hidden=!!query&&!row.dataset.costSearch.includes(query);
  });
  return;
 }
 if(updateBudgetField(event.target))return;
 if(event.target.matches('[data-pricing-input]')){
  if(event.target.name==='quoteHours')state.quoteHours=event.target.value;
  if(event.target.name==='quoteExtra')state.quoteExtra=event.target.value;
  refreshPricingPreview();return;
 }
 if(event.target.id!=='search-people')return;
 const query=event.target.value.toLowerCase().trim();
 mount.querySelectorAll('[data-search-name]').forEach(card=>{
  card.hidden=!!query&&!card.dataset.searchName.includes(query);
 });
});
mount.addEventListener('submit',event=>{
 if(event.target.id==='budget-form'){event.preventDefault();void saveBudget(event.target);return;}
 if(event.target.id==='company-form'){event.preventDefault();void saveCompanySettings(event.target);return;}
 if(event.target.id!=='auth-form')return;
 event.preventDefault();submitLogin(event.target);
});
modal.addEventListener('click',event=>{
 const b=event.target.closest('[data-action]');if(!b)return;
 const action=b.dataset.action;
 if(action==='close-modal')closeEditor();
 if(action==='delete-record')void removeRecord();
});
modal.addEventListener('change',event=>{
 if(event.target.name==='contractType'){toggleContractFields();refreshCltPreview();}
 if(event.target.name==='unit'&&event.target.form?.id==='record-form')refreshVariableCostPreview();
 if(event.target.name==='regime'&&event.target.form?.id==='payroll-form'){
  const p=payrollPreset(event.target.value);
  for(const key of ['fgtsPct','employerPct','ratPct','terceirosPct'])
   event.target.form.elements[key].value=p[key];
 }
});
modal.addEventListener('input',event=>{
 if(['salary','benefits','extras'].includes(event.target.name))refreshCltPreview();
 if(['unitCost','monthQty'].includes(event.target.name))refreshVariableCostPreview();
});
modal.addEventListener('submit',event=>{
 if(event.target.id==='catalog-form'){event.preventDefault();void saveCatalogItem(event.target);return;}
 if(event.target.id==='budget-service-form'){
  event.preventDefault();saveBudgetService(event.target);return;
 }
 if(event.target.id==='payroll-form'){
  event.preventDefault();void savePayrollSettings(event.target);return;
 }
 if(event.target.id!=='record-form')return;
 event.preventDefault();void saveRecord(event.target);
});
modal.addEventListener('click',event=>{if(event.target===modal)closeEditor();});
modal.addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
if('serviceWorker' in navigator&&!E2E)
 window.addEventListener('load',()=>{
  const previouslyControlled=Boolean(navigator.serviceWorker.controller);
  // Não interrompe formulários nem edições: o usuário decide quando recarregar.
  if(previouslyControlled)navigator.serviceWorker.addEventListener('controllerchange',()=>{
   if(document.querySelector('#civolten-update-prompt'))return;
   const bar=document.createElement('div');
   bar.id='civolten-update-prompt';
   bar.innerHTML='<span>Nova versão disponível, incluindo o PDF comercial.</span>'+
    '<button type="button">Atualizar aplicativo</button>';
   bar.querySelector('button').addEventListener('click',()=>{
    if(state.view==='budget-edit'&&!confirm('Atualizar agora? Edições ainda não salvas podem ser perdidas.'))return;
    location.reload();
   });
   document.body.appendChild(bar);
  });
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{
   window.addEventListener('focus',()=>reg.update().catch(()=>{}));
  }).catch(()=>{});
 });
if(auth?.auth?.onAuthStateChange){
 auth.auth.onAuthStateChange((event)=>{
  if(event==='PASSWORD_RECOVERY'){
   state.checkedSession=true;state.authMode='newpass';render();
  }
 });
}
render();
session();
window.CIVOLTENPreview={get view(){return state.view},get data(){return structuredClone(state.data)},
 get user(){return state.user},go,openEditor,summary:()=>summary(state.data),
 get company(){return structuredClone(state.data.company)},
 get budgets(){return structuredClone(state.data.budgets)}};
