import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const src=readFileSync(new URL('../assets/civolten.js',import.meta.url),'utf8');
const pro=readFileSync(new URL('../assets/civolten-pro.js',import.meta.url),'utf8');

test('menu de empresa tem seções com submenus claros e painéis isolados',()=>{
 for(const view of ['pedidos','orcamentos','precos','siurb','logo','textos','backup'])
  assert.match(html,new RegExp('data-admin-view="'+view+'"'));
 for(const id of ['adminMenu','adminOrdersPanel','adminPricingPanel','adminSiurbPanel','adminBrandingPanel','adminBackupPanel','siteSettings'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(html,/siteSettingsToggle|pricingArea" class="hidden"[^]*?id="orders"/);
 assert.match(pro,/Personalizar site e PDFs/);
 assert.match(pro,/Logo PNG\/JPEG/);
 assert.match(pro,/logo_width_px/);
 assert.doesNotMatch(pro,/function branding\(container\)\{\s*window.CIVOLTEN_SIURB/);
});

test('logo aparece assim que o menu inicia sem carregar pedidos; alternância preserva visualização',()=>{
 class C{
  constructor(){this.set=new Set(['hidden']);}
  toggle(name,off){if(off)this.set.add(name);else this.set.delete(name);}
  contains(name){return this.set.has(name);}
  add(name){this.set.add(name)}
  remove(name){this.set.delete(name)}
 }
 function el(id){
  const attrs={},events={};
  return {id,classList:new C(),dataset:{},attrs,events,disabled:false,
   setAttribute:(k,v)=>{attrs[k]=v},
   removeAttribute:k=>delete attrs[k],
   addEventListener:(k,fn)=>{events[k]=fn},
   click:()=>events.click?.(),
   appendChild:()=>{},
   scrollIntoView:()=>{}};
 }
 const ids=['adminOrdersPanel','adminPricingPanel','adminSiurbPanel','adminBrandingPanel','adminBackupPanel',
  'adminCurrentView','orders','siteSettings','pricingArea','pricingToggle','exportOrders'];
 const elements=Object.fromEntries(ids.map(id=>[id,el(id)]));
 const names=['pedidos','orcamentos','precos','siurb','logo','textos','backup'];
 const buttons=names.map(name=>({...el(name),dataset:{adminView:name}}));
 let renderedLogo=0,renderedImport=0,pricesClicked=0,exported=0,filtered=0;
 elements.orders._applyAdminFilter=()=>filtered++;
 elements.pricingToggle.click=()=>{pricesClicked++;elements.pricingArea.classList.remove('hidden')};
 const ctx=vm.createContext({
  $:id=>elements[id],
  document:{
   getElementById:id=>elements[id],
   querySelectorAll:q=>q==='#dashboard .admin-panel'?ids.filter(x=>x.startsWith('admin')&&x.endsWith('Panel')).map(x=>elements[x]):
      q==='#adminMenu [data-admin-view]'?buttons:[],
   createElement:()=>el('dynamic')
  },
  window:{CIVOLTEN_PRO:{branding:()=>renderedLogo++,exportOrders:()=>exported++},
   CIVOLTEN_SIURB:{importHub:()=>renderedImport++}}
 });
 const begin=src.indexOf('let adminMenuInitialized=false');
 const end=src.indexOf('function currentItems(){',begin);
 assert.ok(begin>0&&end>begin,'Navegação deve estar isolada do restante da página');
 vm.runInContext(src.slice(begin,end)+'\nglobalThis.nav={initAdminNavigation,openAdminView};',ctx);
 ctx.nav.initAdminNavigation();
 assert.equal(renderedLogo,1,'A personalização da logo precisa abrir sem esperar pedidos');
 assert.equal(elements.adminBrandingPanel.classList.contains('hidden'),false);
 assert.equal(elements.adminOrdersPanel.classList.contains('hidden'),true);
 assert.equal(elements.adminBrandingPanel.dataset.brandingTab,'logo');
 buttons.find(x=>x.dataset.adminView==='orcamentos').click();
 assert.equal(elements.adminOrdersPanel.classList.contains('hidden'),false);
 assert.equal(elements.orders.dataset.adminMode,'orcamentos');
 assert.ok(filtered>0);
 buttons.find(x=>x.dataset.adminView==='precos').click();
 assert.equal(elements.adminPricingPanel.classList.contains('hidden'),false);
 assert.equal(pricesClicked,1);
 buttons.find(x=>x.dataset.adminView==='siurb').click();
 assert.equal(renderedImport,1);
 buttons.find(x=>x.dataset.adminView==='textos').click();
 assert.equal(elements.adminBrandingPanel.dataset.brandingTab,'textos');
 assert.equal(renderedLogo,2);
 buttons.find(x=>x.dataset.adminView==='backup').click();
 elements.exportOrders.click();
 assert.equal(exported,1);
 ctx.nav.initAdminNavigation();
 assert.equal(elements.adminBackupPanel.classList.contains('hidden'),false);
 assert.equal(elements.adminBrandingPanel.classList.contains('hidden'),true);
});

test('abas de logo e textos são separadas sem perder botão salvar',()=>{
 const css=readFileSync(new URL('../assets/civolten.css',import.meta.url),'utf8');
 assert.match(css,/branding-tab="logo"/);
 assert.match(css,/branding-tab="textos"/);
 assert.match(css,/admin-panel\.hidden\{display:none!important\}/);
 assert.match(pro,/Salvar personalização do site e PDFs/);
 assert.match(src,/window\.CIVOLTEN_PRO\.branding\(\$\('siteSettings'\)\)/);
});
