/* CIVOLTEN | cadastro e acesso com Neon Auth. Não apaga dados ao sair. */
(function(root){
'use strict';
const OWNER='civolten_cloud_device_owner_v1',STORAGE='civolten_daily_v2';
const html=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function stateFor(user,owner){return !user?.id?'login':owner&&owner!==user.id?'foreign':!owner?'bind':'ready'}
function stats(key=STORAGE){try{const x=JSON.parse(localStorage.getItem(key)||'null');return {clients:x?.clients?.length||0,quotes:x?.quotes?.length||0}}catch{return {clients:0,quotes:0}}}
function mount({auth,ownerKey=OWNER,storageKey=STORAGE,onAccess=()=>{},onExit=()=>{},devFallback=false}={}){
 const style=document.createElement('style');
 style.textContent=[
 'html.cv-auth-locked body{overflow:hidden!important}html.cv-auth-locked #app{visibility:hidden!important;pointer-events:none!important}',
 '#cv-auth-screen{display:none;position:fixed;inset:0;z-index:2147483000;background:linear-gradient(160deg,#121419,#25272d);color:#2a2a2b;overflow-y:auto;font-family:Arial,sans-serif}',
 'html.cv-auth-locked #cv-auth-screen{display:flex;align-items:center;justify-content:center;padding:16px}',
 '#cv-auth-screen .cv-card{width:min(100%,410px);background:#f8f6ef;border-radius:21px;overflow:hidden;border:1px solid #cf9b31;box-shadow:0 16px 60px #0009}',
 '#cv-auth-screen .cv-hero{background:linear-gradient(120deg,#1d1f24,#343439);border-bottom:3px solid #d59929;text-align:center;padding:25px 15px 17px}',
 '#cv-auth-screen .cv-hero img{max-width:270px;max-height:97px;width:90%;object-fit:contain}',
 '#cv-auth-screen .cv-hero p{font-size:10px;font-weight:900;letter-spacing:1px;color:#f1d48b;margin:10px 0 0}',
 '#cv-auth-screen .cv-body{display:grid;gap:12px;padding:21px}',
 '#cv-auth-screen h1{font-size:22px;margin:0;line-height:1.25;color:#232429}',
 '#cv-auth-screen p{font-size:12px;line-height:1.55;color:#55565c;margin:0}',
 '#cv-auth-screen label{font-size:12px;font-weight:800;display:grid;gap:6px}',
 '#cv-auth-screen input{box-sizing:border-box;border:1px solid #bbb8b0;background:white;color:#222;width:100%;padding:13px;font-size:16px;border-radius:10px}',
 '#cv-auth-screen button{padding:13px 10px;min-height:43px;border:1px solid #c29031;border-radius:10px;font-size:13px;font-weight:850}',
 '#cv-auth-screen button:disabled{opacity:.6}',
 '#cv-auth-screen .cv-primary{background:linear-gradient(100deg,#c78316,#ffdd70,#d28c15);color:#211c15}',
 '#cv-auth-screen .cv-secondary{background:white;color:#302b21}',
 '#cv-auth-screen .cv-notice{background:#fff0ce;border:1px solid #e1b267;border-radius:8px;padding:10px;color:#74480c;font-size:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}',
 '#cv-auth-screen form{display:grid;gap:11px}',
 '#cv-auth-screen .cv-link{border:none;background:transparent;color:#986414;text-decoration:underline}',
 '@media(max-height:540px){html.cv-auth-locked #cv-auth-screen{align-items:flex-start}#cv-auth-screen .cv-hero{padding:12px}#cv-auth-screen .cv-hero img{max-height:53px}}',
 '@media print{#cv-auth-screen{display:none!important}}'
 ].join('');
 document.head.append(style);
 const overlay=document.createElement('section');overlay.id='cv-auth-screen';
 overlay.setAttribute('aria-label','Acesso CIVOLTEN');
 overlay.innerHTML='<div class="cv-card"><div class="cv-hero"><img src="/assets/civolten-logo.png" alt="CIVOLTEN"><p>ACESSO SEGURO · ELÉTRICA &amp; CONSTRUÇÃO CIVIL</p></div><div class="cv-body" id="cv-auth-body"></div></div>';
 document.body.append(overlay);
 const body=overlay.querySelector('#cv-auth-body');
 let user=null,view='checking',busy=false,error='',locked=true;
 function lock(x){locked=x;document.documentElement.classList.toggle('cv-auth-locked',x);const app=document.getElementById('app');if(app)app.inert=x}
 const title=(t,sub)=>'<h1>'+html(t)+'</h1>'+(sub?'<p>'+html(sub)+'</p>':'');
 const notice=()=>error?'<div class="cv-notice" role="alert">'+html(error)+'</div>':'';
 function draw(){
  if(view==='ready'){body.innerHTML='';return}
  if(view==='checking'){body.innerHTML=title('Verificando acesso','Conferindo sua sessão Neon Auth.')+notice();return}
  if(view==='error'){body.innerHTML=title('Acesso indisponível','Nenhum dado deste aparelho foi apagado.')+
    notice()+'<button class="cv-primary" data-cv-auth="retry">Tentar novamente</button>';return}
  if(view==='foreign'){body.innerHTML=title('Aparelho vinculado a outra conta',
    'Os dados locais pertencem a outra conta CIVOLTEN. Use a conta original ou outro perfil do navegador.')+
    '<div class="cv-notice">Acesso bloqueado para evitar misturar clientes e orçamentos. Nenhum dado foi removido.</div>'+
    notice()+'<button class="cv-secondary" data-cv-auth="logout">Sair desta conta</button>';return}
  if(view==='bind'){
   const x=stats(storageKey);
   body.innerHTML=title('Vincular este aparelho','Seus registros locais serão associados à conta abaixo. O backup na nuvem é opcional e separado.')+
    '<p><strong>'+html(user?.email)+'</strong></p>'+
    '<div class="cv-notice">'+x.clients+' cliente(s) e '+x.quotes+' orçamento(s) permanecem no aparelho. Nenhum dado será enviado ou substituído agora.</div>'+
    notice()+'<button class="cv-primary" data-cv-auth="bind">Vincular e abrir CIVOLTEN</button>'+
    '<button class="cv-secondary" data-cv-auth="logout">Usar outra conta</button>';return;
  }
  if(view==='account'){
   body.innerHTML=title('Minha conta','Conectado com '+(user?.email||'conta CIVOLTEN'))+
    notice()+'<button class="cv-primary" data-cv-auth="continue">Voltar ao aplicativo</button>'+
    '<button class="cv-secondary" data-cv-auth="logout">Sair da conta</button>'+
    '<p>Sair não remove nenhum cadastro, orçamento nem backup deste celular. Entre novamente com esta conta para continuar.</p>';return;
  }
  const create=view==='signup';
  body.innerHTML=title(create?'Criar conta CIVOLTEN':'Entrar no CIVOLTEN',
    create?'Cadastre-se com e-mail e senha.':'Entre na sua conta para consultar e testar seus orçamentos.')+
    '<form id="cv-auth-form">'+(create?'<label>Nome<input id="cv-auth-name" autocomplete="name" required maxlength="100"></label>':'')+
    '<label>E-mail<input type="email" id="cv-auth-email" autocomplete="email" required placeholder="seu@email.com"></label>'+
    '<label>Senha<input type="password" id="cv-auth-password" autocomplete="'+(create?'new-password':'current-password')+
    '" minlength="8" required placeholder="Mínimo de 8 caracteres"></label>'+notice()+
    '<button type="submit" class="cv-primary">'+(create?'Criar minha conta':'Entrar na minha conta')+'</button></form>'+
    '<button class="cv-link" data-cv-auth="'+(create?'login':'signup')+'">'+(create?'Já tenho conta':'Criar conta')+'</button>'+
    '<p>Seus dados ficam no aparelho. Para protegê-los entre celulares, configure o backup em Mais → Backups e segurança.</p>';
 }
 async function grant(){
  const target=stateFor(user,localStorage.getItem(ownerKey));
  if(target!=='ready'){view=target;lock(true);draw();return false}
  const prior=locked;view='ready';error='';lock(false);draw();
  if(prior)await onAccess(user);
  return true;
 }
 async function checkSession(){
  view='checking';lock(true);error='';draw();
  if(!auth){view='error';error='Autenticação indisponível nesta implantação. Seus dados continuam salvos neste aparelho.';draw();return false}
  try{
   const r=await auth.getSession();if(r.error)throw Error(r.error.message||'Falha ao consultar sessão');
   user=r.data?.user||null;
   if(!user){view='login';draw();return false}
   return await grant();
  }catch(e){view='error';error=e.message||'Não foi possível validar a sessão';draw();return false}
 }
 async function signOut(){
  if(busy)return;busy=true;error='';
  try{
   const r=await auth?.signOut?.();
   if(r?.error)throw Error(r.error.message||'Falha ao sair da conta');
   user=null;onExit();view='login';lock(true);draw();
  }catch(e){error=e.message||'Falha ao sair';draw()}
  finally{busy=false}
 }
 async function sign(form){
  if(busy||!auth)return;
  const email=body.querySelector('#cv-auth-email')?.value.trim()||'';
  const password=body.querySelector('#cv-auth-password')?.value||'';
  const name=body.querySelector('#cv-auth-name')?.value.trim()||'';
  if(!email||password.length<8||(view==='signup'&&!name)){error='Preencha os campos. Senha mínima: 8 caracteres.';draw();return}
  busy=true;error='';
  const kind=view,button=form.querySelector('[type="submit"]');if(button)button.disabled=true;
  try{
   const result=kind==='signup'?await auth.signUp.email({email,password,name}):await auth.signIn.email({email,password});
   if(result.error)throw Error(result.error.message||'Falha de autenticação');
   const r=await auth.getSession();
   if(r.error)throw Error(r.error.message||'Falha ao validar sessão');
   user=r.data?.user||null;
   if(!user){view='login';error='Cadastro recebido. Confirme seu e-mail se solicitado e entre novamente.';draw();return}
   await grant();
  }catch(e){error=e.message||'Não foi possível entrar';draw()}
  finally{busy=false;const btn=body.querySelector('[type="submit"]');if(btn)btn.disabled=false}
 }
 overlay.addEventListener('submit',e=>{if(e.target.id!=='cv-auth-form')return;e.preventDefault();sign(e.target)});
 overlay.addEventListener('click',e=>{
  const act=e.target.closest('[data-cv-auth]')?.dataset.cvAuth;if(!act||busy)return;
  if(act==='login'||act==='signup'){view=act;error='';draw()}
  else if(act==='retry')checkSession();
  else if(act==='logout')signOut();
  else if(act==='continue'){view='ready';lock(false);draw()}
  else if(act==='bind'&&user){
   const owner=localStorage.getItem(ownerKey);
   if(owner&&owner!==user.id){view='foreign';draw();return}
   localStorage.setItem(ownerKey,user.id);
   grant().catch(e=>{view='error';error=e.message;lock(true);draw()});
  }
 });
 window.addEventListener('civolten:open-account',()=>{
  if(!user){checkSession();return}
  view='account';lock(true);error='';draw();
 });
 if(devFallback&&!auth&&['localhost','127.0.0.1'].includes(location.hostname)){
  user={id:'test-browser',email:'teste@local.invalid'};view='ready';lock(false);draw();
 }else checkSession();
 return {checkSession,signOut,get state(){return view},get user(){return user}};
}
root.CIVOLTENAuthScreen={mount,stateFor,stats};
})(window);
