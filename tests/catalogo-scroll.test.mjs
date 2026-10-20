import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const script=read('assets/civolten-carrinho.js');

function makeFixture(count=137){
 const dom={};
 function el(tag='div'){
  return {
   tag,children:[],listeners:{},value:'',textContent:'',hidden:false,
   clientHeight:0,scrollHeight:0,scrollTop:0,
   classList:{toggle(){}},append(...x){this.children.push(...x)},
   appendChild(x){this.children.push(x)},replaceChildren(...x){this.children=[...x]},
   addEventListener(name,fn){this.listeners[name]=fn},setAttribute(k,v){this[k]=v},
   focus(){},scrollIntoView(){},click(){this.listeners.click?.({target:this});}
  };
 }
 const ids=['catalogFinder','catalogType','catalogQuery','catalogResults','finderStatus',
  'cartList','cartSummary','cartFeedback','cartBadge','cartGoSimulate',
  'cartDirectEstimate','lines','simulate','category'];
 for(const id of ids)dom[id]=el();
 dom.catalogType.value='todos';
 dom.category.options=[{value:'eletrica'},{value:'outros'}];
 const records=Array.from({length:count},(_,i)=>({
  id:'servico_'+String(i).padStart(3,'0'),
  descricao:'INSTALAÇÃO ELÉTRICA '+String(i).padStart(3,'0'),
  unidade:'metro'
 }));
 const selected=[];
 let win;
 const api={
  getCatalog:()=>records,getCart:()=>selected,
  addCartItem(id,quantity){
   selected.push({servico_id:id,quantidade:quantity,modalidade:'completo'});
   win.CIVOLTEN_CARRINHO?.refresh();
   return {ok:true};
  },
  removeCartItem:()=>true,setCartQuantity:()=>true
 };
 win={location:{pathname:'/orcamento'},CIVOLTEN_FORM:api,queueMicrotask:fn=>fn()};
 const document={getElementById:id=>dom[id]||null,createElement:el,activeElement:null};
 vm.runInNewContext(script,{window:win,document,Number,Array,Object,setTimeout:fn=>fn(),clearTimeout(){},Intl});
 return {dom,records,selected,win};
}

test('lista carrega todos os serviços automaticamente durante a rolagem, sem Mostrar mais',()=>{
 const {dom,records}=makeFixture();
 const results=dom.catalogResults;
 assert.equal(records.length,137);
 assert.equal(results.children.length,50);
 assert.equal(dom.finderStatus.textContent,'50 de 137 serviços exibidos. Role a lista para continuar.');
 assert.equal(dom.catalogMore,undefined);
 assert.ok(!read('index.html').includes('id="catalogMore"'));
 assert.ok(!read('orcamento.html').includes('id="catalogMore"'));
 assert.ok(read('orcamento.html').includes('tabindex="0" aria-label="Lista rolável de serviços"'));
 results.scrollHeight=2200;results.clientHeight=400;results.scrollTop=1700;
 results.listeners.scroll();
 assert.equal(results.children.length,100);
 results.scrollHeight=4300;results.scrollTop=3990;
 results.listeners.scroll();
 assert.equal(results.children.length,137);
 results.listeners.scroll();
 assert.equal(results.children.length,137,'não duplicar itens no final');
 assert.equal(results.children[136].children[0].children[0].textContent,'INSTALAÇÃO ELÉTRICA 136');
});

test('adicionar ao carrinho preserva posição e serviços já carregados',()=>{
 const {dom,selected}=makeFixture();
 const results=dom.catalogResults;
 results.scrollHeight=2400;results.clientHeight=420;results.scrollTop=1900;
 results.listeners.scroll();
 assert.equal(results.children.length,100);
 const oldScroll=results.scrollTop;
 const action=results.children[89].children[1];
 action.click();
 assert.equal(selected.length,1);
 assert.equal(selected[0].servico_id,'servico_089');
 assert.equal(results.children.length,100);
 assert.equal(results.scrollTop,oldScroll);
 assert.equal(dom.cartBadge.textContent,'1');
});

test('buscar serviço filtra e troca de categoria reinicia listagem sem botão',()=>{
 const {dom}=makeFixture();
 const results=dom.catalogResults;
 dom.catalogQuery.value='ELÉTRICA 12';
 dom.catalogQuery.listeners.input();
 assert.equal(results.children.length,10);
 assert.equal(results.scrollTop,0);
 dom.catalogType.value='pintura';
 dom.catalogType.listeners.change();
 assert.equal(results.children.length,0);
 assert.match(dom.finderStatus.textContent,/Nenhum serviço encontrado/);
 dom.catalogType.value='todos';
 dom.catalogQuery.value='';
 dom.catalogType.listeners.change();
 assert.equal(results.children.length,50);
 assert.doesNotMatch(script,/catalogMore|more\.addEventListener/);
 assert.match(read('assets/civolten-app-unificado.css'),/body\[data-screen="orcamento"\] \.catalog-results\{overflow-y:auto/);
});
