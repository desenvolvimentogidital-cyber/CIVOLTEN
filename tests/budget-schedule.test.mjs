import test from 'node:test';
import assert from 'node:assert/strict';
import {schedulePlan,validateSchedule,suggestExecutionTerm,scheduleCsv} from '../src/budget-schedule.mjs';
import {validateBudget,priceBudget,createService,createPricingSnapshot} from '../src/budget.mjs';
const capacity={productiveDays:20,hoursPerDay:8,productivePeople:2,monthlyCostCents:1600000};
const price={...capacity,productiveHours:320,taxPct:10,marginPct:20,companyName:'CIVOLTEN',capturedOn:'2026-11-08'};
const service=(id,quantity,hours,directCost=10)=>({...createService('DEMO-E01',id),quantity,laborHours:hours,directCost});
const raw=(items,schedule,pricing=price)=>({
 id:'11111111-1111-4111-8111-111111111111',title:'Orçamento com cronograma',
 customer:'Cliente',project:'Obra',location:'',expiresOn:'',
 items,commercial:{schedule},pricing
});
test('total de 320 horas em 20 dias úteis exige 2 profissionais de 8 horas/dia',()=>{
 const items=[service('a',20,8),service('b',20,8)];
 const plan=schedulePlan(items,{goal:'days',days:20,startDate:'2026-11-06'},capacity);
 assert.equal(plan.days,20);assert.equal(plan.crew,2);assert.equal(plan.requiredPeople,2);
 assert.equal(plan.totalHours,320);assert.equal(plan.available,true);
 assert.equal(plan.dailyCompanyCost,80000);
 assert.equal(plan.dayBasedCost,1600000);
 assert.equal(plan.rows[0].startDay,1);assert.equal(plan.rows[0].endDay,10);
 assert.equal(plan.rows[1].startDay,11);assert.equal(plan.rows[1].endDay,20);
 assert.equal(plan.startDate,'2026-11-06');
 assert.equal(plan.rows[1].startDate,'2026-11-20');
 assert.equal(plan.notes.includes('feriados'),true);
 assert.match(suggestExecutionTerm(plan),/20 dias úteis estimados/);
 const csv=scheduleCsv(plan);
 assert.match(csv,/Cronograma preliminar/);
 assert.match(csv,/Profissionais estimados/);
});
test('equipe de 2 profissionais projeta 20 dias para 320 horas, sem prazo informado',()=>{
 const plan=schedulePlan([service('a',40,8)],{goal:'crew',crew:2},capacity);
 assert.equal(plan.days,20);
 assert.equal(plan.crew,2);
 assert.equal(plan.startDate,null);
 assert.equal(plan.rows[0].startDay,1);
 assert.equal(plan.rows[0].endDay,20);
});
test('prazo apertado aponta equipe insuficiente e bloqueia preço por dias',()=>{
 const items=[service('a',40,8)];
 const schedule={goal:'days',days:10,pricingMode:'days',startDate:'2026-11-06'};
 const plan=schedulePlan(items,schedule,capacity);
 assert.equal(plan.crew,4);
 assert.equal(plan.extraPeople,2);
 assert.equal(plan.available,false);
 assert.throws(()=>priceBudget(validateBudget(raw(items,schedule))),/4 profissionais/);
});
test('preço por dias usa custo da empresa por dia mais materiais, sem duplicar folha',()=>{
 const items=[service('a',20,8,10),service('b',20,8,10)];
 const schedule={goal:'days',days:20,pricingMode:'days',startDate:'2026-11-06'};
 const draft=validateBudget(raw(items,schedule));
 const result=priceBudget(draft);
 assert.equal(result.pricingMode,'days');
 assert.equal(result.totalHours,320);
 assert.equal(result.totalMaterials,40000);
 assert.equal(result.totalLabor,1600000);
 assert.equal(result.totalCost,1640000);
 assert.equal(result.totalSale,Math.ceil(1640000/.7));
 assert.equal(result.totalCost+result.totalTax+result.profit,result.totalSale);
 assert.equal(result.rows.reduce((x,row)=>x+row.selling,0),result.totalSale);
 assert.equal(result.rows.reduce((x,row)=>x+row.cost,0),result.totalCost);
 assert.equal(result.rows.reduce((x,row)=>x+row.tax,0),result.totalTax);
 assert.equal(draft.commercial.schedule.days,20);
 assert.equal(priceBudget(draft).totalSale,result.totalSale,'Cálculo estável no rascunho salvo');
});
test('prazo maior eleva custo/dia; zero horas não produz preço irreal',()=>{
 const item=service('a',10,8);
 const a=priceBudget(validateBudget(raw([item],{goal:'days',days:5,pricingMode:'days'})));
 const b=priceBudget(validateBudget(raw([item],{goal:'days',days:10,pricingMode:'days'})));
 assert.ok(b.totalSale>a.totalSale);
 assert.throws(()=>priceBudget(validateBudget(raw([service('x',1,0)],{goal:'days',days:5,pricingMode:'days'}))),/horas de trabalho/);
});
test('opção tradicional permanece igual para snapshots legados',()=>{
 const item=service('a',2,2,30);
 const legacy={monthlyCostCents:1600000,productiveHours:320,taxPct:10,
  marginPct:20,companyName:'CIVOLTEN',capturedOn:'2026-11-07'};
 const draft=validateBudget(raw([item],{goal:'crew',pricingMode:'hours'},legacy));
 const result=priceBudget(draft);
 assert.equal(result.totalHours,4);
 assert.equal(result.totalCost,26000);
 assert.equal(result.totalSale,37143);
 assert.throws(()=>priceBudget({...draft,commercial:{schedule:{goal:'days',days:20,pricingMode:'days'}}}),/Atualize a base/);
});
test('cronograma valida entradas, feriados não são presumidos, CSV neutraliza fórmulas',()=>{
 assert.throws(()=>validateSchedule({days:-1}),/Prazo/);
 assert.throws(()=>validateSchedule({crew:1.5}),/profissionais/);
 assert.throws(()=>validateSchedule({startDate:'2026-02-31'}),/Data/);
 assert.throws(()=>schedulePlan([service('a',10,2)],{goal:'days'},capacity),/Informe o prazo/);
 const p=schedulePlan([{id:'bad',description:'=1+1',quantity:10,laborHours:1}],{goal:'crew',crew:2},capacity);
 assert.match(scheduleCsv(p),/'=1\+1/);
});
test('snapshot incorpora capacidade para precificação fixa sem reabrir configuração',()=>{
 const data={fixed:[{id:'f',amount:1000,frequency:'monthly'}],variable:[],employees:[],
  company:{companyName:'CIVOLTEN',taxRegime:'simples',annex:'IV',taxPct:10,
   marginPct:20,productiveDays:20,hoursPerDay:8,productivePeople:2,reviewed:true}};
 const snap=createPricingSnapshot(data);
 assert.equal(snap.productiveDays,20);
 assert.equal(snap.hoursPerDay,8);
 assert.equal(snap.productivePeople,2);
});

test('equipes de 2 profissionais recebem prazo real acima de 730 dias, sem erro',()=>{
 const items=[service('obra-longa',1462,8,0)]; // 11.696 HH / 16 HH por dia = 731 dias
 const plan=schedulePlan(items,{goal:'crew',crew:2,startDate:'2026-11-09'},capacity);
 assert.equal(plan.days,731);
 assert.equal(plan.crew,2);
 assert.equal(plan.daysWithCompany,731);
 assert.equal(plan.companyPeople,2);
 assert.equal(plan.crewForHalfTime,4);
 assert.equal(plan.halfDays,366);
 assert.equal(plan.crewForMonth,74);
 assert.equal(plan.rows[0].startDay,1);
 assert.equal(plan.rows[0].endDay,731);
 assert.ok(plan.endDate&&plan.endDate>plan.startDate);
 assert.match(suggestExecutionTerm(plan),/731 dias úteis estimados/);
 const csv=scheduleCsv(plan);
 assert.match(csv,/Dias úteis com a equipe atual/);
 assert.match(csv,/731/);
 const priced=priceBudget(validateBudget(raw(items,{goal:'crew',crew:2,pricingMode:'days',
  startDate:'2026-11-09'})));
 assert.equal(priced.schedule.days,731);
 assert.equal(priced.totalHours,11696);
});
test('prazos desejados maiores que dois anos também dimensionam profissionais',()=>{
 assert.equal(validateSchedule({goal:'days',days:900}).days,900);
 const plan=schedulePlan([service('obra-longa',1462,8,0)],
  {goal:'days',days:900,startDate:'2026-11-09'},capacity);
 assert.equal(plan.days,900);
 assert.equal(plan.crew,2);
 assert.equal(plan.available,true);
 assert.equal(plan.daysWithCompany,731);
});
test('cronogramas extremos calculam dias sem criar milhões de datas',()=>{
 const one={productiveDays:22,hoursPerDay:8,productivePeople:1,monthlyCostCents:100000};
 const items=[service('obra-gigante',100000,10000,0)];
 const plan=schedulePlan(items,{goal:'crew',crew:1,startDate:'2026-11-09'},one);
 assert.equal(plan.totalHours,1000000000);
 assert.equal(plan.days,125000000);
 assert.equal(plan.rows[0].endDay,125000000);
 assert.equal(plan.startDate,'2026-11-09');
 assert.equal(plan.endDate,null,'datas fora do calendário não invalidam o prazo');
 assert.match(scheduleCsv(plan),/125000000/);
});
