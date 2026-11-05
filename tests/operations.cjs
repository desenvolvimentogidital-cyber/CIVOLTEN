'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {summary,validEntry}=require('../operations-core.js');
const q={status:'Aprovado',price:100000,cost:80000,tax:8,fees:2,
 execution:{percent:50,entries:[{id:'c1',type:'cost',amount:50000},{id:'r1',type:'receipt',amount:60000}]}};
test('custos reais, recebimentos, saldo e tributos não se confundem',()=>{
 const r=summary(q);
 assert.equal(r.spent,50000);assert.equal(r.received,60000);assert.equal(r.cashBalance,10000);
 assert.equal(r.netContract,90000);
});
test('projeção não inventa dados sem avanço e sem custos',()=>{
 const r=summary({...q,execution:{percent:0,entries:[]}});
 assert.equal(r.projectedCost,null);assert.equal(r.projectedResult,null);assert.equal(r.cashBalance,0);
});
test('desvio de custo gera projeção de prejuízo e alerta',()=>{
 const r=summary({...q,execution:{percent:50,entries:[{id:'c1',type:'cost',amount:60000}]}});
 assert.equal(r.projectedCost,120000);assert.equal(r.projectedResult,-30000);
 assert.ok(r.alerts.some(a=>a.code==='projected-loss'));assert.ok(r.alerts.some(a=>a.code==='spend-ahead'));
});
test('projeção em 100% mostra custos lançados sem extrapolação',()=>{
 const r=summary({...q,execution:{percent:100,entries:[{type:'cost',amount:75000}]}});
 assert.equal(r.projectedCost,75000);assert.equal(r.projectedResult,15000);
});
test('estorno não apaga o histórico nem duplica o custo',()=>{
 const r=summary({...q,execution:{percent:50,entries:[{id:'x',type:'cost',amount:20000},{id:'y',reverses:'x',type:'cost',amount:-20000}]}});
 assert.equal(r.spent,0);assert.equal(r.entryCount,2);
});
test('validação exige data existente, descrição e valor positivo',()=>{
 const base={type:'cost',amount:120.22,description:'Compra de material',date:'2026-11-05'};
 assert.equal(validEntry(base),true);
 for(const item of [{...base,amount:-1},{...base,amount:0},{...base,date:'2026-02-31'},{...base,description:''},{...base,amount:Infinity}])
  assert.equal(validEntry(item),false);
});
test('lançamentos operacionais antes da aprovação geram alerta',()=>{
 const r=summary({...q,status:'Rascunho'});
 assert.ok(r.alerts.some(a=>a.code==='unapproved-operations'));
});
test('número acima da previsão causa alerta de custo total',()=>{
 const r=summary({...q,execution:{percent:100,entries:[{type:'cost',amount:90000}]}});
 assert.ok(r.alerts.some(a=>a.code==='cost-overrun'));
});
