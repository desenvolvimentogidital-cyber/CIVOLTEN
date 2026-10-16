
(function(){'use strict';
const API='https://rvhnuowqfdugcecgmxnv.supabase.co/functions/v1/civolten-beta';
const ROOT='https://rvhnuowqfdugcecgmxnv.supabase.co';
const KEY='sb_publishable_UpkP7prNZFMBacZw31SuRg_8E-ea3TP';
const FALLBACK_CATALOG=[{"id":"demolicao_alvenaria","descricao":"Demolição de alvenaria","unidade":"m²","categoria":"construcao_civil"},{"id":"regularizacao_contrapiso","descricao":"Regularização de contrapiso","unidade":"m²","categoria":"construcao_civil"},{"id":"levantamento_bloco","descricao":"Levantamento de blocos","unidade":"m²","categoria":"construcao_civil"},{"id":"reboco_interno","descricao":"Reboco interno","unidade":"m²","categoria":"construcao_civil"},{"id":"drywall_pintura_premium","descricao":"Drywall com pintura premium","unidade":"m²","categoria":"construcao_civil"},{"id":"assentamento_porcelanato","descricao":"Assentamento de porcelanato","unidade":"m²","categoria":"construcao_civil"},{"id":"assentamento_azulejo_pastilha","descricao":"Assentamento de azulejo/pastilha","unidade":"m²","categoria":"construcao_civil"},{"id":"pintura_alvenaria","descricao":"Pintura em alvenaria","unidade":"m²","categoria":"construcao_civil"},{"id":"rasgo_parede_conduite","descricao":"Rasgo em parede para conduíte","unidade":"metro","categoria":"instalacoes_eletricas"},{"id":"passagem_fiacao","descricao":"Passagem de fiação","unidade":"metro","categoria":"instalacoes_eletricas"},{"id":"quadro_distribuicao","descricao":"Quadro de distribuição","unidade":"unidade","categoria":"instalacoes_eletricas"},{"id":"ponto_tomada_interruptor","descricao":"Ponto de tomada/interruptor","unidade":"unidade","categoria":"instalacoes_eletricas"},{"id":"luminaria_spot_led","descricao":"Luminária ou spot LED","unidade":"unidade","categoria":"instalacoes_eletricas"},{"id":"fita_led_sanca","descricao":"Fita LED em sanca","unidade":"metro","categoria":"instalacoes_eletricas"},{"id":"instalacao_chuveiro","descricao":"Instalação de chuveiro","unidade":"unidade","categoria":"instalacoes_eletricas"},{"id":"instalacao_eletrica_completa","descricao":"Instalação elétrica completa (por área)","unidade":"m²","categoria":"instalacoes_eletricas"},{"id":"reforma_apartamento_completa","descricao":"Reforma completa de apartamento","unidade":"m²","categoria":"construcao_civil"}];
// Sessão administrativa: cookie HttpOnly na Vercel; nunca usar localStorage/sessionStorage.

const BRAZIL_DDDS=new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
function normalPhone(input){
 const digits=String(input||'').replace(/\D/g,'');
 const all=digits.length===11?'55'+digits:digits;
 return /^55[1-9]\d9\d{8}$/.test(all)&&BRAZIL_DDDS.has(all.slice(2,4))?'+'+all:null;
}
function maskedPhone(input){
 let d=String(input||'').replace(/\D/g,'');
 if(d.startsWith('55'))d=d.slice(2);
 d=d.slice(0,11);
 if(!d)return '';
 const area=d.slice(0,2),phone=d.slice(2);
 return '+55 ('+area+(area.length===2?') ':'')+phone.slice(0,5)+(phone.length>5?'-'+phone.slice(5):'');
}
const $=id=>document.getElementById(id), BRL=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
let catalog=FALLBACK_CATALOG,padrao='medio',files=[],recorder=null,stream=null,chunks=[];
$('phone').oninput=()=>{$('phone').value=maskedPhone($('phone').value);clearFieldError($('phone'))};
function message(where,t,ok=false){$(where).className='msg '+(ok?'ok':'error');$(where).textContent=t;}
function clean(where){$(where).className='';$(where).textContent='';}
// Mensagens por campo: exibe o que falta antes de chamar o servidor.
function clearFieldError(el){
 if(!el)return;
 el.removeAttribute?.('aria-invalid');
 const container=el.closest?.('label')||el.parentElement||el.parent;
 container?.querySelector?.('.field-error')?.remove?.();
}
function showRequiredErrors(errors,where='clientmsg'){
 if(!errors.length)return false;
 for(const {field,message:detail} of errors){
  if(!field)continue;
  field.setAttribute('aria-invalid','true');
  const parent=field.closest?.('label')||field.parentElement||field.parent;
  if(parent&&!parent.querySelector?.('.field-error')){
   const label=document.createElement('small');
   label.className='field-error';
   label.textContent=detail;
   parent.appendChild(label);
  }
 }
 message(where,'Corrija os campos indicados:\n'+errors.map(x=>'• '+x.message).join('\n'));
 const first=errors.find(x=>x.field)?.field;
 first?.scrollIntoView?.({behavior:'smooth',block:'center'});
 first?.focus?.({preventScroll:true});
 return true;
}
function resetFieldErrors(){
 document.querySelectorAll('.field-error').forEach(el=>el.remove());
 for(const id of ['name','phone','desc','consent','days','km']){
  $(id).removeAttribute?.('aria-invalid');
 }
 document.querySelectorAll('#lines .line').forEach(row=>{
  row.querySelector('select')?.removeAttribute?.('aria-invalid');
  row.querySelector('input')?.removeAttribute?.('aria-invalid');
 });
}
function clientRequiredErrors(){
 const issues=[];
 const name=$('name').value.trim(),phone=$('phone').value.trim(),description=$('desc').value.trim();
 if(!name)issues.push({field:$('name'),message:'Falta preencher o nome.'});
 else if(name.length<2)issues.push({field:$('name'),message:'Informe um nome com pelo menos 2 caracteres.'});
 if(!phone)issues.push({field:$('phone'),message:'Falta preencher o WhatsApp.'});
 else if(!normalPhone(phone))issues.push({field:$('phone'),message:'WhatsApp inválido: informe DDD e celular com 9 dígitos.'});
 if(!description)issues.push({field:$('desc'),message:'Falta preencher a descrição do serviço.'});
 else if(description.length<12)issues.push({field:$('desc'),message:'A descrição do serviço precisa de pelo menos 12 caracteres.'});
 if(!$('consent').checked)issues.push({field:$('consent'),message:'Falta autorizar o tratamento dos dados.'});
 return issues;
}
function simulationRequiredErrors(){
 const issues=[],rows=Array.from($('lines').querySelectorAll('.line'));
 if(!rows.length||!rows.some(row=>row.querySelector('select').value))
  issues.push({field:rows[0]?.querySelector('select')||$('add'),message:'Selecione pelo menos um serviço para simular.'});
 for(const row of rows){
  const select=row.querySelector('select'),input=row.querySelector('input');
  if(!select.value)continue;
  const amount=Number(input.value);
  const unit=catalog.find(s=>s.id===select.value)?.unidade;
  if(input.value.trim()===''||!Number.isFinite(amount)||amount<=0||amount>100000||
     Math.abs(amount*1000-Math.round(amount*1000))>1e-7||
     (unit==='unidade'&&!Number.isInteger(amount))){
   issues.push({field:input,message:'Informe uma quantidade válida para '+(catalog.find(s=>s.id===select.value)?.descricao||'o serviço')+'.'});
  }
 }
 const days=Number($('days').value),km=Number($('km').value);
 if($('days').value.trim()===''||!Number.isInteger(days)||days<1||days>365)
  issues.push({field:$('days'),message:'Informe os dias estimados (entre 1 e 365).'});
 if($('km').value.trim()===''||!Number.isFinite(km)||km<0||km>1000)
  issues.push({field:$('km'),message:'Informe a distância em km (de 0 a 1000).'});
 return issues;
}
for(const id of ['name','desc','days','km']){
 $(id).addEventListener?.('input',()=>clearFieldError($(id)));
}
$('consent').addEventListener?.('change',()=>clearFieldError($('consent')));

async function api(method,action,data,auth=false){
 const headers={'Content-Type':'application/json'};
 const target=auth?'/api/admin?action='+encodeURIComponent(action):API+'?api='+encodeURIComponent(action);
 const r=await fetch(target,{method,headers,credentials:auth?'same-origin':'omit',body:method==='GET'?undefined:JSON.stringify(data||{})});
 const response=await r.json().catch(()=>({error:'Resposta não reconhecida'}));
 if(!r.ok)throw Error(response.error||'Falha de conexão');
 return response;
}
$('toggle').onclick=()=>{const a=$('admin').classList.contains('hidden');$('admin').classList.toggle('hidden',!a);$('client').classList.toggle('hidden',a);$('toggle').textContent=a?'← Voltar ao orçamento':'Área da empresa ↗';if(a){fetch('/api/session',{credentials:'same-origin'}).then(r=>r.json()).then(s=>{if(s.authenticated)refresh();else $('loginbox').classList.remove('hidden')}).catch(()=>{})}};
function currentItems(){return Array.from($('lines').querySelectorAll('.line')).map(row=>({servico_id:row.querySelector('select').value,quantidade:Number(row.querySelector('input').value)})).filter(x=>x.servico_id);}
function clearEstimate(){$('estimate').classList.add('hidden');}
function choices(select,current){
 select.replaceChildren();
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Selecione o serviço...';select.appendChild(placeholder);
 catalog.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.descricao+' ('+s.unidade+')';select.appendChild(o)});
 select.value=current&&catalog.some(s=>s.id===current)?current:'';
}
function add(){
 if(!catalog.length||$('lines').children.length>=60)return;
 const row=document.createElement('div');row.className='line';
 const serviceLabel=document.createElement('label');serviceLabel.className='field';serviceLabel.textContent='Serviço';
 const select=document.createElement('select');select.setAttribute('aria-label','Escolha um serviço');choices(select);
 serviceLabel.appendChild(select);
 const qtyLabel=document.createElement('label');qtyLabel.className='field';qtyLabel.textContent='Quantidade';
 const quantity=document.createElement('input');quantity.type='number';quantity.min='0.001';quantity.max='100000';quantity.step='0.001';quantity.value='1';quantity.setAttribute('aria-label','Quantidade do serviço');
 qtyLabel.appendChild(quantity);
 const remove=document.createElement('button');remove.type='button';remove.className='remove-service';remove.textContent='×';remove.title='Remover este serviço';remove.setAttribute('aria-label','Remover este serviço');
 function updateUnit(){
  const service=catalog.find(s=>s.id===select.value);
  qtyLabel.firstChild.textContent='Quantidade'+(service?' ('+service.unidade+')':'');
  quantity.step=service?.unidade==='unidade'?'1':'0.001';
  quantity.min=service?.unidade==='unidade'?'1':'0.001';
  if(service?.unidade==='unidade'&&Number(quantity.value)%1)quantity.value=String(Math.ceil(Number(quantity.value)));
  clearEstimate();
 }
 select.onchange=updateUnit;
 quantity.oninput=clearEstimate;
 remove.onclick=()=>{row.remove();clearEstimate()};
 row.append(serviceLabel,qtyLabel,remove);
 $('lines').appendChild(row);
 updateUnit();
}
$('add').onclick=add;document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{padrao=b.dataset.p;document.querySelectorAll('[data-p]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const old=currentItems();$('lines').replaceChildren();old.forEach(o=>{add();const row=$('lines').lastElementChild;row.querySelector('select').value=o.servico_id;row.querySelector('input').value=o.quantidade});clearEstimate()});
$('simulate').onclick=async()=>{try{clean('clientmsg');resetFieldErrors();if(showRequiredErrors(simulationRequiredErrors()))return;const items=currentItems();$('simulate').disabled=true;const r=await api('POST','simulate',{itens:items,padrao,dias:Number($('days').value),km:Number($('km').value)});$('estimate').replaceChildren();const a=document.createElement('small');a.textContent='SIMULAÇÃO PRELIMINAR';const b=document.createElement('strong');const d=document.createElement('small');if(r.avaliacao_necessaria){b.textContent='Avaliação personalizada';d.textContent=r.mensagem||'Envie seu pedido para receber orçamento.';}else{b.textContent=BRL(r.simulacao.total_bruto);d.textContent='';}$('estimate').append(a,b,d);$('estimate').classList.remove('hidden');}catch(e){message('clientmsg',e.message)}finally{$('simulate').disabled=false}};
$('files').onchange=e=>{files.push(...Array.from(e.target.files||[]));if(files.length>6){files=files.slice(0,6);message('clientmsg','Máximo de seis arquivos.')}showFiles();$('files').value=''};
function showFiles(){$('filelist').replaceChildren();files.forEach((f,i)=>{const li=document.createElement('li');li.textContent=f.name+' ('+(f.size/1048576).toFixed(1)+' MB) ';const b=document.createElement('button');b.textContent='Remover';b.type='button';b.onclick=()=>{files.splice(i,1);showFiles()};li.appendChild(b);$('filelist').appendChild(li)})}
$('record').onclick=async()=>{try{if(recorder&&recorder.state==='recording'){recorder.stop();$('record').textContent='🎙️ Gravar áudio';return}if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Este navegador não permite gravação aqui. Grave fora e selecione o arquivo.');stream=await navigator.mediaDevices.getUserMedia({audio:true});let type=MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'';recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined);chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=()=>{let mime=(recorder.mimeType||'audio/webm').split(';')[0];let f=new File([new Blob(chunks,{type:mime})],'audio-'+Date.now()+(mime.includes('mp4')?'.m4a':'.webm'),{type:mime});files.push(f);if(files.length>6)files=files.slice(0,6);showFiles();stream?.getTracks().forEach(x=>x.stop())};recorder.start();$('record').textContent='■ Parar gravação';}catch(e){message('clientmsg',e.message)}};
$('send').onclick=async()=>{const btn=$('send');try{
 clean('clientmsg');resetFieldErrors();
 const problems=clientRequiredErrors();
 // A simulação é opcional; caso algum serviço tenha sido escolhido, sua quantidade precisa ser válida.
 const chosen=Array.from($('lines').querySelectorAll('.line')).some(row=>row.querySelector('select').value);
 if(chosen)problems.push(...simulationRequiredErrors().filter(x=>!x.message.startsWith('Selecione')));
 if(showRequiredErrors(problems))return;
 const normalized=normalPhone($('phone').value);
 const q={
  name:$('name').value.trim(),phone:normalized,city:$('city').value,
  neighborhood:$('neigh').value,description:$('desc').value.trim(),
  category:$('category').value,urgency:$('urgency').value,
  itens:currentItems(),padrao,dias:Number($('days').value),km:Number($('km').value),
  website:$('website').value,consent:true,privacy_version:'2026-10'
 };
 if(files.length>6||files.some(f=>f.size>45*1048576)||files.reduce((n,f)=>n+f.size,0)>120*1048576)throw Error('O tamanho dos arquivos excede o permitido.');btn.disabled=true;btn.textContent='Preparando pedido…';const start=await api('POST','start',q);q.id=start.id;q.secret=start.secret;for(let i=0;i<files.length;i++){let f=files[i];btn.textContent='Enviando arquivo '+(i+1)+'/'+files.length;let s=await api('POST','sign',{id:q.id,secret:q.secret,size:f.size,mime:f.type.split(';')[0],name:f.name});let path=s.path.split('/').map(encodeURIComponent).join('/');let url=ROOT+'/storage/v1/object/upload/sign/civolten-media/'+path+'?token='+encodeURIComponent(s.token);let upload=await fetch(url,{method:'PUT',headers:{'Content-Type':f.type.split(';')[0],apikey:KEY},body:f});if(!upload.ok)throw Error('Falha ao enviar '+f.name+' (HTTP '+upload.status+').')}btn.textContent='Finalizando…';const r=await api('POST','submit',q);message('clientmsg','✅ Pedido registrado com sucesso! Protocolo CIVOLTEN: '+r.protocolo+'.',true);$('send').disabled=true;$('send').textContent='Pedido enviado';}catch(e){message('clientmsg',e.message);btn.disabled=false;btn.textContent='Enviar pedido de orçamento →'}};
$('activate').onclick=async()=>{const b=$('activate');try{clean('adminmsg');b.disabled=true;await api('POST','bootstrap',{token:$('setupToken').value.trim(),email:$('email').value.trim(),password:$('password').value});$('setupToken').value='';message('adminmsg','Conta criada! Agora clique em Entrar usando o e-mail e senha escolhidos.',true)}catch(e){message('adminmsg',e.message)}finally{b.disabled=false}};
$('login').onclick=async()=>{
 try{
  clean('adminmsg');
  const r=await fetch('/api/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});
  const result=await r.json();
  if(!r.ok||!result.authenticated)throw Error(result.error||'Acesso negado');
  $('password').value='';await refresh();
 }catch(e){message('adminmsg',e.message)}
};
$('logout').onclick=async()=>{
 try{await fetch('/api/session',{method:'DELETE',credentials:'same-origin'})}catch{}
 $('dashboard').classList.add('hidden');$('loginbox').classList.remove('hidden');$('pricingArea').classList.add('hidden');
};$('refresh').onclick=refresh;
$('pricingToggle').onclick=async()=>{const area=$('pricingArea');const opening=area.classList.contains('hidden');area.classList.toggle('hidden',!opening);if(opening)await loadPrices()};
async function loadPrices(){
 try{
  const data=await api('GET','admin-pricing',null,true);
  $('pricingList').replaceChildren();
  data.catalogo.forEach(s=>{
   const box=document.createElement('div');box.className='order';
   const h=document.createElement('h3');h.textContent=s.description+' ('+s.unit+')';box.appendChild(h);
   const grid=document.createElement('div');grid.className='grid';const fields={},pending={};
   for(const p of ['baixo','medio','alto']){
    const wrapper=document.createElement('div');
    const lbl=document.createElement('label');lbl.className='field';lbl.textContent=p.toUpperCase()+' — R$';
    const inp=document.createElement('input');inp.type='number';inp.min='1';inp.max='100000';inp.step='.01';inp.value=s[p]>0?s[p]:'';
    const checkLabel=document.createElement('label');checkLabel.className='field';checkLabel.style.fontWeight='400';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=Number(s[p])===0;
    checkLabel.append(checkbox,document.createTextNode(' Preço pendente (não simular)'));
    inp.disabled=checkbox.checked;
    checkbox.onchange=()=>{inp.disabled=checkbox.checked;if(checkbox.checked)inp.value=''};
    lbl.appendChild(inp);wrapper.append(lbl,checkLabel);grid.appendChild(wrapper);
    fields[p]=inp;pending[p]=checkbox;
   }
   const actions=document.createElement('div');actions.className='row';
   const save=document.createElement('button');save.type='button';save.textContent='Salvar preços';
   const feedback=document.createElement('span');feedback.className='hint';
   save.onclick=async()=>{
    try{
     save.disabled=true;
     const values={id:s.service_id,pendentes:[]};
     for(const p of ['baixo','medio','alto']){
      if(pending[p].checked){values[p]=0;values.pendentes.push(p);continue}
      if(fields[p].value.trim()==='')throw Error('Informe um preço ou marque como pendente.');
      const value=Number(fields[p].value);
      if(!Number.isFinite(value)||value<1||value>100000||Math.round(value*100)/100!==value)throw Error('Preço deve ficar entre R$ 1 e R$ 100.000 com até 2 decimais.');
      values[p]=value;
     }
     if((values.baixo>0&&values.medio>0&&values.baixo>values.medio)||
        (values.medio>0&&values.alto>0&&values.medio>values.alto)||
        (values.baixo>0&&values.alto>0&&values.baixo>values.alto))throw Error('Preços crescentes: baixo ≤ médio ≤ alto.');
     await api('POST','admin-pricing',values,true);
     feedback.textContent='Valores salvos.';feedback.style.color='#8cffc4';
    }catch(e){
     feedback.textContent=e.message;feedback.style.color='#ff9cae';
    }finally{save.disabled=false;}
   };
   actions.append(save,feedback);box.append(grid,actions);$('pricingList').appendChild(box);
  });
 }catch(e){message('adminmsg','Falha ao carregar preços internos: '+e.message)}
}
// Arquivos do orçamento são sempre privados; somente o admin pode gerar.
function quotePdfUrl(id,mode){
 return '/api/quote-pdf?id='+encodeURIComponent(id)+'&mode='+encodeURIComponent(mode)+'&layout=detalhado-v3';
}
async function prepareQuotePdf(id){
 const response=await fetch(quotePdfUrl(id,'final'),{credentials:'same-origin',cache:'no-store'});
 if(!response.ok){
  const err=await response.json().catch(()=>({error:'Falha ao gerar PDF'}));
  throw Error(err.error||'Não foi possível gerar o orçamento.');
 }
 const blob=await response.blob();
 if(blob.type!=='application/pdf'||blob.size<400)throw Error('O servidor não retornou um PDF válido.');
 const filename='CIVOLTEN-'+id.slice(0,8).toUpperCase()+'-ORCAMENTO.pdf';
 return {blob,filename};
}
function downloadQuote(blob,filename){
 const objectUrl=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=objectUrl;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
}
async function shareQuote(id,phone){
 const {blob,filename}=await prepareQuotePdf(id);
 const file=new File([blob],filename,{type:'application/pdf'});
 if(navigator.share&&navigator.canShare?.({files:[file]})){
  try{
   await navigator.share({files:[file],title:'Orçamento CIVOLTEN',text:'Segue o orçamento solicitado. Confira as condições.'});
   return;
  }catch(e){if(e.name==='AbortError')return;throw e}
 }
 // wa.me não anexa arquivos automaticamente: fazer download e pedir anexo manual.
 downloadQuote(blob,filename);
 const whatsapp=normalPhone(phone);
 message('adminmsg','PDF baixado. Anexe o arquivo no WhatsApp para enviar ao cliente.',true);
 if(whatsapp)window.open('https://wa.me/'+whatsapp.slice(1)+'?text='+encodeURIComponent('Olá! Segue o orçamento da CIVOLTEN. Vou anexar o PDF nesta conversa.'),'_blank','noopener,noreferrer');
}
async function refresh(){try{const d=await api('GET','admin-list',null,true);$('loginbox').classList.add('hidden');$('dashboard').classList.remove('hidden');const frag=document.createDocumentFragment();const h=document.createElement('h2');h.textContent='Pedidos recebidos: '+d.pedidos.length;frag.appendChild(h);d.pedidos.forEach(x=>{const box=document.createElement('div');box.className='order';const title=document.createElement('h3');title.textContent=x.customer_name+' • '+x.category+' • '+x.id.slice(0,8).toUpperCase();const p=document.createElement('p');p.textContent=x.description;const info=document.createElement('small');info.textContent=(x.phone||'')+' • '+(x.neighborhood||x.city||'')+' • '+new Date(x.submitted_at).toLocaleString('pt-BR');box.append(title,info,p);if(x.request_details?.itens?.length){const t=document.createElement('p');const names=new Map(catalog.map(z=>[z.id,z.descricao]));t.textContent='Serviços solicitados: '+x.request_details.itens.map(z=>(names.get(z.servico_id)||z.servico_id)+' × '+z.quantidade).join('; ')+' | Padrão: '+(x.request_details.padrao||'não informado');box.appendChild(t)}if(x.simulacao){const sim=document.createElement('p');sim.textContent='Simulação: '+BRL(x.simulacao.total_bruto);box.appendChild(sim)}(x.media||[]).forEach(m=>{const b=document.createElement('button');b.textContent='📎 '+m.original_name;b.onclick=async()=>{try{const u='/api/admin?action=admin-media&id='+encodeURIComponent(x.id)+'&path='+encodeURIComponent(m.path);
 const rr=await fetch(u,{credentials:'same-origin'}),j=await rr.json();
 if(!rr.ok)throw Error(j.error||'Acesso negado');
 const mediaURL=new URL(j.url);
 if(mediaURL.protocol!=='https:'||mediaURL.hostname!=='rvhnuowqfdugcecgmxnv.supabase.co'||!mediaURL.pathname.startsWith('/storage/v1/object/sign/civolten-media/'))throw Error('URL de anexo inválida');
 window.open(mediaURL.href,'_blank','noopener,noreferrer')}catch(e){message('adminmsg',e.message)}};box.appendChild(b)});const status=document.createElement('select');['novo','analisando','aguardando_cliente','orcamento_enviado','visita_necessaria','concluido','recusado'].forEach(s=>{let o=document.createElement('option');o.value=s;o.textContent=s;status.appendChild(o)});status.value=x.status;const amount=document.createElement('input');amount.type='number';amount.step='.01';amount.min='0.01';amount.placeholder='Valor total do orçamento (R$)';amount.inputMode='decimal';
 const same=(x.estimate_min!==null&&x.estimate_min!==undefined&&x.estimate_max!==null&&Number(x.estimate_min)===Number(x.estimate_max));
 let savedAmount=same?Number(x.estimate_min):(x.simulacao?.total_bruto??null);
 amount.value=savedAmount??'';
 const amountLabel=document.createElement('label');amountLabel.className='field';amountLabel.textContent='Valor total para o cliente (R$)';amountLabel.appendChild(amount);
 const checkSaved=()=>{
  const typed=amount.value.trim()===''?null:Number(amount.value);
  clearFieldError(amount);
  if(typed===null&&savedAmount===null){showRequiredErrors([{field:amount,message:'Falta informar o valor total do orçamento.'}],'adminmsg');throw Error('Falta informar o valor total do orçamento.');}
  if(typed!==null&&(!Number.isFinite(typed)||typed<=0||typed>100000000)){showRequiredErrors([{field:amount,message:'Informe um valor total válido.'}],'adminmsg');throw Error('Informe um valor total válido.');}
  if(typed!==savedAmount){showRequiredErrors([{field:amount,message:'Salve o valor total antes de gerar o PDF.'}],'adminmsg');throw Error('Salve o valor total antes de gerar o PDF.');}
 };const notes=document.createElement('textarea');notes.placeholder='Observações internas';notes.value=x.admin_notes||'';notes.maxLength=4000;const save=document.createElement('button');save.textContent='Salvar orçamento/status';save.onclick=async()=>{try{
 const total=amount.value.trim()===''?null:Number(amount.value);
 clearFieldError(amount);
 if(total===null&&x.simulacao?.total_bruto==null){
  showRequiredErrors([{field:amount,message:'Falta preencher o valor total do orçamento.'}],'adminmsg');
  return;
 }
 if(total!==null&&(!Number.isFinite(total)||total<=0||total>100000000||Math.round(total*100)/100!==total)){
  showRequiredErrors([{field:amount,message:'Informe um valor total válido, com até 2 casas decimais.'}],'adminmsg');
  return;
 }
 await api('POST','admin-status',{id:x.id,status:status.value,min:total,max:total,notes:notes.value},true);
 savedAmount=total;message('adminmsg','Valor total e situação salvos.',true)}catch(e){message('adminmsg',e.message)}};const wa=document.createElement('a');wa.href=normalPhone(x.phone)?'https://wa.me/'+normalPhone(x.phone).slice(1):'#';wa.target='_blank';wa.rel='noopener noreferrer';wa.textContent='Abrir WhatsApp ↗';if(!normalPhone(x.phone)){wa.textContent='WhatsApp inválido';wa.removeAttribute('href');}box.append(status,amountLabel,notes,save,wa);
 const pdfActions=document.createElement('div');pdfActions.className='row';
 const previewBtn=document.createElement('button');previewBtn.type='button';previewBtn.textContent='Ver prévia interna PDF';
 previewBtn.title='Documento interno com a simulação enviada pelo cliente';
 previewBtn.onclick=()=>window.open(quotePdfUrl(x.id,'preview'),'_blank','noopener,noreferrer');
 const downloadBtn=document.createElement('button');downloadBtn.type='button';downloadBtn.textContent='Baixar orçamento detalhado';
 downloadBtn.onclick=async()=>{
  try{downloadBtn.disabled=true;checkSaved();const {blob,filename}=await prepareQuotePdf(x.id);downloadQuote(blob,filename);message('adminmsg','PDF do orçamento baixado. Você pode enviar ao cliente.',true)}
  catch(e){message('adminmsg',e.message)}
  finally{downloadBtn.disabled=false}
 };
 const shareBtn=document.createElement('button');shareBtn.type='button';shareBtn.className='goldbtn';shareBtn.textContent='Compartilhar PDF';
 shareBtn.onclick=async()=>{
  try{shareBtn.disabled=true;checkSaved();await shareQuote(x.id,x.phone)}
  catch(e){message('adminmsg',e.message)}
  finally{shareBtn.disabled=false}
 };
 pdfActions.append(previewBtn,downloadBtn,shareBtn);
 const pdfHint=document.createElement('p');pdfHint.className='hint';
 pdfHint.textContent='Prévia interna: valor de referência. PDF do cliente: serviços selecionados, quantidades, preço de cada serviço e total. Se alterar o valor, salve antes de compartilhar. Custos internos permanecem privados.';
 box.append(pdfActions,pdfHint);frag.appendChild(box)});$('orders').replaceChildren(frag)}catch(e){message('adminmsg',e.message);$('dashboard').classList.add('hidden');$('loginbox').classList.remove('hidden')}}
async function loadCatalog(){
 const status=$('catalogstatus'),retry=$('retryCatalog');
 status.textContent='Atualizando catálogo de serviços...';status.classList.remove('warn');retry.classList.add('hidden');
 try{
  const response=await api('GET','catalog');
  if(!Array.isArray(response.catalogo)||!response.catalogo.length)throw Error('Catálogo vazio');
  if(response.catalogo.some(s=>!s.id||!s.descricao||!s.unidade))throw Error('Itens inválidos');
  catalog=response.catalogo;
  document.querySelectorAll('#lines .line').forEach(row=>{
   const select=row.querySelector('select'),old=select.value;
   choices(select,old);
   select.dispatchEvent(new Event('change'));
  });
  status.textContent=catalog.length+' serviços disponíveis. Escolha um serviço e informe a quantidade.';
 }catch(e){
  status.textContent='Não foi possível atualizar os serviços ('+e.message+'). A lista básica continua disponível; tente atualizar antes de enviar.';
  status.classList.add('warn');retry.classList.remove('hidden');
 }
}
$('retryCatalog').onclick=loadCatalog;
add(); // Sempre mostra o primeiro formulário, mesmo com a API temporariamente indisponível.
loadCatalog();
})();
