/* CIVOLTEN: nuvem opcional, sem alterações automáticas dos dados locais. */
import { createAuthClient } from '@neon/auth';
const authURL=__CIVOLTEN_NEON_AUTH_URL__;
// O modo de teste só existe em builds de CI e só atua em localhost.
const localTest=__CIVOLTEN_BROWSER_TEST_MODE__&&['localhost','127.0.0.1'].includes(location.hostname);
const auth=authURL&&!localTest?createAuthClient(authURL):null;
const STORAGE='civolten_daily_v2',LEGACY='civolten_premium_proto_v1';
const host=document.createElement('div');
host.innerHTML=[
'<style>',
'#cv-cloud-box{border:none;border-radius:18px;padding:0;width:min(400px,calc(100vw - 22px));max-height:88dvh;box-shadow:0 12px 70px #0008;background:#faf9f5;color:#262626}#cv-cloud-box::backdrop{background:#14171dba}',
'#cv-cloud-inner{padding:18px;display:grid;gap:10px}#cv-cloud-inner h2{margin:0;font-size:19px}#cv-cloud-inner p,#cv-cloud-inner small{font-size:12px;line-height:1.5}#cv-cloud-inner label{font-size:12px;font-weight:700}',
'#cv-cloud-inner input{width:100%;border:1px solid #ccc;padding:12px;border-radius:8px;font-size:16px}#cv-cloud-inner button{border:1px solid #ad9037;background:#f8e7bd;padding:11px;border-radius:9px;font-weight:700}#cv-cloud-inner button:disabled{opacity:.5}#cv-cloud-inner .cv-secondary{background:white}#cv-cloud-actions{display:grid;gap:7px}#cv-cloud-status{min-height:18px;white-space:pre-wrap;word-break:break-word;color:#664d21;font-size:12px}@media print{#cv-cloud-box{display:none!important}}',
'</style>',
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
'<label style="display:flex;align-items:center;gap:9px;font-size:12px;font-weight:600"><input id="cv-cloud-auto" type="checkbox" style="width:19px;height:19px">Backup automático após salvar alterações (opcional)</label>',
'<button id="cv-cloud-restore" class="cv-secondary" type="button">Restaurar backup da nuvem neste celular</button>',
'<button id="cv-cloud-logout" class="cv-secondary" type="button">Sair da conta</button></div>',
'<div id="cv-cloud-status" role="status" aria-live="polite"></div></section></dialog>'
].join('');
document.body.append(host);
const by=id=>host.querySelector('#'+id),dlg=by('cv-cloud-box'),status=by('cv-cloud-status'),actions=by('cv-cloud-actions'),login=by('cv-cloud-login');
let busy=false,autoBusy=false,scheduled=null,currentUserId=null;
const KEY_AUTO='civolten_cloud_auto_',KEY_REV='civolten_cloud_ack_revision_',KEY_SHA='civolten_cloud_ack_sha_',KEY_OWNER='civolten_cloud_device_owner_v1';
const keyed=(base)=>base+currentUserId;
const readAck=()=>{const raw=localStorage.getItem(keyed(KEY_REV));return raw===null?null:Number(raw)};
const isAuto=()=>!!currentUserId&&localStorage.getItem(keyed(KEY_AUTO))==='1';
async function digest(raw){const bytes=new TextEncoder().encode(raw);const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');}
async function rememberBackup(revision,raw){if(!currentUserId)throw new Error('Sessão não identificada');const sha=await digest(raw);localStorage.setItem(keyed(KEY_SHA),sha);localStorage.setItem(keyed(KEY_REV),String(revision));localStorage.setItem(KEY_OWNER,currentUserId);}
function checkDeviceOwner(){const bound=localStorage.getItem(KEY_OWNER);if(bound&&bound!==currentUserId)throw new Error('Este navegador contém dados vinculados a outra conta. Use outro perfil/navegador para evitar misturar informações de empresas.');}
function scheduleAuto(){clearTimeout(scheduled);if(isAuto())scheduled=setTimeout(()=>{autoUpload().catch(e=>note(e.message||'Falha no backup automático. Seus dados continuam no aparelho.'));},1200);}

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
 currentUserId=user?.id||null;
 login.hidden=!!user;actions.hidden=!user;
 by('cv-cloud-auto').checked=isAuto();
 if(user){try{checkDeviceOwner()}catch(e){actions.hidden=false;note(e.message+' Os backups estão bloqueados nesta conta; use outro perfil de navegador. Você ainda pode sair da conta.');return;}}
 by('cv-cloud-user').textContent=user?'Conta: '+user.email:'';
 note(error?error.message:(user?'Conectado. Backup manual disponível. A automação é opcional e nunca substitui dados de outro aparelho sem revisão.':'Entre ou crie uma conta para guardar backups.'));
 if(user&&isAuto())scheduleAuto();
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
  await loginScreen?.checkSession();
 }catch(e){note(e.message||'Não foi possível autenticar');}
 finally{setBusy(false);}
}
async function upload(){
 if(busy||autoBusy)return;setBusy(true);
 try{
  checkDeviceOwner();
  const local=localData(),current=await remote('GET');
  const ack=readAck();
  if(current.revision>0&&ack!==current.revision)throw new Error('A nuvem já possui dados que este navegador não sincronizou. Restaure e confira o backup antes de tentar substituir.');
  const detail='Dados deste celular: '+count(local)+'. '+(current.data?'Já existe um backup de '+count(current.data)+'. Será registrada uma nova versão.':'Este será o primeiro backup.')+'\nDeseja salvar este aparelho na nuvem?';
  if(!confirm(detail)){note('Operação cancelada.');return;}
  const raw=JSON.stringify(local);
  const updated=await remote('PUT',{expectedRevision:current.revision,data:local});
  await rememberBackup(updated.revision,raw);
  note('Backup salvo (versão '+updated.revision+'). Dados locais preservados.');
 }catch(e){note(e.message||'Erro ao enviar backup.');}finally{setBusy(false);}
}
async function restore(){
 if(busy||autoBusy)return;setBusy(true);
 try{
  checkDeviceOwner();
  const cloud=await remote('GET');
  if(!cloud.data){note('Ainda não existe backup na nuvem.');return;}
  const local=localData();
  if(!confirm('Restaurar '+count(cloud.data)+' substituirá os dados atuais ('+count(local)+'). Um backup JSON será baixado antes. Quer continuar?')){
   note('Restauração cancelada.');return;
  }
  exportBeforeReplace(local);
  const raw=JSON.stringify(cloud.data);
  localStorage.setItem(STORAGE,raw);
  await rememberBackup(cloud.revision,raw);
  note('Restauração concluída.');location.reload();
 }catch(e){note(e.message||'Não foi possível restaurar.');}finally{setBusy(false);}
}
// Acesso somente dentro de Mais → Backups e segurança; sem botão flutuante.
window.addEventListener('civolten:open-cloud-backup',()=>{
 if(!dlg.open)dlg.showModal();
 refresh().catch(e=>note(e.message));
});
by('cv-cloud-close').addEventListener('click',()=>dlg.close());
by('cv-cloud-signin').addEventListener('click',()=>sign(false));
by('cv-cloud-signup').addEventListener('click',()=>sign(true));
by('cv-cloud-upload').addEventListener('click',upload);
by('cv-cloud-restore').addEventListener('click',restore);
by('cv-cloud-logout').addEventListener('click',async()=>{
 setBusy(true);
 try{if(loginScreen)await loginScreen.signOut();
  else if(auth)await auth.signOut();
  await refresh();
 }catch(e){note(e.message||'Falha ao sair da conta')}
 finally{setBusy(false)}
});


