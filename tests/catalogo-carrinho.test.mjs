import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const script=read('assets/civolten-carrinho.js');
const core=read('assets/civolten.js');

function mock(){
 const all={};
 function element(tag='div'){
  return {tag,children:[],listeners:{},value:'',textContent:'',classList:{toggle(){}},
   append(...kids){this.children.push(...kids)},appendChild(el){this.children.push(el)},
   replaceChildren(...kids){this.children=[...kids]},setAttribute(k,v){this[k]=v},
   addEventListener(k,fn){this.listeners[k]=fn},focus(){},scrollIntoView(){},
   click(){this.listeners.click?.({target:this})}
  };
 }
 for(const id of ['catalogFinder','catalogType','catalogQuery','catalogResults','finderStatus','cartList','cartSummary','cartFeedback','catalogResults','cartBadge','cartGoSimulate','cartDirectEstimate','lines','simulate','category'])
  all[id]=element();
 all.catalogType.value='todos'; all.category.options=['eletrica','pintura','construcao','outros'].map(value=>({value}));
 const items=[
  {id:'pintura_alvenaria',descricao:'Pintura de paredes',unidade:'m²',categoria:'construcao_civil'},
  {id:'reboco_interno',descricao:'Reboco interno',unidade:'m²',categoria:'construcao_civil'},
  {id:'siurb:EDIF:00001234',descricao:'PINTURA DE TETO EM LATEX',unidade:'m²'},
  {id:'siurb:INFRA:00004567',descricao:'INSTALAÇÃO DE TUBULAÇÃO HIDRÁULICA',unidade:'metro'},
  {id:'siurb:EDIF:00006789',descricao:'INSTALAÇÃO DE ELETRODUTO',unidade:'metro'},
  {id:'siurb:EDIF:00009999',descricao:'CONCRETO EM VIGAS',unidade:'m³'}
 ];
 const cartItems=[];
 const api={
  getCatalog:()=>items,
  getCart:()=>cartItems,
  addCartItem:(id,qty)=>{const x=cartItems.find(i=>i.servico_id===id);if(x)x.quantidade+=qty;else cartItems.push({servico_id:id,quantidade:qty,modalidade:'completo'});return {ok:true};},
  setCartQuantity:(id,qty)=>{const x=cartItems.find(i=>i.servico_id===id);if(!x)return false;x.quantidade=Number(qty);return true;},
  removeCartItem:id=>{const at=cartItems.findIndex(i=>i.servico_id===id);if(at<0)return false;cartItems.splice(at,1);return true;}
 };
 const win={location:{pathname:'/orcamento'},CIVOLTEN_FORM:api,queueMicrotask:fn=>fn()};
 const doc={getElementById:id=>all[id]||null,createElement:element,activeElement:null};
 vm.runInNewContext(script,{document:doc,window:win,Number,Array,Object,setTimeout:fn=>fn(),clearTimeout(){},Intl});
 return {all,win,api,cartItems};
}

test('busca e carrinho integram catálogo real ao formulário e ocultam preços unitários',()=>{
 const page=read('index.html');
 for(const id of ['catalogFinder','catalogType','catalogQuery','catalogResults','cartList','cartSummary','cartGoSimulate','cartDirectEstimate','cartTechnicalEditor','lines','simulate'])
  assert.match(page,new RegExp('id="'+id+'"'));
 assert.match(page,/civolten-carrinho\.js\?v=1/);
 assert.match(read('orcamento.html'),/civolten-carrinho\.js\?v=1/);
 assert.match(read('assets/civolten-app-unificado.css'),/\.catalog-layout\{display:grid/);
 assert.match(script,/CIVOLTEN_FORM/);
 assert.doesNotMatch(script,/innerHTML|localStorage|sessionStorage|\b(?:preco_unitario|precoTotal)\b/);
 assert.match(core,/addCartItem\(/);
 assert.match(core,/setCartQuantity\(/);
 assert.match(core,/removeCartItem\(/);
 assert.match(core,/getCatalog\(\)/);
 new vm.Script(script);
});

test('pesquisa filtra pela categoria e encontra serviços SIURB',()=>{
 const {all,win}=mock();
 all.catalogType.value='pintura';
 all.catalogType.listeners.change();
 assert.equal(all.catalogResults.children.length,2);
 assert.equal(win.CIVOLTEN_CARRINHO.category({id:'reboco_interno',descricao:'Reboco interno'}),'alvenaria');
 assert.equal(win.CIVOLTEN_CARRINHO.category({id:'pintura_alvenaria',descricao:'Pintura de paredes'}),'pintura');
 all.catalogQuery.value='teto';
 all.catalogQuery.listeners.input();
 assert.equal(all.catalogResults.children.length,1);
 assert.match(all.catalogResults.children[0].children[0].children[0].textContent,/TETO/);
 all.catalogType.value='todos';all.catalogType.listeners.change();
 assert.equal(all.catalogResults.children.length,1);
});

test('selecionar, aumentar quantidade e remover atualiza o mesmo carrinho real',()=>{
 const {all,cartItems,win}=mock();
 all.catalogQuery.value='teto';
 all.catalogQuery.listeners.input();
 const action=all.catalogResults.children[0].children[1];
 action.click();
 assert.equal(cartItems.length,1);
 assert.equal(cartItems[0].servico_id,'siurb:EDIF:00001234');
 assert.equal(all.cartBadge.textContent,'1');
 assert.equal(all.category.value,'pintura');
 const qty=all.cartList.children[0].children[1].children[0];
 qty.value='7.5';qty.listeners.change();
 assert.equal(cartItems[0].quantidade,7.5);
 const remove=all.cartList.children[0].children[1].children[1];
 remove.click();
 assert.equal(cartItems.length,0);
 assert.equal(all.cartBadge.textContent,'0');
 assert.match(all.cartList.children[0].textContent,/vazio/);
});

test('modo inicial da home e painel não executa a busca UI do catálogo',()=>{
 const s=read('assets/civolten-carrinho.js');
 assert.match(s,/\['\/orcamento','\/orcamento\.html'\]\.includes\(window\.location\.pathname\)/);
 assert.match(core,/if\(isQuotationPage\)\{/);
 assert.match(core,/loadSiurbCatalog\(\)/);
});
