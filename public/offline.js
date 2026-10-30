import {listOfflineDrafts,getOfflineDraft,putOfflineDraft,removeOfflineDraft,
 pendingChanges,validateOfflineQuantity} from './offline-store.js';
const container=document.querySelector('#offline-content');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
let selection=null;
function banner(message,bad=false){
 const div=document.createElement('p');div.className=bad?'offline-error':'offline-ok';div.textContent=message;
 container.prepend(div);setTimeout(()=>div.remove(),6500);
}
function renderDraft(draft){
 selection=draft;
 const changed=pendingChanges(draft).length;
 const totals=draft.items.reduce((n,item)=>n+Number(item.unit_cost)*Number(item.quantity),0);
 container.innerHTML='<div class="offline-row"><button class="btn" id="offline-back">← Todos os orçamentos</button>'+
  '<span class="tag">'+esc(changed)+' alteração(ões) não sincronizada(s)</span></div>'+
  '<div class="card offline-editor"><h2>'+esc(draft.code)+'</h2>'+
  '<p class="muted tiny">Última edição no dispositivo: '+esc(new Date(draft.saved_at).toLocaleString('pt-BR'))+
  '. Preços unitários foram copiados da referência na data em que você salvou o orçamento.</p>'+
  '<form id="offline-form"><div class="offline-items">'+draft.items.map((item,i)=>
   '<div class="offline-item"><div class="offline-item-head"><strong>'+esc(item.description)+'</strong>'+
   '<span>'+esc(item.code||'Serviço próprio')+'</span></div>'+
   '<div class="offline-item-fields"><label>Quantidade '+esc(item.unit)+
   '<input type="number" name="qty-'+i+'" min="0.000001" step="0.000001" max="10000000000" value="'+esc(item.quantity)+
   '" '+(item.reference_price_id?'':'disabled title="Serviço manual: somente consulta no modo offline"')+'></label>'+
   '<div><span>Unitário de referência</span><strong>'+esc(brl(item.unit_cost))+'</strong></div></div>'+
   (!item.reference_price_id?'<p class="muted tiny">Serviço próprio: altere somente quando estiver online.</p>':'')+
   '</div>').join('')+'</div>'+
  '<label class="offline-notes">Anotações locais (não sincronizadas)<textarea name="notes" rows="4" maxlength="2000" placeholder="Medições e observações para conferir depois">'+esc(draft.notes||'')+'</textarea></label>'+
  '<div class="offline-total"><span>Subtotal direto de referência (não é preço de venda)</span><strong>'+esc(brl(totals))+'</strong></div>'+
  '<div class="actions"><button class="btn primary" type="submit">Salvar neste celular</button>'+
  '<button class="btn" type="button" id="offline-delete">Apagar cópia local</button></div></form></div>';
 const form=document.querySelector('#offline-form');
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
   for(let i=0;i<draft.items.length;i++){
    if(!draft.items[i].reference_price_id)continue;
    draft.items[i].quantity=validateOfflineQuantity(form.elements['qty-'+i].value);
   }
   draft.notes=String(form.elements.notes.value).slice(0,2000);
   await putOfflineDraft(draft);renderDraft(draft);banner('Rascunho salvo neste celular. Ainda não foi sincronizado.');
  }catch(err){banner(err.message,true)}
 });
 document.querySelector('#offline-back').addEventListener('click',()=>refresh());
 document.querySelector('#offline-delete').addEventListener('click',async()=>{
  if(!confirm('Apagar definitivamente a cópia local? Alterações não enviadas serão perdidas.'))return;
  await removeOfflineDraft(draft.id);await refresh();
 });
}
async function refresh(){
 selection=null;
 try{
  const drafts=await listOfflineDrafts();
  container.innerHTML=drafts.length?
   '<h2>Orçamentos salvos neste dispositivo</h2><div class="offline-list">'+drafts.map(d=>
    '<button type="button" class="card offline-draft" data-id="'+esc(d.id)+'"><strong>'+esc(d.code)+'</strong>'+
    '<span>'+esc(d.items.length)+' serviços · '+esc(pendingChanges(d).length)+' alteração(ões) pendentes</span>'+
    '<small>Salvo '+esc(new Date(d.saved_at).toLocaleString('pt-BR'))+'</small></button>').join('')+'</div>':
   '<div class="card offline-empty"><h2>Ainda não há rascunhos offline</h2>'+
   '<p>Conecte-se ao CIVOLTEN, abra um orçamento em rascunho e toque em <strong>Salvar para usar offline</strong>. Depois poderá consultar e ajustar suas quantidades sem internet.</p>'+
   '<a class="btn primary" href="/secure.html">Abrir meus orçamentos</a></div>';
  container.querySelectorAll('[data-id]').forEach(button=>button.addEventListener('click',async()=>{
   const draft=await getOfflineDraft(button.dataset.id);if(draft)renderDraft(draft);
  }));
 }catch(e){container.innerHTML='<div class="notice"><strong>Modo offline indisponível:</strong> '+esc(e.message)+'</div>'}
}
document.querySelector('#offline-refresh').addEventListener('click',refresh);
refresh();
