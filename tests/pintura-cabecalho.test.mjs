import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function runQuick(selected){
 const container={
  replaceChildren(){},appendChild(){},
  querySelectorAll(selector){
   if(selector!=='input[name="quickItem"]:checked')throw Error('Seletor inesperado '+selector);
   return selected.map(value=>({value}));
  }
 };
 const fields={
  quickSubservices:container,quickQuantity:{value:'3'},
  quickDetails:{value:'Quarto de 20 m²',focus(){}},
  quickWarning:{hidden:true,setAttribute(){},textContent:''}
 };
 const document={
  getElementById:id=>fields[id]??null,
  querySelectorAll:()=>[],
  querySelector:()=>({value:'completo'}),
  createElement:tag=>({
   tagName:tag,className:'',value:'',textContent:'',
   append(){},appendChild(){},setAttribute(){}
  })
 };
 const window={};
 const script=read('assets/civolten-servicos-rapidos.js');
 vm.runInNewContext(script,{document,window,Number,Array,Object});
 window.CIVOLTEN_QUICK_SELECTION.render('pintura');
 return window.CIVOLTEN_QUICK_SELECTION.collect();
}

test('pintura mostra exclusivamente pintura de paredes, tetos, pisos e drywall',()=>{
 const requested=runQuick(['pintura_alvenaria','avaliacao:pintura_tetos','avaliacao:pintura_drywall']);
 assert.equal(requested.category,'pintura');
 assert.deepEqual(Array.from(requested.items),['pintura_alvenaria']);
 assert.match(requested.details,/Pintura de tetos/);
 assert.match(requested.details,/Pintura de drywall/);
 assert.match(requested.details,/Quantidade aproximada: 3/);
 assert.doesNotMatch(requested.details,/reboco|prepara[cç][aã]o/i);
});

test('pintura especial sem preço continua como avaliação, sem herdar reboco ou drywall instalado',()=>{
 const result=runQuick(['avaliacao:pintura_pisos']);
 assert.deepEqual(Array.from(result.items),[]);
 assert.match(result.details,/Pintura de pisos/);
 assert.match(result.details,/Quarto de 20 m²/);
 assert.equal(result.quantity,3);
 const route=read('assets/civolten-routes.js');
 assert.match(route,/chosen\.details/);
 const app=read('assets/civolten.js');
 assert.match(app,/prefillQuickSelection/);
 assert.match(app,/const summary=\[group/);
});

test('barra inteiramente azul e texto branco compartilham exatamente os mesmos tokens',()=>{
 const bundles={
  app:read('assets/civolten-app-unificado.css'),
  servicos:read('assets/civolten-servicos-unificado.css'),
  proposta:read('assets/civolten-proposta-unificado.css'),
  privacidade:read('assets/civolten-privacidade-unificado.css')
 };
 for(const [page,css] of Object.entries(bundles)){
  assert.match(css,/--cv-header-gradient:linear-gradient\(112deg,#0b203c 0%,#173c67 53%,#2b6094 100%\)/,page);
  assert.match(css,/--cv-header-text:#fff/,page);
  assert.match(css,/--cv-logo-plate:rgba\(255,255,255,\.96\)/,page);
 }
 assert.match(bundles.app,/body>header\.premium-header\{background:var\(--cv-header-gradient\)!important/);
 assert.match(bundles.app,/\.premium-header \.premium-site-nav a\{color:var\(--cv-header-text\)!important/);
 assert.match(bundles.servicos,/\.site-servicos \.header\{background:var\(--cv-header-gradient\)!important/);
 assert.match(bundles.servicos,/\.site-servicos \.header \.nav a\{color:#fff!important/);
 assert.match(bundles.privacidade,/\.site-privacidade \.cv-page-header\{background:var\(--cv-header-gradient\)!important/);
 assert.match(bundles.proposta,/\.site-proposta \.proposal-head\{background:var\(--cv-header-gradient\)/);
});

test('cache atualizado no site e em suas telas geradas',()=>{
 for(const p of ['index.html','empresa.html','orcamento.html']){
  const html=read(p);
  assert.match(html,/civolten-app-unificado\.css\?v=3/);
  assert.match(html,/civolten-servicos-rapidos\.js\?v=2/);
 }
 for(const [p,name] of [['servicos.html','servicos'],['proposta.html','proposta'],['privacidade.html','privacidade']])
  assert.match(read(p),new RegExp('civolten-'+name+'-unificado\\.css\\?v=3'));
});
