// Validação real do PDF A4 com o Chromium usado pelo Android/CIVOLTEN.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const type={'.css':'text/css;charset=utf-8','.png':'image/png','.svg':'image/svg+xml',
 '.js':'application/javascript','.html':'text/html'};
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const filepath=path.resolve(root,'.'+pathname);
 if(!filepath.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(filepath,(error,data)=>{
  if(error){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':type[path.extname(filepath)]||'application/octet-stream'});
  res.end(data);
 });
});
(async()=>{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin='http://127.0.0.1:'+server.address().port;
 const {workPrintable}=await import('../src/work-order-print.mjs');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:900,height:1270}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const buildOrder=(count)=>({
   contractRef:'OS-2026-6FC50FC4',customer:'Larissa',project:'Reformas',
   acceptanceRef:'Aceite eletrônico CIVOLTEN nº 8c9d0f4f-a613-4a07-9160-52bb451889f6 por Cristiano Alessandro (cliente@exemplo.com)',
   approvedOn:'2026-11-09',startOn:'2026-11-10',contractValue:35916,
   budgetSnapshot:{items:Array.from({length:count},(_,i)=>({
    id:String(i+1),description:i===0?'ALVENARIA EM BLOCO CERÂMICO COMUM - 19CM':
     'MONTAGEM E INSTALAÇÃO DE INFRAESTRUTURA DE ELÉTRICA E CONSTRUÇÃO CIVIL '+(i+1),
    unit:i%2?'UN':'M2',quantity:150+i
   }))},pricedRows:[{selling:3591600}]
  });
  const pdfPageCount=buffer=>(Buffer.from(buffer).toString('latin1')
   .match(/\/Type\s*\/Page\b/g)||[]).length;
  async function render(order){
   const content=workPrintable(order);
   await page.setContent('<!doctype html><html lang="pt-BR"><head>'+
    '<meta charset="utf-8"><base href="'+origin+'/"><link rel="stylesheet" href="'+origin+'/styles.css"></head>'+
    '<body><div id="work-print-root">'+content+'</div></body></html>',{waitUntil:'networkidle'});
   await page.emulateMedia({media:'print'});
   await page.waitForFunction(()=>[...document.querySelectorAll('.work-pdf-symbol,.work-pdf-wordmark')]
    .every(x=>x.complete&&x.naturalWidth>0),null,{timeout:12000});
   await page.evaluate(()=>document.fonts.ready);
   const images=await page.locator('.work-pdf-symbol,.work-pdf-wordmark').evaluateAll(xs=>
    xs.map(x=>({ok:x.complete&&x.naturalWidth>0,src:x.getAttribute('src')})));
   assert.ok(images.every(x=>x.ok),'Marcas CIVOLTEN precisam renderizar no PDF');
   const pdf=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
   return {pdf,html:content,pages:pdfPageCount(pdf)};
  }
  const single=await render(buildOrder(1));
  assert.equal(single.pages,1,'OS de um serviço deve caber em uma folha A4');
  assert.equal(await page.locator('[data-work-pdf-page]').count(),1);
  assert.equal(await page.locator('.work-pdf-services th').count(),3);
  assert.equal(await page.locator('.work-pdf-services td').count(),3);
  assert.equal(await page.locator('.work-pdf-wordmark').count(),1);
  assert.equal(await page.locator('.work-pdf-symbol').count(),1);
  assert.doesNotMatch(single.html,/Valor contratado|R\$|35\.916|35916/);
  fs.mkdirSync('test-artifacts',{recursive:true});
  fs.writeFileSync('test-artifacts/civolten-ordem-servico-modelo3.pdf',single.pdf);
  await page.screenshot({path:'test-artifacts/civolten-ordem-servico-modelo3.png',fullPage:true});
  const multi=await render(buildOrder(24));
  const expected=await page.locator('[data-work-pdf-page]').count();
  assert.ok(expected>=3,'Obra com 24 serviços deve usar várias páginas');
  assert.equal(multi.pages,expected,'Impressão não pode criar folhas vazias extras');
  assert.equal(await page.locator('.work-pdf-services tbody tr').count(),24,
   'Nenhum serviço da obra deve ser omitido');
  assert.equal(await page.locator('.work-pdf-signatures').count(),1,
   'Assinaturas devem ficar apenas na última folha');
  assert.deepEqual(errors,[],'PDF não pode produzir erro no navegador');
  console.log('PASSOU: OS CIVOLTEN modelo 3, logotipos oficiais, 1 página A4, várias páginas, sem preços.');
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
})().catch(error=>{console.error(error);process.exitCode=1;server.close()});
