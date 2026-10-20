import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('pintura não recebe reboco como item de pintura',()=>{
 const js=read('assets/civolten-carrinho.js');
 assert.match(js,/reboco_interno:'alvenaria'/);
 assert.match(js,/pintura_alvenaria:'pintura'/);
 assert.match(js,/\['pintura',\/\\b/);
 assert.doesNotMatch(read('orcamento.html'),/id="quickSubservices"/);
});

test('identidade usa azul técnico e logo transparente',()=>{
 const bundles={app:read('assets/civolten-app-unificado.css'),servicos:read('assets/civolten-servicos-unificado.css'),proposta:read('assets/civolten-proposta-unificado.css'),privacidade:read('assets/civolten-privacidade-unificado.css')};
 for(const [page,css] of Object.entries(bundles)){
  assert.match(css,/--cv-header-gradient:linear-gradient\\(112deg,#0b203c 0%,#173c67 53%,#2b6094 100%\\)/,page);
  assert.match(css,/--cv-header-text:#fff/,page);
  assert.match(css,/--cv-logo-plate:transparent/,page);
 }
 assert.match(bundles.app,/body>header\\.premium-header\\{background:var\\(--cv-header-gradient\\)!important/);
 assert.match(bundles.servicos,/\\.site-servicos \\.header\\{background:var\\(--cv-header-gradient\\)!important/);
 assert.match(bundles.privacidade,/\\.site-privacidade \\.cv-page-header\\{background:var\\(--cv-header-gradient\\)!important/);
});

test('cache CSS correto em todas as páginas',()=>{
 for(const p of ['index.html','empresa.html','orcamento.html']){
  const html=read(p);
  assert.match(html,/civolten-app-unificado\\.css\\?v=7/);
  assert.doesNotMatch(html,/civolten-servicos-rapidos\\.js/);
 }
 for(const [p,name] of [['servicos.html','servicos'],['proposta.html','proposta'],['privacidade.html','privacidade']])
  assert.match(read(p),new RegExp('civolten-'+name+'-unificado\\\\.css\\\\?v=4'));
});
