// Teste de integração dos orçamentos fictícios no Chromium gratuito.
// Usa exclusivamente cliente Supabase simulado no localhost.
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8',
 '.css':'text/css;charset=utf-8','.png':'image/png','.svg':'image/svg+xml',
 '.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 fs.readFile(file,(err,buffer)=>{
  if(err){res.writeHead(404);res.end('Not found');return}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
  res.end(buffer);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},
   isMobile:true,hasTouch:true,acceptDownloads:true});
  page.on('pageerror',err=>errors.push(err.message));
  const login=async()=>{
   await page.locator('.auth-page').waitFor();
   await page.locator('#auth-form [name="email"]').fill('orcamento-test@example.com');
   await page.locator('#auth-form [name="password"]').fill('senha-de-teste-local');
   await page.locator('#auth-form [type="submit"]').click();
   await page.locator('.dashboard').waitFor();
  };
  await page.goto(base,{waitUntil:'networkidle'});
  await login();
  await page.locator('[data-go="costs"]').last().click();
  await page.locator('[data-action="new-cost"]').last().click();
  await page.locator('#record-form [name="name"]').fill('Custo administrativo de teste');
  await page.locator('#record-form [name="amount"]').fill('1000');
  await page.locator('#record-form [type="submit"]').click();
  await page.locator('.cost-row').first().waitFor();
  await page.locator('.bottom-nav [data-go="more"]').click();
  await page.locator('[data-go="company"]').click();
  await page.locator('#company-form [name="taxPct"]').fill('10');
  await page.locator('#company-form [name="marginPct"]').fill('20');
  await page.locator('#company-form [name="productiveDays"]').fill('20');
  await page.locator('#company-form [name="hoursPerDay"]').fill('8');
  await page.locator('#company-form [name="productivePeople"]').fill('2');
  await page.locator('#company-form [type="submit"]').click();
  await page.locator('.pricing-capacity').waitFor();
  await page.locator('.bottom-nav [data-go="home"]').click();
  await page.locator('[data-go="budgets"]').first().click();
  assert.match(await page.locator('.budget-demo-flag').innerText(),/Demonstração/);
  assert.equal(await page.locator('.budget-list-item').count(),0);
  await page.locator('[data-action="budget-new"]').click();
  await page.locator('#budget-form [name="customer"]').fill('Cliente fictício');
  await page.locator('#budget-form [name="paymentTerms"]').fill('40% na assinatura e 60% na entrega');
  await page.locator('#budget-form [name="executionTerm"]').fill('Até 18 dias úteis após liberação');
  await page.locator('#budget-form [name="warrantyTerms"]').fill('Conforme contrato');
  await page.locator('#budget-form [name="project"]').fill('Reforma do Centro Comercial');
  await page.locator('#budget-catalog').selectOption('DEMO-E01');
  await page.locator('[data-action="budget-add-item"]').click();
  assert.equal(await page.locator('#budget-service-form').count(),1);
  assert.equal(await page.locator('.budget-item').count(),0,'Abrir o modal não deve adicionar o serviço');
  assert.equal(await page.locator('#budget-service-form [name="quantity"]').inputValue(),'1');
  await page.screenshot({path:'test-artifacts/orcamento-modal-servico.png',fullPage:true});
  await page.locator('#budget-service-form [data-action="close-modal"]').click();
  assert.equal(await page.locator('.budget-item').count(),0,'Cancelar o modal não insere item');
  // O mesmo serviço pode ser cadastrado com validação antes de alterar o rascunho.
  await page.locator('[data-action="budget-add-item"]').click();
  await page.locator('#budget-service-form [name="quantity"]').fill('0');
  await page.locator('#budget-service-form [type="submit"]').click();
  assert.match(await page.locator('#budget-service-error').innerText(),/quantidade válido/);
  assert.equal(await page.locator('.budget-item').count(),0);
  await page.locator('#budget-service-form [name="quantity"]').fill('2');
  await page.locator('#budget-service-form [type="submit"]').click();
  assert.equal(await page.locator('.budget-item').count(),1);
  assert.match(await page.locator('.budget-item').first().innerText(),/2 un/);
  assert.equal(await page.locator('.budget-item input').count(),0,'A lista fica compacta, sem formulário embutido');
  await page.locator('[data-action="budget-edit-item"]').first().click();
  assert.match(await page.locator('.modal-heading h2').innerText(),/Editar serviço/);
  assert.equal(await page.locator('#budget-service-form [name="quantity"]').inputValue(),'2');
  await page.locator('#budget-service-form [name="quantity"]').fill('4');
  await page.locator('#budget-service-form [type="submit"]').click();
  assert.match(await page.locator('.budget-item').first().innerText(),/4 un/);
  await page.locator('#budget-catalog').selectOption('DEMO-C02');
  await page.locator('[data-action="budget-add-item"]').click();
  await page.locator('#budget-service-form [name="quantity"]').fill('1');
  await page.locator('#budget-service-form [type="submit"]').click();
  assert.equal(await page.locator('.budget-item').count(),2);
  assert.match(await page.locator('#budget-price-preview').innerText(),/Preço final para o cliente/);
  await fs.promises.mkdir(path.join(__dirname,'../test-artifacts'),{recursive:true});
  await page.screenshot({path:'test-artifacts/orcamento-editor.png',fullPage:true});
  await page.locator('#budget-form [type="submit"]').click();
  await page.locator('.budget-list-item').first().waitFor();
  assert.equal(await page.locator('.budget-list-item').count(),1);
  await page.locator('[data-action="budget-open"]').first().click();
  assert.equal(await page.locator('.budget-item').count(),2);
  assert.match(await page.locator('.budget-print').innerText(),/DOCUMENTO DE TESTE/);
  assert.match(await page.locator('.budget-pdf-model-label').innerText(),/Signature/);
  assert.equal(await page.locator('.proposal-page').count(),3);
  assert.equal(await page.locator('.proposal-cover-background').count(),1);
  assert.equal(await page.locator('.proposal-services .proposal-cover-background').count(),0);
  assert.match(await page.locator('.proposal-cover-background').getAttribute('src'),/file_000000007df8820eb700b32dbfca9c55\.png/);
  assert.match(await page.locator('.proposal-conditions').innerText(),/40% na assinatura/);
  assert.match(await page.locator('.proposal-conditions').innerText(),/18 dias úteis/);
  assert.doesNotMatch(await page.locator('.proposal-services').innerText(),/R\$\s*[\d.]/);
  assert.match(await page.locator('.proposal-conditions').innerText(),/R\$\s*[\d.]/);
  assert.match(await page.locator('link[rel="stylesheet"]').getAttribute('href'),/civolten-capa-arte-original-20261108/);
  assert.match(await page.locator('script[src*="app.js"]').getAttribute('src'),/civolten-capa-arte-original-20261108/);
  await page.evaluate(()=>{
   window.print=()=>{window.__civoltenPrintTest={
    v5:!!document.querySelector('.budget-print.budget-pdf-v5'),
    pages:document.querySelectorAll('.proposal-page').length,
    logo:!!document.querySelector('.proposal-wordmark'),
    watermark:!!document.querySelector('.proposal-watermark')
   }};
  });
  await page.locator('[data-action="budget-print"]').click();
  assert.deepEqual(await page.evaluate(()=>window.__civoltenPrintTest),
   {v5:true,pages:3,logo:true,watermark:true},'O botão deve chamar o Signature novo');
  // Exportação PDF real (sem chamar impressão do Android), validando o modelo escolhido.
  await page.emulateMedia({media:'print'});
  const marks=await page.locator('.proposal-wordmark,.proposal-brand-icon,.proposal-watermark img')
   .evaluateAll(list=>list.map(img=>({ok:img.complete&&img.naturalWidth>0,src:img.getAttribute('src')})));
  assert.equal(marks.length,12,'Logo e marca-d’água em cada uma das três páginas');
  assert.ok(marks.every(m=>m.ok),'O PDF não pode sair sem as imagens oficiais');
  const photo=await page.locator('.proposal-cover-background').evaluate(img=>({
   loaded:img.complete&&img.naturalWidth>0,ratio:img.naturalWidth/img.naturalHeight,
   coverage:img.getBoundingClientRect().width/img.parentElement.getBoundingClientRect().width,
   position:getComputedStyle(img).position,fit:getComputedStyle(img).objectFit
  }));
  assert.ok(photo.loaded,'A imagem PNG enviada ao GitHub deve carregar antes do PDF');
  assert.equal(photo.position,'absolute');
  assert.equal(photo.fit,'cover');
  assert.ok(photo.coverage>.99&&photo.coverage<1.01,'O fundo fotográfico ocupa a largura A4 inteira');
  assert.equal(await page.locator('.proposal-watermark').first().evaluate(el=>getComputedStyle(el).position),'absolute');
  assert.equal(await page.locator('.proposal-cover .proposal-page-content').evaluate(el=>getComputedStyle(el).backgroundImage),'none');
  const coverFont=await page.locator('.proposal-cover-card').evaluate(card=>{
   const values=[...card.querySelectorAll('.proposal-cover-info-row em')];
   const project=values[1],client=values[0];
   const box=card.getBoundingClientRect(),
    footer=card.closest('.proposal-cover').querySelector('.proposal-cover-bottom').getBoundingClientRect();
   return {
    project:parseFloat(getComputedStyle(project).fontSize),
    client:parseFloat(getComputedStyle(client).fontSize),
    fit:box.bottom<footer.top
   };
  });
  assert.ok(coverFont.project>coverFont.client,'Obra / Local deve se destacar na capa');
  assert.ok(coverFont.client>14,'Os dados do cliente devem estar maiores e legíveis');
  assert.ok(coverFont.fit,'O cartão de informações não pode encobrir o rodapé da capa');
  await page.screenshot({path:'test-artifacts/proposta-signature-preview.png',fullPage:true});
  const pdf=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});
  await fs.promises.writeFile('test-artifacts/proposta-signature-3-paginas.pdf',pdf);
  const pageCount=bytes=>(Buffer.from(bytes).toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
  assert.equal(pageCount(pdf),3,'Proposta de dois serviços deve ter exatamente 3 páginas A4');
  await page.emulateMedia({media:'screen'});
  const pending=page.waitForEvent('download');
  await page.locator('[data-action="budget-export"]').click();
  assert.match((await pending).suggestedFilename(),/orcamento-demonstrativo\.csv/);
  await page.locator('[data-action="budget-edit-item"]').first().click();
  await page.locator('#budget-service-form [name="quantity"]').fill('3');
  await page.locator('#budget-service-form [type="submit"]').click();
  await page.locator('#budget-form [type="submit"]').click();
  await page.locator('.budget-list-item').first().waitFor();
  await page.reload({waitUntil:'networkidle'});
  await login();
  await page.locator('[data-go="budgets"]').first().click();
  assert.equal(await page.locator('.budget-list-item').count(),1);
  await page.locator('[data-action="budget-open"]').first().click();
  assert.match(await page.locator('.budget-item').first().innerText(),/3 un/);
  await page.locator('[data-action="budget-edit-item"]').first().click();
  assert.equal(await page.locator('#budget-service-form [name="quantity"]').inputValue(),'3');
  await page.locator('#budget-service-form [data-action="close-modal"]').click();
  assert.equal(await page.locator('#budget-form [name="paymentTerms"]').inputValue(),'40% na assinatura e 60% na entrega');
  page.once('dialog',d=>d.accept());
  await page.locator('[data-action="budget-delete"]').click();
  await page.locator('.budget-list-item').first().waitFor({state:'detached'});
  assert.equal(await page.locator('.budget-list-item').count(),0);
  assert.deepEqual(errors,[],'Não pode haver erros no navegador');
  console.log('PASSOU: orçamento fictício, criação, alteração, banco simulado, CSV e exclusão.');
 }finally{await browser.close();await new Promise(done=>server.close(done));}
})().catch(err=>{console.error(err);process.exitCode=1;server.close()});
