import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/civolten-app-unificado.css',import.meta.url),'utf8');
const script=readFileSync(new URL('../assets/civolten-premium.js',import.meta.url),'utf8');
const state=readFileSync(new URL('../assets/site-branding.js',import.meta.url),'utf8');
const classic=readFileSync(new URL('../assets/civolten.js',import.meta.url),'utf8');

test('home premium é vitrine, orçamento concentra pesquisa, carrinho e simulação',()=>{
 const quote=readFileSync(new URL('../orcamento.html',import.meta.url),'utf8');
 for(const id of ['siteLogo','siteHeadline','siteDescription','formulario','name','phone','category','desc','lines','add','simulate','send','files','record','catalogstatus','catalogFinder','cartList','quoteContactDetails','simulacao'])
  assert.match(quote,new RegExp('id="'+id+'"'),'elemento obrigatório '+id);
 for(const section of ['landing-top','landing-steps','landing-category-grid','premium-quote-card'])
  assert.ok(home.includes(section));
 assert.doesNotMatch(home,/class="landing-fast-card"|id="quickContinue"|quickSubservices|civolten-servicos-rapidos\.js/);
 assert.match(home,/civolten-app-unificado\.css\?v=9/);
 assert.match(home,/civolten-premium\.js\?v=3/);
 assert.match(classic,/api=siurb-list/);
 assert.match(classic,/modalidade:row\._modeSelect/);
 assert.doesNotMatch(home,/siteLogo"[^>]*src="/,'A logo deve vir do banco, sem substituição');
});
test('painel SaaS usa dados reais, sem números inventados',()=>{
 for(const id of ['adminMenu','adminOrdersPanel','adminOverviewPanel','adminKpis','adminPricingPanel','adminSiurbPanel','adminBrandingPanel','adminBackupPanel','siteSettings','adminNavLogo','previewSiteLogo','previewPdfLogo'])
  assert.match(home,new RegExp('id="'+id+'"'));
 assert.match(home,/data-admin-view="visao"/);
 assert.match(classic,/CIVOLTEN_PREMIUM\?\.updateDashboard/);
 assert.match(script,/pedidos\.filter/);
 assert.doesNotMatch(home,/Taxa de aprovação[^<]*64%|Pedidos hoje[^<]*12/);
 assert.doesNotMatch(script,/const rate=64|const paid=28/);
});
test('logo preservada, aplicada ao site, painel e prévias sem escrever imagem no banco',()=>{
 for(const id of ['siteLogo','adminNavLogo','previewSiteLogo','previewPdfLogo','proposalLogo','footerLogo'])
  assert.match(state,new RegExp("'"+id+"'"));
 assert.match(state,/branding\.logo_data_url/);
 assert.match(state,/--brand-logo-width/);
 assert.doesNotMatch(state,/localStorage|sessionStorage/);
 assert.match(css,/--brand-logo-width/);
 assert.match(css,/brand-primary/);
 assert.match(css,/brand-accent/);
 assert.doesNotMatch(home,/⚡ CIVOL|class="brand"/);
});
test('painel premium não depende do formulário duplicado',()=>{
 assert.doesNotMatch(script,/quickContinue|quickQuantity|chooseCategory|service\.value=chosen/);
 assert.match(script,/CIVOLTEN_PREMIUM=\{updateDashboard\}/);
 const route=readFileSync(new URL('../assets/civolten-routes.js',import.meta.url),'utf8');
 assert.doesNotMatch(route,/quick\.addEventListener\('click'/);
});
