import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SERVICES,createService,validateBudget,validateCommercial,priceBudget,createPricingSnapshot,budgetUnitEstimate,validateBudgetItem,budgetCsv} from '../src/budget.mjs';
const company={companyName:'Construtora Teste',taxRegime:'simples',annex:'IV',taxPct:10,marginPct:20,
 productiveDays:20,hoursPerDay:8,productivePeople:2,reviewed:true};
const priced={monthlyCostCents:1600000,productiveHours:320,
 taxPct:10,marginPct:20,companyName:'Construtora Teste',capturedOn:'2026-11-07'};
const raw=(override={})=>({id:'11111111-1111-4111-8111-111111111111',
 title:'Proposta de teste',customer:'Cliente A',project:'Obra A',location:'São Paulo',
 notes:'Demonstração',expiresOn:'2026-12-20',items:[createService('DEMO-E01','i1')],pricing:priced,...override});
test('catálogo é inteiramente fictício e pode ser editado sem alterar a fonte',()=>{
 assert.equal(DEMO_SERVICES.length,8);
 assert.ok(DEMO_SERVICES.every(s=>s.code.startsWith('DEMO-')));
 const item=createService('DEMO-E01','i1');item.description='Outro texto';
 assert.notEqual(DEMO_SERVICES[0].description,item.description);
});
test('fórmula usa custo total/hora + custo direto; tributo e lucro sobre preço final',()=>{
 const b=validateBudget(raw({items:[{...createService('DEMO-E01','i1'),quantity:2,laborHours:2,
 directCost:30}]}));
 const p=priceBudget(b);
 assert.equal(p.totalHours,4);
 assert.equal(p.rows[0].labor,20000);
 assert.equal(p.rows[0].materials,6000);
 assert.equal(p.totalCost,26000);
 assert.equal(p.totalSale,37143);
 assert.equal(p.totalCost+p.totalTax+p.profit,p.totalSale);
});
test('dois itens com quantidades diferentes compõem total sem perdas',()=>{
 const items=[createService('DEMO-E02','i2'),createService('DEMO-C02','i3')];
 const p=priceBudget(validateBudget(raw({items})));
 assert.equal(p.rows.length,2);
 assert.equal(p.totalSale,p.rows[0].selling+p.rows[1].selling);
 assert.equal(p.totalCost,p.rows[0].cost+p.rows[1].cost);
});
test('snapshot antigo permanece imutável após mudança de custo/empresa',()=>{
 const budget=validateBudget(raw());
 const value=priceBudget(budget).totalSale;
 const data={fixed:[{name:'aluguel',amount:1000,frequency:'monthly'}],variable:[],employees:[],
  company:{...company,taxPct:17,marginPct:25}};
 const newer=createPricingSnapshot(data);
 assert.equal(newer.monthlyCostCents,100000);
 assert.notEqual(newer.taxPct,budget.pricing.taxPct);
 assert.equal(priceBudget(budget).totalSale,value);
});
test('sem configuração ou valores completos pode salvar rascunho sem preço',()=>{
 const item=createService('manual','i3');
 const b=validateBudget(raw({pricing:null,items:[item]}));
 assert.equal(priceBudget(b),null);
 assert.equal(createPricingSnapshot({fixed:[],variable:[],employees:[],company:{reviewed:false}}),null);
});
test('invalida quantidades, horas, datas, duplicatas, limites e nomes',()=>{
 const base=createService('DEMO-C01','i1');
 assert.throws(()=>validateBudget(raw({items:[]})),/ao menos um/);
 assert.throws(()=>validateBudget(raw({items:[{...base,quantity:0}]})),/quantidade/);
 assert.throws(()=>validateBudget(raw({items:[{...base,directCost:-1}]})),/Custo direto/);
 assert.throws(()=>validateBudget(raw({items:[{...base,laborHours:-1}]})),/horas/);
 assert.throws(()=>validateBudget(raw({items:[base,base]})),/duplicados/);
 assert.throws(()=>validateBudget(raw({expiresOn:'2026-02-31'})),/validade/);
 assert.throws(()=>validateBudget(raw({customer:''})),/cliente/);
});
test('exportação CSV protege campos inseridos pelo usuário contra fórmulas',()=>{
 const b=validateBudget(raw({demo:false,title:'=2+2',items:[{...createService('manual','i1'),
  description:'@cmd',unit:'un',laborHours:2,directCost:35}]}));
 const csv=budgetCsv(b);assert.match(csv,/'=2\+2/);assert.match(csv,/'@cmd/);
});

test('condições comerciais opcionais validadas, sem presumir prazo ou garantia',()=>{
 const input=raw({commercial:{paymentTerms:'30% na entrada e 70% na conclusão',
  executionTerm:'Até 18 dias',warrantyTerms:'Conforme contrato',scopeNotes:'Sem fornecimento de luminárias'}});
 const parsed=validateBudget(input);
 assert.equal(parsed.commercial.paymentTerms,'30% na entrada e 70% na conclusão');
 assert.equal(parsed.commercial.executionTerm,'Até 18 dias');
 assert.equal(validateBudget(raw()).commercial.warrantyTerms,'');
 assert.throws(()=>validateCommercial({paymentTerms:'x'.repeat(501)}),/muito longo/);
});

test('CSV comercial exige regularizacao de orcamentos anteriores',()=>{
 assert.throws(()=>budgetCsv(validateBudget(raw())),/Revise os servicos/);
});

test('CIVOLTEN divide custo mensal em 22 dias 8 horas e 2 profissionais e precifica cada HH',()=>{
 const monthly=35200;
 const data={fixed:[{name:'Modelo pendente',amount:null,frequency:'monthly'},
  {name:'Despesa real',amount:monthly,frequency:'monthly'}],
  variable:[],employees:[],company:{
    companyName:'CIVOLTEN',reviewed:true,productiveDays:22,hoursPerDay:8,
    productivePeople:2,taxPct:6,marginPct:30
  }};
 const snap=createPricingSnapshot(data);
 assert.ok(snap,'modelos vazios nao devem impedir precificacao real');
 assert.equal(snap.productiveHours,22*8*2);
 assert.equal(snap.monthlyCostCents,monthly*100);
 const est=budgetUnitEstimate(snap,4,'');
 assert.equal(est.hourly,10000);
 assert.equal(est.labor,40000,'4 horas a R$ 100/HH = R$ 400');
 assert.equal(est.materials,0);
 assert.equal(est.selling,62500,'Imposto 6% e margem 30% sobre venda: R$ 625/un');
 const item=validateBudgetItem({id:'serv-1',source:'manual',description:'Demolicao',
  unit:'m3',quantity:150,laborHours:4,directCost:''});
 assert.equal(item.directCost,0,'adicionais em branco valem zero');
 const quote=priceBudget({demo:false,pricing:snap,items:[item],commercial:{}});
 assert.equal(quote.totalHours,600);
 assert.equal(quote.totalCost,6000000);
 assert.equal(quote.totalSale,9375000);
});
test('custos de funcionarios realmente incompletos nao sao assumidos como zero',()=>{
 const data={fixed:[{name:'Aluguel',amount:1000,frequency:'monthly'}],variable:[],
  employees:[{active:true,contractType:'clt',salary:null}],company:{...company}};
 assert.equal(createPricingSnapshot(data),null);
});
