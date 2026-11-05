'use strict';
/** Smoke de navegador gratuito. Dados sintéticos isolados por contexto. */
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const { chromium }=require('playwright');
const ROOT=path.resolve(__dirname,'../dist');
const mimetypes={'.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.html':'text/html;charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const input={
 company:{name:'Empresa teste',profit:20,taxRegime:'MEI',tax:0,fees:0,overhead:5,reserve:3},
 clients:[{id:'test-client',name:'Cliente teste'}],workers:[],materials:[],services:[],expenses:[],
 quotes:[{id:'test-quote',number:'ORC-2026-0001',title:'Teste de instalação',clientId:'test-client',
 clientName:'Cliente teste',status:'Aprovado',type:'Mão de obra',date:'2026-11-05',cost:50000,
 price:80000,priceMode:'manual',manualPrice:80000,tax:0,fees:0,margin:59.5,
 auditFinancial:{status:'passed',date:'2026-11-05T15:00:00Z'},
 items:[{id:'item-a',service:'Instalação',unit:'un',qty:1,labor:30000,material:0,extra:0,owner:'cliente'}]}]
};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
 const target=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));
 if(!target.startsWith(ROOT+path.sep)&&target!==path.join(ROOT,'index.html')){res.writeHead(403).end();return;}
 if(req.url.startsWith('/api/')){res.writeHead(401,{'Content-Type':'application/json'}).end('{"error":"Sem sessão"}');return;}
 fs.readFile(target,(error,data)=>{
  if(error){res.writeHead(404).end('Not found');return;}
  res.writeHead(200,{'Content-Type':mimetypes[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
 });
});
const listen=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const close=()=>new Promise(resolve=>server.close(resolve));
(async()=>{
 let browser;
 try{
  assert.ok(fs.existsSync(path.join(ROOT,'index.html')),'dist/index.html ausente');
  await listen();
  const address='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:820},acceptDownloads:true});
  const page=await context.newPage();
  const runtimeErrors=[];
  page.on('pageerror',error=>runtimeErrors.push(String(error)));
  await page.addInitScript(data=>localStorage.setItem('civolten_daily_v2',JSON.stringify(data)),input);
  await page.goto(address,{waitUntil:'load'});
  await page.locator('nav.bottom-nav [data-page="quotes"]').click();
  await page.locator('[data-action="detail"][data-id="test-quote"]').first().click();
  await page.locator('.cv-op-panel h3').filter({hasText:'Execução e resultado real'}).waitFor();
  await page.locator('form[data-cv-op="progress"] [name="percent"]').fill('50');
  await page.locator('form[data-cv-op="progress"] button').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('civolten_daily_v2')).quotes[0].execution.percent),50);
  await page.locator('details').filter({hasText:'Lançar custo real'}).locator('summary').click();
  await page.locator('form[data-cv-op="cost"] [name="description"]').fill('Materiais teste');
  await page.locator('form[data-cv-op="cost"] [name="amount"]').fill('32000');
  await page.locator('form[data-cv-op="cost"] button').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('civolten_daily_v2')).quotes[0].execution.entries[0].amount),32000);
  await page.locator('details').filter({hasText:'Lançar recebimento'}).locator('summary').click();
  await page.locator('form[data-cv-op="receipt"] [name="description"]').fill('Medição 1');
  await page.locator('form[data-cv-op="receipt"] [name="amount"]').fill('40000');
  await page.locator('form[data-cv-op="receipt"] button').click();
  const ledger=await page.evaluate(()=>JSON.parse(localStorage.getItem('civolten_daily_v2')).quotes[0].execution.entries);
  assert.equal(ledger.length,2);assert.equal(ledger[1].type,'receipt');assert.equal(ledger[1].amount,40000);
  await page.locator('nav.bottom-nav [data-page="more"]').click();
  await page.locator('[data-page="finance"]').last().click();
  await page.locator('.cv-op-panel').filter({hasText:'Obras e movimentação registrada'}).waitFor();
  const screen=await page.locator('.cv-op-panel').filter({hasText:'Obras e movimentação registrada'}).innerText();
  assert.match(screen,/32\.000,00/);assert.match(screen,/40\.000,00/);
  await page.locator('.cv-op-open[data-action="detail"][data-id="test-quote"]').first().click();
  await page.locator('[data-action="preview"][data-id="test-quote"]').first().click();
  await page.locator('.cv-proposal-heading h1').waitFor();
  const documentText=await page.locator('.cv-proposal').innerText();
  assert.match(documentText,/Proposta de serviços/);
  assert.match(documentText,/80\.000,00/);
  assert.match(documentText,/Cliente teste/);
  assert.doesNotMatch(documentText,/Custo previsto|Salário|Encargos da equipe/);
  const shares=await page.evaluate(()=>CIVOLTENProposalLayout.shares({
    price:100,items:[{qty:1,labor:3,owner:'cliente'},{qty:1,labor:7,owner:'cliente'}]
  }));
  assert.equal(Math.round(shares.reduce((a,v)=>a+v,0)*100),10000);
  const tiny=await page.evaluate(()=>CIVOLTENProposalLayout.shares({
    price:0.5,items:Array.from({length:100},()=>({qty:1,labor:1,owner:'cliente'}))
  }));
  assert.equal(Math.round(tiny.reduce((a,v)=>a+v,0)*100),50);
  assert.ok(tiny.every(v=>v>=0),'Nenhum item pode ter preço negativo');
  const ready=await page.evaluate(()=>CIVOLTENProposalLayout.printReadiness(
    JSON.parse(localStorage.getItem('civolten_daily_v2')).quotes[0]
  ));
  assert.equal(ready.ok,true,'Auditoria concluída deve liberar PDF');
  const invalid=await page.evaluate(()=>CIVOLTENProposalLayout.printReadiness({
    status:'Rascunho',items:[],price:0
  }));
  assert.equal(invalid.ok,false,'Rascunhos não devem ser enviados como propostas');
  const pdf=await page.pdf({format:'A4',printBackground:true});
  assert.ok(pdf.byteLength>4000&&pdf.subarray(0,4).toString()==='%PDF','PDF de proposta não gerado');
  // Um orçamento aprovado não pode manter o status após alteração de escopo.
  page.once('dialog',dialog=>dialog.accept());
  await page.evaluate(()=>{
   const q=db.quotes.find(v=>v.id==='test-quote');
   s.wizard=structuredClone(q);s.wizard.title='Instalação revisada para nova aprovação';
   s.wizard.status='Aprovado';persistWizard();
  });
  const revised=await page.evaluate(()=>JSON.parse(localStorage.getItem('civolten_daily_v2')).quotes[0]);
  assert.equal(revised.status,'Em análise');
  assert.ok(revised.approvalPending&&revised.approvalPending.previousRevision===1);
  assert.equal(revised.history.length,1);
  assert.equal(revised.revision,2);
  assert.ok(revised.history[0].snapshot.status==='Aprovado','A aprovação original permanece auditável');
    assert.deepEqual(runtimeErrors,[],'Erros JavaScript no navegador: '+runtimeErrors.join('; '));
  console.log('SMOKE PASSOU: navegador, orçamento, progresso, custos, recebimentos, prévia comercial e PDF A4');
 }finally{
  if(browser)await browser.close();
  if(server.listening)await close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
