'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspect,overview}=require('../automation-risk-core.js');
const company={profit:20,validity:15};
const base={id:'q1',number:'ORC-2026-0001',status:'Enviado',date:'2026-10-01',validity:15,
 clientName:'Cliente teste',paymentTerms:'10 dias',deadline:'20 dias úteis',price:10000,cost:6000,
 margin:30,items:[{service:'Serviço'}],auditFinancial:{date:'2026-10-01'}};
test('alerta validade encerrada em proposta enviada',()=>{
 assert.ok(inspect(base,{company,today:'2026-11-05'}).some(x=>x.code==='expired'));
});
test('não marca proposta ainda válida',()=>{
 assert.ok(!inspect({...base,date:'2026-11-01'},{company,today:'2026-11-05'}).some(x=>x.code==='expired'));
});
test('preço abaixo do custo gera bloqueio crítico',()=>{
 const r=inspect({...base,price:5000},{company,today:'2026-11-05'});
 assert.ok(r.some(x=>x.code==='direct-loss'&&x.level==='critical'));
});
test('falta de prazo e pagamento requer revisão',()=>{
 const r=inspect({...base,paymentTerms:'',deadline:''},{company,today:'2026-11-05'});
 assert.ok(r.some(x=>x.code==='payment-terms'));assert.ok(r.some(x=>x.code==='deadline'));
});
test('traz erros da auditoria e alertas de execução sem duplicar',()=>{
 const r=inspect(base,{company,today:'2026-11-05',financial:{errors:[{code:'loss',message:'Custo descoberto'}]},
  operations:{alerts:[{code:'cost-overrun',level:'critical',message:'Estourou custo'}]}});
 assert.ok(r.some(x=>x.code==='financial-loss'));assert.ok(r.some(x=>x.code==='operation-cost-overrun'));
});
test('aprovado sem trilha de auditoria tem aviso',()=>{
 const r=inspect({...base,status:'Aprovado',auditFinancial:null},{company,today:'2026-11-05'});
 assert.ok(r.some(x=>x.code==='no-audit-record'));
});
test('dashboard prioriza riscos críticos',()=>{
 const r=overview([{...base,id:'warn'}, {...base,id:'critical',price:500}],{company,today:'2026-11-05'});
 assert.equal(r[0].quote.id,'critical');
});
test('rascunho vazio não inventa erro de aprovação',()=>{
 const r=inspect({status:'Rascunho',items:[]},{company});
 assert.ok(r.some(x=>x.code==='draft-empty'));assert.ok(!r.some(x=>x.code==='no-price'));
});
