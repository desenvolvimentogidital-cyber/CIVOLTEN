import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEntry,validDate,monthSummary,expenseCategories,flowMonths,reportCsv,entryStatus} from '../src/finance.mjs';
const income=(over={})=>({kind:'income',title:'Medição da obra',party:'Cliente',amount:1500,
 dueDate:'2026-11-11',paidDate:null,...over});
const expense=(over={})=>({kind:'expense',title:'Fornecedor',amount:350,
 dueDate:'2026-11-15',paidDate:null,...over});
test('validação de receita, vencimento, centavos e datas',()=>{
 const x=validateEntry({...income(),paidDate:'2026-11-07'});
 assert.equal(x.amount,1500);assert.equal(x.paidDate,'2026-11-07');
 assert.throws(()=>validateEntry(income({amount:-10})),/valor positivo/);
 assert.throws(()=>validateEntry(income({amount:1.001})),/casas decimais/);
 assert.throws(()=>validateEntry(income({dueDate:'2026-02-30'})),/vencimento/);
 assert.equal(validDate('2028-02-29'),true);
 assert.equal(validDate('2027-02-29'),false);
});
test('competência de vencimento separada do fluxo efetivo de pagamentos',()=>{
 const data={ledger:[
  income({amount:1500,paidDate:'2026-12-01'}),
  income({title:'Outro',amount:400,dueDate:'2026-11-20',paidDate:null}),
  expense({amount:300,paidDate:'2026-11-06',category:'Material'}),
  expense({amount:200,dueDate:'2026-10-27',paidDate:'2026-11-03',category:'Material'}),
  expense({amount:100,dueDate:'2026-11-25',paidDate:null})
 ],fixed:[],variable:[],employees:[]};
 const nov=monthSummary(data,'2026-11','2026-11-20');
 assert.equal(nov.billed,190000);
 assert.equal(nov.received,0,'recebimento em dezembro não pertence a novembro');
 assert.equal(nov.spent,50000,'pagamento de outubro é caixa de novembro');
 assert.equal(nov.openReceivable,40000);
 assert.equal(nov.openPayable,10000);
 assert.equal(nov.overdueReceivable,0);
 assert.equal(nov.balance,-50000);
 assert.equal(monthSummary(data,'2026-12').received,150000);
 assert.deepEqual(expenseCategories(data,'2026-11'),[{name:'Material',amount:50000}]);
 assert.equal(flowMonths(data,'2026-11',3).length,3);
 assert.equal(entryStatus(income({dueDate:'2026-10-01'}),'2026-11-07'),'late');
});
test('previsão de custos não vira despesa realizada automaticamente',()=>{
 const data={ledger:[],fixed:[{name:'Aluguel',amount:1000,frequency:'monthly'}],
  variable:[],employees:[]};
 const nov=monthSummary(data,'2026-11');
 assert.equal(nov.expectedCosts,100000);
 assert.equal(nov.spent,0);assert.equal(nov.balance,0);
 const csv=reportCsv(data,'2026-11');
 assert.match(csv,/Previsão/);assert.match(csv,/Aluguel/);
});
test('exportação CSV não executa fórmula inserida em descrição',()=>{
 const csv=reportCsv({ledger:[income({title:'=2+2'})],fixed:[],variable:[],employees:[]},'2026-11');
 assert.match(csv,/'=2\+2/);
});
