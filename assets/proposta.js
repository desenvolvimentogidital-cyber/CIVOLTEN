(function(){
'use strict';
const $=id=>document.getElementById(id);
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n));
const params=new URLSearchParams(location.hash.replace(/^#/,''));
const id=params.get('id'),token=params.get('token');
const endpoint='https://rvhnuowqfdugcecgmxnv.supabase.co/functions/v1/civolten-beta';
const safe=(node,value)=>node.textContent=String(value??'');
const showError=t=>{safe($('status'),t);$('status').className='msg error';$('loading').classList.add('hidden');};
async function post(api,body){
 const res=await fetch(endpoint+'?api='+encodeURIComponent(api),{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',referrerPolicy:'no-referrer'
 });
 const data=await res.json().catch(()=>({error:'Resposta inválida'}));
 if(!res.ok)throw Error(data.error||'Não foi possível concluir.');
 return data;
}
async function load(){
 try{
  if(!/^[a-f0-9-]{36}$/i.test(id||'')||!/^[a-f0-9]{64}$/i.test(token||''))throw Error('Este link de proposta está incompleto.');
  const data=await post('client-view',{id,token});
  const p=data.proposal;
  safe($('customer'),p.name);safe($('description'),p.description);safe($('revision'),p.revision);
  const tbody=$('items');
  for(const item of p.items){
   const tr=document.createElement('tr');
   for(const v of [item.description,(Number(item.quantity).toLocaleString('pt-BR')+' '+item.unit),brl(item.unit_price),brl(item.line_total)]){
    const td=document.createElement('td');safe(td,v);tr.appendChild(td);
   }
   tbody.appendChild(tr);
  }
  safe($('grandTotal'),'Total: '+brl(p.total));
  const fields=[['Validade',p.terms?.validity_days?String(p.terms.validity_days)+' dias':''],
   ['Prazo de execução',p.terms?.deadline],['Forma de pagamento',p.terms?.payment],
   ['Serviços incluídos',p.terms?.included],['Não incluídos',p.terms?.excluded]];
  for(const [label,value] of fields)if(value){const line=document.createElement('p');const b=document.createElement('strong');safe(b,label+': ');line.append(b,document.createTextNode(String(value)));$('terms').appendChild(line);}
  if(p.decision!=='pending'){
   $('actions').classList.add('hidden');safe($('status'),'Esta proposta já foi respondida. Situação: '+({approved:'aprovada',rejected:'recusada',changes_requested:'ajustes solicitados'}[p.decision]||p.decision)+'.');$('status').className='msg ok';
  }
  $('loading').classList.add('hidden');$('proposal').classList.remove('hidden');
 }catch(e){showError(e.message);}
}
for(const [target,action,text] of [['approve','approved','aprovar'],['changes','changes_requested','solicitar alterações'],['reject','rejected','recusar']]){
 $(target).onclick=async()=>{
  if(!confirm('Deseja '+text+' esta proposta CIVOLTEN?'))return;
  try{
   $('approve').disabled=$('reject').disabled=$('changes').disabled=true;
   await post('client-decision',{id,token,action});
   $('actions').classList.add('hidden');
   safe($('status'),'Resposta registrada. A CIVOLTEN poderá acompanhar sua decisão.');
   $('status').className='msg ok';
  }catch(e){showError(e.message);$('approve').disabled=$('reject').disabled=$('changes').disabled=false;}
 };
}
load();
})();