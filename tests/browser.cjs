const {chromium}=require('playwright');
const {createServer}=require('node:http');
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
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
 const port=server.address().port,errors=[];
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'networkidle'});
  await page.locator('.auth-page').waitFor();
  assert.equal(await page.locator('.auth-brand img').count(),2);
  const logos=await page.locator('.auth-brand img').evaluateAll(nodes=>nodes.map(n=>n.naturalWidth));
  assert.ok(logos.every(width=>width>0),'Logotipos originais devem carregar');
  await fs.promises.mkdir(path.resolve(__dirname,'../test-artifacts'),{recursive:true});
  await page.screenshot({path:'test-artifacts/login.png',fullPage:true});
  await page.getByRole('button',{name:'Criar conta'}).click();
  await page.locator('#auth-form [name="name"]').fill('Teste CIVOLTEN');
  await page.locator('#auth-form [name="email"]').fill('teste@example.com');
  await page.locator('#auth-form [name="password"]').fill('SenhaForte123');
  await page.locator('#auth-form button[type="submit"]').click();
  await page.locator('.auth-page').waitFor();
  await page.locator('#auth-form [name="email"]').fill('teste@example.com');
  await page.locator('#auth-form [name="password"]').fill('SenhaForte123');
  await page.locator('#auth-form button[type="submit"]').click();
  await page.locator('.dashboard').waitFor();
  assert.equal(await page.locator('.bottom-nav .nav-item').count(),4);
  assert.match(await page.locator('.metric-grid').innerText(),/Custos fixos/);
  await page.screenshot({path:'test-artifacts/home.png',fullPage:true});
  await page.locator('[data-go="costs"]').last().click();
  await page.locator('[data-action="new-cost"]').last().click();
  await page.locator('#record-form [name="name"]').fill('Aluguel');
  await page.locator('#record-form [name="category"]').fill('Infraestrutura');
  await page.locator('#record-form [name="amount"]').fill('1200');
  await page.locator('#record-form button[type="submit"]').click();
  await page.locator('.cost-row').first().waitFor();
  assert.match(await page.locator('.total-cost-card').innerText(),/1\.200,00/);
  await page.locator('[data-tab="variable"]').click();
  await page.locator('[data-action="new-cost"]').last().click();
  await page.locator('#record-form [name="name"]').fill('Combustível');
  await page.locator('#record-form [name="unitCost"]').fill('50');
  await page.locator('#record-form [name="monthQty"]').fill('10');
  await page.locator('#record-form button[type="submit"]').click();
  assert.match(await page.locator('.total-cost-card').innerText(),/500,00/);
  await page.screenshot({path:'test-artifacts/custos.png',fullPage:true});
  await page.locator('[data-go="team"]').last().click();
  await page.locator('[data-action="new-employee"]').click();
  await page.locator('#record-form [name="name"]').fill('João Silva');
  await page.locator('#record-form [name="role"]').fill('Eletricista');
  await page.locator('#record-form [name="salary"]').fill('3000');
  await page.locator('#record-form [name="hours"]').fill('160');
  await page.locator('#record-form [name="fgtsPct"]').fill('8');
  await page.locator('#record-form [name="employerPct"]').fill('20');
  await page.locator('#record-form button[type="submit"]').click();
  await page.locator('.employee-card').waitFor();
  assert.match(await page.locator('.team-total').innerText(),/4\.266,67/);
  await page.screenshot({path:'test-artifacts/funcionarios.png',fullPage:true});
  await page.locator('[data-go="home"]').last().click();
  const total=await page.evaluate(()=>window.CIVOLTENPreview.summary().total);
  assert.equal(total,596667,'Total deve incluir fixos, variáveis e equipe');
  await page.reload({waitUntil:'networkidle'});
  await page.locator('.auth-page').waitFor();
  await page.locator('#auth-form [name="email"]').fill('teste@example.com');
  await page.locator('#auth-form [name="password"]').fill('SenhaForte123');
  await page.locator('#auth-form button[type="submit"]').click();
  await page.locator('.dashboard').waitFor();
  assert.equal(await page.evaluate(()=>window.CIVOLTENPreview.summary().total),596667,
   'Salvos locais não podem sumir ao fechar/abrir sessão');
  await page.locator('[data-go="more"]').click();
  await page.locator('[data-action="signout"]').click();
  await page.locator('.auth-page').waitFor();
  assert.deepEqual(errors,[],'Erros JavaScript encontrados: '+errors.join('; '));
  console.log('PASSOU: login, identidade visual, painel, custos, equipe, recarga e saída da conta');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(err=>{console.error(err);process.exitCode=1;server.close()});
