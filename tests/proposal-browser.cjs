// Fluxo público de aceite de uma proposta real em navegador Chromium (Supabase local simulado).
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8',
 '.css':'text/css;charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,buf)=>{
  if(err){res.writeHead(404);res.end('Não encontrado');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
  res.end(buf);
 });
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  const owner=await context.newPage(),errors=[];
  owner.on('pageerror',err=>errors.push(err.message));
  const id='00000000-0000-4000-8000-000000000001';
  const bId='11000000-0000-4000-8000-000000000001';
  const itemId='22000000-0000-4000-8000-000000000001';
  const budget={
   id:bId,user_id:id,title:'Reforma elétrica residencial',customer:'Cliente Contratante',
   project:'Obra São Paulo',location:'São Paulo',notes:'Somente mão de obra',
   expires_on:null,demo:false,created_at:'2026-11-09T11:00:00Z',
   pricing:{monthlyCostCents:2115335,productiveHours:352,productiveDays:22,
    hoursPerDay:8,productivePeople:2,taxPct:6,marginPct:30,
    companyName:'CIVOLTEN',capturedOn:'2026-11-09'},
   items:[{id:itemId,source:'manual',description:'Instalação de eletrodutos',
    unit:'m²',quantity:150,laborHours:1.78,directCost:0}],
   commercial:{laborOnly:true,paymentTerms:'40% na entrada e 60% na entrega',
    executionTerm:'20 dias úteis',warrantyTerms:'12 meses',
    scopeNotes:'Materiais serão fornecidos pelo contratante',
    schedule:{goal:'crew',crew:2,pricingMode:'hours'}}
  };
  const db={cv_budget_drafts_v1:[budget]};
  await owner.goto(origin);
  await owner.evaluate(v=>localStorage.setItem('cv_e2e_supabase_v1',JSON.stringify(v)),db);
  const login=async()=>{
   await owner.locator('.auth-page').waitFor();
   await owner.locator('#auth-form [name="email"]').fill('propostas@civolten.local');
   await owner.locator('#auth-form [name="password"]').fill('senha-local-qualquer');
   await owner.locator('#auth-form [type="submit"]').click();
   await owner.locator('.dashboard').waitFor();
  };
  await login();
  await owner.locator('[data-go="budgets"]').first().click();
  await owner.locator('[data-action="budget-invite-create"]').waitFor();
  owner.once('dialog',d=>d.accept());
  await owner.locator('[data-action="budget-invite-create"]').click();
  await owner.locator('[data-action="budget-invite-copy"]').waitFor();
  const invites=await owner.evaluate(()=>window.CIVOLTENPreview.data.invites);
  assert.equal(invites.length,1);
  assert.equal(invites[0].status,'pending');
  assert.match(invites[0].token,/^[0-9a-f]{64}$/);
  await owner.locator('[data-action="budget-open"]').first().click();
  await owner.locator('.proposal-online-action a').waitFor();
  assert.match(await owner.locator('.proposal-online-action a').getAttribute('href'),/aceite\.html#t=[0-9a-f]{64}/);
  await owner.emulateMedia({media:'print'});
  const printed=await owner.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});
  const pages=(Buffer.from(printed).toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
  assert.equal(pages,3,'PDF com botão de aceite deve continuar com 3 páginas A4');
  await owner.emulateMedia({media:'screen'});
  const visitor=await context.newPage();
  visitor.on('pageerror',err=>errors.push(err.message));
  await visitor.goto(origin+'/aceite.html#t='+invites[0].token);
  await visitor.locator('#respond-form').waitFor({state:'visible'});
  assert.match(await visitor.locator('#total').innerText(),/25\.070,79/);
  assert.match(await visitor.locator('#services').innerText(),/Instalação de eletrodutos/);
  await visitor.locator('[name="decision"][value="accepted"]').check();
  await visitor.locator('[name="name"]').fill('Maria Contratante');
  await visitor.locator('[name="email"]').fill('maria@cliente.com');
  await visitor.locator('[name="confirmed"]').check();
  visitor.once('dialog',d=>d.accept());
  await visitor.locator('#respond-form [type="submit"]').click();
  await visitor.locator('#answered').waitFor({state:'visible'});
  assert.match(await visitor.locator('#answered').innerText(),/Aceite registrado com sucesso/);
  await owner.reload({waitUntil:'networkidle'});
  await login();
  assert.match(await owner.locator('.budget-reply-dashboard').innerText(),/1 proposta\(s\) aceita/);
  await owner.locator('[data-go="budgets"]').first().click();
  await owner.locator('[data-action="work-approve-budget"]').first().click();
  assert.match(await owner.locator('#work-form [name="acceptanceRef"]').inputValue(),/Aceite eletrônico CIVOLTEN/);
  assert.match(await owner.locator('#work-form [name="acceptanceRef"]').inputValue(),/maria@cliente.com/);
  await owner.locator('#work-form [name="acceptanceConfirmed"]').check();
  await owner.locator('#work-form [type="submit"]').click();
  await owner.locator('.work-header').waitFor();
  assert.equal((await owner.evaluate(()=>window.CIVOLTENPreview.data.works)).length,1);
  assert.deepEqual(errors,[]);
  console.log('PASSOU: botão no PDF -> página pública -> aceite -> painel -> OS sem duplicidade.');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
})().catch(err=>{console.error(err);process.exitCode=1;server.close()});
