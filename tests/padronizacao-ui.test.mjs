import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const home=read('index.html');
const services=read('servicos.html');
const proposal=read('proposta.html');
const privacy=read('privacidade.html');
const shared=read('assets/civolten-padrao.css');

test('as quatro páginas compartilham os mesmos tokens de identidade',()=>{
 for(const [name,markup] of [['home',home],['servicos',services],['proposta',proposal],['privacidade',privacy]]){
  assert.match(markup, /href="\/assets\/civolten-padrao\.css\?v=1"/,name);
  assert.doesNotMatch(markup,/<style(?:\s|>)|\sonclick=/i,name);
 }
 assert.match(shared,/--cv-navy:var\(--brand-primary/);
 assert.match(shared,/--cv-gold:var\(--brand-accent/);
 assert.match(shared,/--brand-logo-width/);
 assert.match(shared,/prefers-reduced-motion/);
 assert.match(shared,/focus-visible/);
});

test('serviços e privacidade oferecem menu consistente e orçamento próprio',()=>{
 assert.match(services,/<body class="site-servicos">/);
 assert.match(services,/href="\/servicos" aria-current="page"/);
 assert.match(services,/href="\/empresa"/);
 assert.match(services,/href="\/orcamento"/);
 assert.match(privacy,/<body class="site-privacidade">/);
 assert.match(privacy,/href="\/servicos"/);
 assert.match(privacy,/href="\/orcamento"/);
 assert.match(privacy,/id="siteLogo"/);
 assert.match(privacy,/id="footerLogo"/);
 assert.match(privacy,/id="siteFooterNote"/);
 assert.match(privacy,/site-branding\.js\?v=2/);
});

test('site, proposta e prévias usam a logo cadastrada em vez de identidade fictícia',()=>{
 const branding=read('assets/site-branding.js');
 const api=read('api/site-branding.mjs');
 for(const id of ['siteLogo','proposalLogo','footerLogo','adminNavLogo','previewSiteLogo','previewPdfLogo'])
  assert.match(branding,new RegExp("'"+id+"'"));
 assert.match(proposal,/<body class="site-proposta">/);
 assert.match(proposal,/site-branding\.js\?v=2/);
 assert.match(proposal,/id="proposalLogo"/);
 assert.match(api,/site-branding/);
 assert.match(shared,/--cv-navy:var\(--brand-primary/);
 assert.doesNotMatch(branding,/innerHTML|localStorage|sessionStorage/);
});

test('desktop e celular mostram caminhos para as mesmas telas, sem mudar a autenticação',()=>{
 assert.match(home,/class="cv-mobile-nav"/);
 for(const path of ['/','/servicos','/orcamento','/empresa'])
  assert.match(home,new RegExp('href="'+path+'"'));
 assert.match(home,/class="premium-site-nav"/);
 assert.match(read('assets/civolten-routes.js'),/\.cv-mobile-nav a/);
 assert.match(shared,/max-width:900px/);
 assert.match(shared,/max-width:570px/);
 const router=read('assets/civolten-routes.js');
 new vm.Script(router);
 const server=read('api/admin.mjs');
 assert.match(server,/cookieToken/);
 assert.doesNotMatch(home,/<script(?:\s[^>]*)?>[^<]/);
});
