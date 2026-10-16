
export const PAGE = String.raw`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0b1220"><title>CIVOLTEN | Orçamento Digital — Beta</title>
<style>
:root{color-scheme:dark;--dark:#0b1220;--panel:#151f2f;--border:#344154;--gold:#ffc342;--soft:#aeb9c8;--white:#f4f5f8}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 70% 0%,#28384a 0%,#0b1220 46%);font:15px/1.5 system-ui,-apple-system,sans-serif;color:var(--white)}.wrap{width:min(980px,92%);margin:auto}.top{position:sticky;top:0;z-index:5;background:#0b1220ef;border-bottom:1px solid #46516a;backdrop-filter:blur(15px)}.top .wrap{display:flex;align-items:center;justify-content:space-between;padding:12px 0;gap:12px}.logo{font-size:23px;font-weight:900;color:white;letter-spacing:-1px}.logo b{color:var(--gold)}.logo small{display:block;font-size:9px;letter-spacing:1.2px;font-weight:600;color:#bbc3cb}.link{border:1px solid #5c6a81;color:white;background:transparent;border-radius:9px;padding:9px 12px;cursor:pointer;font:inherit;font-weight:600}h1{font-size:clamp(30px,6vw,49px);line-height:1.12;margin:13px 0}.hero{padding:45px 0 25px;max-width:780px}.hero em{color:var(--gold);font-style:normal}.hero p{color:#c5cdd9;font-size:17px}.chip{display:inline-block;background:#ffc34218;border:1px solid #ecb32a80;color:#ffd870;padding:5px 11px;border-radius:999px;font-size:12px;font-weight:750;letter-spacing:.5px}.panel{background:#141d2bdd;border:1px solid #3c4757;border-radius:19px;padding:22px;margin:14px 0 25px;box-shadow:0 16px 46px #0005}h2{font-size:21px;margin:0 0 6px}h3{font-size:17px}.muted,.hint{color:#acb8c8}.hint{font-size:13px}.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field{display:flex;flex-direction:column;gap:6px;margin:12px 0;font-size:13px;font-weight:650}input:not([type=checkbox]):not([type=file]),select,textarea{width:100%;border:1px solid #48556d;background:#0e1827;color:#f8f9ff;border-radius:10px;padding:12px;font:16px system-ui;outline-offset:1px}textarea{min-height:100px}input:focus,select:focus,textarea:focus{border-color:var(--gold)}.standards{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.standard{border:1px solid #4a576c;border-radius:10px;background:#0f1928;color:#d5dbe7;padding:12px 5px;cursor:pointer;font:700 13px system-ui}.standard[aria-pressed=true]{background:var(--gold);color:#111822;border-color:#ffdc82}.actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:18px}button.primary{border:0;border-radius:11px;padding:13px 19px;background:linear-gradient(130deg,#ffdb78,#f4b51e);color:#111721;font-weight:800;font-size:14px;cursor:pointer}button.secondary{border:1px solid #5e6b7a;border-radius:11px;background:#202d40;color:white;padding:12px 15px;font-weight:650;cursor:pointer}button:disabled{opacity:.5;cursor:not-allowed}.line{display:grid;grid-template-columns:minmax(0,3fr) minmax(100px,1fr) auto;gap:8px;align-items:end;margin:9px 0}.line label{display:block;font-size:12px}.line button{padding:10px;border:1px solid #ab6970;background:#48242d;color:white;border-radius:9px}.price{border:1px solid #b38b3e;background:#c89b2520;padding:17px;border-radius:14px;margin:16px 0}.price b{display:block;font-size:31px;color:#ffcf66}.upload{border:1px dashed #78859b;border-radius:13px;padding:14px;background:#0c1626}.upload input{max-width:100%;margin:9px 0}.list{color:#cfd7e1;padding-left:20px}.divider{border:0;border-top:1px solid #394759;margin:23px 0}.error,.good{padding:12px;border-radius:10px;margin:12px 0;white-space:pre-line}.error{background:#55222d;color:#fff0f1}.good{background:#173b32;color:#b7fce7}.hidden{display:none!important}.footer{border-top:1px solid #3a465c;padding:30px 0;color:#b0bacc;font-size:13px}.req{border:1px solid #48566d;padding:14px;border-radius:12px;margin:12px 0;background:#10192a}.req strong{color:#ffdc84}.req p{margin:7px 0}.small{font-size:12px;color:#bac5d0}.admin-panel{background:#182b37;border:1px solid #538080;border-radius:14px;padding:18px}.admin-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.status{min-height:20px;color:#facb65}.icon{font-size:25px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}@media(max-width:650px){.cols,.grid3{grid-template-columns:1fr}.line{grid-template-columns:minmax(0,2fr) minmax(70px,1fr) auto}.line input,.line select{font-size:13px;padding:9px}.top .wrap{gap:5px}.logo{font-size:19px}.panel{padding:16px}.hero{padding:28px 0 18px}.standards{gap:3px}.standard{font-size:11px;padding:10px 2px}}
</style></head><body>
<header class="top"><div class="wrap"><div class="logo">⚡ CIVOL<b>TEN</b><small>ELÉTRICA & CONSTRUÇÃO CIVIL</small></div><button class="link" id="toggleAdmin" type="button">Área da empresa ↗</button></div></header>
<main class="wrap"><section id="customer">
<div class="hero"><span class="chip">SÃO PAULO • ATENDIMENTO ONLINE</span><h1>Seu orçamento começa <em>sem sair de casa.</em></h1><p>Envie fotos, vídeo, áudio e descrição do serviço. Faça uma simulação e receba uma avaliação personalizada.</p></div>
<form id="form" class="panel">
<h2>1. Sobre você e seu serviço</h2><p class="hint">Os dados são usados somente para avaliar seu pedido e entrar em contato.</p>
<div class="cols"><label class="field">Nome completo<input id="name" required minlength="2" maxlength="100" placeholder="Como podemos chamar você?"></label><label class="field">WhatsApp com DDD<input id="phone" inputmode="tel" required placeholder="(11) 99999-9999"></label><label class="field">Bairro / região<input id="neighborhood" maxlength="100" placeholder="Ex.: Vila Mariana"></label><label class="field">Cidade<input id="city" maxlength="100" value="São Paulo"></label></div>
<label class="field">Tipo de serviço<select id="category"><option value="eletrica">Instalações elétricas</option><option value="manutencao">Manutenção elétrica</option><option value="iluminacao">Iluminação / LED</option><option value="reforma">Reformas</option><option value="construcao">Construção civil</option><option value="pintura">Pintura e acabamento</option><option value="hidraulica">Hidráulica</option><option value="outros">Outros</option></select></label>
<label class="field">Descreva o que precisa<textarea id="description" required minlength="12" maxlength="4000" placeholder="Ex.: Quero trocar quatro tomadas e avaliar meu quadro elétrico..."></textarea></label>
<label class="field">Prazo desejado<select id="urgency"><option value="normal">Sem urgência</option><option value="breve">Nos próximos dias</option><option value="urgente">Urgente</option></select></label>
<hr class="divider"><h2>2. Fotos, vídeos e áudio</h2><p class="hint">Opcional: até 6 arquivos, 45 MB por arquivo e 120 MB no total. Não envie documentos pessoais nem imagens de terceiros sem permissão.</p>
<div class="upload"><label for="media">📷 Selecionar arquivos do celular</label><input id="media" type="file" accept="image/*,video/mp4,video/quicktime,video/webm,audio/*" multiple><button id="record" type="button" class="secondary">🎙️ Gravar explicação</button><ul class="list" id="selectedFiles"></ul></div>
<hr class="divider"><h2>3. Simulação de orçamento <span class="small">(opcional)</span></h2><p class="hint">Não sabe as medidas? Pode deixar esta parte vazia e enviar somente o pedido e as mídias.</p>
<div class="standards" role="group" aria-label="Padrão da obra"><button type="button" class="standard" data-p="baixo" aria-pressed="false">Baixo padrão</button><button type="button" class="standard" data-p="medio" aria-pressed="true">Médio padrão</button><button type="button" class="standard" data-p="alto" aria-pressed="false">Alto padrão</button></div>
<div id="items"></div><div class="actions"><button type="button" id="add" class="secondary">+ Adicionar serviço</button></div>
<div class="cols"><label class="field">Dias estimados<input id="days" type="number" min="1" max="365" step="1" value="1"></label><label class="field">Distância estimada (km)<input id="km" type="number" min="0" step="0.1" value="0"></label></div>
<button type="button" id="simulate" class="secondary">⚡ Calcular simulação</button><div id="price" class="price hidden"></div>
<hr class="divider"><label class="field" style="display:flex;flex-direction:row;align-items:flex-start"><input type="checkbox" id="consent" required style="margin:4px 10px 0 0"> Autorizo a CIVOLTEN a tratar os dados e arquivos enviados para avaliar meu pedido e entrar em contato.</label>
<input type="text" id="website" autocomplete="off" tabindex="-1" class="hidden" aria-hidden="true">
<div id="message" role="status"></div><div class="actions"><button id="submit" type="submit" class="primary">Enviar solicitação de orçamento →</button></div>
<p class="small">Esta versão está em fase de testes. Simulações não representam proposta vinculante. Visitas técnicas e riscos elétricos são avaliados individualmente.</p>
</form></section>
<section id="admin" class="hidden"><div class="hero"><span class="chip">ACESSO RESTRITO</span><h1>Painel <em>CIVOLTEN</em></h1><p>Somente contas autorizadas podem visualizar pedidos e anexos.</p></div>
<div class="panel" id="loginPanel"><h2>Entrar na área da empresa</h2><div class="cols"><label class="field">E-mail<input id="email" type="email" autocomplete="username"></label><label class="field">Senha<input id="password" type="password" autocomplete="current-password"></label></div><button id="login" type="button" class="primary">Entrar</button><p class="small">O acesso administrativo precisa ser habilitado pelo responsável no Supabase Auth.</p></div>
<div id="dashboard" class="panel hidden"><div class="admin-actions"><button class="secondary" id="refresh" type="button">↻ Atualizar pedidos</button><button class="secondary" id="logout" type="button">Sair</button></div><div id="requests"></div></div><div id="adminMessage" role="status"></div>
</section></main><footer class="footer"><div class="wrap"><b>⚡ CIVOLTEN</b> — Da fundação à energia, soluções completas.<p>Atendimento em São Paulo. Não manipule instalações energizadas. Dados e anexos de solicitações são privados e exigem autorização para consulta.</p></div></footer>
<script>
(function(){
var BASE='https://rvhnuowqfdugcecgmxnv.supabase.co';
var KEY='sb_publishable_UpkP7prNZFMBacZw31SuRg_8E-ea3TP';
var URL=location.pathname;
var catalog=[],files=[],padrao='medio',token=sessionStorage.getItem('civolten_admin_token')||'';
var $=id=>document.getElementById(id);
var brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
function msg(id,text,good){$(id).className=good?'good':'error';$(id).textContent=text;}
function clear(id){$(id).className='';$(id).textContent='';}
async function api(action,payload,method){
 var opt={method:method||'POST',headers:{'content-type':'application/json'}};
 if(token&&action.startsWith('admin-'))opt.headers.authorization='Bearer '+token;
 if(opt.method!=='GET')opt.body=JSON.stringify(payload||{});
 var r=await fetch(URL+'?api='+encodeURIComponent(action),opt);
 var j=await r.json().catch(()=>({error:'Resposta inválida do servidor'}));
 if(!r.ok)throw Error(j.error||'Não foi possível concluir');
 return j;
}
async function catalogLoad(){var d=await api('catalog',null,'GET');catalog=d.catalogo;$('add').disabled=false}
function getItems(){
 return Array.from($('items').querySelectorAll('.line')).map(row=>({servico_id:row.querySelector('select').value,quantidade:Number(row.querySelector('input').value)}));
}
function addItem(){
 if(!catalog.length)return;
 if($('items').children.length>=60)return;
 var row=document.createElement('div');row.className='line';
 var lab=document.createElement('label');lab.textContent='Serviço';var sel=document.createElement('select');
 catalog.forEach(s=>{var opt=document.createElement('option');opt.value=s.id;opt.textContent=s.descricao+' · '+s.unidade+' · '+brl(s[padrao]);sel.appendChild(opt)});lab.appendChild(sel);
 var ql=document.createElement('label');ql.textContent='Quantidade';var qi=document.createElement('input');qi.type='number';qi.min='.001';qi.step='.001';qi.value='1';ql.appendChild(qi);
 var remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Remover item';remove.onclick=()=>{row.remove();$('price').classList.add('hidden')};
 row.append(lab,ql,remove);$('items').appendChild(row);row.oninput=()=>{$('price').classList.add('hidden')};
}
function refreshOptions(){Array.from($('items').querySelectorAll('select')).forEach(sel=>{var x=sel.value;sel.replaceChildren();catalog.forEach(s=>{var opt=document.createElement('option');opt.value=s.id;opt.textContent=s.descricao+' · '+s.unidade+' · '+brl(s[padrao]);sel.appendChild(opt)});sel.value=x})}
document.querySelectorAll('.standard').forEach(x=>x.onclick=()=>{padrao=x.dataset.p;document.querySelectorAll('.standard').forEach(y=>y.setAttribute('aria-pressed',String(y===x)));refreshOptions();$('price').classList.add('hidden')});
$('add').disabled=true;$('add').onclick=addItem;
$('simulate').onclick=async()=>{clear('message');try{var items=getItems();if(!items.length)throw Error('Adicione ao menos um serviço para simular');$('simulate').disabled=true;var r=await api('simulate',{itens:items,padrao:padrao,dias:Number($('days').value),km:Number($('km').value)});var p=r.simulacao;$('price').replaceChildren();var small=document.createElement('small');small.textContent='SIMULAÇÃO PRELIMINAR — '+padrao.toUpperCase();var total=document.createElement('b');total.textContent=brl(p.total_bruto);var detail=document.createElement('span');detail.textContent='Serviços: '+brl(p.subtotal_servicos)+' · Logística: '+brl(p.taxa_logistica)+' · Deslocamento: '+brl(p.sobretaxa_distancia)+' · Imposto incluído: '+brl(p.imposto);var aviso=document.createElement('p');aviso.className='small';aviso.textContent=p.aviso;$('price').append(small,total,detail,aviso);$('price').classList.remove('hidden')}catch(e){msg('message',e.message,false)}finally{$('simulate').disabled=false}};
$('media').onchange=e=>{files=files.concat(Array.from(e.target.files||[]));if(files.length>6){files=files.slice(0,6);msg('message','Máximo de seis arquivos.',false)}showFiles();$('media').value=''};
function showFiles(){var ul=$('selectedFiles');ul.replaceChildren();files.forEach((f,i)=>{var li=document.createElement('li');li.textContent=f.name+' ('+(f.size/1048576).toFixed(1)+' MB) ';var del=document.createElement('button');del.type='button';del.className='link';del.textContent='Remover';del.onclick=()=>{files.splice(i,1);showFiles()};li.appendChild(del);ul.appendChild(li)})}
var recorder,parts=[],micStream;
$('record').onclick=async()=>{try{if(recorder&&recorder.state==='recording'){recorder.stop();$('record').textContent='🎙️ Gravar explicação';return}
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Gravação não disponível neste navegador');
 micStream=await navigator.mediaDevices.getUserMedia({audio:true});
 var ty=MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'';
 recorder=new MediaRecorder(micStream,ty?{mimeType:ty}:undefined);parts=[];
 recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
 recorder.onstop=()=>{var mime=recorder.mimeType||'audio/webm';var blob=new Blob(parts,{type:mime});files.push(new File([blob],'relato-'+Date.now()+(mime.includes('mp4')?'.m4a':'.webm'),{type:mime}));if(files.length>6)files=files.slice(0,6);showFiles();micStream?.getTracks().forEach(t=>t.stop())};
 recorder.start();$('record').textContent='■ Parar gravação';}catch(e){msg('message',e.message,false)}};
$('form').onsubmit=async e=>{e.preventDefault();clear('message');
 var submit=$('submit');try{
  if(!$('consent').checked)throw Error('Autorize o uso dos dados para enviar');
  var q={name:$('name').value.trim(),phone:$('phone').value,neighborhood:$('neighborhood').value,city:$('city').value,category:$('category').value,description:$('description').value,urgency:$('urgency').value,website:$('website').value,padrao:padrao,dias:Number($('days').value),km:Number($('km').value),itens:getItems()};
  if(!q.name||q.description.length<12||q.phone.replace(/\D/g,'').length<10)throw Error('Confira nome, WhatsApp e descrição');
  if(files.length>6||files.reduce((s,f)=>s+f.size,0)>120*1024*1024||files.some(f=>f.size>45*1024*1024))throw Error('Limite de arquivos ultrapassado');
  submit.disabled=true;submit.textContent='Preparando seu pedido…';
  var start=await api('start',{website:q.website});q.id=start.id;q.secret=start.secret;
  for(var i=0;i<files.length;i++){
   var f=files[i];submit.textContent='Enviando arquivo '+(i+1)+'/'+files.length+'…';
   var signed=await api('sign',{id:q.id,secret:q.secret,name:f.name,mime:f.type,size:f.size});
   var path=signed.path.split('/').map(encodeURIComponent).join('/');
   var res=await fetch(BASE+'/storage/v1/object/upload/sign/civolten-media/'+path+'?token='+encodeURIComponent(signed.token),{method:'PUT',headers:{'Content-Type':f.type,apikey:KEY},body:f});
   if(!res.ok)throw Error('Erro ao enviar '+f.name+': '+res.status);
  }
  submit.textContent='Registrando solicitação…';
  var saved=await api('submit',q);$('form').replaceChildren();
  var h=document.createElement('h2');h.textContent='✅ Solicitação enviada!';
  var p=document.createElement('p');p.textContent='Seu protocolo CIVOLTEN é '+saved.protocolo+'. Entraremos em contato pelo WhatsApp informado.';
  var sm=document.createElement('p');sm.className='hint';sm.textContent='Este envio não confirma preço final nem agendamento.';$('form').append(h,p,sm);
 }catch(ex){msg('message',ex.message||'Erro ao enviar',false);submit.disabled=false;submit.textContent='Enviar solicitação de orçamento →'}};
$('toggleAdmin').onclick=()=>{var on=$('admin').classList.contains('hidden');$('admin').classList.toggle('hidden',!on);$('customer').classList.toggle('hidden',on);$('toggleAdmin').textContent=on?'← Voltar ao site':'Área da empresa ↗';if(on&&token)refresh()};

var setupToken=new URLSearchParams(location.search).get('setup');
if(setupToken){
 $('admin').classList.remove('hidden');$('customer').classList.add('hidden');$('toggleAdmin').textContent='← Voltar ao site';
 var help=document.createElement('p');help.className='good';help.textContent='Primeiro acesso CIVOLTEN: crie seu e-mail e sua senha para abrir o painel. O convite é pessoal e pode ser usado uma única vez.';
 $('loginPanel').insertBefore(help,$('loginPanel').firstChild);
 var make=document.createElement('button');make.type='button';make.className='primary';make.style.margin='12px 8px 12px 0';make.textContent='Criar meu acesso administrativo';
 $('login').parentElement.insertBefore(make,$('login'));
 $('login').classList.add('hidden');
 make.onclick=async()=>{try{
  make.disabled=true;var email=$('email').value.trim(),password=$('password').value;
  await api('bootstrap',{token:setupToken,email:email,password:password});
  history.replaceState(null,'',location.pathname);setupToken=null;
  make.remove();$('login').classList.remove('hidden');msg('adminMessage','Acesso criado! Faça login com o e-mail e a senha que você escolheu.',true);
 }catch(e){msg('adminMessage',e.message,false);make.disabled=false}};
}
$('login').onclick=async()=>{clear('adminMessage');try{
 var email=$('email').value.trim(),password=$('password').value;
 if(!email||!password)throw Error('Informe e-mail e senha');
 var r=await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 var j=await r.json();if(!r.ok||!j.access_token)throw Error('Credenciais inválidas ou e-mail não confirmado');
 token=j.access_token;sessionStorage.setItem('civolten_admin_token',token);await refresh();
 }catch(e){msg('adminMessage',e.message,false)}};
$('refresh').onclick=refresh;
$('logout').onclick=()=>{token='';sessionStorage.removeItem('civolten_admin_token');$('dashboard').classList.add('hidden');$('loginPanel').classList.remove('hidden');clear('adminMessage')};
async function refresh(){
 try{var r=await api('admin-list',null,'GET');$('loginPanel').classList.add('hidden');$('dashboard').classList.remove('hidden');
 var area=$('requests');area.replaceChildren();var h=document.createElement('h2');h.textContent='Solicitações recebidas ('+r.pedidos.length+')';area.appendChild(h);
 r.pedidos.forEach(p=>{
  var box=document.createElement('div');box.className='req';
  var title=document.createElement('strong');title.textContent=p.customer_name+' · '+p.category+' · '+String(p.id).slice(0,8).toUpperCase();box.appendChild(title);
  var details=document.createElement('p');details.textContent=p.phone+' | '+(p.neighborhood||p.city||'Não informado')+' | '+new Date(p.submitted_at).toLocaleString('pt-BR');box.appendChild(details);
  var description=document.createElement('p');description.textContent=p.description;box.appendChild(description);
  if(p.simulacao){var ps=document.createElement('p');ps.textContent='Simulação: '+brl(p.simulacao.total_bruto)+' · '+p.simulacao.padrao;box.appendChild(ps)}
  (p.media||[]).forEach(m=>{var btn=document.createElement('button');btn.type='button';btn.className='link';btn.textContent='📎 '+m.original_name;btn.onclick=async()=>{try{
   var u=new URL(URL,location.origin);u.searchParams.set('api','admin-media');u.searchParams.set('id',p.id);u.searchParams.set('path',m.path);
   var res=await fetch(u,{headers:{authorization:'Bearer '+token}});var j=await res.json();if(!res.ok)throw Error(j.error);window.open(j.url,'_blank','noopener');
  }catch(e){msg('adminMessage',e.message,false)}};box.appendChild(btn)});
  var controls=document.createElement('div');controls.className='admin-actions';var state=document.createElement('select');['novo','analisando','aguardando_cliente','orcamento_enviado','visita_necessaria','concluido','recusado'].forEach(s=>{var o=document.createElement('option');o.value=s;o.textContent=s;state.appendChild(o)});state.value=p.status;
  var min=document.createElement('input');min.type='number';min.step='.01';min.placeholder='Mínimo R$';min.value=p.estimate_min??'';min.style.maxWidth='135px';
  var max=document.createElement('input');max.type='number';max.step='.01';max.placeholder='Máximo R$';max.value=p.estimate_max??'';max.style.maxWidth='135px';
  var notes=document.createElement('textarea');notes.maxLength=4000;notes.placeholder='Observações internas';notes.value=p.admin_notes||'';
  var save=document.createElement('button');save.className='primary';save.textContent='Salvar';save.type='button';
  save.onclick=async()=>{try{await api('admin-status',{id:p.id,status:state.value,min:min.value===''?null:Number(min.value),max:max.value===''?null:Number(max.value),notes:notes.value});msg('adminMessage','Pedido atualizado.',true)}catch(e){msg('adminMessage',e.message,false)}};
  var whatsapp=document.createElement('a');whatsapp.href='https://wa.me/55'+p.phone.replace(/\D/g,'');whatsapp.target='_blank';whatsapp.rel='noopener noreferrer';whatsapp.className='link';whatsapp.textContent='WhatsApp ↗';controls.append(state,min,max,save,whatsapp);box.append(controls,notes);area.appendChild(box);
 });
 }catch(e){msg('adminMessage',e.message||'Não foi possível abrir o painel',false);$('loginPanel').classList.remove('hidden');$('dashboard').classList.add('hidden')}}
catalogLoad().catch(e=>msg('message','Não foi possível carregar a tabela de serviços: '+e.message,false));
})();
</script></body></html>`;
