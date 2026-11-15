import test from 'node:test';
import assert from 'node:assert/strict';
import {payrollPreset,payrollConfig,validatePayroll,cltFromCents} from '../src/payroll.mjs';
import {employeeCost,summary,fresh,validate} from '../src/calc.mjs';
import {createE2EClient} from '../src/e2e-client.mjs';
import {fetchRemote,putPayrollRemote} from '../src/cloud.mjs';
import {payrollConsistencyWarning} from '../src/settings-ui.mjs';
test('salário CLT R$ 2.800 calcula provisões, FGTS, CPP e RAT sem digitar percentuais',()=>{
 const cost=employeeCost({contractType:'clt',salary:2800});
 assert.equal(cost.monthly,434778);
 assert.equal(cost.hourly,null);
 assert.equal(cost.status,'ready');
 const b=cost.breakdown;
 assert.deepEqual([b.salary,b.thirteenth,b.vacation,b.vacationThird],
  [280000,23333,23333,7778]);
 assert.deepEqual([b.fgts,b.employer,b.rat,b.terceiros],
  [26756,66889,6689,0]);
 assert.equal(b.subtotal,cost.monthly);
 assert.equal(cost.estimated,true);
 assert.equal(cost.settingsReviewed,false);
});
test('Simples outros anexos não duplica CPP recolhida no DAS',()=>{
 const cost=employeeCost({contractType:'clt',salary:2800},payrollPreset('simples_other'));
 assert.equal(cost.monthly,361200);
 assert.equal(cost.breakdown.employer,0);
 assert.equal(cost.breakdown.rat,0);
 assert.equal(cost.breakdown.terceiros,0);
});
test('regime geral inclui outras entidades; todas as alíquotas são ajustáveis',()=>{
 const p=validatePayroll({regime:'general',fgtsPct:'8',employerPct:'20',
  ratPct:'1,5',terceirosPct:'5,8'});
 assert.equal(p.reviewed,true);
 const cost=employeeCost({contractType:'clt',salary:2800},p);
 assert.equal(cost.breakdown.rat,5017);
 assert.equal(cost.breakdown.terceiros,19398);
 assert.equal(cost.monthly,452504);
});
test('benefícios não são taxados novamente por padrão e horas são opcionais',()=>{
 const cost=employeeCost({contractType:'clt',salary:2800,benefits:400,extras:150},payrollPreset('annex_iv'));
 assert.equal(cost.monthly,489778);
 assert.equal(cost.hourly,null);
 assert.equal(employeeCost({contractType:'clt',salary:2800,hours:160}).hourly,2717);
});
test('funcionário antigo com encargos por pessoa utiliza regras novas sem perder salário',()=>{
 const p={contractType:'clt',salary:2800,fgtsPct:12,employerPct:31,role:'Eletricista'};
 assert.equal(employeeCost(p).monthly,434778);
 assert.equal(employeeCost(p,payrollPreset('simples_other')).monthly,361200);
 const d=fresh();d.employees=[p];
 assert.equal(summary(d).team,434778);
 d.payroll=payrollPreset('simples_other');
 assert.equal(summary(d).team,361200);
});
test('validar configurações impede taxas fora de faixa',()=>{
 assert.throws(()=>validatePayroll({regime:'annex_iv',fgtsPct:'8',employerPct:'20',
  ratPct:'-1',terceirosPct:'0'}),/0% e 100%/);
 assert.throws(()=>validatePayroll({regime:'annex_iv',fgtsPct:'',employerPct:'20',
  ratPct:'2',terceirosPct:'0'}),/Informe/);
 assert.equal(payrollConfig(null).reviewed,false);
 assert.deepEqual(payrollPreset('annex_iv'),payrollConfig({regime:'annex_iv'}).reviewed?null:payrollPreset('annex_iv'));
});
test('configurações CLT são salvas separadamente por conta no Supabase',async()=>{
 const m=new Map(),storage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};
 globalThis.localStorage=storage;
 const client=createE2EClient();
 const {data}=await client.auth.signInWithPassword({email:'teste@example.com',password:'teste'});
 const userId=data.user.id;
 const before=await fetchRemote(client,userId);
 assert.equal(before.payroll.regime,'annex_iv');
 assert.equal(before.payroll.reviewed,false);
 const rates=validatePayroll({regime:'simples_other',fgtsPct:'8',employerPct:'0',
  ratPct:'0',terceirosPct:'0'});
 await putPayrollRemote(client,userId,rates);
 const after=await fetchRemote(client,userId);
 assert.equal(after.payroll.regime,'simples_other');
 assert.equal(after.payroll.reviewed,true);
 assert.equal(after.fixed.length,0);
});

test('avisa divergência entre anexo da empresa e cenário de encargos sem alterar alíquotas',()=>{
 assert.match(payrollConsistencyWarning({taxRegime:'simples',annex:'III'},{regime:'annex_iv'}),/Anexo III.*Anexo IV/);
 assert.match(payrollConsistencyWarning({taxRegime:'simples',annex:'IV'},{regime:'simples_other'}),/Anexo IV.*demais anexos/);
 assert.match(payrollConsistencyWarning({taxRegime:'presumido',annex:'nao_definido'},{regime:'annex_iv'}),/cenário de encargos gerais/);
 assert.equal(payrollConsistencyWarning({taxRegime:'simples',annex:'III'},{regime:'simples_other'}),'');
});

test('dias trabalhados calculam custo diário sem alterar o salário mensal',()=>{
 const cost=employeeCost({contractType:'clt',salary:2800,quantity:22});
 assert.equal(cost.monthly,434778);
 assert.equal(cost.daily,19763);
 const data=fresh();data.employees=[{contractType:'clt',salary:2800,quantity:22,active:true}];
 assert.equal(summary(data).team,434778);
});
test('cadastro CLT exige dias trabalhados válidos entre 1 e 31',()=>{
 const base={name:'Ana',role:'Eletricista',contractType:'clt',salary:'2800',hours:'176',benefits:'0',extras:'0'};
 assert.throws(()=>validate('employees',base),/dias trabalhados/);
 assert.throws(()=>validate('employees',{...base,quantity:'32'}),/dias trabalhados/);
 const saved=validate('employees',{...base,quantity:'22'});
 assert.equal(saved.quantity,22);
});
