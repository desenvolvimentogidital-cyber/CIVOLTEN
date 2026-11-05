/* CIVOLTEN: nuvem opcional, sem alterações automáticas dos dados locais. */
import { createAuthClient } from '@neon/auth';
const authURL=__CIVOLTEN_NEON_AUTH_URL__;
const auth=authURL?createAuthClient(authURL):null;
const STORAGE='civolten_daily_v2',LEGACY='civolten_premium_proto_v1';
const host=document.createElement('div');
host.innerHTML=[
'<style>',
'#cv-cloud-fab{position:fixed;z-index:1010;bottom:calc(82px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);border:1px solid #b98322;background:#191b20;color:#ffd36e;border-radius:24px;padding:10px 17px;box-shadow:0 4px 20px #0005;font-size:12px;font-weight:750;white-space:nowrap}',
'#cv-cloud-box{border:none;border-radius:18px;padding:0;width:min(400px,calc(100vw - 22px));max-height:88dvh;box-shadow:0 12px 70px #0008;background:#faf9f5;color:#262626}#cv-cloud-box::backdrop{background:#14171dba}',
'#cv-cloud-inner{padding:18px;display:grid;gap:10px}#cv-cloud-inner h2{margin:0;font-size:19px}#cv-cloud-inner p,#cv-cloud-inner small{font-size:12px;line-height:1.5}#cv-cloud-inner label{font-size:12px;font-weight:700}',
'#cv-cloud-inner input{width:100%;border:1px solid #ccc;padding:12px;border-radius:8px;font-size:16px}#cv-cloud-inner button{border:1px solid #ad9037;background:#f8e7bd;padding:11px;border-radius:9px;font-weight:700}#cv-cloud-inner button:disabled{opacity:.5}#cv-cloud-inner .cv-secondary{background:white}#cv-cloud-actions{display:grid;gap:7px}#cv-cloud-status{min-height:18px;white-space:pre-wrap;word-break:break-word;color:#664d21;font-size:12px}@media print{#cv-cloud-fab,#cv-cloud-box{display:none!important}}',
'</style>',
'<button id="cv-cloud-fab" type="button">☁ Nuvem CIVOLTEN</button>',
'<dialog id="cv-cloud-box" aria-label="Backup e conta CIVOLTEN"><section id="cv-cloud-inner">',
'<div style="display:flex;gap:12px;justify-content:space-between;align-items:center"><h2>Nuvem CIVOLTEN</h2><button class="cv-secondary" type="button" id="cv-cloud-close">Fechar</button></div>',
'<p>O aparelho continua funcionando localmente. Nada é enviado ou restaurado sem sua confirmação.</p>',
'<div id="cv-cloud-login">',
'<label>Email<input id="cv-cloud-email" type="email" autocomplete="email" placeholder="seu@email.com"></label>',
'<label>Senha<input id="cv-cloud-pass" type="password" autocomplete="current-password" placeholder="Sua senha"></label>',
'<button id="cv-cloud-signin" type="button">Entrar</button>',
'<button id="cv-cloud-signup" class="cv-secondary" type="button">Criar conta</button></div>',
'<div id="cv-cloud-actions" hidden><small id="cv-cloud-user"></small>',
'<button id="cv-cloud-upload" type="button">Salvar backup deste celular na nuvem</button>',
'<button id="cv-cloud-restore" class="cv-secondary" type="button">Restaurar backup da nuvem neste celular</button>',
'<button id="cv-cloud-logout" class="cv-secondary" type="button">Sair da conta</button></div>',
'<div id="cv-cloud-status" role="status" aria-live="polite"></div></section></dialog>'
].join('');
document.body.append(host);
const by=id=>host.querySelector('#'+id),dlg=by('cv-cloud-box'),status=by('cv-cloud-status'),actions=by('cv-cloud-actions'),login=by('cv-cloud-login');
let busy=false;
const note=m=>{status.textContent=String(m)};
const setBusy=v=>{busy=v;for(const b of host.querySelectorAll('button'))b.disabled=v};
function localData(){
 const raw=localStorage.getItem(STORAGE)||localStorage.getItem(LEGACY),data=raw?JSON.parse(raw):null;
 if(!data||!Array.isArray(data.clients)||!Array.isArray(data.quotes))
  throw new Error('Não há dados válidos neste celular. Abra o aplicativo e salve primeiro.');
 return data;
}
const count=d=>(d?.clients?.length||0)+' cliente(s), '+(d?.quotes?.length||0)+' orçamento(s)';
function exportBeforeReplace(data){
 const blob=new Blob([JSON.stringify({format:'civolten-backup',version:2,exportedAt:new Date().toISOString(),data},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='CIVOLTEN-seguranca-'+new Date().toISOString().slice(0,10)+'.json';
 a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function refresh(){
 if(!auth){note('Neon Auth não configurado neste ambiente.');return;}
 const {data,error}=await auth.getSession();
 const user=data?.user||null;
 login.hidden=!!user;actions.hidden=!user;
 by('cv-cloud-user').textContent=user?'Conta: '+user.email:'';
 note(error?error.message:(user?'Conectado. Escolha salvar ou restaurar com confirmação.':'Entre ou crie uma conta para guardar backups.'));
}
async function token(){
 const {data,error}=await auth.token();
 if(error||!data?.token)throw new Error('Sessão expirada. Faça login novamente.');
 return data.token;
}
async function remote(method,payload){
 const response=await fetch('/api/cloud-state',{method,
  headers:{Authorization:'Bearer '+await token(),...(payload?{'Content-Type':'application/json'}:{})},
  body:payload?JSON.stringify(payload):undefined,cache:'no-store'});
 const result=await response.json().catch(()=>({error:'Resposta inválida da nuvem'}));
 if(!response.ok)throw new Error(result.error||'Falha ao consultar a nuvem');
 return result;
}
async function sign(signUp){
 if(!auth)return note('Nuvem indisponível.');
 const email=by('cv-cloud-email').value.trim(),password=by('cv-cloud-pass').value;
 if(!email||!password)return note('Informe email e senha.');
 setBusy(true);
 try{
  const result=signUp?await auth.signUp.email({name:email.split('@')[0]||'Usuário',email,password}):await auth.signIn.email({email,password});
  if(result.error)throw new Error(result.error.message||'Falha de autenticação');
  by('cv-cloud-pass').value='';await refresh();
 }catch(e){note(e.message||'Não foi possível autenticar');}
 finally{setBusy(false);}
}
async function upload(){
 if(busy)return;setBusy(true);
 try{
  const local=localData(),current=await remote('GET');
  const detail='Dados deste celular: '+count(local)+'. '+(current.data?'Já existe um backup de '+count(current.data)+'. Será registrada uma nova versão.':'Este será o primeiro backup.')+'\nDeseja salvar este aparelho na nuvem?';
  if(!confirm(detail)){note('Operação cancelada.');return;}
  const updated=await remote('PUT',{expectedRevision:current.revision,data:local});
  note('Backup salvo (versão '+updated.revision+'). Dados locais preservados.');
 }catch(e){note(e.message||'Erro ao enviar backup.');}finally{setBusy(false);}
}
async function restore(){
 if(busy)return;setBusy(true);
 try{
  const cloud=await remote('GET');
  if(!cloud.data){note('Ainda não existe backup na nuvem.');return;}
  const local=localData();
  if(!confirm('Restaurar '+count(cloud.data)+' substituirá os dados atuais ('+count(local)+'). Um backup JSON será baixado antes. Quer continuar?')){
   note('Restauração cancelada.');return;
  }
  exportBeforeReplace(local);
  localStorage.setItem(STORAGE,JSON.stringify(cloud.data));
  note('Restauração concluída.');location.reload();
 }catch(e){note(e.message||'Não foi possível restaurar.');}finally{setBusy(false);}
}
by('cv-cloud-fab').addEventListener('click',()=>{dlg.showModal();refresh().catch(e=>note(e.message));});
by('cv-cloud-close').addEventListener('click',()=>dlg.close());
by('cv-cloud-signin').addEventListener('click',()=>sign(false));
by('cv-cloud-signup').addEventListener('click',()=>sign(true));
by('cv-cloud-upload').addEventListener('click',upload);
by('cv-cloud-restore').addEventListener('click',restore);
by('cv-cloud-logout').addEventListener('click',async()=>{setBusy(true);try{await auth.signOut();await refresh();}catch(e){note(e.message)}finally{setBusy(false)}});
