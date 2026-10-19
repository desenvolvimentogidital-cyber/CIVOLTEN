/* Catálogo e carrinho CIVOLTEN.
 * Fonte única: o catálogo existente da API e as linhas reais do orçamento;
 * nunca exibir tabela privada de preços nem fabricar simulações no navegador.
 */
(function(){
'use strict';
if(!['/orcamento','/orcamento.html'].includes(window.location.pathname))return;
const api=window.CIVOLTEN_FORM;
const $=id=>document.getElementById(id);
if(!api||!$('catalogFinder'))return;
const directory=window.CIVOLTEN_QUICK_SELECTION?.directory||{};
const type=$('catalogType'),query=$('catalogQuery'),results=$('catalogResults');
const status=$('finderStatus'),cart=$('cartList'),cartSummary=$('cartSummary');
const feedback=$('cartFeedback'),more=$('catalogMore');
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const safe=id=>typeof id==='string'&&/^[a-z0-9_:]{2,90}$/i.test(id);
const LIMIT=30;
let page=1,cache=[],dataKey='',timer;
const groups=[
 ['iluminacao',/\b(?:luminaria|lampada|iluminacao|led|refletor|spot|arandela)\b/],
 ['solar',/\b(?:fotovoltaic|placa solar|painel solar|energia solar|modulo solar)\b/],
 ['pintura',/\b(?:pintura|tinta|verniz|textura acrilica|esmalte sintetico)\b/],
 ['pisos',/\b(?:piso|revestimento|porcelanato|ceramica|azulejo|pastilha|contrapiso)\b/],
 ['hidraulica',/\b(?:hidraulica|hidrossanitaria|tubulacao|esgoto|registro|valvula|torneira|sifao|bomba d.agua|agua fria|agua quente)\b/],
 ['manutencao',/\b(?:manutencao|reparo|conserto|revisao|substituicao)\b/],
 ['eletrica',/\b(?:eletrica|eletrico|eletroduto|tomada|interruptor|fiacao|cabeamento|disjuntor|aterramento|quadro de distribuicao|circuito)\b/],
 ['reforma',/\b(?:reforma|drywall|gesso acartonado|divisoria|demolicao)\b/],
 ['alvenaria',/\b(?:alvenaria|bloco|reboco|chapisco|argamassa|assentamento de tijolo)\b/],
 ['construcao',/\b(?:concreto|armadura|fundacao|sapata|viga|laje|pilar|estrutura|escavacao|terraplenagem)\b/]
];
const mapping={
 demolicao_alvenaria:'reforma',regularizacao_contrapiso:'pisos',levantamento_bloco:'alvenaria',
 reboco_interno:'alvenaria',drywall_pintura_premium:'reforma',assentamento_porcelanato:'pisos',
 assentamento_azulejo_pastilha:'pisos',pintura_alvenaria:'pintura',
 rasgo_parede_conduite:'eletrica',passagem_fiacao:'eletrica',quadro_distribuicao:'eletrica',
 ponto_tomada_interruptor:'eletrica',luminaria_spot_led:'iluminacao',fita_led_sanca:'iluminacao',
 instalacao_chuveiro:'eletrica',instalacao_eletrica_completa:'eletrica',reforma_apartamento_completa:'reforma'
};
function category(item){
 if(Object.hasOwn(mapping,item.id))return mapping[item.id];
 const label=normalize(item.descricao);
 for(const [key,pattern] of groups)if(pattern.test(label))return key;
 return 'outros';
}
function updateCache(){
 const items=api.getCatalog();
 const key=items.length+'|'+items[items.length-1]?.id+'|'+items[0]?.id;
 if(key===dataKey)return;
 dataKey=key;
 cache=items.filter(x=>safe(x.id)&&typeof x.descricao==='string'&&x.descricao.trim())
 .filter(x=>!/sistema de seguranca|automacao residencial|alarme monitorado/i.test(normalize(x.descricao)))
 .map(x=>({...x,_text:normalize(x.descricao+' '+x.id),_group:category(x)}));
 page=1;
}
function create(tag,cls,text){
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(text!==undefined)el.textContent=text;
 return el;
}
function serviceLabel(id){return cache.find(x=>x.id===id)||api.getCatalog().find(x=>x.id===id);}
function showMessage(text,error=false){
 feedback.textContent=text||'';
 feedback.classList.toggle('warn',!!error);
}
function renderCatalog(){
 updateCache();
 const phrase=normalize(query.value);
 const group=type.value;
 const list=cache.filter(item=>(group==='todos'||item._group===group)&&(!phrase||item._text.includes(phrase)));
 results.replaceChildren();
 const slice=list.slice(0,page*LIMIT);
 for(const item of slice){
  const row=create('div','catalog-result');
  const detail=create('div','catalog-result-content');
  const name=create('strong','catalog-name',item.descricao);
  const meta=create('small','catalog-meta',item.unidade+' · '+(item.id.startsWith('siurb:')?'SIURB '+item.id.split(':')[1]:'CIVOLTEN'));
  detail.append(name,meta);
  const action=create('button','catalog-add','+ Carrinho');
  action.type='button';
  action.setAttribute('aria-label','Adicionar '+item.descricao+' ao carrinho');
  action.addEventListener('click',()=>{
   const result=api.addCartItem(item.id,1);
   showMessage(result.ok?'Serviço adicionado ao carrinho.':result.message,!result.ok);
   if(result.ok)renderCart();
  });
  row.append(detail,action);results.appendChild(row);
 }
 const shown=slice.length;
 status.textContent=list.length?shown+' de '+list.length+' serviços nesta busca. '+cache.length+' cadastrados no catálogo.':'Nenhum serviço encontrado. Tente outra palavra ou consulte todos os serviços.';
 more.hidden=shown>=list.length;
 more.disabled=shown>=list.length;
}
function renderCart(){
 updateCache();
 const items=api.getCart();
 const previousFocused=document.activeElement;
 cart.replaceChildren();
 let totalQuantity=0;
 for(const item of items){
  const service=serviceLabel(item.servico_id);
  if(!service)continue;
  totalQuantity++;
  const row=create('div','cart-line');
  const title=create('strong','cart-name',service.descricao);
  const info=create('small','cart-meta',service.unidade+' · '+(item.modalidade==='mao_obra'?'Somente mão de obra':'Serviço completo'));
  const left=create('div','cart-description');left.append(title,info);
  const controls=create('div','cart-controls');
  const qty=create('input','cart-quantity');qty.type='number';qty.min=service.unidade==='unidade'?'1':'0.001';qty.step=service.unidade==='unidade'?'1':'0.001';qty.max='100000';qty.value=String(item.quantidade);
  qty.setAttribute('aria-label','Quantidade de '+service.descricao);
  qty.addEventListener('change',()=>{
   if(!api.setCartQuantity(item.servico_id,qty.value,item.modalidade)){
    showMessage('Quantidade inválida. Confira a unidade do serviço.',true);
    qty.value=String(item.quantidade);
   }else{showMessage('Quantidade atualizada.');renderCart();}
  });
  const rm=create('button','cart-remove','Remover');rm.type='button';
  rm.setAttribute('aria-label','Remover '+service.descricao+' do carrinho');
  rm.addEventListener('click',()=>{
   api.removeCartItem(item.servico_id,item.modalidade);showMessage('Serviço removido.');renderCart();
  });
  controls.append(qty,rm);row.append(left,controls);cart.appendChild(row);
 }
 if(!totalQuantity)cart.appendChild(create('p','cart-empty','Seu carrinho está vazio. Pesquise e adicione serviços para simular.'));
 cartSummary.textContent=totalQuantity+' serviço'+(totalQuantity===1?'':'s')+' selecionado'+(totalQuantity===1?'':'s');
 $('cartBadge').textContent=String(totalQuantity);
}
function refresh(){renderCatalog();renderCart();}
query.addEventListener('input',()=>{
 clearTimeout(timer);
 timer=setTimeout(()=>{page=1;renderCatalog();},180);
});
type.addEventListener('change',()=>{page=1;renderCatalog();});
more.addEventListener('click',()=>{page++;renderCatalog();});
$('cartGoSimulate').addEventListener('click',()=>{
 const selected=api.getCart();
 if(!selected.length){showMessage('Adicione um serviço antes de simular. Para serviços não encontrados, descreva sua necessidade abaixo.',true);query.focus();return;}
 $('simulate').scrollIntoView({behavior:'smooth',block:'center'});
 $('simulate').focus({preventScroll:true});
});
$('cartDirectEstimate').addEventListener('click',()=>{
 const selected=api.getCart();
 if(!selected.length){showMessage('Adicione um serviço antes de simular.',true);query.focus();return;}
 $('simulate').click();
});
$('lines').addEventListener('change',()=>{window.queueMicrotask?.(renderCart);});
$('lines').addEventListener('input',()=>{window.queueMicrotask?.(renderCart);});
$('lines').addEventListener('click',()=>{window.queueMicrotask?.(renderCart);});
window.CIVOLTEN_CARRINHO={refresh,category};
refresh();
})();
