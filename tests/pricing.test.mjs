import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_COMPANY,validateCompany,companyConfig,laborRates,quoteFromCost,quoteForHours} from '../src/pricing.mjs';
const form={companyName:'CIVOLTEN',taxRegime:'simples',annex:'IV',taxPct:'10',
 marginPct:'20',productiveDays:'20',hoursPerDay:'8',productivePeople:'2'};
test('sem configuração aprovada, não apresenta preço de venda enganoso',()=>{
 assert.equal(laborRates(1600000,DEFAULT_COMPANY),null);
 assert.equal(quoteFromCost(10000,DEFAULT_COMPANY),null);
});
test('custo de toda a empresa distribui overhead entre colaboradores e horas',()=>{
 const c=validateCompany(form);
 const r=laborRates(1600000,c);
 assert.equal(r.companyDay,80000);
 assert.equal(r.personDay,40000);
 assert.equal(r.productiveHours,320);
 assert.equal(r.personHour,5000);
});
test('imposto sobre nota e margem de lucro incidem no valor final',()=>{
 const c=validateCompany(form);
 const p=quoteFromCost(10000,c);
 assert.equal(p.selling,14286);
 assert.equal(p.taxes,1429);
 assert.equal(p.grossProfit,2857);
 assert.equal(p.cost+p.taxes+p.grossProfit,p.selling);
 const q=quoteForHours(1600000,c,8,10000);
 assert.equal(q.labor,40000);assert.equal(q.cost,50000);
 assert.equal(q.selling,71429);
});
test('alíquota zero e margem zero não alteram o custo, se aprovadas',()=>{
 const c=validateCompany({...form,taxPct:0,marginPct:0});
 assert.equal(quoteFromCost(10001,c).selling,10001);
});
test('valida taxação, capacidade e preserva tema ao atualizar empresa',()=>{
 assert.throws(()=>validateCompany({...form,taxPct:70,marginPct:40}),/inferior/);
 assert.throws(()=>validateCompany({...form,productivePeople:0}),/profissionais/);
 assert.throws(()=>validateCompany({...form,productiveDays:0}),/Dias/);
 assert.throws(()=>validateCompany({...form,taxPct:''}),/Informe/);
 assert.throws(()=>validateCompany({...form,taxPct:-2}),/entre 0%/);
 assert.throws(()=>validateCompany({...form,marginPct:81}),/entre 0%/);
 assert.throws(()=>validateCompany({...form,productivePeople:1.5}),/profissionais/);
 const c=validateCompany(form,{theme:'violet'});
 assert.equal(c.theme,'violet');
 assert.equal(companyConfig({theme:'invalid'}).theme,'gold');
});
