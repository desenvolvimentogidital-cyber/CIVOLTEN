import {createClient} from '@supabase/supabase-js';
import {fetchRemote,putRemote,deleteRemote} from './cloud.mjs';
import {createE2EClient} from './e2e-client.mjs';
import {signupOutcome,authMessage,repeatedSignupMessage,pendingEmailMessage} from './auth-flow.mjs';
import {fresh,safeLoad,safeSave,validate,summary,employeeCost} from './calc.mjs';
import {authView,shell,homeView,costsView,teamView,moreView,editorView,e,icon} from './views.mjs';
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
 user:null,data:fresh(),view:'home',costTab:'fixed',authMode:recoveryToken?'newpass':'login',
 cloudError:null,
 authBusy:false,authError:'',busy:false,editor:null,toastTimer:null,
 checkedSession:false
};
const delayToast=(text)=>{
 toastNode.textContent=text;toastNode.hidden=false;
 clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>{toastNode.hidden=true},4300);
};
function render(){
 if(!state.checkedSession){mount.innerHTML='<div class="loading-stage"><img src="/assets/civolten-simbolo.png" alt=""><span>Preparando CIVOLTEN...</span></div>';return;}
 if(!state.user||state.authMode==='newpass'){
  mount.innerHTML=authView(state.authMode,state.authError,state.authBusy);
  return;
 }
 let html='';
 if(state.view==='home')html=homeView(state.data,state.user);
 else if(state.view==='costs')html=costsView(state.data,state.costTab);
 else if(state.view==='team')html=teamView(state.data);
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
  state.user=null;state.data=fresh();state.cloudError=null;state.view='home';state.authMode='login';
  state.authError='';render();delayToast('Sessão encerrada. Seus dados locais foram preservados.');
 }catch(err){delayToast(err.message||'Não foi possível sair.');}
 finally{state.busy=false;}
}
function go(view){
 if(view==='soon'){delayToast('Este recurso será construído na próxima etapa.');return;}
 if(!['home','costs','team','more'].includes(view))return;
 state.view=view;render();
 if(window.scrollY)window.scrollTo({top:0,behavior:'instant'});
}
function openEditor(kind,id=null){
 if(!['fixed','variable','employees'].includes(kind))return;
 if(state.cloudError){delayToast('Banco indisponível: não é seguro editar antes de sincronizar.');return;}
 const person=state.data[kind]?.find(x=>x.id===id)||{};
 state.editor={kind,id};
 modal.innerHTML=editorView(kind,person);
 modal.showModal();
 toggleContractFields();
}
function closeEditor(){
 modal.close();modal.innerHTML='';state.editor=null;
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
  const nextRecord=validate(kind,input);
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
 if(!confirm('Excluir "'+item.name+'"? Esta ação não pode ser desfeita.'))return;
 try{
  await deleteRemote(auth,state.user.id,kind,id);
  const copy=structuredClone(state.data);
  copy[kind]=copy[kind].filter(x=>x.id!==id);
  state.data=copy;
  try{safeSave(localStorage,state.user.id,copy)}catch{/* cache opcional */}
  closeEditor();render();delayToast('Excluído do Supabase.');
 }catch(err){delayToast('Não foi possível excluir: '+err.message);}
}
mount.addEventListener('click',async event=>{
 const b=event.target.closest('[data-go],[data-action],[data-tab]');
 if(!b)return;
 if(b.dataset.go){go(b.dataset.go);return;}
 if(b.dataset.tab){state.costTab=b.dataset.tab;render();return;}
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
 else if(action==='new-cost'){openEditor(state.costTab);}
 else if(action==='new-employee'){openEditor('employees');}
 else if(action==='edit'){openEditor(b.dataset.kind,b.dataset.id);}
 else if(action==='signout'){await signOut();}
 else if(action==='search-people'){
  const box=mount.querySelector('#team-search');
  box.hidden=!box.hidden;
  if(!box.hidden)box.querySelector('input')?.focus();
 }
});
mount.addEventListener('input',event=>{
 if(event.target.id!=='search-people')return;
 const query=event.target.value.toLowerCase().trim();
 mount.querySelectorAll('[data-search-name]').forEach(card=>{
  card.hidden=!!query&&!card.dataset.searchName.includes(query);
 });
});
mount.addEventListener('submit',event=>{
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
 if(event.target.name==='contractType')toggleContractFields();
});
modal.addEventListener('submit',event=>{
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
 get user(){return state.user},go,openEditor,summary:()=>summary(state.data)};
