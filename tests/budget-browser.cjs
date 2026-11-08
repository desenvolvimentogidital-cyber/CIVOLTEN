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
  await page.locator('#budget-catalog').selectOption('DEMO-E01');
  await page.locator('[data-action="budget-add-item"]').click();
  await page.locator('.budget-item [name="quantity"]').fill('2');
  await page.locator('#budget-catalog').selectOption('DEMO-C02');
  await page.locator('[data-action="budget-add-item"]').click();
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
  const pending=page.waitForEvent('download');
  await page.locator('[data-action="budget-export"]').click();
  assert.match((await pending).suggestedFilename(),/orcamento-demonstrativo\.csv/);
  await page.locator('.budget-item').first().locator('[name="quantity"]').fill('3');
  await page.locator('#budget-form [type="submit"]').click();
  await page.locator('.budget-list-item').first().waitFor();
  await page.reload({waitUntil:'networkidle'});
  await login();
  await page.locator('[data-go="budgets"]').first().click();
  assert.equal(await page.locator('.budget-list-item').count(),1);
  await page.locator('[data-action="budget-open"]').first().click();
  assert.equal(await page.locator('.budget-item').first().locator('[name="quantity"]').inputValue(),'3');
  page.once('dialog',d=>d.accept());
  await page.locator('[data-action="budget-delete"]').click();
  await page.locator('.budget-list-item').first().waitFor({state:'detached'});
  assert.equal(await page.locator('.budget-list-item').count(),0);
  assert.deepEqual(errors,[],'Não pode haver erros no navegador');
  console.log('PASSOU: orçamento fictício, criação, alteração, banco simulado, CSV e exclusão.');
 }finally{await browser.close();await new Promise(done=>server.close(done));}
})().catch(err=>{console.error(err);process.exitCode=1;server.close()});
