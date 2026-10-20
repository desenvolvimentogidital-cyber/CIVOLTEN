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
const feedback=$('cartFeedback');
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const safe=id=>typeof id==='string'&&/^[a-z0-9_:]{2,90}$/i.test(id);
const LIMIT=50;
let shown=0,matched=[],hasRendered=false,cache=[],dataKey='',timer;
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
 instalacao_chuveiro:'eletrica',instalacao_eletrica_completa:'eletrica',reforma_apartamento_completa:'reforma',
 construcao_residencial_completa:'construcao'
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
/* Acrescenta resultados automaticamente quando o cliente chega ao final da lista.
 * Mantemos lotes de 50 para não criar milhares de elementos de uma vez no celular. */
function loadNextBatch(){
 if(shown>=matched.length)return;
 const slice=matched.slice(shown,shown+LIMIT);
 for(const item of slice){
  const row=create('div','catalog-result');
  const detail=create('div','catalog-result-content');
  const name=create('strong','catalog-name',item.descricao);
  const meta=create('small','catalog-meta',item.unidade+' · '+(item.id.startsWith('siurb:')?'SIURB '+item.id.split(':')[1]:item.id.startsWith('sinapi:')?'SINAPI SP':'CIVOLTEN'));
  detail.append(name,meta);
  const action=create('button','catalog-add','+ Carrinho');
  action.type='button';
  action.setAttribute('aria-label','Adicionar '+item.descricao+' ao carrinho');
  action.addEventListener('click',()=>{
   const hadItems=api.getCart().length>0;
   const result=api.addCartItem(item.id,1);
   if(result.ok){
    // Serviço principal é escolhido conforme a primeira categoria; quando
    // mistura áreas diferentes, a categoria principal passa a "Outros".
    const main=$('category');
    const mapped={solar:'outros',pisos:'construcao',alvenaria:'construcao'};
    const candidate=mapped[item._group]||item._group;
    if(main){
     const supported=Array.from(main.options).some(x=>x.value===candidate);
     const name=supported?candidate:'outros';
     if(!hadItems)main.value=name;
     else if(main.value!==name)main.value='outros';
    }
   }
   showMessage(result.ok?'Serviço adicionado ao carrinho.':result.message,!result.ok);
   if(result.ok)renderCart();
  });
  row.append(detail,action);results.appendChild(row);
 }
 shown+=slice.length;
 status.textContent=shown+' de '+matched.length+' serviços exibidos. Role a lista para continuar.';
}
function renderCatalog(){
 updateCache();
 const phrase=normalize(query.value);
 const group=type.value;
 matched=cache.filter(item=>(group==='todos'||item._group===group)&&(!phrase||item._text.includes(phrase)));
 results.replaceChildren();
 results.scrollTop=0;
 shown=0;
 hasRendered=true;
 if(!matched.length){
  status.textContent='Nenhum serviço encontrado. Tente outra palavra ou consulte todos os serviços.';
  return;
 }
 loadNextBatch();
 // Em telas grandes ou filtros curtos, preencher até haver conteúdo para rolar.
 if(results.clientHeight>0){
  while(shown<matched.length&&results.scrollHeight<=results.clientHeight+60)loadNextBatch();
 }
}
function renderQuoteReview(items){
 const container=$('quoteCartItems'),count=$('quoteCartCount'),notice=$('quoteCartNotice');
 if(!container||!count)return;
 container.replaceChildren();
 count.textContent=items.length+' serviço'+(items.length===1?'':'s');
 if(!items.length){
  container.appendChild(create('p','cart-empty','Nenhum serviço selecionado. Pesquise acima e adicione ao carrinho.'));
  if(notice)notice.textContent='Selecione um serviço no catálogo antes de calcular.';
  return;
 }
 for(const item of items){
  const service=serviceLabel(item.servico_id);
  if(!service)continue;
  const row=create('div','quote-review-item');
  const name=create('strong','quote-review-name',service.descricao);
  const detail=create('span','quote-review-details',
   String(item.quantidade)+' '+service.unidade+
   (item.modalidade==='mao_obra'?' · Somente mão de obra':' · Serviço completo'));
  row.append(name,detail);
  container.appendChild(row);
 }
 if(notice)notice.textContent='Estes são os serviços do seu carrinho. Use Calcular simulação para consultar o valor estimado.';
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
 renderQuoteReview(items);
}
function refresh(){
 const previousKey=dataKey;
 updateCache();
 // Incluir um serviço no carrinho não deve jogar a busca novamente ao topo.
 if(!hasRendered||previousKey!==dataKey)renderCatalog();
 renderCart();
}
query.addEventListener('input',()=>{
 clearTimeout(timer);
 timer=setTimeout(renderCatalog,180);
});
type.addEventListener('change',renderCatalog);
results.addEventListener('scroll',()=>{
 if(shown<matched.length&&results.scrollHeight-results.scrollTop-results.clientHeight<=160)
  loadNextBatch();
},{passive:true});
$('cartGoSimulate').addEventListener('click',()=>{
 const selected=api.getCart();
 if(!selected.length){showMessage('Adicione um serviço antes de simular. Para serviços não encontrados, descreva sua necessidade abaixo.',true);query.focus();return;}
 $('simulacao').scrollIntoView({behavior:'smooth',block:'start'});
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
