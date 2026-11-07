import {createAuthClient} from '@neon/auth';
import {fresh,safeLoad,safeSave,validate,summary,employeeCost} from './calc.mjs';
import {authView,shell,homeView,costsView,teamView,moreView,editorView,e,icon} from './views.mjs';
const BASE_URL=__CIVOLTEN_AUTH_URL__;
const E2E=__CIVOLTEN_E2E__===true&&['127.0.0.1','localhost'].includes(location.hostname);
function testAuth(){
 // Somente build explícita de teste local. Jamais ativada em produção.
 let user=null;
 return {
  getSession:async()=>({data:{user}}),
  signUp:{email:async({name,email})=>({data:{user:{id:'test-user',name,email}}})},
  signIn:{email:async({email})=>{user={id:'test-user',name:'Teste CIVOLTEN',email};return {data:{user}}}},
  signOut:async()=>{user=null;return {data:null}},
  requestPasswordReset:async()=>({data:true})
 };
}
const auth=E2E?testAuth():BASE_URL?createAuthClient(BASE_URL):null;
const recoveryToken=new URLSearchParams(location.search).get('token');
const mount=document.getElementById('app');
const modal=document.getElementById('editor-dialog');
const toastNode=document.getElementById('toast');
const state={
 user:null,data:fresh(),view:'home',costTab:'fixed',authMode:recoveryToken?'newpass':'login',
 authBusy:false,authError:'',busy:false,editor:null,toastTimer:null,
 checkedSession:false
};
const delayToast=(text)=>{
 toastNode.textContent=text;toastNode.hidden=false;
 clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>{toastNode.hidden=true},4300);
};
function render(){
 if(!state.checkedSession){mount.innerHTML='<div class="loading-stage"><img src="/assets/civolten-simbolo.png" alt=""><span>Preparando CIVOLTEN...</span></div>';return;}
 if(!state.user){
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
async function session(){
 if(!auth){
  state.checkedSession=true;state.user=null;
  state.authError='O login ainda não está configurado nesta publicação. Dados anteriores permanecem preservados.';
  render();return;
 }
 try{
  const result=await auth.getSession();
  if(result.error)throw Error(result.error.message||'Sessão indisponível');
  state.user=result.data?.user||null;
  state.data=state.user?safeLoad(localStorage,state.user.id):fresh();
 }catch(err){
  state.user=null;
  state.authError='Não foi possível verificar seu acesso: '+(err.message||'falha na conexão');
 }finally{state.checkedSession=true;render();}
}
async function submitLogin(form){
 const fields=Object.fromEntries(new FormData(form));
 state.authBusy=true;state.authError='';render();
 try{
  if(!auth)throw Error('Autenticação não configurada.');
  if(state.authMode==='newpass'){
   if(!recoveryToken||typeof auth.resetPassword!=='function')throw Error('Link de recuperação inválido.');
   const result=await auth.resetPassword({newPassword:fields.password,token:recoveryToken});
   if(result.error)throw Error(result.error.message||'Não foi possível alterar a senha');
   history.replaceState(null,'',location.pathname);
   state.authMode='login';
   delayToast('Senha atualizada. Entre novamente com sua nova senha.');
  }else if(state.authMode==='reset'){
   if(typeof auth.requestPasswordReset!=='function')
    throw Error('Recuperação de senha indisponível. Entre em contato com o suporte.');
   const result=await auth.requestPasswordReset({email:fields.email,
    redirectTo:location.origin+'/'});
   if(result.error)throw Error(result.error.message||'Não foi possível enviar o e-mail');
   state.authMode='login';
   delayToast('Se houver uma conta neste e-mail, você receberá instruções de recuperação.');
  }else{
   const result=state.authMode==='signup'?
    await auth.signUp.email({name:fields.name,email:fields.email,password:fields.password}):
    await auth.signIn.email({email:fields.email,password:fields.password});
   if(result.error)throw Error(result.error.message||'Não foi possível autenticar.');
   const check=await auth.getSession();
   if(check.error)throw Error(check.error.message||'Não foi possível confirmar a sessão');
   const user=check.data?.user||null;
   if(!user){
    state.authMode='login';
    delayToast('Cadastro recebido. Confirme seu e-mail, se necessário, e faça login.');
   }else{
    state.user=user;state.data=safeLoad(localStorage,user.id);state.view='home';
    state.authMode='login';
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
  const r=await auth.signOut();if(r?.error)throw Error(r.error.message||'Falha ao sair');
  state.user=null;state.data=fresh();state.view='home';state.authMode='login';
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
function saveRecord(form){
 if(!state.editor||!state.user)return;
 const {kind,id}=state.editor;
 const input=Object.fromEntries(new FormData(form));
 if(kind==='employees'&&input.contractType==='contractor')input.hours=input.contractHours;
 try{
  const nextRecord=validate(kind,input);
  nextRecord.id=id||crypto.randomUUID();
  const copy=structuredClone(state.data);
  const i=copy[kind].findIndex(item=>item.id===id);
  if(i>=0)copy[kind][i]=nextRecord;
  else copy[kind].push(nextRecord);
  state.data=safeSave(localStorage,state.user.id,copy);
  closeEditor();render();delayToast('Cadastro salvo com sucesso.');
 }catch(err){
  const node=form.querySelector('#form-error');
  node.textContent=err.message||'Confira os campos.';node.hidden=false;
 }
}
function removeRecord(){
 if(!state.editor||!state.user)return;
 const {kind,id}=state.editor,item=state.data[kind].find(x=>x.id===id);
 if(!item)return;
 if(!confirm('Excluir "'+item.name+'"? Esta ação não pode ser desfeita.'))return;
 try{
  const copy=structuredClone(state.data);
  copy[kind]=copy[kind].filter(x=>x.id!==id);
  state.data=safeSave(localStorage,state.user.id,copy);
  closeEditor();render();delayToast('Cadastro excluído.');
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
 if(action==='delete-record')removeRecord();
});
modal.addEventListener('change',event=>{
 if(event.target.name==='contractType')toggleContractFields();
});
modal.addEventListener('submit',event=>{
 if(event.target.id!=='record-form')return;
 event.preventDefault();saveRecord(event.target);
});
modal.addEventListener('click',event=>{if(event.target===modal)closeEditor();});
if('serviceWorker' in navigator&&!E2E)
 window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
render();
session();
window.CIVOLTENPreview={get view(){return state.view},get data(){return structuredClone(state.data)},
 get user(){return state.user},go,openEditor,summary:()=>summary(state.data)};
