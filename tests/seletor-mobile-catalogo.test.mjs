import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('home e telas derivadas apresentam seletor compacto com as dez categorias',()=>{
 for(const page of ['index.html','empresa.html','orcamento.html']){
  const html=read(page);
  const match=html.match(/<select id="quickCategorySelect"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(match,'seletor ausente em '+page);
  const options=[...match[1].matchAll(/<option value="([^"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(options,['eletrica','manutencao','iluminacao','solar','construcao','reforma','pisos','pintura','hidraulica','alvenaria']);
  assert.match(html,/aria-controls="quickSubservices"/);
  assert.match(html,/civolten-servicos-rapidos\.js\?v=3/);
  assert.match(html,/civolten\.js\?v=14/);
  assert.match(html,/civolten-app-unificado\.css\?v=4/);
 }
 const css=read('assets/civolten-app-unificado.css');
 assert.match(css,/\.quick-category-field\{display:none/);
 assert.match(css,/@media\(max-width:630px\)\{\s*\.landing-service-choices\{display:none!important/);
 assert.match(css,/\.quick-category-field\{display:block\}/);
 assert.match(css,/--cv-header-gradient:linear-gradient\(112deg,#0b203c 0%,#173c67 53%,#2b6094 100%\)/);
});

test('troca de categoria no seletor móvel sincroniza botões e serviços',()=>{
 const eventHandlers={};
 const select={value:'eletrica',addEventListener:(name,fn)=>eventHandlers[name]=fn};
 const container={replaceChildren(){},appendChild(){},querySelectorAll:()=>[{value:'pintura_alvenaria'}]};
 const elements={quickCategorySelect:select,quickSubservices:container,quickQuantity:{value:'1'}};
 const buttons=['eletrica','pintura','reforma'].map(group=>{
  const listeners={};
  return {dataset:{quickCategory:group},addEventListener:(e,fn)=>listeners[e]=fn,click(){listeners.click?.();this.clicked=true;}};
 });
 const document={
  getElementById:id=>elements[id]||null,
  querySelectorAll:()=>buttons,
  querySelector:q=>buttons.find(x=>q==='[data-quick-category="'+x.dataset.quickCategory+'"]')||null,
  createElement:tag=>({tag,append(){},appendChild(){},setAttribute(){}})
 };
 const context={window:{},document,Number,Array,Object};
 vm.runInNewContext(read('assets/civolten-servicos-rapidos.js'),context);
 select.value='pintura';eventHandlers.change({target:select});
 assert.equal(buttons[1].clicked,true);
 assert.equal(select.value,'pintura');
 const chosen=context.window.CIVOLTEN_QUICK_SELECTION.collect();
 assert.equal(chosen.category,'pintura');
 assert.deepEqual(Array.from(chosen.items),['pintura_alvenaria']);
 context.window.CIVOLTEN_QUICK_SELECTION.render('eletrica');
 assert.equal(select.value,'eletrica');
});

test('catálogo completo só é iniciado ao visitar a tela de orçamento',()=>{
 const core=read('assets/civolten.js');
 const start=core.indexOf('const pathname=window.location?.pathname;');
 const end=core.lastIndexOf('\n})();');
 assert.ok(start>0&&end>start,'bootstrap de catálogo ausente');
 const bootstrap=core.slice(start,end);
 const calls={};
 for(const route of ['/', '/empresa', '/orcamento', '/orcamento.html']){
  const stats={add:0,catalog:0};
  const context={
   window:{location:{pathname:route}},add(){stats.add++},loadCatalog(){stats.catalog++},
   $:()=>({}),Number
  };
  vm.runInNewContext(bootstrap,context);
  calls[route]=stats;
 }
 assert.deepEqual(calls['/'],{add:0,catalog:0});
 assert.deepEqual(calls['/empresa'],{add:0,catalog:0});
 assert.deepEqual(calls['/orcamento'],{add:1,catalog:1});
 assert.deepEqual(calls['/orcamento.html'],{add:1,catalog:1});
 // A origem de valores permanece a API; nunca gerar preços só no JS da vitrine.
 assert.doesNotMatch(read('assets/civolten-servicos-rapidos.js'),/\blocalStorage\b|\bsessionStorage\b|\bpreco\s*=/);
});
