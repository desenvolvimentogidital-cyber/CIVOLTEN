import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('index.html');
const route=read('assets/civolten-routes.js');
const css=read('assets/civolten-telas.css');
const admin=read('assets/civolten.js');
const cfg=JSON.parse(read('vercel.json'));

test('orçamento e empresa são URLs independentes, não redirecionadas à home',()=>{
  const rewrites=Object.fromEntries(cfg.rewrites.map(x=>[x.source,x.destination]));
  assert.equal(rewrites['/orcamento'],'/orcamento.html');
  assert.equal(rewrites['/empresa'],'/empresa.html');
  assert.ok(!cfg.redirects.some(x=>x.source==='/orcamento'||x.source==='/empresa'));
  assert.ok(cfg.headers.some(x=>x.source==='/empresa'&&x.headers.some(h=>h.key==='X-Robots-Tag')));
  assert.match(html,/civolten-routes\.js/);
  assert.match(html,/civolten-app-unificado\.css/);
  assert.match(css,/body\[data-screen="inicio"\] \.client-form-wrap/);
  assert.match(css,/body\[data-screen="orcamento"\] \.landing-shell/);
  assert.match(css,/body\[data-screen="empresa"\] #client/);
});

test('links da home e serviços sempre abrem orçamento na própria tela',()=>{
 assert.match(html,/href="\/orcamento"/);
 assert.doesNotMatch(html,/href="\/orcamento#simulacao"/);
 assert.match(html,/href="\/orcamento\?servico=eletrica"/);
 assert.match(html,/href="\/servicos"/);
 const services=read('servicos.html');
 assert.match(services,/href="\/orcamento"/);
 assert.doesNotMatch(services,/href="\/" class="btn btn-gold"/);
 assert.match(route,/URLSearchParams/);
 assert.doesNotMatch(route,/quick\.addEventListener\('click'/);
});

test('navegação do painel tem links para todas as seções e histórico do browser',()=>{
 const sections=['visao','pedidos','orcamentos','precos','siurb','logo','textos','backup'];
 for(const tab of sections) assert.match(html,new RegExp('data-admin-view="'+tab+'"'));
 assert.match(admin,/pushHistory\?'pushState':'replaceState'/);
 assert.match(admin,/window\.addEventListener\?\.\('popstate'/);
 assert.match(admin,/query\.set\('secao',view\)/);
 assert.match(admin,/openAdminView\(allowed\.includes\(desired\)\?desired:'visao'\)/);
 assert.match(admin,/if\(window\.location\?\.pathname==='\/empresa'\)/);
});

test('roteador inicializa telas isoladas sem perder formulário e painel existentes',()=>{
 new vm.Script(route);
 for(const p of ['/','/orcamento','/empresa']){
   const all={};
   const nodes={toggle:{textContent:'Área da empresa',onclick:null,click(){all.clicked=true;},classList:{contains:()=>true}},
      admin:{classList:{contains:()=>true,remove(){all.adminOpened=true;}}},quickContinue:{addEventListener(){}},
      quickQuantity:{value:'1'}, siteLogo:{}
   };
   const link=()=>({href:'',getAttribute(name){return name==='href'?this.href:null;},setAttribute(){},removeAttribute(){}});
   const links=[link(),link(),link()];
   const nav={querySelectorAll:()=>links};
   const logo={href:'#inicio'};
   const skip={setAttribute(){},textContent:''};
   const doc={
     body:{dataset:{}},
     getElementById:id=>nodes[id]||null,
     querySelector:s=>s==='.premium-site-nav'?nav:s==='.premium-logo-link'?logo:s==='.skip-link'?skip:null,
     querySelectorAll:s=>[],
   };
   const location={pathname:p,search:'',assign:()=>{}};
   const ctx={document:doc,window:{location},URLSearchParams,Number,Array};
   vm.runInNewContext(route,ctx);
   assert.equal(doc.body.dataset.screen,p==='/empresa'?'empresa':p==='/orcamento'?'orcamento':'inicio');
   assert.equal(logo.href,'/');
   if(p==='/empresa')assert.equal(all.adminOpened,true);
 }
});
