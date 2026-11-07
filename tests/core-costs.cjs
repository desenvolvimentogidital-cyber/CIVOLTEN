'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core/cost-engine.js');
const employee={id:'w1',name:'Pedreiro',type:'clt',salary:3000,
 productiveHours:160,fgtsPct:8,employerPct:20,benefits:300,extras:100};
test('custos fixos mensais e anuais são normalizados sem arredondamento enganoso',()=>{
 assert.equal(C.fixedCost({amount:1200,frequency:'month'}).monthly,120000);
 assert.equal(C.fixedCost({amount:1200,frequency:'year'}).monthly,10000);
 assert.equal(C.fixedCost({amount:null}).monthly,null);
 assert.equal(C.fixedCost({amount:0,frequency:'month'}).monthly,0);
});
test('custos variáveis sem quantidade têm valor unitário mas NÃO previsão mensal falsa',()=>{
 const a=C.variableCost({rate:23.4,unit:'km',monthlyQty:null});
 assert.equal(a.rate,2340);assert.equal(a.monthly,null);assert.equal(a.status,'no-forecast');
 const b=C.variableCost({rate:23.4,unit:'km',monthlyQty:10.5});
 assert.equal(b.monthly,24570);
});
test('custo CLT provisiona 13º, adicional de férias e encargos informados',()=>{
 const r=C.employeeCost(employee);
 assert.equal(r.parts.salary,300000);
 assert.equal(r.parts.thirteenth,25000);
 assert.equal(r.parts.vacationThird,8333);
 assert.equal(r.parts.fgts,26667);
 assert.equal(r.parts.employer,66667);
 assert.equal(r.monthly,466667);
 assert.equal(r.hourly,2917);
 assert.equal(r.status,'ready');
});
test('não inventar encargos patronais nem horas quando ausentes',()=>{
 const r=C.employeeCost({...employee,productiveHours:null,employerPct:null});
 assert.equal(r.status,'partial');
 assert.equal(r.hourly,null);
 assert.equal(r.parts.employer,null);
 assert.ok(r.missing.includes('encargos patronais'));
});
test('prestador por dia não ganha jornada presumida sem horas informadas',()=>{
 const a=C.employeeCost({type:'contractor',rate:180,rateUnit:'day',monthlyQty:20,hoursDay:null});
 assert.equal(a.monthly,360000);assert.equal(a.hourly,null);
 assert.equal(a.status,'partial');
 const b=C.employeeCost({type:'contractor',rate:180,rateUnit:'day',monthlyQty:20,hoursDay:6});
 assert.equal(b.hourly,3000);assert.equal(b.status,'ready');
});
test('painel mensal soma somente valores estimados, indica pendências sem ocultar',()=>{
 const d=C.defaultData();
 d.fixed=[{id:'f1',name:'Aluguel',amount:1200,frequency:'month'}];
 d.variable=[{id:'v1',name:'Gasolina',rate:10,monthlyQty:50},
   {id:'v2',name:'Serviço extra',rate:100,monthlyQty:null}];
 d.employees=[employee];
 const r=C.overview(d);
 assert.equal(r.fixedMonthly,120000);assert.equal(r.variableMonthly,50000);
 assert.equal(r.employeeMonthly,466667);assert.equal(r.forecastMonthly,636667);
 assert.equal(r.variableMissing,1);assert.equal(r.completeness,false);
 d.settings.productiveHoursMonth=200;
 assert.equal(C.overview(d).fixedHour,600);
});
test('aceita vírgula brasileira e não converte vazio em zero',()=>{
 assert.equal(C.amount('1.234,56'),1234.56);
 assert.equal(C.amount(''),null);
 assert.equal(C.cents('0'),0);
});
test('os dados antigos não são acessados, substituídos nem apagados ao salvar',()=>{
 const map=new Map([['civolten_daily_v2','{"quotes":[{"id":"importante"}]}']]);
 const mem={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 const store=C.createStore(mem);
 let s=store.load();s.fixed.push({id:'f',name:'Aluguel',amount:1200,frequency:'month'});
 s=store.commit(s);
 assert.equal(s.fixed.length,1);
 assert.equal(JSON.parse(map.get('civolten_daily_v2')).quotes[0].id,'importante');
 assert.equal(JSON.parse(map.get(C.STORAGE_KEY)).fixed[0].name,'Aluguel');
});
test('cadastro exige apenas dados básicos, não impede casos parciais',()=>{
 const row=C.itemInput('employees',{name:'Pedreiro',type:'clt',salary:'3200',productiveHours:'',
  fgtsPct:'',employerPct:''},'w2');
 assert.equal(row.salary,3200);assert.equal(C.employeeCost(row).status,'partial');
 assert.throws(()=>C.itemInput('fixed',{name:'',amount:'100'},'f'),/descrição/);
 assert.throws(()=>C.itemInput('employees',{name:'A',salary:'',type:'clt'},'w'),/salário/);
 assert.throws(()=>C.itemInput('employees',{name:'A',salary:'2000',benefits:'-500',type:'clt'},'w'),/negativos/);
 assert.throws(()=>C.itemInput('employees',{name:'A',rate:'0',type:'contractor'},'w'),/maior que zero/);
});