// O backup automático só começa após consentimento, e só atualiza revisões
// já conhecidas deste aparelho. Divergência nunca sobrescreve dados remotos.
async function autoUpload(){
 if(!isAuto()||busy||autoBusy)return;
 autoBusy=true;
 try{
  checkDeviceOwner();
  const local=localData(),raw=JSON.stringify(local),sha=await digest(raw);
  if(sha===localStorage.getItem(keyed(KEY_SHA)))return;
  const current=await remote('GET'),ack=readAck();
  if(current.revision>0&&ack!==current.revision){
   note('CONFLITO: a nuvem tem uma versão nova. Backup automático suspenso para evitar sobrescrever informações. Abra Nuvem e restaure após conferir seus dados.');
   return;
  }
  const updated=await remote('PUT',{expectedRevision:current.revision,data:local});
  await rememberBackup(updated.revision,raw);
  note('Backup automático concluído • versão '+updated.revision);
  if(JSON.stringify(localData())!==raw)scheduleAuto();
 }catch(e){note('Backup pendente (dados locais preservados): '+(e.message||'erro na conexão'));}
 finally{autoBusy=false;}
}
by('cv-cloud-auto').addEventListener('change',async event=>{
 if(!currentUserId){event.target.checked=false;return note('Entre na sua conta para ativar o backup.');}
 if(event.target.checked){
  try{
   checkDeviceOwner();
   if(!confirm('Ativar backup automático de novos dados neste aparelho? Se já houver alterações de outro aparelho, a operação será BLOQUEADA até a conferência.'))
    {event.target.checked=false;return;}
   localStorage.setItem(keyed(KEY_AUTO),'1');
   scheduleAuto();
   note('Backup automático ativado. Os dados locais continuam disponíveis offline.');
  }catch(e){event.target.checked=false;note(e.message);}
 }else{
  localStorage.removeItem(keyed(KEY_AUTO));clearTimeout(scheduled);
  note('Backup automático desativado; os dados locais foram mantidos.');
 }
});
window.addEventListener('civolten:local-saved',()=>scheduleAuto());
window.addEventListener('online',()=>scheduleAuto());
window.addEventListener('pageshow',()=>{if(isAuto())scheduleAuto();});

// A tela de login é obrigatória na produção e usa o MESMO Neon Auth do backup.
// Nenhum dado local é apagado ao sair. Outra conta fica bloqueada pelo vínculo.
const loginScreen=window.CIVOLTENAuthScreen?.mount({
 auth,ownerKey:KEY_OWNER,storageKey:STORAGE,
 devFallback:localTest, // Apenas CI em localhost; nunca em produção.
 onAccess:()=>refresh().catch(e=>note(e.message||'Falha ao consultar conta')),
 onExit:()=>{currentUserId=null;clearTimeout(scheduled);
  login.hidden=false;actions.hidden=true;note('Sessão encerrada; dados locais preservados.');}
});

