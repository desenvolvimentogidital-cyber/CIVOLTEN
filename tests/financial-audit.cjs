#!/usr/bin/env node
'use strict';
/* CIVOLTEN: testes financeiros em Node.js sem serviços pagos ou banco real. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const eq=(a,b,eps=.025)=>assert.ok(Math.abs(a-b)<=eps,String(a)+' deveria ser '+String(b));
const test=(name,fn)=>{try{fn();console.log('OK',name)}catch(e){console.error('FALHOU',name,e.message);process.exitCode=1}};
const files=['payroll-cost.js','financial-audit.js','quote-automation.js','daily-workflow.js','workforce-schedule.js','job-expense-presets.js','quick-quote-item.js','reference-compare.js','unified-catalog.js','sinapi-import.js','sinapi-reference-parser.js','commercial-proposal.js','sw.js'];
test('Sintaxe dos módulos',()=>{for(const f of files)new vm.Script(read(f),{filename:f})});
const html=read('index.html'),m=html.match(/const calc=q=>\{[\s\S]*?\};\nfunction home/);
assert.ok(m,'Função calc não encontrada');
const db={company:{profit:20,tax:6,fees:2,overhead:5,reserve:3},services:[],workers:[]};
const calc=new Function('num','db',m[0].replace(/\nfunction home$/,'')+'return calc;')(v=>Number(v)||0,db);
const win={};new Function('window',read('payroll-cost.js'))(win);
const wage=win.CIVOLTENPayroll.calculate;
test('Salário MEI e encargos',()=>eq(wage({salary:2800,fgts:8,employerInss:3}).total,3453.33));
test('Salário Anexo IV e RAT',()=>eq(wage({salary:2800,fgts:8,employerInss:20,employerExtraPercent:2}).total,4044.44));
test('Periculosidade condicional',()=>eq(wage({salary:3000,fgts:8,employerInss:20,employerExtraPercent:2,additionalKind:'periculosidade',hazardPercent:30}).total,5633.33));
const quote=(change={})=>({status:'Enviado',type:'Completo',clientId:'c1',title:'Obra',profit:20,tax:6,fees:2,overhead:5,reserve:3,discount:0,priceMode:'auto',items:[{service:'Alvenaria',unit:'m²',qty:300,owner:'empresa',labor:70,material:40,extra:5,productivity:{hoursPerUnit:1.6,crew:[{workerId:'p',workerName:'Pedreiro',rate:27,perUnitHours:1.6,count:1}]}}],...change});
const dom={head:{append(){}},createElement(){return {textContent:''}},addEventListener(){}};
const s={wizard:null};let saves=0,warnings=0;
const actions=new Function('window','document','db','s','calc','esc','toast','wizardStep3','persistWizard','click',read('financial-audit.js')+'return {persistWizard,click,wizardStep3};')(
win,dom,db,s,calc,String,()=>warnings++,()=>'<div class="form-actions"></div>',()=>saves++,()=>saves++);
const inspect=win.CIVOLTENFinancialAudit.inspect;
test('Preço sugerido preserva margem alvo',()=>{eq(calc(quote()).margin,20,.001);assert.equal(inspect(quote()).errors.length,0)});
test('Preço abaixo do custo é bloqueado',()=>assert.ok(inspect(quote({priceMode:'manual',manualPrice:20000})).errors.some(e=>e.code==='loss')));
test('Desconto que reduz margem é bloqueado',()=>assert.ok(inspect(quote({discount:2000})).errors.some(e=>e.code==='target-margin')));
test('Custo horário ausente não é aceito',()=>assert.ok(inspect(quote({items:[{...quote().items[0],labor:0}]})).errors.some(e=>e.code==='labor')));
test('Analítico SINAPI não conferido é bloqueado',()=>assert.ok(inspect(quote({items:[{...quote().items[0],analyticalReviewNeeded:true}]})).errors.some(e=>e.code==='analytic')));
test('Rateio fixo incompleto é bloqueado',()=>{
 const q=quote({costModel:'fixed_hourly_v1',fixedMonthlySnapshot:10000,fixedCapacitySnapshot:160,items:quote().items.concat([{service:'Outro',unit:'un',qty:10,owner:'cliente',labor:50}])});
 assert.ok(inspect(q).errors.some(e=>e.code==='partial-hours'));
});
test('Rateio fixo completo é contabilizado',()=>eq(calc(quote({costModel:'fixed_hourly_v1',fixedMonthlySnapshot:10000,fixedCapacitySnapshot:160})).overhead,30000));
test('Maior custo público aumenta sugestão sem alterar custo contábil',()=>{
 const item={...quote().items[0],referenceGlobalFloor:150,referenceGlobalCompared:true};
 const a=calc(quote({items:[item]})),b=calc(quote());
 assert.ok(a.suggested>b.suggested);eq(a.cost,b.cost);
});
test('Somente mão de obra não utiliza custo público global',()=>{
 const item={...quote().items[0],owner:'cliente',referenceGlobalFloor:150,referenceGlobalCompared:true};
 eq(calc(quote({type:'Mão de obra',items:[item]})).referencePremium,0);
});
test('Equipe dedicada é contabilizada antes de testar preço manual',()=>{
 const existing=win.CIVOLTENSchedule;
 win.CIVOLTENSchedule={calculate:()=>({missing:0,unknownCost:false,projectDays:10,days:20,reserve:20000})};
 try{
  const q=quote({priceMode:'manual',manualPrice:55000,schedule:{dedicated:true},scheduleExtraCost:0});
  s.wizard=q;
  const audit=inspect(q);
  assert.equal(q.scheduleExtraCost,20000);
  assert.ok(audit.errors.some(x=>x.code==='loss'));
 }finally{win.CIVOLTENSchedule=existing}
});
test('Maior referência protege proposta manual',()=>{
 const item={...quote().items[0],referenceGlobalFloor:160,referenceGlobalCompared:true};
 const q=quote({items:[item]}),manual=quote({items:[item],priceMode:'manual',manualPrice:calc(q).suggested-100});
 assert.ok(inspect(manual).errors.some(e=>e.code==='reference'));
});
test('Desconto automático abaixo da maior referência é bloqueado',()=>{
 const item={...quote().items[0],referenceGlobalFloor:160,referenceGlobalCompared:true};
 const discounted=quote({items:[item],discount:100});
 assert.ok(calc(discounted).margin>=20,'A margem pode continuar positiva apesar do desconto');
 assert.ok(inspect(discounted).errors.some(e=>e.code==='reference'));
});
test('Proposta salva com preço defasado não pode avançar sem revisão',()=>{
 const q=quote({id:'q-saved',status:'Enviado',price:calc(quote()).price-300});
 assert.ok(inspect(q).errors.some(e=>e.code==='saved-stale'));
});
test('Finalizar com erro é impedido, rascunho não',()=>{
 const begin=saves;s.wizard=quote({status:'Rascunho',items:[]});
 actions.click('draft',{});assert.equal(saves,begin+1);
 actions.click('finish',{});assert.equal(saves,begin+1);
 s.wizard=quote({status:'Rascunho'});actions.click('finish',{});
 assert.equal(saves,begin+2);assert.equal(s.wizard.auditFinancial.status,'passed');
});
test('Novo formulário mostra serviço e quantidade, com campos técnicos recolhidos',()=>{
 const js=read('quick-quote-item.js');
 assert.ok(js.includes('id="qi-qty"')&&js.includes('<details class="qi-details"')&&js.includes('Resumo'));
});
test('SINAPI sem custo pode ficar em rascunho mas auditoria bloqueia emissão',()=>{
 const js=read('quote-automation.js'),audit=read('financial-audit.js');
 assert.ok(js.includes("const pendingMaterial="),'Sem custo de insumo é marcado como pendente');
 assert.ok(js.includes("item.referencePending=!!svc.analyticalReviewNeeded"),'Composição analítica incompleta permanece pendente');
 assert.ok(audit.includes("code:'labor'"),'Mão de obra ausente bloqueia a proposta');
 assert.ok(audit.includes("code:'reference-pending'"),'Composição sem produtividade validada bloqueia a proposta');
});
test('Equipe mínima e custo desconhecido protegidos no cronograma',()=>{
 const js=read('workforce-schedule.js');
 assert.ok(js.includes('Math.max(1,r.baseCount,Math.ceil(')&&js.includes('x.rate<=0||x.unknownRate'));
});
test('Todos os scripts novos estão no HTML e cache',()=>{
 for(const file of ['financial-audit.js','quick-quote-item.js','workforce-schedule.js']){
  assert.ok(html.includes(file+'?v='),file+' ausente HTML');assert.ok(read('sw.js').includes("'"+'/'+file+"'"),file+' ausente SW');
 }
});
if(process.exitCode)process.exit(process.exitCode);
console.log('Auditoria regressiva concluída: testes aprovados.');
