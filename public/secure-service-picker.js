/* Busca de serviços da SIURB no orçamento autenticado.
 * Só dados do catálogo oficial podem preencher preço e unidade automaticamente.
 * Nunca confundir a seleção visual com a validação de preço feita no servidor. */
export const estimateServiceSubtotal=(quantity,unitCost)=>{
 const q=Number(quantity),p=Number(unitCost);
 if(!Number.isFinite(q)||!Number.isFinite(p)||q<0||p<0)return null;
 return q*p;
};
export const fmtServicePrice=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
export function catalogOptionHtml(x,esc){
 return '<button type="button" class="service-option" data-service-id="'+esc(x.id)+'" role="option" aria-label="Selecionar '+esc(x.description)+'">'+
  '<span class="service-title"><strong>'+esc(x.code)+'</strong> '+esc(x.description)+'</span>'+
  '<span class="service-meta">'+esc(x.category)+' · '+esc(x.unit)+' · <strong>'+fmtServicePrice(x.unit_cost)+'</strong></span></button>';
}
export function catalogFormHtml({field,esc,state}){
 const budget=state.detail,position=Math.max(1,...(budget.items||[]).map(x=>Number(x.position)||0))+1;
 return '<form id="catalog-item-form" autocomplete="off">'+
  '<div class="notice tiny"><strong>Catálogo SIURB:</strong> '+esc(budget.reference_month)+' · '+esc(budget.regime)+
  '. Busque pelo nome ou código. A escolha preenche os campos usando o banco de dados.</div>'+
  '<div class="field"><label for="catalog-name">Nome ou código do serviço *</label>'+
  '<input id="catalog-name" name="source_name" type="search" placeholder="Clique ou digite: concreto, pintura, 10001001…" autocomplete="off" aria-controls="service-options" aria-autocomplete="list" aria-expanded="true" required>'+
  '<small class="muted">Selecione uma das sugestões para vincular o preço ao catálogo.</small></div>'+
  '<div class="field"><label for="catalog-category">Categoria</label><select id="catalog-category" name="catalog_category"><option value="">Todas</option><option value="Edificações">Edificações</option><option value="Infraestrutura">Infraestrutura</option></select></div>'+
  '<div class="catalog-results" id="service-options" role="listbox" aria-label="Serviços do catálogo"></div>'+
  '<button type="button" class="btn catalog-more" id="catalog-more" hidden>Mostrar mais serviços</button>'+
  '<input type="hidden" name="reference_price_id" value="">'+
  '<div id="catalog-selection" class="notice tiny" hidden>Serviço SIURB selecionado: os dados abaixo são preenchidos automaticamente. <button type="button" class="btn" id="catalog-change">Trocar serviço</button></div>'+
  '<div class="two">'+field('Código do serviço','source_code','text',true,'','readonly')+
     field('Unidade','unit','text',true,'','readonly')+'</div>'+
  '<div class="two">'+field('Custo unitário direto SIURB (R$)','direct_unit_cost','number',true,'','readonly step="0.0001"')+
     field('Posição no orçamento','position','number',true,position,'min="1" max="10000" step="1"')+'</div>'+
  field('Quantidade a executar','quantity','number',true,1,'min="0.000001" max="10000000000" step="0.000001"')+
  '<div class="catalog-total"><span>Subtotal direto estimado</span><strong id="catalog-subtotal">Selecione um serviço</strong></div>'+
  '<p class="muted tiny">Preço de referência direto, sem aprovação de BDI, encargos, frete ou perdas adicionais. Revise os quantitativos antes de salvar.</p>'+
  '<div class="actions"><button class="btn primary" type="submit">Adicionar serviço ao orçamento</button>'+
  '<button type="button" class="btn" id="catalog-manual">Serviço próprio (manual)</button>'+
  '<button class="btn" data-action="close-dialog" type="button">Cancelar</button></div></form>';
}
export function showServiceCatalog({dialog,api,esc,field,state,toast,manual}){
 if(!state.detail?.id){toast('Abra um orçamento antes de adicionar serviço.',true);return}
 if(state.detail.status!=='rascunho'){toast('Apenas orçamentos em rascunho aceitam serviços.',true);return}
 dialog('Adicionar serviço do catálogo',catalogFormHtml({field,esc,state}));
 const form=document.querySelector('#catalog-item-form');
 const input=form.elements.source_name,select=form.elements.catalog_category;
 const results=form.querySelector('#service-options'),more=form.querySelector('#catalog-more');
 const selection=form.querySelector('#catalog-selection'),subtotal=form.querySelector('#catalog-subtotal');
 const price=form.elements.direct_unit_cost,quantity=form.elements.quantity,ref=form.elements.reference_price_id;
 let current=[],offset=0,hasMore=false,seq=0,debounce=null,selected=null;
 const updateSubtotal=()=>{
  const subtotalValue=estimateServiceSubtotal(quantity.value,price.value);
  subtotal.textContent=selected&&subtotalValue!==null?fmtServicePrice(subtotalValue):'Selecione um serviço';
 };
 const query=async(append=false)=>{
  const ticket=++seq,term=input.value.trim(),category=select.value;
  if(!append){offset=0;current=[];results.innerHTML='<p class="muted tiny">Pesquisando serviços…</p>'}
  const params=new URLSearchParams({budget_id:state.detail.id,q:term,category,offset:String(offset),limit:'25'});
  try{
   const found=await api('services/search?'+params);
   if(ticket!==seq||!form.isConnected)return;
   current=append?current.concat(found.items):found.items;
   hasMore=!!found.has_more;offset=current.length;
   results.innerHTML=current.length?current.map(row=>catalogOptionHtml(row,esc)).join(''):
    '<p class="muted tiny">Nenhum serviço encontrado para este regime e data-base. Experimente outro nome ou use o cadastro próprio.</p>';
   results.hidden=false;more.hidden=!hasMore;
  }catch(err){
   if(ticket!==seq||!form.isConnected)return;
   results.innerHTML='<p class="danger tiny">'+esc(err.message)+'</p>';more.hidden=true;
  }
 };
 const queue=()=>{
  clearTimeout(debounce);
  if(selected){selected=null;ref.value='';form.elements.source_code.value='';form.elements.unit.value='';price.value='';selection.hidden=true;updateSubtotal()}
  debounce=setTimeout(()=>query(),180);
 };
 input.addEventListener('input',queue);
 input.addEventListener('focus',()=>{if(!selected&&current.length===0)query()});
 select.addEventListener('change',()=>{if(selected){selected=null;ref.value='';price.value='';selection.hidden=true;input.readOnly=false}query()});
 more.addEventListener('click',()=>query(true));
 results.addEventListener('click',e=>{
  const btn=e.target.closest('[data-service-id]');if(!btn)return;
  const row=current.find(x=>x.id===btn.dataset.serviceId);if(!row)return;
  selected=row;ref.value=row.id;input.value=row.description;input.readOnly=true;
  form.elements.source_code.value=row.code;form.elements.unit.value=row.unit;
  price.value=row.unit_cost;
  selection.hidden=false;
  selection.firstChild.textContent='Selecionado: '+row.code+' · '+row.category+' · '+row.reference_month+' · '+row.regime+'. ';
  results.hidden=true;more.hidden=true;updateSubtotal();
  quantity.focus();
 });
 results.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   const buttons=[...results.querySelectorAll('.service-option')],at=buttons.indexOf(document.activeElement);
   const next=buttons[(at+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length];if(next){e.preventDefault();next.focus()}
  }
 });
 input.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){const b=results.querySelector('.service-option');if(b){e.preventDefault();b.focus()}}
 });
 form.querySelector('#catalog-change').addEventListener('click',()=>{
  selected=null;ref.value='';input.readOnly=false;input.value='';price.value='';form.elements.source_code.value='';form.elements.unit.value='';
  selection.hidden=true;updateSubtotal();input.focus();query();
 });
 form.querySelector('#catalog-manual').addEventListener('click',()=>{
  ++seq;clearTimeout(debounce);document.querySelector('#secure-dialog')?.remove();manual();
 });
 quantity.addEventListener('input',updateSubtotal);
 // O usuário pode clicar no campo vazio e já ver os serviços.
 query();
}
export function showOfficialServiceEdit({dialog,esc,field,item,state}){
 const n=estimateServiceSubtotal(item.quantity,item.direct_unit_cost);
 dialog('Editar quantidade do serviço SIURB',
  '<form id="catalog-edit-form" data-id="'+esc(item.id)+'"><div class="notice tiny"><strong>'+esc(item.source_code)+'</strong> — '+esc(item.source_name)+
  '<p>Fonte SIURB · '+esc(state.detail.reference_month)+' · '+esc(state.detail.regime)+'. Preço e unidade são preservados do catálogo.</p></div>'+
  '<div class="two">'+field('Unidade','unit','text',true,item.unit,'readonly')+
  field('Unitário SIURB (R$)','direct_unit_cost','number',true,item.direct_unit_cost,'readonly')+'</div>'+
  field('Quantidade a executar','quantity','number',true,item.quantity,'min="0.000001" step="0.000001"')+
  field('Posição no orçamento','position','number',true,item.position,'min="1" max="10000" step="1"')+
  '<div class="catalog-total">Subtotal direto estimado: <strong id="catalog-edit-subtotal">'+fmtServicePrice(n)+'</strong></div>'+
  '<div class="notice tiny">Ao mudar a quantidade, as revisões anteriores de medição e composição são invalidadas para nova conferência.</div>'+
  '<div class="actions"><button class="btn primary" type="submit">Salvar quantidade</button><button class="btn" type="button" data-action="close-dialog">Cancelar</button></div></form>');
 const form=document.querySelector('#catalog-edit-form');
 form.elements.quantity.addEventListener('input',()=>{
  form.querySelector('#catalog-edit-subtotal').textContent=fmtServicePrice(estimateServiceSubtotal(form.elements.quantity.value,item.direct_unit_cost));
 });
}
