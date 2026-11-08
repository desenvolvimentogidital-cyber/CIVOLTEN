import {createClient} from '@supabase/supabase-js';
import {fetchRemote,putRemote,deleteRemote,putPayrollRemote,putCompanyRemote} from './cloud.mjs';
import {payrollPreset,validatePayroll} from './payroll.mjs';
import {createE2EClient} from './e2e-client.mjs';
import {signupOutcome,authMessage,repeatedSignupMessage,pendingEmailMessage} from './auth-flow.mjs';
import {fresh,safeLoad,safeSave,validate,summary,employeeCost} from './calc.mjs';
import {validateCompany,THEMES} from './pricing.mjs';
import {companyView,appearanceView,pricingPreview} from './settings-ui.mjs';
import {validateEntry,reportCsv,localToday,currentMonth} from './finance.mjs';
import {financeView,reportsView,ledgerEditorView} from './finance-ui.mjs';
import {createService,createPricingSnapshot,validateBudget,budgetCsv,priceBudget} from './budget.mjs';
import {budgetsView,budgetEditorView,budgetPreview} from './budget-ui.mjs';
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
 cloudError:null,budgetDraft:null,budgetError:'',
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
 if(!['home','costs','team','more','finance','reports','company','appearance','budgets','budget-edit'].includes(view))return;
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
 if(kind!=='ledger'){toggleContractFields();refreshCltPreview();}
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
 state.budgetDraft={id:null,title:'Orçamento demonstrativo',customer:'',
  project:'',location:'',expiresOn:'',notes:'',items:[],
  pricing:createPricingSnapshot(state.data),status:'draft',demo:true,createdAt:null};
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
 const key=element.dataset.budgetField;
 if(!key)return false;
 const container=element.closest('[data-budget-item]');
 if(container){
  const item=draft.items.find(x=>x.id===container.dataset.budgetItem);
  if(item&&['description','unit','quantity','laborHours','directCost'].includes(key))
   item[key]=element.value;
 }else if(['title','customer','project','location','expiresOn','notes'].includes(key))
  draft[key]=element.value;
 const node=mount.querySelector('#budget-price-preview');
 if(node)node.innerHTML=budgetPreview(draft);
 return true;
}
function addBudgetItem(){
 if(!state.budgetDraft)return;
 if(state.budgetDraft.items.length>=100){delayToast('Máximo de 100 serviços por orçamento.');return;}
 const code=mount.querySelector('#budget-catalog')?.value;
 try{state.budgetDraft.items.push(createService(code,crypto.randomUUID()));
  state.budgetError='';render();}
 catch(err){delayToast(String(err.message||err));}
}
function removeBudgetItem(id){
 if(!state.budgetDraft)return;
 state.budgetDraft.items=state.budgetDraft.items.filter(x=>x.id!==id);
 state.budgetError='';render();
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
  delayToast('Orçamento de demonstração salvo no Supabase.');
 }catch(err){
  state.budgetError=String(err.message||err);render();
 }finally{state.busy=false;if(button)button.disabled=false;}
}
async function removeBudget(){
 const item=state.budgetDraft;
 if(!item?.id||!state.user||state.busy||state.cloudError)return;
 if(!confirm('Excluir o orçamento de demonstração "'+item.title+'"? A ação é irreversível.'))return;
 state.busy=true;
 try{
  await deleteRemote(auth,state.user.id,'budgets',item.id);
  const copy=structuredClone(state.data);
  copy.budgets=copy.budgets.filter(x=>x.id!==item.id);
  state.data=copy;
  try{safeSave(localStorage,state.user.id,copy)}catch{/* cache opcional */}
  state.budgetDraft=null;go('budgets');delayToast('Orçamento de teste excluído.');
 }catch(err){delayToast('Falha ao excluir orçamento: '+String(err.message||err));}
 finally{state.busy=false;}
}
function exportBudget(){
 if(!state.budgetDraft)return;
 try{
  const csv=budgetCsv(state.budgetDraft),blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='civolten-orcamento-demonstrativo.csv';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(err){delayToast(String(err.message||err));}
}
function printBudget(){
 try{
  if(!state.budgetDraft||!priceBudget(state.budgetDraft))
   throw Error('Configure e calcule os valores antes de gerar o PDF.');
  render();window.print();
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
 else if(action==='budget-remove-item'){removeBudgetItem(b.dataset.id);}
 else if(action==='budget-refresh-pricing'){refreshBudgetPricing();}
 else if(action==='budget-export'){exportBudget();}
 else if(action==='budget-print'){printBudget();}
 else if(action==='budget-delete'){await removeBudget();}
 else if(action==='new-income'){openEditor('ledger',null,'income');}
 else if(action==='new-expense'){openEditor('ledger',null,'expense');}
 else if(action==='mark-paid'){await markPaid(b.dataset.id);}
 else if(action==='export-csv'){exportReport();}
 else if(action==='print-report'){window.print();}
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
 if(event.target.name==='regime'&&event.target.form?.id==='payroll-form'){
  const p=payrollPreset(event.target.value);
  for(const key of ['fgtsPct','employerPct','ratPct','terceirosPct'])
   event.target.form.elements[key].value=p[key];
 }
});
modal.addEventListener('input',event=>{
 if(['salary','benefits','extras'].includes(event.target.name))refreshCltPreview();
});
modal.addEventListener('submit',event=>{
 if(event.target.id==='payroll-form'){
  event.preventDefault();void savePayrollSettings(event.target);return;
 }
 if(event.target.id!=='record-form')return;
 event.preventDefault();void saveRecord(event.target);
});
modal.addEventListener('click',event=>{if(event.target===modal)closeEditor();});
if('serviceWorker' in navigator&&!E2E)
 window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
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
