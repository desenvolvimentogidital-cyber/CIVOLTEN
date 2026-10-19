import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/civolten-app-unificado.css',import.meta.url),'utf8');
const script=readFileSync(new URL('../assets/civolten-premium.js',import.meta.url),'utf8');
const state=readFileSync(new URL('../assets/site-branding.js',import.meta.url),'utf8');
const classic=readFileSync(new URL('../assets/civolten.js',import.meta.url),'utf8');

test('tela inicial premium conserva o formulário e os 3.463 serviços EDIF/INFRA',()=>{
 for(const id of ['siteLogo','siteHeadline','siteDescription','formulario','name','phone','category','desc','lines','add','simulate','send','files','record','catalogstatus','quickContinue','quickQuantity','simulacao'])
  assert.match(home,new RegExp('id="'+id+'"'),'elemento obrigatório '+id);
 for(const section of ['landing-top','landing-steps','landing-category-grid','landing-fast-card','premium-quote-card'])
  assert.ok(home.includes(section));
 assert.match(home,/civolten-app-unificado\.css\?v=/);
 assert.match(home,/civolten-premium\.js\?v=/);
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
test('seleção rápida preenche o formulário real sem inventar preços no navegador',()=>{
 const ids=['quickContinue','quickQuantity','lines','category','formulario','catalogstatus'];
 const elements=Object.fromEntries(ids.map(id=>[id,{
  id,options:[],value:id==='quickQuantity'?'2':'',listeners:{},
  addEventListener(name,fn){this.listeners[name]=fn;},scrollIntoView(){this.scrolled=true},
  querySelector(){return null;},
  textContent:''
 }]));
 const buttons=['eletrica','pintura','construcao','reforma'].map(cat=>({
  dataset:{quickCategory:cat},listeners:{},
  classList:{toggle(){},contains(){return false}},
  setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;}
 }));
 const catLinks=[];
 const document={
  getElementById:id=>elements[id],
  querySelectorAll:sel=>sel==='[data-quick-category]'?buttons:sel==='[data-select-category]'?catLinks:[],
  querySelector:()=>({value:'completo'}),
  createElement:()=>({})
 };
 const ctx=vm.createContext({document,window:{},Object,Number,Array,Event:class Event{}});
 vm.runInContext(script,ctx);
 buttons[1].listeners.click();
 assert.equal(elements.category.value,'pintura');
 elements.quickContinue.listeners.click();
 assert.equal(elements.formulario.scrolled,true);
 assert.equal(elements.category.value,'pintura');
 assert.match(script,/service\.value=chosen/);
 assert.match(script,/mode==='mao_obra'/);
});
