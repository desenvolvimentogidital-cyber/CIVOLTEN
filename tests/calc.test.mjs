import test from 'node:test';
import assert from 'node:assert/strict';
import {decimal,cents,fixedMonthly,variableMonthly,employeeCost,
 summary,validate,fresh,safeLoad,safeSave,brl} from '../src/calc.mjs';
test('real brasileiro é convertido sem transformar vazio em zero',()=>{
 assert.equal(decimal('1.250,99'),1250.99);
 assert.equal(cents('1.250,99'),125099);
 assert.equal(cents(''),null);
 assert.match(brl(120000),/1\.200,00/);
});
test('fixos mensais e anuais e variável sem quantidade',()=>{
 assert.equal(fixedMonthly({amount:1200,frequency:'monthly'}),120000);
 assert.equal(fixedMonthly({amount:1200,frequency:'annual'}),10000);
 assert.equal(variableMonthly({unitCost:20,monthQty:5}),10000);
 assert.equal(variableMonthly({unitCost:20,monthQty:null}),2000,'Preço informado, quantidade omitida: 1 unidade/mês');
 assert.equal(variableMonthly({unitCost:20,monthQty:0}),0,'Quantidade zero explícita permanece zero');
 assert.equal(variableMonthly({unitCost:0,monthQty:null}),null,'Modelo sem preço continua pendente');
});
test('CLT calcula automaticamente 13º, férias, FGTS, CPP e RAT usando cenário da empresa',()=>{
 const r=employeeCost({contractType:'clt',salary:3000,hours:160,
  benefits:300,extras:100});
 assert.equal(r.monthly,505834);
 assert.equal(r.hourly,3161);
 assert.equal(r.breakdown.salary,300000);
 assert.equal(r.breakdown.vacation,25000);
 assert.equal(r.breakdown.thirteenth,25000);
 assert.equal(r.breakdown.fgts,28667);
 assert.equal(r.breakdown.employer,71667);
 assert.equal(r.breakdown.rat,7167);
 assert.equal(r.breakdown.terceiros,0);
 assert.equal(r.estimated,true);
 assert.equal(employeeCost({contractType:'clt',salary:2800}).monthly,434778);
});
test('prestador mensal e horário',()=>{
 const monthly=employeeCost({contractType:'contractor',rate:4000,
  rateUnit:'month',hours:160});
 assert.equal(monthly.monthly,400000);assert.equal(monthly.hourly,2500);
 const daily=employeeCost({contractType:'contractor',rate:250,
  rateUnit:'day',hours:8,quantity:20});
 assert.equal(daily.monthly,500000);assert.equal(daily.hourly,3125);
});
test('resumo distingue item pendente de custo real confirmado',()=>{
 const d=fresh();
 d.fixed.push({amount:1200,frequency:'monthly'});
 d.variable.push({unitCost:20,monthQty:10},{unitCost:30,monthQty:null});
 d.employees.push({name:'Pedreiro',contractType:'clt',salary:3000,hours:160,fgtsPct:8,employerPct:20});
 const r=summary(d);
 assert.equal(r.fixed,120000);assert.equal(r.variable,23000);
 assert.equal(r.team,465834);assert.equal(r.total,608834);
 assert.equal(r.missing,0);assert.equal(r.assumedQuantities,1);assert.equal(r.complete,true);
});
test('cada conta usa chave independente; nunca toca na base antiga',()=>{
 const mem=new Map([['civolten_daily_v2','{"quotes":[{"id":"q-antigo"}]}']]);
 const storage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v)};
 const d=fresh();d.fixed.push({name:'Aluguel',amount:1000,frequency:'monthly'});
 safeSave(storage,'user-a',d);
 assert.equal(safeLoad(storage,'user-a').fixed.length,1);
 assert.equal(safeLoad(storage,'user-b').fixed.length,0);
 assert.match(mem.get('civolten_daily_v2'),/q-antigo/);
});
test('validação de dados não aceita horas, salário ou percentuais negativos',()=>{
 assert.throws(()=>validate('fixed',{name:'',amount:300}),/descrição/);
 assert.throws(()=>validate('fixed',{name:'Aluguel',amount:-1}),/válido/);
 assert.throws(()=>validate('employees',{name:'João',role:'Pedreiro',contractType:'clt',
 salary:3000,hours:-8}),/maiores que zero/);
 assert.equal(validate('variable',{name:'Gás',unitCost:75,monthQty:''}).monthQty,1);
 assert.equal(validate('variable',{name:'Gás',unitCost:75,monthQty:0}).monthQty,0);
 assert.equal(validate('variable',{name:'Gás',unitCost:0,monthQty:''}).monthQty,null);
});
