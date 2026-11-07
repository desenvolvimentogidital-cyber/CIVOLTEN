'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const dist=path.resolve(__dirname,'../dist');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8',
 '.css':'text/css;charset=utf-8','.png':'image/png','.svg':'image/svg+xml',
 '.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const raw=new URL(req.url,'http://localhost');
 const name=raw.pathname==='/'?'/index.html':raw.pathname;
 const file=path.resolve(dist,'.'+decodeURIComponent(name));
 if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,b)=>{
  if(err){res.writeHead(404);res.end();return}
  res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});
  res.end(b);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,errors=[];
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   localStorage.setItem('civolten_daily_v2',JSON.stringify({
    clients:[{id:'antigo',name:'Cliente antigo'}],quotes:[{id:'q1',price:2999}]
   }));
  });
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'networkidle'});
  await page.locator('h1').filter({hasText:'Painel principal'}).waitFor();
  assert.equal(await page.locator('[data-page]').count(),3);
  assert.equal(await page.locator('[data-page="home"]').count(),1);
  for(const legacy of ['Orçamentos','SIURB','Cronograma','Obras']){
   assert.equal(await page.locator('[data-page]').filter({hasText:legacy}).count(),0);
  }
  await page.locator('[data-page="config"]').click();
  await page.locator('[data-action="add-fixed"]').click();
  await page.locator('#cv-record-form [name="name"]').fill('Aluguel');
  await page.locator('#cv-record-form [name="amount"]').fill('1200');
  await page.locator('#cv-record-form button[type="submit"]').click();
  await page.locator('[data-action="add-fixed"]').click();
  await page.locator('#cv-record-form [name="name"]').fill('Sistema anual');
  await page.locator('#cv-record-form [name="amount"]').fill('1200');
  await page.locator('#cv-record-form [name="frequency"]').selectOption('year');
  await page.locator('#cv-record-form button[type="submit"]').click();
  await page.locator('[data-tab="variable"]').click();
  await page.locator('[data-action="add-variable"]').click();
  await page.locator('#cv-record-form [name="name"]').fill('Combustível');
  await page.locator('#cv-record-form [name="rate"]').fill('10');
  await page.locator('#cv-record-form [name="monthlyQty"]').fill('50');
  await page.locator('#cv-record-form button[type="submit"]').click();
  await page.locator('[data-action="add-variable"]').click();
  await page.locator('#cv-record-form [name="name"]').fill('Material extra');
  await page.locator('#cv-record-form [name="rate"]').fill('80');
  await page.locator('#cv-record-form button[type="submit"]').click();
  await page.locator('[data-page="employees"]').click();
  await page.locator('[data-action="add-employees"]').click();
  await page.locator('#cv-record-form [name="name"]').fill('Pedreiro teste');
  await page.locator('#cv-record-form [name="role"]').fill('Pedreiro');
  await page.locator('#cv-record-form [name="salary"]').fill('3000');
  await page.locator('#cv-record-form [name="productiveHours"]').fill('160');
  await page.locator('#cv-record-form [name="fgtsPct"]').fill('8');
  await page.locator('#cv-record-form [name="employerPct"]').fill('20');
  await page.locator('#cv-record-form [name="benefits"]').fill('300');
  await page.locator('#cv-record-form [name="extras"]').fill('100');
  await page.locator('#cv-record-form button[type="submit"]').click();
  const r=await page.evaluate(()=>({
   summary:window.CIVOLTENNewApp.summary,
   state:window.CIVOLTENNewApp.state,
   legacy:JSON.parse(localStorage.getItem('civolten_daily_v2'))
  }));
  assert.equal(r.summary.fixedMonthly,130000);
  assert.equal(r.summary.variableMonthly,50000);
  assert.equal(r.summary.employeeMonthly,466667);
  assert.equal(r.summary.forecastMonthly,646667);
  assert.equal(r.summary.variableMissing,1);
  assert.equal(r.legacy.quotes[0].price,2999);
  assert.equal(r.state.employees[0].name,'Pedreiro teste');
  await page.reload({waitUntil:'networkidle'});
  await page.locator('h1').filter({hasText:'Painel principal'}).waitFor();
  assert.equal(await page.evaluate(()=>window.CIVOLTENNewApp.summary.forecastMonthly),646667);
  await page.locator('[data-page="employees"]').click();
  await page.locator('[data-action="details-employees"]').click();
  await page.locator('#cv-dialog').getByText('Custo por hora',{exact:true}).waitFor();
  await page.locator('[data-action="close-dialog"]').click();
  await page.locator('[data-page="config"]').click();
  page.once('dialog',async dialog=>dialog.accept());
  await page.locator('[data-action="delete-fixed"]').first().click();
  assert.equal(await page.evaluate(()=>window.CIVOLTENNewApp.state.fixed.length),1,
   'Excluir deve remover somente o custo selecionado');
  assert.deepEqual(errors,[],'Erros JavaScript: '+errors.join('; '));
  console.log('CIVOLTEN BASE CLEAN — PASS: home, empresa, custo fixo/variável, funcionário, persistência e legado preservado');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
