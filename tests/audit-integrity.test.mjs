import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,summary,employeeCost} from '../src/calc.mjs';
import {DEFAULT_COMPANY,quoteForHours,quoteFromCost} from '../src/pricing.mjs';
import {createPricingSnapshot,budgetQuantityEstimate,priceBudget,budgetCsv} from '../src/budget.mjs';
import {budgetEditorView} from '../src/budget-ui.mjs';
import {pricingPreview} from '../src/settings-ui.mjs';
import {schedulePlan} from '../src/budget-schedule.mjs';
import {monthSummary} from '../src/finance.mjs';
import {createE2EClient} from '../src/e2e-client.mjs';
import {fetchRemote} from '../src/cloud.mjs';

const userid='00000000-0000-4000-8000-000000000001';
const snapshot={monthlyCostCents:2115335,productiveHours:352,productiveDays:22,
 hoursPerDay:8,productivePeople:2,taxPct:6,marginPct:30,companyName:'CIVOLTEN',capturedOn:'2026-11-08'};
const item=(i,q,h,materials)=>({id:'i'+i,source:'manual',description:'Servico '+i,
 unit:'M2',quantity:q,laborHours:h,directCost:materials});
const draft=(items,pricing=snapshot,pricingMode='hours')=>({id:'bud-1',title:'Orcamento comercial',
 customer:'Cliente',demo:false,pricing,items,commercial:{
 schedule:{goal:'crew',crew:2,pricingMode,startDate:'2026-11-09'}}});

