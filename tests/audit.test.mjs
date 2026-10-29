import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/audit.js';
import {calculatePlan} from '../src/calc.mjs';

const company={company:'CIVOLTEN',cnpj:'12345678000195',email:'comercial@example.com',phone:'11999999999'};
const budget=()=>({
 code:'ORC-2026-0010',client_name:'Cliente contratante',client_doc:'12345678000195',
 project_name:'Reforma edifício A',project_address:'Rua Um, 101, São Paulo - SP',
 title:'Obra teste',reference_month:'2026-07',regime:'Sem desoneração',
 bdi:25,safety_pct:15,validity_days:30,payment_terms:'30% entrada e 70% na medição final',
 notes:'Escopo com medições aferidas, exclusões: licenças e alterações de projeto.',
 totalDays:8,finish:'2026-11-15',
 summary:{rows:[{code:'1001001',description:'Serviço de limpeza de terreno',unit:'m²',qty:100,unit_cost:2,hh_unit:.5}],cost:200,total:250}
});
test('prévia comercial válida aceita abreviações de unidades',()=>{
 const result=globalThis.CIVOLTEN_AUDIT(budget(),company,{demo:false});
 assert.equal(result.ready,true);
 assert.equal(result.errors.length,0);
 assert.ok(result.warnings.some(w=>w.code==='bdi_methodology'));
});
test('ausência de coeficiente e de prazo impede proposta',()=>{
 const b=budget();b.summary.rows[0].hh_unit=0;b.totalDays=0;b.finish=null;
 const report=globalThis.CIVOLTEN_AUDIT(b,company);
 assert.equal(report.ready,false);
 assert.ok(report.errors.some(e=>e.code==='productivity'));
 assert.ok(report.errors.some(e=>e.code==='schedule'));
});
test('falhas nos dados contratuais bloqueiam emissão',()=>{
 const b=budget();b.payment_terms='A negociar';b.notes='';b.summary.rows[0].qty=-5;
 const report=globalThis.CIVOLTEN_AUDIT(b,{...company,cnpj:''});
 for(const code of ['payment','scope','quantity','company_cnpj']){
   assert.ok(report.errors.some(e=>e.code===code),'esperada pendência '+code);
 }
});
test('demonstração online não emite PDF contratual',()=>{
 const report=globalThis.CIVOLTEN_AUDIT(budget(),company,{demo:true});
 assert.ok(report.errors.some(e=>e.code==='demo'));
 assert.equal(report.ready,false);
});
test('não inventar datas de cronograma quando hh é desconhecido',()=>{
 const plan=calculatePlan([{id:1,description:'Composição sem produtividade',unit:'m²',qty:30,unit_cost:100,hh_unit:0}],{start_date:'2026-11-02',workers:2});
 assert.equal(plan.missingProductivity,1);
 assert.equal(plan.totalDays,0);
 assert.equal(plan.finish,null);
 assert.equal(plan.tasks[0].start,null);
});
