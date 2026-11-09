// Página pública: sem login do cliente; acesso por link exclusivo + confirmação explícita.
const API=__CIVOLTEN_SUPABASE_URL__;
const KEY=__CIVOLTEN_SUPABASE_PUBLISHABLE_KEY__;
const E2E=__CIVOLTEN_E2E__===true&&['127.0.0.1','localhost'].includes(location.hostname);
let token='';
const $=id=>document.getElementById(id);
const money=n=>Number(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=value=>/^\d{4}-\d\d-\d\d$/.test(value||'')?value.slice(8)+'/'+value.slice(5,7)+'/'+value.slice(0,4):'—';
function text(id,value){$(id).textContent=String(value??'—')||'—';}
function error(message){$('error').hidden=false;text('error',message);$('loading').hidden=true;}
async function rpc(name,params){
 if(E2E){
  const {createE2EClient}=await import('./e2e-client.mjs');
  const ret=await createE2EClient().rpc(name,params);
  if(ret.error)throw Error(ret.error.message);
  return ret.data;
 }
 const response=await fetch(API+'/rest/v1/rpc/'+name,{
  method:'POST',mode:'cors',referrerPolicy:'no-referrer',
  headers:{'Content-Type':'application/json','apikey':KEY},
  body:JSON.stringify(params),cache:'no-store'
 });
 const payload=await response.json().catch(()=>null);
 if(!response.ok)throw Error(response.status===429?'Muitas tentativas. Tente novamente mais tarde.':
  payload?.message||'Falha de comunicação com o sistema.');
 return payload;
}
async function load(){
 const hash=new URLSearchParams(location.hash.slice(1)).get('t')||'';
 const cached=sessionStorage.getItem('cv_invite_link')||'';
 token=/^[0-9a-f]{64}$/.test(hash)?hash:cached;
 if(!/^[0-9a-f]{64}$/.test(token))return error('Link da proposta inválido. Peça um novo link à CIVOLTEN.');
 sessionStorage.setItem('cv_invite_link',token);
 // A chave não permanece visível na barra de endereços nem em histórico de navegação.
 history.replaceState(null,'',location.pathname);
 let p;
 try{p=await rpc('cv_proposal_lookup_v1',{p_token:token});}
 catch(err){return error('Não foi possível consultar a proposta: '+err.message);}
 if(!p?.available)return error('Esta proposta não está mais disponível. Solicite um novo link.');
 $('loading').hidden=true;$('content').hidden=false;
 text('heading',p.title);text('reference','Proposta '+p.reference);
 text('customer',p.customer);text('project',[p.project,p.location].filter(Boolean).join(' · '));
 text('validUntil',date(p.validUntil));text('total',money(p.totalCents));
 text('payment',p.paymentTerms||'A definir entre as partes');
 text('deadline',p.executionTerm||'A definir entre as partes');
 text('warranty',p.warrantyTerms||'A definir entre as partes');
 text('scopeNotes',p.scopeNotes||'Conforme os serviços e condições descritos.');
 const area=$('services');area.replaceChildren();
 for(const item of p.services||[]){
  const div=document.createElement('div'),name=document.createElement('span'),qty=document.createElement('small');
  div.className='service';name.textContent=item.description||'Serviço';
  qty.textContent=String(item.quantity)+' '+String(item.unit||'');
  div.append(name,qty);area.append(div);
 }
 if(p.status==='pending'){$('respond-form').hidden=false;return;}
 $('answered').hidden=false;
 text('answered',p.status==='accepted'?'Esta proposta já foi aceita e registrada.':
  p.status==='declined'?'Esta proposta já foi recusada e registrada.':
  'O prazo para responder a esta proposta encerrou. Solicite uma nova proposta.');
}
document.querySelectorAll('input[name="decision"]').forEach(x=>x.addEventListener('change',()=>{
 $('reason-wrap').hidden=x.value!=='declined'||!x.checked;
}));
$('respond-form').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget,$error=$('form-error');
 $error.hidden=true;
 if(!form.reportValidity())return;
 const fd=new FormData(form),decision=String(fd.get('decision')||'');
 if(!['accepted','declined'].includes(decision)){text('form-error','Selecione aceitar ou recusar.');$error.hidden=false;return;}
 const message=decision==='accepted'?'Confirmar ACEITE desta proposta de mão de obra?':'Confirmar RECUSA desta proposta?';
 if(!confirm(message))return;
 const send=$('send');send.disabled=true;send.textContent='Registrando resposta...';
 try{
  const result=await rpc('cv_proposal_respond_v1',{
   p_token:token,p_decision:decision,p_name:fd.get('name'),
   p_email:fd.get('email'),p_reason:fd.get('reason')||'',
   p_confirmed:fd.get('confirmed')==='on'
  });
  if(!result?.ok)throw Error('O sistema não confirmou sua resposta.');
  form.hidden=true;$('answered').hidden=false;
  text('answered',decision==='accepted'?
   'Aceite registrado com sucesso. A CIVOLTEN poderá consultar sua confirmação.':
   'Recusa registrada com sucesso. A CIVOLTEN poderá consultar sua resposta.');
  sessionStorage.removeItem('cv_invite_link');
 }catch(err){text('form-error',err.message||'Erro ao enviar resposta.');$error.hidden=false;}
 finally{send.disabled=false;send.textContent='Registrar minha resposta';}
});
load();
