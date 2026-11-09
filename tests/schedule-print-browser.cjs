// Teste de impressão A4 do cronograma, inclusive com várias folhas e logo real.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const mime={'.css':'text/css;charset=utf-8','.html':'text/html;charset=utf-8',
 '.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const resolved=path.resolve(root,'.'+pathname);
 if(!resolved.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(resolved,(err,buffer)=>{
  if(err){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(resolved)]||'application/octet-stream'});
  res.end(buffer);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const {schedulePlan}=await import('../src/budget-schedule.mjs');
 const {printableFieldSchedule}=await import('../src/schedule-print.mjs');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:850,height:1200}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const capacity={productiveDays:22,hoursPerDay:8,productivePeople:2,monthlyCostCents:2115335};
  const make=n=>{
   const items=Array.from({length:n},(_,i)=>({id:String(i),
    description:i===0?'ALVENARIA EM BLOCO CERÂMICO COMUM - 19CM':
     'Instalação profissional de infraestrutura de elétrica e construção civil na obra '+(i+1),
    quantity:150+i,laborHours:1.78,unit:'M2',
    roles:[{role:'Pedreiro',hours:1.78}]}));
   const plan=schedulePlan(items,{goal:'crew',crew:2,startDate:'2026-11-09'},capacity);
   const html=printableFieldSchedule(plan,{ref:'OS-2026-6FC50FC4',
    customer:'Larissa',project:'Reformas',items});
   return {html,plan};
  };
  const pageCount=pdf=>(Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
  async function print(n){
   const {html,plan}=make(n);
   await page.setContent('<!doctype html><html lang="pt-BR"><head>'+
    '<meta charset="utf-8"><base href="'+base+'/">'+
    '<link rel="stylesheet" href="'+base+'/styles.css"></head>'+
    '<body><div id="field-schedule-print-root">'+html+'</div></body></html>',{waitUntil:'networkidle'});
   await page.emulateMedia({media:'print'});
   await page.waitForFunction(()=>[...document.querySelectorAll('.field-schedule-icon,.field-schedule-logo')]
    .every(img=>img.complete&&img.naturalWidth>0),null,{timeout:12000});
   const layout=await page.locator('[data-field-schedule-page]').evaluateAll(nodes=>nodes.map(el=>{
    const rect=el.getBoundingClientRect(),body=el.querySelector('.field-schedule-body'),
     footer=el.querySelector('.field-schedule-footer');
    return {height:rect.height,bodyEnd:body.getBoundingClientRect().bottom,
     footerTop:footer.getBoundingClientRect().top};
   }));
   assert.ok(layout.every(x=>x.bodyEnd<=x.footerTop+2),'Tabela invadiu o rodapé do PDF');
   const pdf=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
   assert.ok(pdf.length>10000,'PDF deve conter imagens e serviços renderizados');
   return {pdf,pages:pageCount(pdf),expected:layout.length,plan};
  }
  const single=await print(1);
  assert.equal(single.pages,1,'Um serviço deve resultar em 1 página A4');
  assert.equal(await page.locator('.field-schedule-check').count(),3);
  assert.equal(await page.locator('.field-schedule-checkout').count(),1);
  assert.ok(await page.locator('.field-schedule-logo').evaluate(x=>x.naturalWidth>0));
  fs.mkdirSync('test-artifacts',{recursive:true});
  fs.writeFileSync('test-artifacts/civolten-cronograma-campo.pdf',single.pdf);
  await page.screenshot({path:'test-artifacts/civolten-cronograma-campo.png',fullPage:true});
  const multi=await print(22);
  assert.ok(multi.expected>=3);
  assert.equal(multi.pages,multi.expected,'Não pode haver folhas em branco extras');
  assert.equal(await page.locator('.field-schedule-list tbody tr').count(),22);
  assert.equal(await page.locator('.field-schedule-checkout').count(),1);
  assert.deepEqual(errors,[],'Não pode haver erros do navegador');
  console.log('PASSOU: cronograma de campo 1 e múltiplas folhas A4, logos e checklist sem preços.');
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1;server.close()});
