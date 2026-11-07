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
  // O botão flutuante não pode atrapalhar a navegação móvel.
  assert.equal(await page.locator('#cv-cloud-fab').count(),0,'Não renderizar botão de Nuvem flutuante');
  await page.locator('nav.bottom-nav [data-page="more"]').click();
  assert.equal(await page.locator('button').filter({hasText:'Nuvem CIVOLTEN'}).count(),0,'A tela Mais não deve ter Nuvem flutuante');
  await page.locator('[data-page="backup"]').last().click();
  await page.locator('[data-action="cloud-backup"]').click();
  await page.locator('#cv-cloud-box').waitFor({state:'visible'});
  await page.locator('#cv-cloud-close').click();
  assert.equal(await page.locator('#cv-cloud-box').isVisible(),false,'A janela da nuvem deve poder fechar');
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

  // Regressão Android: buscar parede deve preencher estimativa automaticamente.
  // Coeficientes e taxas SÃO DADOS SINTÉTICOS APENAS DE TESTE.
  await page.evaluate(()=>{
   const name='FORNECIMENTO E INSTALAÇÃO DE PAREDE TESTE';
   db.siurbItems=[
    {id:'siurb-teste-1',name,code:'PAREDE-001',group:'OBRAS',unit:'M2',cost:200},
    {id:'siurb-teste-2',name:'FORNECIMENTO E INSTALAÇÃO DE PAREDE SEM PLANILHA',
     code:'PAREDE-002',group:'OBRAS',unit:'M2',cost:120}
   ];
   db.siurbMeta={regime:'onerada',base:'2026-07'};
   db.workers=[
    {id:'pedreiro-teste',name:'Pedreiro teste',role:'Pedreiro',cost:38,unit:'hora'},
    {id:'servente-teste',name:'Servente teste',role:'Servente',cost:20,unit:'hora'}
   ];
   window.CIVOLTENSINAPI.getRecords=()=>[{
    id:'SINAPI:SP:2026-07:PAREDE',name,code:'900123',uf:'SP',
    verifiedUF:true,analytical:true,kind:'composicao',unit:'M2',cost:150,
    regime:'onerada',base:'2026-07',analyticLabor:[
     {role:'Pedreiro',hoursPerUnit:1.25},{role:'Servente',hoursPerUnit:.75}],
    analyticItems:[]
   }];
   s.wizard={clientId:'test-client',clientName:'Cliente teste',title:'Parede teste',
    type:'Mão de obra',items:[],status:'Rascunho',priceMode:'auto',profit:20,
    tax:0,fees:0,overhead:5,reserve:3,extraCost:0,discount:0};
   s.page='newquote';s.step=2;s.modal=null;render();
  });
  await page.locator('[data-action="additem"]').click();
  await page.locator('#dw-service-search').fill('FORNECIMENTO E INSTALAÇÃO DE PAREDE TESTE');
  const picked=await page.evaluate(()=>{
   const f=document.getElementById('modal-form');
   return {source:f.elements.sourceId.value,labor:Number(f.elements.labor.value),
    hours:Number(f.dataset.cvAutoHours),status:f.dataset.cvAutoStatus};
  });
  assert.equal(picked.source,'siurb-teste-1','Composição única selecionada sem outro toque');
  assert.equal(picked.labor,62.5,'Custo da equipe calculado dos coeficientes e custo/hora cadastrados');
  assert.equal(picked.hours,2);
  assert.equal(picked.status,'ready');
  await page.locator('#qi-qty').fill('3');
  await page.locator('#modal-form button[type="submit"]').click();
  const populated=await page.evaluate(()=>s.wizard.items[0]);
  assert.equal(populated.qty,3);
  assert.equal(populated.labor,62.5);
  assert.equal(populated.productivity.hoursPerUnit,2);
  assert.equal(populated.referencePending,false);
  // Sem coeficientes oficiais não exige digitar produtividade, mas impede envio.
  await page.locator('[data-action="additem"]').click();
  await page.locator('#dw-service-search').fill('FORNECIMENTO E INSTALAÇÃO DE PAREDE SEM PLANILHA');
  await page.locator('#modal-form button[type="submit"]').click();
  const pending=await page.evaluate(()=>s.wizard.items[1]);
  assert.equal(pending.referencePending,true,'Item sem referência analítica fica pendente');
  assert.equal(pending.labor,0,'Não inventar custo da mão de obra');
  const pendingAudit=await page.evaluate(()=>{
    s.wizard.status='Enviado';
    return window.CIVOLTENFinancialAudit.inspect(s.wizard);
  });
  assert.ok(pendingAudit.errors.some(e=>e.code==='reference-pending'),
    'Bloquear emissão de orçamento com custo de composição pendente');
  // Serviços já importados também aproveitam horas oficiais sem exigir digitação.
  await page.evaluate(()=>{
   const name='FORNECIMENTO E INSTALAÇÃO DE PAREDE TESTE';
   db.siurbItems=[];
   db.services=[{id:'saved-siurb-1',name,unit:'M2',origin:'SIURB',
    sourceCode:'PAREDE-001',sourceRegime:'onerada',sourceDate:'07/2026',
    sourceGroup:'EDIF',labor:0,material:0,costSplitConfirmed:false,referenceCost:null}];
   s.wizard={clientId:'test-client',clientName:'Cliente teste',title:'Alvenaria catalogada',
    type:'Mão de obra',items:[],status:'Rascunho',priceMode:'auto',
    profit:20,tax:0,fees:0,overhead:5,reserve:3,extraCost:0,discount:0};
   s.page='newquote';s.step=2;s.modal=null;render();
  });
  await page.locator('[data-action="additem"]').click();
  await page.locator('#dw-service-search').fill('FORNECIMENTO E INSTALAÇÃO DE PAREDE TESTE');
  const recovered=await page.evaluate(()=>{
   const f=document.getElementById('modal-form');
   return {serviceId:f.elements.serviceId.value,labor:Number(f.elements.labor.value),
    hours:Number(f.dataset.cvAutoHours),status:f.dataset.cvAutoStatus};
  });
  assert.equal(recovered.serviceId,'saved-siurb-1');
  assert.equal(recovered.hours,2);
  assert.equal(recovered.labor,62.5);
  assert.equal(recovered.status,'ready');
  await page.locator('#modal-form button[type="submit"]').click();
  assert.equal(await page.evaluate(()=>s.wizard.items[0].referencePending),false);

  // Caso real relatado: selecionar alvenaria de tijolo maciço e Salvar,
  // sem preencher atividades, horas, equipe ou marcar composição conferida.
  await page.evaluate(()=>{
   db.siurbItems=[{
    id:'siurb-alvenaria-tijolo-macico',code:'TJM-001',group:'EDIF',
    name:'ALVENARIA DE TIJOLO MACIÇO',unit:'M2',cost:null
   }];
   db.siurbMeta={regime:'onerada',base:'07/2026'};
   db.services=[];db.workers=[];
   window.CIVOLTENSINAPI.getRecords=()=>[];
   s.wizard={clientId:'test-client',clientName:'Cliente teste',
    title:'Orçamento de alvenaria',type:'Mão de obra',items:[],
    status:'Rascunho',priceMode:'auto',profit:20,tax:0,fees:0,
    overhead:5,reserve:3,extraCost:0,discount:0};
   s.page='newquote';s.step=2;s.modal=null;render();
  });
  await page.locator('[data-action="additem"]').click();
  await page.locator('#dw-service-search').fill('ALVENARIA DE TIJOLO MACIÇO');
  assert.equal(await page.locator('#modal-form').getAttribute('novalidate'),'',
    'Cadastro rápido não pode bloquear a inclusão por campos avançados ocultos');
  const chosen=await page.evaluate(()=>{
   const f=document.getElementById('modal-form');
   return {id:f.elements.sourceId.value,service:f.elements.service.value,qty:f.elements.qty.value};
  });
  assert.equal(chosen.id,'siurb-alvenaria-tijolo-macico');
  assert.equal(chosen.qty,'1','Quantidade inicial automática de uma unidade');
  await page.locator('#modal-form button[type="submit"]').click();
  const alvenaria=await page.evaluate(()=>({
   count:s.wizard.items.length,item:s.wizard.items[0],
   onDisk:JSON.parse(localStorage.getItem('civolten_daily_v2')).quotes.length
  }));
  assert.equal(alvenaria.count,1,'Salvar deve fechar modal e incluir o serviço');
  assert.equal(alvenaria.item.service,'ALVENARIA DE TIJOLO MACIÇO');
  assert.equal(alvenaria.item.unit,'M2');
  assert.equal(alvenaria.item.qty,1);
  assert.equal(alvenaria.item.referencePending,true);
  assert.equal(alvenaria.item.referencePricePending,true);
  assert.equal(alvenaria.item.referenceCost,null,
   'Não inventar custo público ou produtividade de alvenaria sem planilha');
  // O cronograma também pode ser salvo sem exigir marcação de atividade.
  await page.evaluate(()=>go('schedule'));
  assert.equal(await page.locator('[name="wfConfirmed"]').count(),0,
    'Não exigir conferência técnica manual para salvar o planejamento');
  await page.locator('[data-action="wf-save"]').click();
  const plan=await page.evaluate(()=>({
   page:s.page,mode:s.wizard.schedule.automaticStatus,
   reasons:s.wizard.schedule.automaticReasons,
   item:s.wizard.items[0]
  }));
  assert.equal(plan.page,'newquote');
  assert.equal(plan.mode,'pending');
  assert.ok(plan.reasons.some(t=>/produtividade/i.test(t)));
  assert.equal(plan.item.service,'ALVENARIA DE TIJOLO MACIÇO');
  const review=await page.evaluate(()=>window.CIVOLTENFinancialAudit.inspect(s.wizard));
  assert.ok(review.errors.some(x=>x.code==='reference-pending'),
   'Proposta com custo incompleto segue protegida, embora o item tenha sido salvo');

  // Cadastro de serviços SINAPI: funções oficiais verificáveis não devem
  // exigir checkbox manual de produtividade no momento de salvar.
  await page.evaluate(()=>{
   db.workers=[{id:'prof-pedreiro',name:'Pedreiro A',role:'Pedreiro',cost:38,unit:'hora'}];
   db.services=[{id:'svc-alvenaria-analitica',origin:'SINAPI',
    name:'ALVENARIA DE TIJOLO MACIÇO ANALÍTICA',unit:'M2',
    sourceCode:'900001',sourceDate:'2026-07',sourceUF:'SP',sourceFile:'Analitico SP.xlsx',regime:'onerada',uf:'SP',
    verifiedUF:true,analytical:true,kind:'composicao',cost:150,
    analyticLabor:[{role:'Pedreiro',hoursPerUnit:1.25}],analyticItems:[],
    labor:0,material:0,analyticalReviewNeeded:true}];
   s.page='services';s.modal='addservice';s.edit=db.services[0];render();
  });
  assert.equal(await page.locator('[name="slConfirmed"]').count(),0,
   'Cadastro não deve exigir marcar conferência de produtividade');
  // Não clicar no botão opcional de preencher: o próprio Salvar deve
  // resolver coeficientes e alocar o profissional cadastrado.
  assert.equal(await page.locator('[name="qaHours0"]').inputValue(),'');
  await page.locator('#modal-form button[type="submit"]').click();
  const autoSaved=await page.evaluate(()=>db.services[0]);
  assert.equal(autoSaved.analyticalReviewNeeded,false);
  assert.equal(autoSaved.productivity.crew[0].hours,1.25);
  assert.equal(autoSaved.productivity.crew[0].workerId,'prof-pedreiro');
  assert.equal(autoSaved.productivity.productivitySource,
   'SINAPI - associação automática de coeficientes diretos');

  await page.evaluate(()=>{s.modal=null;s.page='services';render()});
  await page.locator('.cv-auto-panel h3').waitFor();
  assert.match(await page.locator('.cv-auto-panel').innerText(),/Motor de automação/);
  // Login real será homologado com Neon; aqui testamos a UI sem contas reais.
  // Fake de Auth restrito ao contexto efêmero deste teste em localhost.
  await page.evaluate(()=>{
   document.querySelector('#cv-auth-screen')?.remove();
   const session={user:null};
   const fake={
    getSession:async()=>({data:{user:session.user}}),
    signUp:{email:async({email,name})=>{
     session.user={id:'auth-test-user',email,name};return {data:{user:session.user}};
    }},
    signIn:{email:async({email})=>{
     session.user={id:email==='segundo@example.test'?'outro-user':'auth-test-user',email};
     return {data:{user:session.user}};
    }},
    signOut:async()=>{session.user=null;return {data:{success:true}}}
   };
   window.__cvAuthFake=session;
   window.__cvAuthGate=window.CIVOLTENAuthScreen.mount({
    auth:fake,ownerKey:'civolten_auth_test_owner',storageKey:'civolten_daily_v2'
   });
  });
  await page.locator('#cv-auth-form').waitFor();
  await page.locator('[data-cv-auth="signup"]').click();
  await page.locator('#cv-auth-name').fill('Teste CIVOLTEN');
  await page.locator('#cv-auth-email').fill('teste@example.test');
  await page.locator('#cv-auth-password').fill('SenhaTeste123');
  await page.locator('#cv-auth-form button[type="submit"]').click();
  await page.locator('[data-cv-auth="bind"]').waitFor();
  const binding=await page.evaluate(()=>localStorage.getItem('civolten_auth_test_owner'));
  assert.equal(binding,null,'Não vincular o aparelho sem confirmação expressa');
  await page.locator('[data-cv-auth="bind"]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('civolten_auth_test_owner')),'auth-test-user');
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('cv-auth-locked')),false);
  const quotesBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('civolten_daily_v2')).quotes.length);
  await page.evaluate(()=>window.__cvAuthGate.signOut());
  await page.locator('#cv-auth-form').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('cv-auth-locked')),true);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('civolten_daily_v2')).quotes.length),quotesBefore,
    'Sair não pode apagar orçamentos locais');
  await page.locator('#cv-auth-email').fill('teste@example.test');
  await page.locator('#cv-auth-password').fill('SenhaTeste123');
  await page.locator('#cv-auth-form button[type="submit"]').click();
  await page.waitForFunction(()=>!document.documentElement.classList.contains('cv-auth-locked'));
  await page.evaluate(()=>window.__cvAuthGate.signOut());
  await page.locator('#cv-auth-email').fill('segundo@example.test');
  await page.locator('#cv-auth-password').fill('SenhaTeste123');
  await page.locator('#cv-auth-form button[type="submit"]').click();
  await page.locator('.cv-notice').filter({hasText:'Acesso bloqueado'}).waitFor();
  assert.equal(await page.evaluate(()=>document.getElementById('app').inert),true,
    'Outra conta não pode visualizar os dados do primeiro usuário');
        assert.deepEqual(runtimeErrors,[],'Erros JavaScript no navegador: '+runtimeErrors.join('; '));
  console.log('SMOKE PASSOU: Android, produtividade SINAPI automática, SIURB pendente seguro, orçamento, custo e PDF');
 }finally{
  if(browser)await browser.close();
  if(server.listening)await close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
