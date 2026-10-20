import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

function element(tag='div'){
 return {
  tagName:tag,children:[],listeners:{},value:'',checked:false,textContent:'',dataset:{},
  append(...nodes){this.children.push(...nodes)},
  appendChild(node){this.children.push(node)},
  replaceChildren(...nodes){this.children=[...nodes]},
  addEventListener(event,fn){this.listeners[event]=fn},
  setAttribute(key,value){this[key]=value},
  focus(){},click(){this.listeners.click?.({target:this})},
  querySelectorAll(selector){
   const visit=node=>[node,...(node.children||[]).flatMap(visit)];
   const matches=visit(this).filter(n=>n.tagName==='input'&&n.name==='quickItem');
   if(selector==='input[name="quickItem"]:checked')return matches.filter(n=>n.checked);
   if(selector==='input[name="quickItem"]')return matches;
   return [];
  }
 };
}
function home(){
 const containers={
  quickSubservices:element('fieldset'),quickSelectionSummary:element('strong'),
  quickSelectedItems:element('div'),quickQuantity:element('input')
 };
 containers.quickQuantity.value='1';
 const buttons=['eletrica','manutencao','iluminacao','solar','construcao','reforma','pisos','pintura','hidraulica','alvenaria']
  .map(group=>Object.assign(element('button'),{dataset:{quickCategory:group}}));
 const document={
  getElementById(id){
   if(id==='quickDetails'||id==='quickWarning'){
    const walk=node=>[node,...(node.children||[]).flatMap(walk)];
    return walk(containers.quickSubservices).find(node=>node.id===id)||null;
   }
   return containers[id]||null;
  },
  querySelectorAll(selector){return selector==='[data-quick-category]'?buttons:[];},
  querySelector(selector){
   if(selector==='input[name="quickScope"]:checked')return {value:'completo'};
   return buttons.find(b=>selector==='[data-quick-category="'+b.dataset.quickCategory+'"]')||null;
  },
  createElement:element
 };
 const window={};
 vm.runInNewContext(read('assets/civolten-servicos-rapidos.js'),{window,document,Object,Array,Map,Set,Number});
 const choose=group=>buttons.find(b=>b.dataset.quickCategory===group).click();
 const mark=id=>{
  const check=containers.quickSubservices.querySelectorAll('input[name="quickItem"]').find(n=>n.value===id);
  assert.ok(check,'serviço não encontrado: '+id);
  check.checked=true;containers.quickSubservices.listeners.change?.();
 };
 return {window,document,containers,choose,mark};
}

test('home permite elétrica, pintura e construção juntas, preservando quantidade e observações',()=>{
 const h=home();
 h.mark('quadro_distribuicao');h.containers.quickQuantity.value='2';
 h.choose('pintura');
 h.mark('pintura_alvenaria');h.mark('avaliacao:pintura_tetos');
 h.containers.quickQuantity.value='5';
 h.document.getElementById('quickDetails').value='Pintar o teto do quarto';
 h.choose('construcao');h.mark('levantamento_bloco');
 h.containers.quickQuantity.value='3';
 h.choose('eletrica');
 assert.equal(h.containers.quickQuantity.value,'2');
 assert.equal(h.containers.quickSubservices.querySelectorAll('input[name="quickItem"]:checked')[0].value,'quadro_distribuicao');
 h.choose('pintura');
 assert.equal(h.containers.quickQuantity.value,'5');
 assert.equal(h.document.getElementById('quickDetails').value,'Pintar o teto do quarto');
 const chosen=h.window.CIVOLTEN_QUICK_SELECTION.collect();
 assert.equal(chosen.category,'outros');
 assert.deepEqual(Object.fromEntries(Array.from(chosen.selections,entry=>[entry.id,entry.quantity])),{
  quadro_distribuicao:2,levantamento_bloco:3,pintura_alvenaria:5
 });
 assert.match(chosen.details,/Pintura de tetos/);
 assert.match(chosen.details,/Pintar o teto do quarto/);
 assert.match(h.containers.quickSelectionSummary.textContent,/4 serviços selecionados em 3 categorias/);
});

