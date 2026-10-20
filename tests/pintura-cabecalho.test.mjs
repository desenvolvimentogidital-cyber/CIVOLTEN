import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('reboco permanece em alvenaria e pintura permanece em pintura',()=>{
 const js=read('assets/civolten-carrinho.js');
 assert.ok(js.includes("reboco_interno:'alvenaria'"));
 assert.ok(js.includes("pintura_alvenaria:'pintura'"));
 assert.ok(js.includes("['pintura',/"));
 assert.ok(!read('orcamento.html').includes('id="quickSubservices"'));
});

test('todas as páginas usam azul técnico e logo sem placa branca',()=>{
 const bundles={
  app:read('assets/civolten-app-unificado.css'),
  servicos:read('assets/civolten-servicos-unificado.css'),
  proposta:read('assets/civolten-proposta-unificado.css'),
  privacidade:read('assets/civolten-privacidade-unificado.css')
 };
 for(const [name,css] of Object.entries(bundles)){
  assert.ok(css.includes('--cv-header-gradient:linear-gradient(112deg,#0b203c 0%,#173c67 53%,#2b6094 100%)'),name);
  assert.ok(css.includes('--cv-header-text:#fff'),name);
  assert.ok(css.includes('--cv-logo-plate:transparent'),name);
 }
 assert.ok(bundles.app.includes('body>header.premium-header{background:var(--cv-header-gradient)!important'));
 assert.ok(bundles.servicos.includes('.site-servicos .header{background:var(--cv-header-gradient)!important'));
 assert.ok(bundles.privacidade.includes('.site-privacidade .cv-page-header{background:var(--cv-header-gradient)!important'));
});

test('cache CSS e fluxo atualizado sem scripts antigos',()=>{
 for(const page of ['index.html','empresa.html','orcamento.html']){
  const html=read(page);
  assert.ok(html.includes('civolten-app-unificado.css?v=11'),page);
  assert.ok(html.includes('civolten-quote-flow.js?v=2'),page);
  assert.ok(!html.includes('civolten-servicos-rapidos.js'),page);
 }
 for(const [page,name] of [['servicos.html','servicos'],['proposta.html','proposta'],['privacidade.html','privacidade']])
  assert.ok(read(page).includes('civolten-'+name+'-unificado.css?v=4'),page);
});
