import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('index.html');
const office=read('empresa.html');
const quote=read('orcamento.html');
const core=read('assets/civolten.js');
const routes=read('assets/civolten-routes.js');

test('área da empresa recebe HTML independente com login visível',()=>{
 assert.match(office,/<body data-screen="empresa">/);
 assert.match(office,/<section id="admin">/);
 assert.doesNotMatch(office,/<section id="admin" class="hidden">/);
 for(const id of ['loginbox','email','password','login','activate','dashboard'])
  assert.match(office,new RegExp('id="'+id+'"'));
 assert.match(quote,/<body data-screen="orcamento">/);
 assert.match(quote,/<section id="admin" class="hidden">/);
 assert.match(routes,/CIVOLTEN_ADMIN_BOOT\?\.\(\)/);
 assert.match(core,/window\.CIVOLTEN_ADMIN_BOOT=initCompanyAccess/);
 assert.doesNotMatch(routes,/toggle\.click\(\)/);
});

test('home apresenta serviços sem repetir catálogo e carrinho do orçamento',()=>{
 assert.match(html,/class="landing-hero-actions"/);
 assert.match(html,/href="\/orcamento"/);
 assert.match(html,/class="landing-category-grid"/);
 assert.doesNotMatch(html,/id="quickContinue"|id="quickSubservices"|data-quick-category=|civolten-servicos-rapidos\.js/);
 const types=['eletrica','manutencao','iluminacao','solar','construcao','reforma','pisos','pintura','hidraulica','alvenaria'];
 for(const category of types)
  assert.match(quote,new RegExp('<option value="'+category+'">'));
 assert.match(quote,/id="catalogFinder"/);
 assert.match(quote,/id="cartList"/);
 assert.doesNotMatch(quote,/Sistemas de segurança|Automação residencial|Automação predial/i);
});
test('links antigos de seleção continuam válidos sem formulário duplicado',()=>{
 assert.match(routes,/CIVOLTEN_FORM\?\.prefillQuickSelection/);
 assert.match(core,/prefillQuickSelection\(/);
 assert.match(core,/catalog\.some\(s=>s\.id===id\)/);
 assert.match(core,/rows\.replaceChildren\(\)/);
 assert.match(routes,/URLSearchParams/);
 assert.doesNotMatch(routes,/quick\.addEventListener|localStorage|sessionStorage|\bpreco\s*=|\bprice\s*=/);
});
