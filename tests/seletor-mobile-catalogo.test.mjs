import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('no celular o cliente usa só catálogo e carrinho, sem formulário duplicado',()=>{
 for(const page of ['index.html','empresa.html','orcamento.html']){
  const html=read(page);
  for(const retired of ['quickCategorySelect','quickSubservices','quickContinue'])
   assert.ok(!html.includes('id="'+retired+'"'),page);
  for(const id of ['catalogType','catalogResults','cartList','quoteContactDetails'])
   assert.ok(html.includes('id="'+id+'"'),page);
  assert.ok(html.includes('civolten-app-unificado.css?v=10'),page);
 }
 const css=read('assets/civolten-app-unificado.css');
 assert.ok(css.includes('@media(max-width:630px)'));
 assert.ok(css.includes('.quote-simulation-actions{grid-template-columns:1fr}'));
 assert.ok(css.includes('body[data-screen="inicio"] .landing-visual{height:245px'));
 assert.ok(css.includes('--cv-header-gradient:linear-gradient(112deg,#0b203c 0%,#173c67 53%,#2b6094 100%)'));
});

test('catálogo completo continua limitado ao orçamento, sem sobrecarregar a home e o painel',()=>{
 const core=read('assets/civolten.js');
 const start=core.indexOf('const pathname=window.location?.pathname;');
 const end=core.lastIndexOf(String.fromCharCode(10)+'})();');
 assert.ok(start>0&&end>start);
 const bootstrap=core.slice(start,end),calls={};
 for(const route of ['/','/empresa','/orcamento','/orcamento.html']){
  const stats={add:0,catalog:0};
  vm.runInNewContext(bootstrap,{
   window:{location:{pathname:route}},add(){stats.add++},
   loadCatalog(){stats.catalog++},$:()=>({}),Number
  });
  calls[route]=stats;
 }
 assert.deepEqual(calls['/'],{add:0,catalog:0});
 assert.deepEqual(calls['/empresa'],{add:0,catalog:0});
 assert.deepEqual(calls['/orcamento'],{add:1,catalog:1});
 assert.deepEqual(calls['/orcamento.html'],{add:1,catalog:1});
});
