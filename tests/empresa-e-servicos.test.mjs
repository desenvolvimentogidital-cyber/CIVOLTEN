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

test('vitrine possui 10 categorias e nenhuma oferta de segurança ou automação',()=>{
 const categories=['eletrica','manutencao','iluminacao','solar','construcao','reforma','pisos','pintura','hidraulica','alvenaria'];
 for(const id of categories)
  assert.match(html,new RegExp('data-quick-category="'+id+'"'));
 assert.equal((html.match(/data-quick-category="/g)||[]).length,10);
 assert.match(html,/id="quickSubservices"/);
 assert.doesNotMatch(html,/Sistemas de segurança|Automação residencial|Automação predial/i);
 const js=read('assets/civolten-servicos-rapidos.js');
 const doc={getElementById(){return null},querySelectorAll(){return []}};
 const win={};
 vm.runInNewContext(js,{document:doc,window:win,Object,Array,Number});
 const directory=win.CIVOLTEN_QUICK_SELECTION.directory;
 assert.equal(Object.keys(directory).length,10);
 const match=/const FALLBACK_CATALOG=(\[[^;]+\]);/.exec(core);
 assert.ok(match,'Catálogo reserva');
 const fallback=JSON.parse(match[1]);
 const valid=new Set(fallback.map(x=>x.id));
 for(const [name,group] of Object.entries(directory)){
  for(const [id] of group.options){
   if(name==='pintura'&&id.startsWith('avaliacao:'))continue;
   assert.ok(valid.has(id),'ID sem composição real: '+id);
  }
 }
 assert.deepEqual(Array.from(directory.pintura.options,([id,label])=>label),
  ['Pintura de paredes','Pintura de tetos','Pintura de pisos','Pintura de drywall']);
 assert.ok(!directory.pintura.options.some(([id,label])=>/reboco|prepara[cç][aã]o|drywall com pintura/i.test(id+' '+label)));
 assert.equal(directory.solar.options.length,0);
 assert.equal(directory.hidraulica.options.length,0);
 assert.match(js,/depende de avaliação técnica/);
});

test('seleções avançam sem inventar preços ou gravar dados do cliente no navegador',()=>{
 assert.match(routes,/CIVOLTEN_QUICK_SELECTION\?\.collect/);
 assert.match(routes,/params\.set\('itens'/);
 assert.match(routes,/params\.set\('selecoes'/);
 assert.match(routes,/CIVOLTEN_FORM\?\.prefillQuickSelection/);
 assert.match(core,/prefillQuickSelection\(/);
 assert.match(core,/catalog\.some\(s=>s\.id===id\)/);
 assert.match(core,/rows\.replaceChildren\(\)/);
 assert.doesNotMatch(routes,/localStorage|sessionStorage|\bpreco\s*=|\bprice\s*=/);
 assert.match(routes,/URLSearchParams/);
});