test('cliente pode remover uma seleção de outra categoria pelo resumo',()=>{
 const h=home();
 h.mark('quadro_distribuicao');h.choose('pintura');h.mark('pintura_alvenaria');
 const chip=h.containers.quickSelectedItems.children.find(x=>x.children[0].textContent.includes('Quadro de distribuição'));
 assert.ok(chip);
 chip.children[1].click();
 const chosen=h.window.CIVOLTEN_QUICK_SELECTION.collect();
 assert.deepEqual(Array.from(chosen.items),['pintura_alvenaria']);
 assert.equal(chosen.category,'pintura');
});

test('Continuar envia todas as categorias e quantidades, orçamento recebe tudo',()=>{
 const chosen=home();
 chosen.mark('quadro_distribuicao');chosen.containers.quickQuantity.value='2';
 chosen.choose('pintura');chosen.mark('pintura_alvenaria');chosen.containers.quickQuantity.value='4';
 const list=chosen.window.CIVOLTEN_QUICK_SELECTION.collect();
 let destination='',payload=null,listener=null;
 const button={addEventListener(event,fn){if(event==='click')listener=fn;}};
 const nav={querySelectorAll(){return []}};
 const fakeDocument={
  body:{dataset:{}},getElementById:id=>id==='quickContinue'?button:null,
  querySelector(selector){if(selector==='.premium-site-nav')return nav;return null},
  querySelectorAll(){return []}
 };
 vm.runInNewContext(read('assets/civolten-routes.js'),{
  document:fakeDocument,
  window:{location:{pathname:'/',search:'',assign:url=>destination=url},
   CIVOLTEN_QUICK_SELECTION:{collect:()=>list}},
  URLSearchParams,JSON,Array,Number
 });
 assert.equal(typeof listener,'function');
 listener({preventDefault(){},stopImmediatePropagation(){}});
 const url=new URL(destination,'https://civolten.vercel.app');
 assert.equal(url.pathname,'/orcamento');
 assert.equal(url.searchParams.get('servico'),'outros');
 assert.equal(JSON.parse(url.searchParams.get('selecoes')).length,2);
 const documentQuote={
  body:{dataset:{}},getElementById(){return null},querySelector(){return null},querySelectorAll(){return []}
 };
 vm.runInNewContext(read('assets/civolten-routes.js'),{
  document:documentQuote,
  window:{location:{pathname:'/orcamento',search:url.search},
   CIVOLTEN_FORM:{prefillQuickSelection:x=>{payload=x;}}},
  URLSearchParams,JSON,Array,Number
 });
 assert.ok(payload);
 assert.deepEqual(Array.from(payload.selections,v=>({id:v.id,quantity:v.quantity})),[
  {id:'quadro_distribuicao',quantity:2},
  {id:'pintura_alvenaria',quantity:4}
 ]);
});

test('logo sem fundo branco no cabeçalho e azul técnico preservado',()=>{
 for(const path of ['assets/civolten-app-unificado.css','assets/civolten-servicos-unificado.css','assets/civolten-privacidade-unificado.css']){
  const css=read(path);
  assert.match(css,/--cv-logo-plate:transparent/);
  assert.match(css,/--cv-header-gradient:linear-gradient\(112deg,#0b203c 0%,#173c67 53%,#2b6094 100%\)/);
  assert.doesNotMatch(css,/background:var\(--cv-logo-plate\)/);
 }
 const app=read('assets/civolten-app-unificado.css');
 assert.match(app,/\.premium-header \.premium-logo-link\{padding:0;border:0;border-radius:0;background:transparent;box-shadow:none/);
 assert.match(read('assets/civolten-servicos-unificado.css'),/\.site-servicos \.header \.logo-link\{padding:0;border:0;border-radius:0;background:transparent;box-shadow:none/);
 assert.match(read('assets/civolten-privacidade-unificado.css'),/\.site-privacidade \.cv-page-header-inner>a\{padding:0;min-height:50px;border:0;border-radius:0;background:transparent;box-shadow:none/);
 assert.match(read('index.html'),/id="quickSelectedItems"/);
 assert.match(read('index.html'),/id="quickSelectionSummary"/);
});
