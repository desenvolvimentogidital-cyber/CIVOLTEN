import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const home=read('index.html'),quote=read('orcamento.html'),office=read('empresa.html');

test('home é uma vitrine sem campos, seletores ou formulários de serviço duplicados',()=>{
 const intro=home.slice(home.indexOf('<div class="landing-shell">'),home.indexOf('<div class="client-form-wrap">'));
 assert.ok(intro.includes('id="siteHeadline"'));
 assert.ok(intro.includes('landing-hero-image'));
 assert.ok(intro.includes('class="landing-category-grid"'));
 assert.ok(intro.includes('href="/orcamento"'));
 assert.ok(intro.includes('href="/servicos"'));
 for(const id of ['quickContinue','quickQuantity','quickSubservices','quickCategorySelect','quickSelectionSummary'])
  assert.ok(!home.includes('id="'+id+'"'),id);
 assert.ok(!home.includes('civolten-servicos-rapidos.js'));
 const routes=read('assets/civolten-routes.js');
 assert.ok(!routes.includes("quick.addEventListener('click'"));
 assert.ok(!routes.includes("link.href=text.includes('Simular')"));
});

test('orçamento apresenta pesquisa, simulação e dados de contato só na última etapa',()=>{
 const start=quote.indexOf('class="card premium-quote-card"');
 const search=quote.indexOf('id="catalogFinder"',start);
 const simulate=quote.indexOf('id="simulacao"',start);
 const contact=quote.indexOf('id="quoteContactDetails"',start);
 assert.ok(start>0&&start<search&&search<simulate&&simulate<contact);
 assert.ok(quote.includes('id="quoteEstimateOptions"'));
 assert.ok(quote.includes('id="goQuoteDetails"'));
 assert.ok(quote.includes('<details id="quoteContactDetails"'));
 assert.ok(quote.includes('id="quoteFiles"'));
 const required=['name','phone','desc','category','urgency','neigh','city','days','km','consent','website','send','files','record','lines','simulate','catalogstatus','retryCatalog','cartList','cartDirectEstimate','clientmsg'];
 for(const id of required){
  const re=new RegExp('id="'+id+'"','g');
  assert.equal([...quote.matchAll(re)].length,1,'campo duplicado ou ausente: '+id);
 }
 assert.ok(quote.includes('privacy_version')===false);
 assert.ok(read('assets/civolten.js').includes("privacy_version:'2026-10'"));
 assert.ok(office.includes('id="loginbox"'));
});

test('clique em continuar abre contato sem enviar dados nem disparar simulação',()=>{
 const handlers={},fields={};
 const details={open:false,scrollIntoView(){fields.scrolled=true}};
 const contact={focus(){fields.focused=true}};
 const button={addEventListener:(name,fn)=>handlers[name]=fn};
 const filter={options:[],value:'todos',dispatchEvent(){}};
 const doc={
  getElementById(id){return {quoteContactDetails:details,goQuoteDetails:button,name:contact,catalogType:filter}[id]||null}
 };
 const window={location:{pathname:'/orcamento',search:''}};
 vm.runInNewContext(read('assets/civolten-quote-flow.js'),{window,document:doc,URLSearchParams,Event});
 assert.equal(typeof handlers.click,'function');
 handlers.click();
 assert.equal(details.open,true);
 assert.equal(fields.scrolled,true);
 assert.equal(fields.focused,true);
 assert.equal(window.fetch,undefined);
});
