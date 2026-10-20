import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('no celular o cliente usa só o catálogo e o carrinho, sem duplicidade',()=>{
 for(const page of ['index.html','empresa.html','orcamento.html']){
  const html=read(page);
  assert.doesNotMatch(html,/id="quickCategorySelect"|id="quickSubservices"|id="quickContinue"/);
  assert.match(html,/id="catalogType"/);
  assert.match(html,/id="catalogResults"/);
  assert.match(html,/id="cartList"/);
  assert.match(html,/civolten-app-unificado\\.css\\?v=7/);
 }
 const css=read('assets/civolten-app-unificado.css');
 assert.match(css,/@media\\(max-width:630px\\)/);
 assert.match(css,/\\.quote-simulation-actions\\{grid-template-columns:1fr\\}/);
 assert.match(css,/body\\[data-screen="inicio"\\] \\.landing-visual\\{height:245px/);
 assert.match(css,/--cv-header-gradient:linear-gradient\\(112deg,#0b203c 0%,#173c67 53%,#2b6094 100%\\)/);
});

test('catálogo remoto continua restrito ao orçamento, painel não baixa SIURB',()=>{
 const core=read('assets/civolten.js');
 const start=core.indexOf('const pathname=window.location?.pathname;');
 const end=core.lastIndexOf('\\n})();');
 assert.ok(start>0&&end>start);
 const bootstrap=core.slice(start,end),calls={};
 for(const route of ['/','/empresa','/orcamento','/orcamento.html']){
  const stats={add:0,catalog:0};
  vm.runInNewContext(bootstrap, {window:{location:{pathname:route}},add(){stats.add++},loadCatalog(){stats.catalog++},$:()=>({}),Number});
  calls[route]=stats;
 }
 assert.deepEqual(calls['/'],{add:0,catalog:0});
 assert.deepEqual(calls['/empresa'],{add:0,catalog:0});
 assert.deepEqual(calls['/orcamento'],{add:1,catalog:1});
 assert.deepEqual(calls['/orcamento.html'],{add:1,catalog:1});
});