test('auditoria financeira: 100 combinacoes de HH, quantidade, custos, tributo e lucro convergem',()=>{
 for(let i=1;i<=100;i++){
  const q=(i*17)%650+1,h=((i*37)%197+1)/100,
   extra=((i*31)%450)/100,tax=(i*7)%20,margin=(i*11)%40;
  const pricing={...snapshot,taxPct:tax,marginPct:margin};
  const estimate=budgetQuantityEstimate(pricing,h,q,extra);
  const result=priceBudget(draft([item(i,q,h,extra)],pricing));
  const independentHours=h*q;
  const independentLabor=Math.ceil(pricing.monthlyCostCents*independentHours/pricing.productiveHours);
  const independentMaterials=Math.round(Math.round(extra*100)*q);
  const independentCost=independentLabor+independentMaterials;
  const remainingBps=10000-(tax+margin)*100;
  const independentSale=Number(
   (BigInt(independentCost)*10000n+BigInt(remainingBps)-1n)/BigInt(remainingBps));
  assert.equal(estimate.totalHours,Math.round(independentHours*1e6)/1e6,'HH no caso '+i);
  assert.equal(estimate.labor,independentLabor,'custo da HH no caso '+i);
  assert.equal(estimate.materials,independentMaterials,'custo adicional no caso '+i);
  assert.equal(estimate.selling,independentSale,'venda no caso '+i);
  assert.equal(result.totalSale,independentSale,'cálculo principal e modal no caso '+i);
  assert.equal(result.totalCost,independentCost);
  assert.equal(result.totalCost+result.totalTax+result.profit,result.totalSale);
 }
});
test('orcamento por dias aplica horas ao cronograma e nao mistura preco unitario da modal',()=>{
 const items=[item(1,150,1.78,0),item(2,20,2,60)];
 const plan=schedulePlan(items,{goal:'crew',crew:2,startDate:'2026-11-09'},snapshot);
 const priced=priceBudget(draft(items,snapshot,'days'));
 const expectedHours=307;
 assert.equal(plan.totalHours,expectedHours);
 assert.equal(priced.totalHours,expectedHours);
 assert.equal(priced.schedule.days,Math.ceil(expectedHours/16));
 const expectedMaterials=Math.round(60*100*20);
 const labor=Math.ceil(snapshot.monthlyCostCents*priced.schedule.days/22);
 assert.equal(priced.totalCost,labor+expectedMaterials);
 assert.equal(priced.totalSale,Math.ceil((labor+expectedMaterials)/.64));
 assert.equal(priced.rows.reduce((a,r)=>a+r.cost,0),priced.totalCost);
 assert.equal(priced.rows.reduce((a,r)=>a+r.selling,0),priced.totalSale);
 assert.equal(priced.rows.reduce((a,r)=>a+r.hours,0),priced.totalHours);
 assert.equal(priced.totalCost+priced.totalTax+priced.profit,priced.totalSale);
});
test('custo mensal agrega fixos, variaveis e folha ativa sem tratar folha como material',()=>{
 const data=fresh();
 data.company={...DEFAULT_COMPANY,companyName:'CIVOLTEN',taxPct:6,marginPct:30,
  productivePeople:2,reviewed:true};
 data.fixed=[{name:'Aluguel',amount:2200,frequency:'monthly'},
  {name:'Seguro',amount:1200,frequency:'annual'}];
 data.variable=[{name:'Gasolina',unitCost:10,monthQty:80}];
 data.employees=[{name:'Pessoa A',active:true,contractType:'clt',salary:3000},
  {name:'Pessoa B',active:true,contractType:'clt',salary:2800},
  {name:'Pessoa desligada',active:false,contractType:'clt',salary:9000}];
 const s=summary(data);
 assert.equal(s.fixed,230000);
 assert.equal(s.variable,80000);
 assert.equal(s.team,employeeCost(data.employees[0],data.payroll).monthly+
  employeeCost(data.employees[1],data.payroll).monthly);
 assert.equal(s.employees,2);
 assert.equal(s.total,s.fixed+s.variable+s.team);
 const p=createPricingSnapshot(data);
 assert.equal(p.productiveHours,352);
 assert.equal(p.monthlyCostCents,s.total);
});
test('folha nao revisada aparece como ponto de verificacao antes de enviar uma proposta',()=>{
 const data=fresh();
 data.company={...DEFAULT_COMPANY,companyName:'CIVOLTEN',taxPct:6,marginPct:30,
  productivePeople:2,reviewed:true};
 data.fixed=[{name:'Aluguel',amount:1000,frequency:'monthly'}];
 data.employees=[{active:true,contractType:'clt',salary:3000}];
 const pricing=createPricingSnapshot(data);
 const html=budgetEditorView(data,draft([item(1,150,1.78,0)],pricing));
 assert.match(html,/Conferência da folha CLT pendente/);
 assert.match(html,/Encargos CLT da empresa/);
 data.payroll={...data.payroll,reviewed:true};
 assert.doesNotMatch(budgetEditorView(data,draft([item(1,150,1.78,0)],pricing)),
  /Conferência da folha CLT pendente/);
});
test('caixa realizado permanece distinto do custo mensal previsional e da emissao do orcamento',()=>{
 const data=fresh();data.fixed=[{name:'Aluguel',amount:1500,frequency:'monthly'}];
 data.ledger=[{kind:'income',title:'Adiantamento',amount:1000,dueDate:'2026-11-10',
  paidDate:'2026-11-11'},{kind:'expense',title:'Pagamento',amount:200,dueDate:'2026-11-12',
  paidDate:'2026-11-14'}];
 data.budgets=[draft([item(1,150,1.78,0)])];
 const cash=monthSummary(data,'2026-11','2026-11-20');
 assert.equal(cash.received,100000);
 assert.equal(cash.spent,20000);
 assert.equal(cash.balance,80000);
 assert.equal(cash.expectedCosts,150000);
 assert.equal(cash.billed,100000,'orcamento nao vira automaticamente fatura');
});
test('sincronizacao inclui mais de mil linhas em cada tabela, sem perda silenciosa',async()=>{
 const storage=new Map(),db={};
 const uid=userid;
 const id=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
 const created='2026-11-08T12:00:00+00:00';
 db.cv_fixed_costs_v1=Array.from({length:1205},(_,i)=>({
  id:id(i+1),user_id:uid,name:'Despesa '+i,category:'Geral',
  amount:100,frequency:'monthly',created_at:created
 }));
 db.cv_variable_costs_v1=Array.from({length:1108},(_,i)=>({
  id:id(i+2000),user_id:uid,name:'Suprimento '+i,category:'Geral',
  unit:'un',unit_cost:1,month_qty:1,created_at:created
 }));
 db.cv_service_catalog_v1=Array.from({length:2617},(_,i)=>({
  id:id(i+5000),user_id:uid,code:'SIURB:'+String(i+10000),source:'siurb',
  category:'EDIF',description:'Servico '+i,unit:'M2',
  roles:i<191?[]:[{role:'Pedreiro',hours:1.78}],direct_cost:null,
  sinapi_code:String(i+10000),reference_month:'2026-07',created_at:created
 }));
 db.cv_financial_entries_v1=Array.from({length:1203},(_,i)=>({
  id:id(i+10000),user_id:uid,kind:'income',title:'Fatura '+i,party:'',
  amount:5,category:'Serviço',project:'',
  due_date:'2026-11-10',paid_date:null,reference:'',notes:'',created_at:created
 }));
 storage.set('cv_e2e_supabase_v1',JSON.stringify(db));
 globalThis.localStorage={getItem:k=>storage.get(k)||null,
  setItem:(k,v)=>storage.set(k,v)};
 const client=createE2EClient();
 await client.auth.signInWithPassword({email:'auditoria@example.com',password:'senha'});
 const loaded=await fetchRemote(client,userid);
 assert.equal(loaded.fixed.length,1205);
 assert.equal(loaded.variable.length,1108);
 assert.equal(loaded.catalog.length,2617);
 assert.equal(loaded.ledger.length,1203);
 for(const kind of ['fixed','variable','catalog','ledger']){
  const ids=loaded[kind].map(x=>x.id);
  assert.equal(new Set(ids).size,ids.length,'IDs repetidos em '+kind);
 }
 assert.equal(loaded.catalog.filter(x=>x.roles.length===0).length,191);
 assert.equal(loaded.fixed.at(-1).name,'Despesa 1204');
 assert.equal(loaded.ledger.at(-1).title,'Fatura 1202');
});

test('simulador por hora é idêntico ao motor da proposta no centavo',()=>{
 const data=fresh();
 data.company={...DEFAULT_COMPANY,companyName:'CIVOLTEN',taxPct:6,marginPct:30,
  productivePeople:2,reviewed:true};
 data.fixed=[{name:'Custo pequeno para testar centavos',amount:1.01,frequency:'monthly'}];
 const correct=quoteForHours(101,data.company,1,0);
 assert.equal(correct.selling,2,'Mão de obra arredondada para 1 centavo, venda com tributos');
 assert.equal(quoteFromCost(1,data.company).selling,2);
 const preview=pricingPreview(data,1,0).replace(/\s/g,' ');
 assert.match(preview,/Venda sugerida \/ hora<\/span><strong>R\$ 0,02/);
 const draftPrice=budgetQuantityEstimate(createPricingSnapshot(data),1,1,0);
 assert.equal(draftPrice.selling,correct.selling);
});
