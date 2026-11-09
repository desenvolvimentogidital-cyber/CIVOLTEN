import test from 'node:test';
import assert from 'node:assert/strict';
import {schedulePlan} from '../src/budget-schedule.mjs';
import {printableFieldSchedule,paginateFieldSchedule,workSchedulePlan} from '../src/schedule-print.mjs';

const capacity={productiveDays:22,hoursPerDay:8,productivePeople:2,
 monthlyCostCents:2115335,productiveHours:352};
const services=n=>Array.from({length:n},(_,i)=>({
 id:'S'+i,description:'Instalação elétrica e alvenaria '+i,
 unit:'m²',quantity:i+10,laborHours:1.78,roles:[{role:'Eletricista',hours:1.78}]
}));
const plan=(n,opts={})=>schedulePlan(services(n),
 {goal:'crew',crew:2,startDate:'2026-11-09',...opts},capacity);
const info=n=>({ref:'OS-2026-A1B2C3D4',customer:'Cliente CIVOLTEN',project:'Reforma residencial',
 items:services(n)});
test('PDF do campo possui marca oficial, resumo de equipe e caixas para 3 estados',()=>{
 const html=printableFieldSchedule(plan(1),info(1));
 for(const value of ['/assets/civolten-logo.png','/assets/civolten-simbolo.png',
  'CRONOGRAMA DE CAMPO','SOMENTE MÃO DE OBRA','Cliente CIVOLTEN',
  'OS-2026-A1B2C3D4','Instalação elétrica e alvenaria 0',
  'Pendente','Em execução','Concluído','Data: ____ / ____',
  'Profissional responsável','Assinatura / visto','REGISTRO DE CAMPO',
  'dias úteis','HH PLANEJADAS','Eletricista']){
  assert.ok(html.includes(value),'Campo ausente: '+value);
 }
 assert.equal((html.match(/data-field-schedule-page=/g)||[]).length,1);
 assert.equal((html.match(/class="field-schedule-check"/g)||[]).length,3);
 assert.doesNotMatch(html,/Valor contratado|R\$|Custo diário|Margem de lucro|Renda bruta|2115335/);
});
test('Cronograma multipágina mantém todos os serviços e uma única assinatura',()=>{
 const n=29,groups=paginateFieldSchedule(plan(n).rows);
 assert.ok(groups.length>=4);
 assert.equal(groups.flat().length,n);
 assert.equal(groups[0].length,5);
 assert.ok(groups.at(-1).length<=5);
 const html=printableFieldSchedule(plan(n),info(n));
 assert.equal((html.match(/data-field-schedule-page=/g)||[]).length,groups.length);
 assert.equal((html.match(/<tr><td>/g)||[]).length,n);
 assert.equal((html.match(/class="field-schedule-check"/g)||[]).length,3*n);
 assert.equal((html.match(/class="field-schedule-checkout"/g)||[]).length,1);
 assert.equal((html.match(/class="field-schedule-footer"/g)||[]).length,groups.length);
});
test('Cronograma para OS usa a proposta congelada e início previsto da obra, sem alterações',()=>{
 const b={items:services(2),pricing:capacity,
 commercial:{schedule:{goal:'crew',crew:2,startDate:'2026-11-09'}}};
 const work={id:'WORK1',contractRef:'OS-CIVOLTEN-2026',customer:'Cliente',
 project:'Obra executiva',startOn:'2026-11-16',budgetSnapshot:b,contractValue:35916};
 const original=structuredClone(work);
 const result=workSchedulePlan(work);
 assert.equal(result.startDate,'2026-11-16');
 assert.equal(workSchedulePlan({...work,startOn:null}).startDate,'2026-11-09');
 const html=printableFieldSchedule(result,{ref:work.contractRef,
  customer:work.customer,project:work.project,items:b.items});
 assert.match(html,/16\/11\/2026/);
 assert.doesNotMatch(html,/35\.916|R\$|35916/);
 assert.deepEqual(work,original);
});
test('Campos textuais de obra e serviço são escapados para evitar HTML inserido',()=>{
 const data=services(1);data[0].description='<img src=x onerror=alert(1)>';
 const html=printableFieldSchedule(schedulePlan(data,{goal:'crew',crew:2},capacity),
 {customer:'<script>alert(1)</script>',project:'Minha obra',items:data});
 assert.doesNotMatch(html,/<script>|<img src=x/);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/&lt;img/);
 assert.throws(()=>printableFieldSchedule(null),/Preencha serviços/);
 assert.throws(()=>workSchedulePlan({}),/não possui serviços/);
});
